import { OrderStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return { db: mockDeep() };
});

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should optimize redundant queries', async () => {
    // Setup Mocks
    const mockDb = db as any;

    // Mock Date Utils (implicitly handled by the function logic if we don't pass params, but we can pass params)
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');

    // Mock Responses
    mockDb.dailyStats.findMany.mockResolvedValue([]);
    mockDb.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000, cashCollected: 500 } });
    mockDb.order.count.mockResolvedValue(10);
    mockDb.order.groupBy.mockImplementation((args: any) => {
      if (args.by.includes('status')) {
        return Promise.resolve([{ status: OrderStatus.COMPLETED, _count: { id: 10 }, _sum: { totalAmount: 1000 } }]);
      }
      if (args.by.includes('paymentMethod')) {
        return Promise.resolve([
          { paymentMethod: 'CASH', _count: { id: 5 }, _sum: { cashCollected: 300 } },
          { paymentMethod: 'TRANSFER', _count: { id: 5 }, _sum: { cashCollected: 200 } },
        ]);
      }
      if (args.by.includes('driverId')) {
        return Promise.resolve([]);
      }
      if (args.by.includes('type')) {
        return Promise.resolve([]);
      }
      if (args.by.includes('customerId')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    // Mock Customer Profile Group By
    mockDb.customerProfile.groupBy.mockResolvedValue([]);

    mockDb.$queryRaw.mockResolvedValue([]);

    // Mock Order FindMany (for failedOrders)
    mockDb.order.findMany.mockResolvedValue([]);

    // Mock Product Inventory (Full List)
    mockDb.product.findMany.mockImplementation((args: any) => {
      // If it's the inventory query (has basePrice)
      if (args?.select?.basePrice) {
        return Promise.resolve([
          { id: 'p1', name: 'Product 1', stockFilled: 100, stockEmpty: 0, basePrice: 10 },
          { id: 'p2', name: 'Product 2', stockFilled: 10, stockEmpty: 0, basePrice: 20 }, // Low Stock
          { id: 'p3', name: 'Product 3', stockFilled: 5, stockEmpty: 0, basePrice: 30 }, // Low Stock
        ]);
      }
      // If it's the low stock query (where stockFilled < 20)
      if (args?.where?.stockFilled) {
        return Promise.resolve([
          { id: 'p3', name: 'Product 3', stockFilled: 5, stockEmpty: 0 },
          { id: 'p2', name: 'Product 2', stockFilled: 10, stockEmpty: 0 },
        ]);
      }
      return Promise.resolve([]);
    });

    mockDb.customerProfile.count.mockResolvedValue(0);
    mockDb.driverProfile.count.mockResolvedValue(0);
    mockDb.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockDb.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
    mockDb.customerProfile.findMany.mockResolvedValue([]);
    mockDb.orderItem.aggregate.mockResolvedValue({ _sum: {} });
    mockDb.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    mockDb.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });

    // Execute
    const result = await getComprehensiveDashboardData({ startDate, endDate });

    // Verify Correctness
    // Low Stock Products should include p2 and p3, sorted by stock asc (p3, p2)
    expect(result.alerts.lowStockProducts).toHaveLength(2);
    expect(result.alerts.lowStockProducts[0].id).toBe('p3');
    expect(result.alerts.lowStockProducts[1].id).toBe('p2');

    // Cash Management
    // totalCashCollected should be 500 (300 + 200)
    expect(result.cashManagement.totalCashCollected).toBe(500);

    // Verify Optimizations (These assertions will fail before optimization)

    // 1. Check if lowStockProducts query was called
    // In optimized version, we expect NO call with where: { stockFilled: { lt: 20 } }
    const lowStockCalls = mockDb.product.findMany.mock.calls.filter((call: any) => call[0]?.where?.stockFilled);
    expect(lowStockCalls.length).toBe(0); // Assertion for AFTER optimization

    // 2. Check if cashStats query was called
    // The cashStats query is: db.order.aggregate({ where: { scheduledDate: ..., status: COMPLETED }, _sum: { cashCollected: true } })
    // We can identify cashStats by `_sum: { cashCollected: true }`
    const cashStatsCalls = mockDb.order.aggregate.mock.calls.filter((call: any) => call[0]?._sum?.cashCollected);
    expect(cashStatsCalls.length).toBe(0); // Assertion for AFTER optimization
  });
});
