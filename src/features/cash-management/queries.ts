import { CashHandoverStatus, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';

import { db } from '@/lib/db';

// --------------------------------------------------------
// 1. DRIVER FUNCTIONS - End of Day Cash Handover
// --------------------------------------------------------

/**
 * TRANSACTION-BASED LOGIC: Get pending cash from unlinked orders/expenses
 */
export async function getPendingCashFromUnlinkedItems(driverId: string) {
  // 1. Get unlinked cash orders
  const unlinkedOrders = await db.order.findMany({
    where: {
      driverId,
      status: OrderStatus.COMPLETED,
      paymentMethod: PaymentMethod.CASH,
      cashHandoverId: null,
    },
    select: {
      id: true,
      readableId: true,
      cashCollected: true,
      scheduledDate: true,
      customer: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { scheduledDate: 'asc' },
  });

  // 2. Get unlinked approved expenses
  const unlinkedExpenses = await db.expense.findMany({
    where: {
      driverId,
      status: 'APPROVED',
      paymentMethod: 'CASH_ON_HAND',
      cashHandoverId: null,
    },
    select: {
      id: true,
      amount: true,
      category: true,
      date: true,
      description: true,
    },
    orderBy: { date: 'asc' },
  });

  const totalCashCollected = unlinkedOrders.reduce(
    (sum, order) => sum + parseFloat(order.cashCollected.toString()),
    0
  );

  const totalExpenses = unlinkedExpenses.reduce(
    (sum, expense) => sum + parseFloat(expense.amount.toString()),
    0
  );

  return {
    netPendingCash: (totalCashCollected - totalExpenses).toFixed(2),
    totalCashCollected: totalCashCollected.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    unlinkedOrders,
    unlinkedExpenses,
  };
}

/**
 * Get driver's day summary for cash handover
 * Uses transaction-based logic: pending cash is sum of ALL unlinked items
 */
export async function getDriverDaySummary(driverId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const [ordersData, bottleData, pendingCashData, activeHandover] = await Promise.all([
    // Order counts for TODAY
    db.order.groupBy({
      by: ['status'],
      where: {
        driverId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
      },
      _count: { id: true },
    }),

    // Bottle summary for TODAY
    db.orderItem.aggregate({
      where: {
        order: {
          driverId,
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: OrderStatus.COMPLETED,
        },
      },
      _sum: {
        filledGiven: true,
        emptyTaken: true,
      },
    }),

    // Pending Cash (Transaction Based - All Time Unlinked)
    getPendingCashFromUnlinkedItems(driverId),

    // Check for an active PENDING handover
    db.cashHandover.findFirst({
      where: {
        driverId,
        status: CashHandoverStatus.PENDING,
      },
      orderBy: { submittedAt: 'desc' },
    }),
  ]);

  const totalOrders = ordersData.reduce((acc, curr) => acc + curr._count.id, 0);
  const completedOrders = ordersData.find((o) => o.status === OrderStatus.COMPLETED)?._count.id || 0;

  // Format pending orders for UI
  const ordersPaidInCash = pendingCashData.unlinkedOrders.map((order) => ({
    id: order.id,
    readableId: order.readableId,
    customerName: order.customer.user.name,
    amount: order.cashCollected.toString(),
    date: order.scheduledDate,
  }));

  // If there is an active pending handover, we assume the pending cash is effectively "0"
  // because it's locked in that handover until verified or cancelled.
  // Or should we show the handover amount?
  // The UI expects `totalExpectedCash` to be the amount to submit.
  // If a handover is already submitted, expected is 0 (or N/A).

  return {
    // Today's stats (Operational)
    totalOrders,
    completedOrders,
    bottlesGiven: bottleData._sum.filledGiven || 0,
    bottlesTaken: bottleData._sum.emptyTaken || 0,

    // Financials (Transaction Based)
    totalExpectedCash: activeHandover ? '0.00' : pendingCashData.netPendingCash,
    grossCash: pendingCashData.totalCashCollected,
    expensesAmount: pendingCashData.totalExpenses,

    // Breakdown
    ordersPaidInCash,
    unlinkedExpenses: pendingCashData.unlinkedExpenses,

    // Legacy fields map
    pendingFromPreviousDays: {
      hasPendingCash: false, // Deprecated logic
      netPendingCash: '0',
      pendingDays: [],
    },

    // Active Handover
    todayHandover: activeHandover
      ? {
          id: activeHandover.id,
          status: activeHandover.status,
          actualCash: activeHandover.actualCash.toString(),
          expectedCash: activeHandover.expectedCash.toString(),
          discrepancy: activeHandover.discrepancy.toString(),
          submittedAt: activeHandover.submittedAt,
          verifiedAt: activeHandover.verifiedAt,
        }
      : null,

    isHandoverSubmitted: !!activeHandover,
    isHandoverPending: !!activeHandover,
    isHandoverVerified: false, // For now, we only care if pending exists
  };
}

export async function submitCashHandover(data: {
  driverId: string;
  date: Date;
  actualCash: number;
  driverNotes?: string;
  shiftStart?: Date;
  shiftEnd?: Date;
  expenseIds?: string[];
}) {
  const { driverId, date, actualCash, driverNotes, shiftStart, shiftEnd, expenseIds } = data;

  // Note: 'date' argument is mostly metadata now, as we link all unlinked items.
  // However, we still use it for the handover record date.
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return await db.$transaction(async (tx) => {
    // 1. Fetch ALL unlinked cash orders (The "Snapshot")
    const unlinkedOrders = await tx.order.findMany({
      where: {
        driverId,
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.CASH,
        cashHandoverId: null,
      },
      select: { id: true, cashCollected: true },
    });

    // 2. Fetch specific expenses to link (or all unlinked if not specified? Let's stick to selected for safety, or all for simplicity in Phase 1)
    // Phase 1 Plan said: "Fetch unlinked approved expenses".
    // If expenseIds provided, verify they are unlinked. If not, fetch all unlinked?
    // Let's assume frontend sends expenseIds OR we fetch all unlinked if we want to force "All Pending".
    // For Phase 1, "All or Nothing" means we should probably link ALL unlinked approved expenses.

    const unlinkedExpenses = await tx.expense.findMany({
      where: {
        driverId,
        status: 'APPROVED',
        paymentMethod: 'CASH_ON_HAND',
        cashHandoverId: null,
      },
      select: { id: true, amount: true },
    });

    const totalOrderCash = unlinkedOrders.reduce((sum, o) => sum + parseFloat(o.cashCollected.toString()), 0);
    const totalExpenseAmount = unlinkedExpenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

    const expectedCash = totalOrderCash - totalExpenseAmount;
    const discrepancy = expectedCash - actualCash;

    // 3. Create Handover
    const handover = await tx.cashHandover.create({
      data: {
        driverId,
        date: normalizedDate,
        expectedCash,
        actualCash,
        discrepancy,
        driverNotes,
        shiftStart,
        shiftEnd,
        status: CashHandoverStatus.PENDING,
        // Metrics
        cashOrders: unlinkedOrders.length,
        // We can fetch total/completed orders for the day if we want accurate day-stats,
        // but for transaction-based, "cashOrders" is the most relevant metric.
      },
    });

    // 4. Link Orders
    if (unlinkedOrders.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: unlinkedOrders.map(o => o.id) } },
        data: { cashHandoverId: handover.id },
      });
    }

    // 5. Link Expenses
    if (unlinkedExpenses.length > 0) {
      await tx.expense.updateMany({
        where: { id: { in: unlinkedExpenses.map(e => e.id) } },
        data: { cashHandoverId: handover.id },
      });
    }

    return handover;
  });
}

