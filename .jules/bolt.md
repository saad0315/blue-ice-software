## 2024-03-01 - Removed unused variables in dashboard query
**Learning:** Found two unused local variables `liveOrderBreakdown` and `historicalOrderBreakdown` in `src/features/dashboard/queries-comprehensive.ts` that accumulated data but were never used or returned by the function. Removing them saves CPU cycles, memory, and code size.
**Action:** Always check if variables populated inside loops or db aggregations are actually used in the function's return object.
