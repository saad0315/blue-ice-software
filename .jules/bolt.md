## 2024-03-24 - Dashboard Derivation Insight
**Learning:** Database queries can often be consolidated by performing larger `groupBy` or `aggregate` queries and deriving the counts/sums in memory, which significantly reduces the number of parallel queries going to the DB.
**Action:** When seeing multiple `count` or `aggregate` queries on the same table grouped by different statuses, replace them with a single `groupBy` and in-memory derivation.
