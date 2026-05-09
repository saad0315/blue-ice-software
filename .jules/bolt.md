## 2024-05-18 - [Optimize driver-view aggregate queries]
**Learning:** In the driver stats endpoint, executing multiple concurrent `.count()` and `.aggregate()` queries grouped on the same table filters (like `driverId` and `scheduledDate`) caused unnecessary database connections and overhead. Prisma can fetch all needed counts/sums more efficiently using a single `.groupBy()` query.
**Action:** When querying for metrics distributed across enumerations (like statuses and payment methods), prefer a single `.groupBy` with `_sum` or `_count` and aggregating the results in memory.
