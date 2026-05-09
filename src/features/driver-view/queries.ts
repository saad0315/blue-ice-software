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
    // Group order counts by status in a single query
    db.order.groupBy({
      by: ['status'],
      where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } },
      _count: { id: true },
    }),

    // Group financial breakdown by payment method in a single query
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

  let totalOrders = 0;
  let completedOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  let rescheduledOrders = 0;

  for (const group of ordersByStatus) {
    totalOrders += group._count.id;
    if (group.status === OrderStatus.COMPLETED) {
      completedOrders += group._count.id;
    } else if (group.status === OrderStatus.CANCELLED) {
      cancelledOrders += group._count.id;
    } else if (group.status === OrderStatus.RESCHEDULED) {
      rescheduledOrders += group._count.id;
    } else if ([OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS].includes(group.status as any)) {
      pendingOrders += group._count.id;
    }
  }

  let cashCollected = 0;
  let onlineCollected = 0;
  let creditGiven = 0;
  let prepaidUsed = 0;

  let cashOrdersCount = 0;
  let onlineOrdersCount = 0;
  let creditOrdersCount = 0;
  let prepaidOrdersCount = 0;

  for (const p of ordersByPaymentMethod) {
    const cashVal = Number(p._sum.cashCollected || 0);
    const countVal = p._count.id;

    if (p.paymentMethod === PaymentMethod.CASH) {
      cashCollected += cashVal;
      cashOrdersCount += countVal;
    } else if (p.paymentMethod === PaymentMethod.ONLINE_TRANSFER) {
      onlineCollected += cashVal;
      onlineOrdersCount += countVal;
    } else if (p.paymentMethod === PaymentMethod.CREDIT) {
      creditGiven += cashVal;
      creditOrdersCount += countVal;
    } else if (p.paymentMethod === PaymentMethod.PREPAID_WALLET) {
      prepaidUsed += cashVal;
      prepaidOrdersCount += countVal;
    }
  }

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
    cashOrdersCount: cashOrdersCount || 0,
    onlineOrdersCount: onlineOrdersCount || 0,
    creditOrdersCount: creditOrdersCount || 0,
    prepaidOrdersCount: prepaidOrdersCount || 0,

    // Bottles breakdown
    filledGiven,
    emptyTaken,
    damagedReturned,
    bottleBalance: filledGiven - emptyTaken,

    // Meta
    lastUpdated: new Date().toISOString(),
  };
}
