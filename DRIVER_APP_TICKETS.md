# Driver App - Implementation Tickets
## Step-by-Step Technical Tasks

---

## Phase 1: Order Visibility Fix (Critical)

### Ticket 1.1: Add Issues Tab to Deliveries Page
**File:** `src/app/(driver)/deliveries/page.tsx`

**Current Problem:**
```typescript
// Sirf yeh 2 filter hain
const pendingOrders = orders?.filter(o => o.status === 'PENDING' || o.status === 'IN_PROGRESS');
const completedOrders = orders?.filter(o => o.status === 'COMPLETED');
// CANCELLED aur RESCHEDULED ka koi filter nahi
```

**Implementation:**
```typescript
// 1. Tab state add karo
const [activeTab, setActiveTab] = useState<'todo' | 'done' | 'issues'>('todo');

// 2. Issues filter add karo
const issueOrders = orders?.filter(o =>
  o.status === 'CANCELLED' || o.status === 'RESCHEDULED'
);

// 3. Tab counts
const counts = {
  todo: pendingOrders?.length || 0,
  done: completedOrders?.length || 0,
  issues: issueOrders?.length || 0,
};

// 4. UI mein 3 tabs render karo
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="todo">To Do ({counts.todo})</TabsTrigger>
    <TabsTrigger value="done">Done ({counts.done})</TabsTrigger>
    <TabsTrigger value="issues">Issues ({counts.issues})</TabsTrigger>
  </TabsList>
</Tabs>
```

---

### Ticket 1.2: Update Driver Stats Query
**File:** `src/features/driver-view/queries.ts`

**Current Problem:**
```typescript
// Sirf 2 counts return ho rahe hain
return {
  totalOrders: orders.length,
  pendingOrders: pending.length,
  completedOrders: completed.length,
  // cancelled aur rescheduled missing
};
```

**Implementation:**
```typescript
export const getDriverStats = async (driverId: string, date: string) => {
  const orders = await prisma.order.findMany({
    where: { driverId, scheduledDate: date }
  });

  const pending = orders.filter(o =>
    o.status === 'PENDING' || o.status === 'IN_PROGRESS'
  );
  const completed = orders.filter(o => o.status === 'COMPLETED');
  const cancelled = orders.filter(o => o.status === 'CANCELLED');
  const rescheduled = orders.filter(o => o.status === 'RESCHEDULED');

  return {
    totalOrders: orders.length,
    pendingOrders: pending.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,      // NEW
    rescheduledOrders: rescheduled.length,  // NEW
    // ... baqi calculations
  };
};
```

---

### Ticket 1.3: Create Issue Order Card Component
**File:** `src/features/driver-view/components/issue-order-card.tsx` (NEW)

**Purpose:** Cancelled/Rescheduled orders ke liye special card jo reason dikhaye

**Implementation:**
```typescript
interface IssueOrderCardProps {
  order: Order;
}

export const IssueOrderCard = ({ order }: IssueOrderCardProps) => {
  const isCancelled = order.status === 'CANCELLED';
  const isRescheduled = order.status === 'RESCHEDULED';

  return (
    <Card className={cn(
      isCancelled && 'border-red-500/50 bg-red-500/5',
      isRescheduled && 'border-purple-500/50 bg-purple-500/5'
    )}>
      {/* Status Badge */}
      <Badge variant={isCancelled ? 'destructive' : 'secondary'}>
        {isCancelled ? 'Cancelled' : 'Rescheduled'}
      </Badge>

      {/* Customer Info */}
      <div>{order.customer.name}</div>
      <div>{order.customer.address}</div>

      {/* Reason - Important! */}
      <div className="mt-2 p-2 bg-muted rounded">
        <span className="text-muted-foreground">Reason:</span>
        <span>{order.cancellationReason}</span>
      </div>

      {/* Driver Notes */}
      {order.driverNotes && (
        <div className="text-sm text-muted-foreground">
          Notes: {order.driverNotes}
        </div>
      )}

      {/* Reschedule Date */}
      {isRescheduled && order.rescheduledToDate && (
        <div className="text-purple-600">
          📅 New Date: {format(order.rescheduledToDate, 'dd MMM yyyy')}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs text-muted-foreground">
        {isCancelled ? 'Cancelled' : 'Rescheduled'} at: {format(order.updatedAt, 'h:mm a')}
      </div>
    </Card>
  );
};
```

