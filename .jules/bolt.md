## 2024-05-18 - [Optimize Prisma Queries with groupBy]
**Learning:** In Prisma, replacing multiple parallel `.count()` and `.aggregate()` queries with a single `.groupBy()` query significantly reduces database connections and query round-trips, improving performance.
**Action:** When gathering metrics that group by a specific field (like `status` or `paymentMethod`), use a single `groupBy` query and derive the individual metrics in-memory instead of executing multiple parallel queries.
