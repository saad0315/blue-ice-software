import { CashHandoverStatus, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';

import { db } from '@/lib/db';

// --------------------------------------------------------
// 1. DRIVER FUNCTIONS - End of Day Cash Handover
// --------------------------------------------------------

/**
 * Calculate expected cash for a driver on a specific date
 */
export async function calculateExpectedCash(driverId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const result = await db.order.aggregate({
    where: {
      driverId,
      scheduledDate: { gte: startOfDay, lte: endOfDay },
      status: OrderStatus.COMPLETED,
      paymentMethod: PaymentMethod.CASH,
    },
    _sum: {
      cashCollected: true,
    },
  });

  return result._sum.cashCollected?.toString() || '0';
}

/**
 * Get all dates that have unhanded cash (completed cash orders but no verified handover)
 * This is critical for tracking pending cash from previous days
 */
export async function getPendingCashDates(driverId: string): Promise<Date[]> {
  // Get all dates with completed cash orders
  const ordersWithCash = await db.order.findMany({
    where: {
      driverId,
      status: OrderStatus.COMPLETED,
      paymentMethod: PaymentMethod.CASH,
    },
    select: {
      scheduledDate: true,
    },
    distinct: ['scheduledDate'],
    orderBy: { scheduledDate: 'asc' },
  });

  // Get all dates with verified or adjusted handovers (both are considered settled)
  const settledHandovers = await db.cashHandover.findMany({
    where: {
      driverId,
      status: { in: [CashHandoverStatus.VERIFIED, CashHandoverStatus.ADJUSTED] },
    },
    select: {
      date: true,
    },
  });

  const verifiedDates = new Set(settledHandovers.map((h) => h.date.toISOString().split('T')[0]));

  // Return dates that have cash orders but no verified handover
  return ordersWithCash
    .map((o) => o.scheduledDate)
    .filter((date) => !verifiedDates.has(date.toISOString().split('T')[0]));
}

/**
 * Get pending (unhanded-over) cash from previous days
 * Returns breakdown by date and total
 */
export async function getPendingCashFromPreviousDays(driverId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Get all dates with unhanded cash before today
  const pendingDates = await getPendingCashDates(driverId);
  const previousDates = pendingDates.filter((date) => {
    const dateOnly = new Date(date);
    dateOnly.setUTCHours(0, 0, 0, 0);
    return dateOnly < today;
  });

  if (previousDates.length === 0) {
    return {
      totalPendingCash: '0',
      totalPendingExpenses: '0',
      netPendingCash: '0',
      pendingDays: [],
    };
  }

  // Get cash and expenses for each pending date
  const pendingDays = await Promise.all(
    previousDates.map(async (date) => {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const [cashData, expenseData, handover] = await Promise.all([
        // Cash collected on this date
        db.order.aggregate({
          where: {
            driverId,
            scheduledDate: { gte: startOfDay, lte: endOfDay },
            status: OrderStatus.COMPLETED,
            paymentMethod: PaymentMethod.CASH,
          },
          _sum: { cashCollected: true },
          _count: { id: true },
        }),

        // Expenses for this date (paid from cash on hand) - only APPROVED ones
        db.expense.aggregate({
          where: {
            driverId,
            date: { gte: startOfDay, lte: endOfDay },
            paymentMethod: 'CASH_ON_HAND',
            status: 'APPROVED',
          },
          _sum: { amount: true },
        }),

        // Check if there's a pending (unverified) handover
        db.cashHandover.findUnique({
          where: {
            driverId_date: {
              driverId,
              date: new Date(startOfDay.toDateString()),
            },
          },
          select: {
            id: true,
            status: true,
            actualCash: true,
          },
        }),
      ]);

      const grossCash = parseFloat(cashData._sum.cashCollected?.toString() || '0');
      const expenses = parseFloat(expenseData._sum.amount?.toString() || '0');
      const netCash = grossCash - expenses;

      return {
        date: startOfDay,
        grossCash: grossCash.toFixed(2),
        expenses: expenses.toFixed(2),
        netCash: netCash.toFixed(2),
        orderCount: cashData._count.id,
        hasPendingHandover: handover?.status === CashHandoverStatus.PENDING,
        handoverId: handover?.id || null,
      };
    })
  );

  // Calculate totals
  const totalPendingCash = pendingDays.reduce((sum, day) => sum + parseFloat(day.grossCash), 0);
  const totalPendingExpenses = pendingDays.reduce((sum, day) => sum + parseFloat(day.expenses), 0);
  const netPendingCash = totalPendingCash - totalPendingExpenses;

  return {
    totalPendingCash: totalPendingCash.toFixed(2),
    totalPendingExpenses: totalPendingExpenses.toFixed(2),
    netPendingCash: netPendingCash.toFixed(2),
    pendingDays: pendingDays.filter((day) => parseFloat(day.grossCash) > 0), // Only include days with actual cash
  };
}

/**
 * Get driver's day summary for cash handover
 * Includes today's stats AND pending cash from previous days (not yet handed over)
 */
export async function getDriverDaySummary(driverId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Normalize date for handover lookup
  const normalizedDate = new Date(date.toISOString().split('T')[0]);

  const [ordersData, cashData, bottleData, pendingFromPreviousDays, todayHandover] = await Promise.all([
    // Order counts
    db.order.groupBy({
      by: ['status'],
      where: {
        driverId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
      },
      _count: { id: true },
    }),

    // Cash orders
    db.order.findMany({
      where: {
        driverId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.CASH,
      },
      select: {
        id: true,
        readableId: true,
        cashCollected: true,
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
    }),

    // Bottle summary
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

    // Get pending cash from previous days (critical for tracking unhanded cash)
    getPendingCashFromPreviousDays(driverId),

    // Check if there's already a handover for today
    db.cashHandover.findUnique({
      where: {
        driverId_date: {
          driverId,
          date: normalizedDate,
        },
      },
      select: {
        id: true,
        status: true,
        actualCash: true,
        expectedCash: true,
        discrepancy: true,
        submittedAt: true,
        verifiedAt: true,
      },
    }),
  ]);

  const totalOrders = ordersData.reduce((acc, curr) => acc + curr._count.id, 0);
  const completedOrders = ordersData.find((o) => o.status === OrderStatus.COMPLETED)?._count.id || 0;
  const cashOrders = cashData.length;

  // Calculate expenses paid from cash on hand for this driver today
  // Only count APPROVED expenses - PENDING and REJECTED should NOT affect cash calculations
  const expenses = await db.expense.aggregate({
    where: {
      driverId,
      date: { gte: startOfDay, lte: endOfDay },
      paymentMethod: 'CASH_ON_HAND',
      status: 'APPROVED',
    },
    _sum: { amount: true },
  });

  const expensesAmount = parseFloat(expenses._sum.amount?.toString() || '0');
  const grossCash = cashData.reduce((acc, order) => acc + parseFloat(order.cashCollected.toString()), 0);
  const todayExpectedCash = grossCash - expensesAmount;

  // Calculate total expected cash including pending from previous days
  const pendingCashFromPreviousDays = parseFloat(pendingFromPreviousDays.netPendingCash);
  const totalExpectedCash = todayExpectedCash + pendingCashFromPreviousDays;

  // Determine handover status and whether cash is already settled
  const isHandoverSubmitted = !!todayHandover;
  const isHandoverVerified = todayHandover?.status === CashHandoverStatus.VERIFIED || todayHandover?.status === CashHandoverStatus.ADJUSTED;
  const isHandoverPending = todayHandover?.status === CashHandoverStatus.PENDING;

  // If today's handover is verified, the cash is settled - nothing pending for today
  // But we still need to check pendingFromPreviousDays (in case of edge cases)
  const effectiveTotalExpectedCash = isHandoverVerified ? 0 : totalExpectedCash;

  return {
    // Today's stats
    totalOrders,
    completedOrders,
    cashOrders,
    grossCash: grossCash.toFixed(2),
    expensesAmount: expensesAmount.toFixed(2),
    expectedCash: todayExpectedCash.toFixed(2), // Today's expected (for backward compatibility)
    bottlesGiven: bottleData._sum.filledGiven || 0,
    bottlesTaken: bottleData._sum.emptyTaken || 0,
    ordersPaidInCash: cashData.map((order) => ({
      id: order.id,
      readableId: order.readableId,
      customerName: order.customer.user.name,
      amount: order.cashCollected.toString(),
    })),

    // Pending cash from previous days
    pendingFromPreviousDays: {
      totalPendingCash: pendingFromPreviousDays.totalPendingCash,
      totalPendingExpenses: pendingFromPreviousDays.totalPendingExpenses,
      netPendingCash: pendingFromPreviousDays.netPendingCash,
      pendingDays: pendingFromPreviousDays.pendingDays,
      hasPendingCash: pendingCashFromPreviousDays > 0,
    },

    // Total cash to handover (today + previous days pending)
    // If handover is verified, this will be 0
    totalExpectedCash: effectiveTotalExpectedCash.toFixed(2),

    // Today's handover status - CRITICAL for UI to show correct state
    todayHandover: todayHandover
      ? {
        id: todayHandover.id,
        status: todayHandover.status,
        actualCash: todayHandover.actualCash.toString(),
        expectedCash: todayHandover.expectedCash.toString(),
        discrepancy: todayHandover.discrepancy.toString(),
        submittedAt: todayHandover.submittedAt,
        verifiedAt: todayHandover.verifiedAt,
      }
      : null,
    isHandoverSubmitted,
    isHandoverVerified,
    isHandoverPending,
  };
}

export async function submitCashHandover(data: {
  driverId: string;
  date: Date;
  actualCash: number;
  driverNotes?: string;
  shiftStart?: Date;
  shiftEnd?: Date;
}) {
  const { driverId, date, actualCash, driverNotes, shiftStart, shiftEnd } = data;

  // Normalize date to YYYY-MM-DD UTC Midnight strictly to prevent duplicates due to timezone shifts
  // This ensures that "2026-01-19T00:00:00Z" and "Mon Jan 19 2026" (Local) are treated as the same business day
  const dateStr = date.toISOString().split('T')[0];
  const normalizedDate = new Date(dateStr);

  // Get day summary (includes pending cash from previous days)
  const summary = await getDriverDaySummary(driverId, normalizedDate);

  // Use totalExpectedCash which includes today's cash + pending from previous days
  const expectedCash = parseFloat(summary.totalExpectedCash);
  const discrepancy = expectedCash - actualCash;

  // Check if handover already exists
  const existing = await db.cashHandover.findUnique({
    where: {
      driverId_date: {
        driverId,
        date: normalizedDate,
      },
    },
  });

  if (existing) {
    // Update existing handover if still PENDING
    if (existing.status !== CashHandoverStatus.PENDING) {
      throw new Error('Cannot update verified handover');
    }

    return await db.cashHandover.update({
      where: { id: existing.id },
      data: {
        actualCash,
        discrepancy,
        driverNotes,
        shiftStart,
        shiftEnd,
        expectedCash,
        totalOrders: summary.totalOrders,
        completedOrders: summary.completedOrders,
        cashOrders: summary.cashOrders,
        bottlesGiven: summary.bottlesGiven,
        bottlesTaken: summary.bottlesTaken,
        updatedAt: new Date(),
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
  }

  // Create new handover
  return await db.cashHandover.create({
    data: {
      driverId,
      date: normalizedDate,
      expectedCash,
      actualCash,
      discrepancy,
      driverNotes,
      shiftStart,
      shiftEnd,
      totalOrders: summary.totalOrders,
      completedOrders: summary.completedOrders,
      cashOrders: summary.cashOrders,
      bottlesGiven: summary.bottlesGiven,
      bottlesTaken: summary.bottlesTaken,
      status: CashHandoverStatus.PENDING,
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
    },
  });

  if (!handover) return null;

  // Calculate potential "Hidden Expenses" (Pending) for this date range
  const startOfDay = new Date(handover.date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(handover.date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const pendingExpenses = await db.expense.aggregate({
    where: {
      driverId: handover.driverId,
      date: { gte: startOfDay, lte: endOfDay },
      paymentMethod: 'CASH_ON_HAND',
      status: 'PENDING',
    },
    _sum: { amount: true },
  });

  const pendingExpenseAmount = parseFloat(pendingExpenses._sum.amount?.toString() || '0');

  // "Gross Cash" is essentially (Expected Net + Expenses Deducted)
  // But wait, the stored `expectedCash` was calculated as (Gross - All Non-Rejected Expenses).
  // If we want to show "Gross", we need to add back the expenses that were deducted.

  // Let's fetch ALL approved expenses for that day to reconstruct Gross
  const allExpenses = await db.expense.aggregate({
    where: {
      driverId: handover.driverId,
      date: { gte: startOfDay, lte: endOfDay },
      paymentMethod: 'CASH_ON_HAND',
      status: 'APPROVED',
    },
    _sum: { amount: true },
  });

  const totalDeductedExpenses = parseFloat(allExpenses._sum.amount?.toString() || '0');
  const grossCash = parseFloat(handover.expectedCash.toString()) + totalDeductedExpenses;

  return {
    ...handover,
    grossCash: grossCash.toFixed(2),
    pendingExpenseAmount: pendingExpenseAmount.toFixed(2),
  };
}

/**
 * Verify cash handover (Admin action)
 * IMPORTANT: This now handles cumulative cash from previous days.
 * When a handover is verified, it settles all pending cash up to that date.
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
    // 0. Re-calculate Expected Cash (Crucial Step)
    // The expectedCash stored in the handover already includes pending cash from previous days.
    // However, we need to recalculate in case expenses were added/approved AFTER submission.

    const handoverDate = new Date(handover.date);
    handoverDate.setUTCHours(0, 0, 0, 0);

    // Get all dates with pending cash (no verified handover) up to and including handover date
    const ordersWithCash = await tx.order.findMany({
      where: {
        driverId: handover.driverId,
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.CASH,
        scheduledDate: { lte: handoverDate },
      },
      select: {
        scheduledDate: true,
        cashCollected: true,
      },
    });

    // Get settled (verified or adjusted) handover dates (to exclude from calculation)
    const settledHandovers = await tx.cashHandover.findMany({
      where: {
        driverId: handover.driverId,
        status: { in: [CashHandoverStatus.VERIFIED, CashHandoverStatus.ADJUSTED] },
        date: { lt: handoverDate },
      },
      select: {
        date: true,
      },
    });

    const verifiedDates = new Set(settledHandovers.map((h) => h.date.toISOString().split('T')[0]));

    // Calculate total pending cash from all unverified dates
    let totalPendingGrossCash = new Prisma.Decimal(0);
    const pendingDatesSet = new Set<string>();

    ordersWithCash.forEach((order) => {
      const dateStr = order.scheduledDate.toISOString().split('T')[0];
      if (!verifiedDates.has(dateStr)) {
        totalPendingGrossCash = totalPendingGrossCash.add(order.cashCollected);
        pendingDatesSet.add(dateStr);
      }
    });

    // Get total expenses from all pending dates
    const pendingDatesArray = Array.from(pendingDatesSet);
    let totalExpenses = new Prisma.Decimal(0);

    for (const dateStr of pendingDatesArray) {
      const date = new Date(dateStr);
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const dayExpenses = await tx.expense.aggregate({
        where: {
          driverId: handover.driverId,
          date: { gte: startOfDay, lte: endOfDay },
          paymentMethod: 'CASH_ON_HAND',
          status: 'APPROVED',
        },
        _sum: { amount: true },
      });

      totalExpenses = totalExpenses.add(new Prisma.Decimal(dayExpenses._sum.amount?.toString() || '0'));
    }

    // Calculate True Expected Cash (cumulative)
    const trueExpectedCash = totalPendingGrossCash.sub(totalExpenses);

    // Calculate True Discrepancy
    // Discrepancy = Expected - Actual
    const actualCash = new Prisma.Decimal(handover.actualCash);
    const trueDiscrepancy = trueExpectedCash.sub(actualCash);

    // 1. Update Handover Status AND Financials
    const updatedHandover = await tx.cashHandover.update({
      where: { id },
      data: {
        status,
        verifiedBy,
        verifiedAt: new Date(),
        adminNotes,
        adjustmentAmount: adjustmentAmount ? adjustmentAmount : undefined,
        // Update snapshot with verified truth
        expectedCash: trueExpectedCash,
        discrepancy: trueDiscrepancy,
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
    // Discrepancy = Expected - Actual
    // Positive Discrepancy (Expected > Actual) = Shortage = Driver Owes Money (Debit)
    // Negative Discrepancy (Expected < Actual) = Excess = Driver Paid Extra (Credit)

    if (status === CashHandoverStatus.VERIFIED || status === CashHandoverStatus.ADJUSTED) {
      const finalDiscrepancy = updatedHandover.discrepancy;

      // If Shortage (Discrepancy > 0) -> Driver Owes Company -> Debit
      if (finalDiscrepancy.gt(0)) {
        // Create Debit in DriverLedger
        await tx.driverLedger.create({
          data: {
            driverId: updatedHandover.driverId,
            amount: finalDiscrepancy.neg(), // Debit is negative
            description: `Cash Shortage - ${updatedHandover.date.toDateString()}`,
            referenceId: updatedHandover.id,
            balanceAfter: new Prisma.Decimal(0), // TODO: Fetch previous balance + this. For now simplified.
          },
        });
      }
      // If Excess (Discrepancy < 0) -> Company Owes Driver -> Credit
      else if (finalDiscrepancy.lt(0)) {
        await tx.driverLedger.create({
          data: {
            driverId: updatedHandover.driverId,
            amount: finalDiscrepancy.abs(), // Credit is positive
            description: `Cash Excess - ${updatedHandover.date.toDateString()}`,
            referenceId: updatedHandover.id,
            balanceAfter: new Prisma.Decimal(0), // TODO: Fetch previous balance + this.
          },
        });
      }

      // 3. Create verified handover records for previous pending days
      // This ensures that once cash is handed over, previous days don't show as pending anymore
      const handoverDateStr = handoverDate.toISOString().split('T')[0];
      for (const dateStr of pendingDatesArray) {
        // Skip the current handover date (already updated above)
        if (dateStr === handoverDateStr) continue;

        const previousDate = new Date(dateStr);

        // Check if handover record already exists for this date
        const existingHandover = await tx.cashHandover.findUnique({
          where: {
            driverId_date: {
              driverId: handover.driverId,
              date: previousDate,
            },
          },
        });

        if (existingHandover) {
          // Update existing pending handover to verified (settled via main handover)
          if (existingHandover.status === CashHandoverStatus.PENDING) {
            await tx.cashHandover.update({
              where: { id: existingHandover.id },
              data: {
                status: CashHandoverStatus.VERIFIED,
                verifiedBy,
                verifiedAt: new Date(),
                adminNotes: `Settled via handover on ${handoverDate.toDateString()}`,
              },
            });
          }
        } else {
          // Calculate the day's expected cash for record keeping
          const dayStartOfDay = new Date(previousDate);
          dayStartOfDay.setUTCHours(0, 0, 0, 0);
          const dayEndOfDay = new Date(previousDate);
          dayEndOfDay.setUTCHours(23, 59, 59, 999);

          const dayCashOrders = await tx.order.aggregate({
            where: {
              driverId: handover.driverId,
              scheduledDate: { gte: dayStartOfDay, lte: dayEndOfDay },
              status: OrderStatus.COMPLETED,
              paymentMethod: PaymentMethod.CASH,
            },
            _sum: { cashCollected: true },
            _count: { id: true },
          });

          const dayExpenses = await tx.expense.aggregate({
            where: {
              driverId: handover.driverId,
              date: { gte: dayStartOfDay, lte: dayEndOfDay },
              paymentMethod: 'CASH_ON_HAND',
              status: 'APPROVED',
            },
            _sum: { amount: true },
          });

          const dayGrossCash = parseFloat(dayCashOrders._sum.cashCollected?.toString() || '0');
          const dayExpensesAmount = parseFloat(dayExpenses._sum.amount?.toString() || '0');
          const dayNetCash = dayGrossCash - dayExpensesAmount;

          // Create a verified handover record for the previous day
          await tx.cashHandover.create({
            data: {
              driverId: handover.driverId,
              date: previousDate,
              expectedCash: dayNetCash,
              actualCash: dayNetCash, // Assume full amount was included in main handover
              discrepancy: 0,
              status: CashHandoverStatus.VERIFIED,
              verifiedBy,
              verifiedAt: new Date(),
              adminNotes: `Settled via handover on ${handoverDate.toDateString()}`,
              cashOrders: dayCashOrders._count.id,
            },
          });
        }
      }
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
  startOfRange.setUTCHours(0, 0, 0, 0);

  const endOfRange = endDate ? new Date(endDate) : new Date(startOfRange);
  endOfRange.setUTCHours(23, 59, 59, 999);

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
        scheduledDate: { gte: startOfRange, lte: endOfRange },
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
      // UPDATE: User wants to see ALL discrepancies for the day (e.g. shortages from rejected expenses)
      totalDiscrepancy: handoverStats.reduce(
        (sum, s) => sum + (s._sum.discrepancy ? parseFloat(s._sum.discrepancy.toString()) : 0),
        0
      ),
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
  startOfRange.setUTCHours(0, 0, 0, 0);
  const endOfRange = new Date(end);
  endOfRange.setUTCHours(23, 59, 59, 999);

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
  startDate.setUTCHours(0, 0, 0, 0);

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