---

### Ticket 1.4: Add Optimistic Update to Unable-to-Deliver
**File:** `src/features/driver-view/api/use-unable-to-deliver.ts`

**Current Problem:** Order status update ke baad page refresh karna padta hai

**Implementation:**
```typescript
export const useUnableToDeliver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markOrderUnableToDeliver,

    // OPTIMISTIC UPDATE - Turant UI update
    onMutate: async (variables) => {
      // 1. Ongoing queries cancel karo
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      await queryClient.cancelQueries({ queryKey: ['driver-stats'] });

      // 2. Previous state save karo (rollback ke liye)
      const previousOrders = queryClient.getQueryData(['orders']);
      const previousStats = queryClient.getQueryData(['driver-stats']);

      // 3. Orders cache update karo
      queryClient.setQueryData(['orders'], (old: Order[]) =>
        old?.map(order =>
          order.id === variables.orderId
            ? {
                ...order,
                status: variables.action === 'RESCHEDULE' ? 'RESCHEDULED' : 'CANCELLED',
                cancellationReason: variables.reason,
                driverNotes: variables.notes,
                rescheduledToDate: variables.rescheduleDate,
                updatedAt: new Date().toISOString(),
              }
            : order
        )
      );

      // 4. Stats cache update karo
      queryClient.setQueryData(['driver-stats'], (old: any) => ({
        ...old,
        pendingOrders: old.pendingOrders - 1,
        cancelledOrders: variables.action === 'CANCEL'
          ? (old.cancelledOrders || 0) + 1
          : old.cancelledOrders,
        rescheduledOrders: variables.action === 'RESCHEDULE'
          ? (old.rescheduledOrders || 0) + 1
          : old.rescheduledOrders,
      }));

      return { previousOrders, previousStats };
    },

    // Error pe rollback
    onError: (err, variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(['driver-stats'], context.previousStats);
      }
      toast.error('Failed to update order');
    },

    // Success pe refetch for consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-stats'] });
    },
  });
};
```

---

### Ticket 1.5: Add Optimistic Update to Complete Delivery
**File:** `src/features/driver-view/api/use-complete-delivery.ts`

**Same pattern as 1.4:**
```typescript
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: ['orders'] });

  const previousOrders = queryClient.getQueryData(['orders']);

  queryClient.setQueryData(['orders'], (old: Order[]) =>
    old?.map(order =>
      order.id === variables.orderId
        ? { ...order, status: 'COMPLETED', completedAt: new Date() }
        : order
    )
  );

  queryClient.setQueryData(['driver-stats'], (old: any) => ({
    ...old,
    pendingOrders: old.pendingOrders - 1,
    completedOrders: old.completedOrders + 1,
    cashCollected: old.cashCollected + (variables.cashCollected || 0),
  }));

  return { previousOrders };
};
```

---

## Phase 2: Real-Time Stats

### Ticket 2.1: Add Polling to Stats Hook
**File:** `src/features/driver-view/api/use-get-driver-stats.ts`

**Implementation:**
```typescript
export const useGetDriverStats = (date?: string) => {
  return useQuery({
    queryKey: ['driver-stats', date],
    queryFn: async () => {
      const response = await client.api.drivers.me.stats.$get({
        query: { date }
      });
      return response.json();
    },

    // NEW: Auto refresh settings
    staleTime: 10 * 1000,        // 10 sec baad stale
    refetchInterval: 30 * 1000,  // Har 30 sec refresh
    refetchOnWindowFocus: true,  // Tab switch pe refresh
    refetchOnReconnect: true,    // Internet wapas aaye to refresh
  });
};
```

