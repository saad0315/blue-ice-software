import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# We can remove the old declarations
old_vars = """// We derive totalRevenue, totalCompletedOrders, and totalVolume from ordersByStatus after Promise.all
  const totalRevenue = historicalRevenue + liveRevenue;
  const totalCompletedOrders = historicalCompletedOrders + liveCompletedOrders;
  const totalVolume = historicalTotalVolume + liveTotalVolume;"""

content = content.replace(old_vars, "// We derive totalRevenue, totalCompletedOrders, and totalVolume from ordersByStatus after Promise.all")

with open('src/features/dashboard/queries-comprehensive.ts', 'w') as f:
    f.write(content)
