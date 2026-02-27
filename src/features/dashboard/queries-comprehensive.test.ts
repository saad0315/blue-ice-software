
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { OrderStatus, PaymentMethod } from '@prisma/client';

// 1. Create a container for the mock
const prismaMockContainer = vi.hoisted(() => {
    return {
        prisma: {
            customerProfile: { count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
            driverProfile: { count: vi.fn(), findMany: vi.fn() },
            order: { aggregate: vi.fn(), count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
            cashHandover: { aggregate: vi.fn() },
            driverPerformanceMetrics: { groupBy: vi.fn() },
            orderItem: { aggregate: vi.fn() },
            product: { findMany: vi.fn() },
            expense: { aggregate: vi.fn() },
            dailyStats: { findMany: vi.fn() },
            $queryRaw: vi.fn()
        }
    };
});

// 2. Mock the module
vi.mock('@/lib/db', () => ({
    db: prismaMockContainer.prisma
}));

// 3. Import SUT
import { getComprehensiveDashboardData } from './queries-comprehensive';

describe('getComprehensiveDashboardData', () => {
    let prismaMock: any;

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock = prismaMockContainer.prisma;
    });

    it('should calculate cash stats and low stock correctly', async () => {
        // --- MOCK DATA ---

        // 1. Basic Counts
        prismaMock.customerProfile.count.mockResolvedValue(100);
        prismaMock.driverProfile.count.mockResolvedValue(5);
        prismaMock.order.count.mockResolvedValue(50); // General count

        // 2. Aggregates (Revenue, Cash)
        prismaMock.order.aggregate.mockImplementation((args: any) => {
            if (args._sum?.totalAmount) return Promise.resolve({ _sum: { totalAmount: 10000 } });
            // Optimization verification: We expect this NOT to be called for cashStats anymore
            if (args._sum?.cashCollected) return Promise.resolve({ _sum: { cashCollected: 5000 } });
            return Promise.resolve({ _sum: {} });
        });

        // 3. GroupBy (Status & Payment)
        prismaMock.order.groupBy.mockImplementation((args: any) => {
            if (args.by.includes('status')) {
                return Promise.resolve([
                    { status: OrderStatus.COMPLETED, _count: { id: 20 }, _sum: { totalAmount: 5000 } }
                ]);
            }
            if (args.by.includes('paymentMethod')) {
                return Promise.resolve([
                    { paymentMethod: PaymentMethod.CASH, _count: { id: 10 }, _sum: { cashCollected: 5000 } }
                ]);
            }
            if (args.by.includes('driverId')) {
                return Promise.resolve([]);
            }
            if (args.by.includes('customerId')) {
                return Promise.resolve([]);
            }
            return Promise.resolve([]);
        });

        // 4. Products (Inventory)
        const mockProducts = [
            { id: 'p1', name: 'Water', stockFilled: 10, stockEmpty: 5, basePrice: 100 },  // Low Stock (<20)
            { id: 'p2', name: 'Dispenser', stockFilled: 50, stockEmpty: 0, basePrice: 500 } // Healthy Stock
        ];

        // We expect `findMany` to be called ONLY ONCE for products (the full inventory list)
        prismaMock.product.findMany.mockImplementation((args: any) => {
            // If called with specific filtering for low stock (redundant call), we'd return p1
            if (args?.where?.stockFilled?.lt === 20) {
                 return Promise.resolve([mockProducts[0]]);
            }
            return Promise.resolve(mockProducts);
        });

        // 5. Other specialized queries
        prismaMock.$queryRaw.mockResolvedValue([]); // For trends
        prismaMock.cashHandover.aggregate.mockResolvedValue({ _sum: { actualCash: 0 }, _count: { id: 0 } });
        prismaMock.orderItem.aggregate.mockResolvedValue({ _sum: {} });
        prismaMock.customerProfile.groupBy.mockResolvedValue([]);
        prismaMock.customerProfile.aggregate.mockResolvedValue({ _sum: { cashBalance: 0 } });
        prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
        prismaMock.driverPerformanceMetrics.groupBy.mockResolvedValue([]);
        prismaMock.customerProfile.findMany.mockResolvedValue([]);
        prismaMock.order.findMany.mockResolvedValue([]);

        // --- EXECUTION ---
        const result = await getComprehensiveDashboardData();

        // --- VERIFICATION ---

        // 1. Data Correctness (Regression Testing)

        // Cash Management: Should match the sum from paymentMethod groupBy (5000)
        expect(result.cashManagement.totalCashCollected).toBe(5000);

        // Low Stock: Should contain only p1
        expect(result.alerts.lowStockProducts).toHaveLength(1);
        expect(result.alerts.lowStockProducts[0].name).toBe('Water');

        // 2. Optimization Verification (Ensuring Calls were Removed)

        // Ensure we did NOT call `aggregate` for `cashCollected` specifically
        expect(prismaMock.order.aggregate).not.toHaveBeenCalledWith(
            expect.objectContaining({
                _sum: { cashCollected: true }
            })
        );

        // Ensure we did NOT call `findMany` with the specific low-stock filter
        expect(prismaMock.product.findMany).not.toHaveBeenCalledWith(
            expect.objectContaining({
                where: { stockFilled: { lt: 20 } }
            })
        );

        // Ensure product.findMany was called exactly once (for the full list)
        expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);
    });
});
