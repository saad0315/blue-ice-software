## 2024-03-24 - [Consolidating queries in Dashboard]
**Learning:** `Promise.all` executes queries concurrently but can still overload the database if too many aggregate queries are run against the same tables, especially large ones like `Order`.
**Action:** When calculating metrics derived from the same data set (e.g., `ordersByPaymentMethod` and `cashStats`), fetch the data once (with a single grouped query or fetching the set) and aggregate in-memory instead of running parallel, slightly different database aggregate queries.
