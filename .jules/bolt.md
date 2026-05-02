## 2024-05-02 - Consolidate Parallel Prisma Queries
**Learning:** In the dashboard endpoints, executing multiple parallel `db.model.count()` and `db.model.aggregate()` queries against the same underlying table with different `where` clauses creates unnecessary database overhead, even when batched in `Promise.all`.
**Action:** Always check if multiple aggregates or counts can be consolidated into a single `db.model.groupBy` query with multiple select fields (e.g. `_count`, `_sum`). Compute the specific derived totals in-memory.
