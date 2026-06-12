## 2024-05-18 - Replacing parallel DB aggregations with groupBy + in-memory mapping

**Learning:** `src/features/driver-view/queries.ts` (and `src/features/drivers/queries.ts`) performs ~10-12 concurrent queries (`.count()`, `.aggregate()`) per request to compute driver statistics. All these queries target the same table (`Order`) and the same driver/date boundary, just filtering on `status` or `paymentMethod`.
This causes a high load on the DB for a single request, creating an N+1 queries-like pattern with aggregates. Replacing these with 1-2 `db.order.groupBy` queries (grouping by `status` or `paymentMethod`) and mapping them locally in memory is significantly faster and more scalable.

**Action:** Consolidate concurrent `.count()` and `.aggregate()` calls on the same base entity into `.groupBy` with in-memory derivation where it makes sense (especially in dashboard or stats views). Use `Prisma.Decimal` properly when aggregating sums.
