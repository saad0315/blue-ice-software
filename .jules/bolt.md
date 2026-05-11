## 2026-05-11 - [Consolidate Order Queries in Dashboard]
**Learning:** Multiple parallel `.count()` and `.aggregate()` Prisma queries on the same table (e.g., `Order`) can often be replaced by a single `.groupBy()` query. This avoids redundant round trips and database scans.
**Action:** When filtering or aggregating the same table by different statuses, use `groupBy` and derive the specific metrics (like total counts, active counts, revenue) in-memory.
