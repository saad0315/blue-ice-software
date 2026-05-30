## 2024-05-30 - Unused Query Elimination in Dashboard
**Learning:** The dashboard data aggregation avoids calculating `historicalOrderBreakdown` and `liveOrderBreakdown` via `statusGroups` queries, as these specific granular breakdowns are unused and create unnecessary database overhead.
**Action:** To prevent hidden database overhead, regularly audit data aggregation functions to trace local variables to their final return statement, removing any variables and associated database queries (e.g., `groupBy`) that are computed but ultimately unused in the response payload.
