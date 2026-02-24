import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getComprehensiveDashboardData } from './queries-comprehensive';
import { db } from '@/lib/db';
import { OrderStatus, PaymentMethod } from '@prisma/client';

// Mock the db module
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep(),
  };
});

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should derive lowStockProducts and cashStats from other queries', async () => {
    // Setup Date mocks to ensure consistent "Live" vs "Historical" logic
    const today = new Date('2024-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(today);

    // Mock DB responses
    const mockDb = db as any;

    // 1. Mock DailyStats (Historical) - Empty for simplicity
    mockDb.dailyStats.findMany.mockResolvedValue([]);

    // 2. Mock Live Data
    // For liveRevenue, liveCompletedOrders, liveTotalVolume (Step 2)
    // mockDb.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000 } }); // generic response
    mockDb.order.aggregate.mockImplementation((args: any) => {
        if (args?._sum?.cashCollected) {
            return Promise.resolve({ _sum: { cashCollected: 1000 } });
        }
        if (args?._sum?.totalAmount) {
             return Promise.resolve({ _sum: { totalAmount: 1000 } });
        }
        return Promise.resolve({ _sum: {} });
    });

    mockDb.order.count.mockResolvedValue(10); // generic response

    // Live Trends
    mockDb.$queryRaw.mockResolvedValue([]);

    // Live Order Breakdown
    mockDb.order.groupBy.mockResolvedValue([]);

    // 3. Mock Promise.all queries

    // Customer/Driver counts
    mockDb.customerProfile.count.mockResolvedValue(5);
    mockDb.driverProfile.count.mockResolvedValue(2);

    // Previous period
    // aggregate, count already mocked above generically, but we can refine if needed.
    // For specific calls, we can use `mockImplementation` or rely on the order/args.
    // But `mockDeep` allows chaining.

    // ordersByStatus (used for calculation)
    mockDb.order.groupBy.mockImplementation((args: any) => {
        if (args.by.includes('status')) {
            return Promise.resolve([
                { status: OrderStatus.COMPLETED, _count: { id: 10 }, _sum: { totalAmount: 1000 } },
                { status: OrderStatus.PENDING, _count: { id: 5 }, _sum: { totalAmount: 0 } }
            ]);
        }
        if (args.by.includes('paymentMethod')) {
             // Strict check: Only return cashCollected if requested
             if (args?._sum?.cashCollected) {
                 return Promise.resolve([
                    { paymentMethod: PaymentMethod.CASH, _count: { id: 6 }, _sum: { cashCollected: 600 } },
                    { paymentMethod: PaymentMethod.TRANSFER, _count: { id: 4 }, _sum: { cashCollected: 400 } }
                ]);
             }
             return Promise.resolve([
                { paymentMethod: PaymentMethod.CASH, _count: { id: 6 }, _sum: {} },
                { paymentMethod: PaymentMethod.TRANSFER, _count: { id: 4 }, _sum: {} }
            ]);
        }
        // driverPerformance
        if (args.by.includes('driverId')) {
             return Promise.resolve([]);
        }
        // historicalDriverMetrics
        // customersByType
        if (args.by.includes('type')) {
             return Promise.resolve([]);
        }
        // topCustomers
        if (args.by.includes('customerId')) {
             return Promise.resolve([]);
        }
        return Promise.resolve([]);
    });

    // cashStats (The one we want to remove/derive)
    // We want to check if this is called.
    // In the original code, it is called via `db.order.aggregate`.
    // The query is: where: { ..., status: COMPLETED }, _sum: { cashCollected: true }

    // pendingHandovers
    // verifiedHandovers
    mockDb.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });

    // bottleStats
    mockDb.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } });

    // productInventory (The source for lowStockProducts)
    mockDb.product.findMany.mockImplementation((args: any) => {
        // logic to distinguish inventory vs lowStockProducts
        if (args?.where?.stockFilled?.lt === 20) {
             // This is lowStockProducts query
             return Promise.resolve([
                 { id: 'p1', name: 'Low Stock Item', stockFilled: 5, stockEmpty: 0 }
             ]);
        }
        // This is productInventory query (no where clause or different select)
        return Promise.resolve([
            { id: 'p1', name: 'Low Stock Item', stockFilled: 5, stockEmpty: 0, basePrice: 10 },
            { id: 'p2', name: 'High Stock Item', stockFilled: 50, stockEmpty: 0, basePrice: 10 }
        ]);
    });

    // customerProfile queries (newCustomers, etc)
    mockDb.customerProfile.groupBy.mockResolvedValue([]);
    mockDb.customerProfile.findMany.mockResolvedValue([]);
    mockDb.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });

    // expenses
    mockDb.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    // failedOrders
    mockDb.order.findMany.mockResolvedValue([]);

    // Call the function
    const result = await getComprehensiveDashboardData({
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-01T23:59:59Z')
    });

    // Assertions

    // Check if lowStockProducts is correct
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].name).toBe('Low Stock Item');

    // Check if cashStats is correct
    // Total cash collected should be sum of payment methods: 600 + 400 = 1000
    // Note: The original code fetched it separately.
    expect(result.cashManagement.totalCashCollected).toBe(1000);

    // Verify DB calls
    // We expect `product.findMany` to be called TWICE in the original code.
    // Once for inventory, once for low stock.
    // Note: mockDeep records all calls.
    const productFindManyCalls = mockDb.product.findMany.mock.calls;
    // console.log('productFindManyCalls', productFindManyCalls);

    // In unoptimized code, it should be called 2 times (inventory + lowStock) + maybe others?
    // Let's count calls with where: { stockFilled: { lt: 20 } }
    const lowStockCalls = productFindManyCalls.filter((call: any) => call[0]?.where?.stockFilled?.lt === 20);

    // We want to reduce this to 0 calls to DB for lowStockProducts
    // But currently (before opt), it should be >= 1.
    expect(lowStockCalls.length).toBe(0);

    // Check cashStats aggregation call
    // It calls `db.order.aggregate` with `_sum: { cashCollected: true }`
    const aggregateCalls = mockDb.order.aggregate.mock.calls;
    const cashStatsCalls = aggregateCalls.filter((call: any) => call[0]?._sum?.cashCollected === true);

    // In unoptimized code, it should be called.
    expect(cashStatsCalls.length).toBe(0);
  });
});
