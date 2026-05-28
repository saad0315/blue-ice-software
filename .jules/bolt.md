
## 2024-05-28 - Optimize Driver Stats Queries
**Learning:** Consolidating multiple `db.model.count()` and `db.model.aggregate()` queries that filter on the same base entity into single `db.model.groupBy()` queries and aggregating the category totals in-memory significantly reduces the number of parallel database queries.
**Action:** When calculating multiple specific status counts or category sums for a single entity type, default to using a single `.groupBy()` query followed by an in-memory aggregation loop, rather than firing numerous individual aggregate/count queries.
