# Bolt's Journal

## 2024-05-22 - [Prisma & Date Fns]
**Learning:** `date-fns` functions like `startOfDay` produce local time, while the database stores UTC. This mismatch can lead to incorrect data fetching when querying by date ranges.
**Action:** Always use `src/lib/date-utils.ts` (e.g., `toUtcStartOfDay`) for database queries to ensure consistent UTC handling.
