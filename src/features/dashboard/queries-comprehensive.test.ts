import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatus } from '@prisma/client';

// Hoist the mock object creation so it can be used in vi.mock
const prismaMock = vi.hoisted(() => ({
    dailyStats: {
        findMany: vi.fn(),
    },
    order: {
        aggregate: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
    },
    customerProfile: {
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
    },
    driverProfile: {
        count: vi.fn(),
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
    expense: {
        aggregate: vi.fn(),
    },
    cashHandover: {
        aggregate: vi.fn(),
    },
    $queryRaw: vi.fn(),
}));

// Mock modules
vi.mock('@/lib/db', () => ({
    db: prismaMock,
}));

vi.mock('date-fns', () => ({
    differenceInDays: vi.fn(() => 1),
    format: vi.fn((d) => typeof d === 'string' ? d : d.toISOString()),
    subDays: vi.fn((d) => d),
    startOfDay: vi.fn((d) => d),
    endOfDay: vi.fn((d) => d),
    addDays: vi.fn((d) => d),
}));

vi.mock('@/lib/date-utils', () => ({
    toUtcStartOfDay: vi.fn((d) => d),
    toUtcEndOfDay: vi.fn((d) => d),
}));

import { getComprehensiveDashboardData } from './queries-comprehensive';

describe('getComprehensiveDashboardData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks to avoid crashes
        prismaMock.dailyStats.findMany.mockResolvedValue([]);
        prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 0, cashCollected: 0 } });
        prismaMock.order.count.mockResolvedValue(0);
        prismaMock.order.groupBy.mockResolvedValue([]);
        prismaMock.order.findMany.mockResolvedValue([]);
        prismaMock.customerProfile.count.mockResolvedValue(0);
        prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
        prismaMock.customerProfile.groupBy.mockResolvedValue([]);
        prismaMock.customerProfile.findMany.mockResolvedValue([]);
        prismaMock.driverProfile.count.mockResolvedValue(0);
        prismaMock.driverProfile.findMany.mockResolvedValue([]);
        prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
        prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: { filledGiven: 0, emptyTaken: 0, damagedReturned: 0, quantity: 0 } });
        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
        prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
        prismaMock.$queryRaw.mockResolvedValue([]);
    });

    it('should correctly calculate live stats from trends and status groups', async () => {
        // Setup dates to force "Live Only" or "Hybrid" mode that triggers the live block
        const startDate = new Date('2099-01-01'); // Future
        const endDate = new Date('2099-01-02');

        // Mock liveTrendRaw (Revenue and Completed Orders)
        prismaMock.$queryRaw.mockImplementation((query) => {
            const qStr = query.toString();

            if (qStr.includes('SUM("totalAmount") as revenue')) {
                     // This is liveTrendRaw
                     return Promise.resolve([
                        { date: '2099-01-01', revenue: 100, orders: 2 }, // 2 orders, 100 revenue
                        { date: '2099-01-02', revenue: 50, orders: 1 },  // 1 order, 50 revenue
                     ]);
            }
            if (qStr.includes('COUNT(*) as count, SUM("actualCash") as amount')) {
                     return Promise.resolve([{ count: 0, amount: 0 }]);
            }
            if (qStr.includes('r.name as "routeName"')) {
                     return Promise.resolve([]);
            }
            if (qStr.includes('DATE("scheduledDate") as date, status, COUNT(*) as count')) {
                    // This is liveOrderTrendRaw
                    return Promise.resolve([]);
            }

            return Promise.resolve([]);
        });

        // Mock statusGroups (Total Volume and Status breakdown)
        prismaMock.order.groupBy.mockImplementation((args) => {
            if (args.by && args.by.includes('status')) {
                // If it's the live breakdown (statusGroups) OR ordersByStatus (Promise.all)
                // We return counts that match our scenario
                return Promise.resolve([
                    { status: OrderStatus.COMPLETED, _count: { id: 3 }, _sum: { totalAmount: 150 } },
                    { status: OrderStatus.PENDING, _count: { id: 2 }, _sum: { totalAmount: 0 } },
                    { status: OrderStatus.CANCELLED, _count: { id: 1 }, _sum: { totalAmount: 0 } },
                ]);
            }
            return Promise.resolve([]);
        });

        // Mock the specific aggregates/counts we want to remove to verify they are called (or not)
        // Current implementation calls them.
        prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 150, cashCollected: 0 } }); // Match 150
        prismaMock.order.count.mockResolvedValue(6); // Total volume (3+2+1) for total count, or 3 for completed count.

        // Wait, current implementation calls `count` twice.
        // Once for COMPLETED (should return 3)
        // Once for ALL (should return 6)
        prismaMock.order.count.mockImplementation((args) => {
            if (args?.where?.status === OrderStatus.COMPLETED) {
                return Promise.resolve(3);
            }
            if (!args?.where?.status) {
                return Promise.resolve(6);
            }
            return Promise.resolve(0);
        });

        const result = await getComprehensiveDashboardData({ startDate, endDate });

        // Verify Overview
        expect(result.overview.realizedRevenue).toBe(150);
        expect(result.overview.completedOrders).toBe(3);
        expect(result.overview.totalOrders).toBe(6);
    });
});
