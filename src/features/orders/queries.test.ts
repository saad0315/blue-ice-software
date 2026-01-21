
import { OrderStatus, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create mocked Prisma Client
const prismaMockContainer = vi.hoisted(() => {
    return {
        prisma: {
            order: {
                findUnique: vi.fn(),
                findMany: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
            },
            product: {
                findMany: vi.fn(),
                findUnique: vi.fn(),
            },
            customerProfile: {
                findUnique: vi.fn(),
            },
            $transaction: vi.fn((callback) => callback(prismaMockContainer.prisma)),
        }
    };
});

// Mock Prisma Module
vi.mock('@/lib/db', () => ({
    db: prismaMockContainer.prisma
}));

// Mock Socket Emitter
vi.mock('@/lib/socket-emitter', () => ({
    emitOrderStatus: vi.fn(),
}));

// Mock Firebase
vi.mock('@/lib/firebase-admin', () => ({
    sendPushNotification: vi.fn(),
}));

import { createOrder } from './queries';

describe('Order Creation Logic', () => {
    let prismaMock: any;

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock = prismaMockContainer.prisma;
    });

    it('should calculate total amount correctly', async () => {
        // Setup data
        const customerId = 'cust-1';
        const items = [
            { productId: 'p1', quantity: 2 }, // 2 * 100 = 200
            { productId: 'p2', quantity: 1 }  // 1 * 50 = 50
        ];

        // Mock Products
        prismaMock.product.findMany.mockResolvedValue([
            { id: 'p1', basePrice: new Prisma.Decimal(100) },
            { id: 'p2', basePrice: new Prisma.Decimal(50) }
        ]);

        // Mock Customer (No special prices)
        prismaMock.customerProfile.findUnique.mockResolvedValue({
            id: customerId,
            specialPrices: [],
            route: { defaultDriverId: 'd1' }
        });

        // Mock existing check
        prismaMock.order.findFirst.mockResolvedValue(null);

        // Mock Create return
        prismaMock.order.create.mockImplementation((args: any) => ({
            ...args.data,
        }));

        const result = await createOrder({
            customerId,
            scheduledDate: new Date(),
            status: OrderStatus.SCHEDULED,
            deliveryCharge: 20,
            discount: 10,
            items
        });

        // Expected Total: (200 + 50) + 20 - 10 = 260
        expect(result.totalAmount.toNumber()).toBe(260);
        expect(result.driverId).toBe('d1'); // Auto assigned from route
    });

    it('should use special prices if available', async () => {
        const customerId = 'cust-1';
        const items = [{ productId: 'p1', quantity: 2 }]; // 2 * 80 (Special) = 160

        prismaMock.product.findMany.mockResolvedValue([
            { id: 'p1', basePrice: new Prisma.Decimal(100) }
        ]);

        prismaMock.customerProfile.findUnique.mockResolvedValue({
            id: customerId,
            specialPrices: [
                { productId: 'p1', customPrice: new Prisma.Decimal(80) }
            ],
            route: null
        });

        prismaMock.order.findFirst.mockResolvedValue(null);
        prismaMock.order.create.mockImplementation((args: any) => args.data);

        const result = await createOrder({
            customerId,
            scheduledDate: new Date(),
            status: OrderStatus.SCHEDULED,
            deliveryCharge: 0,
            discount: 0,
            items
        });

        expect(result.totalAmount.toNumber()).toBe(160);
    });

    it('should throw error if order with same items exists', async () => {
        const items = [{ productId: 'p1', quantity: 1 }];

        prismaMock.order.findFirst.mockResolvedValue({
            readableId: 1001,
            orderItems: [
                { productId: 'p1', quantity: 1 }
            ]
        });

        await expect(createOrder({
            customerId: 'c1',
            scheduledDate: new Date(),
            status: OrderStatus.SCHEDULED,
            deliveryCharge: 0,
            discount: 0,
            items
        })).rejects.toThrow('already exists');
    });
});
