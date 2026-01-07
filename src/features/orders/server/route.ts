import { zValidator } from '@hono/zod-validator';
import { Prisma, UserRole } from '@prisma/client';
import { Hono } from 'hono';

import {
  bulkAssignOrders,
  createOrder,
  deleteOrder,
  generateOrders,
  getOrder,
  getOrderForInvoice,
  getOrders,
  markOrderUnableToDeliver,
  updateOrder,
} from '@/features/orders/queries';
import {
  bulkAssignSchema,
  createOrderSchema,
  generateOrdersSchema,
  getOrdersQuerySchema,
  unableToDeliverSchema,
  updateOrderSchema,
} from '@/features/orders/schema';
import { sessionMiddleware } from '@/lib/session-middleware';

const app = new Hono()
  .get('/', sessionMiddleware, zValidator('query', getOrdersQuerySchema), async (ctx) => {
    const params = ctx.req.valid('query');

    try {
      const result = await getOrders(params);
      return ctx.json(result);
    } catch (error) {
      return ctx.json({ error: 'Failed to fetch orders' }, 500);
    }
  })
  .get('/:id', sessionMiddleware, async (ctx) => {
    const { id } = ctx.req.param();

    try {
      const order = await getOrder(id);
      if (!order) return ctx.json({ error: 'Order not found' }, 404);
      return ctx.json({ data: order });
    } catch (error) {
      return ctx.json({ error: 'Failed to fetch order' }, 500);
    }
  })
  .get('/:id/invoice', sessionMiddleware, async (ctx) => {
    const { id } = ctx.req.param();

    try {
      const invoiceData = await getOrderForInvoice(id);
      if (!invoiceData) return ctx.json({ error: 'Order not found' }, 404);
      return ctx.json({ data: invoiceData });
    } catch (error) {
      console.error('Invoice fetch error:', error);
      return ctx.json({ error: 'Failed to fetch invoice data' }, 500);
    }
  })
  .post('/', sessionMiddleware, zValidator('json', createOrderSchema), async (ctx) => {
    const user = ctx.get('user');

    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    const data = ctx.req.valid('json');

    try {
      const order = await createOrder(data);
      return ctx.json({ data: order });
    } catch (error) {
      console.error(error);
      return ctx.json({ error: 'Failed to create order' }, 500);
    }
  })
  .post('/bulk-assign', sessionMiddleware, zValidator('json', bulkAssignSchema), async (ctx) => {
    const user = ctx.get('user');

    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    const data = ctx.req.valid('json');

    try {
      const result = await bulkAssignOrders(data);
      return ctx.json({ data: result });
    } catch (error) {
      return ctx.json({ error: 'Failed to assign orders' }, 500);
    }
  })
  .post('/generate', sessionMiddleware, zValidator('json', generateOrdersSchema), async (ctx) => {
    const user = ctx.get('user');

    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    const data = ctx.req.valid('json');

    try {
      const result = await generateOrders(data);
      return ctx.json({ data: result });
    } catch (error) {
      console.error(error);
      return ctx.json({ error: 'Failed to generate orders' }, 500);
    }
  })
  .patch('/:id', sessionMiddleware, zValidator('json', updateOrderSchema), async (ctx) => {
    const user = ctx.get('user');
    const { id } = ctx.req.param();

    // Drivers should be able to update orders assigned to them, but for now we restrict to admins/drivers generally
    // Ideally we check if driverId matches user.id
    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR, UserRole.DRIVER] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    const data = ctx.req.valid('json');

    try {
      const order = await updateOrder(id, data);
      return ctx.json({ data: order });
    } catch (error) {
      console.error(error);
      return ctx.json({ error: 'Failed to update order' }, 500);
    }
  })
  .post('/:id/unable-to-deliver', sessionMiddleware, zValidator('json', unableToDeliverSchema), async (ctx) => {
    const user = ctx.get('user');
    const { id } = ctx.req.param();

    // Only drivers can mark orders as unable to deliver
    if (user.role !== UserRole.DRIVER) {
      return ctx.json({ error: 'Only drivers can mark orders as unable to deliver' }, 403);
    }

    const data = ctx.req.valid('json');

    try {
      const result = await markOrderUnableToDeliver({
        orderId: id,
        driverId: user.id,
        reason: data.reason,
        notes: data.notes,
        action: data.action,
        rescheduleDate: data.rescheduleDate,
        proofPhotoUrl: data.proofPhotoUrl,
      });

      return ctx.json({ data: result });
    } catch (error) {
      console.error('Unable to deliver error:', error);

      if (error instanceof Error) {
        return ctx.json({ error: error.message }, 400);
      }

      return ctx.json({ error: 'Failed to mark order as unable to deliver' }, 500);
    }
  })
  .delete('/:id', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');
    const { id } = ctx.req.param();

    if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    try {
      await deleteOrder(id);
      return ctx.json({ success: true });
    } catch (error) {
      return ctx.json({ error: 'Failed to delete order' }, 500);
    }
  });

export default app;
