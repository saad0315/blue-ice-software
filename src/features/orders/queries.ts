import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/firebase-admin';

export async function getOrders(params: {
  search?: string;
  status?: OrderStatus;
  customerId?: string;
  driverId?: string;
  date?: string;
  from?: string;
  to?: string;
  routeId?: string;
  page: number;
  limit: number;
}) {
  const { search, status, customerId, driverId, date, from, to, routeId, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    AND: [
      search
        ? {
          OR: [
            { customer: { user: { name: { contains: search, mode: 'insensitive' } } } },
            { readableId: { equals: parseInt(search) || -1 } },
          ],
        }
        : {},
      status ? { status } : {},
      customerId ? { customerId } : {},
      driverId ? (driverId === 'unassigned' ? { driverId: null } : { driverId }) : {},
      routeId ? { customer: { routeId } } : {},
      date ? { scheduledDate: { equals: new Date(date) } } : {},
      from && to ? { scheduledDate: { gte: new Date(from), lte: new Date(to) } } : {},
    ],
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            address: true,
            area: true,
            landmark: true,
            floorNumber: true,
            hasLift: true,
            geoLat: true,
            geoLng: true,
            sequenceOrder: true,
            cashBalance: true,
            creditLimit: true,
            deliveryInstructions: true,
            preferredDeliveryTime: true,
            specialNotes: true,
            user: {
              select: {
                name: true,
                phoneNumber: true,
              },
            },
            route: {
              select: {
                name: true,
              },
            },
          },
        },
        driver: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                isReturnable: true,
              },
            },
          },
        },
      },
      orderBy:
        driverId && driverId !== 'unassigned'
          ? [{ customer: { sequenceOrder: 'asc' } }, { scheduledDate: 'asc' }]
          : { scheduledDate: 'desc' },
    }),
    db.order.count({ where }),
  ]);

  // console.log('Orders fetchedssssss:', orders.length)
  return {
    orders,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getOrder(id: string) {
  return await db.order.findUnique({
    where: { id },
    include: {
      customer: {
        // include: {
        //   user: true,
        //   route: true,
        // },
        select: {
          id: true,
          user: true,
          route: true,
          address: true,
          area: true,
          landmark: true,
          floorNumber: true,
          hasLift: true,
          geoLat: true,
          geoLng: true,
          sequenceOrder: true,
          cashBalance: true,
          creditLimit: true,
          deliveryInstructions: true,
          preferredDeliveryTime: true,
          specialNotes: true,
        },
      },
      driver: {
        include: {
          user: true,
        },
      },
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function getOrderForInvoice(id: string) {
  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          user: true,
          route: true,
        },
      },
      driver: {
        include: {
          user: true,
        },
      },
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  // Fetch last 4 completed deliveries for mini statement (excluding current order)
  const lastDeliveries = await db.order.findMany({
    where: {
      customerId: order.customerId,
      status: 'COMPLETED',
      id: { not: id }, // Exclude current order
    },
    take: 4,
    orderBy: {
      deliveredAt: 'desc',
    },
    select: {
      id: true,
      readableId: true,
      deliveredAt: true,
      totalAmount: true,
      orderItems: {
        select: {
          quantity: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Calculate previous balance (before this order)
  // If order is completed, we need to look at ledger before this order
  // Otherwise, current cashBalance is the balance before this order
  const customer = order.customer;
  let previousBalance = customer.cashBalance;

  if (order.status === 'COMPLETED') {
    // Find the ledger entry for this order's sale
    const orderLedger = await db.ledger.findFirst({
      where: {
        customerId: order.customerId,
        referenceId: order.id,
        description: { contains: 'Sale' },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (orderLedger) {
      // Previous balance = balanceAfter + orderAmount - payment
      previousBalance = orderLedger.balanceAfter.add(order.totalAmount).sub(order.cashCollected);
    }
  }

  return {
    order,
    lastDeliveries,
    previousBalance,
  };
}

export async function generateOrders(data: { date: string; routeId?: string }) {
  const { date, routeId } = data;
  const scheduledDate = new Date(date);
  const dayOfWeek = scheduledDate.getDay();

  // 1. Find matching customers
  const where: Prisma.CustomerProfileWhereInput = {
    user: {
      isActive: true,
      suspended: false,
    },
    deliveryDays: {
      has: dayOfWeek,
    },
    defaultProductId: {
      not: null,
    },
    ...(routeId ? { routeId } : {}),
  };

  const customers = await db.customerProfile.findMany({
    where,
    select: {
      id: true,
      defaultProductId: true,
      defaultQuantity: true,
      routeId: true,
      cashBalance: true,
      creditLimit: true,
    },
  });

  if (customers.length === 0) {
    return { count: 0, message: 'No matching customers found' };
  }

  // 2. Filter out customers who already have an order for this date
  const existingOrders = await db.order.findMany({
    where: {
      scheduledDate: scheduledDate,
      customerId: { in: customers.map((c) => c.id) },
    },
    select: { customerId: true },
  });

  const existingCustomerIds = new Set(existingOrders.map((o) => o.customerId));
  const eligibleCustomers = customers.filter((c) => !existingCustomerIds.has(c.id));

  if (eligibleCustomers.length === 0) {
    return { count: 0, message: 'Orders already exist for all matching customers' };
  }

  // 3. Fetch Product Prices and check stock availability
  const productIds = Array.from(new Set(eligibleCustomers.map((c) => c.defaultProductId!)));
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, basePrice: true, stockFilled: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // 4. Calculate total stock needed per product
  const stockNeeded = new Map<string, number>();
  for (const customer of eligibleCustomers) {
    const productId = customer.defaultProductId!;
    const currentNeed = stockNeeded.get(productId) || 0;
    stockNeeded.set(productId, currentNeed + customer.defaultQuantity);
  }

  // 5. Validate stock availability
  const insufficientStock: string[] = [];
  for (const [productId, needed] of Array.from(stockNeeded.entries())) {
    const product = productMap.get(productId);
    if (!product || product.stockFilled < needed) {
      insufficientStock.push(productId);
    }
  }

  if (insufficientStock.length > 0) {
    return {
      count: 0,
      message: `Insufficient stock for products. Cannot generate orders.`,
      insufficientStock,
    };
  }

  // 6. Filter customers by credit limit
  const customersToCreate = eligibleCustomers.filter((c) => {
    const product = productMap.get(c.defaultProductId!);
    if (!product) return false;

    const orderAmount = product.basePrice.mul(c.defaultQuantity);
    const newBalance = c.cashBalance.sub(orderAmount);

    return newBalance.gte(c.creditLimit.neg());
  });

  const skippedDueToCredit = eligibleCustomers.length - customersToCreate.length;

  if (customersToCreate.length === 0) {
    return {
      count: 0,
      message: `All ${skippedDueToCredit} eligible customers have reached their credit limit`,
    };
  }

  // 7. Create Orders in batches to avoid transaction timeout
  const BATCH_SIZE = 50;
  let createdCount = 0;

  for (let i = 0; i < customersToCreate.length; i += BATCH_SIZE) {
    const batch = customersToCreate.slice(i, i + BATCH_SIZE);

    await db.$transaction(
      async (tx) => {
        // Re-check for duplicates within this batch
        const batchCustomerIds = batch.map((c) => c.id);
        const existingInBatch = await tx.order.findMany({
          where: {
            scheduledDate: scheduledDate,
            customerId: { in: batchCustomerIds },
          },
          select: { customerId: true },
        });

        const existingInBatchIds = new Set(existingInBatch.map((o) => o.customerId));

        for (const customer of batch) {
          if (existingInBatchIds.has(customer.id)) continue;

          const product = productMap.get(customer.defaultProductId!);
          if (!product) continue;

          const price = product.basePrice;
          const quantity = customer.defaultQuantity;
          const totalAmount = price.mul(quantity);

          await tx.order.create({
            data: {
              customerId: customer.id,
              scheduledDate: scheduledDate,
              status: OrderStatus.SCHEDULED,
              totalAmount: totalAmount,
              orderItems: {
                create: {
                  productId: product.id,
                  quantity: quantity,
                  priceAtTime: price,
                },
              },
            },
          });
          createdCount++;
        }
      },
      {
        maxWait: 10000, // 10s
        timeout: 30000, // 30s per batch
      },
    );
  }

  const message =
    skippedDueToCredit > 0
      ? `Successfully created ${createdCount} orders. ${skippedDueToCredit} customers skipped due to credit limit.`
      : `Successfully created ${createdCount} orders`;

  return { count: createdCount, message };
}

// Types for streaming response
export type GenerateOrdersProgress = {
  type: 'progress' | 'complete' | 'error';
  current?: number;
  total?: number;
  created?: number;
  message?: string;
  skippedDueToCredit?: number;
};

// Streaming version for real-time progress updates
export async function* generateOrdersStream(data: { date: string; routeId?: string }): AsyncGenerator<GenerateOrdersProgress> {
  const { date, routeId } = data;
  const scheduledDate = new Date(date);
  const dayOfWeek = scheduledDate.getDay();

  // 1. Find matching customers
  const where: Prisma.CustomerProfileWhereInput = {
    user: {
      isActive: true,
      suspended: false,
    },
    deliveryDays: {
      has: dayOfWeek,
    },
    defaultProductId: {
      not: null,
    },
    ...(routeId ? { routeId } : {}),
  };

  const customers = await db.customerProfile.findMany({
    where,
    select: {
      id: true,
      defaultProductId: true,
      defaultQuantity: true,
      routeId: true,
      cashBalance: true,
      creditLimit: true,
    },
  });

  if (customers.length === 0) {
    yield { type: 'complete', created: 0, message: 'No matching customers found' };
    return;
  }

  // 2. Filter out customers who already have an order for this date
  const existingOrders = await db.order.findMany({
    where: {
      scheduledDate: scheduledDate,
      customerId: { in: customers.map((c) => c.id) },
    },
    select: { customerId: true },
  });

  const existingCustomerIds = new Set(existingOrders.map((o) => o.customerId));
  const eligibleCustomers = customers.filter((c) => !existingCustomerIds.has(c.id));

  if (eligibleCustomers.length === 0) {
    yield { type: 'complete', created: 0, message: 'Orders already exist for all matching customers' };
    return;
  }

  // 3. Fetch Products
  const productIds = Array.from(new Set(eligibleCustomers.map((c) => c.defaultProductId!)));
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, basePrice: true, stockFilled: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // 4. Calculate stock needed
  const stockNeeded = new Map<string, number>();
  for (const customer of eligibleCustomers) {
    const productId = customer.defaultProductId!;
    const currentNeed = stockNeeded.get(productId) || 0;
    stockNeeded.set(productId, currentNeed + customer.defaultQuantity);
  }

  // 5. Validate stock
  for (const [productId, needed] of Array.from(stockNeeded.entries())) {
    const product = productMap.get(productId);
    if (!product || product.stockFilled < needed) {
      yield { type: 'error', message: 'Insufficient stock for products. Cannot generate orders.' };
      return;
    }
  }

  // 6. Filter by credit limit
  const customersToCreate = eligibleCustomers.filter((c) => {
    const product = productMap.get(c.defaultProductId!);
    if (!product) return false;
    const orderAmount = product.basePrice.mul(c.defaultQuantity);
    const newBalance = c.cashBalance.sub(orderAmount);
    return newBalance.gte(c.creditLimit.neg());
  });

  const skippedDueToCredit = eligibleCustomers.length - customersToCreate.length;

  if (customersToCreate.length === 0) {
    yield { type: 'complete', created: 0, message: `All ${skippedDueToCredit} eligible customers have reached their credit limit` };
    return;
  }

  // 7. Create orders with progress updates
  const BATCH_SIZE = 10; // Smaller batches for more frequent progress updates
  let createdCount = 0;
  const total = customersToCreate.length;

  yield { type: 'progress', current: 0, total, created: 0 };

  for (let i = 0; i < customersToCreate.length; i += BATCH_SIZE) {
    const batch = customersToCreate.slice(i, i + BATCH_SIZE);

    try {
      await db.$transaction(
        async (tx) => {
          const batchCustomerIds = batch.map((c) => c.id);
          const existingInBatch = await tx.order.findMany({
            where: {
              scheduledDate: scheduledDate,
              customerId: { in: batchCustomerIds },
            },
            select: { customerId: true },
          });

          const existingInBatchIds = new Set(existingInBatch.map((o) => o.customerId));

          for (const customer of batch) {
            if (existingInBatchIds.has(customer.id)) continue;

            const product = productMap.get(customer.defaultProductId!);
            if (!product) continue;

            const price = product.basePrice;
            const quantity = customer.defaultQuantity;
            const totalAmount = price.mul(quantity);

            await tx.order.create({
              data: {
                customerId: customer.id,
                scheduledDate: scheduledDate,
                status: OrderStatus.SCHEDULED,
                totalAmount: totalAmount,
                orderItems: {
                  create: {
                    productId: product.id,
                    quantity: quantity,
                    priceAtTime: price,
                  },
                },
              },
            });
            createdCount++;
          }
        },
        {
          maxWait: 10000,
          timeout: 20000, // 20s per small batch
        },
      );

      yield { type: 'progress', current: Math.min(i + BATCH_SIZE, total), total, created: createdCount };
    } catch (error) {
      console.error('Batch error:', error);
      yield { type: 'error', message: `Error processing batch: ${error instanceof Error ? error.message : 'Unknown error'}` };
      return;
    }
  }

  const message =
    skippedDueToCredit > 0
      ? `Successfully created ${createdCount} orders. ${skippedDueToCredit} customers skipped due to credit limit.`
      : `Successfully created ${createdCount} orders`;

  yield { type: 'complete', created: createdCount, message, skippedDueToCredit };
}

export async function createOrder(data: {
  customerId: string;
  driverId?: string | null;
  scheduledDate: Date;
  status: OrderStatus;
  deliveryCharge: number;
  discount: number;
  items: { productId: string; quantity: number; price?: number }[];
}) {
  const { items, ...orderData } = data;

  // Calculate total
  // We need to fetch product prices if not provided
  const productIds = items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalAmount = new Prisma.Decimal(0);

  const orderItemsData = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);

    const price = item.price !== undefined ? new Prisma.Decimal(item.price) : product.basePrice;
    const amount = price.mul(item.quantity);
    totalAmount = totalAmount.add(amount);

    return {
      productId: item.productId,
      quantity: item.quantity,
      priceAtTime: price,
    };
  });

  // Add delivery charge, subtract discount
  totalAmount = totalAmount.add(new Prisma.Decimal(orderData.deliveryCharge)).sub(new Prisma.Decimal(orderData.discount));

  return await db.order.create({
    data: {
      ...orderData,
      deliveryCharge: new Prisma.Decimal(orderData.deliveryCharge),
      discount: new Prisma.Decimal(orderData.discount),
      totalAmount,
      orderItems: {
        create: orderItemsData,
      },
    },
    include: {
      orderItems: true,
    },
  });
}

export async function updateOrder(
  id: string,
  data: Partial<{
    customerId: string;
    driverId: string | null;
    scheduledDate: Date;
    status: OrderStatus;
    deliveryCharge: number;
    discount: number;
    deliveredAt: Date | null;
    cashCollected: number;
    paymentMethod: PaymentMethod;
    items: {
      id?: string;
      productId: string;
      quantity: number;
      price?: number;
      filledGiven?: number;
      emptyTaken?: number;
      damagedReturned?: number;
    }[];
  }>,
) {
  const { items, ...orderData } = data;

  return await db.$transaction(async (tx) => {
    // Fetch existing order to check status transition
    const existingOrder = await tx.order.findUnique({ where: { id } });
    if (!existingOrder) throw new Error('Order not found');

    // Update basic fields
    // Safety Check: Prevent Reverting COMPLETED orders
    if (
      existingOrder.status === OrderStatus.COMPLETED &&
      orderData.status &&
      orderData.status !== OrderStatus.COMPLETED
    ) {
      throw new Error(
        `Cannot revert a COMPLETED order #${existingOrder.readableId} to ${orderData.status}. This would corrupt financial ledgers. Please cancel and recreate if necessary, or ask an Admin to void the transaction.`,
      );
    }

    if (Object.keys(orderData).length > 0) {
      await tx.order.update({
        where: { id },
        data: {
          ...orderData,
          ...(orderData.deliveryCharge !== undefined && {
            deliveryCharge: new Prisma.Decimal(orderData.deliveryCharge),
          }),
          ...(orderData.discount !== undefined && {
            discount: new Prisma.Decimal(orderData.discount),
          }),
          ...(orderData.cashCollected !== undefined && {
            cashCollected: new Prisma.Decimal(orderData.cashCollected),
          }),
          ...(orderData.paymentMethod !== undefined && {
            paymentMethod: orderData.paymentMethod,
          }),
        },
      });
    }

    // Update items if provided
    if (items) {
      // Fetch products to recalc total
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      let totalAmount = new Prisma.Decimal(0);

      await tx.orderItem.deleteMany({ where: { orderId: id } });

      const newItems = items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);

        const price = item.price !== undefined ? new Prisma.Decimal(item.price) : product.basePrice;
        const amount = price.mul(item.quantity);
        totalAmount = totalAmount.add(amount);

        return {
          orderId: id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtTime: price,
          filledGiven: item.filledGiven || 0,
          emptyTaken: item.emptyTaken || 0,
          damagedReturned: item.damagedReturned || 0,
        };
      });

      await tx.orderItem.createMany({ data: newItems });

      // Recalculate order total
      // We need existing delivery/discount if not provided in update
      // We can use orderData or fallback to existingOrder
      const deliveryCharge =
        orderData.deliveryCharge !== undefined ? new Prisma.Decimal(orderData.deliveryCharge) : existingOrder.deliveryCharge;
      const discount = orderData.discount !== undefined ? new Prisma.Decimal(orderData.discount) : existingOrder.discount;

      const finalTotal = totalAmount.add(deliveryCharge).sub(discount);

      await tx.order.update({
        where: { id },
        data: {
          totalAmount: finalTotal,
        },
      });
    }

    // Business Logic: Handle Completion
    if (orderData.status === OrderStatus.COMPLETED && existingOrder.status !== OrderStatus.COMPLETED) {
      const updatedOrder = await tx.order.findUnique({ where: { id } });
      if (!updatedOrder) throw new Error('Order not found after update');

      const customer = await tx.customerProfile.findUnique({ where: { id: updatedOrder.customerId } });
      if (!customer) throw new Error('Customer not found');

      // 1. Create Ledger Entry & Update Cash Balance
      // Debit amount (Increase debt or decrease advance)
      const amount = updatedOrder.totalAmount;
      // Use cashCollected if provided, otherwise 0?
      // If we are updating status to COMPLETED, we expect cashCollected to be set if paid.
      // We read it from updatedOrder because it was updated in step 1.
      const cashCollected = updatedOrder.cashCollected; // Decimal

      // Ledger 1: Sale (Debit)
      const afterSaleBalance = customer.cashBalance.sub(amount);
      await tx.ledger.create({
        data: {
          customerId: updatedOrder.customerId,
          amount: amount.neg(),
          description: `Order #${updatedOrder.readableId} Sale`,
          balanceAfter: afterSaleBalance,
          referenceId: id,
        },
      });

      // Ledger 2: Payment (Credit)
      let finalBalance = afterSaleBalance;
      if (cashCollected.gt(0)) {
        finalBalance = finalBalance.add(cashCollected);
        await tx.ledger.create({
          data: {
            customerId: updatedOrder.customerId,
            amount: cashCollected,
            description: `Order #${updatedOrder.readableId} Payment`,
            balanceAfter: finalBalance,
            referenceId: id,
          },
        });
      }

      await tx.customerProfile.update({
        where: { id: updatedOrder.customerId },
        data: { cashBalance: finalBalance },
      });

      // 2. Update Bottle Wallets & Stock
      const orderItems = await tx.orderItem.findMany({ where: { orderId: id } });

      for (const item of orderItems) {
        const netChange = item.filledGiven - item.emptyTaken;

        const wallet = await tx.customerBottleWallet.findUnique({
          where: {
            customerId_productId: {
              customerId: updatedOrder.customerId,
              productId: item.productId,
            },
          },
        });

        if (wallet) {
          const newBalance = wallet.balance + netChange;

          // Prevent negative bottle wallet balance
          if (newBalance < 0) {
            throw new Error(
              `Invalid bottle exchange: Customer currently holds ${wallet.balance} bottles but trying to return ${item.emptyTaken} bottles while receiving ${item.filledGiven}. This would result in negative balance.`,
            );
          }

          await tx.customerBottleWallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          });
        } else {
          // New wallet - ensure first transaction is not negative
          if (netChange < 0) {
            throw new Error(
              `Invalid bottle exchange: Cannot create negative bottle balance. Customer is returning ${item.emptyTaken} bottles but only receiving ${item.filledGiven}.`,
            );
          }

          await tx.customerBottleWallet.create({
            data: {
              customerId: updatedOrder.customerId,
              productId: item.productId,
              balance: netChange,
            },
          });
        }

        // 3. Update Inventory with validation
        // Handle Damaged Bottles: Damaged bottles are REMOVED from the customer ecosystem but DO NOT enter 'stockEmpty' (good stock).
        // They are tracked in 'stockDamaged' (Audit Trail) and removed from 'stockFilled' (if we consider them as lost assets, but wait.
        // 'stockFilled' is what we have in warehouse. 'stockEmpty' is empty bottles in warehouse.
        // If a customer returns a DAMAGED bottle, they are returning an asset.
        // The driver TAKES it. So it leaves CustomerWallet.
        // But it enters Warehouse as 'stockDamaged', NOT 'stockEmpty'.

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockFilled: true, stockEmpty: true },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.stockFilled < item.filledGiven) {
          throw new Error(
            `Insufficient stock for product ${item.productId}. Available: ${product.stockFilled}, Required: ${item.filledGiven}`,
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockFilled: { decrement: item.filledGiven },
            stockEmpty: { increment: item.emptyTaken }, // Good empties
            stockDamaged: { increment: item.damagedReturned }, // Broken/Lost (Requires Schema Update applied)
          },
        });
      }
    }

    return await tx.order.findUnique({
      where: { id },
      include: { orderItems: true },
    });
  });
}

