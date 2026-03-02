
## 2024-03-02 - [Dashboard Metrics Optimization]
**Learning:** The simple dashboard endpoint (`GET /api/dashboard`) was making up to 6 parallel database queries. Four of these were fetching metrics (count, active order count, total revenue, status distribution) that could all be derived from a single `db.order.groupBy` query counting orders and summing revenue grouped by `status`.
**Action:** When calculating overview metrics (totals and active counts), look for an opportunity to derive them in-memory from an existing `groupBy` distribution query to eliminate redundant database round-trips.
