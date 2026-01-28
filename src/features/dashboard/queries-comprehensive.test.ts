import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { db } from '@/lib/db';

// Mock the db module
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return {
    db: mockDeep<PrismaClient>(),
  };
});

// Import the function under test (after mocking)
import { getComprehensiveDashboardData } from './queries-comprehensive';

const mockDb = db as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    mockReset(mockDb);

    // Default mocks to prevent crashes
    mockDb.customerProfile.count.mockResolvedValue(0);
    mockDb.driverProfile.count.mockResolvedValue(0);
    mockDb.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0, cashCollected: 0, filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 },
      _count: { id: 0 }
    } as any);
    mockDb.order.count.mockResolvedValue(0);
    mockDb.order.groupBy.mockResolvedValue([]);
    mockDb.order.findMany.mockResolvedValue([]);
    mockDb.$queryRaw.mockResolvedValue([]);
    mockDb.product.findMany.mockResolvedValue([]);
    mockDb.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
    mockDb.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } } as any);
    mockDb.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } } as any);
    mockDb.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
    mockDb.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } } as any);
    mockDb.customerProfile.groupBy.mockResolvedValue([]);
    mockDb.customerProfile.findMany.mockResolvedValue([]);
  });

  it('should calculate live stats correctly', async () => {
    // Setup - Live Only mode (Today)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    const today = new Date('2024-01-01T00:00:00Z');
    const endOfDay = new Date('2024-01-01T23:59:59Z');

    // Specific Mocks for Live Stats

    // 1. Live Revenue (aggregate) - Broad mock to verify connection
    mockDb.order.aggregate.mockResolvedValue({
        _sum: { totalAmount: 1000, cashCollected: 500 },
        _count: { id: 5 }
    } as any);

    // 2 & 3. Live Count Mocks via Implementation
    mockDb.order.count.mockImplementation(async (args: any) => {
        if (args?.where?.status === OrderStatus.COMPLETED) {
            return 5;
        }
        return 10;
    });

    // 4. Status Groups & OrdersByStatus (Mock via Implementation)
    mockDb.order.groupBy.mockImplementation(async (args: any) => {
        if (args?.by?.includes('status')) {
             return [
                { status: OrderStatus.COMPLETED, _count: { id: 5 }, _sum: { totalAmount: 1000 } },
                { status: OrderStatus.PENDING, _count: { id: 3 }, _sum: { totalAmount: 0 } },
                { status: OrderStatus.CANCELLED, _count: { id: 2 }, _sum: { totalAmount: 0 } },
              ];
        }
        return [];
    });

    // Execute
    const result = await getComprehensiveDashboardData({ startDate: today, endDate: endOfDay });

    // Assert
    expect(result.overview.realizedRevenue).toBe(1000);
    expect(result.overview.completedOrders).toBe(5);
    expect(result.overview.totalOrders).toBe(10);

    // Verify existing behavior (to be optimized)
    expect(mockDb.order.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: OrderStatus.COMPLETED })
    }));

    vi.useRealTimers();
  });
});
