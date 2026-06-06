## 2024-05-19 - Batching parallel Prisma queries

**Learning:** Unnecessary parallelism of 9 aggregate queries `db.order.count` and `db.order.aggregate` in `getDriverStats` impacts database performance negatively.
**Action:** Combined them into 2 grouped queries (`db.order.groupBy`) and derived the metrics in-memory, avoiding extra round-trips to the DB. When testing Prisma aggregates like groupBy, check args locally in code.
