import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# 1. Fetch historical dailyStats once
content = content.replace(
"""  if (!isLiveOnly) {
    const dailyStats = await db.dailyStats.findMany({
      where: {
        date: {
          gte: startDate,
          lte: historicalEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    for (const stat of dailyStats) {""",
"""  let cachedDailyStats: any[] = [];
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
    cachedDailyStats = dailyStats;

    for (const stat of dailyStats) {"""
)

content = content.replace(
"""  if (!isLiveOnly) {
    const dailyStats = await db.dailyStats.findMany({
      where: {
        date: { gte: startDate, lte: historicalEnd },
      },
      orderBy: { date: 'asc' },
    });

    dailyStats.forEach((stat) => {""",
"""  if (!isLiveOnly) {
    cachedDailyStats.forEach((stat) => {"""
)

# 2. Combine previous period queries
content = content.replace(
"""    // Previous period revenue
    prevRevenue,
    prevOrders,""",
"""    // Previous period stats
    prevStats,"""
)

content = content.replace(
"""    // Previous period revenue
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
    }),""",
"""    // Previous period stats (Revenue + Volume combined)
    db.order.groupBy({
      by: ['status'],
      where: {
        scheduledDate: { gte: prevStartDate, lte: prevEndDate },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),"""
)

# 3. Derive cashStats in-memory
content = content.replace(
"""    // Cash management
    cashStats,
    cashOrdersCount,
    pendingHandovers,
    verifiedHandovers, // New: Verified Cash""",
"""    // Cash management
    cashOrdersCount,
    pendingHandovers,
    verifiedHandovers, // New: Verified Cash"""
)

content = content.replace(
"""    // Cash management stats (Expected from Orders)
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
    }),""",
"""    // Count of orders where cash was collected
    db.order.count({
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
        status: OrderStatus.COMPLETED,
        cashCollected: { gt: 0 },
      },
    }),"""
)

# 4. Derive lowStockProducts in-memory
content = content.replace(
"""    // Exceptions and alerts
    failedOrders,
    lowStockProducts,
    highCreditCustomers,
  ] = await Promise.all([""",
"""    // Exceptions and alerts
    failedOrders,
    highCreditCustomers,
  ] = await Promise.all(["""
)

content = content.replace(
"""    // Low stock products (< 20)
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

    // High credit customers (approaching limit)""",
"""    // High credit customers (approaching limit)"""
)

# Updating variable references later in the file
content = content.replace(
"""  const previousRevenueValue = parseFloat(prevRevenue._sum.totalAmount?.toString() || '0');
  const revenueChange = previousRevenueValue > 0 ? ((currentRevenueValue - previousRevenueValue) / previousRevenueValue) * 100 : 0;
  const ordersChange = prevOrders > 0 ? ((totalVolume - prevOrders) / prevOrders) * 100 : 0;""",
"""  const previousRevenueValue = prevStats
    .filter((s) => s.status === OrderStatus.COMPLETED)
    .reduce((sum, s) => sum + parseFloat(s._sum.totalAmount?.toString() || '0'), 0);
  const prevOrders = prevStats.reduce((sum, s) => sum + s._count.id, 0);

  const revenueChange = previousRevenueValue > 0 ? ((currentRevenueValue - previousRevenueValue) / previousRevenueValue) * 100 : 0;
  const ordersChange = prevOrders > 0 ? ((totalVolume - prevOrders) / prevOrders) * 100 : 0;

  // Derive cashStats from ordersByPaymentMethod
  const totalCashCollectedValue = ordersByPaymentMethod.reduce((sum, p) => sum + parseFloat(p._sum.cashCollected?.toString() || '0'), 0);

  // Derive lowStockProducts from productInventory
  const lowStockProducts = productInventory
    .filter(p => p.stockFilled < 20)
    .sort((a, b) => a.stockFilled - b.stockFilled)
    .map(p => ({
      id: p.id,
      name: p.name,
      stockFilled: p.stockFilled,
      stockEmpty: p.stockEmpty,
    }));"""
)

content = content.replace(
"""    cashManagement: {
      totalCashCollected: parseFloat(cashStats._sum.cashCollected?.toString() || '0'),""",
"""    cashManagement: {
      totalCashCollected: totalCashCollectedValue,"""
)


with open('src/features/dashboard/queries-comprehensive.ts', 'w') as f:
    f.write(content)
