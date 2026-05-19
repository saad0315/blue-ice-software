## 2024-05-18 - [Parallel Queries Consolidation in Prisma]
**Learning:** Parallel `db.model.count()` and `db.model.aggregate()` queries that filter on the same base entity but with different conditions (e.g. status or payment methods) create unnecessary database overhead.
**Action:** When calculating metrics for different categories, consolidate multiple parallel queries into a single `db.model.groupBy()` query and calculate the aggregate totals in memory.
