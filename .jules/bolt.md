## 2024-05-03 - [Optimize Driver Stats DB Calls]
**Learning:** Functions like `getDriverStats` and `getDriverDetailStats` perform many parallel database calls for counts and aggregations on the same base `order` table with the same driver/date filters.
**Action:** Consolidate these multiple parallel `.count()` and `.aggregate()` database queries that filter on the same base entity into single `.groupBy()` queries and aggregate the specific category totals in-memory.
