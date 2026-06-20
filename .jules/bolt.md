## 2024-05-18 - [Parallel Query Optimizations]
**Learning:** Found multiple parallel unoptimized `.count()` and `.aggregate()` calls on `db.order` inside `getDriverStats` which are being executed independently despite filtering by exactly the same base `driverId` and `scheduledDate` conditions.
**Action:** When replacing unoptimized parallel `.count()` or `.aggregate()` database calls on the same base entity, derive specific group totals locally in memory from a single `db.order.groupBy` query to reduce database request overhead.