/**
 * Cancel a pending handover (Driver or Admin)
 * Unlinks all orders and expenses, effectively putting them back in "Pending" pool.
 */
export async function cancelCashHandover(handoverId: string, userId: string) {
  return await db.$transaction(async (tx) => {
    const handover = await tx.cashHandover.findUnique({
      where: { id: handoverId },
    });

    if (!handover) throw new Error('Handover not found');
    if (handover.status !== CashHandoverStatus.PENDING) {
      throw new Error('Only pending handovers can be cancelled');
    }

    // Unlink Orders
    await tx.order.updateMany({
      where: { cashHandoverId: handoverId },
      data: { cashHandoverId: null },
    });

    // Unlink Expenses
    await tx.expense.updateMany({
      where: { cashHandoverId: handoverId },
      data: { cashHandoverId: null },
    });

    // Delete Handover
    await tx.cashHandover.delete({
      where: { id: handoverId },
    });

    return { success: true };
  });
}

// --------------------------------------------------------
// 2. ADMIN FUNCTIONS - Cash Verification & Management
// --------------------------------------------------------

/**
 * Get all cash handovers with filters
 */
export async function getCashHandovers(params: {
  status?: CashHandoverStatus;
  driverId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const { status, driverId, startDate, endDate, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.CashHandoverWhereInput = {
    ...(status && { status }),
    ...(driverId && { driverId }),
    ...(startDate &&
      endDate && {
      date: {
        gte: startDate,
        lte: endDate,
      },
    }),
  };

  const [handovers, total] = await Promise.all([
    db.cashHandover.findMany({
      where,
      skip,
      take: limit,
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { submittedAt: 'desc' }],
    }),
    db.cashHandover.count({ where }),
  ]);

  return {
    handovers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single cash handover details
 */
export async function getCashHandover(id: string) {
  const handover = await db.cashHandover.findUnique({
    where: { id },
    include: {
      driver: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
            },
          },
        },
      },
      // Include linked items for transaction-based view
      orders: {
        select: {
          id: true,
          readableId: true,
          cashCollected: true,
          scheduledDate: true,
        }
      },
      expenses: {
        select: {
          id: true,
          amount: true,
          category: true,
          description: true,
        }
      }
    },
  });

  if (!handover) return null;

  return {
    ...handover,
    grossCash: handover.expectedCash.add(handover.expenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0)).toFixed(2),
    pendingExpenseAmount: '0.00', // Deprecated concept in transaction-based
  };
}

