## 2024-05-18 - Removed unused OrderStatus metrics
**Learning:** Avoid calculating internal granular statistics across arrays (e.g. `historicalOrderBreakdown` and `liveOrderBreakdown` in `src/features/dashboard/queries-comprehensive.ts`) when they are completely unreferenced in the returned response. Grouping and iteration creates unnecessary CPU overhead for data that is never surfaced to the UI.
**Action:** Audit data aggregation to trace local variables to their return value and remove unreferenced computation blocks and DB queries before presenting data.
