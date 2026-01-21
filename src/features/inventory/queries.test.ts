
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

// 1. Create a container for the mock
const prismaMockContainer = vi.hoisted(() => {
    return {
        prisma: {
            product: {
                findUnique: vi.fn(),
                update: vi.fn(),
                findMany: vi.fn(),
            },
            customerBottleWallet: {
                groupBy: vi.fn(),
                findMany: vi.fn(),
            }
        }
    };
});

// 2. Mock the module
vi.mock('@/lib/db', () => ({
    db: prismaMockContainer.prisma
}));

// 3. Import SUT
import {
    adjustStock,
    getInventoryStats,
    recordDamageOrLoss,
    refillBottles,
    restockProduct
} from './queries';

describe('Inventory Logic', () => {
    let prismaMock: any;

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock = prismaMockContainer.prisma;
    });

    describe('restockProduct', () => {
        it('should add filled and empty stock', async () => {
            const mockProduct = { id: 'p1', name: 'Water', stockFilled: 10, stockEmpty: 5 };

            prismaMock.product.findUnique.mockResolvedValue(mockProduct);
            prismaMock.product.update.mockResolvedValue({
                ...mockProduct,
                stockFilled: 10 + 50,
                stockEmpty: 5 + 20
            });

            await restockProduct({
                productId: 'p1',
                filledQuantity: 50,
                emptyQuantity: 20
            });

            expect(prismaMock.product.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: {
                    stockFilled: 60, // 10 + 50
                    stockEmpty: 25   // 5 + 20
                }
            });
        });

        it('should throw error if product not found', async () => {
            prismaMock.product.findUnique.mockResolvedValue(null);
            await expect(restockProduct({ productId: 'bad-id', filledQuantity: 1, emptyQuantity: 1 }))
                .rejects.toThrow('Product not found');
        });
    });

    describe('refillBottles', () => {
        it('should move empty to filled', async () => {
            const mockProduct = { id: 'p1', name: 'Water', stockFilled: 10, stockEmpty: 100 };

            prismaMock.product.findUnique.mockResolvedValue(mockProduct);
            prismaMock.product.update.mockResolvedValue({ ...mockProduct });

            await refillBottles({ productId: 'p1', quantity: 20 });

            expect(prismaMock.product.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: {
                    stockFilled: 30, // 10 + 20
                    stockEmpty: 80   // 100 - 20
                }
            });
        });

        it('should throw error if insufficient empty bottles', async () => {
            const mockProduct = { id: 'p1', name: 'Water', stockFilled: 10, stockEmpty: 5 };

            prismaMock.product.findUnique.mockResolvedValue(mockProduct);

            await expect(refillBottles({ productId: 'p1', quantity: 10 }))
                .rejects.toThrow('Insufficient empty bottles');
        });
    });

    describe('recordDamageOrLoss', () => {
        const mockProduct = {
            id: 'p1',
            name: 'Water',
            stockFilled: 100,
            stockEmpty: 50,
            stockDamaged: 0
        };

        it('should move filled to damaged when type is DAMAGE', async () => {
            prismaMock.product.findUnique.mockResolvedValue(mockProduct);

            await recordDamageOrLoss({
                productId: 'p1',
                quantity: 5,
                type: 'DAMAGE',
                reason: 'Fell from truck'
            });

            expect(prismaMock.product.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: {
                    stockFilled: 95, // 100 - 5
                    stockDamaged: 5  // 0 + 5
                }
            });
        });

        it('should remove filled stock when type is LOSS', async () => {
            prismaMock.product.findUnique.mockResolvedValue(mockProduct);

            await recordDamageOrLoss({
                productId: 'p1',
                quantity: 5,
                type: 'LOSS',
                reason: 'Stolen'
            });

            expect(prismaMock.product.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: {
                    stockFilled: 95 // 100 - 5
                    // stockDamaged should NOT change
                }
            });
        });

        it('should throw error if insufficient filled stock', async () => {
            prismaMock.product.findUnique.mockResolvedValue({ ...mockProduct, stockFilled: 2 });

            await expect(recordDamageOrLoss({
                productId: 'p1',
                quantity: 5,
                type: 'DAMAGE',
                reason: 'Ouch'
            })).rejects.toThrow('Insufficient filled stock');
        });
    });

    describe('getInventoryStats', () => {
        it('should aggregate stats correctly', async () => {
            const products = [
                { id: 'p1', name: 'Water', stockFilled: 100, stockEmpty: 50, stockDamaged: 5, isReturnable: true },
                { id: 'p2', name: 'Dispenser', stockFilled: 20, stockEmpty: 0, stockDamaged: 0, isReturnable: false },
            ];

            const bottleWallets = [
                { productId: 'p1', _sum: { balance: 30 } }, // 30 bottles with customers
            ];

            prismaMock.product.findMany.mockResolvedValue(products);
            prismaMock.customerBottleWallet.groupBy.mockResolvedValue(bottleWallets);

            const result = await getInventoryStats();

            // Check Product P1
            const p1 = result.products.find(p => p.id === 'p1');
            expect(p1?.bottlesWithCustomers).toBe(30);
            // Total = 100 Filled + 50 Empty + 5 Damaged + 30 Customer
            expect(p1?.totalBottles).toBe(185);

            // Check Product P2
            const p2 = result.products.find(p => p.id === 'p2');
            expect(p2?.bottlesWithCustomers).toBe(0);
            expect(p2?.totalBottles).toBe(20);

            // Check Totals
            expect(result.totals.filled).toBe(120);
            expect(result.totals.withCustomers).toBe(30);
        });
    });
});
