import { OrderStatus, PaymentMethod } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getComprehensiveDashboardData } from './queries-comprehensive';

const mocks = vi.hoisted(() => {
  return {
    db: {
      dailyStats: { findMany: vi.fn() },
      order: { aggregate: vi.fn(), count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
      customerProfile: { count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
      driverProfile: { count: vi.fn(), findMany: vi.fn() },
      driverPerformanceMetrics: { groupBy: vi.fn() },
      orderItem: { aggregate: vi.fn() },
      product: { findMany: vi.fn() },
      expense: { aggregate: vi.fn() },
      cashHandover: { aggregate: vi.fn() },
      $queryRaw: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mocks.db,
}));

// Mock date-utils to ensure consistent dates
vi.mock('@/lib/date-utils', () => ({
  toUtcStartOfDay: (d: Date) => d,
  toUtcEndOfDay: (d: Date) => d,
}));

describe('getComprehensiveDashboardData Performance', () => {
  const dbMock = mocks.db;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set "Today" to 2023-10-25
    vi.setSystemTime(new Date('2023-10-25T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Live Only (Today): Should perform OPTIMIZED queries', async () => {
    const today = new Date('2023-10-25T00:00:00Z');
    const todayEnd = new Date('2023-10-25T23:59:59Z');

    // Setup mocks
    dbMock.dailyStats.findMany.mockResolvedValue([]);
    // Live Revenue (Should NOT be called for liveRevenue, only prevRevenue)
    dbMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000, cashCollected: 500 } });
    // Live Counts (Should NOT be called for live counts, only prevOrders and cashOrders)
    dbMock.order.count.mockResolvedValue(10);
    // Live Trends
    dbMock.$queryRaw.mockResolvedValue([]);
    // Status Groups (Should NOT be called)

    // Promise.all Mocks
    dbMock.customerProfile.count.mockResolvedValue(5);
    dbMock.driverProfile.count.mockResolvedValue(2);

    // Orders By Status (The Main Breakdown)
    dbMock.order.groupBy.mockResolvedValue([
      { status: OrderStatus.COMPLETED, _count: { id: 8 }, _sum: { totalAmount: 800 } },
      { status: OrderStatus.PENDING, _count: { id: 2 }, _sum: { totalAmount: 200 } },
    ]);

    // Orders By Payment Method
    dbMock.order.groupBy
      .mockResolvedValueOnce([
        // First call for status? No, verify order
        { status: OrderStatus.COMPLETED, _count: { id: 8 }, _sum: { totalAmount: 800 } },
        { status: OrderStatus.PENDING, _count: { id: 2 }, _sum: { totalAmount: 200 } },
      ])
      .mockResolvedValueOnce([
        // Second call for payment method
        { paymentMethod: PaymentMethod.CASH, _count: { id: 8 }, _sum: { cashCollected: 500 } },
      ])
      .mockResolvedValue([]); // Subsequent calls

    dbMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 10, emptyTaken: 8, damagedReturned: 0, quantity: 10 } });
    dbMock.product.findMany.mockResolvedValue([]);
    dbMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    dbMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 } });
    dbMock.customerProfile.groupBy.mockResolvedValue([]);
    dbMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
    dbMock.customerProfile.findMany.mockResolvedValue([]);
    dbMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    dbMock.order.findMany.mockResolvedValue([]);

    const result = await getComprehensiveDashboardData({ startDate: today, endDate: todayEnd });

    // --- VERIFICATION OF OPTIMIZED STATE ---

    // 1. db.order.aggregate should be called ONLY ONCE (for Prev Revenue).
    //    - Live Revenue is derived.
    //    - Cash Stats is derived.
    const aggregateCalls = dbMock.order.aggregate.mock.calls;
    expect(aggregateCalls.length).toBe(1);

    // 2. db.order.count should be called TWICE (Prev Orders, Cash Orders).
    //    - Live Completed derived.
    //    - Live Volume derived.
    const countCalls = dbMock.order.count.mock.calls;
    expect(countCalls.length).toBe(2);

    // 3. db.order.groupBy should be called 4 times.
    //    - Orders By Status
    //    - Orders By Payment Method
    //    - Driver Performance
    //    - Top Customers
    //    (Removed: Live Breakdown statusGroups)
    const groupByCalls = dbMock.order.groupBy.mock.calls;
    expect(groupByCalls.length).toBe(4);

    // 4. Verify derived data correctness
    // Realized Revenue = 800 (from ordersByStatus mock)
    expect(result.overview.realizedRevenue).toBe(800);
    // Total Volume = 8 + 2 = 10
    expect(result.overview.totalOrders).toBe(10);
    // Completed Orders = 8
    expect(result.overview.completedOrders).toBe(8);
  });

  it('Historical + Live: Should fetch dailyStats ONLY ONCE', async () => {
    // Range: Yesterday to Today
    const start = new Date('2023-10-24T00:00:00Z');
    const end = new Date('2023-10-25T00:00:00Z');

    // Setup mocks
    dbMock.dailyStats.findMany.mockResolvedValue([
      { date: start, ordersCompleted: 5, ordersCancelled: 1, ordersPending: 0, ordersRescheduled: 0, totalRevenue: 500 },
    ]);

    // Other mocks (standard)
    dbMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } });
    dbMock.order.count.mockResolvedValue(0);
    dbMock.$queryRaw.mockResolvedValue([]);
    dbMock.order.groupBy.mockResolvedValue([]);
    dbMock.customerProfile.count.mockResolvedValue(0);
    dbMock.driverProfile.count.mockResolvedValue(0);
    dbMock.orderItem.aggregate.mockResolvedValue({ _sum: {} });
    dbMock.product.findMany.mockResolvedValue([]);
    dbMock.expense.aggregate.mockResolvedValue({ _sum: {} });
    dbMock.cashHandover.aggregate.mockResolvedValue({ _sum: {} });
    dbMock.customerProfile.aggregate.mockResolvedValue({ _sum: {} });
    dbMock.customerProfile.groupBy.mockResolvedValue([]); // Add missing mock
    dbMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    dbMock.order.findMany.mockResolvedValue([]);
    dbMock.customerProfile.findMany.mockResolvedValue([]);

    await getComprehensiveDashboardData({ startDate: start, endDate: end });

    // --- VERIFICATION OF OPTIMIZED STATE ---

    // db.dailyStats.findMany is called ONCE (reused for trends)
    expect(dbMock.dailyStats.findMany).toHaveBeenCalledTimes(1);
  });
});
