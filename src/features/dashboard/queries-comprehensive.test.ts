import { OrderStatus, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: mockDeep<PrismaClient>(),
}));

describe('getComprehensiveDashboardData', () => {
  const mockDb = db as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

  beforeEach(() => {
    mockReset(mockDb);
  });

  it('calculates total revenue and orders correctly using optimized queries', async () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2030-01-31T23:59:59Z'); // Future date to trigger Hybrid mode

    // 1. Mock DailyStats (Historical)
    mockDb.dailyStats.findMany.mockResolvedValue([
      {
        date: new Date('2023-01-01'),
        totalRevenue: new window.Decimal(1000),
        ordersCompleted: 10,
        ordersCancelled: 0,
        ordersPending: 0,
        ordersRescheduled: 0,
      } as any,
    ]);

    // 2. Live Revenue (Aggregate) - REMOVED

    // 3. Live Completed Orders (Count) - REMOVED

    // 4. Live Total Volume (Count) - REMOVED

    // 5. Live Trends (Raw) - Kept
    mockDb.$queryRaw.mockResolvedValueOnce([]);

    // 6. Live Order Breakdown (GroupBy) - REMOVED

    // --- PROMISE.ALL START ---

    // 7. Customer Count
    mockDb.customerProfile.count.mockResolvedValueOnce(100);

    // 8. Driver Count
    mockDb.driverProfile.count.mockResolvedValueOnce(10);

    // 9. Prev Revenue (Aggregate)
    mockDb.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: new window.Decimal(0) } } as any);

    // 10. Prev Orders (Count)
    mockDb.order.count.mockResolvedValueOnce(0);

    // 11. Orders By Status (GroupBy) - KEY MOCK
    const ordersByStatusMock = [
      {
        status: OrderStatus.COMPLETED,
        _count: { id: 15 },
        _sum: { totalAmount: new window.Decimal(1500) },
      },
      {
        status: OrderStatus.PENDING,
        _count: { id: 5 },
        _sum: { totalAmount: new window.Decimal(200) },
      },
    ];
    mockDb.order.groupBy.mockResolvedValueOnce(ordersByStatusMock as any);

    // 12. Orders By Payment (GroupBy)
    mockDb.order.groupBy.mockResolvedValueOnce([] as any);

    // 13. Cash Stats (Aggregate)
    mockDb.order.aggregate.mockResolvedValueOnce({ _sum: { cashCollected: new window.Decimal(0) } } as any);

    // 14. Cash Orders Count (Count)
    mockDb.order.count.mockResolvedValueOnce(0);

    // 15. Pending Handovers (Raw)
    mockDb.$queryRaw.mockResolvedValueOnce([{ count: 0n, amount: 0 }]);

    // 16. Verified Handovers (Aggregate - CashHandover)
    mockDb.cashHandover.aggregate.mockResolvedValueOnce({ _sum: {}, _count: {} } as any);

    // 17. Driver Perf Live (GroupBy)
    mockDb.order.groupBy.mockResolvedValueOnce([] as any);

    // 18. Driver Perf Hist (GroupBy - DriverPerfMetrics)
    mockDb.driverPerformanceMetrics.groupBy.mockResolvedValueOnce([] as any);

    // 19. Bottle Stats (Aggregate - OrderItem)
    mockDb.orderItem.aggregate.mockResolvedValueOnce({ _sum: {} } as any);

    // 20. Product Inventory (FindMany)
    mockDb.product.findMany.mockResolvedValueOnce([]);

    // 21. New Customers (Count)
    mockDb.customerProfile.count.mockResolvedValueOnce(0);

    // 22. Customers By Type (GroupBy)
    mockDb.customerProfile.groupBy.mockResolvedValueOnce([]);

    // 23. Top Customers (GroupBy)
    mockDb.order.groupBy.mockResolvedValueOnce([]);

    // 24. Route Performance (Raw)
    mockDb.$queryRaw.mockResolvedValueOnce([]);

    // 25. Total Expenses (Aggregate)
    mockDb.expense.aggregate.mockResolvedValueOnce({ _sum: { amount: new window.Decimal(50) } } as any);

    // 26. Total Receivables (Aggregate - CustomerProfile)
    mockDb.customerProfile.aggregate.mockResolvedValueOnce({ _sum: { cashBalance: new window.Decimal(-100) } } as any);

    // 27. Failed Orders (FindMany)
    mockDb.order.findMany.mockResolvedValueOnce([]);

    // 28. Low Stock (FindMany - Product)
    mockDb.product.findMany.mockResolvedValueOnce([]);

    // 29. High Credit (FindMany - CustomerProfile)
    mockDb.customerProfile.findMany.mockResolvedValueOnce([]);

    // --- PROMISE.ALL END ---

    // 30. DailyStats again - REMOVED

    // 31. Live Order Trend Raw (Raw)
    mockDb.$queryRaw.mockResolvedValueOnce([]);

    // 32. Driver details (FindMany)
    mockDb.driverProfile.findMany.mockResolvedValueOnce([]);

    // 33. Customer details (FindMany)
    mockDb.customerProfile.findMany.mockResolvedValueOnce([]);

    // Run the function
    const result = await getComprehensiveDashboardData({ startDate, endDate });

    // Assertions
    // Realized Revenue = 1500 (derived from ordersByStatus)
    expect(result.overview.realizedRevenue).toBe(1500);

    // Completed Orders = 15 (derived from ordersByStatus)
    expect(result.overview.completedOrders).toBe(15);

    // Total Orders = 15 + 5 = 20 (derived from ordersByStatus)
    expect(result.overview.totalOrders).toBe(20);
  });
});

if (typeof window === 'undefined') {
  (global as any).window = {};
}
(window as any).Decimal = class Decimal {
  constructor(private val: number) {}
  toString() {
    return this.val.toString();
  }
  toNumber() {
    return this.val;
  }
};
