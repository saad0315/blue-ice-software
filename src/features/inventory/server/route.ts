import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { sessionMiddleware } from '@/lib/session-middleware';

import {
  adjustStock,
  createLoadHandover,
  createReturnHandover,
  getBottlesWithCustomers,
  getInventoryStats,
  recordDamageOrLoss,
  refillBottles,
  restockProduct,
} from '../queries';
import {
  adjustmentSchema,
  damageSchema,
  loadHandoverSchema,
  refillSchema,
  restockSchema,
  returnHandoverSchema,
} from '../schema';

const app = new Hono()
  .get('/stats', sessionMiddleware, async (c) => {
    const stats = await getInventoryStats();
    return c.json(stats);
  })
  .get('/bottles-with-customers', sessionMiddleware, async (c) => {
    const productId = c.req.query('productId');
    const bottles = await getBottlesWithCustomers(productId);
    return c.json(bottles);
  })
  .post('/restock', sessionMiddleware, zValidator('json', restockSchema), async (c) => {
    const data = c.req.valid('json');
    const product = await restockProduct(data);
    return c.json({ success: true, product });
  })
  .post('/refill', sessionMiddleware, zValidator('json', refillSchema), async (c) => {
    const data = c.req.valid('json');
    const product = await refillBottles(data);
    return c.json({ success: true, product });
  })
  .post('/damage', sessionMiddleware, zValidator('json', damageSchema), async (c) => {
    const data = c.req.valid('json');
    const product = await recordDamageOrLoss(data);
    return c.json({ success: true, product });
  })
  .post('/adjust', sessionMiddleware, zValidator('json', adjustmentSchema), async (c) => {
    const data = c.req.valid('json');
    const product = await adjustStock(data);
    return c.json({ success: true, product });
  })
  // --- NEW HANDOVER ROUTES ---
  .post('/handover/load', sessionMiddleware, zValidator('json', loadHandoverSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    try {
      const handover = await createLoadHandover({
        ...data,
        date: new Date(data.date),
        warehouseMgrId: user.id,
      });
      return c.json({ success: true, data: handover });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  })
  .post('/handover/return', sessionMiddleware, zValidator('json', returnHandoverSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    try {
      const items = data.items.map((item) => ({
        ...item,
        condition: item.condition as 'FILLED' | 'EMPTY' | 'DAMAGED',
      }));

      const handover = await createReturnHandover({
        driverId: data.driverId,
        date: new Date(data.date),
        warehouseMgrId: user.id,
        items,
      });
      return c.json({ success: true, data: handover });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  });

export default app;
