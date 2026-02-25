import { OrderStatus, PaymentMethod, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepMockProxy } from 'vitest-mock-extended';

// Import the mocked db to configure it
import { db } from '@/lib/db';

// Import the function under test
import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the DB module
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep<PrismaClient>(),
  };
});

describe('getComprehensiveDashboardData', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock = db as unknown as DeepMockProxy<PrismaClient>;

    // Default mock implementations for array-returning methods
    // We need to cast to any or use explicit typing because mockDeep uses Proxy
    // But for return values, we can just use mockResolvedValue([])

    // Arrays
    (prismaMock.dailyStats.findMany as any).mockResolvedValue([]);
    (prismaMock.order.groupBy as any).mockResolvedValue([]);
    (prismaMock.order.findMany as any).mockResolvedValue([]);
    (prismaMock.product.findMany as any).mockResolvedValue([]);
    (prismaMock.customerProfile.groupBy as any).mockResolvedValue([]);
    (prismaMock.customerProfile.findMany as any).mockResolvedValue([]);
    (prismaMock.driverProfile.findMany as any).mockResolvedValue([]);
    (prismaMock.driverPerformanceMetrics.groupBy as any).mockResolvedValue([]);

    // Aggregates / Counts
    (prismaMock.order.aggregate as any).mockResolvedValue({ _sum: { totalAmount: 0, cashCollected: 0 } });
    (prismaMock.order.count as any).mockResolvedValue(0);
    (prismaMock.customerProfile.count as any).mockResolvedValue(0);
    (prismaMock.driverProfile.count as any).mockResolvedValue(0);
    (prismaMock.expense.aggregate as any).mockResolvedValue({ _sum: { amount: 0 } });
    (prismaMock.customerProfile.aggregate as any).mockResolvedValue({ _sum: { cashBalance: 0 } });
    (prismaMock.cashHandover.aggregate as any).mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
    (prismaMock.orderItem.aggregate as any).mockResolvedValue({
      _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 },
    });

    // QueryRaw
    (prismaMock.$queryRaw as any).mockResolvedValue([]);
  });

  it('should run successfully with empty data', async () => {
    const result = await getComprehensiveDashboardData();

    expect(result).toBeDefined();
    expect(result.overview.realizedRevenue).toBe(0);

    // Verify base calls
    expect(prismaMock.product.findMany).toHaveBeenCalled(); // Inventory
  });

  it('should identify low stock products correctly', async () => {
    // Current behavior: queries low stock specifically
    // Expected behavior (after optimize): filters productInventory

    // Setup product inventory
    const products = [
      { id: 'p1', name: 'A', stockFilled: 10, stockEmpty: 0, basePrice: 100 }, // Low
      { id: 'p2', name: 'B', stockFilled: 50, stockEmpty: 0, basePrice: 100 }, // High
    ];

    // Mock for "Low Stock Query" (Before optimization)
    // The code calls findMany({ where: { stockFilled: { lt: 20 } } })
    (prismaMock.product.findMany as any).mockImplementation(async (args: any) => {
      if (args?.where?.stockFilled?.lt === 20) {
        return [products[0]];
      }
      // Return all for inventory query (no where clause or different select)
      return products;
    });

    // Debug groupBy calls
    (prismaMock.order.groupBy as any).mockImplementation(async (args: any) => {
      if (args?.by?.includes('status')) {
        return [
          { status: OrderStatus.COMPLETED, _count: { id: 10 }, _sum: { totalAmount: 1000 } },
          { status: OrderStatus.PENDING, _count: { id: 5 }, _sum: { totalAmount: 0 } },
        ];
      }
      if (args?.by?.includes('paymentMethod')) {
        return [{ paymentMethod: PaymentMethod.CASH, _count: { id: 8 }, _sum: { cashCollected: 800 } }];
      }
      return [];
    });

    const result = await getComprehensiveDashboardData();

    // Verify values based on ordersByStatus mock (1000), NOT liveRevenue aggregate mock (500)
    // This confirms we are using the optimized single-query approach
    expect(result.overview.realizedRevenue).toBe(1000);
    expect(result.overview.completedOrders).toBe(10);

    // Verify cash collected is derived from ordersByPaymentMethod
    expect(result.cashManagement.totalCashCollected).toBe(800);

    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].id).toBe('p1');

    // Verify optimization: findMany should be called for inventory, but NOT for low stock specifically
    expect(prismaMock.product.findMany).toHaveBeenCalled();

    // Check arguments of all calls to ensure none match the removed query
    const calls = (prismaMock.product.findMany as any).mock.calls;
    const lowStockCall = calls.find((args: any[]) => args[0]?.where?.stockFilled?.lt === 20);
    expect(lowStockCall).toBeUndefined();
  });
});
