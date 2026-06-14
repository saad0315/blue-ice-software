## 2025-02-28 - Optimize getDriverStats queries
**Learning:** By replacing multiple parallel `.count()` and `.aggregate()` database queries that filter on the same base entity (like `Order`) with a single `.groupBy()` query, we can drastically reduce the number of database connections and roundtrips without changing the logic.
**Action:** Always look for parallel aggregate queries that share the same base conditions and replace them with Prisma `groupBy` queries, resolving the specific categories in-memory.