---

### Ticket 2.2: Create Enhanced Stats Dashboard
**File:** `src/features/driver-view/components/stats-dashboard.tsx` (NEW)

**Implementation:**
```typescript
export const StatsDashboard = () => {
  const { data: stats, isRefetching } = useGetDriverStats();

  return (
    <div className="grid grid-cols-4 gap-2">
      {/* To Do */}
      <StatCard
        label="To Do"
        value={stats?.pendingOrders || 0}
        icon={<Clock />}
        color="blue"
      />

      {/* Done */}
      <StatCard
        label="Done"
        value={stats?.completedOrders || 0}
        icon={<CheckCircle />}
        color="green"
      />

      {/* Issues */}
      <StatCard
        label="Issues"
        value={(stats?.cancelledOrders || 0) + (stats?.rescheduledOrders || 0)}
        icon={<AlertCircle />}
        color="red"
      />

      {/* Cash */}
      <StatCard
        label="Cash"
        value={formatCurrency(stats?.cashCollected || 0)}
        icon={<Banknote />}
        color="emerald"
        onClick={() => router.push('/cash-handover')}
      />

      {/* Refresh indicator */}
      {isRefetching && (
        <div className="absolute top-2 right-2">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
    </div>
  );
};
```

---

### Ticket 2.3: Update Stats API Response
**File:** `src/features/drivers/server/route.ts`

**Enhance `/me/stats` endpoint:**
```typescript
.get('/me/stats', sessionMiddleware, async (c) => {
  const driverId = c.get('driverId');
  const { date } = c.req.query();

  const stats = await getDriverStats(driverId, date || format(new Date(), 'yyyy-MM-dd'));

  return c.json({
    // Orders breakdown
    orders: {
      total: stats.totalOrders,
      pending: stats.pendingOrders,
      completed: stats.completedOrders,
      cancelled: stats.cancelledOrders,      // NEW
      rescheduled: stats.rescheduledOrders,  // NEW
    },

    // Financial
    financial: {
      cashCollected: stats.cashCollected,
      onlineCollected: stats.onlineCollected,  // NEW
      creditGiven: stats.creditGiven,          // NEW
      expenses: stats.totalExpenses,
      netCash: stats.cashCollected - stats.approvedExpenses,
    },

    // Bottles
    bottles: {
      filledGiven: stats.filledGiven,
      emptyTaken: stats.emptyTaken,
      balance: stats.filledGiven - stats.emptyTaken,
    },

    // Meta
    lastUpdated: new Date().toISOString(),
  });
})
```

---

## Phase 3: Date & Session Handling

### Ticket 3.1: Create Business Date Utility
**File:** `src/lib/utils/business-date.ts` (NEW)

**Purpose:** Midnight ke baad bhi same day consider karna

```typescript
/**
 * Business date logic:
 * - 12 AM to 6 AM = Previous day (late night delivery)
 * - 6 AM onwards = Current day
 */
export const getBusinessDate = (timestamp: Date = new Date()): string => {
  const hour = timestamp.getHours();

  // Agar raat 12 baje se subah 6 baje ke beech hai
  // to previous day consider karo
  if (hour >= 0 && hour < 6) {
    const yesterday = new Date(timestamp);
    yesterday.setDate(yesterday.getDate() - 1);
    return format(yesterday, 'yyyy-MM-dd');
  }

  return format(timestamp, 'yyyy-MM-dd');
};

/**
 * Check if given date is today (business date aware)
 */
export const isBusinessToday = (date: string): boolean => {
  return date === getBusinessDate();
};

/**
 * Get display label for date
 */
export const getDateLabel = (date: string): string => {
  const today = getBusinessDate();
  const yesterday = getBusinessDate(subDays(new Date(), 1));

  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return format(parseISO(date), 'dd MMM');
};
```

---

