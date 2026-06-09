## 2024-06-09 - Consolidate Multiple N+1 order.count() in getDriverStats
**Learning:** In `src/features/driver-view/queries.ts` inside `getDriverStats`, there are 5 individual `db.order.count()` calls for different statuses and 4 individual `db.order.aggregate()` calls for different payment methods. This creates a severe N+1 parallel query bottleneck since they all hit the same `order` table with the same base `driverId` and `scheduledDate` filters.
**Action:** Replace these multiple `count` and `aggregate` queries with single `db.order.groupBy` queries, and calculate the exact metrics locally in memory.

## 2024-06-09 - Consolidate Multiple N+1 queries in getDriverDetailStats
**Learning:** In `src/features/drivers/queries.ts` inside `getDriverDetailStats`, there are also 5 individual `db.order.count()` calls for different statuses all hitting the same base filters.
**Action:** Replace these multiple `count` queries with a single `db.order.groupBy` query, and calculate the counts locally in memory.
