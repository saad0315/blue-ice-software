## 2026-04-15 - Optimize getDriverStats queries
**Learning:** The `getDriverStats` function runs 5 separate `db.order.count` queries and 4 separate `db.order.aggregate` queries in parallel. This is 9 database calls that can be reduced to just 2 `db.order.groupBy` calls.
**Action:** Replace multiple count and aggregate queries with groupBy queries to minimize database roundtrips and derive the metrics in-memory.
