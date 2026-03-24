
## 2025-03-24 - [Optimize Comprehensive Dashboard Query]
**Learning:** This codebase uses parallel redundant DB aggregate queries in dashboard features which slows down performance. We can consolidate `count`, `aggregate`, and `findMany` into single comprehensive `groupBy` queries or reuse cached queries using in-memory `.reduce`, `.map`, and `.filter` to lower parallel DB strain significantly.
**Action:** When working on dashboard metrics, favor querying a full comprehensive dataset once and deriving granular counts, sums, and lists strictly in application logic instead of running parallel specific DB aggregations.
