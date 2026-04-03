## 2024-03-05 - [Dashboard Cash Metric Regression]
**Learning:** When deriving metrics in-memory to avoid redundant database queries, do not derive instance-level condition counts (e.g., `cashCollected > 0`) from aggregated `groupBy` results (e.g., `ordersByPaymentMethod`). Grouping inherently aggregates rows, making it impossible to evaluate conditions on individual instances without skewing the count.
**Action:** Preserve the explicit Prisma `.count()` query for metrics that rely on row-level conditions not captured by the aggregation keys.
