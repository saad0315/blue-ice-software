import type { PrismaClient } from '@prisma/client';
import { OrderStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeepMockProxy } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep<PrismaClient>(),
  };
});

describe('getComprehensiveDashboardData', () => {
  const prismaMock = db as unknown as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should derive lowStockProducts and cashStats correctly', async () => {
    // Mock Product Data
    const mockProducts = [
      { id: 'p1', name: 'Product A', stockFilled: 100, stockEmpty: 50, basePrice: 10 },
      { id: 'p2', name: 'Product B', stockFilled: 10, stockEmpty: 5, basePrice: 20 }, // Low stock
      { id: 'p3', name: 'Product C', stockFilled: 5, stockEmpty: 0, basePrice: 15 }, // Low stock
    ];

    // Setup mocks
    prismaMock.product.findMany.mockResolvedValue(mockProducts as any);

    // Mock Orders Aggregations
    prismaMock.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: 1000, cashCollected: 500 },
      _count: { id: 10 },
    } as any);

    prismaMock.order.count.mockResolvedValue(10);

    // Mock Group By
    prismaMock.order.groupBy.mockImplementation(async (args: any) => {
      // Orders by Status
      if (args.by && args.by.includes('status')) {
        return [{ status: OrderStatus.COMPLETED, _count: { id: 10 }, _sum: { totalAmount: 1000 } }] as any;
      }
      // Orders by Payment Method
      if (args.by && args.by.includes('paymentMethod')) {
        return [
          { paymentMethod: 'CASH', _count: { id: 5 }, _sum: { cashCollected: 500 } },
          { paymentMethod: 'CARD', _count: { id: 3 }, _sum: { cashCollected: 0 } },
        ] as any;
      }
      // Driver Performance
      if (args.by && args.by.includes('driverId')) {
        return [] as any;
      }
      return [];
    });

    // Mock other queries to return empty/defaults
    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);
    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } } as any);
    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } } as any);
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } } as any);
    prismaMock.order.findMany.mockResolvedValue([]); // For failed orders
    prismaMock.customerProfile.findMany.mockResolvedValue([]); // For high credit
    prismaMock.dailyStats.findMany.mockResolvedValue([]);

    // Run the function
    const result = await getComprehensiveDashboardData();

    // Verify Low Stock Products (sorted by stockFilled ASC)
    expect(result.alerts.lowStockProducts).toHaveLength(2);
    expect(result.alerts.lowStockProducts[0].id).toBe('p3'); // 5 stock
    expect(result.alerts.lowStockProducts[1].id).toBe('p2'); // 10 stock

    // Verify Cash Stats
    // Should be 500 (from Payment Method aggregation)
    expect(result.cashManagement.totalCashCollected).toBe(500);

    // Verify number of calls
    // Product findMany should be called ONCE (after optimization)
    // Before optimization, it might fail this check or be called twice.
    // We expect to implement the optimization next.
  });
});
