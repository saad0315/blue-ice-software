import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist the mock container
const prismaMockContainer = vi.hoisted(() => {
  return {
    prisma: {
      order: {
        aggregate: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      dailyStats: {
        findMany: vi.fn(),
      },
      customerProfile: {
        count: vi.fn(),
        groupBy: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
      driverProfile: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      cashHandover: {
        aggregate: vi.fn(),
      },
      driverPerformanceMetrics: {
        groupBy: vi.fn(),
      },
      orderItem: {
        aggregate: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      expense: {
        aggregate: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: prismaMockContainer.prisma,
}));

import { getComprehensiveDashboardData } from './queries-comprehensive';

describe('getComprehensiveDashboardData', () => {
  let prismaMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = prismaMockContainer.prisma;

    // Set default return values to avoid crashes due to destructuring or arithmetic on undefined
    prismaMock.dailyStats.findMany.mockResolvedValue([]);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: {} });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: {} });
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);
    prismaMock.customerProfile.findMany.mockResolvedValue([]);
    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.driverProfile.findMany.mockResolvedValue([]);
    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: {}, _count: {} });
    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: {} });
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: {} });

    // Mock Product return for our specific test
    prismaMock.product.findMany.mockImplementation(async (args: any) => {
        // We can inspect args here if needed
        return [
            { id: 'p1', name: 'P1', stockFilled: 100, stockEmpty: 0, basePrice: 10 },
            { id: 'p2', name: 'P2', stockFilled: 10, stockEmpty: 0, basePrice: 10 }, // Low stock
        ];
    });
  });

  it('should fetch products only once and filter low stock in memory', async () => {
    const result = await getComprehensiveDashboardData();

    // Verify db.product.findMany was called
    // In original code: called twice (once for all, once for low stock)
    // In optimized code: called once
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);

    // Optional: verify arguments to ensure it's the "all products" query
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { name: 'asc' }
    }));

    // Verify lowStockProducts logic
    // We mocked return value as:
    // P1: stockFilled 100 (not low)
    // P2: stockFilled 10 (low)
    // So we expect only P2 in lowStockProducts
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].name).toBe('P2');
    expect(result.alerts.lowStockProducts[0].stockFilled).toBe(10);
  });
});
