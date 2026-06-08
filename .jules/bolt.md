## 2024-05-30 - Optimize getDriverStats using groupBy
**Learning:** The `getDriverStats` and `getDriverDetailStats` functions in `src/features/driver-view/queries.ts` and `src/features/drivers/queries.ts` make many parallel `count()` and `aggregate()` queries. These can be consolidated into single `groupBy()` queries.
**Action:** Replace multiple `.count()` and `.aggregate()` calls that query the exact same table/filters by using `.groupBy()` and accumulating totals locally in memory to reduce database hits and latency.
