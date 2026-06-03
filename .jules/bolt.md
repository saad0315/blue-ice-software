## 2024-05-20 - Consolidating Database Queries in getDriverStats
**Learning:** Found an N+1 query pattern where 9 parallel database queries (5 counts, 4 aggregates) were executed against the same `Order` table in `getDriverStats`. These can be efficiently consolidated into a single `groupBy` query.
**Action:** Replace multiple `count()` and `aggregate()` queries on the same table with a single `groupBy()` query and derive the specific aggregates in memory to minimize parallel DB connections and overhead.
