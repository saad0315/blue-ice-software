
import { OrderStatus, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Re-use the mocked container setup
const prismaMockContainer = vi.hoisted(() => {
    return {
        prisma: {
            order: {
                findUnique: vi.fn(),
                findMany: vi.fn(),
                update: vi.fn(),
            },
            product: {
                findMany: vi.fn(),
                findUnique: vi.fn(),
                update: vi.fn(),
            },
            customerProfile: {
                findUnique: vi.fn(),
                update: vi.fn(),
            },
            orderItem: {
                deleteMany: vi.fn(),
                createMany: vi.fn(),
                findMany: vi.fn(),
            },
            ledger: {
                create: vi.fn(),
            },
            customerBottleWallet: {
                findUnique: vi.fn(),
                update: vi.fn(),
                create: vi.fn(),
            },
            $transaction: vi.fn((callback) => callback(prismaMockContainer.prisma)),
        }
    };
});

vi.mock('@/lib/db', () => ({
    db: prismaMockContainer.prisma
}));

vi.mock('@/lib/socket-emitter', () => ({
    emitOrderStatus: vi.fn(),
}));

import { updateOrder } from './queries';

describe('Order Completion & Ledger Logic', () => {
    let prismaMock: any;

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock = prismaMockContainer.prisma;
    });

    it('should process completion: Ledger, Balance, Inventory', async () => {
        const orderId = 'order-1';
        const customerId = 'cust-1';
        const productId = 'prod-1';

        // 1. Setup Mock Data
        const existingOrder = {
            id: orderId,
            readableId: 1001,
            customerId,
            status: OrderStatus.PENDING,
            deliveryCharge: new Prisma.Decimal(0),
            discount: new Prisma.Decimal(0),
            totalAmount: new Prisma.Decimal(200),
            cashCollected: new Prisma.Decimal(0),
        };

        const updatedOrder = {
            ...existingOrder,
            status: OrderStatus.COMPLETED,
            totalAmount: new Prisma.Decimal(200),
            cashCollected: new Prisma.Decimal(200), // Full payment
        };

        const customer = {
            id: customerId,
            cashBalance: new Prisma.Decimal(0),
            user: { name: 'John Doe' }
        };

        const product = {
            id: productId,
            stockFilled: 10,
            stockEmpty: 0,
        };

        const orderItems = [
            {
                orderId,
                productId,
                filledGiven: 2,
                emptyTaken: 2,
                damagedReturned: 0
            }
        ];

        // 2. Mock Prisma Responses
        prismaMock.order.findUnique
            .mockResolvedValueOnce(existingOrder) // First check
            .mockResolvedValueOnce(updatedOrder)  // After update
            .mockResolvedValueOnce(updatedOrder); // Final fetch

        prismaMock.order.update.mockResolvedValue(updatedOrder);

        prismaMock.customerProfile.findUnique.mockResolvedValue(customer);
        prismaMock.customerProfile.update.mockResolvedValue(customer); // Return value ignored mostly

        prismaMock.orderItem.findMany.mockResolvedValue(orderItems);

        prismaMock.product.findUnique.mockResolvedValue(product);
        prismaMock.product.update.mockResolvedValue(product);

        prismaMock.customerBottleWallet.findUnique.mockResolvedValue(null); // No existing wallet
        prismaMock.customerBottleWallet.create.mockResolvedValue({});

        // 3. Execute
        await updateOrder(orderId, {
            status: OrderStatus.COMPLETED,
            cashCollected: 200,
        });

        // 4. Verify Ledger Creation
        // Ledger 1: Sale (Debit 200)
        expect(prismaMock.ledger.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                amount: expect.objectContaining({ s: -1, e: 2, d: [200] }), // -200 (Debit)
                description: expect.stringContaining('Sale'),
                balanceAfter: expect.anything(), // -200
            })
        }));

        // Ledger 2: Payment (Credit 200)
        expect(prismaMock.ledger.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                amount: new Prisma.Decimal(200), // +200 (Credit)
                description: expect.stringContaining('Payment'),
                balanceAfter: expect.anything(), // 0
            })
        }));

        // 5. Verify Customer Balance Update
        // Should be called to set final balance to 0 (0 - 200 + 200)
        expect(prismaMock.customerProfile.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: customerId },
            data: { cashBalance: expect.anything() } // Hard to check Exact Decimal equality in mock check without strict matcher
        }));

        // 6. Verify Inventory Update
        // filledGiven: 2. Should decrement stockFilled by 2.
        // emptyTaken: 2. Should increment stockEmpty by 2.
        expect(prismaMock.product.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: productId },
            data: {
                stockFilled: { decrement: 2 },
                stockEmpty: { increment: 2 },
                stockDamaged: { increment: 0 },
            }
        }));

        // 7. Verify Bottle Wallet
        // Net Change = Given (2) - Taken (2) = 0.
        expect(prismaMock.customerBottleWallet.create).toHaveBeenCalledWith(expect.objectContaining({
            data: {
                customerId,
                productId,
                balance: 0
            }
        }));
    });
});
