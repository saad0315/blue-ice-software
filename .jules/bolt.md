## 2024-03-XX - [Driver Stats Unnecessary Database Queries Optimization]
**Learning:** `getDriverStats` and `getDriverDetailStats` methods in `src/features/driver-view/queries.ts` and `src/features/drivers/queries.ts` are making unoptimized multiple parallel `.count()` and `.aggregate()` calls on the same table with similar filters.
**Action:** Replace unoptimized parallel `.count()` and `.aggregate()` calls by grouping them with `.groupBy()` and deriving totals and breakdowns locally to minimize database load.
