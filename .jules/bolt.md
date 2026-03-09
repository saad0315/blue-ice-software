## 2024-03-09 - [Optimize Dashboard Queries]
**Learning:** Dashboard performance optimizations prioritize deriving multiple metrics (revenue, counts, low stock alerts, trends) from single `groupBy`, `aggregate`, or comprehensive list database queries (like `dailyStats.findMany`) instead of parallel redundant requests.
**Action:** When working on performance, look for opportunities to derive simple aggregates or filtered subsets from broader, already-fetched lists or \`groupBy\` results rather than dispatching separate database queries.

## $(date +%Y-%m-%d) - [Deriving specific subset counts from group queries]
**Learning:** You cannot accurately derive counts for specific conditions (e.g. `cashCollected > 0`) from a list that is grouped by another property (e.g. `paymentMethod`) because the condition evaluation requires row-level granularity, not group-level aggregates. Applying the condition to the group incorrectly flags the whole group.
**Action:** When deriving metrics in-memory, assure the source array has sufficient row-level granularity or exactly matches the aggregate dimensions required to derive the intended metric.
