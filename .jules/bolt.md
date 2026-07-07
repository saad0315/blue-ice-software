## 2024-07-07 - Consolidating Prisma count/aggregate into groupBy
**Learning:** Multiple parallel `db.model.count()` and `db.model.aggregate()` database queries that filter on the same base entity can cause unnecessary database roundtrips.
**Action:** Replace unoptimized parallel `.count()` and `.aggregate()` calls by deriving total orders, status-specific counts, and aggregates in-memory from `db.model.groupBy` queries to minimize database load.
