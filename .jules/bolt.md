# Bolt's Journal - Critical Learnings

This journal records critical performance learnings, anti-patterns, and surprises specific to this codebase.

## 2024-10-18 - Dashboard Query Consolidation
**Learning:** `Promise.all` in dashboard queries can trigger connection pool limits if many small queries are fired.
**Action:** Consolidate queries using `groupBy` (e.g. for status/payment breakdown) and derive subset metrics (like "Low Stock") in memory if the parent set (All Products) is already being fetched. This reduced 3 DB calls in `getComprehensiveDashboardData`.
