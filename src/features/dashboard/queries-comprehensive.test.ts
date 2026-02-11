import { OrderStatus, PaymentMethod } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep(),
  };
});

describe('getComprehensiveDashboardData Optimization', () => {
  beforeEach(() => {
    mockReset(db);
  });

  it('should return correct data with mocked DB responses', async () => {
    // Use future dates to ensure isHistoricalOnly is false and isLiveOnly is true (or hybrid)
    // Assuming current year is < 3000
    const startDate = new Date('3000-10-01T00:00:00Z');
    const endDate = new Date('3000-10-02T23:59:59Z');

    // 1. Historical Stats
    db.dailyStats.findMany.mockResolvedValue([]);

    // Chain mocks for order.aggregate
    // Removed Live Revenue (derived from trends)
    // Removed Cash Stats (derived from payment methods)
    // Only Prev Revenue remains
    db.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 0 } } as any); // Prev Revenue

    // Chain mocks for order.count
    // Removed Live Completed Orders (derived from trends)
    // Removed Live Total Volume (derived from breakdown)
    // Only Prev Orders and Cash Orders Count remain
    db.order.count
      .mockResolvedValueOnce(0) // Prev Orders
      .mockResolvedValueOnce(3); // Cash Orders Count

    // Live Trend Raw
    const mockLiveTrends = [
      { date: '2023-10-01', revenue: 100, orders: 2 },
      { date: '2023-10-02', revenue: 200, orders: 3 },
    ];

    // Chain mocks for $queryRaw
    // 1. Live Trend Raw
    // 2. Pending Handovers
    // 3. Route Performance
    // 4. Live Order Trend Raw (post Promise.all)
    db.$queryRaw
      .mockResolvedValueOnce(mockLiveTrends)
      .mockResolvedValueOnce([{ count: 1n, amount: 50 }]) // Pending Handovers
      .mockResolvedValueOnce([]) // Route Performance
      .mockResolvedValueOnce([]); // Live Order Trend Status

    // Chain mocks for order.groupBy
    const mockStatusGroups = [
      { status: OrderStatus.COMPLETED, _count: { id: 5 }, _sum: { totalAmount: 300 } },
      { status: OrderStatus.PENDING, _count: { id: 2 }, _sum: { totalAmount: 100 } },
      { status: OrderStatus.CANCELLED, _count: { id: 1 }, _sum: { totalAmount: 50 } },
    ];

    const mockPaymentMethods = [
      { paymentMethod: PaymentMethod.CASH, _count: { id: 3 }, _sum: { cashCollected: 150 } },
      { paymentMethod: PaymentMethod.ONLINE, _count: { id: 2 }, _sum: { cashCollected: 0 } },
    ];

    db.order.groupBy
      .mockResolvedValueOnce(mockStatusGroups as any) // Live Status Breakdown
      .mockResolvedValueOnce(mockStatusGroups as any) // Orders by Status
      .mockResolvedValueOnce(mockPaymentMethods as any) // Orders by Payment Method
      .mockResolvedValueOnce([]) // Driver Performance Live
      .mockResolvedValueOnce([]); // Top Customers

    // --- Promise.all mocks ---

    // 1. Total Customers
    db.customerProfile.count.mockResolvedValue(100);

    // 2. Total Drivers
    db.driverProfile.count.mockResolvedValue(10);

    // (Prev Revenue & Prev Orders already mocked in chain)
    // (Orders by Status & Payment Method already mocked in chain)
    // (Cash Stats & Cash Orders Count already mocked in chain)
    // (Pending Handovers already mocked in chain)

    // 10. Verified Handovers
    db.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 100 }, _count: { id: 2 } });

    // (Driver Performance Live already mocked in chain)

    // 12. Driver Performance Hist (skipped if isLiveOnly is true, but startDate is recent so likely not skipped? Logic: !isLiveOnly)
    // isLiveOnly = startDate >= today. startDate is 2023-10-01. Today is 2024+.
    // So isLiveOnly is false? Wait, "today" in code is `new Date()`.
    // If I run this test today, `today` is strictly > startDate.
    // So `isLiveOnly` is FALSE. `isHistoricalOnly` depends on endDate < today.
    // So it runs both.
    // I need to mock historical driver metrics.
    db.driverPerformanceMetrics.groupBy.mockResolvedValue([]);

    // 13. Bottle Stats
    db.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 10, emptyTaken: 5, damagedReturned: 0, quantity: 10 } });

    // 14. Product Inventory
    const mockProducts = [
      { id: '1', name: 'Product A', stockFilled: 10, stockEmpty: 5, basePrice: 10 },
      { id: '2', name: 'Product B', stockFilled: 50, stockEmpty: 10, basePrice: 20 },
      { id: '3', name: 'Product C', stockFilled: 5, stockEmpty: 2, basePrice: 15 },
    ];
    db.product.findMany.mockResolvedValueOnce(mockProducts as any);

    // 15. New Customers
    db.customerProfile.count.mockResolvedValue(5);

    // 16. Customers by Type
    db.customerProfile.groupBy.mockResolvedValue([]);

    // 17. Top Customers
    db.order.groupBy.mockResolvedValue([]);

    // 18. Route Performance ($queryRaw)
    db.$queryRaw.mockResolvedValueOnce([]);

    // 19. Total Expenses
    db.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    // 20. Total Receivables
    db.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });

    // 21. Failed Orders
    db.order.findMany.mockResolvedValue([]);

    // 22. Low Stock Products (redundant) - Removed

    // 23. High Credit Customers
    db.customerProfile.findMany.mockResolvedValue([]);

    // --- Post Promise.all ---
    // Combined Order Trends: `dailyStats.findMany` again if !isLiveOnly.
    db.dailyStats.findMany.mockResolvedValue([]);

    // Live Order Trend Raw
    db.$queryRaw.mockResolvedValueOnce([]); // Live Order Trend Status

    // Drivers fetch
    db.driverProfile.findMany.mockResolvedValue([]);
    // Customers fetch
    db.customerProfile.findMany.mockResolvedValue([]);

    // Execute
    const result = await getComprehensiveDashboardData({ startDate, endDate });

    // Assertions

    // 1. Check Live Revenue (derived or queried)
    // 300
    expect(result.overview.realizedRevenue).toBe(300);

    // 2. Check Completed Orders
    // 5
    expect(result.overview.completedOrders).toBe(5);

    // 3. Check Total Volume
    // 8
    expect(result.overview.totalOrders).toBe(8);

    // 4. Check Low Stock Products
    // Should be sorted by stockFilled asc
    expect(result.alerts.lowStockProducts).toHaveLength(2);
    expect(result.alerts.lowStockProducts[0].id).toBe('3'); // 5 stock
    expect(result.alerts.lowStockProducts[1].id).toBe('1'); // 10 stock

    // 5. Check Cash Stats
    // 150
    expect(result.cashManagement.totalCashCollected).toBe(150);

    // Verify optimizations (reduced call counts)
    // Only 1 aggregate call (Prev Revenue)
    expect(db.order.aggregate).toHaveBeenCalledTimes(1);

    // Only 2 count calls (Prev Orders, Cash Orders)
    // Removed: Live Completed, Live Volume
    expect(db.order.count).toHaveBeenCalledTimes(2);

    // Only 1 findMany call for products (Inventory)
    // Removed: Low Stock Products
    // Plus others for drivers, customers, failures, high credit
    // But specifically check we didn't call it for low stock
    // Since mockResolvedValueOnce consumes mocks, we can check calls.
    // db.product.findMany was called:
    // 1. Inventory
    // 2. High Credit Customers? No that's customerProfile.
    // 3. Failed Orders? No that's order.
    // So ONLY 1 call to product.findMany.
    expect(db.product.findMany).toHaveBeenCalledTimes(1);
  });
});
