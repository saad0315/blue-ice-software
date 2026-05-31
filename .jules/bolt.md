## 2024-05-18 - [Optimize driver stat aggregations]
**Learning:** Consolidating parallel `db.model.count()` and `db.model.aggregate()` queries into single `db.model.groupBy()` queries and calculating metrics in-memory significantly reduces database load and parallel query bottlenecks in dashboard-heavy pages.
**Action:** Always look for opportunities to replace multiple `.count()` calls on the same model with a single `.groupBy({ by: ['status'] })` and aggregate the conditions in application memory.
