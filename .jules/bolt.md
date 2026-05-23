## 2024-05-23 - Consolidating Prisma count/aggregate queries with groupBy
**Learning:** Performing multiple parallel `db.order.count` and `db.order.aggregate` calls to fetch various totals for a dashboard/driver-view creates unnecessary N+1-style concurrent DB load. Prisma's `groupBy` can retrieve all categories in a single query, significantly reducing the connection pool demand.
**Action:** Always prefer `groupBy` over parallel `count` and `aggregate` queries when summarizing counts/totals over distinct enums like `status` or `paymentMethod`.
