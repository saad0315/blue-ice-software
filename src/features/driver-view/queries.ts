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

  const [ordersByStatus, paymentBreakdown, expenseData, bottleData, unlinkedOrdersData, unlinkedExpensesData] = await Promise.all([
    // Order counts grouped by status
    db.order.groupBy({
      by: ['status'],
      where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } },
      _count: { _all: true },
    }),

    // Financial breakdown grouped by payment method
    db.order.groupBy({
      by: ['paymentMethod'],
      where: completedOrdersWhere,
      _sum: { cashCollected: true },
      _count: { _all: true },
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
  const totalOrders = ordersByStatus.reduce((acc, curr) => acc + curr._count._all, 0);
  const completedOrders = ordersByStatus.find((g) => g.status === OrderStatus.COMPLETED)?._count._all || 0;
  const cancelledOrders = ordersByStatus.find((g) => g.status === OrderStatus.CANCELLED)?._count._all || 0;
  const rescheduledOrders = ordersByStatus.find((g) => g.status === OrderStatus.RESCHEDULED)?._count._all || 0;
  const pendingOrders = ordersByStatus
    .filter((g) => [OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS].includes(g.status as any))
    .reduce((acc, curr) => acc + curr._count._all, 0);

  // Derive payment method stats in-memory
  const cashOrders = paymentBreakdown.find((p) => p.paymentMethod === PaymentMethod.CASH);
  const onlineOrders = paymentBreakdown.find((p) => p.paymentMethod === PaymentMethod.ONLINE_TRANSFER);
  const creditOrders = paymentBreakdown.find((p) => p.paymentMethod === PaymentMethod.CREDIT);
  const prepaidOrders = paymentBreakdown.find((p) => p.paymentMethod === PaymentMethod.PREPAID_WALLET);

  const cashOrdersCount = cashOrders?._count?._all || 0;
  const onlineOrdersCount = onlineOrders?._count?._all || 0;
  const creditOrdersCount = creditOrders?._count?._all || 0;
  const prepaidOrdersCount = prepaidOrders?._count?._all || 0;

  const cashCollected = parseFloat(cashOrders?._sum?.cashCollected?.toString() || '0');
  const onlineCollected = parseFloat(onlineOrders?._sum?.cashCollected?.toString() || '0');
  const creditGiven = parseFloat(creditOrders?._sum?.cashCollected?.toString() || '0');
  const prepaidUsed = parseFloat(prepaidOrders?._sum?.cashCollected?.toString() || '0');

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
    cashOrdersCount,
    onlineOrdersCount,
    creditOrdersCount,
    prepaidOrdersCount,

    // Bottles breakdown
    filledGiven,
    emptyTaken,
    damagedReturned,
    bottleBalance: filledGiven - emptyTaken,

    // Meta
    lastUpdated: new Date().toISOString(),
  };
}
