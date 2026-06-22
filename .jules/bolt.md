# Bolt Journal
## 2024-06-22 - [Performance: Dashboard Queries]
**Learning:** The dashboard endpoint `GET /` previously executed four parallel but redundant database queries against the `Order` table (two counts, one aggregate, one groupBy). Consolidating these into a single `db.order.groupBy` query and calculating the aggregates locally in memory significantly reduces database load and network roundtrips.
**Action:** When aggregating multiple metrics from the same table grouped by a common category (like `status`), use a single `groupBy` and compute derivative counts/sums in memory. Be sure to use `Prisma.Decimal` math (`.plus()`) for sum aggregations to preserve accuracy.
