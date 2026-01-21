import { OrderStatus } from '@prisma/client';
import { subDays } from 'date-fns';

import { toUtcStartOfDay, toUtcEndOfDay } from '@/lib/date-utils';
import { db } from '@/lib/db';

/**
 * Aggregates daily statistics for a specific date
 * This should be run once per day (preferably at midnight PKT) via a cron job
 */
export async function aggregateDailyStats(date: Date = new Date()) {
  // Use PKT-aware UTC boundaries for consistent aggregation
  const dayStart = toUtcStartOfDay(date);
  const dayEnd = toUtcEndOfDay(date);

  console.log(`[CRON] Aggregating daily stats for ${dayStart.toISOString()}`);

  try {
    // Aggregate order statistics
    const orderStats = await db.order.aggregate({
      where: {
        scheduledDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: OrderStatus.COMPLETED,
      },
      _sum: {
        totalAmount: true,
        cashCollected: true,
        deliveryCharge: true,
      },
      _count: {
        id: true,
      },
    });

    // Count pending orders (SCHEDULED, PENDING, IN_PROGRESS)
    const pendingOrders = await db.order.count({
      where: {
        scheduledDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          in: [OrderStatus.SCHEDULED, OrderStatus.PENDING, OrderStatus.IN_PROGRESS],
        },
      },
    });

    // Count cancelled orders
    const cancelledOrders = await db.order.count({
      where: {
        scheduledDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: OrderStatus.CANCELLED,
      },
    });

    // Count rescheduled orders
    const rescheduledOrders = await db.order.count({
      where: {
        scheduledDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: OrderStatus.RESCHEDULED,
      },
    });

    // Aggregate bottle statistics from completed orders
    const bottleStats = await db.orderItem.aggregate({
      where: {
        order: {
          scheduledDate: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: OrderStatus.COMPLETED,
        },
      },
      _sum: {
        filledGiven: true,
        emptyTaken: true,
      },
    });

    // Count new customers added
    const newCustomers = await db.customerProfile.count({
      where: {
        user: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      },
    });

    // Count active drivers (drivers who completed at least one order)
    const activeDrivers = await db.order.findMany({
      where: {
        scheduledDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: OrderStatus.COMPLETED,
        driverId: {
          not: null,
        },
      },
      distinct: ['driverId'],
      select: {
        driverId: true,
      },
    });

    // Calculate total distance traveled by all drivers
    const locationRecords = await db.driverLocationHistory.findMany({
      where: {
        timestamp: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    let totalDistance = 0;
    const driverDistances = new Map<string, number>();

    // Group by driver and calculate distance
    const driverLocations = new Map<string, typeof locationRecords>();
    locationRecords.forEach((record) => {
      if (!driverLocations.has(record.driverId)) {
        driverLocations.set(record.driverId, []);
      }
      driverLocations.get(record.driverId)!.push(record);
    });

    // Calculate distance for each driver
    driverLocations.forEach((locations, driverId) => {
      let driverDistance = 0;
      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];
        const distance = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        driverDistance += distance;
      }
      driverDistances.set(driverId, driverDistance);
      totalDistance += driverDistance;
    });

    // Calculate average order value
    const avgOrderValue = orderStats._count.id > 0 ? Number(orderStats._sum.totalAmount || 0) / orderStats._count.id : 0;

    // Upsert daily stats record
    const stats = await db.dailyStats.upsert({
      where: {
        date: dayStart,
      },
      create: {
        date: dayStart,
        totalRevenue: orderStats._sum.totalAmount || 0,
        cashCollected: orderStats._sum.cashCollected || 0,
        ordersCompleted: orderStats._count.id,
        ordersPending: pendingOrders,
        ordersCancelled: cancelledOrders,
        ordersRescheduled: rescheduledOrders,
        bottlesDelivered: bottleStats._sum.filledGiven || 0,
        bottlesReturned: bottleStats._sum.emptyTaken || 0,
        newCustomers: newCustomers,
        driversActive: activeDrivers.length,
        totalDistance: totalDistance,
      },
      update: {
        totalRevenue: orderStats._sum.totalAmount || 0,
        cashCollected: orderStats._sum.cashCollected || 0,
        ordersCompleted: orderStats._count.id,
        ordersPending: pendingOrders,
        ordersCancelled: cancelledOrders,
        ordersRescheduled: rescheduledOrders,
        bottlesDelivered: bottleStats._sum.filledGiven || 0,
        bottlesReturned: bottleStats._sum.emptyTaken || 0,
        newCustomers: newCustomers,
        driversActive: activeDrivers.length,
        totalDistance: totalDistance,
      },
    });

    console.log(`[CRON] Daily stats aggregated successfully:`, {
      date: dayStart.toISOString().split('T')[0],
      revenue: Number(stats.totalRevenue),
      orders: stats.ordersCompleted,
      drivers: stats.driversActive,
      distance: Math.round(stats.totalDistance || 0),
    });

    // Also update driver performance metrics for each active driver
    await aggregateDriverPerformanceMetrics(dayStart, dayEnd, driverDistances);

    return stats;
  } catch (error) {
    console.error('[CRON] Error aggregating daily stats:', error);
    throw error;
  }
}

/**
 * Aggregates performance metrics for each driver for a specific date
 */