### Ticket 3.2: Add Date Selector to Deliveries Page
**File:** `src/app/(driver)/deliveries/page.tsx`

**Implementation:**
```typescript
// 1. Date state with business date default
const [selectedDate, setSelectedDate] = useState(getBusinessDate());

// 2. Date selector UI
<div className="flex items-center gap-2 mb-4">
  {/* Quick filters */}
  <Button
    variant={selectedDate === getBusinessDate() ? 'default' : 'outline'}
    size="sm"
    onClick={() => setSelectedDate(getBusinessDate())}
  >
    Today
  </Button>
  <Button
    variant={selectedDate === getBusinessDate(subDays(new Date(), 1)) ? 'default' : 'outline'}
    size="sm"
    onClick={() => setSelectedDate(getBusinessDate(subDays(new Date(), 1)))}
  >
    Yesterday
  </Button>

  {/* Date picker */}
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm">
        <CalendarIcon className="h-4 w-4 mr-2" />
        {getDateLabel(selectedDate)}
      </Button>
    </PopoverTrigger>
    <PopoverContent>
      <Calendar
        selected={parseISO(selectedDate)}
        onSelect={(date) => setSelectedDate(format(date, 'yyyy-MM-dd'))}
      />
    </PopoverContent>
  </Popover>
</div>

// 3. Orders fetch with date
const { data: orders } = useGetOrders({
  driverId: driver?.id,
  date: selectedDate,
  includeCarryover: true  // Past pending orders bhi lao
});
```

---

### Ticket 3.3: Update Orders Query for Carryover
**File:** `src/features/orders/queries.ts`

**Add carryover logic:**
```typescript
export const getDriverOrders = async (
  driverId: string,
  date: string,
  includeCarryover: boolean = true
) => {
  const whereClause: Prisma.OrderWhereInput = {
    driverId,
    OR: [
      // Orders for selected date
      { scheduledDate: date },

      // Carryover: Purane pending orders jo complete nahi huay
      ...(includeCarryover ? [{
        scheduledDate: { lt: date },
        status: { in: ['PENDING', 'IN_PROGRESS', 'SCHEDULED'] },
      }] : []),
    ],
  };

  return prisma.order.findMany({
    where: whereClause,
    include: {
      customer: true,
      items: { include: { product: true } },
    },
    orderBy: [
      { scheduledDate: 'asc' },  // Purane pehle
      { sequenceOrder: 'asc' },  // Phir sequence
    ],
  });
};
```

---

## Phase 4: Financial Dashboard

### Ticket 4.1: Create Financial Summary Page
**File:** `src/app/(driver)/financials/page.tsx` (NEW)

**Implementation:**
```typescript
export default function FinancialsPage() {
  const { data: summary } = useDriverDaySummary();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Today's Money</h1>

      {/* Collections Grid */}
      <div className="grid grid-cols-2 gap-3">
        <CollectionCard
          icon={<Banknote />}
          label="Cash"
          amount={summary?.cashCollected || 0}
          count={summary?.cashOrdersCount || 0}
          color="green"
        />
        <CollectionCard
          icon={<CreditCard />}
          label="Online"
          amount={summary?.onlineCollected || 0}
          count={summary?.onlineOrdersCount || 0}
          color="blue"
        />
        <CollectionCard
          icon={<Wallet />}
          label="Credit"
          amount={summary?.creditGiven || 0}
          count={summary?.creditOrdersCount || 0}
          color="amber"
        />
        <CollectionCard
          icon={<Receipt />}
          label="Prepaid"
          amount={summary?.prepaidUsed || 0}
          count={summary?.prepaidOrdersCount || 0}
          color="purple"
        />
      </div>

      {/* Expenses Section */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {summary?.expenses?.map(expense => (
              <ExpenseRow
                key={expense.id}
                type={expense.type}
                amount={expense.amount}
                status={expense.status}
              />
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={() => router.push('/financials/expenses')}
          >
            + Add Expense
          </Button>
        </CardContent>
      </Card>

      {/* Net Cash */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-sm opacity-80">Net Cash to Handover</div>
            <div className="text-3xl font-bold">
              {formatCurrency(summary?.netCash || 0)}
            </div>
            <div className="text-xs opacity-70 mt-1">
              Cash - Approved Expenses
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button
        className="w-full h-14"
        onClick={() => router.push('/cash-handover')}
      >
        Submit Cash Handover
      </Button>
    </div>
  );
}
```

