## 2024-05-19 - [Optimize getDriverStats Database Queries]
**Learning:** `getDriverStats` in `src/features/driver-view/queries.ts` makes 10 distinct `db.order.count()` and `db.order.aggregate()` calls to derive statuses and payment method totals. GroupBy wasn't used here yet.
**Action:** Consolidate these 9 parallel `order` queries into 2 `db.order.groupBy` calls (one for status counts, one for payment method totals) and derive the individual metrics in memory, drastically reducing database load.
