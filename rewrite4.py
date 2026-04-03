import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# Fix `previousRevenueValue` and `prevOrders` which are still referencing `prevRevenue._sum` and `prevOrders`
content = content.replace("const previousRevenueValue = parseFloat(prevRevenue._sum.totalAmount?.toString() || '0');", "const previousRevenueValue = prevRevenueVal;")
content = content.replace("const ordersChange = prevOrders > 0 ? ((totalVolume - prevOrders) / prevOrders) * 100 : 0;", "const ordersChange = prevOrdersVal > 0 ? ((totalVolume - prevOrdersVal) / prevOrdersVal) * 100 : 0;")

with open('src/features/dashboard/queries-comprehensive.ts', 'w') as f:
    f.write(content)
