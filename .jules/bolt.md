## 2024-10-24 - [Dashboard Performance]
**Learning:** Found sequential execution of 5 independent DB queries in `getComprehensiveDashboardData`. Also discovered `date-fns` is missing from package.json but used in source, requiring mocks in tests.
**Action:** Always check for `Promise.all` opportunities in data fetching functions. Mock implicitly available dependencies in unit tests.
