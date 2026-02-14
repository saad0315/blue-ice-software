import { OrderStatus, PaymentMethod, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock DB
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep(),
  };
});

describe('getComprehensiveDashboardData', () => {
  const prismaMock = db as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

  beforeEach(() => {
    mockReset(prismaMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch dashboard data correctly', async () => {
    // Setup System Time to match test data (so it counts as Live)
    vi.setSystemTime(new Date('2023-10-25T12:00:00Z'));

    // Setup Mock Data
    const startDate = new Date('2023-10-25T00:00:00Z');
    const endDate = new Date('2023-10-25T23:59:59Z');

    // 1. Historical Stats (Empty for now to focus on live logic)
    prismaMock.dailyStats.findMany.mockResolvedValue([]);

    // 2. Live Revenue
    prismaMock.order.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: new Decimal(1000) } } as any) // Live Revenue
      .mockResolvedValueOnce({ _sum: { totalAmount: new Decimal(800) } } as any) // Prev Revenue
      .mockResolvedValueOnce({ _sum: { cashCollected: new Decimal(1000) } } as any) // Cash Stats (Redundant?)
      .mockResolvedValueOnce({ _sum: { filledGiven: 50, emptyTaken: 40, damagedReturned: 2, quantity: 50 } } as any) // Bottle Stats
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(200) } } as any) // Expenses
      .mockResolvedValueOnce({ _sum: { cashBalance: new Decimal(-500) } } as any); // Receivables

    // 2. Live Completed Orders Count
    prismaMock.order.count
      .mockResolvedValueOnce(10) // Live Completed Orders
      .mockResolvedValueOnce(20) // Live Total Volume
      .mockResolvedValueOnce(15) // Prev Orders
      .mockResolvedValueOnce(8) // Cash Orders Count (Redundant?)
      .mockResolvedValueOnce(2); // New Customers (CustomerProfile count actually)

    // Note: The order of count calls depends on Promise.all order in the implementation.
    // Let's refine based on the implementation structure.

    // Implementation calls:
    // 1. Historical dailyStats.findMany
    // 2. Live Revenue (order.aggregate)
    // 3. Live Completed Orders (order.count)
    // 4. Live Total Volume (order.count)
    // 5. Live Trend Raw ($queryRaw)
    // 6. Live Status Breakdown (order.groupBy)
    // 7. Promise.all([...])

    // Inside Promise.all:
    // - customerProfile.count (Total Cust)
    // - driverProfile.count (Total Drivers)
    // - order.aggregate (Prev Revenue)
    // - order.count (Prev Orders)
    // - order.groupBy (By Status)
    // - order.groupBy (By Payment Method)
    // - order.aggregate (Cash Stats) <--- TARGET for removal
    // - order.count (Cash Orders Count)
    // - $queryRaw (Pending Handovers)
    // - cashHandover.aggregate (Verified)
    // - order.groupBy (Driver Live)
    // - driverPerformanceMetrics.groupBy (Driver Hist)
    // - orderItem.aggregate (Bottle Stats)
    // - product.findMany (Inventory)
    // - customerProfile.count (New Customers)
    // - customerProfile.groupBy (Cust Type)
    // - order.groupBy (Top Cust)
    // - $queryRaw (Route Perf)
    // - expense.aggregate (Total Exp)
    // - customerProfile.aggregate (Receivables)
    // - order.findMany (Failed Orders)
    // - product.findMany (Low Stock) <--- TARGET for removal
    // - customerProfile.findMany (High Credit)

    // Let's rely on specific mock implementations or matcher based mocks if order is flaky.
    // Since Promise.all runs concurrently, the order of execution is not guaranteed, but usually predictable in mock invocation if we return promises.
    // However, `vitest-mock-extended` `mockResolvedValue` stacks up.

    // To be safe, I will use `mockResolvedValue` for generic calls but I should match `where` clauses if I want to be precise.
    // But for now, simple stacking might work if I list them in order of appearance in code (which usually matches Promise.all order unless one takes longer).
    // Actually Promise.all starts all of them. The order they resolve doesn't matter, but the order we mock them matters if we use `.mockResolvedValueOnce`.
    // It's better to verify call arguments.

    // Let's set up mocks more robustly if possible, or just assume the order for now and debug if it fails.

    // Global mocks
    prismaMock.customerProfile.count.mockResolvedValue(50); // Default
    prismaMock.driverProfile.count.mockResolvedValue(5);

    // Specific Mocks

    // Live Revenue
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: new Decimal(0) } } as any); // Default

    // We need to differentiate the calls.
    // 1. Live Revenue (status=COMPLETED, range=Live)
    // 2. Prev Revenue (status=COMPLETED, range=Prev)
    // 3. Cash Stats (status=COMPLETED, range=Current)
    // 4. Bottle Stats (range=Current)
    // 5. Expenses (range=Current)
    // 6. Receivables (cashBalance < 0)

    // Use `mockImplementation` to inspect arguments?
    // Or just use `mockResolvedValueOnce` carefully.

    // The code structure:
    // await db.dailyStats.findMany(...)
    // await db.order.aggregate(...) // Live Revenue
    // await db.order.count(...) // Live Completed
    // await db.order.count(...) // Live Total
    // await db.$queryRaw(...) // Live Trend
    // await db.order.groupBy(...) // Status Breakdown
    // await Promise.all([ ... ])

    // Inside Promise.all, the order of elements in the array determines the order of `await`.
    // But they are all fired.

    // Let's populate the mocks in the order they appear in `Promise.all` array + the ones before it.

    // Before Promise.all:
    prismaMock.dailyStats.findMany.mockResolvedValue([]);

    // Live Trend Raw (Now called first in Live block)
    prismaMock.$queryRaw.mockResolvedValueOnce([{ date: startDate, revenue: 1000, orders: 10 }] as any);

    // Mock groupBy to be robust against call order
    prismaMock.order.groupBy.mockImplementation(async (args: any) => {
      if (args.by.includes('status')) {
        // Check if it requests totalAmount sum (Full Breakdown) or just count (Live Status)
        if (args._sum?.totalAmount) {
          return [
            { status: OrderStatus.COMPLETED, _count: { id: 10 }, _sum: { totalAmount: new Decimal(1000) } },
            { status: OrderStatus.PENDING, _count: { id: 10 }, _sum: { totalAmount: new Decimal(0) } },
          ] as any;
        } else {
          // Live Status Breakdown
          return [
            { status: OrderStatus.COMPLETED, _count: { id: 10 } },
            { status: OrderStatus.PENDING, _count: { id: 10 } },
          ] as any;
        }
      }
      if (args.by.includes('paymentMethod')) {
        return [
          { paymentMethod: PaymentMethod.CASH, _count: { id: 8 }, _sum: { cashCollected: new Decimal(800) } },
          { paymentMethod: PaymentMethod.ONLINE_TRANSFER, _count: { id: 2 }, _sum: { cashCollected: new Decimal(200) } },
        ] as any;
      }
      if (args.by.includes('driverId')) {
        return [];
      }
      if (args.by.includes('customerId')) {
        return [{ customerId: 'c1', _sum: { totalAmount: new Decimal(500) }, _count: { id: 5 } }] as any;
      }
      return [];
    });

    // Promise.all array:

    // 1. Total Customers
    prismaMock.customerProfile.count.mockResolvedValueOnce(50);

    // 2. Total Drivers
    prismaMock.driverProfile.count.mockResolvedValueOnce(5);

    // 3. Prev Revenue
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: new Decimal(800) } } as any);

    // 4. Prev Orders
    prismaMock.order.count.mockResolvedValueOnce(15);

    // 5. Orders by Status (Handled by mockImplementation)

    // 6. Orders by Payment Method (Handled by mockImplementation)

    // 7. Cash Stats (REDUNDANT) - REMOVED

    // 8. Cash Orders Count
    prismaMock.order.count.mockResolvedValueOnce(8);

    // 9. Pending Handovers ($queryRaw)
    prismaMock.$queryRaw.mockResolvedValueOnce([{ count: 2n, amount: new Decimal(500) }] as any);

    // 10. Verified Cash Handovers
    prismaMock.cashHandover.aggregate.mockResolvedValueOnce({ _sum: { actualCash: new Decimal(2000) }, _count: { id: 4 } } as any);

    // 11. Driver Performance (Live) (Handled by mockImplementation)

    // 12. Driver Performance (Historical) - skipped if live only? Code checks `!isLiveOnly`.
    // Default params use `toUtcStartOfDay(new Date())` for start and end.
    // `isLiveOnly` = `startDate >= today`. If start=today, it is live only.
    // So historical part is skipped.

    // 13. Bottle Stats
    prismaMock.orderItem.aggregate.mockResolvedValueOnce({
      _sum: { filledGiven: 50, emptyTaken: 40, damagedReturned: 2, quantity: 50 },
    } as any);

    // 14. Product Inventory
    const products = [
      { id: 'p1', name: 'Water', stockFilled: 100, stockEmpty: 10, basePrice: new Decimal(20) },
      { id: 'p2', name: 'LowStock', stockFilled: 10, stockEmpty: 5, basePrice: new Decimal(30) },
    ];
    prismaMock.product.findMany.mockResolvedValueOnce(products as any);

    // 15. New Customers
    prismaMock.customerProfile.count.mockResolvedValueOnce(2);

    // 16. Customers by Type
    prismaMock.customerProfile.groupBy.mockResolvedValueOnce([{ type: 'RESIDENTIAL', _count: { id: 40 } }] as any);

    // 17. Top Customers (Handled by mockImplementation)

    // 18. Route Performance ($queryRaw)
    prismaMock.$queryRaw.mockResolvedValueOnce([{ routeName: 'Route A', count: 10n, revenue: new Decimal(1000) }] as any);

    // 19. Total Expenses
    prismaMock.expense.aggregate.mockResolvedValueOnce({ _sum: { amount: new Decimal(200) } } as any);

    // 20. Total Receivables
    prismaMock.customerProfile.aggregate.mockResolvedValueOnce({ _sum: { cashBalance: new Decimal(-500) } } as any);

    // 21. Failed Orders
    prismaMock.order.findMany.mockResolvedValueOnce([]);

    // 22. Low Stock Products (REDUNDANT) - REMOVED

    // 23. High Credit Customers
    prismaMock.customerProfile.findMany.mockResolvedValueOnce([]);

    // Combined Trends
    // 24. DailyStats (Historical trends) - skipped if live only

    // 25. Live Order Trend Raw ($queryRaw)
    prismaMock.$queryRaw.mockResolvedValueOnce([{ date: startDate, status: OrderStatus.COMPLETED, count: 10n }] as any);

    // 26. Drivers Details
    prismaMock.driverProfile.findMany.mockResolvedValueOnce([]);

    // 27. Customer Details
    prismaMock.customerProfile.findMany.mockResolvedValueOnce([{ id: 'c1', user: { name: 'Customer 1' } }] as any);

    // Call function
    const result = await getComprehensiveDashboardData({ startDate, endDate });

    // Assertions
    expect(result.overview.totalRevenue).toBe(1000); // Live revenue
    expect(result.overview.completedOrders).toBe(10); // Live completed
    expect(result.overview.totalOrders).toBe(20); // Live total

    expect(result.cashManagement.totalCashCollected).toBe(1000); // Cash stats
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].name).toBe('LowStock');

    // Verify Optimizations

    // 1. order.aggregate: Should be called only once (for Prev Revenue).
    // Removed: Live Revenue, Cash Stats.
    expect(prismaMock.order.aggregate).toHaveBeenCalledTimes(1);

    // 2. order.count: Should be called twice (Prev Orders, Cash Orders).
    // Removed: Live Completed, Live Total.
    expect(prismaMock.order.count).toHaveBeenCalledTimes(2);

    // 3. product.findMany: Should be called once (Inventory).
    // Removed: Low Stock Products.
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);
  });
});
