import { beforeEach, describe, expect, it, vi } from 'vitest';

// 1. Create a container for the mock
const prismaMockContainer = vi.hoisted(() => {
    return {
        prisma: {
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
            order: {
                aggregate: vi.fn(),
                count: vi.fn(),
                groupBy: vi.fn(),
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

// 2. Mock the module
vi.mock('@/lib/db', () => ({
    db: prismaMockContainer.prisma
}));

// Mock date-fns because it is missing from package.json but used in the code
vi.mock('date-fns', () => ({
    differenceInDays: vi.fn(() => 1),
    format: vi.fn(() => 'Jan 01'),
    subDays: vi.fn((date) => date),
}));

// 3. Import SUT
import { getComprehensiveDashboardData } from './queries-comprehensive';

describe('Dashboard Queries', () => {
    let prismaMock: any;

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock = prismaMockContainer.prisma;

        // Setup default mock returns to avoid crashes
        prismaMock.customerProfile.count.mockResolvedValue(0);
        prismaMock.driverProfile.count.mockResolvedValue(0);
        prismaMock.order.aggregate.mockResolvedValue({ _sum: {}, _count: {} });
        prismaMock.order.count.mockResolvedValue(0);
        prismaMock.order.groupBy.mockResolvedValue([]);
        prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: {}, _count: {} });
        prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
        prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: {} });
        prismaMock.customerProfile.groupBy.mockResolvedValue([]);
        prismaMock.expense.aggregate.mockResolvedValue({ _sum: {} });
        prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: {} });
        prismaMock.order.findMany.mockResolvedValue([]);
        prismaMock.customerProfile.findMany.mockResolvedValue([]);
        prismaMock.$queryRaw.mockResolvedValue([]);

        // Product mock default
        prismaMock.product.findMany.mockResolvedValue([]);
    });

    it('should correctly identify low stock products', async () => {
        const allProducts = [
            { id: 'p1', name: 'Water', stockFilled: 100, stockEmpty: 50, basePrice: 10 },
            { id: 'p2', name: 'Juice', stockFilled: 5, stockEmpty: 0, basePrice: 15 }, // Low stock
            { id: 'p3', name: 'Soda', stockFilled: 19, stockEmpty: 10, basePrice: 12 }, // Low stock
        ];

        const lowStockProducts = [
            { id: 'p2', name: 'Juice', stockFilled: 5, stockEmpty: 0, basePrice: 15 },
            { id: 'p3', name: 'Soda', stockFilled: 19, stockEmpty: 10, basePrice: 12 },
        ];

        // Mock implementation to differentiate calls
        prismaMock.product.findMany.mockImplementation((args: any) => {
            // Check if it's the low stock query
            if (args?.where?.stockFilled?.lt === 20) {
                return Promise.resolve(lowStockProducts);
            }
            // Otherwise assume it's the all products query
            return Promise.resolve(allProducts);
        });

        const result = await getComprehensiveDashboardData();

        expect(result.inventory).toHaveLength(3);
        expect(result.alerts.lowStockProducts).toHaveLength(2);

        // Verify IDs match
        const alertIds = result.alerts.lowStockProducts.map((p: any) => p.id).sort();
        expect(alertIds).toEqual(['p2', 'p3']);

        // AFTER OPTIMIZATION: Should be called once
        expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);
    });
});
