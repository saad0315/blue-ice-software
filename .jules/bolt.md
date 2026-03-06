## 2025-03-06 - Combine comprehensive queries in-memory derivations
**Learning:** Found redundant DB calls `cashStats` and `lowStockProducts` being performed in `Promise.all` alongside `ordersByPaymentMethod` and `productInventory`.
**Action:** Replaced database queries with in-memory array filtering and reducing to improve dashboard performance and avoid unnecessary DB latency.
