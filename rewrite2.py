import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# We need to remove the top part of the function where it calculates:
# historicalRevenue, liveRevenue, etc. and instead just compute it from ordersByStatus

# Let's see what is there before Promise.all
# We can just remove the whole "Fetch Historical Stats" and "Fetch Live Stats" blocks entirely.
# They are not used anymore after we refactor.

pattern_to_remove = r"// 1\. Fetch Historical Stats \(from DailyStats\).*?// 3\. Combine Data\n"
content = re.sub(pattern_to_remove, "// We derive totalRevenue, totalCompletedOrders, and totalVolume from ordersByStatus after Promise.all\n", content, flags=re.DOTALL)

with open('src/features/dashboard/queries-comprehensive.ts', 'w') as f:
    f.write(content)
