import { CustomerType } from '@prisma/client';
import { z } from 'zod';

/**
 * Schema for creating a new customer
 * Handles both new signups and legacy data migration
 */
export const createCustomerSchema = z
  .object({
    // User Information
    name: z.string().trim().min(1, 'Customer name is required'),
    phoneNumber: z.string().trim().min(10, 'Valid phone number is required'),
    email: z
      .string()
      .trim()
      .email({ message: 'Invalid email address' })
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? null : val)),
    password: z.string().min(8, 'Password must be at least 8 characters'),

    // Customer Code (Auto-generated or Manual for Legacy)
    manualCode: z
      .string()
      .trim()
      .min(1, 'Customer code is required')
      .regex(/^[A-Z]-\d+$/, 'Customer code must be in format like C-1001 or L-3442'),

    // Location & Logistics
    area: z.string().trim().min(1, 'Area is required'),
    address: z.string().trim().min(1, 'Full address is required'),
    landmark: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? null : val)),
    floorNumber: z.coerce.number().int().min(0, 'Floor number cannot be negative').default(0),
    hasLift: z.boolean().default(false),
    geoLat: z.coerce.number().min(-90).max(90).optional().nullable(),
    geoLng: z.coerce.number().min(-180).max(180).optional().nullable(),

    // Routing
    routeId: z.string().uuid().optional().nullable(),
    sequenceOrder: z.coerce.number().int().positive().optional().nullable(),

    // Business Logic
    type: z.nativeEnum(CustomerType).default(CustomerType.RESIDENTIAL),
    deliveryDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, 'At least one delivery day is required')
      .refine((days) => new Set(days).size === days.length, {
        message: 'Delivery days must be unique',
      }),

    // Automated Ordering Defaults
    defaultProductId: z.string().uuid().optional().nullable(),
    defaultQuantity: z.coerce.number().int().min(1).default(1),

    // Financials
    creditLimit: z
      .string()
      .or(z.number())
      .transform((val) => (typeof val === 'string' ? val : val.toString()))
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
        message: 'Credit limit must be a positive number',
      })
      .transform((val) => val)
      .default('2000'),

    // Opening Balances (For Migration)
    openingCashBalance: z
      .string()
      .or(z.number())
      .transform((val) => (typeof val === 'string' ? val : val.toString()))
      .refine((val) => !isNaN(parseFloat(val)), {
        message: 'Opening cash balance must be a valid number',
      })
      .transform((val) => val)
      .default('0'),

    openingBottleBalance: z.coerce.number().int().min(0, 'Opening bottle balance cannot be negative').default(0),

    // Product ID for bottle wallet (required if openingBottleBalance > 0)
    productId: z.string().uuid().optional().nullable(),
  })
  .refine(
    (data) => {
      // If opening bottle balance > 0, productId is required
      if (data.openingBottleBalance > 0 && !data.productId) {
        return false;
      }
      return true;
    },
    {
      message: 'Product ID is required when opening bottle balance is greater than 0',
      path: ['productId'],
    },
  );

/**
 * Schema for updating customer profile
 */
export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phoneNumber: z.string().trim().min(10).optional(),
  email: z.string().trim().email().optional().nullable(),

  manualCode: z
    .string()
    .trim()
    .regex(/^[A-Z]-\d+$/, 'Manual code must be in format like L-3442')
    .optional()
    .nullable(),

  area: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  landmark: z.string().trim().optional().nullable(),
  floorNumber: z.coerce.number().int().min(0).optional(),
  hasLift: z.boolean().optional(),
  geoLat: z.coerce.number().min(-90).max(90).optional().nullable(),
  geoLng: z.coerce.number().min(-180).max(180).optional().nullable(),

  routeId: z.string().uuid().optional().nullable(),
  sequenceOrder: z.coerce.number().int().positive().optional().nullable(),

  type: z.nativeEnum(CustomerType).optional(),
  deliveryDays: z.array(z.number().int().min(0).max(6)).optional(),

  defaultProductId: z.string().uuid().optional().nullable(),
  defaultQuantity: z.coerce.number().int().min(1).optional(),

  creditLimit: z
    .string()
    .or(z.number())
    .transform((val) => (typeof val === 'string' ? val : val.toString()))
    .optional(),
});

/**
 * Schema for querying customers
 */
export const getCustomersQuerySchema = z.object({
  search: z.string().optional(),
  area: z.string().optional(),
  type: z.nativeEnum(CustomerType).optional(),
  routeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type GetCustomersQuery = z.infer<typeof getCustomersQuerySchema>;
