## 2026-05-25 - Consolidate dashboard queries
**Learning:** In the basic dashboard route, running multiple overlapping `db.order.count` and `db.order.aggregate` queries alongside `db.order.groupBy` creates unnecessary database overhead.
**Action:** Replaced the redundant counts and aggregate with a single `db.order.groupBy` that fetches both count and sum of totalAmount per status, then derive the overall metrics in memory.
