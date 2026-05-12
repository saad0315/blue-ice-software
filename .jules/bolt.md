
## 2024-06-25 - [Optimize parallel db.count and db.aggregate queries]
**Learning:** When generating multiple parallel count or aggregate queries with the same base table but different `status` or enum condition (e.g. `completedOrders`, `pendingOrders`), it is much faster and more efficient to perform a single `db.model.groupBy` query over the enum and compute the derivations in-memory rather than sending 4-7 parallel DB roundtrips.
**Action:** Replace parallel `db.count()` or `db.aggregate()` calls matching only on distinct states with a single `db.groupBy()` query on those states. Extract the specific counts/sums locally by looping over the returned grouped result.
