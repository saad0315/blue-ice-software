## 2024-04-10 - [Dashboard Metrics Query Consolidation]
**Learning:** Dashboard metrics (total orders, active orders, total revenue) were being calculated using multiple redundant Prisma queries (`count`, `aggregate`) alongside a `groupBy` query on the same `status` field.
**Action:** When a `groupBy` query exists for a categorical field, derive overall counts and specific categorical aggregations (like revenue for a specific status) in-memory from the grouped results rather than running separate database queries, minimizing database roundtrips.
