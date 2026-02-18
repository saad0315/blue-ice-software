import { getComprehensiveDashboardData } from './queries-comprehensive';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Mock container
const prismaMockContainer = vi.hoisted(() => {
  return {
    prisma: {
      dailyStats: { findMany: vi.fn() },
      order: {
        aggregate: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      customerProfile: {
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      driverProfile: { count: vi.fn(), findMany: vi.fn() },
      cashHandover: { aggregate: vi.fn() },
      driverPerformanceMetrics: { groupBy: vi.fn() },
      orderItem: { aggregate: vi.fn() },
      product: { findMany: vi.fn() },
      expense: { aggregate: vi.fn() },
      $queryRaw: vi.fn(),
    }
  };
});

vi.mock('@/lib/db', () => ({
  db: prismaMockContainer.prisma
}));

describe('getComprehensiveDashboardData', () => {
  const prismaMock = prismaMockContainer.prisma;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dashboard data and make correct DB calls', async () => {
    // Setup mocks to return empty/default data
    prismaMock.dailyStats.findMany.mockResolvedValue([]);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(0), cashCollected: new Prisma.Decimal(0) } });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.order.findMany.mockResolvedValue([]);

    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: new Prisma.Decimal(0) } });
    prismaMock.customerProfile.findMany.mockResolvedValue([]);
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);

    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.driverProfile.findMany.mockResolvedValue([]);

    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: new Prisma.Decimal(0) }, _count: { id: 0 } });

    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);

    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } });

    prismaMock.product.findMany.mockResolvedValue([]);

    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } });

    prismaMock.$queryRaw.mockResolvedValue([]);

    // Use a future date to ensure "Live Only" logic is triggered
    const startDate = new Date('3000-01-01');
    const endDate = new Date('3000-01-02');

    await getComprehensiveDashboardData({ startDate, endDate });

    // Verify optimized calls

    // 1. product.findMany should be called 1 time (only for productInventory)
    //    The lowStockProducts query was removed.
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);

    // 2. order.aggregate should be called 2 times in Live Only mode:
    //    - 1x inside "if (!isHistoricalOnly)" block for liveRevenue
    //    - 1x for prevRevenue (in Promise.all)
    //    The cashStats query was removed.
    expect(prismaMock.order.aggregate).toHaveBeenCalledTimes(2);
  });
});
