import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';

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

  const [
    // Performance optimization: Consolidate 5 status queries into 1 groupBy, and 4 payment queries into 1 groupBy
    statusGroups,
    paymentGroups,
    expenseData,
    bottleData,
    unlinkedOrdersData,
    unlinkedExpensesData,
  ] = await Promise.all([
    // Group by status for order counts
    db.order.groupBy({
      by: ['status'],
      where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } },
      _count: { _all: true },
    }),

    // Group by payment method for completed orders financial breakdown
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

  // Process status counts in-memory
  let totalOrders = 0;
  let completedOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  let rescheduledOrders = 0;

  statusGroups.forEach((group) => {
    const count = group._count._all;
    totalOrders += count;

    if (group.status === OrderStatus.COMPLETED) {
      completedOrders += count;
    } else if ([OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS].includes(group.status as any)) {
      pendingOrders += count;
    } else if (group.status === OrderStatus.CANCELLED) {
      cancelledOrders += count;
    } else if (group.status === OrderStatus.RESCHEDULED) {
      rescheduledOrders += count;
    }
  });

  // Process payment method breakdown in-memory
  let cashOrdersCount = 0;
  let onlineOrdersCount = 0;
  let creditOrdersCount = 0;
  let prepaidOrdersCount = 0;

  let cashCollectedSum = new Prisma.Decimal(0);
  let onlineCollectedSum = new Prisma.Decimal(0);
  let creditGivenSum = new Prisma.Decimal(0);
  let prepaidUsedSum = new Prisma.Decimal(0);

  paymentGroups.forEach((group) => {
    const count = group._count._all;
    const sum = group._sum?.cashCollected || new Prisma.Decimal(0);

    if (group.paymentMethod === PaymentMethod.CASH) {
      cashOrdersCount += count;
      cashCollectedSum = cashCollectedSum.plus(sum);
    } else if (group.paymentMethod === PaymentMethod.ONLINE_TRANSFER) {
      onlineOrdersCount += count;
      onlineCollectedSum = onlineCollectedSum.plus(sum);
    } else if (group.paymentMethod === PaymentMethod.CREDIT) {
      creditOrdersCount += count;
      creditGivenSum = creditGivenSum.plus(sum);
    } else if (group.paymentMethod === PaymentMethod.PREPAID_WALLET) {
      prepaidOrdersCount += count;
      prepaidUsedSum = prepaidUsedSum.plus(sum);
    }
  });

  const cashCollected = parseFloat(cashCollectedSum.toString());
  const onlineCollected = parseFloat(onlineCollectedSum.toString());
  const creditGiven = parseFloat(creditGivenSum.toString());
  const prepaidUsed = parseFloat(prepaidUsedSum.toString());
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