async function aggregateDriverPerformanceMetrics(dayStart: Date, dayEnd: Date, driverDistances: Map<string, number>) {
  console.log(`[CRON] Aggregating driver performance metrics`);

  // Get all drivers who were active on this day
  const activeDriverOrders = await db.order.findMany({
    where: {
      scheduledDate: {
        gte: dayStart,
        lte: dayEnd,
      },
      driverId: {
        not: null,
      },
    },
    include: {
      orderItems: true,
    },
  });

  // Group orders by driver
  const driverOrdersMap = new Map<string, typeof activeDriverOrders>();
  activeDriverOrders.forEach((order) => {
    if (order.driverId) {
      if (!driverOrdersMap.has(order.driverId)) {
        driverOrdersMap.set(order.driverId, []);
      }
      driverOrdersMap.get(order.driverId)!.push(order);
    }
  });

  // Calculate metrics for each driver
  const metricsPromises = Array.from(driverOrdersMap.entries()).map(async ([driverId, orders]) => {
    const completedOrders = orders.filter((o) => o.status === OrderStatus.COMPLETED);
    const totalOrders = orders.length;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const cashCollected = completedOrders.reduce((sum, o) => sum + Number(o.cashCollected), 0);

    const bottlesDelivered = completedOrders.reduce((sum, o) => {
      return sum + o.orderItems.reduce((itemSum, item) => itemSum + item.filledGiven, 0);
    }, 0);

    const bottlesCollected = completedOrders.reduce((sum, o) => {
      return sum + o.orderItems.reduce((itemSum, item) => itemSum + item.emptyTaken, 0);
    }, 0);

    const distanceTraveled = driverDistances.get(driverId) || 0;
    const completionRate = totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0;

    // Get location tracking stats
    const locationCount = await db.driverLocationHistory.count({
      where: {
        driverId,
        timestamp: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    const firstLocation = await db.driverLocationHistory.findFirst({
      where: {
        driverId,
        timestamp: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    const lastLocation = await db.driverLocationHistory.findFirst({
      where: {
        driverId,
        timestamp: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    const hoursActive =
      firstLocation && lastLocation ? (lastLocation.timestamp.getTime() - firstLocation.timestamp.getTime()) / (1000 * 60 * 60) : 0;

    // Calculate performance score (0-100)
    const performanceScore = calculatePerformanceScore({
      completionRate,
      ordersCompleted: completedOrders.length,
      hoursActive,
      distanceTraveled,
    });

    return db.driverPerformanceMetrics.upsert({
      where: {
        driverId_date: {
          driverId,
          date: dayStart,
        },
      },
      create: {
        driverId,
        date: dayStart,
        ordersCompleted: completedOrders.length,
        ordersAssigned: totalOrders,
        totalBilled: totalRevenue,
        cashCollected,
        bottlesGiven: bottlesDelivered,
        bottlesTaken: bottlesCollected,
        totalDistance: distanceTraveled,
        workingHours: hoursActive,
        completionRate,
        performanceScore,
      },
      update: {
        ordersCompleted: completedOrders.length,
        ordersAssigned: totalOrders,
        totalBilled: totalRevenue,
        cashCollected,
        bottlesGiven: bottlesDelivered,
        bottlesTaken: bottlesCollected,
        totalDistance: distanceTraveled,
        workingHours: hoursActive,
        completionRate,
        performanceScore,
      },
    });
  });

  await Promise.all(metricsPromises);
  console.log(`[CRON] Driver performance metrics updated for ${metricsPromises.length} drivers`);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate performance score based on various metrics
 * Returns a score between 0-100
 */
function calculatePerformanceScore(metrics: {
  completionRate: number;
  ordersCompleted: number;
  hoursActive: number;
  distanceTraveled: number;
}): number {
  // Weighted scoring system
  const completionWeight = 0.4; // 40% weight
  const productivityWeight = 0.3; // 30% weight (orders per hour)
  const activityWeight = 0.2; // 20% weight (hours active)
  const efficiencyWeight = 0.1; // 10% weight (distance efficiency)

  // Completion rate score (0-100)
  const completionScore = metrics.completionRate;

  // Productivity score (orders per hour, capped at 10 orders/hour = 100 points)
  const ordersPerHour = metrics.hoursActive > 0 ? metrics.ordersCompleted / metrics.hoursActive : 0;
  const productivityScore = Math.min((ordersPerHour / 10) * 100, 100);

  // Activity score (8 hours = 100 points)
  const activityScore = Math.min((metrics.hoursActive / 8) * 100, 100);

  // Efficiency score (lower distance per order is better, 5km per order = 100 points)
  const distancePerOrder = metrics.ordersCompleted > 0 ? metrics.distanceTraveled / metrics.ordersCompleted : 0;
  const efficiencyScore = distancePerOrder > 0 ? Math.max(100 - (distancePerOrder / 5000) * 100, 0) : 50;

  const totalScore =
    completionScore * completionWeight +
    productivityScore * productivityWeight +
    activityScore * activityWeight +
    efficiencyScore * efficiencyWeight;

  return Math.round(Math.min(Math.max(totalScore, 0), 100));
}

/**
 * Cleanup old location history data (older than 30 days)
 */
export async function cleanupOldLocationHistory() {
  const thirtyDaysAgo = subDays(new Date(), 30);

  console.log(`[CRON] Cleaning up location history older than ${thirtyDaysAgo.toISOString()}`);

  const result = await db.driverLocationHistory.deleteMany({
    where: {
      timestamp: {
        lt: thirtyDaysAgo,
      },
    },
  });

  console.log(`[CRON] Deleted ${result.count} old location records`);
  return result;
}
