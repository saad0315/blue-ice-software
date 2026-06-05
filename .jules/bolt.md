
## 2024-06-05 - Consolidating `db.order.count` and `aggregate` into single `db.order.groupBy` in `drivers/queries.ts`
**Learning:** `getDriverDetailStats` triggers 5 parallel `db.order.count` calls and 1 `db.order.aggregate` for overlapping periods. This leads to redundant full table/index scans for the same date range and driver.
**Action:** Replace multiple `.count` and `.aggregate` queries with a single `.groupBy` on `status` to get both counts and financial sums in one database roundtrip.
