## 2026-04-17 - Driver Stats Query Optimization
**Learning:** We replaced 9 individual count and aggregate queries with just 2 groupBy queries in `getDriverStats` to significantly improve performance.
**Action:** When gathering multiple counts or sums grouped by categories (like status or payment method) for the same base entity, always use `groupBy` over individual `.count()` and `.aggregate()` queries.
