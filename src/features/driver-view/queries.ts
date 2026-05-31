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

  const [ordersGrouped, expenseData, bottleData, unlinkedOrdersData, unlinkedExpensesData] = await Promise.all([
    // Group orders by status and payment method to derive counts and financial breakdown
    db.order.groupBy({
      by: ['status', 'paymentMethod'],
      where: {
        driverId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
      },
      _count: {
        id: true,
      },
      _sum: {
        cashCollected: true,
      },
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

  let cashOrdersCount = 0;
  let onlineOrdersCount = 0;
  let creditOrdersCount = 0;
  let prepaidOrdersCount = 0;

  let cashCollectedRaw = new Prisma.Decimal(0);
  let onlineCollectedRaw = new Prisma.Decimal(0);
  let creditGivenRaw = new Prisma.Decimal(0);
  let prepaidUsedRaw = new Prisma.Decimal(0);

  ordersGrouped.forEach((group) => {
    const count = group._count.id;
    totalOrders += count;

    if (group.status === OrderStatus.COMPLETED) {
      completedOrders += count;
      const sum = group._sum.cashCollected || new Prisma.Decimal(0);

      if (group.paymentMethod === PaymentMethod.CASH) {
        cashOrdersCount += count;
        cashCollectedRaw = cashCollectedRaw.plus(sum);
      } else if (group.paymentMethod === PaymentMethod.ONLINE_TRANSFER) {
        onlineOrdersCount += count;
        onlineCollectedRaw = onlineCollectedRaw.plus(sum);
      } else if (group.paymentMethod === PaymentMethod.CREDIT) {
        creditOrdersCount += count;
        creditGivenRaw = creditGivenRaw.plus(sum);
      } else if (group.paymentMethod === PaymentMethod.PREPAID_WALLET) {
        prepaidOrdersCount += count;
        prepaidUsedRaw = prepaidUsedRaw.plus(sum);
      }
    } else if ([OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS].includes(group.status as any)) {
      pendingOrders += count;
    } else if (group.status === OrderStatus.CANCELLED) {
      cancelledOrders += count;
    } else if (group.status === OrderStatus.RESCHEDULED) {
      rescheduledOrders += count;
    }
  });

  const cashCollected = parseFloat(cashCollectedRaw.toString());
  const onlineCollected = parseFloat(onlineCollectedRaw.toString());
  const creditGiven = parseFloat(creditGivenRaw.toString());
  const prepaidUsed = parseFloat(prepaidUsedRaw.toString());
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