export async function deleteOrder(id: string) {
  // Prevent deletion of completed orders to maintain financial/inventory integrity
  const order = await db.order.findUnique({
    where: { id },
    select: { status: true, readableId: true },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status === OrderStatus.COMPLETED) {
    throw new Error(
      `Cannot delete completed order #${order.readableId}. Completed orders have ledger entries and inventory changes that cannot be automatically reversed.`,
    );
  }

  return await db.order.delete({
    where: { id },
  });
}

export async function bulkAssignOrders(data: { orderIds: string[]; driverId: string }) {
  const result = await db.order.updateMany({
    where: {
      id: { in: data.orderIds },
    },
    data: {
      driverId: data.driverId,
      status: OrderStatus.PENDING,
    },
  });

  // Notify Driver
  const driver = await db.driverProfile.findUnique({
    where: { id: data.driverId },
    select: { userId: true },
  });

  if (driver) {
    await sendPushNotification(
      [driver.userId],
      'New Orders Assigned',
      `You have been assigned ${data.orderIds.length} new orders.`,
      { type: 'ORDER_ASSIGNED', count: data.orderIds.length.toString() },
    );
  }

  return result;
}

export async function markOrderUnableToDeliver(data: {
  orderId: string;
  driverId: string;
  reason: string;
  notes: string;
  action: 'CANCEL' | 'RESCHEDULE';
  rescheduleDate?: Date;
  proofPhotoUrl?: string;
}) {
  const { orderId, driverId, reason, notes, action, rescheduleDate, proofPhotoUrl } = data;

  return await db.$transaction(async (tx) => {
    // Get the order
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
        customer: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Verify the driver owns this order
    if (order.driverId !== driverId) {
      throw new Error('You are not assigned to this order');
    }

    // Prevent marking already completed orders
    if (order.status === OrderStatus.COMPLETED) {
      throw new Error('Cannot mark completed order as unable to deliver');
    }

    // Determine new status
    const newStatus = action === 'CANCEL' ? OrderStatus.CANCELLED : OrderStatus.RESCHEDULED;

    // Update the order
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        cancellationReason: reason as any, // Cast to enum
        cancelledBy: driverId,
        cancelledAt: new Date(),
        driverNotes: notes,
        proofPhotoUrl,
        rescheduledToDate: action === 'RESCHEDULE' ? rescheduleDate : null,
        originalScheduledDate: action === 'RESCHEDULE' ? order.scheduledDate : null,
      },
    });

    // Create audit log
    await tx.auditLog.create({
      data: {
        actorId: driverId,
        action: action === 'CANCEL' ? 'ORDER_CANCELLED' : 'ORDER_RESCHEDULED',
        details: {
          orderId,
          reason,
          notes,
          customerName: order.customer.user.name,
          orderReadableId: order.readableId,
          originalDate: order.scheduledDate,
          newDate: rescheduleDate,
        },
      },
    });

    // TODO: Send notification to admin/customer
    // await sendNotification({
    //   to: 'admin',
    //   type: action === 'CANCEL' ? 'ORDER_CANCELLED_BY_DRIVER' : 'ORDER_RESCHEDULED_BY_DRIVER',
    //   data: { orderId, customerName: order.customer.user.name, reason, notes }
    // });

    return updatedOrder;
  });
}
