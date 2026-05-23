import { OrderStatus, PaymentMethod } from '@prisma/client';

import { toUtcEndOfDay, toUtcStartOfDay } from '@/lib/date-utils';
import { db } from '@/lib/db';

export async function getDriverStats(driverId: string, date: Date) {
  // Use PKT-aware UTC boundaries for consistent date filtering
  const startOfDay = toUtcStartOfDay(date);
  const endOfDay = toUtcEndOfDay(date);

  const completedOrdersWhere = {
    driverId,
    scheduledDate: { gte: startOfDay, lte: endOfDay },
    status: OrderStatus.COMPLETED,
  };

  const [statusGroups, paymentGroups, expenseData, bottleData, unlinkedOrdersData, unlinkedExpensesData] = await Promise.all([
    // Order counts grouped by status
    db.order.groupBy({
      by: ['status'],
      where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } },
      _count: { id: true },
    }),

    // Financial breakdown by payment method
    db.order.groupBy({
      by: ['paymentMethod'],
      where: completedOrdersWhere,
      _sum: { cashCollected: true },
      _count: { id: true },
    }),

    // Expenses - only count APPROVED expenses (PENDING and REJECTED should not affect cash)
    db.expense.aggregate({
      where: {
        driverId,
        date: { gte: startOfDay, lte: endOfDay },
        paymentMethod: 'CASH_ON_HAND',
        status: 'APPROVED',
      },
      _sum: { amount: true },
    }),

    // Bottle exchange data from completed orders
    db.orderItem.aggregate({
      where: {
        order: completedOrdersWhere,
      },
      _sum: {
        filledGiven: true,
        emptyTaken: true,
        damagedReturned: true,
      },
    }),

    // Get unlinked pending cash (Transaction Based)
    db.order.aggregate({
      where: {
        driverId,
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.CASH,
        cashHandoverId: null,
      },
      _sum: { cashCollected: true },
    }),

    // Get unlinked pending expenses (Transaction Based)
    db.expense.aggregate({
      where: {
        driverId,
        status: 'APPROVED',
        paymentMethod: 'CASH_ON_HAND',
        cashHandoverId: null,
      },
      _sum: { amount: true },
    }),
  ]);

  // Derive counts in-memory from statusGroups
  let totalOrders = 0;
  let completedOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  let rescheduledOrders = 0;

  for (const group of statusGroups) {
    totalOrders += group._count.id;
    if (group.status === OrderStatus.COMPLETED) {
      completedOrders += group._count.id;
    }
    if ([OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS].includes(group.status as any)) {
      pendingOrders += group._count.id;
    }
    if (group.status === OrderStatus.CANCELLED) {
      cancelledOrders += group._count.id;
    }
    if (group.status === OrderStatus.RESCHEDULED) {
      rescheduledOrders += group._count.id;
    }
  }

  // Derive financial metrics in-memory from paymentGroups
  const cashOrders = { _sum: { cashCollected: 0 }, _count: 0 };
  const onlineOrders = { _sum: { cashCollected: 0 }, _count: 0 };
  const creditOrders = { _sum: { cashCollected: 0 }, _count: 0 };
  const prepaidOrders = { _sum: { cashCollected: 0 }, _count: 0 };

  for (const group of paymentGroups) {
    if (group.paymentMethod === PaymentMethod.CASH) {
      cashOrders._sum.cashCollected = Number(group._sum?.cashCollected || 0);
      cashOrders._count = group._count.id;
    } else if (group.paymentMethod === PaymentMethod.ONLINE_TRANSFER) {
      onlineOrders._sum.cashCollected = Number(group._sum?.cashCollected || 0);
      onlineOrders._count = group._count.id;
    } else if (group.paymentMethod === PaymentMethod.CREDIT) {
      creditOrders._sum.cashCollected = Number(group._sum?.cashCollected || 0);
      creditOrders._count = group._count.id;
    } else if (group.paymentMethod === PaymentMethod.PREPAID_WALLET) {
      prepaidOrders._sum.cashCollected = Number(group._sum?.cashCollected || 0);
      prepaidOrders._count = group._count.id;
    }
  }

  const cashCollected = cashOrders._sum.cashCollected;
  const onlineCollected = onlineOrders._sum.cashCollected;
  const creditGiven = creditOrders._sum.cashCollected;
  const prepaidUsed = prepaidOrders._sum.cashCollected;
  const expenses = parseFloat(expenseData._sum.amount?.toString() || '0');

  const filledGiven = bottleData._sum.filledGiven || 0;
  const emptyTaken = bottleData._sum.emptyTaken || 0;
  const damagedReturned = bottleData._sum.damagedReturned || 0;

  // Calculate Transaction-Based Total Pending Cash
  const totalUnlinkedCash = parseFloat(unlinkedOrdersData._sum.cashCollected?.toString() || '0');
  const totalUnlinkedExpenses = parseFloat(unlinkedExpensesData._sum.amount?.toString() || '0');
  const netPendingCash = totalUnlinkedCash - totalUnlinkedExpenses;

  // "todayNetCash" is mostly for display. The critical operational number is "netPendingCash"
  const todayNetCash = cashCollected - expenses;

  return {
    // Order breakdown
    totalOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    rescheduledOrders,

    // Financial breakdown (today only)
    cashCollected: todayNetCash.toFixed(2),
    grossCash: cashCollected.toFixed(2),
    onlineCollected: onlineCollected.toFixed(2),
    creditGiven: creditGiven.toFixed(2),
    prepaidUsed: prepaidUsed.toFixed(2),
    expenses: expenses.toFixed(2),
    netCash: todayNetCash.toFixed(2),

    // Pending cash (Transaction Based)
    pendingFromPreviousDays: {
      totalPendingCash: totalUnlinkedCash.toFixed(2),
      totalPendingExpenses: totalUnlinkedExpenses.toFixed(2),
      netPendingCash: netPendingCash.toFixed(2),
      pendingDaysCount: 0, // Deprecated
      pendingDays: [], // Deprecated
      hasPendingCash: netPendingCash > 0,
    },

    // Total cash to handover (Total Net Pending)
    totalPendingCash: netPendingCash.toFixed(2),

    // Order counts by payment method
    cashOrdersCount: cashOrders._count || 0,
    onlineOrdersCount: onlineOrders._count || 0,
    creditOrdersCount: creditOrders._count || 0,
    prepaidOrdersCount: prepaidOrders._count || 0,

    // Bottles breakdown
    filledGiven,
    emptyTaken,
    damagedReturned,
    bottleBalance: filledGiven - emptyTaken,

    // Meta
    lastUpdated: new Date().toISOString(),
  };
}
