import { OrderStatus, PaymentMethod, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockProxy, mockDeep, mockReset } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the DB
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep<PrismaClient>(),
  };
});

const prismaMock = db as unknown as MockProxy<PrismaClient>;

// Mock Date utils if needed, but for now relying on system time mock
vi.useFakeTimers();
vi.setSystemTime(new Date('2023-10-25T12:00:00Z'));

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should correctly calculate lowStockProducts and cashStats', async () => {
    const startDate = new Date('2023-10-01');
    const endDate = new Date('2023-10-31');

    // 1. Historical Stats (DailyStats) - called because !isLiveOnly
    prismaMock.dailyStats.findMany.mockResolvedValueOnce([]);

    // 2. Live Stats (executed because !isHistoricalOnly)
    // Live Revenue
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 1000 } } as any);
    // Live Completed Orders
    prismaMock.order.count.mockResolvedValueOnce(20);
    // Live Total Volume
    prismaMock.order.count.mockResolvedValueOnce(30);
    // Live Revenue Trend Raw
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    // Live Status Breakdown
    prismaMock.order.groupBy.mockResolvedValueOnce([]);

    // 3. Promise.all queries

    // 0: totalCustomers
    prismaMock.customerProfile.count.mockResolvedValueOnce(100);
    // 1: totalDrivers
    prismaMock.driverProfile.count.mockResolvedValueOnce(20);

    // 2: prevRevenue
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 5000 } } as any);

    // 3: prevOrders
    prismaMock.order.count.mockResolvedValueOnce(50);

    // 4: ordersByStatus
    prismaMock.order.groupBy.mockResolvedValueOnce([
      { status: OrderStatus.COMPLETED, _count: { id: 10 }, _sum: { totalAmount: 2000 } },
      { status: OrderStatus.PENDING, _count: { id: 5 }, _sum: { totalAmount: 1000 } },
    ] as any);

    // 5: ordersByPaymentMethod
    prismaMock.order.groupBy.mockResolvedValueOnce([
      { paymentMethod: PaymentMethod.CASH, _count: { id: 5 }, _sum: { cashCollected: 1000 } },
      { paymentMethod: PaymentMethod.ONLINE_TRANSFER, _count: { id: 5 }, _sum: { cashCollected: 1000 } },
    ] as any);

    // REMOVED cashStats (was 6)

    // 6: cashOrdersCount
    prismaMock.order.count.mockResolvedValueOnce(5);

    // 7: pendingHandovers (Raw)
    prismaMock.$queryRaw.mockResolvedValueOnce([{ count: 2, amount: 500 }]);

    // 8: verifiedHandovers
    prismaMock.cashHandover.aggregate.mockResolvedValueOnce({ _sum: { actualCash: 1500 }, _count: { id: 3 } } as any);

    // 9: liveDriverPerformance
    prismaMock.order.groupBy.mockResolvedValueOnce([]);

    // 10: historicalDriverMetrics (skipped if live only, but let's assume mixed or handled)
    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValueOnce([]);

    // 11: bottleStats
    prismaMock.orderItem.aggregate.mockResolvedValueOnce({
      _sum: { filledGiven: 100, emptyTaken: 90, damagedReturned: 2, quantity: 100 },
    } as any);

    // 12: productInventory
    prismaMock.product.findMany.mockResolvedValueOnce([
      { id: 'p1', name: 'Product 1', stockFilled: 10, stockEmpty: 50, basePrice: 100 }, // Low stock < 20
      { id: 'p2', name: 'Product 2', stockFilled: 50, stockEmpty: 10, basePrice: 200 },
      { id: 'p3', name: 'Product 3', stockFilled: 15, stockEmpty: 5, basePrice: 50 }, // Low stock < 20
    ] as any);

    // 13: newCustomers
    prismaMock.customerProfile.count.mockResolvedValueOnce(10);

    // 14: customersByType
    prismaMock.customerProfile.groupBy.mockResolvedValueOnce([
      { type: 'RESIDENTIAL', _count: { id: 80 } },
      { type: 'COMMERCIAL', _count: { id: 20 } },
    ] as any);

    // 15: topCustomers
    prismaMock.order.groupBy.mockResolvedValueOnce([]);

    // 16: routePerformance (Raw)
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    // 17: totalExpenses
    prismaMock.expense.aggregate.mockResolvedValueOnce({ _sum: { amount: 500 } } as any);

    // 18: totalReceivables
    prismaMock.customerProfile.aggregate.mockResolvedValueOnce({ _sum: { cashBalance: 200 } } as any);

    // 19: failedOrders
    prismaMock.order.findMany.mockResolvedValueOnce([]);

    // REMOVED lowStockProducts (was 21)

    // 20: highCreditCustomers
    prismaMock.customerProfile.findMany.mockResolvedValueOnce([]);

    // 4. Post-Promise.all queries

    // Combine Trends (Historical again)
    prismaMock.dailyStats.findMany.mockResolvedValueOnce([]);

    // Live Trends Raw (liveOrderTrendRaw)
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    // Drivers for performance
    prismaMock.driverProfile.findMany.mockResolvedValueOnce([]);

    // Customers for top list
    prismaMock.customerProfile.findMany.mockResolvedValueOnce([]);

    // Execute
    const result = await getComprehensiveDashboardData({ startDate, endDate });

    // Assertions
    expect(result.alerts.lowStockProducts).toHaveLength(2);
    expect(result.alerts.lowStockProducts.map((p) => p.id).sort()).toEqual(['p1', 'p3']);

    // Check Cash Stats
    // sum of 1000 (CASH) + 1000 (ONLINE) = 2000
    expect(result.cashManagement.totalCashCollected).toBe(2000);

    // Verify DB Calls count
    // product.findMany called once (only for productInventory)
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);

    // order.aggregate called 2 times: prevRevenue, liveRevenue.
    // cashStats call is removed.
    expect(prismaMock.order.aggregate).toHaveBeenCalledTimes(2);
  });
});
