## 2024-05-24 - GroupBy over parallel counts
**Learning:** This codebase's dashboard and metrics queries often make 5-10 parallel `db.model.count()` and `db.model.aggregate()` queries against the same table/timeframe just to get numbers for different statuses or payment methods. This causes unnecessary database load and latency due to multiple roundtrips and repeated query planning.
**Action:** Replace parallel `.count()` and `.aggregate()` calls that share the same base `where` condition with a single `.groupBy()` query, summing or mapping the results in memory.
