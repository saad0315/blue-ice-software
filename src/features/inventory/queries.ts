import { HandoverType, InventoryHandoverStatus, StockTransactionType } from '@prisma/client';

import { db } from '@/lib/db';

/**
 * Get inventory statistics including bottles with customers
 */
export async function getInventoryStats() {
  // Get all products with their stock levels
  const products = await db.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      stockFilled: true,
      stockEmpty: true,
      stockDamaged: true,
      stockReserved: true,
      isReturnable: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Get bottles with customers (from CustomerBottleWallet)
  const bottlesWithCustomers = await db.customerBottleWallet.groupBy({
    by: ['productId'],
    _sum: {
      balance: true,
    },
  });

  // Create a map for easy lookup
  const bottlesWithCustomersMap = new Map(
    bottlesWithCustomers.map((item) => [item.productId, item._sum.balance || 0]),
  );

  // Calculate totals
  const totalFilled = products.reduce((sum, p) => sum + p.stockFilled, 0);
  const totalEmpty = products.reduce((sum, p) => sum + p.stockEmpty, 0);
  const totalDamaged = products.reduce((sum, p) => sum + p.stockDamaged, 0);
  const totalReserved = products.reduce((sum, p) => sum + (p.stockReserved || 0), 0);
  const totalWithCustomers = Array.from(bottlesWithCustomersMap.values()).reduce((sum, val) => sum + val, 0);

  return {
    products: products.map((p) => ({
      ...p,
      bottlesWithCustomers: bottlesWithCustomersMap.get(p.id) || 0,
      totalBottles: p.stockFilled + p.stockEmpty + p.stockDamaged + (p.stockReserved || 0) + (bottlesWithCustomersMap.get(p.id) || 0),
    })),
    totals: {
      filled: totalFilled,
      empty: totalEmpty,
      damaged: totalDamaged,
      reserved: totalReserved,
      withCustomers: totalWithCustomers,
      total: totalFilled + totalEmpty + totalDamaged + totalReserved + totalWithCustomers,
    },
  };
}

/**
 * Add new bottles to inventory from supplier (restocking)
 * Adds both filled and empty bottles to total stock
 */
