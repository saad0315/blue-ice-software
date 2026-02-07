import { subDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    dailyStats: {
      findMany: vi.fn(),
    },
    // Mock other db calls to avoid errors
    order: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    customerProfile: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { cashBalance: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    driverProfile: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    cashHandover: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { actualCash: 0 } }),
    },
    driverPerformanceMetrics: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    orderItem: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { filledGiven: 0 } }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    expense: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call dailyStats.findMany only once for historical data', async () => {
    // Setup dates for historical data
    const today = new Date();
    const startDate = subDays(today, 10);
    const endDate = subDays(today, 2); // Strictly historical, no overlap with "live" (today)

    // Mock dailyStats return
    const mockDailyStats = [
      {
        date: startDate,
        totalRevenue: 100,
        ordersCompleted: 10,
        ordersPending: 2,
        ordersCancelled: 1,
        ordersRescheduled: 0,
      },
    ];

    vi.mocked(db.dailyStats.findMany).mockResolvedValue(mockDailyStats as any);

    await getComprehensiveDashboardData({ startDate, endDate });

    // Expectation: it should be called only once (optimization)
    expect(db.dailyStats.findMany).toHaveBeenCalledTimes(1);
  });
});
