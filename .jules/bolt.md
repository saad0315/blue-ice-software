## 2025-01-22 - Dashboard Optimization
**Learning:** `Promise.all` + `groupBy` with aggregations (`_sum`, `_count`) can replace multiple sequential `aggregate` and `count` queries, significantly reducing database roundtrips.
**Action:** Always check if multiple aggregates on the same table/filters can be combined into a single `groupBy` or `aggregate` call.
