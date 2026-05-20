## 2026-05-20 - Optimization: Remove Unused liveOrderBreakdown and historicalOrderBreakdown
**Learning:** Found two unused records `liveOrderBreakdown` and `historicalOrderBreakdown` in `src/features/dashboard/queries-comprehensive.ts` along with an associated `db.order.groupBy` query that creates unnecessary database overhead, as the dashboard refactored away from these detailed live vs historical status groups.
**Action:** Always audit unused variables to their final usage or lack thereof, and remove any local variables and DB queries calculating unneeded breakdowns.
