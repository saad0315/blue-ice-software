import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Hoist the mock creation so it can be used in the mock factory
const prismaMock = vi.hoisted(() => {
  // We can't use imported mockDeep here directly because imports are not available in hoisted code
  // But we can import it inside.
  // Actually, simplest way for vitest:
  return {
    product: { findMany: vi.fn() },
    order: { aggregate: vi.fn(), groupBy: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    dailyStats: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    customerProfile: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    driverProfile: { count: vi.fn() },
    driverPerformanceMetrics: { groupBy: vi.fn() },
    orderItem: { aggregate: vi.fn() },
    expense: { aggregate: vi.fn() },
    cashHandover: { aggregate: vi.fn() },
  };
});

// To use mockDeep properly with full type support and automocking, we usually do:
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep<PrismaClient>(),
  };
});

describe('getComprehensiveDashboardData Optimization', () => {
  beforeEach(() => {
    mockReset(db);
  });

  it('should optimize database queries by removing redundant calls', async () => {
    // 1. Setup Data
    const mockProducts = [
      { id: '1', name: 'Product 1', stockFilled: 10, stockEmpty: 5, basePrice: 100 },
      { id: '2', name: 'Product 2', stockFilled: 30, stockEmpty: 10, basePrice: 200 },
    ];

    const mockPaymentMethodStats = [
      { paymentMethod: 'CASH', _count: { id: 10 }, _sum: { cashCollected: 1000 } },
      { paymentMethod: 'ONLINE_TRANSFER', _count: { id: 5 }, _sum: { cashCollected: 500 } },
    ];

    // 2. Setup Mocks
    // Essential mocks to prevent crashes
    // We need to cast db to any or use the MockProxy type if we want to be strict, but for test file this is fine.
    const mockDb = db as any;

    mockDb.dailyStats.findMany.mockResolvedValue([]);
    mockDb.order.count.mockResolvedValue(0);
    mockDb.$queryRaw.mockResolvedValue([]);
    mockDb.customerProfile.count.mockResolvedValue(0);
    mockDb.driverProfile.count.mockResolvedValue(0);
    mockDb.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    mockDb.orderItem.aggregate.mockResolvedValue({ _sum: {} });
    mockDb.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockDb.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
    mockDb.order.findMany.mockResolvedValue([]);
    mockDb.customerProfile.findMany.mockResolvedValue([]);
    mockDb.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
    mockDb.customerProfile.groupBy.mockResolvedValue([]);

    // Mock Product Queries
    // We expect this to be called once for inventory (getting all products)
    mockDb.product.findMany.mockResolvedValue(mockProducts);

    // Mock Order Aggregate
    // Currently called for: Live Revenue, Prev Revenue, Cash Stats
    // We want to verify it's NOT called for Cash Stats
    mockDb.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 100, cashCollected: 1500 } });

    // Mock Order GroupBy (Payment Method)
    mockDb.order.groupBy.mockImplementation((args: any) => {
      if (args?.by?.includes('paymentMethod')) {
        return Promise.resolve(mockPaymentMethodStats);
      }
      return Promise.resolve([]);
    });

    // 3. Execute
    const result = await getComprehensiveDashboardData();

    // 4. Assertions

    // A. Product Optimization
    // Should be called ONCE (fetching all products)
    // Currently it is called TWICE (once for all, once for low stock)
    // We assert 1 call to verify optimization.
    expect(mockDb.product.findMany).toHaveBeenCalledTimes(1);

    // B. Cash Stats Optimization
    // We check how many times db.order.aggregate was called.
    // Live Revenue + Prev Revenue = 2 calls.
    // If Cash Stats is still there, it would be 3 calls.
    expect(mockDb.order.aggregate).toHaveBeenCalledTimes(2);

    // C. Data Integrity
    // Ensure derived values are correct

    // Low Stock Products: Product 1 (10 < 20) should be in the list
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].id).toBe('1');

    // Total Cash Collected: Should be 1500 (1000 + 500) derived from payment method stats
    expect(result.cashManagement.totalCashCollected).toBe(1500);
  });
});
