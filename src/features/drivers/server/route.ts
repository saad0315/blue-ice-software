import { zValidator } from '@hono/zod-validator';
import { Prisma, UserRole } from '@prisma/client';
import { Hono } from 'hono';
import { z } from 'zod';

import { getDriverStats } from '@/features/driver-view/queries';
import {
  createDriver,
  deleteDriver,
  getDriver,
  getDriverByUserId,
  getDriverDetailStats,
  getDriverLedger,
  getDrivers,
  updateDriver,
  getDriverDeliveries,
} from '@/features/drivers/queries';
import { createDriverSchema, getDriversQuerySchema, updateDriverSchema } from '@/features/drivers/schema';
import { sessionMiddleware } from '@/lib/session-middleware';

const app = new Hono()
  .get(
    '/me/stats',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    ),
    async (ctx) => {
      const user = ctx.get('user');
      const { startDate } = ctx.req.valid('query');

      try {
        const driver = await getDriverByUserId(user.id);
        if (!driver) return ctx.json({ error: 'Driver not found' }, 404);

        // Use provided date or default to now
        const date = startDate ? new Date(startDate) : new Date();
        const stats = await getDriverStats(driver.id, date);
        return ctx.json({ data: stats });
      } catch (error) {
        return ctx.json({ error: 'Failed to fetch stats' }, 500);
      }
    },
  )
  .get('/me/ledger', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');
    try {
      const driver = await getDriverByUserId(user.id);
      if (!driver) return ctx.json({ error: 'Driver not found' }, 404);

      const ledger = await getDriverLedger(driver.id);
      return ctx.json({ data: ledger });
    } catch (error) {
      console.error(error);
      return ctx.json({ error: 'Failed to fetch ledger' }, 500);
    }
  })
  .get('/me', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');
    try {
      const driver = await getDriverByUserId(user.id);
      if (!driver) return ctx.json({ error: 'Driver not found' }, 404);
      return ctx.json({ data: driver });
    } catch (error) {
      return ctx.json({ error: 'Failed to fetch driver' }, 500);
    }
  })
  .get('/', sessionMiddleware, zValidator('query', getDriversQuerySchema), async (ctx) => {
    const params = ctx.req.valid('query');
    const dateParam = ctx.req.query('date');

    try {
      const result = await getDrivers({
        ...params,
        date: dateParam ? new Date(dateParam) : undefined,
      });
      return ctx.json(result);
    } catch (error) {
      return ctx.json({ error: 'Failed to fetch drivers' }, 500);
    }
  })
  .get('/:id', sessionMiddleware, async (ctx) => {
    const { id } = ctx.req.param();

    try {
      const driver = await getDriver(id);
      if (!driver) return ctx.json({ error: 'Driver not found' }, 404);
      return ctx.json({ data: driver });
    } catch (error) {
      return ctx.json({ error: 'Failed to fetch driver' }, 500);
    }
  })
  .get(
    '/:id/stats',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        date: z.string().optional(),
      }),
    ),
    async (ctx) => {
      const { id } = ctx.req.param();
      const { startDate, endDate } = ctx.req.valid('query');
      const dateParam = ctx.req.query('date');

      try {
        const stats = await getDriverDetailStats(id, {
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          date: dateParam ? new Date(dateParam) : undefined,
        });
        return ctx.json({ data: stats });
      } catch (error) {
        console.error('[DRIVER_STATS_ERROR]:', error);
        return ctx.json({ error: 'Failed to fetch driver statistics' }, 500);
      }
    },
  )
  .get(
    '/:id/deliveries',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        status: z.enum(['SCHEDULED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'ALL']).optional(),
      }),
    ),
    async (ctx) => {
      const { id } = ctx.req.param();
      const { startDate, endDate, page, limit, status } = ctx.req.valid('query');

      try {
        const result = await getDriverDeliveries(id, {
          page,
          limit,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          status: status as any,
        });
        return ctx.json({ data: result });
      } catch (error) {
        console.error('[DRIVER_DELIVERIES_ERROR]:', error);
        return ctx.json({ error: 'Failed to fetch driver deliveries' }, 500);
      }
    },
  )
  .post('/', sessionMiddleware, zValidator('json', createDriverSchema), async (ctx) => {
    const user = ctx.get('user');

    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    const data = ctx.req.valid('json');

    try {
      const driver = await createDriver({
        ...data,
        email: data.email ?? null,
      });
      return ctx.json({ data: driver });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('phoneNumber')) return ctx.json({ error: 'Phone number already exists' }, 400);
        if (target.includes('email')) return ctx.json({ error: 'Email already exists' }, 400);
      }
      return ctx.json({ error: 'Failed to create driver' }, 500);
    }
  })
  .patch('/:id', sessionMiddleware, zValidator('json', updateDriverSchema), async (ctx) => {
    const user = ctx.get('user');
    const { id } = ctx.req.param();

    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    const data = ctx.req.valid('json');

    try {
      const driver = await updateDriver(id, data);
      return ctx.json({ data: driver });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('phoneNumber')) return ctx.json({ error: 'Phone number already exists' }, 400);
        if (target.includes('email')) return ctx.json({ error: 'Email already exists' }, 400);
      }
      return ctx.json({ error: 'Failed to update driver' }, 500);
    }
  })
  .delete('/:id', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');
    const { id } = ctx.req.param();

    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    try {
      await deleteDriver(id);
      return ctx.json({ success: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        return ctx.json({ error: 'Cannot delete driver with existing assignments' }, 400);
      }
      return ctx.json({ error: 'Failed to delete driver' }, 500);
    }
  });

export default app;
