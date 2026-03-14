
## 2024-03-22 - Dashboard Queries Optimization
**Learning:** Replaced three database queries (`db.order.count()`, `db.order.count(active)`, `db.order.aggregate(totalAmount)`) with in-memory derivations from a single existing `db.order.groupBy` query in the dashboard's `/` route.
**Action:** Always check if summary stats (counts, sums) can be derived from existing grouped queries (`groupBy(status)`) instead of firing multiple separate queries.
