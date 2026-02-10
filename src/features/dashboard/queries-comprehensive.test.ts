import { CashHandoverStatus, ExpenseStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getComprehensiveDashboardData } from './queries-comprehensive';

// Create mocked Prisma Client
const prismaMockContainer = vi.hoisted(() => {
    return {
        prisma: {
            dailyStats: {
                findMany: vi.fn(),
            },
            order: {
                findMany: vi.fn(),
                aggregate: vi.fn(),
                groupBy: vi.fn(),
                count: vi.fn(),
            },
            customerProfile: {
                findMany: vi.fn(),
                count: vi.fn(),
                aggregate: vi.fn(),
                groupBy: vi.fn(),
            },
            driverProfile: {
                count: vi.fn(),
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
        }
    };
});

// Mock Prisma Module
vi.mock('@/lib/db', () => ({
    db: prismaMockContainer.prisma
}));

// Mock date-utils
vi.mock('@/lib/date-utils', () => ({
    toUtcStartOfDay: (d: Date) => d,
    toUtcEndOfDay: (d: Date) => d,
}));

describe('Comprehensive Dashboard Queries', () => {
    let prismaMock: any;

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock = prismaMockContainer.prisma;

        // Default mock implementations to return safe empty values
        prismaMock.dailyStats.findMany.mockResolvedValue([]);
        prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 0, cashCollected: 0 } });
        prismaMock.order.count.mockResolvedValue(0);
        prismaMock.order.groupBy.mockResolvedValue([]);
        prismaMock.customerProfile.count.mockResolvedValue(0);
        prismaMock.driverProfile.count.mockResolvedValue(0);
        prismaMock.customerProfile.groupBy.mockResolvedValue([]);
        prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
        prismaMock.customerProfile.findMany.mockResolvedValue([]);
        prismaMock.$queryRaw.mockResolvedValue([]);
        prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
        prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
        prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } });
        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
        prismaMock.order.findMany.mockResolvedValue([]);
        prismaMock.driverProfile.findMany.mockResolvedValue([]);
    });

    it('should fetch dashboard data and identify redundant calls', async () => {
        // Setup data to trigger historical + live path
        const startDate = new Date('2023-10-01');
        const endDate = new Date('2023-10-31');

        // Mock dailyStats for historical
        prismaMock.dailyStats.findMany.mockResolvedValue([
            {
                date: new Date('2023-10-01'),
                totalRevenue: 1000,
                ordersCompleted: 10,
                ordersPending: 2,
                ordersCancelled: 1,
                ordersRescheduled: 0,
            }
        ]);

        // Mock Product Inventory
        prismaMock.product.findMany.mockResolvedValue([
            { id: 'p1', name: 'Product 1', stockFilled: 100, stockEmpty: 50, basePrice: 10 },
            { id: 'p2', name: 'Product 2', stockFilled: 5, stockEmpty: 10, basePrice: 20 }, // Low stock
        ]);

        const result = await getComprehensiveDashboardData({ startDate, endDate });

        // Check DailyStats calls
        // Optimized: Should be called ONCE
        expect(prismaMock.dailyStats.findMany).toHaveBeenCalledTimes(1);

        // Check Product calls
        // Optimized: Should be called ONCE
        expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);

        // Check Order Aggregate calls
        // Should be called ONCE (for prevRevenue only)
        // liveRevenue and cashStats are now derived or calc from trend
        expect(prismaMock.order.aggregate).toHaveBeenCalledTimes(1);

        // Verify low stock products are correctly filtered from inventory
        expect(result.alerts.lowStockProducts).toHaveLength(1);
        expect(result.alerts.lowStockProducts[0].id).toBe('p2');
    });
});
