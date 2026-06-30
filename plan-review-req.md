The task is to find and implement a performance optimization in the codebase.

In `src/features/drivers/queries.ts` within the `getDriverDetailStats` function (around line 300), there are currently 5 separate `.count()` database queries run in parallel:
```typescript
    // Order counts for selected period
    db.order.count({ where: whereCondition }),
    db.order.count({ where: completedWhereCondition }),
    db.order.count({ where: { ...whereCondition, status: { in: [OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS] } } }),
    db.order.count({ where: { ...whereCondition, status: OrderStatus.CANCELLED } }),
    db.order.count({ where: { ...whereCondition, status: OrderStatus.RESCHEDULED } }),
```
These queries all filter on the same `driverId` and `scheduledDate` range, and simply count orders based on their status. This introduces an N+1 query problem, increasing the database round-trips and load.

My plan is to:
1. Replace these 5 parallel `.count()` queries with a single `db.order.groupBy` query, grouped by `status`, and aggregating `_count.id` for each status. This will significantly reduce database calls.
2. The `groupBy` result will be parsed in memory to assign the correct values to `completedOrders`, `pendingOrders`, `cancelledOrders`, `rescheduledOrders`, and calculate the sum for `totalOrders`.
3. Then I will test to ensure it compiles correctly and tests pass.
