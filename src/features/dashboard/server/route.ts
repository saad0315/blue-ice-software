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

      const [customerCount, orderCount, activeOrderCount, revenueData, dailyRevenue, orderStatusDistribution] = await Promise.all([
        db.customerProfile.count(),
        db.order.count(),
        db.order.count({
          where: {
            status: {
              notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            },
          },
        }),
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

      return ctx.json({
        data: {
          customerCount,
          orderCount,
          activeOrderCount,
          totalRevenue: revenueData._sum.totalAmount?.toString() || '0',
          dailyRevenue: dailyRevenue as { date: Date; amount: number }[],
          orderStatusDistribution: orderStatusDistribution.map((item) => ({
            name: item.status,
            value: item._count.id,
          })),
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
