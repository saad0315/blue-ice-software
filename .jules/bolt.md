## 2024-03-24 - [Optimize getDriverStats Database Queries]
**Learning:** Consolidating multiple `.count()` and `.aggregate()` queries on the same table into single `.groupBy()` queries, then processing the results in memory, significantly reduces database roundtrips and optimizes resource usage for backend metrics aggregations.
**Action:** Always look for opportunities to replace parallel database requests querying the same base entity with `.groupBy()` approaches for improved backend performance.
