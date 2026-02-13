import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Create a container for the mock
const prismaMockContainer = vi.hoisted(() => {
  return {
    prisma: {
      customerProfile: {
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
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
      driverPerformanceMetrics: {
        groupBy: vi.fn(),
      },
      orderItem: {
        aggregate: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      dailyStats: {
        findMany: vi.fn(),
      },
      expense: {
        aggregate: vi.fn(),
      },
      cashHandover: {
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

describe('getComprehensiveDashboardData Optimization', () => {
  let prismaMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = prismaMockContainer.prisma;

    // Setup default mock returns to avoid errors
    prismaMock.customerProfile.count.mockResolvedValue(0);
    prismaMock.driverProfile.count.mockResolvedValue(0);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 0, cashCollected: 0 } });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } });
    prismaMock.product.findMany.mockResolvedValue([]); // Default empty
    prismaMock.dailyStats.findMany.mockResolvedValue([]);
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
    prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.customerProfile.findMany.mockResolvedValue([]);
    prismaMock.customerProfile.groupBy.mockResolvedValue([]);
  });

  it('should optimize product queries by fetching only once', async () => {
    // Setup specific mocks
    const mockProducts = [
      { id: 'p1', name: 'Water', stockFilled: 10, stockEmpty: 5, basePrice: 100 },
      { id: 'p2', name: 'Juice', stockFilled: 50, stockEmpty: 20, basePrice: 200 },
    ];

    // Only one call needed
    prismaMock.product.findMany.mockResolvedValue(mockProducts);

    const result = await getComprehensiveDashboardData();

    // Verify product.findMany is called ONCE
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);

    // Verify lowStockProducts is correctly derived
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].id).toBe('p1');
    expect(result.alerts.lowStockProducts[0].stockFilled).toBe(10);
  });

  it('should optimize cash stats by deriving from grouped query', async () => {
    // Setup mocks for grouped query
    // ordersByPaymentMethod is the 2nd groupBy call on order
    // But since order.groupBy is called multiple times, we need to handle that.
    // The implementation calls:
    // 1. ordersByStatus (groupBy status)
    // 2. ordersByPaymentMethod (groupBy paymentMethod)
    // 3. liveDriverPerformance (groupBy driverId)
    // 4. topCustomers (groupBy customerId)

    // We need to return correct structure for each call or check arguments.
    prismaMock.order.groupBy.mockImplementation((args: any) => {
        if (args.by.includes('paymentMethod')) {
            return Promise.resolve([
                { paymentMethod: 'CASH', _count: { id: 5 }, _sum: { cashCollected: 500 } },
                { paymentMethod: 'ONLINE', _count: { id: 2 }, _sum: { cashCollected: 100 } }
            ]);
        }
        return Promise.resolve([]);
    });

    const result = await getComprehensiveDashboardData();

    // Check calls
    const orderAggregateCalls = prismaMock.order.aggregate.mock.calls;

    // Check if cash stats call (aggregate with _sum.cashCollected) is GONE
    const hasCashStatsCall = orderAggregateCalls.some((call: any) =>
      call[0]._sum?.cashCollected === true
    );
    expect(hasCashStatsCall).toBe(false);

    // Verify totalCashCollected is correctly derived (500 + 100 = 600)
    expect(result.cashManagement.totalCashCollected).toBe(600);
  });
});
