## 2024-10-24 - [Driver Stats Optimization]
**Learning:** Using multiple parallel `db.order.count()` and `db.order.aggregate()` calls causes unnecessary database overhead and connection usage when the data can be derived from a single `groupBy` query.
**Action:** Consolidate multiple counts and aggregates into fewer `groupBy` queries and calculate the specific metrics in-memory.