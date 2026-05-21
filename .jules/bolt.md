## 2024-05-21 - Optimize getDriverDetailStats and getDriverStats
**Learning:** Found multiple parallel `.count()` and `.aggregate()` queries in `getDriverDetailStats` and `getDriverStats` that target the exact same table (`db.order`) with the exact same base conditions but different `status` or `paymentMethod` filters.
**Action:** Consolidate these queries into a single `db.order.groupBy()` for `status` (for counts) and `paymentMethod` (for financial aggregates) where applicable, and then derive the granular metrics in memory to significantly reduce database overhead.
