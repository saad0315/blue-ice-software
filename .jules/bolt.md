## 2024-05-22 - Optimize Driver Queries by Consolidating Parallel Counts
**Learning:** Performing multiple parallel `.count()` and `.aggregate()` queries with varying `where` clauses on the same base entity causes unnecessary database overhead and connection usage.
**Action:** Consolidate multiple parallel `.count()` and `.aggregate()` queries into a single `.groupBy()` query grouping by relevant fields (e.g. `status`, `paymentMethod`), and then aggregate the detailed categorised sums/counts in-memory.
