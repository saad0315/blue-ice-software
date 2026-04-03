import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# 1. We will merge previous orders / revenue into `prevStats`
content = content.replace(
'''    // Previous period revenue
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
    }),''',
'''    // Previous period stats
    db.order.groupBy({
      by: ['status'],
      where: {
        scheduledDate: { gte: prevStartDate, lte: prevEndDate },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),'''
)

# 2. We remove redundant cash management stats, since we can get it from ordersByPaymentMethod
content = content.replace(
'''    // Cash management stats (Expected from Orders)
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
    }),''',
''''''
)

# 3. We remove low stock products since we can compute it from productInventory
content = content.replace(
'''    // Low stock products (< 20)
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
    }),''',
''''''
)

# 4. We want to move liveTrendRaw, liveOrderTrendRaw into Promise.all.
# But let's first update the list of variables unpacked from Promise.all.
# The original unpack:
'''
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
'''

unpack_old = '''  const [
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
  ] = await Promise.all(['''

unpack_new = '''  const [
    // Overview KPIs
    totalCustomers,
    totalDrivers,

    // Previous period stats
    prevStats,

    // Order breakdown
    ordersByStatus,
    ordersByPaymentMethod,

    // Cash management
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
    highCreditCustomers,

    // Trends
    liveTrendRaw,
    liveOrderTrendRaw,
    cachedDailyStats,
  ] = await Promise.all(['''

content = content.replace(unpack_old, unpack_new)

# Add liveTrendRaw, liveOrderTrendRaw, cachedDailyStats to Promise.all array
append_to_promise_all = '''  ]);'''

new_append_to_promise_all = '''
    // Trends
    !isHistoricalOnly
      ? db.$queryRaw`
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
        `
      : Promise.resolve([]),

    !isHistoricalOnly
      ? db.$queryRaw`
          SELECT
            DATE("scheduledDate") as date,
            status,
            COUNT(*) as count
          FROM "Order"
          WHERE "scheduledDate" >= ${liveStart}
            AND "scheduledDate" <= ${endDate}
          GROUP BY DATE("scheduledDate"), status
          ORDER BY date ASC
        `
      : Promise.resolve([]),

    !isLiveOnly
      ? db.dailyStats.findMany({
          where: {
            date: { gte: startDate, lte: historicalEnd },
          },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
  ]);'''

content = content.replace(append_to_promise_all, new_append_to_promise_all, 1) # Only replace the first occurrence (which is the end of Promise.all)

with open('src/features/dashboard/queries-comprehensive.ts', 'w') as f:
    f.write(content)
