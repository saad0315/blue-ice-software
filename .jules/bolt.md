## 2025-03-03 - [Optimize getDriverStats database queries]
**Learning:** Found an opportunity to replace multiple `.count` and `.aggregate` calls on the same entity with single `.groupBy` calls, reducing database round-trips. Specifically in `src/features/driver-view/queries.ts`, 5 parallel `.count` queries and 4 parallel `.aggregate` queries on `db.order` can be grouped.
**Action:** Replace multiple counts with a `status` groupBy, and multiple payment method aggregates with a `paymentMethod` groupBy, reducing 9 parallel queries down to 2.
