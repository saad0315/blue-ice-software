import { OrderStatus } from '@prisma/client';

import { db } from '@/lib/db';

export async function getDriverStats(driverId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const [totalOrders, completedOrders, pendingOrders, cancelledOrders, rescheduledOrders, revenueData, expenseData] = await Promise.all([
    db.order.count({ where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay } } }),
    db.order.count({ where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay }, status: OrderStatus.COMPLETED } }),
    db.order.count({
      where: {
        driverId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: { in: [OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS] },
      },
    }),
    db.order.count({ where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay }, status: OrderStatus.CANCELLED } }),
    db.order.count({ where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay }, status: OrderStatus.RESCHEDULED } }),
    db.order.aggregate({
      where: { driverId, scheduledDate: { gte: startOfDay, lte: endOfDay }, status: OrderStatus.COMPLETED },
      _sum: { cashCollected: true },
    }),
    db.expense.aggregate({
      where: {
        driverId,
        date: { gte: startOfDay, lte: endOfDay },
        paymentMethod: 'CASH_ON_HAND',
        status: { not: 'REJECTED' },
      },
      _sum: { amount: true },
    }),
  ]);

  const grossCash = parseFloat(revenueData._sum.cashCollected?.toString() || '0');
  const expenses = parseFloat(expenseData._sum.amount?.toString() || '0');

  return {
    totalOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    rescheduledOrders,
    cashCollected: (grossCash - expenses).toFixed(2),
  };
}
