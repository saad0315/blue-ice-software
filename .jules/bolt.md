## 2024-05-18 - [Parallel unoptimized count queries in getDriverDetailStats & getDriverStats]
**Learning:** Found multiple parallel unoptimized `.count()` and `.aggregate()` queries based on the same base condition (e.g. `db.order.count({ where: ... status: ... })`). This creates unnecessary overhead. We can use `.groupBy` and sum it all up in-memory!
**Action:** Replace parallel count/aggregate queries on the same table with a single `.groupBy` call and aggregate the results in-memory.
