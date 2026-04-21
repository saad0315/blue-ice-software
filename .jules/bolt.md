## 2024-04-21 - Consolidate Prisma counts and aggregates
**Learning:** In Prisma, multiple `count()` and `aggregate()` queries on the same table can often be consolidated into a single `groupBy` query. You can sum `_count` and specific metrics grouped by a field (like `status`) and then compute the total/filtered metrics in-memory, reducing database load.
**Action:** Always check if parallel `.count()` or `.aggregate()` queries can be folded into an existing `.groupBy()` to minimize the number of database queries executed.
