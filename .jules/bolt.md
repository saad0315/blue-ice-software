## 2023-10-27 - [Optimize Dashboard Metrics Query]
**Learning:** Derived metrics (e.g., total counts, condition-based counts, sums) can often be calculated in-memory from a single database query like `groupBy`, rather than requiring multiple separate aggregate queries, reducing the database load without sacrificing precision.
**Action:** When working with metrics, evaluate if multiple `count()` or `aggregate()` queries can be consolidated into a single `groupBy` and processed in-memory for better performance.