---

### Ticket 4.2: Create Expense Management Page
**File:** `src/app/(driver)/financials/expenses/page.tsx` (NEW)

```typescript
export default function ExpensesPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const { data: expenses } = useDriverExpenses({ status: filter });

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">My Expenses</h1>
        <Button onClick={() => setShowAddForm(true)}>
          + Add
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">⏳ Pending</TabsTrigger>
          <TabsTrigger value="approved">✓ Approved</TabsTrigger>
          <TabsTrigger value="rejected">✗ Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Expense List */}
      <div className="space-y-2">
        {expenses?.map(expense => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            showStatus
          />
        ))}
      </div>

      {/* Add Expense Dialog */}
      <AddExpenseDialog
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
      />
    </div>
  );
}
```

---

### Ticket 4.3: Create Financial History Page
**File:** `src/app/(driver)/financials/history/page.tsx` (NEW)

```typescript
export default function FinancialHistoryPage() {
  const [dateRange, setDateRange] = useState({
    from: startOfWeek(new Date()),
    to: new Date(),
  });

  const { data: history } = useDriverFinancialHistory(dateRange);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Financial History</h1>

      {/* Date Range Selector */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange(todayRange)}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange(thisWeekRange)}
        >
          This Week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange(thisMonthRange)}
        >
          This Month
        </Button>
      </div>

      {/* Period Summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(history?.totalCollected)}
              </div>
              <div className="text-xs text-muted-foreground">Collected</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(history?.totalExpenses)}
              </div>
              <div className="text-xs text-muted-foreground">Expenses</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(history?.netEarnings)}
              </div>
              <div className="text-xs text-muted-foreground">Net</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <div className="space-y-2">
        {history?.dailyBreakdown?.map(day => (
          <DailyCard
            key={day.date}
            date={day.date}
            collected={day.collected}
            expenses={day.expenses}
            net={day.net}
            handoverStatus={day.handoverStatus}
            discrepancy={day.discrepancy}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### Ticket 4.4: Add Financial History API
**File:** `src/features/drivers/server/route.ts`

```typescript
.get('/me/financial-history', sessionMiddleware, async (c) => {
  const driverId = c.get('driverId');
  const { startDate, endDate } = c.req.query();

  // Get all handovers in range
  const handovers = await prisma.cashHandover.findMany({
    where: {
      driverId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      expenses: true,
    },
    orderBy: { date: 'desc' },
  });

  // Calculate totals
  const totalCollected = handovers.reduce((sum, h) => sum + h.totalCash, 0);
  const totalExpenses = handovers.reduce((sum, h) =>
    sum + h.expenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + e.amount, 0), 0
  );

  // Daily breakdown
  const dailyBreakdown = handovers.map(h => ({
    date: h.date,
    collected: h.totalCash,
    expenses: h.expenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + e.amount, 0),
    net: h.totalCash - h.expenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + e.amount, 0),
    handoverStatus: h.status,
    discrepancy: h.discrepancy,
  }));

  return c.json({
    period: { start: startDate, end: endDate },
    summary: {
      totalCollected,
      totalExpenses,
      netEarnings: totalCollected - totalExpenses,
    },
    dailyBreakdown,
  });
})
```

---

## Phase 5: UI/UX Polish

### Ticket 5.1: Create Bottom Navigation
**File:** `src/app/(driver)/layout.tsx`

**Implementation:**
```typescript
export default function DriverLayout({ children }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/deliveries', icon: ClipboardList, label: 'Today' },
    { href: '/financials', icon: Wallet, label: 'Money' },
    { href: '/profile', icon: User, label: 'Me' },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Main Content */}
      {children}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {navItems.map(item => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 w-12 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
```

---

### Ticket 5.2: Add Loading Skeletons
**File:** `src/features/driver-view/components/skeletons.tsx` (NEW)

```typescript
export const StatsSkeletion = () => (
  <div className="grid grid-cols-4 gap-2">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
    ))}
  </div>
);

