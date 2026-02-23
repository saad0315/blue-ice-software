import { OrderStatus, PaymentMethod, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepMockProxy } from 'vitest-mock-extended';

import { db } from '@/lib/db';

import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock DB module
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return { db: mockDeep<PrismaClient>() };
});

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default mocks for array returns
    dbMock.dailyStats.findMany.mockResolvedValue([]);
    dbMock.order.groupBy.mockResolvedValue([]);
    dbMock.order.findMany.mockResolvedValue([]);
    dbMock.product.findMany.mockResolvedValue([]);
    dbMock.customerProfile.findMany.mockResolvedValue([]);
    dbMock.$queryRaw.mockResolvedValue([]);
    dbMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    dbMock.customerProfile.groupBy.mockResolvedValue([]);

    // Default mocks for aggregates
    dbMock.order.aggregate.mockResolvedValue({ _sum: {}, _count: {} } as any);
    dbMock.order.count.mockResolvedValue(0);
    dbMock.customerProfile.count.mockResolvedValue(0);
    dbMock.driverProfile.count.mockResolvedValue(0);
    dbMock.cashHandover.aggregate.mockResolvedValue({ _sum: {}, _count: {} } as any);
    dbMock.orderItem.aggregate.mockResolvedValue({ _sum: {} } as any);
    dbMock.expense.aggregate.mockResolvedValue({ _sum: {} } as any);
    dbMock.customerProfile.aggregate.mockResolvedValue({ _sum: {} } as any);
  });

  it('should execute without crashing and return default structure', async () => {
    const data = await getComprehensiveDashboardData();
    expect(data).toBeDefined();
    expect(data.overview).toBeDefined();
    expect(data.overview.realizedRevenue).toBe(0);
  });

  it('should correctly calculate totals from ordersByStatus', async () => {
    // Mock ordersByStatus response (Current Period)
    const ordersByStatusMock = [
      { status: OrderStatus.COMPLETED, _count: { id: 10 }, _sum: { totalAmount: 1000 } },
      { status: OrderStatus.PENDING, _count: { id: 5 }, _sum: { totalAmount: 500 } },
      { status: OrderStatus.CANCELLED, _count: { id: 2 }, _sum: { totalAmount: 200 } },
    ];

    dbMock.order.groupBy.mockImplementation(async (args: any) => {
      // If it's asking for paymentMethod
      if (args.by && args.by.includes('paymentMethod')) {
        return [{ paymentMethod: PaymentMethod.CASH, _count: { id: 5 }, _sum: { cashCollected: 300 } }] as any;
      }

      // Otherwise assume it's status breakdown
      return ordersByStatusMock as any;
    });

    const data = await getComprehensiveDashboardData();

    // With optimization, totalRevenue should come from ordersByStatus (COMPLETED)
    // 1000
    // Total Volume = 10 + 5 + 2 = 17
    // Completed Orders = 10

    expect(data.overview.realizedRevenue).toBe(1000);
    expect(data.overview.totalOrders).toBe(17);
    expect(data.overview.completedOrders).toBe(10);

    // Check Cash Stats derived from payment method
    // 300
    expect(data.cashManagement.totalCashCollected).toBe(300);
  });
});
