# Driver App Master Plan
## Complete Solution for Order Visibility, Status Handling & Data Consistency

**Version:** 1.0
**Created:** January 2026
**Scope:** Production-ready driver app redesign following real-world delivery app best practices

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Analysis](#problem-analysis)
3. [Solution Architecture](#solution-architecture)
4. [Order Status & Visibility Logic](#1-order-status--visibility-logic)
5. [Real-Time Stats Architecture](#2-real-time-stats-architecture)
6. [Date & Shift-Based Design](#3-date--shift-based-design)
7. [Driver Financial Dashboard](#4-driver-financial-dashboard)
8. [UI/UX Structure](#5-uiux-structure)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Database Schema Changes](#database-schema-changes)
11. [API Endpoint Changes](#api-endpoint-changes)
12. [Technical Specifications](#technical-specifications)

---

## Executive Summary

This master plan addresses five critical issues in the Blue Ice driver app:

| Issue | Current State | Target State |
|-------|---------------|--------------|
| **Order Visibility** | Cancelled/rescheduled orders still show in To Do | Orders move to appropriate tabs immediately |
| **Order Breakdown** | No visibility into order categories | Full breakdown with counts and history |
| **Real-Time Stats** | Manual refresh required | Optimistic updates + background sync |
| **Date Clarity** | No date-based filtering | Session-based system with date awareness |
| **Financial Transparency** | Scattered financial data | Unified financial dashboard with daily summaries |

**Approach:** Session-based delivery management (like Uber/Careem) with clear status segregation, real-time updates via React Query optimistic mutations, and comprehensive financial tracking.

---

## Problem Analysis

### Current Codebase Issues Identified

#### 1. Order Filtering Logic (Found in `src/app/(driver)/deliveries/page.tsx`)

**Current Implementation:**
```typescript
// Orders are fetched and filtered on the client
const pendingOrders = orders?.filter(
  order => order.status === 'PENDING' || order.status === 'IN_PROGRESS'
);
const completedOrders = orders?.filter(
  order => order.status === 'COMPLETED'
);
```

**Problems:**
- `CANCELLED` and `RESCHEDULED` orders are not handled - they disappear
- No tab/section for cancelled or rescheduled orders
- Orders don't move to different sections after status change until page refresh

#### 2. Stats Calculation (Found in `src/features/driver-view/queries.ts`)

**Current Implementation:**
```typescript
const pendingOrders = orders.filter(
  (order) => order.status === OrderStatus.PENDING || order.status === OrderStatus.IN_PROGRESS
);
const completedOrders = orders.filter(
  (order) => order.status === OrderStatus.COMPLETED
);
```

**Problems:**
- No tracking of cancelled/rescheduled counts
- Stats don't reflect all order outcomes
- No date-based breakdown

#### 3. Query Invalidation Pattern

**Current Implementation:**
```typescript
// After order update in use-update-order.ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['driver-stats'] });
}
```

**Problem:**
- Relies only on cache invalidation (refetch)
- No optimistic updates for instant feedback
- Feels sluggish to drivers

---

## Solution Architecture

### Core Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                    DRIVER SESSION MODEL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┐    ┌────────────┐    ┌───────────────────────┐  │
│  │  SESSION  │───▶│   ORDERS   │───▶│   ORDER OUTCOMES      │  │
│  │  START    │    │  (Assigned)│    │  - Delivered          │  │
│  └───────────┘    └────────────┘    │  - Cancelled          │  │
│       │                              │  - Rescheduled        │  │
│       ▼                              │  - Pending            │  │
│  ┌───────────┐                       └───────────────────────┘  │
│  │  STATS    │◀──────────────────────────────┘                  │
│  │  BOARD    │      Real-time updates                           │
│  └───────────┘                                                  │
│       │                                                         │
│       ▼                                                         │
│  ┌───────────┐                                                  │
│  │ FINANCIAL │     End-of-session reconciliation                │
│  │ SUMMARY   │                                                  │
│  └───────────┘                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Real-World App Patterns Applied

| App | Pattern We're Adopting |
|-----|------------------------|
| **Uber Eats Driver** | Session-based work model, real-time trip status |
| **Careem Captain** | Daily earning summaries, trip history tabs |
| **Foodpanda Rider** | Order queue with clear status badges |
| **Amazon Flex** | Delivery block concept, route optimization |
| **DoorDash** | Detailed order breakdown, completion rates |

---

## 1. Order Status & Visibility Logic

### Enhanced Status Flow

```
                         ┌──────────────────────────────────────┐
                         │           ORDER LIFECYCLE            │
                         └──────────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │              SCHEDULED (Auto)               │
                    │         Generated by cron/admin             │
                    └─────────────────────────────────────────────┘
                                          │
                         Driver assigned to route
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │                 PENDING                     │
                    │         Shows in "To Do" tab                │
                    └─────────────────────────────────────────────┘
                                          │
                    ┌─────────────┬───────┴───────┬───────────────┐
                    ▼             ▼               ▼               ▼
           ┌──────────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐
           │  IN_PROGRESS │ │COMPLETED │ │ CANCELLED  │ │  RESCHEDULED  │
           │   (Driving)  │ │(Delivered│ │ (Failed)   │ │ (Future Date) │
           └──────────────┘ └──────────┘ └────────────┘ └───────────────┘
                    │             │               │               │
                    │             │               │               │
                    ▼             ▼               ▼               ▼
              "To Do" Tab   "Done" Tab    "Issues" Tab    "Issues" Tab
                               │               │               │
                               ▼               ▼               ▼
                         ┌─────────────────────────────────────────┐
                         │           SESSION SUMMARY               │
                         │    Visible for full transparency        │
                         └─────────────────────────────────────────┘
```

### Order Tab Structure

```typescript
// New tab-based order organization
enum OrderTab {
  TODO = 'todo',           // PENDING + IN_PROGRESS
  DONE = 'done',           // COMPLETED
  ISSUES = 'issues',       // CANCELLED + RESCHEDULED
}

// Order filtering logic
const filterOrdersByTab = (orders: Order[], tab: OrderTab) => {
  switch (tab) {
    case OrderTab.TODO:
      return orders.filter(o =>
        o.status === 'PENDING' || o.status === 'IN_PROGRESS'
      );
    case OrderTab.DONE:
      return orders.filter(o =>
        o.status === 'COMPLETED'
      );
    case OrderTab.ISSUES:
      return orders.filter(o =>
        o.status === 'CANCELLED' || o.status === 'RESCHEDULED'
      );
    default:
      return orders;
  }
};
```

### Order Card Enhancements

```typescript
// Enhanced order card with status-aware rendering
interface EnhancedOrderCardProps {
  order: Order;
  showStatusBadge: boolean;  // Show prominent status for Issues tab
  showRescheduleDate?: boolean;  // Show new date for rescheduled
  showCancellationReason?: boolean;  // Show reason for cancelled
}
```

**Status Badge Colors:**
| Status | Color | Badge Text |
|--------|-------|------------|
| PENDING | Blue | "To Do" |
| IN_PROGRESS | Amber | "On Way" |
| COMPLETED | Green | "Delivered" |
| CANCELLED | Red | "Cancelled" |
| RESCHEDULED | Purple | "Rescheduled" |

### Visibility Rules

```typescript
// Order visibility matrix
const ORDER_VISIBILITY = {
  TODO_TAB: {
    statuses: ['PENDING', 'IN_PROGRESS'],
    sortBy: 'sequenceOrder',
    showActions: true,  // Deliver, Unable to Deliver buttons
  },
  DONE_TAB: {
    statuses: ['COMPLETED'],
    sortBy: 'completedAt',
    showActions: false,  // Read-only, show details
  },
  ISSUES_TAB: {
    statuses: ['CANCELLED', 'RESCHEDULED'],
    sortBy: 'updatedAt',
    showActions: false,  // Read-only with explanation
    showReason: true,    // Why cancelled/rescheduled
  },
};
```

### Immediate Status Update Flow

```typescript
// Optimistic update pattern for instant feedback
const useUnableToDeliver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => markOrderUnableToDeliver(data),

    // OPTIMISTIC UPDATE - Instant UI feedback
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders'] });

      // Snapshot current state
      const previousOrders = queryClient.getQueryData(['orders']);

      // Optimistically update the order status
      queryClient.setQueryData(['orders'], (old: Order[]) =>
        old.map(order =>
          order.id === variables.orderId
            ? {
                ...order,
                status: variables.action === 'RESCHEDULE'
                  ? 'RESCHEDULED'
                  : 'CANCELLED',
                cancellationReason: variables.reason,
                rescheduledToDate: variables.rescheduleDate,
              }
            : order
        )
      );

      // Also update stats optimistically
      queryClient.setQueryData(['driver-stats'], (old: Stats) => ({
        ...old,
        pendingOrders: old.pendingOrders - 1,
        [variables.action === 'RESCHEDULE' ? 'rescheduledOrders' : 'cancelledOrders']:
          (old[variables.action === 'RESCHEDULE' ? 'rescheduledOrders' : 'cancelledOrders'] || 0) + 1,
      }));

      return { previousOrders };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      queryClient.setQueryData(['orders'], context?.previousOrders);
      toast.error('Failed to update order. Please try again.');
    },

    // Always refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-stats'] });
    },
  });
};
```

---

## 2. Real-Time Stats Architecture

### Current Problem Analysis

The stats board relies on query invalidation after mutations, which:
1. Requires a network roundtrip
2. Can be slow on poor connections
3. Feels unresponsive to drivers

### Solution: Optimistic Updates + Background Sync

```
┌──────────────────────────────────────────────────────────────────┐
│                    REAL-TIME STATS FLOW                          │
└──────────────────────────────────────────────────────────────────┘

    User Action                Cache Update            Background Sync
         │                          │                        │
         ▼                          ▼                        ▼
┌─────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  Driver taps    │    │   Optimistic        │    │   API Call       │
│  "Deliver"      │───▶│   Update Cache      │───▶│   Validates      │
└─────────────────┘    │   (Instant UI)      │    │   Server-side    │
                       └─────────────────────┘    └──────────────────┘
                                 │                         │
                                 ▼                         ▼
                       ┌─────────────────────┐    ┌──────────────────┐
                       │   Stats Update      │◀───│   Confirm/       │
                       │   Immediately       │    │   Rollback       │
                       └─────────────────────┘    └──────────────────┘
```

### Enhanced Stats Model

```typescript
interface DriverSessionStats {
  // Session Info
  sessionId: string;
  sessionDate: string;  // YYYY-MM-DD
  sessionStartTime: string;

  // Order Breakdown
  totalOrders: number;
  pendingOrders: number;      // Still To Do
  completedOrders: number;    // Successfully delivered
  cancelledOrders: number;    // Could not deliver
  rescheduledOrders: number;  // Moved to future date

  // Financial Summary
  totalExpectedCash: number;    // Sum of all order totals (CASH method)
  totalCollectedCash: number;   // Actual cash collected
  totalOnlinePayments: number;  // UPI/Card payments
  totalCreditGiven: number;     // Udhaar/Credit

  // Bottle Exchange
  totalFilledGiven: number;
  totalEmptyTaken: number;
  totalDamagedReturned: number;
  bottleBalance: number;  // filledGiven - emptyTaken - damaged

  // Expenses
  totalExpenses: number;
  approvedExpenses: number;
  pendingExpenses: number;
  rejectedExpenses: number;

  // Computed
  netCashToHandover: number;  // collectedCash - approvedExpenses
  completionRate: number;     // (completed / total) * 100
}
```

### Stats Query with Polling

```typescript
// Enhanced stats hook with automatic refresh
export const useDriverStats = (sessionDate?: string) => {
  return useQuery({
    queryKey: ['driver-stats', sessionDate],
    queryFn: () => fetchDriverStats(sessionDate),

    // Refetch every 30 seconds for near-real-time
    refetchInterval: 30000,

    // Refetch when window regains focus
    refetchOnWindowFocus: true,

    // Keep previous data while refetching
    placeholderData: keepPreviousData,

    // Stale time - consider data stale after 10 seconds
    staleTime: 10000,
  });
};
```

### Alternative: WebSocket for True Real-Time (Future Enhancement)

```typescript
// Optional WebSocket implementation for true real-time
// Can be added later for enhanced experience

interface RealtimeEvent {
  type: 'ORDER_STATUS_CHANGED' | 'EXPENSE_APPROVED' | 'CASH_VERIFIED';
  payload: any;
  timestamp: string;
}

// Socket.IO integration (already partially set up in codebase)
const useRealtimeStats = () => {
  useEffect(() => {
    const socket = io('/driver-updates');

    socket.on('stats-update', (event: RealtimeEvent) => {
      queryClient.setQueryData(['driver-stats'], (old) =>
        applyRealtimeUpdate(old, event)
      );
    });

    return () => socket.disconnect();
  }, []);
};
```

---

## 3. Date & Shift-Based Design

### Recommendation: Session-Based Model

After analyzing real-world delivery apps, we recommend a **Session-Based Model** with date awareness:

```
┌──────────────────────────────────────────────────────────────────┐
│                    SESSION-BASED DESIGN                          │
└──────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────┐
    │                    DELIVERY SESSION                         │
    │                                                             │
    │  ┌───────────┐                         ┌────────────────┐   │
    │  │  Session  │    Orders belong to     │    Session     │   │
    │  │   Start   │───▶ THIS session until ─▶│     End       │   │
    │  │  (Duty On)│    driver ends duty     │  (Cash Submit) │   │
    │  └───────────┘                         └────────────────┘   │
    │       │                                        │            │
    │       ▼                                        ▼            │
    │   Load today's orders              Submit cash handover     │
    │   + any carryover orders           Session closes           │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

### Why Session-Based?

| Factor | Date-Based | Shift-Based | Session-Based (Recommended) |
|--------|------------|-------------|------------------------------|
| **Late Night Handling** | Confusing at midnight | Needs shift definitions | Seamless - session spans midnight |
| **Order Carryover** | Manual handling | Complex logic | Automatic until session ends |
| **Flexibility** | Rigid | Semi-flexible | Fully flexible |
| **Cash Tracking** | Per date | Per shift | Per session (cleaner) |
| **Real-World Apps** | N/A | Some logistics apps | Uber, Careem, DoorDash |

### Session Model Implementation

```typescript
// Session model
interface DriverSession {
  id: string;
  driverId: string;

  // Timing
  startedAt: DateTime;
  endedAt: DateTime | null;
  sessionDate: string;  // Business date (YYYY-MM-DD)

  // Status
  isActive: boolean;

  // Orders assigned to this session
  orders: Order[];

  // Financial
  cashHandover: CashHandover | null;
}

// Business date logic for midnight handling
const getBusinessDate = (timestamp: Date): string => {
  const hour = timestamp.getHours();

  // If between midnight and 6 AM, consider it "previous day"
  // This handles late-night deliveries
  if (hour >= 0 && hour < 6) {
    const yesterday = new Date(timestamp);
    yesterday.setDate(yesterday.getDate() - 1);
    return format(yesterday, 'yyyy-MM-dd');
  }

  return format(timestamp, 'yyyy-MM-dd');
};
```

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   Driver     │
    │   Logs In    │
    └──────────────┘
           │
           ▼
    ┌──────────────┐     No active session found
    │   Check      │────────────────────────────┐
    │   Session    │                            │
    └──────────────┘                            ▼
           │                           ┌──────────────────┐
           │ Active session exists     │  Create New      │
           │                           │  Session         │
           ▼                           │  (isActive: true)│
    ┌──────────────┐                   └──────────────────┘
    │   Resume     │                            │
    │   Session    │◀───────────────────────────┘
    └──────────────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────┐
    │                    ACTIVE SESSION                        │
    │  • View Today's Orders (+ carryover)                     │
    │  • Complete deliveries                                   │
    │  • Mark issues (Cancel/Reschedule)                       │
    │  • Add expenses                                          │
    │  • Track real-time stats                                 │
    └──────────────────────────────────────────────────────────┘
           │
           │ Driver taps "End Session" or submits cash
           ▼
    ┌──────────────────────────────────────────────────────────┐
    │                    END SESSION                           │
    │  • Show session summary                                  │
    │  • Submit cash handover                                  │
    │  • Session marked inactive                               │
    │  • Orders locked (no more changes)                       │
    └──────────────────────────────────────────────────────────┘
           │
           ▼
    ┌──────────────┐
    │   Session    │  Available in history
    │   History    │  for review
    └──────────────┘
```

### Date Filter with Session Context

```typescript
// Date selector with smart defaults
interface DateFilterConfig {
  // Quick filters
  quickFilters: [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'week' },
  ];

  // Custom date picker
  customDateEnabled: true;

  // For current session
  defaultToSessionDate: true;
}

// Order fetching with date context
const useSessionOrders = (sessionDate: string) => {
  return useQuery({
    queryKey: ['orders', 'session', sessionDate],
    queryFn: () => fetchOrders({
      date: sessionDate,
      includeCarryover: true,  // Include past incomplete orders
    }),
  });
};
```

### Handling Midnight Crossover

```typescript
// Scenario: Driver starts at 10 PM, finishes at 2 AM
// All orders belong to the 10 PM session date

const getOrdersForSession = async (driverId: string, sessionId: string) => {
  const session = await getSession(sessionId);

  return prisma.order.findMany({
    where: {
      driverId,
      OR: [
        // Orders scheduled for session date
        { scheduledDate: session.sessionDate },

        // Carryover: Past orders still pending
        {
          scheduledDate: { lt: session.sessionDate },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      ],
    },
    orderBy: { sequenceOrder: 'asc' },
  });
};
```

---

## 4. Driver Financial Dashboard

### Design Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                 DRIVER FINANCIAL DASHBOARD                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     TODAY'S SUMMARY                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│   │  💰 Cash        │  │  💳 Online      │  │  🏦 Credit      │ │
│   │  Collected      │  │  Payments       │  │  Given          │ │
│   │  ₨12,500       │  │  ₨3,200         │  │  ₨1,800         │ │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────────┤
│   │                    EXPENSES                                 │ │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │ │
│   │  │ ✓ Approved   │  │ ⏳ Pending   │  │ ✗ Rejected  │      │ │
│   │  │   ₨800       │  │   ₨200       │  │   ₨0        │      │ │
│   │  └──────────────┘  └──────────────┘  └──────────────┘      │ │
│   └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│   ┌─────────────────────────────────────────────────────────────┤
│   │               NET CASH TO HANDOVER                          │ │
│   │                     ₨11,700                                 │ │
│   │            (Cash Collected - Approved Expenses)             │ │
│   └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│   [                 Submit Cash Handover                     ]   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Financial Data Model

```typescript
interface DriverFinancialSummary {
  // Period
  date: string;  // YYYY-MM-DD

  // Collections
  collections: {
    cash: number;
    online: number;  // UPI, Card
    credit: number;  // Udhaar
    prepaid: number; // From wallet
    total: number;
  };

  // Expenses
  expenses: {
    items: Expense[];
    totalSubmitted: number;
    approved: number;
    pending: number;
    rejected: number;
  };

  // Net Calculations
  netCash: number;  // cash - approved expenses

  // Handover Status
  handover: {
    status: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    submittedAmount?: number;
    verifiedAmount?: number;
    discrepancy?: number;
    notes?: string;
  };
}
```

### Financial Screen Structure

```typescript
// Financial screens hierarchy
const FINANCIAL_SCREENS = {
  // Main financial dashboard
  '/driver/financials': {
    component: 'FinancialDashboard',
    sections: ['today-summary', 'quick-actions'],
  },

  // Detailed expense management
  '/driver/financials/expenses': {
    component: 'ExpenseManager',
    features: ['add-expense', 'expense-list', 'status-filter'],
  },

  // Historical view
  '/driver/financials/history': {
    component: 'FinancialHistory',
    features: ['date-range', 'daily-breakdown', 'export'],
  },

  // Ledger/Wallet
  '/driver/financials/wallet': {
    component: 'DriverWallet',
    features: ['balance', 'transactions', 'settlements'],
  },
};
```

### Daily Summary Component

```typescript
// Daily financial summary with full breakdown
interface DailySummaryProps {
  date: string;
  showHandoverButton: boolean;
}

const DailySummary: React.FC<DailySummaryProps> = ({ date }) => {
  const { data: summary } = useDriverDaySummary(date);

  return (
    <div className="space-y-4">
      {/* Collection Breakdown */}
      <CollectionCards
        cash={summary.collections.cash}
        online={summary.collections.online}
        credit={summary.collections.credit}
      />

      {/* Expense Summary */}
      <ExpenseSummary
        approved={summary.expenses.approved}
        pending={summary.expenses.pending}
        rejected={summary.expenses.rejected}
      />

      {/* Net Cash */}
      <NetCashCard
        amount={summary.netCash}
        formula="Cash Collected - Approved Expenses"
      />

      {/* Orders Contributing to Cash */}
      <CashOrdersList
        orders={summary.cashOrders}
        onViewDetails={(orderId) => navigate(`/order/${orderId}`)}
      />

      {/* Handover Status */}
      <HandoverStatus
        status={summary.handover.status}
        discrepancy={summary.handover.discrepancy}
      />
    </div>
  );
};
```

### Expense Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPENSE WORKFLOW                             │
└─────────────────────────────────────────────────────────────────┘

    Driver                          System                    Admin
       │                               │                         │
       │  Add Expense                  │                         │
       │  (Fuel: ₨500)                 │                         │
       ├──────────────────────────────▶│                         │
       │                               │  Status: PENDING        │
       │                               │  (Not deducted yet)     │
       │                               │                         │
       │                               │  Notify Admin           │
       │                               ├────────────────────────▶│
       │                               │                         │
       │                               │                         │ Review
       │                               │                         │ Approve/Reject
       │                               │◀────────────────────────┤
       │                               │                         │
       │  Push Notification            │                         │
       │◀──────────────────────────────│                         │
       │  "Expense Approved: ₨500"     │                         │
       │                               │                         │
       │  Stats Update                 │                         │
       │  Net Cash: ₨11,700           │                         │
       │  (was ₨12,200)               │                         │
       │                               │                         │
       ▼                               ▼                         ▼
```

### Financial History with Date Filter

```typescript
// Financial history with date-wise breakdown
const FinancialHistory: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfWeek(new Date()),
    to: new Date(),
  });

  const { data: history } = useDriverFinancialHistory(dateRange);

  return (
    <div>
      {/* Date Range Picker */}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        presets={[
          { label: 'Today', range: todayRange },
          { label: 'This Week', range: thisWeekRange },
          { label: 'This Month', range: thisMonthRange },
        ]}
      />

      {/* Summary Cards */}
      <PeriodSummary
        totalCollected={history.totalCollected}
        totalExpenses={history.totalExpenses}
        netEarnings={history.netEarnings}
      />

      {/* Daily Breakdown */}
      <DailyBreakdownList>
        {history.dailyBreakdown.map(day => (
          <DailyBreakdownCard
            key={day.date}
            date={day.date}
            collected={day.collected}
            expenses={day.expenses}
            net={day.net}
            handoverStatus={day.handoverStatus}
          />
        ))}
      </DailyBreakdownList>
    </div>
  );
};
```

---

## 5. UI/UX Structure

### Recommended Navigation Structure

```
┌──────────────────────────────────────────────────────────────────┐
│                    DRIVER APP NAVIGATION                         │
└──────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │     BOTTOM NAVIGATION       │
                    │                             │
                    │  ┌─────┐ ┌─────┐ ┌─────┐  │
                    │  │ 📋  │ │ 💰  │ │ 👤  │  │
                    │  │Today│ │Money│ │ Me  │  │
                    │  └─────┘ └─────┘ └─────┘  │
                    │                             │
                    └─────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │    TODAY       │ │    MONEY       │ │    ME          │
     │   (Orders)     │ │  (Financials)  │ │  (Profile)     │
     └────────────────┘ └────────────────┘ └────────────────┘
              │               │               │
              ▼               ▼               ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │• Stats Board   │ │• Today Summary │ │• Profile       │
     │• To Do Tab     │ │• Expenses      │ │• Settings      │
     │• Done Tab      │ │• History       │ │• Help          │
     │• Issues Tab    │ │• Wallet/Ledger │ │• Logout        │
     └────────────────┘ └────────────────┘ └────────────────┘
```

### Screen-by-Screen Design

#### 1. Today Screen (Orders)

```
┌──────────────────────────────────────────────────────────────────┐
│  📅 Today, 15 Jan 2026                    [🗺️ Map] [📋 List]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │                    STATS DASHBOARD                           │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │  │To Do   │ │Done    │ │Issues  │ │Cash    │               │
│  │  │  5     │ │  7     │ │  2     │ │₨8,500  │               │
│  │  └────────┘ └────────┘ └────────┘ └────────┘               │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  [  To Do  ]  [  Done  ]  [  Issues  ]                       │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  ORDER #1                                      [PENDING]     │
│  │  ─────────────────────────────────────────────              │
│  │  👤 Ahmed Khan                                               │
│  │  📍 House 123, DHA Phase 5                                   │
│  │  📦 2x 19L Bottles                                           │
│  │  💰 ₨1,200                                                   │
│  │                                                              │
│  │  [📞 Call] [💬 WhatsApp] [🗺️ Navigate] [✅ Deliver]        │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  ORDER #2                                      [PENDING]     │
│  │  ...                                                         │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
│                                                                  │
│              [📋 Today]  [💰 Money]  [👤 Me]                    │
│                  ●          ○          ○                        │
└──────────────────────────────────────────────────────────────────┘
```

#### 2. Issues Tab (Cancelled/Rescheduled)

```
┌──────────────────────────────────────────────────────────────────┐
│  Issues (2)                                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  ORDER #8                                    [CANCELLED]     │
│  │  ─────────────────────────────────────────────              │
│  │  👤 Fatima Ali                                               │
│  │  📍 Flat 4B, Askari Towers                                   │
│  │                                                              │
│  │  ❌ Reason: Customer Not Home                                │
│  │  📝 Notes: Called 3 times, no answer                         │
│  │  ⏰ Cancelled at: 2:30 PM                                    │
│  │                                                              │
│  │  [View Details]                                              │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  ORDER #11                                  [RESCHEDULED]    │
│  │  ─────────────────────────────────────────────              │
│  │  👤 Bilal Hussain                                            │
│  │  📍 Shop 5, Commercial Market                                │
│  │                                                              │
│  │  📅 Rescheduled to: 17 Jan 2026                              │
│  │  ❓ Reason: Shop Closed                                      │
│  │  📝 Notes: Customer requested Thursday delivery              │
│  │                                                              │
│  │  [View Details]                                              │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### 3. Money Screen (Financials)

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 Today's Money                          [📅 View History]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │                    COLLECTIONS                               │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  │  💵 Cash        │  │  💳 Online      │                   │
│  │  │  ₨8,500         │  │  ₨2,100         │                   │
│  │  │  (7 orders)     │  │  (2 orders)     │                   │
│  │  └─────────────────┘  └─────────────────┘                   │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  │  🏦 Credit      │  │  💼 Prepaid     │                   │
│  │  │  ₨1,200         │  │  ₨0             │                   │
│  │  │  (1 order)      │  │  (0 orders)     │                   │
│  │  └─────────────────┘  └─────────────────┘                   │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │                    EXPENSES                                  │
│  │  ┌────────────────────────────────────────┐                 │
│  │  │ ✓ Fuel              ₨500    Approved  │                 │
│  │  │ ⏳ Lunch             ₨200    Pending   │                 │
│  │  └────────────────────────────────────────┘                 │
│  │                                                              │
│  │  [+ Add Expense]                                            │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │                NET CASH TO HANDOVER                          │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                   │
│  │                                                              │
│  │               ₨8,000                                         │
│  │                                                              │
│  │  Cash ₨8,500 - Approved Expenses ₨500 = ₨8,000              │
│  │                                                              │
│  │  [          Submit Cash Handover          ]                  │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### 4. Financial History Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  📊 Financial History                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  [Today] [This Week] [This Month] [Custom]                   │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │                    PERIOD SUMMARY                            │
│  │  Total Collected: ₨45,200                                    │
│  │  Total Expenses:  ₨3,500                                     │
│  │  Net Earnings:    ₨41,700                                    │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  15 Jan 2026                                                 │
│  │  ─────────────────────────────────────────────              │
│  │  Collected: ₨12,500  |  Expenses: ₨700  |  Net: ₨11,800     │
│  │  Handover: ✓ Verified                                        │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  14 Jan 2026                                                 │
│  │  ─────────────────────────────────────────────              │
│  │  Collected: ₨10,800  |  Expenses: ₨500   |  Net: ₨10,300    │
│  │  Handover: ✓ Verified                                        │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │  13 Jan 2026                                                 │
│  │  ─────────────────────────────────────────────              │
│  │  Collected: ₨8,900   |  Expenses: ₨800   |  Net: ₨8,100     │
│  │  Handover: ⚠️ Shortage ₨200                                   │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
src/
├── app/
│   └── (driver)/
│       ├── layout.tsx              # Bottom navigation layout
│       ├── page.tsx                # Redirect to /deliveries
│       │
│       ├── deliveries/             # TODAY TAB
│       │   ├── page.tsx            # Main orders page
│       │   └── [orderId]/
│       │       └── page.tsx        # Order details
│       │
│       ├── financials/             # MONEY TAB
│       │   ├── page.tsx            # Today's financial summary
│       │   ├── expenses/
│       │   │   └── page.tsx        # Expense management
│       │   ├── history/
│       │   │   └── page.tsx        # Financial history
│       │   └── wallet/
│       │       └── page.tsx        # Driver wallet/ledger
│       │
│       └── profile/                # ME TAB
│           └── page.tsx            # Driver profile & settings
│
└── features/
    └── driver-view/
        └── components/
            ├── stats-dashboard.tsx      # Real-time stats
            ├── order-tabs.tsx           # To Do/Done/Issues tabs
            ├── enhanced-order-card.tsx  # Order card (existing, enhanced)
            ├── issue-order-card.tsx     # Card for cancelled/rescheduled
            ├── financial-summary.tsx    # Money tab summary
            ├── expense-manager.tsx      # Expense CRUD
            ├── financial-history.tsx    # Historical view
            └── bottom-nav.tsx           # Navigation component
```

---

## Implementation Roadmap

### Phase 1: Order Visibility Fix (Priority: Critical)

**Duration:** 3-5 days

| Task | Files Affected | Description |
|------|----------------|-------------|
| 1.1 | `deliveries/page.tsx` | Add Issues tab with CANCELLED/RESCHEDULED filtering |
| 1.2 | `driver-stats.tsx` | Add cancelled/rescheduled counts to stats |
| 1.3 | `queries.ts` | Update getDriverStats to include all status counts |
| 1.4 | `enhanced-order-card.tsx` | Add status badge and reason display |
| 1.5 | `use-unable-to-deliver.ts` | Implement optimistic updates |

### Phase 2: Real-Time Stats (Priority: High)

**Duration:** 2-3 days

| Task | Files Affected | Description |
|------|----------------|-------------|
| 2.1 | `use-get-driver-stats.ts` | Add refetchInterval and staleTime |
| 2.2 | `use-update-order.ts` | Add optimistic updates for completions |
| 2.3 | `stats-dashboard.tsx` | New component with live indicators |
| 2.4 | All mutation hooks | Add proper cache invalidation |

### Phase 3: Session-Based Design (Priority: Medium)

**Duration:** 4-5 days

| Task | Files Affected | Description |
|------|----------------|-------------|
| 3.1 | `schema.prisma` | Add DriverSession model (optional) |
| 3.2 | `queries.ts` | Update order fetching with business date logic |
| 3.3 | `deliveries/page.tsx` | Add date selector with session awareness |
| 3.4 | `getBusinessDate()` | Utility for midnight handling |

### Phase 4: Financial Dashboard (Priority: Medium)

**Duration:** 5-7 days

| Task | Files Affected | Description |
|------|----------------|-------------|
| 4.1 | `financials/page.tsx` | New financial summary page |
| 4.2 | `financials/expenses/page.tsx` | Enhanced expense management |
| 4.3 | `financials/history/page.tsx` | Historical financial view |
| 4.4 | `financial-summary.tsx` | Collection breakdown component |
| 4.5 | API updates | Enhanced financial endpoints |

### Phase 5: UI/UX Polish (Priority: Low)

**Duration:** 3-4 days

| Task | Files Affected | Description |
|------|----------------|-------------|
| 5.1 | `layout.tsx` | Implement bottom navigation |
| 5.2 | `bottom-nav.tsx` | Navigation component |
| 5.3 | All screens | Consistent styling and transitions |
| 5.4 | Loading states | Skeleton loaders everywhere |

---

## Database Schema Changes

### Option A: Minimal Changes (Recommended for Quick Fix)

No new tables required. Enhance existing queries to include all statuses.

```prisma
// No schema changes needed
// Just update queries to return CANCELLED and RESCHEDULED orders
```

### Option B: Full Session Support (For Complete Implementation)

```prisma
// Add to schema.prisma

model DriverSession {
  id            String    @id @default(cuid())
  driverId      String
  driver        DriverProfile @relation(fields: [driverId], references: [id])

  sessionDate   String    // Business date YYYY-MM-DD
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  isActive      Boolean   @default(true)

  // Link to orders completed in this session
  orders        Order[]

  // Link to cash handover
  cashHandover  CashHandover?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([driverId, sessionDate])
  @@index([driverId])
  @@index([sessionDate])
  @@index([isActive])
}

// Add sessionId to Order model
model Order {
  // ... existing fields ...

  sessionId     String?
  session       DriverSession? @relation(fields: [sessionId], references: [id])

  // ... rest of model ...
}
```

---

## API Endpoint Changes

### Enhanced Driver Stats Endpoint

```typescript
// GET /api/drivers/me/stats
// Enhanced response

interface EnhancedDriverStats {
  // Date context
  date: string;
  isToday: boolean;

  // Order breakdown
  orders: {
    total: number;
    pending: number;      // PENDING + IN_PROGRESS
    completed: number;    // COMPLETED
    cancelled: number;    // CANCELLED
    rescheduled: number;  // RESCHEDULED
  };

  // Financial breakdown
  financial: {
    cashCollected: number;
    onlineCollected: number;
    creditGiven: number;
    totalExpenses: number;
    approvedExpenses: number;
    netCash: number;
  };

  // Bottle tracking
  bottles: {
    filledGiven: number;
    emptyTaken: number;
    damagedReturned: number;
    balance: number;
  };

  // Rates
  completionRate: number;  // (completed / total) * 100
}
```

### New Financial History Endpoint

```typescript
// GET /api/drivers/me/financial-history
// Query params: startDate, endDate

interface FinancialHistoryResponse {
  period: {
    start: string;
    end: string;
  };

  summary: {
    totalCollected: number;
    totalExpenses: number;
    netEarnings: number;
    ordersCompleted: number;
  };

  dailyBreakdown: Array<{
    date: string;
    collected: number;
    expenses: number;
    net: number;
    ordersCompleted: number;
    handoverStatus: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    discrepancy?: number;
  }>;
}
```

---

## Technical Specifications

### React Query Configuration

```typescript
// Recommended query settings for driver app

const DRIVER_QUERY_CONFIG = {
  // Stats - refresh frequently
  stats: {
    staleTime: 10 * 1000,       // 10 seconds
    refetchInterval: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  },

  // Orders - moderate refresh
  orders: {
    staleTime: 30 * 1000,       // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  },

  // Financial - less frequent
  financial: {
    staleTime: 60 * 1000,       // 1 minute
    refetchInterval: 120 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  },
};
```

### Optimistic Update Pattern

```typescript
// Standard pattern for all mutations

const useOptimisticMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    queryKey: string[];
    optimisticUpdate: (old: TData, variables: TVariables) => TData;
    invalidateKeys?: string[][];
  }
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const previous = queryClient.getQueryData(options.queryKey);

      queryClient.setQueryData(options.queryKey, (old: TData) =>
        options.optimisticUpdate(old, variables)
      );

      return { previous };
    },

    onError: (err, variables, context) => {
      queryClient.setQueryData(options.queryKey, context?.previous);
      toast.error('Operation failed. Please try again.');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: options.queryKey });
      options.invalidateKeys?.forEach(key =>
        queryClient.invalidateQueries({ queryKey: key })
      );
    },
  });
};
```

### Mobile Performance Optimizations

```typescript
// Performance considerations for mobile

