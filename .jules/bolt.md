## 2024-04-18 - Unused Database Queries for Granular Breakdowns
**Learning:** The dashboard previously ran parallel `groupBy` database queries (`statusGroups`) just to populate granular variables (`liveOrderBreakdown`, `historicalOrderBreakdown`) which were never actually used in the final response payload, creating hidden overhead.
**Action:** When auditing data aggregation functions, always trace local variables to the final return statement. Remove any variables and associated database queries that are computed but not returned.
