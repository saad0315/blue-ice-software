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

  const [ordersByStatus, ordersByPaymentMethod, expenseData, bottleData, unlinkedOrdersData, unlinkedExpensesData] = await Promise.all([
    // Order counts grouped by status
    db.order.groupBy({
      by: ['status'],
      where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } },
      _count: { id: true },
    }),

    // Financial breakdown by payment method grouped
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

  // Derive order counts in-memory
  const totalOrders = ordersByStatus.reduce((sum, s) => sum + s._count.id, 0);
  const completedOrders = ordersByStatus.find((s) => s.status === OrderStatus.COMPLETED)?._count.id || 0;
  const cancelledOrders = ordersByStatus.find((s) => s.status === OrderStatus.CANCELLED)?._count.id || 0;
  const rescheduledOrders = ordersByStatus.find((s) => s.status === OrderStatus.RESCHEDULED)?._count.id || 0;
  const pendingOrders = ordersByStatus
    .filter((s) => [OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS].includes(s.status))
    .reduce((sum, s) => sum + s._count.id, 0);

  // Derive financial stats by payment method in-memory
  const paymentStats = {
    [PaymentMethod.CASH]: { count: 0, sum: 0 },
    [PaymentMethod.ONLINE_TRANSFER]: { count: 0, sum: 0 },
    [PaymentMethod.CREDIT]: { count: 0, sum: 0 },
    [PaymentMethod.PREPAID_WALLET]: { count: 0, sum: 0 },
  };

  ordersByPaymentMethod.forEach((p) => {
    if (paymentStats[p.paymentMethod]) {
      paymentStats[p.paymentMethod].count = p._count.id;
      paymentStats[p.paymentMethod].sum = parseFloat(p._sum.cashCollected?.toString() || '0');
    }
  });

  const cashCollected = paymentStats[PaymentMethod.CASH].sum;
  const onlineCollected = paymentStats[PaymentMethod.ONLINE_TRANSFER].sum;
  const creditGiven = paymentStats[PaymentMethod.CREDIT].sum;
  const prepaidUsed = paymentStats[PaymentMethod.PREPAID_WALLET].sum;

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
    cashOrdersCount: paymentStats[PaymentMethod.CASH].count,
    onlineOrdersCount: paymentStats[PaymentMethod.ONLINE_TRANSFER].count,
    creditOrdersCount: paymentStats[PaymentMethod.CREDIT].count,
    prepaidOrdersCount: paymentStats[PaymentMethod.PREPAID_WALLET].count,

    // Bottles breakdown
    filledGiven,
    emptyTaken,
    damagedReturned,
    bottleBalance: filledGiven - emptyTaken,

    // Meta
    lastUpdated: new Date().toISOString(),
  };
}
