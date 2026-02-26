import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock DB
const prismaMockContainer = vi.hoisted(() => ({
  prisma: {
    customerProfile: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    driverProfile: { count: vi.fn(), findMany: vi.fn() },
    order: { aggregate: vi.fn(), count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    cashHandover: { aggregate: vi.fn() },
    driverPerformanceMetrics: { groupBy: vi.fn() },
    orderItem: { aggregate: vi.fn() },
    product: { findMany: vi.fn() },
    expense: { aggregate: vi.fn() },
    dailyStats: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: prismaMockContainer.prisma,
}));

describe('getComprehensiveDashboardData', () => {
  let prismaMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = prismaMockContainer.prisma;

    // Default mock implementations to prevent crashes
    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 0, cashCollected: 0 } });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.groupBy.mockResolvedValue([]); // Default for all groupBys
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } });

    // Product mock - crucial for our test
    prismaMock.product.findMany.mockResolvedValue([]);

    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.customerProfile.findMany.mockResolvedValue([]);
    prismaMock.dailyStats.findMany.mockResolvedValue([]);
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);
  });

  it('should call db.product.findMany once (only for inventory, not for low stock)', async () => {
    await getComprehensiveDashboardData();
    // Optimization: findMany for products should be called ONCE now.
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);
  });

  it('should call db.order.aggregate fewer times (removed redundant cash stats)', async () => {
    await getComprehensiveDashboardData();
    // We expect 1 fewer call than before.
    // 1. Live Revenue (if not historical only)
    // 2. Previous Period Revenue
    // REMOVED: 3. Cash Management Stats
    // So if it was >=3 before, now it should be consistent with that reduction.
    // Let's just check the exact expected calls based on default params (live + historical):
    // 1. Live Revenue
    // 2. Prev Revenue
    // 3. Verified Cash Handovers
    // 4. Bottle Stats
    // 5. Total Expenses
    // 6. Total Receivables

    // Wait, let's look at the code again.
    // db.order.aggregate is called for:
    // 1. Live Revenue (line 74)
    // 2. Prev Revenue (line 218)
    // 3. Cash Stats (REMOVED)
    // There are other aggregates on other tables, but specifically `db.order.aggregate`:

    // Before:
    // 1. Live Revenue
    // 2. Prev Revenue
    // 3. Cash Stats

    // Now:
    // 1. Live Revenue
    // 2. Prev Revenue

    // So expecting 2 calls to db.order.aggregate
    expect(prismaMock.order.aggregate).toHaveBeenCalledTimes(2);
  });

  it('should correctly calculate derived stats', async () => {
      // Setup specific mock data
      prismaMock.order.groupBy.mockImplementation((args: any) => {
          if (args.by.includes('paymentMethod')) {
              return Promise.resolve([
                  { paymentMethod: 'CASH', _sum: { cashCollected: 100 }, _count: { id: 1 } },
                  { paymentMethod: 'ONLINE', _sum: { cashCollected: 50 }, _count: { id: 1 } }
              ]);
          }
          if (args.by.includes('status')) {
             return Promise.resolve([]);
          }
          return Promise.resolve([]);
      });

      prismaMock.product.findMany.mockResolvedValue([
          { id: '1', name: 'Low Stock Item', stockFilled: 5, stockEmpty: 0, basePrice: 10 },
          { id: '2', name: 'High Stock Item', stockFilled: 50, stockEmpty: 0, basePrice: 10 }
      ]);

      const result = await getComprehensiveDashboardData();

      // Verify Cash Stats
      expect(result.cashManagement.totalCashCollected).toBe(150); // 100 + 50

      // Verify Low Stock Products
      expect(result.alerts.lowStockProducts).toHaveLength(1);
      expect(result.alerts.lowStockProducts[0].name).toBe('Low Stock Item');
  });
});
