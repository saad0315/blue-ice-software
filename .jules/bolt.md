## 2025-05-15 - [Consolidating Parallel Queries into Prisma groupBy]
**Learning:** This codebase previously had a pattern of using many parallel `db.model.count` and `db.model.aggregate` queries inside `Promise.all` for retrieving metrics. This created unneeded database load and network overhead.
**Action:** Replace multiple parallel queries that filter on the same base entity with a single `db.model.groupBy` query and calculate totals in-memory for better performance and fewer DB connections.