export const OrderCardSkeleton = () => (
  <div className="p-4 rounded-lg border bg-card">
    <div className="flex justify-between mb-3">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-6 w-16" />
    </div>
    <Skeleton className="h-4 w-32 mb-2" />
    <Skeleton className="h-4 w-48 mb-2" />
    <Skeleton className="h-4 w-40" />
    <div className="flex gap-2 mt-4">
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-10 flex-1" />
    </div>
  </div>
);

export const OrderListSkeleton = () => (
  <div className="space-y-3">
    {[...Array(3)].map((_, i) => (
      <OrderCardSkeleton key={i} />
    ))}
  </div>
);
```

---

### Ticket 5.3: Add Pull-to-Refresh
**File:** `src/app/(driver)/deliveries/page.tsx`

```typescript
// Using react-pull-to-refresh or custom implementation

const { data, refetch, isRefetching } = useGetOrders({ ... });

return (
  <PullToRefresh onRefresh={refetch} isRefreshing={isRefetching}>
    <div className="p-4">
      {/* Stats */}
      <StatsDashboard />

      {/* Tabs */}
      <OrderTabs ... />

      {/* Orders List */}
      <OrderList orders={filteredOrders} />
    </div>
  </PullToRefresh>
);
```

---

## Quick Reference: Files to Create/Modify

### New Files
| File | Ticket |
|------|--------|
| `src/features/driver-view/components/issue-order-card.tsx` | 1.3 |
| `src/features/driver-view/components/stats-dashboard.tsx` | 2.2 |
| `src/lib/utils/business-date.ts` | 3.1 |
| `src/app/(driver)/financials/page.tsx` | 4.1 |
| `src/app/(driver)/financials/expenses/page.tsx` | 4.2 |
| `src/app/(driver)/financials/history/page.tsx` | 4.3 |
| `src/features/driver-view/components/skeletons.tsx` | 5.2 |

### Modified Files
| File | Tickets |
|------|---------|
| `src/app/(driver)/deliveries/page.tsx` | 1.1, 3.2, 5.3 |
| `src/features/driver-view/queries.ts` | 1.2 |
| `src/features/driver-view/api/use-unable-to-deliver.ts` | 1.4 |
| `src/features/driver-view/api/use-complete-delivery.ts` | 1.5 |
| `src/features/driver-view/api/use-get-driver-stats.ts` | 2.1 |
| `src/features/drivers/server/route.ts` | 2.3, 4.4 |
| `src/features/orders/queries.ts` | 3.3 |
| `src/app/(driver)/layout.tsx` | 5.1 |

---

## Priority Order

```
Week 1: Critical Fixes
├── 1.1 Issues Tab
├── 1.2 Stats Query Update
├── 1.3 Issue Order Card
├── 1.4 Optimistic Update (Unable to Deliver)
└── 1.5 Optimistic Update (Complete Delivery)

Week 2: Real-Time & Dates
├── 2.1 Polling Stats
├── 2.2 Stats Dashboard
├── 2.3 Stats API Update
├── 3.1 Business Date Utility
├── 3.2 Date Selector
└── 3.3 Carryover Query

Week 3: Financials
├── 4.1 Financial Summary Page
├── 4.2 Expenses Page
├── 4.3 History Page
└── 4.4 History API

Week 4: Polish
├── 5.1 Bottom Navigation
├── 5.2 Loading Skeletons
└── 5.3 Pull to Refresh
```

---

*Total Tickets: 17*
*Estimated Effort: 3-4 weeks*
