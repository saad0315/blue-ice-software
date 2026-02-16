import { OrderStatus, PaymentMethod } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
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
    order: {
      aggregate: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    dailyStats: {
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
}));

// Mock date-utils
vi.mock('@/lib/date-utils', () => ({
  toUtcStartOfDay: (d: Date) => d,
  toUtcEndOfDay: (d: Date) => d,
}));

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks to avoid crashes
    (db.customerProfile.count as any).mockResolvedValue(100);
    (db.driverProfile.count as any).mockResolvedValue(10);

    // Default aggregate for revenue/cash
    (db.order.aggregate as any).mockResolvedValue({ _sum: { totalAmount: 5000, cashCollected: 2000 } });

    (db.order.count as any).mockResolvedValue(50);
    (db.order.groupBy as any).mockResolvedValue([]);
    (db.$queryRaw as any).mockResolvedValue([]);
    (db.cashHandover.aggregate as any).mockResolvedValue({ _sum: { actualCash: 1000 }, _count: { id: 5 } });
    (db.driverPerformanceMetrics.groupBy as any).mockResolvedValue([]);
    (db.orderItem.aggregate as any).mockResolvedValue({ _sum: { filledGiven: 100, emptyTaken: 90, damagedReturned: 2, quantity: 100 } });
    (db.product.findMany as any).mockResolvedValue([]);
    (db.expense.aggregate as any).mockResolvedValue({ _sum: { amount: 500 } });
    (db.customerProfile.aggregate as any).mockResolvedValue({ _sum: { cashBalance: -200 } });
    (db.order.findMany as any).mockResolvedValue([]);
    (db.customerProfile.findMany as any).mockResolvedValue([]);
    (db.driverProfile.findMany as any).mockResolvedValue([]);
    (db.dailyStats.findMany as any).mockResolvedValue([]);
    (db.customerProfile.groupBy as any).mockResolvedValue([]);
  });

  it('should fetch dashboard data and make expected DB calls', async () => {
    // Setup specific mocks for our test case regarding products and cash stats

    // Mock products - All products
    const allProducts = [
      { id: 'p1', name: 'Product A', stockFilled: 100, stockEmpty: 50, basePrice: 10 },
      { id: 'p2', name: 'Product B', stockFilled: 10, stockEmpty: 5, basePrice: 20 }, // Low stock
    ];

    // Mock low stock products query (the one we want to eliminate)
    const lowStockProducts = [{ id: 'p2', name: 'Product B', stockFilled: 10, stockEmpty: 5 }];

    // Mock db.product.findMany
    (db.product.findMany as any).mockImplementation((args: any) => {
      // Logic to distinguish calls
      if (args && args.where && args.where.stockFilled && args.where.stockFilled.lt === 20) {
        return Promise.resolve(lowStockProducts);
      }
      return Promise.resolve(allProducts);
    });

    // Mock Orders by Payment Method
    const ordersByPaymentMethod = [
      { paymentMethod: PaymentMethod.CASH, _count: { id: 10 }, _sum: { cashCollected: 2000 } },
      { paymentMethod: PaymentMethod.ONLINE_TRANSFER, _count: { id: 5 }, _sum: { cashCollected: 0 } },
    ];

    (db.order.groupBy as any).mockImplementation((args: any) => {
      if (args?.by?.includes('paymentMethod')) {
        return Promise.resolve(ordersByPaymentMethod);
      }
      return Promise.resolve([]);
    });

    // Run the function
    const data = await getComprehensiveDashboardData();

    // Verify low stock products are correctly returned
    expect(data.alerts.lowStockProducts).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'p2' })]));

    // Verify cash values
    expect(data.cashManagement.totalCashCollected).toBe(2000);

    // Verify DB calls
    // Product findMany: 1. All products (Low stock is derived)
    expect(db.product.findMany).toHaveBeenCalledTimes(1);

    // Order aggregate:
    // 1. prevRevenue
    // liveRevenue is derived from ordersByStatus (since isLiveOnly=true by default)
    // cashStats is derived from ordersByPaymentMethod
    expect(db.order.aggregate).toHaveBeenCalledTimes(1);

    // Order count:
    // 1. prevOrders
    // 2. cashOrdersCount
    // liveCompletedOrders and liveTotalVolume are derived
    expect(db.order.count).toHaveBeenCalledTimes(2);

    // GroupBy calls:
    // 1. ordersByStatus
    // 2. ordersByPaymentMethod
    // 3. liveDriverPerformance (groupBy driverId)
    // 4. topCustomers (groupBy customerId)
    // Note: liveOrderBreakdown was removed.
    expect(db.order.groupBy).toHaveBeenCalledTimes(4);
  });
});