/**
 * Verify cash handover (Admin action)
 * TRANSACTION-BASED: Simply updates status. The linkage is already done.
 */
export async function verifyCashHandover(data: {
  id: string;
  verifiedBy: string;
  status: 'VERIFIED' | 'REJECTED' | 'ADJUSTED';
  adminNotes?: string;
  adjustmentAmount?: number;
}) {
  const { id, verifiedBy, status, adminNotes, adjustmentAmount } = data;

  const handover = await db.cashHandover.findUnique({ where: { id } });
  if (!handover) throw new Error('Cash handover not found');

  if (handover.status !== CashHandoverStatus.PENDING) {
    throw new Error('Only pending handovers can be verified');
  }

  return await db.$transaction(async (tx) => {
    // 1. Update Handover Status
    const updatedHandover = await tx.cashHandover.update({
      where: { id },
      data: {
        status,
        verifiedBy,
        verifiedAt: new Date(),
        adminNotes,
        adjustmentAmount: adjustmentAmount ? adjustmentAmount : undefined,
      },
      include: {
        driver: {
          include: {
            user: {
              select: {
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    // 2. Handle Financial Discrepancy (Driver Debt)
    // If status is VERIFIED or ADJUSTED, we assume the final "discrepancy" is now official debt/credit.

    if (status === CashHandoverStatus.VERIFIED || status === CashHandoverStatus.ADJUSTED) {
      const finalDiscrepancy = updatedHandover.discrepancy;

      if (finalDiscrepancy.gt(0)) {
        await tx.driverLedger.create({
          data: {
            driverId: updatedHandover.driverId,
            amount: finalDiscrepancy.neg(), // Debit
            description: `Cash Shortage - ${updatedHandover.date.toDateString()}`,
            referenceId: updatedHandover.id,
            balanceAfter: new Prisma.Decimal(0), // TODO: Fetch previous balance
          },
        });
      }
      else if (finalDiscrepancy.lt(0)) {
        await tx.driverLedger.create({
          data: {
            driverId: updatedHandover.driverId,
            amount: finalDiscrepancy.abs(), // Credit
            description: `Cash Excess - ${updatedHandover.date.toDateString()}`,
            referenceId: updatedHandover.id,
            balanceAfter: new Prisma.Decimal(0), // TODO: Fetch previous balance
          },
        });
      }
    }

    // REJECTED Logic: If rejected, should we unlink orders?
    // The requirement "Admin rejects but forgets to communicate" implies orders should return to pending.
    // Yes, if REJECTED, we must unlink so they appear in the next handover.
    if (status === CashHandoverStatus.REJECTED) {
       await tx.order.updateMany({
        where: { cashHandoverId: id },
        data: { cashHandoverId: null },
      });

      await tx.expense.updateMany({
        where: { cashHandoverId: id },
        data: { cashHandoverId: null },
      });
    }

    return updatedHandover;
  });
}

/**
 * Get cash management dashboard statistics
 */
export async function getCashDashboardStats(options?: { startDate?: Date; endDate?: Date }) {
  const { startDate, endDate } = options || {};

  // If no dates, default to today. If one date, use it for both start and end.
  const startOfRange = startDate ? new Date(startDate) : new Date();
  startOfRange.setHours(0, 0, 0, 0);

  const endOfRange = endDate ? new Date(endDate) : new Date(startOfRange);
  endOfRange.setHours(23, 59, 59, 999);

  const [handoverStats, todayCashOrders, pendingHandovers, discrepancies, expenseStats] = await Promise.all([
    // Handover status breakdown
    db.cashHandover.groupBy({
      by: ['status'],
      where: {
        date: { gte: startOfRange, lte: endOfRange },
      },
      _count: { id: true },
      _sum: {
        expectedCash: true,
        actualCash: true,
        discrepancy: true,
      },
    }),

    // Today's cash orders
    db.order.aggregate({
      where: {
        // This is tricky. Orders are on scheduledDate, but handover is on `date`.
        // We should probably show cash collected within the date range, regardless of handover date.
        completedAt: { gte: startOfRange, lte: endOfRange },
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.CASH,
      },
      _sum: {
        cashCollected: true,
      },
      _count: { id: true },
    }),

    // Pending handovers count - this should be global, not date-filtered
    db.cashHandover.count({
      where: {
        status: CashHandoverStatus.PENDING,
      },
    }),

    // Large discrepancies (> 500 PKR) within the date range
    db.cashHandover.count({
      where: {
        date: { gte: startOfRange, lte: endOfRange },
        discrepancy: { gt: 500 },
      },
    }),

    // Today's expense stats by status
    db.expense.groupBy({
      by: ['status'],
      where: {
        date: { gte: startOfRange, lte: endOfRange },
      },
      _count: { id: true },
      _sum: { amount: true },
    }),
  ]);

  const pending = handoverStats.find((s) => s.status === CashHandoverStatus.PENDING);
  const verified = handoverStats.find((s) => s.status === CashHandoverStatus.VERIFIED);
  const rejected = handoverStats.find((s) => s.status === CashHandoverStatus.REJECTED);

  // Calculate discrepancy only from PENDING handovers (unresolved discrepancies)
  // Verified handovers have their discrepancies already settled via ledger entries
  const pendingDiscrepancy = pending?._sum.discrepancy ? parseFloat(pending._sum.discrepancy.toString()) : 0;

  // Parse expense stats
  const pendingExpenses = expenseStats.find((s) => s.status === 'PENDING');
  const approvedExpenses = expenseStats.find((s) => s.status === 'APPROVED');
  const rejectedExpenses = expenseStats.find((s) => s.status === 'REJECTED');

  return {
    today: {
      totalCashOrders: todayCashOrders._count.id,
      totalCashCollected: todayCashOrders._sum.cashCollected?.toString() || '0',
    },
    handovers: {
      pending: pending?._count.id || 0,
      pendingAmount: pending?._sum.actualCash?.toString() || '0',
      verified: verified?._count.id || 0,
      verifiedAmount: verified?._sum.actualCash?.toString() || '0',
      rejected: rejected?._count.id || 0,
      // Only show unresolved (pending) discrepancies - verified ones are already settled
      totalDiscrepancy: pendingDiscrepancy,
    },
    expenses: {
      pending: pendingExpenses?._count.id || 0,
      pendingAmount: pendingExpenses?._sum.amount?.toString() || '0',
      approved: approvedExpenses?._count.id || 0,
      approvedAmount: approvedExpenses?._sum.amount?.toString() || '0',
      rejected: rejectedExpenses?._count.id || 0,
      rejectedAmount: rejectedExpenses?._sum.amount?.toString() || '0',
    },
    alerts: {
      pendingHandovers,
      largeDiscrepancies: discrepancies,
    },
  };
}

/**
 * Get driver's handover history
 */
export async function getDriverHandoverHistory(driverId: string, limit = 10) {
  return await db.cashHandover.findMany({
    where: { driverId },
    take: limit,
    orderBy: { date: 'desc' },
    include: {
      driver: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Get comprehensive driver financial history
 * Includes: cash handovers, expenses, and daily cash collection summaries
 */
export async function getDriverFinancialHistory(
  driverId: string,
  params: {
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }
) {
  const { startDate, endDate, page = 1, limit = 50 } = params;

  // Default to last 30 days if no dates provided
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const startOfRange = new Date(start);
  startOfRange.setHours(0, 0, 0, 0);
  const endOfRange = new Date(end);
  endOfRange.setHours(23, 59, 59, 999);

  const skip = (page - 1) * limit;

  // Fetch all financial data in parallel
  const [handovers, expenses, dailyCashCollections] = await Promise.all([
    // Cash handovers in date range
    db.cashHandover.findMany({
      where: {
        driverId,
        date: { gte: startOfRange, lte: endOfRange },
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        expectedCash: true,
        actualCash: true,
        discrepancy: true,
        status: true,
        driverNotes: true,
        verifiedAt: true,
        submittedAt: true,
      },
    }),

    // Expenses in date range
    db.expense.findMany({
      where: {
        driverId,
        date: { gte: startOfRange, lte: endOfRange },
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        amount: true,
        category: true,
        description: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
      },
    }),

    // Daily cash collection grouped by date
    db.order.groupBy({
      by: ['scheduledDate'],
      where: {
        driverId,
        scheduledDate: { gte: startOfRange, lte: endOfRange },
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.CASH,
      },
      _sum: {
        cashCollected: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        scheduledDate: 'desc',
      },
    }),
  ]);

  // Create a unified timeline of events
  type HistoryEvent = {
    id: string;
    type: 'handover' | 'expense' | 'collection';
    date: Date;
    amount: string;
    status?: string;
    details: Record<string, any>;
  };

  const events: HistoryEvent[] = [];

  // Add handovers
  handovers.forEach((h) => {
    events.push({
      id: h.id,
      type: 'handover',
      date: h.date,
      amount: h.actualCash.toString(),
      status: h.status,
      details: {
        expectedCash: h.expectedCash.toString(),
        actualCash: h.actualCash.toString(),
        discrepancy: h.discrepancy.toString(),
        driverNotes: h.driverNotes,
        verifiedAt: h.verifiedAt,
        submittedAt: h.submittedAt,
      },
    });
  });

  // Add expenses
  expenses.forEach((e) => {
    events.push({
      id: e.id,
      type: 'expense',
      date: e.date,
      amount: `-${e.amount.toString()}`, // Negative for expenses
      status: e.status,
      details: {
        category: e.category,
        description: e.description,
        paymentMethod: e.paymentMethod,
      },
    });
  });

  // Add daily collections (only for days without handover to avoid duplication)
  const handoverDates = new Set(handovers.map((h) => h.date.toISOString().split('T')[0]));
  dailyCashCollections.forEach((c) => {
    const dateStr = c.scheduledDate.toISOString().split('T')[0];
    if (!handoverDates.has(dateStr)) {
      events.push({
        id: `collection-${dateStr}`,
        type: 'collection',
        date: c.scheduledDate,
        amount: c._sum.cashCollected?.toString() || '0',
        details: {
          orderCount: c._count.id,
          hasHandover: false,
        },
      });
    }
  });

  // Sort by date descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Apply pagination
  const paginatedEvents = events.slice(skip, skip + limit);

  // Calculate summary statistics
  const totalCashCollected = dailyCashCollections.reduce(
    (sum, c) => sum + parseFloat(c._sum.cashCollected?.toString() || '0'),
    0
  );

  // Only count APPROVED expenses that were paid from CASH_ON_HAND
  // Rejected expenses should NOT be counted at all
  const totalExpensesAmount = expenses
    .filter((e) => e.status === 'APPROVED' && e.paymentMethod === 'CASH_ON_HAND')
    .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

  // Count both VERIFIED and ADJUSTED as "handed over" (both are settled)
  const totalHandedOver = handovers
    .filter((h) => h.status === 'VERIFIED' || h.status === 'ADJUSTED')
    .reduce((sum, h) => sum + parseFloat(h.actualCash.toString()), 0);
  const pendingHandoversCount = handovers.filter((h) => h.status === 'PENDING').length;

  // Net Cash should be: Cash Collected - Approved Expenses - Already Handed Over (Verified/Adjusted)
  // This represents the cash that is still pending to be handed over
  const pendingCash = totalCashCollected - totalExpensesAmount - totalHandedOver;

  return {
    events: paginatedEvents,
    summary: {
      totalCashCollected: totalCashCollected.toFixed(2),
      totalExpenses: totalExpensesAmount.toFixed(2),
      totalHandedOver: totalHandedOver.toFixed(2),
      // netCash now represents cash still pending to be handed over
      netCash: pendingCash.toFixed(2),
      pendingHandovers: pendingHandoversCount,
      handoverCount: handovers.length,
      expenseCount: expenses.length,
    },
    pagination: {
      total: events.length,
      page,
      limit,
      totalPages: Math.ceil(events.length / limit),
    },
    dateRange: {
      start: startOfRange,
      end: endOfRange,
    },
  };
}

/**
 * Get cash collection trends
 */
export async function getCashCollectionTrends(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const trends = await db.cashHandover.groupBy({
    by: ['date'],
    where: {
      date: { gte: startDate },
      status: CashHandoverStatus.VERIFIED,
    },
    _sum: {
      actualCash: true,
      expectedCash: true,
      discrepancy: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  return trends.map((t) => ({
    date: t.date,
    actualCash: t._sum.actualCash?.toString() || '0',
    expectedCash: t._sum.expectedCash?.toString() || '0',
    discrepancy: t._sum.discrepancy?.toString() || '0',
  }));
}
