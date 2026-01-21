import { OrderStatus, PaymentMethod } from '@prisma/client';

import { db } from '@/lib/db';

export async function getDriverStats(driverId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const completedOrdersWhere = {
    driverId,
    scheduledDate: { gte: startOfDay, lte: endOfDay },
    status: OrderStatus.COMPLETED,
  };

  const [
    totalOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    rescheduledOrders,
    cashOrders,
    onlineOrders,
    creditOrders,
    prepaidOrders,
    expenseData,
    bottleData,
    unlinkedOrdersData,
    unlinkedExpensesData,
  ] = await Promise.all([
    // Order counts
    db.order.count({ where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } } }),
    db.order.count({ where: completedOrdersWhere }),
    db.order.count({
      where: {
        driverId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: { in: [OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS] },
      },
    }),
    db.order.count({ where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay }, status: OrderStatus.CANCELLED } }),
    db.order.count({ where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay }, status: OrderStatus.RESCHEDULED } }),

    // Financial breakdown by payment method
    db.order.aggregate({
      where: { ...completedOrdersWhere, paymentMethod: PaymentMethod.CASH },
      _sum: { cashCollected: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { ...completedOrdersWhere, paymentMethod: PaymentMethod.ONLINE_TRANSFER },
      _sum: { cashCollected: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { ...completedOrdersWhere, paymentMethod: PaymentMethod.CREDIT },
      _sum: { cashCollected: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { ...completedOrdersWhere, paymentMethod: PaymentMethod.PREPAID_WALLET },
      _sum: { cashCollected: true },
      _count: true,
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

  const cashCollected = parseFloat(cashOrders._sum.cashCollected?.toString() || '0');
  const onlineCollected = parseFloat(onlineOrders._sum.cashCollected?.toString() || '0');
  const creditGiven = parseFloat(creditOrders._sum.cashCollected?.toString() || '0');
  const prepaidUsed = parseFloat(prepaidOrders._sum.cashCollected?.toString() || '0');
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
