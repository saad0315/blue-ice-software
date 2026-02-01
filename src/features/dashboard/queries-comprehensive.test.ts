
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrderStatus, PaymentMethod } from '@prisma/client';

// 1. Create a container for the mock
const prismaMockContainer = vi.hoisted(() => {
  return {
    prisma: {
      order: {
        aggregate: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      dailyStats: {
        findMany: vi.fn(),
      },
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
      driverPerformanceMetrics: {
        groupBy: vi.fn(),
      },
      cashHandover: {
        aggregate: vi.fn(),
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
  };
});

// 2. Mock the module
vi.mock('@/lib/db', () => ({
  db: prismaMockContainer.prisma,
}));

// 3. Import SUT
import { getComprehensiveDashboardData } from './queries-comprehensive';

describe('getComprehensiveDashboardData', () => {
  let prismaMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = prismaMockContainer.prisma;
  });

  it('should return aggregated data for a hybrid date range', async () => {
    // Dates
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 10); // 10 days ago
    const endDate = today;

    // Mock Responses for Promise.all
    // The order of mocks here must match the order in Promise.all

    // 1. Historical Stats
    const mockDailyStats = [
      {
        date: new Date(startDate),
        totalRevenue: 1000,
        ordersCompleted: 10,
        ordersPending: 2,
        ordersCancelled: 1,
        ordersRescheduled: 0,
      },
    ];
    prismaMock.dailyStats.findMany.mockResolvedValue(mockDailyStats);

    // 2. Live Revenue Trend (QueryRaw Call 1)
    // 3. Live Order Trend (QueryRaw Call 2)
    // 12. Pending Handovers (QueryRaw Call 3)
    // 21. Route Performance (QueryRaw Call 4)
    prismaMock.$queryRaw
        .mockResolvedValueOnce([ { date: endDate.toISOString(), revenue: 500, orders: 5 } ]) // Live Rev Trend
        .mockResolvedValueOnce([ { date: endDate.toISOString(), status: 'COMPLETED', count: 5n } ]) // Live Order Trend
        .mockResolvedValueOnce([ { count: 1n, amount: 200 } ]) // Pending Handovers
        .mockResolvedValueOnce([ { routeName: 'Route A', count: 10n, revenue: 1000 } ]); // Route Perf

    // 4. Total Active Customers
    prismaMock.customerProfile.count.mockResolvedValueOnce(100);

    // 5. Total Active Drivers
    prismaMock.driverProfile.count.mockResolvedValueOnce(10);

    // Drivers Lookup (After Promise.all)
    prismaMock.driverProfile.findMany.mockResolvedValue([
        { id: 'd1', user: { name: 'Driver 1' } }
    ]);

    // 6. Prev Revenue (Order Aggregate Call 1)
    // 10. Cash Stats (Order Aggregate Call 2)
    prismaMock.order.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 400 } }) // Prev Revenue
        .mockResolvedValueOnce({ _sum: { cashCollected: 300 } }); // Cash Stats

    // 7. Prev Orders (Order Count Call 1)
    // 11. Cash Orders (Order Count Call 2)
    prismaMock.order.count
        .mockResolvedValueOnce(12) // Prev Orders
        .mockResolvedValueOnce(3); // Cash Orders

    // 8. Orders By Status (Order GroupBy Call 1)
    const mockOrdersByStatus = [
        { status: OrderStatus.COMPLETED, _count: { id: 15 }, _sum: { totalAmount: 1500 } }, // 10 hist + 5 live
        { status: OrderStatus.PENDING, _count: { id: 2 }, _sum: { totalAmount: 0 } },
        { status: OrderStatus.CANCELLED, _count: { id: 1 }, _sum: { totalAmount: 0 } },
    ];

    // 9. Orders By Payment (Order GroupBy Call 2)
    // 14. Driver Perf (Order GroupBy Call 3)
    // 20. Top Customers (Order GroupBy Call 4)
    prismaMock.order.groupBy
        .mockResolvedValueOnce(mockOrdersByStatus)
        .mockResolvedValueOnce([ { paymentMethod: PaymentMethod.CASH, _count: { id: 10 }, _sum: { cashCollected: 1000 } } ]) // Payment
        .mockResolvedValueOnce([ { driverId: 'd1', _count: { id: 5 }, _sum: { cashCollected: 500, totalAmount: 500 } } ]) // Driver Perf
        .mockResolvedValueOnce([ { customerId: 'c1', _sum: { totalAmount: 1000 }, _count: { id: 5 } } ]); // Top Customers

    // 13. Verified Cash
    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 1000 }, _count: { id: 5 } });

    // 15. Historical Driver Metrics
    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);

    // 16. Bottle Stats
    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 50, emptyTaken: 40, damagedReturned: 2, quantity: 50 } });

    // 17. Product Inventory (Product FindMany Call 1)
    // 25. Low Stock (Product FindMany Call 2)
    prismaMock.product.findMany
        .mockResolvedValueOnce([ { id: 'p1', name: 'Water', stockFilled: 100, stockEmpty: 50, basePrice: 10 } ]) // Inventory
        .mockResolvedValueOnce([]); // Low Stock

    // 18. New Customers (Customer Count Call 2)
    prismaMock.customerProfile.count.mockResolvedValueOnce(5);

    // 19. Customers By Type
    prismaMock.customerProfile.groupBy.mockResolvedValue([
        { type: 'RESIDENTIAL', _count: { id: 80 } },
        { type: 'COMMERCIAL', _count: { id: 20 } },
    ]);

    // 22. Total Expenses
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 100 } });

    // 23. Total Receivables
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: -500 } });

    // 24. Failed Orders
    prismaMock.order.findMany.mockResolvedValue([]);

    // 26. High Credit Customers (Customer FindMany Call 1 - Inside Promise.all)
    // ... And then Top Customer LOOKUP (Customer FindMany Call 2 - After Promise.all)
    prismaMock.customerProfile.findMany
        .mockResolvedValueOnce([]) // High Credit
        .mockResolvedValueOnce([ { id: 'c1', user: { name: 'Customer 1' } } ]); // Top Customers Lookup

    // Run SUT
    const result = await getComprehensiveDashboardData({ startDate, endDate });

    // Assertions
    expect(result).toBeDefined();

    // Total Revenue = 1500 (derived from ordersByStatus)
    expect(result.overview.realizedRevenue).toBe(1500);

    // Completed Orders = 15 (derived from ordersByStatus)
    expect(result.overview.completedOrders).toBe(15);
  });
});
