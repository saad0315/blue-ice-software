import { z } from 'zod';

export const restockSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  filledQuantity: z.number().int().min(0),
  emptyQuantity: z.number().int().min(0),
  notes: z.string().optional(),
});

export const refillSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int().min(1, 'Quantity must be greater than 0'),
  notes: z.string().optional(),
});

export const damageSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int().min(1, 'Quantity must be greater than 0'),
  type: z.enum(['DAMAGE', 'LOSS']),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

export const adjustmentSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  stockFilled: z.number().int().min(0),
  stockEmpty: z.number().int().min(0),
  stockDamaged: z.number().int().min(0),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

// --- NEW HANDOVER SCHEMAS ---

export const loadHandoverSchema = z.object({
  driverId: z.string().min(1, 'Driver is required'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product is required'),
      quantity: z.number().int().min(1, 'Quantity must be greater than 0'),
    })
  ).min(1, 'At least one item is required'),
});

export const returnHandoverSchema = z.object({
  driverId: z.string().min(1, 'Driver is required'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product is required'),
      quantity: z.number().int().min(0), // Can return 0
      condition: z.enum(['FILLED', 'EMPTY', 'DAMAGED']).default('FILLED'), // Updated: Explicit return types
    })
  ),
});
