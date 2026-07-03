
## 2024-05-18 - Replacing multiple Prisma count/aggregates with groupBy
**Learning:** Found an anti-pattern in the codebase where developers use `Promise.all` with multiple `db.model.count()` and `db.model.aggregate()` queries that share identical base `where` filters but filter on a single enum field (like `status` or `paymentMethod`). This causes a hidden N+1 query overhead.
**Action:** Always replace these sets of parallel identical-base queries with a single `db.model.groupBy({ by: ['field'], ... })` call, then iterate the result in-memory to accumulate the various counts/aggregates.
