import { OrderStatus, PaymentMethod, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 3. Import SUT
import { getComprehensiveDashboardData } from './queries-comprehensive';

// 1. Create a container for the mock
const prismaMockContainer = vi.hoisted(() => {
  return {
    prisma: {
      customerProfile: { count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      driverProfile: { count: vi.fn(), findMany: vi.fn() },
      order: { count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
      cashHandover: { aggregate: vi.fn() },
      driverPerformanceMetrics: { groupBy: vi.fn() },
      orderItem: { aggregate: vi.fn() },
      product: { findMany: vi.fn() },
      expense: { aggregate: vi.fn() },
      dailyStats: { findMany: vi.fn() },
      $queryRaw: vi.fn(),
    },
  };
});

// 2. Mock the module
vi.mock('@/lib/db', () => ({
  db: prismaMockContainer.prisma,
}));

describe('getComprehensiveDashboardData Optimization', () => {
  let prismaMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = prismaMockContainer.prisma;
  });

  it('should use optimized queries and derive stats correctly', async () => {
    // --- Mock Setup ---

    // 1. Live Stats Block (Pre-Promise.all)
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000 } }); // Live Revenue
    prismaMock.order.count.mockResolvedValue(10); // Live Completed
    prismaMock.order.count.mockResolvedValue(15); // Live Total Volume
    prismaMock.$queryRaw.mockResolvedValue([]); // Live Trends
    prismaMock.order.groupBy.mockResolvedValue([]); // Live Breakdown

    // 2. Promise.all Block (Mocking returns to allow function to proceed)

    // prevStats (Replaces prevRevenue/prevOrders)
    // We set up a specific return for the groupBy call corresponding to prevStats
    // But since we can't easily target specific calls in mockResolvedValue sequence without being very precise about order,
    // we'll make a generic mock that returns based on args, or just returns a superset.

    prismaMock.order.groupBy.mockImplementation((args: any) => {
      // prevStats
      if (args.where?.scheduledDate?.gte && args.by?.includes('status')) {
        return Promise.resolve([
          { status: OrderStatus.COMPLETED, _count: { id: 50 }, _sum: { totalAmount: 5000 } },
          { status: OrderStatus.PENDING, _count: { id: 10 }, _sum: { totalAmount: 0 } },
        ]);
      }
      // ordersByPaymentMethod
      if (args.by?.includes('paymentMethod')) {
        return Promise.resolve([
          { paymentMethod: PaymentMethod.CASH, _count: { id: 5 }, _sum: { cashCollected: 500 } },
          { paymentMethod: PaymentMethod.ONLINE_TRANSFER, _count: { id: 5 }, _sum: { cashCollected: 500 } },
        ]);
      }
      return Promise.resolve([]);
    });

    // productInventory
    prismaMock.product.findMany.mockImplementation((args: any) => {
      // If selecting basePrice, it's the inventory query
      if (args?.select?.basePrice) {
        return Promise.resolve([
          { id: 'p1', name: 'Low Stock', stockFilled: 5, stockEmpty: 0, basePrice: 100 },
          { id: 'p2', name: 'High Stock', stockFilled: 50, stockEmpty: 0, basePrice: 100 },
        ]);
      }
      // If specifically filtering for low stock (OLD QUERY), return empty to show it wasn't called?
      // Actually checking .calls is better.
      return Promise.resolve([]);
    });

    // Defaults for others
    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: {}, _count: {} });
    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: {} });
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: {} });
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: {} });
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.customerProfile.findMany.mockResolvedValue([]);
    prismaMock.dailyStats.findMany.mockResolvedValue([]);

    // --- Execution ---
    const result = await getComprehensiveDashboardData();

    // --- Verification ---

    // 1. Verify LOW STOCK OPTIMIZATION
    // Ensure we did NOT query DB for low stock products separately
    const productCalls = prismaMock.product.findMany.mock.calls;
    const lowStockQuery = productCalls.find((args: any) => args[0]?.where?.stockFilled?.lt === 20);
    expect(lowStockQuery).toBeUndefined(); // Should be removed

    // Ensure we derived it correctly
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].name).toBe('Low Stock');

    // 2. Verify CASH STATS OPTIMIZATION
    // Ensure we did NOT query DB for cashStats (aggregate sum cashCollected)
    const orderAggCalls = prismaMock.order.aggregate.mock.calls;
    // Filter for calls that sum cashCollected
    const cashStatsQuery = orderAggCalls.find((args: any) => args[0]?._sum?.cashCollected === true);
    expect(cashStatsQuery).toBeUndefined(); // Should be removed

    // Ensure we derived totalCashCollected from paymentMethod groupBy
    // 500 + 500 = 1000
    expect(result.cashManagement.totalCashCollected).toBe(1000);

    // 3. Verify PREV STATS OPTIMIZATION
    // Ensure we queried groupBy status for prev period
    const orderGroupByCalls = prismaMock.order.groupBy.mock.calls;
    // We can't easily check the exact date because of dynamic date generation in function,
    // but we can check the structure.
    const prevStatsQuery = orderGroupByCalls.find((args: any) => args[0]?.by?.includes('status') && args[0]?._sum?.totalAmount === true);
    expect(prevStatsQuery).toBeDefined();

    // Ensure we derived prevRevenue and prevOrders
    // prevRevenue = 5000 (from COMPLETED status in mock)
    // prevOrders = 50 + 10 = 60

    // We can check revenueChange or other derived metrics
    // currentRevenue = 1000 (live) + 0 (historical) = 1000
    // prevRevenue = 5000
    // Change = (1000 - 5000) / 5000 = -0.8 (-80%)
    expect(result.overview.revenueChange).toBe(-80);
  });
});