export async function restockProduct(data: { productId: string; filledQuantity: number; emptyQuantity: number; notes?: string }) {
  const product = await db.product.findUnique({
    where: { id: data.productId },
    select: { id: true, name: true, stockFilled: true, stockEmpty: true },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  return await db.product.update({
    where: { id: data.productId },
    data: {
      stockFilled: product.stockFilled + data.filledQuantity,
      stockEmpty: product.stockEmpty + data.emptyQuantity,
    },
  });
}

/**
 * Refill empty bottles (convert empty to filled)
 * Does not change total stock, only moves from empty to filled
 */
export async function refillBottles(data: { productId: string; quantity: number; notes?: string }) {
  const product = await db.product.findUnique({
    where: { id: data.productId },
    select: { id: true, name: true, stockFilled: true, stockEmpty: true },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Check if we have enough empty bottles to refill
  if (product.stockEmpty < data.quantity) {
    throw new Error(`Insufficient empty bottles. Available: ${product.stockEmpty}, Requested: ${data.quantity}`);
  }

  return await db.product.update({
    where: { id: data.productId },
    data: {
      stockFilled: product.stockFilled + data.quantity,
      stockEmpty: product.stockEmpty - data.quantity,
    },
  });
}

/**
 * Record damage or loss (reduce stock)
 */
export async function recordDamageOrLoss(data: {
  productId: string;
  quantity: number;
  type: 'DAMAGE' | 'LOSS';
  reason: string;
  notes?: string;
}) {
  const product = await db.product.findUnique({
    where: { id: data.productId },
    select: { id: true, name: true, stockFilled: true, stockEmpty: true, stockDamaged: true },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Check if we have enough stock to record damage/loss
  if (product.stockFilled < data.quantity) {
    throw new Error('Insufficient filled stock');
  }

  // For DAMAGE: reduce stockFilled and increase stockDamaged
  // For LOSS: reduce stockFilled only (lost completely, not tracked in damaged)
  if (data.type === 'DAMAGE') {
    return await db.product.update({
      where: { id: data.productId },
      data: {
        stockFilled: product.stockFilled - data.quantity,
        stockDamaged: product.stockDamaged + data.quantity,
      },
    });
  } else {
    return await db.product.update({
      where: { id: data.productId },
      data: {
        stockFilled: product.stockFilled - data.quantity,
      },
    });
  }
}

/**
 * Manual stock adjustment (admin only)
 */
export async function adjustStock(data: {
  productId: string;
  stockFilled: number;
  stockEmpty: number;
  stockDamaged: number;
  reason: string;
  notes?: string;
}) {
  const product = await db.product.findUnique({
    where: { id: data.productId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  return await db.product.update({
    where: { id: data.productId },
    data: {
      stockFilled: data.stockFilled,
      stockEmpty: data.stockEmpty,
      stockDamaged: data.stockDamaged,
    },
  });
}

/**
 * Get bottles currently with customers for a specific product
 */
export async function getBottlesWithCustomers(productId?: string) {
  const where = productId ? { productId } : {};

  const wallets = await db.customerBottleWallet.findMany({
    where: {
      ...where,
      balance: {
        gt: 0,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      customer: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
              phoneNumber: true,
            },
          },
          address: true,
        },
      },
    },
    orderBy: {
      balance: 'desc',
    },
  });

  return wallets.map((wallet) => ({
    customerId: wallet.customer.id,
    customerName: wallet.customer.user.name,
    customerPhone: wallet.customer.user.phoneNumber,
    customerAddress: wallet.customer.address,
    productId: wallet.product.id,
    productName: wallet.product.name,
    productSku: wallet.product.sku,
    bottleBalance: wallet.balance,
  }));
}

// ------------------------------------------------------------------
// NEW: TRUCK INVENTORY LOGIC (LOAD & RETURN)
// ------------------------------------------------------------------

/**
 * Create a LOAD Handover (Warehouse -> Truck)
 * Decrements Warehouse Stock, Records Handover
 */
export async function createLoadHandover(data: {
  driverId: string;
  date: Date;
  warehouseMgrId: string;
  items: { productId: string; quantity: number }[];
}) {
  return await db.$transaction(async (tx) => {
    // 1. Verify Stock Availability
    for (const item of data.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new Error(`Product ${item.productId} not found`);
      if (product.stockFilled < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockFilled}, Requested: ${item.quantity}`);
      }
    }

    // 2. Create Handover Record
    const handover = await tx.inventoryHandover.create({
      data: {
        driverId: data.driverId,
        date: data.date,
        type: HandoverType.LOAD,
        status: InventoryHandoverStatus.CONFIRMED, // Auto-confirming for now, can be PENDING if driver needs to sign
        warehouseMgrId: data.warehouseMgrId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            condition: 'GOOD',
          })),
        },
      },
    });

    // 3. Update Stock & Create Transactions
    for (const item of data.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      // Decrement Warehouse Stock
      // We assume loaded bottles are "Filled".
      // If we load empties (rare but possible), we'd need a `type` in items. For now assuming Filled.
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockFilled: { decrement: item.quantity },
          // We could optionally increment `stockReserved` if we want to track "On Truck" as a warehouse metric,
          // but usually "On Truck" is separate. The requirement is to DECREMENT warehouse stock.
        },
      });

      // Create Stock Transaction Log
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          type: StockTransactionType.DRIVER_LOAD,
          quantity: item.quantity,
          driverId: data.driverId,
          referenceId: handover.id,
          createdById: data.warehouseMgrId,
          stockFilledBefore: product.stockFilled,
          stockFilledAfter: product.stockFilled - item.quantity,
          stockEmptyBefore: product.stockEmpty,
          stockEmptyAfter: product.stockEmpty,
          stockDamagedBefore: product.stockDamaged,
          stockDamagedAfter: product.stockDamaged,
        },
      });
    }

    return handover;
  });
}

/**
 * Create a RETURN Handover (Truck -> Warehouse)
 * Increments Warehouse Stock (Filled & Empty), Records Handover
 */
export async function createReturnHandover(data: {
  driverId: string;
  date: Date;
  warehouseMgrId: string;
  items: { productId: string; quantity: number; condition: 'FILLED' | 'EMPTY' | 'DAMAGED' }[];
}) {
  return await db.$transaction(async (tx) => {
    // 1. Create Handover Record
    const handover = await tx.inventoryHandover.create({
      data: {
        driverId: data.driverId,
        date: data.date,
        type: HandoverType.RETURN,
        status: InventoryHandoverStatus.CONFIRMED,
        warehouseMgrId: data.warehouseMgrId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            condition: item.condition,
          })),
        },
      },
    });

    // 2. Update Stock & Create Transactions
    for (const item of data.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      // Determine which stock to increment
      const returnType = item.condition;

      let updateData = {};
      let stockFilledAfter = product.stockFilled;
      let stockEmptyAfter = product.stockEmpty;
      let stockDamagedAfter = product.stockDamaged;

      if (returnType === 'FILLED') {
        updateData = { stockFilled: { increment: item.quantity } };
        stockFilledAfter += item.quantity;
      } else if (returnType === 'EMPTY') {
        updateData = { stockEmpty: { increment: item.quantity } };
        stockEmptyAfter += item.quantity;
      } else if (returnType === 'DAMAGED') {
        updateData = { stockDamaged: { increment: item.quantity } };
        stockDamagedAfter += item.quantity;
      } else {
        // Fallback or error handling
        updateData = { stockFilled: { increment: item.quantity } };
        stockFilledAfter += item.quantity;
      }

      await tx.product.update({
        where: { id: item.productId },
        data: updateData,
      });

      // Create Stock Transaction Log
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          type: StockTransactionType.DRIVER_RETURN,
          quantity: item.quantity,
          driverId: data.driverId,
          referenceId: handover.id,
          createdById: data.warehouseMgrId,
          stockFilledBefore: product.stockFilled,
          stockFilledAfter,
          stockEmptyBefore: product.stockEmpty,
          stockEmptyAfter,
          stockDamagedBefore: product.stockDamaged,
          stockDamagedAfter,
          notes: `Return Condition: ${returnType}`,
        },
      });
    }

    return handover;
  });
}
