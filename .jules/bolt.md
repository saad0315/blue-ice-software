## 2024-03-XX - Unoptimized Parallel Count Queries
**Learning:** Found multiple parallel `.count()` queries filtering on the same base condition but different statuses (e.g., `src/features/drivers/queries.ts` lines 306-310). This creates N+1 query overhead for the database.
**Action:** Consolidate these into a single `.groupBy({ by: ['status'] })` query to fetch all counts in one round trip, aggregating the results in-memory.
