## 2024-05-22 - Dashboard Performance Optimization
**Learning:** Sequential await calls in dashboard logic (Step 1 -> Step 2 -> Promise.all) create massive latency, especially when Step 2 itself contains sequential queries.
**Action:** Always audit `Promise.all` usage to ensure *all* independent queries are included, not just the ones at the end of the function. Look for redundant queries that fetch data already available in other queries (e.g. `aggregate` vs `groupBy`).
