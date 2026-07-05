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
    // Group orders by status to get all counts
    db.order.groupBy({
      by: ['status'],
      where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } },
      _count: { _all: true },
    }),

    // Group completed orders by payment method for financial breakdown
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

  // Aggregate in-memory from grouped results
  const totalOrders = statusGroups.reduce((acc, group) => acc + (group._count._all || 0), 0);
  const completedOrders = statusGroups.find((g) => g.status === OrderStatus.COMPLETED)?._count._all || 0;

  const pendingStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS];
  const pendingOrders = statusGroups
    .filter((g) => pendingStatuses.includes(g.status))
    .reduce((acc, group) => acc + (group._count._all || 0), 0);

  const cancelledOrders = statusGroups.find((g) => g.status === OrderStatus.CANCELLED)?._count._all || 0;
  const rescheduledOrders = statusGroups.find((g) => g.status === OrderStatus.RESCHEDULED)?._count._all || 0;

  const cashGroup = paymentGroups.find((g) => g.paymentMethod === PaymentMethod.CASH);
  const onlineGroup = paymentGroups.find((g) => g.paymentMethod === PaymentMethod.ONLINE_TRANSFER);
  const creditGroup = paymentGroups.find((g) => g.paymentMethod === PaymentMethod.CREDIT);
  const prepaidGroup = paymentGroups.find((g) => g.paymentMethod === PaymentMethod.PREPAID_WALLET);

  const cashOrdersCount = cashGroup?._count._all || 0;
  const onlineOrdersCount = onlineGroup?._count._all || 0;
  const creditOrdersCount = creditGroup?._count._all || 0;
  const prepaidOrdersCount = prepaidGroup?._count._all || 0;

  const cashCollected = parseFloat(cashGroup?._sum?.cashCollected?.toString() || '0');
  const onlineCollected = parseFloat(onlineGroup?._sum?.cashCollected?.toString() || '0');
  const creditGiven = parseFloat(creditGroup?._sum?.cashCollected?.toString() || '0');
  const prepaidUsed = parseFloat(prepaidGroup?._sum?.cashCollected?.toString() || '0');

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
