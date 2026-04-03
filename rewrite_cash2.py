import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# Add cashOrdersCount to the extracted vars array
content = content.replace('''    // Cash management
    pendingHandovers,
    verifiedHandovers,''', '''    // Cash management
    cashOrdersCount,
    pendingHandovers,
    verifiedHandovers,''')

# Add the explicit query back
content = content.replace('''    // Pending cash handovers (Current Status - Independent of date range usually, but here we query ALL pending)
    db.$queryRaw`
      SELECT COUNT(*) as count, SUM("actualCash") as amount
      FROM "CashHandover"
      WHERE status = 'PENDING'
    `,''', '''    // Count of orders where cash was collected
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
    `,''')

# Remove the in-memory cashOrdersCount derivation
content = re.sub(r"  const cashOrdersCount = ordersByPaymentMethod\n    \.reduce\(\(sum, p\) => sum \+ p\._count\.id, 0\);[^\n]*\n", "", content)

# Sort lowStockProducts
content = content.replace('''  // Derive lowStockProducts
  const lowStockProducts = productInventory.filter((p) => p.stockFilled < 20);''', '''  // Derive lowStockProducts
  const lowStockProducts = productInventory.filter((p) => p.stockFilled < 20).sort((a, b) => a.stockFilled - b.stockFilled);''')

with open('src/features/dashboard/queries-comprehensive.ts', 'w') as f:
    f.write(content)
