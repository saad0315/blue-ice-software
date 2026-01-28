## 2026-01-28 - Comprehensive Dashboard Query Pattern
**Learning:** The dashboard uses a single massive function `getComprehensiveDashboardData` that fires ~20 parallel queries. While `Promise.all` helps, redundant sub-queries (like separate aggregate/count calls for the same data) can easily slip in.
**Action:** When adding metrics to the dashboard, first check if the data can be derived from existing `groupBy` or `aggregate` results instead of adding new queries.
