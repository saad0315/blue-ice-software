1. **Optimize `src/features/dashboard/server/route.ts`**
   - Use `replace_with_git_merge_diff` to merge multiple `db.order.count()` calls into a single `db.order.groupBy()` call based on the `status` field.
   - Combine the current `db.order.count()`, `db.order.count({ where: { status: { notIn: [COMPLETED, CANCELLED] } } })`, and `db.order.groupBy({ by: ['status'] })` into one `groupBy` execution.
   - Sum up the values in memory to get total `orderCount` and `activeOrderCount`.

2. **Verify tests and pre-commit checks**
   - Run `bun run test:unit` to ensure everything passes.
   - Run `bun run prettier --write src/features/dashboard/server/route.ts`
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

3. **Submit the PR**
   - Run `submit` tool with title "⚡ Bolt: [performance improvement] Consolidate Dashboard queries".
