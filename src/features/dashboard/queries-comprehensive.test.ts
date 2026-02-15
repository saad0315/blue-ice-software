import { OrderStatus, PaymentMethod, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: mockDeep<PrismaClient>(),
}));

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    mockReset(db);
  });

  it('should return correct data structure and call expected queries', async () => {
    const mockDate = new Date('2023-01-01');

    // Mock return values

    // 1. DailyStats (Historical)
    db.dailyStats.findMany.mockResolvedValue([]);

    // 2. Order Aggregates & Counts
    // We need to match the specific calls or just provide generic mocks.
    // For simplicity, we'll return 0 for counts and sums.
    db.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: 1000, cashCollected: 500 },
      _count: { id: 10 },
    } as any);

    db.order.count.mockResolvedValue(10);

    // 3. Raw Queries
    // liveTrendRaw
    // pendingHandovers
    // routePerformance
    // liveOrderTrendRaw
    db.$queryRaw.mockResolvedValue([]);

    // 4. GroupBy
    // liveOrderBreakdown
    // ordersByStatus
    // ordersByPaymentMethod
    // driverPerformance (live)
    // topCustomers
    // customersByType
    db.order.groupBy.mockResolvedValue([]);

    // driverPerformance (historical)
    db.driverPerformanceMetrics.groupBy.mockResolvedValue([]);

    // 5. Customer Profile
    db.customerProfile.count.mockResolvedValue(50);
    db.customerProfile.groupBy.mockResolvedValue([]);
    db.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: -200 } } as any);
    db.customerProfile.findMany.mockResolvedValue([]);

    // 6. Driver Profile
    db.driverProfile.count.mockResolvedValue(5);
    db.driverProfile.findMany.mockResolvedValue([]);

    // 7. Order Item
    db.orderItem.aggregate.mockResolvedValue({
      _sum: { filledGiven: 100, emptyTaken: 90, damagedReturned: 2, quantity: 100 },
    } as any);

    // 8. Expense
    db.expense.aggregate.mockResolvedValue({ _sum: { amount: 300 } } as any);

    // 9. Cash Handover
    db.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 400 }, _count: { id: 2 } } as any);

    // Failed Orders & High Credit Customers
    // db.order.findMany is used for failedOrders
    db.order.findMany.mockResolvedValue([]);
    // db.customerProfile.findMany is used for highCreditCustomers (already mocked to [])

    // 10. Product Inventory & Low Stock
    // This is the target of our optimization.
    const mockProducts = [
      { id: 'p1', name: 'Product 1', stockFilled: 100, stockEmpty: 50, basePrice: 200 },
      { id: 'p2', name: 'Product 2', stockFilled: 10, stockEmpty: 5, basePrice: 150 }, // Low stock
    ];

    // First call is for full inventory
    // Second call is for low stock
    // Since mockResolvedValue returns the same for all calls unless mocked specifically with `calledWith` or `mockResolvedValueOnce`.
    // Let's use `mockResolvedValueOnce` to distinguish if needed, but the optimization aims to remove the second call.
    // For now, let's just make both return what they would.

    // The code does `db.product.findMany` twice.
    // Call 1: Inventory (no where clause for stock)
    // Call 2: Low Stock (where stockFilled < 20)

    // We can't easily distinguish by arguments with simple mocks without looking at the implementation order in Promise.all.
    // But since we want to remove one call, we can check call counts.

    db.product.findMany.mockImplementation(async (args) => {
      if (args?.where?.stockFilled?.lt === 20) {
        // Low stock query
        return mockProducts.filter((p) => p.stockFilled < 20) as any;
      }
      // Inventory query
      return mockProducts as any;
    });

    // 11. Cash Stats
    // The code calls `db.order.aggregate` for cashStats specifically.
    // It also calls `db.order.groupBy` for `ordersByPaymentMethod`.

    // Let's set up specific return for `ordersByPaymentMethod`
    const mockPaymentMethods = [
      { paymentMethod: PaymentMethod.CASH, _count: { id: 5 }, _sum: { cashCollected: 400 } },
      { paymentMethod: PaymentMethod.ONLINE_TRANSFER, _count: { id: 5 }, _sum: { cashCollected: 100 } },
    ];

    // We need to make sure `db.order.groupBy` returns this when queried for payment methods.
    db.order.groupBy.mockImplementation(async (args: any) => {
      if (args.by && args.by.includes('paymentMethod')) {
        return mockPaymentMethods as any;
      }
      return [];
    });

    // And `db.order.aggregate` for cashStats
    db.order.aggregate.mockImplementation(async (args: any) => {
      // There are multiple aggregates.
      // 1. Live Revenue (status=COMPLETED)
      // 2. Prev Revenue
      // 3. Cash Stats (status=COMPLETED)

      // If we look at the code:
      // `liveRevenue` uses `_sum: { totalAmount: true }`
      // `prevRevenue` uses `_sum: { totalAmount: true }`
      // `cashStats` uses `_sum: { cashCollected: true }`

      if (args._sum?.cashCollected) {
        return { _sum: { cashCollected: 500 } } as any; // 400 + 100
      }
      return { _sum: { totalAmount: 1000 } } as any;
    });

    // Run the function
    const result = await getComprehensiveDashboardData({ startDate: mockDate, endDate: mockDate });

    // Assertions

    // Verify Low Stock Products
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].id).toBe('p2');

    // Verify Cash Management
    expect(result.cashManagement.totalCashCollected).toBe(500);

    // Verify DB Calls (Optimized)
    // We expect `db.product.findMany` to be called once (Inventory only).
    expect(db.product.findMany).toHaveBeenCalledTimes(1);

    // We expect `db.order.aggregate` to be called 1 time (Prev Rev).
    // Cash Stats is derived from ordersByPaymentMethod.
    // Live Revenue is skipped because the date is historical.
    expect(db.order.aggregate).toHaveBeenCalledTimes(1);
  });
});
