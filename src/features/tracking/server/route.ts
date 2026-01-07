import { zValidator } from '@hono/zod-validator';
import { UserRole } from '@prisma/client';
import { Hono } from 'hono';
import { z } from 'zod';

import { getDriverRouteHistory, getLiveDriverLocations, toggleDriverDutyStatus, updateDriverLocation } from '@/features/tracking/queries';
import { sessionMiddleware } from '@/lib/session-middleware';
import { emitDriverLocation, emitDriverPresence } from '@/lib/socket-emitter';

const app = new Hono()
  // Update driver location (called by driver app every 30 seconds)
  .post(
    '/location',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().optional(),
        speed: z.number().optional(),
        heading: z.number().min(0).max(360).optional(),
        isMoving: z.boolean().optional(),
        batteryLevel: z.number().min(0).max(100).optional(),
      }),
    ),
    async (ctx) => {
      const user = ctx.get('user');

      // Only drivers can update their location
      if (user.role !== UserRole.DRIVER) {
        return ctx.json({ error: 'Only drivers can update location' }, 403);
      }

      const locationData = ctx.req.valid('json');

      try {
        // Get driver profile
        const { db } = await import('@/lib/db');
        const driverProfile = await db.driverProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });

        if (!driverProfile) {
          return ctx.json({ error: 'Driver profile not found' }, 404);
        }

        const location = await updateDriverLocation({
          driverId: driverProfile.id,
          ...locationData,
        });

        // Emit location update via WebSocket and Redis
        try {
          await emitDriverLocation({
            driverId: driverProfile.id,
            driverName: user.name,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            speed: locationData.speed,
            heading: locationData.heading,
            isMoving: locationData.isMoving,
            batteryLevel: locationData.batteryLevel,
            isOnDuty: true,
            timestamp: new Date(),
          });
        } catch (emitError) {
          // Log but don't fail the request if socket emission fails
          console.warn('[SOCKET_EMIT_WARNING]:', emitError);
        }

        return ctx.json({
          data: location,
          message: 'Location updated successfully',
        });
      } catch (error) {
        console.error('[LOCATION_UPDATE_ERROR]:', error);
        return ctx.json({ error: 'Failed to update location' }, 500);
      }
    },
  )

  // Get all live driver locations (for admin map view)
  .get('/live-locations', sessionMiddleware, async (ctx) => {
    const user = ctx.get('user');

    // Only admins can view all driver locations
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
    if (!allowedRoles.includes(user.role)) {
      return ctx.json({ error: 'Unauthorized' }, 403);
    }

    try {
      const drivers = await getLiveDriverLocations();

      return ctx.json({
        data: {
          drivers,
          count: drivers.length,
          lastUpdate: new Date(),
        },
      });
    } catch (error) {
      console.error('[GET_LIVE_LOCATIONS_ERROR]:', error);
      return ctx.json({ error: 'Failed to fetch driver locations' }, 500);
    }
  })

  // Get driver route history for a specific date
  .get(
    '/:driverId/route-history',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
      }),
    ),
    async (ctx) => {
      const user = ctx.get('user');
      const { driverId } = ctx.req.param();
      const { date } = ctx.req.valid('query');

      // Admins can view any driver's history, drivers can only view their own
      if (user.role === UserRole.DRIVER) {
        const { db } = await import('@/lib/db');
        const driverProfile = await db.driverProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });

        if (!driverProfile || driverProfile.id !== driverId) {
          return ctx.json({ error: 'Unauthorized to view this data' }, 403);
        }
      } else {
        const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
        if (!allowedRoles.includes(user.role)) {
          return ctx.json({ error: 'Unauthorized' }, 403);
        }
      }

      try {
        const routeData = await getDriverRouteHistory(driverId, new Date(date));

        return ctx.json({
          data: routeData,
          date,
        });
      } catch (error) {
        console.error('[GET_ROUTE_HISTORY_ERROR]:', error);
        return ctx.json({ error: 'Failed to fetch route history' }, 500);
      }
    },
  )

  // Toggle driver duty status (on/off duty)
  .patch(
    '/:driverId/duty-status',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        isOnDuty: z.boolean(),
      }),
    ),
    async (ctx) => {
      const user = ctx.get('user');
      const { driverId } = ctx.req.param();
      const { isOnDuty } = ctx.req.valid('json');

      // Drivers can only toggle their own status, admins can toggle anyone's
      if (user.role === UserRole.DRIVER) {
        const { db } = await import('@/lib/db');
        const driverProfile = await db.driverProfile.findUnique({
          where: { userId: user.id },
          select: { id: true, userId: true },
        });

        console.log('Driver Profile:', driverProfile?.userId, 'Driver ID:', driverId);

        if (!driverProfile || driverProfile.userId !== driverId) {
          return ctx.json({ error: 'Unauthorized profile' }, 403);
        }
      } else {
        const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
        if (!allowedRoles.includes(user.role)) {
          return ctx.json({ error: 'Unauthorized' }, 403);
        }
      }

      try {
        const driver = await toggleDriverDutyStatus(driverId, isOnDuty);

        // Emit presence update via WebSocket and Redis
        try {
          await emitDriverPresence({
            driverId: driver.id,
            driverName: driver.user.name,
            isOnline: true,
            isOnDuty,
            timestamp: new Date(),
          });
        } catch (emitError) {
          console.warn('[SOCKET_EMIT_WARNING]:', emitError);
        }

        return ctx.json({
          data: driver,
          message: `Driver is now ${isOnDuty ? 'on duty' : 'off duty'}`,
        });
      } catch (error) {
        console.error('[TOGGLE_DUTY_STATUS_ERROR]:', error);
        return ctx.json({ error: 'Failed to update duty status' }, 500);
      }
    },
  );

export default app;
