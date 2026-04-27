## 2024-05-24 - [Avoid N+1 queries by deriving metrics in memory]
**Learning:** We can optimize the `get /` route in `src/features/dashboard/server/route.ts` which runs `db.order.count()`, `db.order.count({ where: { status: ... } })`, and `db.order.aggregate(...)` in parallel alongside a `db.order.groupBy({ by: ['status'] })`.
**Action:** Replace `count` and `aggregate` queries with in-memory derivations from the `order.groupBy({ by: ['status'] })` and `db.$queryRaw` (daily revenue) queries to save 3 full database trips on the dashboard.
