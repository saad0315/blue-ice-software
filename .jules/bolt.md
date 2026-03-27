## 2024-03-27 - [Avoid redundant findMany queries]
**Learning:** The `getComprehensiveDashboardData` function performs multiple redundant requests or identical database queries for same resources.
**Action:** When calculating metrics, reuse already fetched results if possible.
