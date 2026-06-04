import { zValidator } from '@hono/zod-validator';
import { OrderStatus, UserRole } from '@prisma/client';
import { Hono } from 'hono';
import { z } from 'zod';

import { getComprehensiveDashboardData } from '@/features/dashboard/queries-comprehensive';
import { db } from '@/lib/db';
import { sessionMiddleware } from '@/lib/session-middleware';

const app = new Hono()
  .get('/', sessionMiddleware, async (ctx) => {
    const dateParam = ctx.req.query('date');
    try {
      const today = dateParam ? new Date(dateParam) : new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      // ⚡ Bolt: Consolidating parallel order.count and order.groupBy queries
      // to reduce DB load by deriving counts from the single status distribution query
      const [customerCount, revenueData, dailyRevenue, orderStatusDistribution] = await Promise.all([
        db.customerProfile.count(),
        db.order.aggregate({
          where: {
            status: OrderStatus.COMPLETED,
          },
          _sum: {
            totalAmount: true,
          },
        }),
        // Revenue per day (last 30 days)
        db.$queryRaw`
          SELECT DATE("createdAt") as date, SUM("totalAmount") as amount
          FROM "Order"
          WHERE "status" = 'COMPLETED'
          AND "createdAt" >= ${thirtyDaysAgo}
          GROUP BY DATE("createdAt")
          ORDER BY DATE("createdAt") ASC
        `,
        // Order Status Distribution
        db.order.groupBy({
          by: ['status'],
          _count: {
            id: true,
          },
        }),
      ]);

      // Calculate total and active orders in memory from the grouped data
      let orderCount = 0;
      let activeOrderCount = 0;

      const mappedOrderStatusDistribution = orderStatusDistribution.map((item) => {
        const count = item._count.id;
        orderCount += count;

        if (![OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(item.status as any)) {
          activeOrderCount += count;
        }

        return {
          name: item.status,
          value: count,
        };
      });

      return ctx.json({
        data: {
          customerCount,
          orderCount,
          activeOrderCount,
          totalRevenue: revenueData._sum.totalAmount?.toString() || '0',
          dailyRevenue: dailyRevenue as { date: Date; amount: number }[],
          orderStatusDistribution: mappedOrderStatusDistribution,
        },
      });
    } catch (error) {
      return ctx.json({ error: 'Failed to fetch dashboard stats' }, 500);
    }
  })
  .get(
    '/comprehensive',
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

      const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
      // Only admins can access comprehensive dashboard
      if (!allowedRoles.includes(user.role)) {
        return ctx.json({ error: 'Unauthorized' }, 403);
      }

      const { startDate, endDate } = ctx.req.valid('query');

      try {
        const data = await getComprehensiveDashboardData({
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        });

        return ctx.json({ data });
      } catch (error) {
        console.error('[COMPREHENSIVE_DASHBOARD_ERROR]:', error);
        return ctx.json({ error: 'Failed to fetch comprehensive dashboard data' }, 500);
      }
    },
  );

export default app;
