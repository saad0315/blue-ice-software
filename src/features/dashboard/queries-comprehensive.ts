import { CashHandoverStatus, ExpenseStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import { differenceInDays, endOfDay, format, startOfDay, subDays } from 'date-fns';

import { db } from '@/lib/db';

export async function getComprehensiveDashboardData(params?: { startDate?: Date; endDate?: Date }) {
  const { startDate = startOfDay(new Date()), endDate = endOfDay(new Date()) } = params || {};
  const today = startOfDay(new Date());

  // Determine Historical vs Live Periods
  const isHistoricalOnly = endDate < today;
  const isLiveOnly = startDate >= today;
  const isHybrid = !isHistoricalOnly && !isLiveOnly;

  // Split dates for hybrid approach
  const historicalEnd = isHybrid ? subDays(today, 1) : endDate;
  const liveStart = isHybrid ? today : startDate;

  // 1. Fetch Historical Stats (from DailyStats)
  let historicalRevenue = 0;
  let historicalCompletedOrders = 0;
  let historicalTotalVolume = 0;
  let historicalTrends: { date: Date; revenue: number; orders: number }[] = [];
  let historicalOrderBreakdown: Record<string, number> = {};

  if (!isLiveOnly) {
    const dailyStats = await db.dailyStats.findMany({
      where: {
        date: {
          gte: startDate,
          lte: historicalEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    for (const stat of dailyStats) {
      const revenue = Number(stat.totalRevenue);
      historicalRevenue += revenue;
      historicalCompletedOrders += stat.ordersCompleted;
      historicalTotalVolume += stat.ordersCompleted + stat.ordersCancelled + stat.ordersPending + stat.ordersRescheduled;

      historicalTrends.push({
        date: stat.date,
        revenue,
        orders: stat.ordersCompleted,
      });

      historicalOrderBreakdown[OrderStatus.COMPLETED] = (historicalOrderBreakdown[OrderStatus.COMPLETED] || 0) + stat.ordersCompleted;
      historicalOrderBreakdown[OrderStatus.CANCELLED] = (historicalOrderBreakdown[OrderStatus.CANCELLED] || 0) + stat.ordersCancelled;
      historicalOrderBreakdown[OrderStatus.PENDING] = (historicalOrderBreakdown[OrderStatus.PENDING] || 0) + stat.ordersPending;
      historicalOrderBreakdown[OrderStatus.RESCHEDULED] = (historicalOrderBreakdown[OrderStatus.RESCHEDULED] || 0) + stat.ordersRescheduled;
    }
  }

  // 2. Fetch Live Stats (from Order table) - Only if needed
  let liveRevenue = 0;
  let liveCompletedOrders = 0;
  let liveTotalVolume = 0;
  let liveTrends: { date: Date; revenue: number; orders: number }[] = [];
  let liveOrderBreakdown: Record<string, number> = {};

  if (!isHistoricalOnly) {
    // Live Revenue
    const revenueAgg = await db.order.aggregate({
      where: {
        scheduledDate: { gte: liveStart, lte: endDate },
        status: OrderStatus.COMPLETED,
      },
      _sum: { totalAmount: true },
    });
    liveRevenue = Number(revenueAgg._sum.totalAmount || 0);

    // Live Completed Order Count
    const ordersAgg = await db.order.count({
      where: {
        scheduledDate: { gte: liveStart, lte: endDate },
        status: OrderStatus.COMPLETED,
      },
    });
    liveCompletedOrders = ordersAgg;

    // Live Total Volume (All Statuses)
    liveTotalVolume = await db.order.count({
      where: { scheduledDate: { gte: liveStart, lte: endDate } },
    });

    // Live Revenue Trend (Group by Date)
    const liveTrendRaw = await db.$queryRaw`
      SELECT
        DATE("scheduledDate") as date,
        SUM("totalAmount") as revenue,
        COUNT(*) as orders
      FROM "Order"
      WHERE "scheduledDate" >= ${liveStart}
        AND "scheduledDate" <= ${endDate}
        AND status = ${OrderStatus.COMPLETED}::"OrderStatus"
      GROUP BY DATE("scheduledDate")
      ORDER BY date ASC
    `;

    liveTrends = (liveTrendRaw as any[]).map((t) => ({
      date: new Date(t.date),
      revenue: Number(t.revenue || 0),
      orders: Number(t.orders || 0),
    }));

    // Live Order Status Breakdown
    const statusGroups = await db.order.groupBy({
      by: ['status'],
      where: {
        scheduledDate: { gte: liveStart, lte: endDate },
      },
      _count: { id: true },
    });

    for (const group of statusGroups) {
      liveOrderBreakdown[group.status] = group._count.id;
    }
  }

  // 3. Combine Data
  const totalRevenue = historicalRevenue + liveRevenue;
  const totalCompletedOrders = historicalCompletedOrders + liveCompletedOrders;
  const totalVolume = historicalTotalVolume + liveTotalVolume;

  // Previous period for comparison
  let prevDaysDiff = differenceInDays(endDate, startDate);
  if (prevDaysDiff === 0) prevDaysDiff = 1; // At least 1 day for comparison (e.g. Today vs Yesterday)

  // Actually, differenceInDays returns integer. If start=end (same day), diff is 0.
  // We want to subtract (diff + 1) days for strictly non-overlapping previous period of same duration?
  // Or just diff?
  // If range is [Today], length is 1 day. Prev should be [Yesterday].
  // If range is [Oct 1 - Oct 30], length is 30 days.
  // differenceInDays(Oct 30, Oct 1) = 29.
  // We want 30 days prior.
  // So prevDaysDiff should be `differenceInDays(...) + 1`.

  const periodLength = differenceInDays(endDate, startDate) + 1;
  const prevStartDate = subDays(startDate, periodLength);
  const prevEndDate = subDays(endDate, periodLength);

  const [
    // Overview KPIs
    totalCustomers,
    totalDrivers,

    // Previous period revenue
    prevRevenue,
    prevOrders,

    // Order breakdown
    ordersByStatus,
    ordersByPaymentMethod,

    // Cash management
    cashStats,
    cashOrdersCount,
    pendingHandovers,
    verifiedHandovers, // New: Verified Cash

    // Driver performance
    liveDriverPerformance,
    historicalDriverMetrics,

    // Bottle inventory
    bottleStats,
    productInventory,

    // Customer analytics
    newCustomers,
    customersByType,
    topCustomers,

    // Route performance
    routePerformance,

    // Profitability & Assets
    totalExpenses,
    totalReceivables,

    // Exceptions and alerts
    failedOrders,
    lowStockProducts,
    highCreditCustomers,
  ] = await Promise.all([
    // Total Active Customers
    db.customerProfile.count({
      where: { user: { isActive: true } },
    }),

    // Total Active Drivers
    db.driverProfile.count({
      where: { user: { isActive: true } },
    }),

    // Previous period revenue
    db.order.aggregate({
      where: {
        scheduledDate: { gte: prevStartDate, lte: prevEndDate },
        status: OrderStatus.COMPLETED,
      },
      _sum: { totalAmount: true },
    }),

    // Previous period orders (Volume)
    db.order.count({
      where: {
        scheduledDate: { gte: prevStartDate, lte: prevEndDate },
      },
    }),

    // Orders by status (Raw query for amounts)
    db.order.groupBy({
      by: ['status'],
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),

    // Orders by payment method
    db.order.groupBy({
      by: ['paymentMethod'],
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
        status: OrderStatus.COMPLETED,
      },
      _count: { id: true },
      _sum: { cashCollected: true },
    }),

    // Cash management stats (Expected from Orders)
    db.order.aggregate({
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
        status: OrderStatus.COMPLETED,
      },
      _sum: { cashCollected: true },
    }),

    // Count of orders where cash was collected
    db.order.count({
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
        status: OrderStatus.COMPLETED,
        cashCollected: { gt: 0 },
      },
    }),

    // Pending cash handovers (Current Status - Independent of date range usually, but here we query ALL pending)
    db.$queryRaw`
      SELECT COUNT(*) as count, SUM("actualCash") as amount
      FROM "CashHandover"
      WHERE status = 'PENDING'
    `,

    // Verified Cash Handovers (In the selected period)
    db.cashHandover.aggregate({
      where: {
        date: { gte: startDate, lte: endDate },
        status: CashHandoverStatus.VERIFIED,
      },
      _sum: { actualCash: true },
      _count: { id: true },
    }),

    // Driver performance (Live Data)
    db.order.groupBy({
      by: ['driverId'],
      where: {
        scheduledDate: { gte: liveStart, lte: endDate },
        status: OrderStatus.COMPLETED,
        driverId: { not: null },
      },
      _count: { id: true },
      _sum: { cashCollected: true, totalAmount: true },
    }),

    // Driver performance (Historical Data)
    !isLiveOnly
      ? db.driverPerformanceMetrics.groupBy({
          by: ['driverId'],
          where: {
            date: { gte: startDate, lte: historicalEnd },
          },
          _sum: {
            ordersCompleted: true,
            cashCollected: true,
            totalBilled: true,
          },
        })
      : Promise.resolve([]),

    // Bottle statistics
    db.orderItem.aggregate({
      where: {
        order: {
          scheduledDate: { gte: startDate, lte: endDate },
          status: OrderStatus.COMPLETED,
        },
      },
      _sum: { filledGiven: true, emptyTaken: true, damagedReturned: true, quantity: true },
    }),

    // Product inventory levels
    db.product.findMany({
      select: {
        id: true,
        name: true,
        stockFilled: true,
        stockEmpty: true,
        basePrice: true,
      },
      orderBy: { name: 'asc' },
    }),

    // New customers (current period)
    db.customerProfile.count({
      where: {
        user: {
          createdAt: { gte: startDate, lte: endDate },
        },
      },
    }),

    // Customers by type
    db.customerProfile.groupBy({
      by: ['type'],
      _count: { id: true },
    }),

    // Top customers by revenue
    db.order.groupBy({
      by: ['customerId'],
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
        status: OrderStatus.COMPLETED,
      },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10,
    }),

    // Route performance
    db.$queryRaw`
      SELECT
        r.name as "routeName",
        COUNT(o.id) as count,
        SUM(o."totalAmount") as revenue
      FROM "Order" o
      JOIN "CustomerProfile" c ON o."customerId" = c.id
      JOIN "Route" r ON c."routeId" = r.id
      WHERE o."scheduledDate" >= ${startDate}
        AND o."scheduledDate" <= ${endDate}
        AND o.status = ${OrderStatus.COMPLETED}::"OrderStatus"
      GROUP BY r.name
      ORDER BY revenue DESC
    `,

    // Total Expenses (Only APPROVED for Profit Calc)
    db.expense.aggregate({
      where: {
        date: { gte: startDate, lte: endDate },
        status: ExpenseStatus.APPROVED,
      },
      _sum: { amount: true },
    }),

    // Total Market Receivables (Sum of negative balances)
    // Note: We sum absolute value of negative balances
    db.customerProfile.aggregate({
      where: {
        cashBalance: { lt: 0 },
      },
      _sum: { cashBalance: true },
    }),

    // Failed/Cancelled orders
    db.order.findMany({
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
        status: { in: [OrderStatus.CANCELLED] },
      },
      select: {
        id: true,
        readableId: true,
        customer: {
          select: {
            user: { select: { name: true } },
          },
        },
        scheduledDate: true,
        totalAmount: true,
      },
      take: 10,
      orderBy: { scheduledDate: 'desc' },
    }),

    // Low stock products (< 20)
    db.product.findMany({
      where: {
        stockFilled: { lt: 20 },
      },
      select: {
        id: true,
        name: true,
        stockFilled: true,
        stockEmpty: true,
      },
      orderBy: { stockFilled: 'asc' },
    }),

    // High credit customers (approaching limit)
    db.customerProfile.findMany({
      where: {
        cashBalance: { lt: 0 },
      },
      select: {
        id: true,
        user: { select: { name: true, phoneNumber: true } },
        cashBalance: true,
        creditLimit: true,
      },
      orderBy: { cashBalance: 'asc' },
      take: 10,
    }),
  ]);

  // Combine Trends
  const combinedRevenueTrend = [...historicalTrends, ...liveTrends].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Combine Order Trends
  const combinedOrderTrends: any[] = [];

  if (!isLiveOnly) {
    const dailyStats = await db.dailyStats.findMany({
      where: {
        date: { gte: startDate, lte: historicalEnd },
      },
      orderBy: { date: 'asc' },
    });

    dailyStats.forEach((stat) => {
      combinedOrderTrends.push({
        date: format(stat.date, 'MMM dd'),
        [OrderStatus.COMPLETED]: stat.ordersCompleted,
        [OrderStatus.PENDING]: stat.ordersPending,
        [OrderStatus.CANCELLED]: stat.ordersCancelled,
        [OrderStatus.RESCHEDULED]: stat.ordersRescheduled,
      });
    });
  }

  // Fetch Live Order Status Trend
  if (!isHistoricalOnly) {
    const liveOrderTrendRaw = await db.$queryRaw`
      SELECT
        DATE("scheduledDate") as date,
        status,
        COUNT(*) as count
      FROM "Order"
      WHERE "scheduledDate" >= ${liveStart}
        AND "scheduledDate" <= ${endDate}
      GROUP BY DATE("scheduledDate"), status
      ORDER BY date ASC
    `;

    (liveOrderTrendRaw as any[]).forEach((curr) => {
      const dateStr = format(new Date(curr.date), 'MMM dd');
      let existing = combinedOrderTrends.find((i) => i.date === dateStr);
      if (!existing) {
        existing = { date: dateStr };
        combinedOrderTrends.push(existing);
      }
      existing[curr.status] = Number(curr.count || 0);
    });
  }

  // Merge Driver Performance
  const driverPerformanceMap = new Map<
    string,
    {
      driverId: string;
      completedOrders: number;
      cashCollected: number;
      revenue: number;
    }
  >();

  // Add Live Data
  liveDriverPerformance.forEach((d) => {
    if (d.driverId) {
      driverPerformanceMap.set(d.driverId, {
        driverId: d.driverId,
        completedOrders: d._count.id,
        cashCollected: parseFloat(d._sum.cashCollected?.toString() || '0'),
        revenue: parseFloat(d._sum.totalAmount?.toString() || '0'),
      });
    }
  });

  // Add Historical Data
  if (Array.isArray(historicalDriverMetrics)) {
    historicalDriverMetrics.forEach((d) => {
      const existing = driverPerformanceMap.get(d.driverId) || {
        driverId: d.driverId,
        completedOrders: 0,
        cashCollected: 0,
        revenue: 0,
      };

      existing.completedOrders += d._sum.ordersCompleted || 0;
      existing.cashCollected += parseFloat(d._sum.cashCollected?.toString() || '0');
      existing.revenue += parseFloat(d._sum.totalBilled?.toString() || '0');

      driverPerformanceMap.set(d.driverId, existing);
    });
  }

  const mergedDriverPerformance = Array.from(driverPerformanceMap.values());

  // Get driver details for performance
  const driverIds = mergedDriverPerformance.map((d) => d.driverId).filter(Boolean) as string[];
  const drivers = await db.driverProfile.findMany({
    where: { id: { in: driverIds } },
    select: {
      id: true,
      user: { select: { name: true } },
    },
  });

  // Get customer details for top customers
  const customerIds = topCustomers.map((c) => c.customerId);
  const customers = await db.customerProfile.findMany({
    where: { id: { in: customerIds } },
    select: {
      id: true,
      user: { select: { name: true } },
    },
  });

  // Calculate percentages and comparisons
  const currentRevenueValue = totalRevenue;
  const previousRevenueValue = parseFloat(prevRevenue._sum.totalAmount?.toString() || '0');
  const revenueChange = previousRevenueValue > 0 ? ((currentRevenueValue - previousRevenueValue) / previousRevenueValue) * 100 : 0;
  const ordersChange = prevOrders > 0 ? ((totalVolume - prevOrders) / prevOrders) * 100 : 0;

  // Calculate projected revenue (sum of ALL orders regardless of status)
  const projectedRevenue = ordersByStatus.reduce((sum, s) => sum + parseFloat(s._sum.totalAmount?.toString() || '0'), 0);

  // Calculate order pipeline breakdown
  const pendingStatuses = [OrderStatus.PENDING, OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS] as OrderStatus[];
  const issueStatuses = [OrderStatus.CANCELLED, OrderStatus.RESCHEDULED] as OrderStatus[];

  const pendingOrders = ordersByStatus
    .filter((s) => pendingStatuses.includes(s.status))
    .reduce((sum, s) => sum + s._count.id, 0);
  const issueOrders = ordersByStatus
    .filter((s) => issueStatuses.includes(s.status))
    .reduce((sum, s) => sum + s._count.id, 0);

  // Completion rate
  const completionRate = totalVolume > 0 ? (totalCompletedOrders / totalVolume) * 100 : 0;

  return {
    overview: {
      // Revenue metrics (clearly separated)
      realizedRevenue: currentRevenueValue, // Money from COMPLETED orders only
      projectedRevenue, // Total value of ALL orders (pipeline)
      revenueChange,

      // Order pipeline metrics
      totalOrders: totalVolume, // All orders booked
      completedOrders: totalCompletedOrders, // Orders delivered
      pendingOrders, // Orders still to deliver
      issueOrders, // Cancelled + Rescheduled
      completionRate, // % of orders completed
      ordersChange,

      // Customer & Driver counts
      totalCustomers,
      totalDrivers,
      newCustomers,

      // Average Order Value (based on COMPLETED orders only - makes sense)
      avgOrderValue: totalCompletedOrders > 0 ? currentRevenueValue / totalCompletedOrders : 0,

      // Profitability Metrics
      totalExpenses: parseFloat(totalExpenses._sum.amount?.toString() || '0'),
      netProfit: currentRevenueValue - parseFloat(totalExpenses._sum.amount?.toString() || '0'),

      // Asset Metrics
      totalReceivables: Math.abs(parseFloat(totalReceivables._sum.cashBalance?.toString() || '0')),

      // Legacy field for backward compatibility
      totalRevenue: currentRevenueValue,
    },
    orderStats: {
      byStatus: ordersByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        amount: parseFloat(s._sum.totalAmount?.toString() || '0'),
      })),
      byPaymentMethod: ordersByPaymentMethod.map((p) => ({
        method: p.paymentMethod,
        count: p._count.id,
        amount: parseFloat(p._sum.cashCollected?.toString() || '0'),
      })),
    },
    cashManagement: {
      totalCashCollected: parseFloat(cashStats._sum.cashCollected?.toString() || '0'),
      cashOrders: cashOrdersCount,
      pendingHandovers:
        Array.isArray(pendingHandovers) && pendingHandovers[0]
          ? {
              count: Number(pendingHandovers[0].count || 0),
              amount: parseFloat(pendingHandovers[0].amount?.toString() || '0'),
            }
          : { count: 0, amount: 0 },
      // New Field
      verifiedCash: parseFloat(verifiedHandovers._sum.actualCash?.toString() || '0'),
    },
    driverPerformance: mergedDriverPerformance
      .map((d) => {
        const driver = drivers.find((dr) => dr.id === d.driverId);
        return {
          driverId: d.driverId || '',
          driverName: driver?.user.name || 'Unknown',
          completedOrders: d.completedOrders,
          cashCollected: d.cashCollected,
          revenue: d.revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    bottleStats: {
      filledGiven: bottleStats._sum.filledGiven || 0,
      emptyTaken: bottleStats._sum.emptyTaken || 0,
      damagedReturned: bottleStats._sum.damagedReturned || 0,
      netDifference: (bottleStats._sum.filledGiven || 0) - (bottleStats._sum.emptyTaken || 0),
      totalQuantity: bottleStats._sum.quantity || 0,
    },
    inventory: productInventory.map((p) => ({
      id: p.id,
      name: p.name,
      stockFilled: p.stockFilled,
      stockEmpty: p.stockEmpty,
      basePrice: parseFloat(p.basePrice.toString()),
      totalValue: p.stockFilled * parseFloat(p.basePrice.toString()),
    })),
    trends: {
      revenue: combinedRevenueTrend.map((t) => ({
        date: format(new Date(t.date), 'MMM dd'),
        revenue: t.revenue,
        orders: t.orders,
      })),
      orders: combinedOrderTrends,
    },
    customerAnalytics: {
      byType: customersByType.map((c) => ({
        type: c.type,
        count: c._count.id,
      })),
      topCustomers: topCustomers
        .map((c) => {
          const customer = customers.find((cu) => cu.id === c.customerId);
          return {
            customerId: c.customerId,
            customerName: customer?.user.name || 'Unknown',
            totalRevenue: parseFloat(c._sum.totalAmount?.toString() || '0'),
            orderCount: c._count.id,
          };
        })
        .slice(0, 10),
    },
    alerts: {
      failedOrders: failedOrders.map((o) => ({
        id: o.id,
        readableId: o.readableId,
        customerName: o.customer.user.name,
        date: o.scheduledDate,
        amount: parseFloat(o.totalAmount.toString()),
      })),
      lowStockProducts: lowStockProducts,
      highCreditCustomers: highCreditCustomers.map((c) => ({
        id: c.id,
        name: c.user.name,
        phone: c.user.phoneNumber,
        balance: parseFloat(c.cashBalance.toString()),
        creditLimit: parseFloat(c.creditLimit.toString()),
        utilizationPercent: (Math.abs(parseFloat(c.cashBalance.toString())) / parseFloat(c.creditLimit.toString())) * 100,
      })),
    },
    routePerformance: (routePerformance as any[]).map((r) => ({
      name: r.routeName,
      count: Number(r.count),
      revenue: parseFloat(r.revenue?.toString() || '0'),
    })),
  };
}
