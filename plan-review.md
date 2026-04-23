1. **Analyze the Problem**:
In `src/features/dashboard/server/route.ts`, the dashboard API currently executes four database queries for `Order` entities in parallel using `Promise.all`:
  - `db.order.count()`
  - `db.order.count({ where: { status: { notIn: [COMPLETED, CANCELLED] } } })`
  - `db.order.aggregate({ where: { status: COMPLETED }, _sum: { totalAmount: true } })`
  - `db.order.groupBy({ by: ['status'], _count: { id: true } })`

2. **The Fix**:
Following the instructions from the `.jules/bolt.md` performance journal:
> **Learning:** We can consolidate multiple parallel database queries like `db.model.count()` and `db.model.aggregate()` into a single `db.model.groupBy()` query and compute the corresponding metrics in-memory from the aggregated result.

I will update the `db.order.groupBy` query to also sum `totalAmount`:
```typescript
db.order.groupBy({
  by: ['status'],
  _count: {
    id: true,
  },
  _sum: {
    totalAmount: true,
  },
})
```

Then I will extract `orderCount`, `activeOrderCount`, and `totalRevenue` from this `orderStatusDistribution` in memory:
```typescript
let orderCount = 0;
let activeOrderCount = 0;
let totalRevenue = new Prisma.Decimal(0);

orderStatusDistribution.forEach((item) => {
  orderCount += item._count.id;
  if (item.status !== OrderStatus.COMPLETED && item.status !== OrderStatus.CANCELLED) {
    activeOrderCount += item._count.id;
  }
  if (item.status === OrderStatus.COMPLETED && item._sum.totalAmount) {
    totalRevenue = totalRevenue.add(item._sum.totalAmount);
  }
});
```

This will eliminate 3 independent aggregate queries on the `Order` table, significantly reducing database load.

3. **Verify the Fix**: I will run tests using `bun run test:unit`. Since this modifies an API route that may not have direct unit tests, I will also typecheck.

4. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**

5. **Submit a Pull Request**. I will formulate a commit with title `⚡ Bolt: [performance improvement] In-memory derivation for metrics` and create the PR.
