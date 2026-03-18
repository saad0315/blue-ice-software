## 2025-03-18 - [Dashboard Query Consolidation]
**Learning:** Dashboard queries often run redundant parallel queries that can be derived from other grouped or comprehensive queries (e.g., extracting low stock products from the full product inventory or cash stats from grouped payment methods).
**Action:** When working on comprehensive dashboards, derive metrics in-memory from broader data fetches rather than making parallel DB calls, to minimize roundtrips and improve latency.
