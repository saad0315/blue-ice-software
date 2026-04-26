## 2024-04-26 - [Investigating getDriverStats]
**Learning:** Found an opportunity to optimize `getDriverStats` in `src/features/driver-view/queries.ts` by combining multiple db.order.count and db.order.aggregate queries into fewer queries (e.g. `groupBy` payment methods, and `groupBy` status).
**Action:** Consolidate parallel DB calls.
