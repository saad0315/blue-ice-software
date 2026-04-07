## 2025-02-23 - [Dashboard Revenue Stats Optimization]
**Learning:** Consolidating Prisma count and aggregate queries into an existing groupBy query and extracting metrics in-memory significantly reduces DB overhead and network roundtrips.
**Action:** Always check if scalar metrics (counts, sums) can be safely and efficiently derived from a broader groupBy query running concurrently before firing separate queries for them.
