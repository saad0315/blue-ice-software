## 2024-03-24 - [Avoid Redundant DB Queries by Deriving Basic Counts in Memory]
**Learning:** In simple dashboard endpoints (like `GET /`), combining separate `db.order.count()` and `db.order.aggregate()` queries for order statuses and revenue into a single `db.order.groupBy` and deriving the totals in-memory significantly reduces DB load without adding noticeable application layer overhead.
**Action:** When calculating metrics grouped by status, sum up the total items and aggregate values directly in code using the group results instead of firing multiple separate queries.
