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
    // Group orders by status to avoid multiple parallel count queries
    db.order.groupBy({
      by: ['status'],
      where: {
        driverId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
      },
      _count: { id: true },
    }),

    // Group completed orders by payment method to avoid multiple parallel aggregate queries
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

  // Calculate order counts in memory
  const totalOrders = ordersByStatus.reduce((acc, curr) => acc + curr._count.id, 0);
  const completedOrders = ordersByStatus.find((o) => o.status === OrderStatus.COMPLETED)?._count.id || 0;
  const cancelledOrders = ordersByStatus.find((o) => o.status === OrderStatus.CANCELLED)?._count.id || 0;
  const rescheduledOrders = ordersByStatus.find((o) => o.status === OrderStatus.RESCHEDULED)?._count.id || 0;
  const pendingOrders = ordersByStatus
    .filter((o) => ([OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS] as any).includes(o.status))
    .reduce((acc, curr) => acc + curr._count.id, 0);

  // Calculate payment method stats in memory
  const getPaymentStats = (method: PaymentMethod) => {
    const stats = ordersByPaymentMethod.find((p) => p.paymentMethod === method);
    return {
      amount: parseFloat(stats?._sum?.cashCollected?.toString() || '0'),
      count: stats?._count?.id || 0,
    };
  };

  const cashStats = getPaymentStats(PaymentMethod.CASH);
  const onlineStats = getPaymentStats(PaymentMethod.ONLINE_TRANSFER);
  const creditStats = getPaymentStats(PaymentMethod.CREDIT);
  const prepaidStats = getPaymentStats(PaymentMethod.PREPAID_WALLET);

  const expenses = parseFloat(expenseData._sum?.amount?.toString() || '0');

  const filledGiven = bottleData._sum?.filledGiven || 0;
  const emptyTaken = bottleData._sum?.emptyTaken || 0;
  const damagedReturned = bottleData._sum?.damagedReturned || 0;

  // Calculate Transaction-Based Total Pending Cash
  const totalUnlinkedCash = parseFloat(unlinkedOrdersData._sum?.cashCollected?.toString() || '0');
  const totalUnlinkedExpenses = parseFloat(unlinkedExpensesData._sum?.amount?.toString() || '0');
  const netPendingCash = totalUnlinkedCash - totalUnlinkedExpenses;

  // "todayNetCash" is mostly for display. The critical operational number is "netPendingCash"
  const todayNetCash = cashStats.amount - expenses;

  return {
    // Order breakdown
    totalOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    rescheduledOrders,

    // Financial breakdown (today only)
    cashCollected: todayNetCash.toFixed(2),
    grossCash: cashStats.amount.toFixed(2),
    onlineCollected: onlineStats.amount.toFixed(2),
    creditGiven: creditStats.amount.toFixed(2),
    prepaidUsed: prepaidStats.amount.toFixed(2),
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
    cashOrdersCount: cashStats.count,
    onlineOrdersCount: onlineStats.count,
    creditOrdersCount: creditStats.count,
    prepaidOrdersCount: prepaidStats.count,

    // Bottles breakdown
    filledGiven,
    emptyTaken,
    damagedReturned,
    bottleBalance: filledGiven - emptyTaken,

    // Meta
    lastUpdated: new Date().toISOString(),
  };
}
