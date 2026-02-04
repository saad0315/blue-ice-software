import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderStatus } from '@prisma/client';

// 1. Create a container for the mock
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
      $queryRaw: vi.fn(),
      customerProfile: {
        count: vi.fn(),
        groupBy: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
      driverProfile: { count: vi.fn(), findMany: vi.fn() },
      driverPerformanceMetrics: { groupBy: vi.fn() },
      orderItem: { aggregate: vi.fn() },
      product: { findMany: vi.fn() },
      expense: { aggregate: vi.fn() },
      cashHandover: { aggregate: vi.fn() },
    },
  };
});

// 2. Mock the module
vi.mock('@/lib/db', () => ({
  db: prismaMockContainer.prisma,
}));

import { getComprehensiveDashboardData } from './queries-comprehensive';

describe('getComprehensiveDashboardData', () => {
  let prismaMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = prismaMockContainer.prisma;

    // Default valid responses
    prismaMock.dailyStats.findMany.mockResolvedValue([]);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 0, cashCollected: 0 } });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([]);

    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
    prismaMock.customerProfile.findMany.mockResolvedValue([]);

    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.driverProfile.findMany.mockResolvedValue([]);

    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);

    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } });

    prismaMock.product.findMany.mockResolvedValue([]);

    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    prismaMock.order.findMany.mockResolvedValue([]);

    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
  });

  it('should use optimized queries for live stats', async () => {
    await getComprehensiveDashboardData();

    // Verify optimization: Reduced number of aggregate and count calls

    // Live Stats: 0 calls (Optimized away)
    // Big Promise.all: 2 calls (prevRevenue, cashStats)
    expect(prismaMock.order.aggregate).toHaveBeenCalledTimes(2);

    // Live Stats: 0 calls (Optimized away)
    // Big Promise.all: 2 calls (Prev Volume, Cash Orders Count)
    expect(prismaMock.order.count).toHaveBeenCalledTimes(2);

    // Verify that the new groupBy was called (Live Stats)
    // Total groupBy calls:
    // 1 (Live Status) + 1 (Status) + 1 (Payment) + 1 (Driver) + 1 (Top Cust) = 5 calls.
    expect(prismaMock.order.groupBy).toHaveBeenCalledTimes(5);
  });
});
