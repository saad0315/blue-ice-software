import { OrderStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Use vi.hoisted to ensure the mock object is created before the mock factory is called
const prismaMock = vi.hoisted(() => ({
  dailyStats: {
    findMany: vi.fn(),
  },
  order: {
    aggregate: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  customerProfile: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
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
}));

vi.mock('@/lib/db', () => ({
  db: prismaMock,
}));

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations to return valid structures (empty or zeros)
    // so the code doesn't crash on property access.

    prismaMock.dailyStats.findMany.mockResolvedValue([]);

    prismaMock.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0, cashCollected: 0 },
    });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.order.findMany.mockResolvedValue([]);

    prismaMock.$queryRaw.mockResolvedValue([]);

    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);
    prismaMock.customerProfile.findMany.mockResolvedValue([]);
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });

    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.driverProfile.findMany.mockResolvedValue([]);

    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });

    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);

    prismaMock.orderItem.aggregate.mockResolvedValue({
      _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 },
    });

    prismaMock.product.findMany.mockResolvedValue([]);

    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  });

  it('should call db.dailyStats.findMany only once (optimized)', async () => {
    // We set a date range that covers "historical" data to trigger the dailyStats query.
    // Assuming today is fixed or we use a past date range.
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setDate(today.getDate() - 30);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    await getComprehensiveDashboardData({
      startDate: lastMonth,
      endDate: yesterday, // Explicitly historical
    });

    // Check if dailyStats.findMany was called once
    expect(prismaMock.dailyStats.findMany).toHaveBeenCalledTimes(1);
  });
});