const MOBILE_OPTIMIZATIONS = {
  // Virtualize long lists
  orderList: {
    useVirtualization: true,  // For 20+ orders
    itemHeight: 180,
    overscan: 3,
  },

  // Image optimization
  images: {
    lazy: true,
    placeholder: 'blur',
  },

  // Reduce bundle
  codeSpitting: {
    financialHistory: 'lazy',  // Load on demand
    mapView: 'lazy',           // Load on demand
  },

  // Offline support
  offline: {
    cacheOrders: true,
    cacheStats: true,
    syncOnReconnect: true,
  },
};
```

---

## Success Metrics

After implementation, the driver app should achieve:

| Metric | Current | Target |
|--------|---------|--------|
| Order status accuracy | ~80% | 100% |
| Stats update delay | 5-10 seconds | < 1 second (optimistic) |
| Driver complaints about missing data | Frequent | Zero |
| Cash handover discrepancies | High | Reduced by 50% |
| Driver trust in system | Low | High |

---

## Summary

This master plan provides a comprehensive solution for the Blue Ice driver app issues:

1. **Order Visibility:** Three-tab system (To Do, Done, Issues) with immediate status updates
2. **Real-Time Stats:** Optimistic updates + polling for near-instant feedback
3. **Date Handling:** Session-based model with business date logic for midnight crossover
4. **Financial Transparency:** Dedicated Money tab with full daily breakdown
5. **UI/UX:** Bottom navigation with clear screen hierarchy

The implementation follows real-world delivery app patterns (Uber, Careem, Foodpanda) and prioritizes driver trust and transparency. All changes are backward-compatible and can be implemented incrementally.

---

*Document prepared for Blue Ice CRM - January 2026*
