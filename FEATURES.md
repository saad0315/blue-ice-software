# Features Documentation

## 1. Order Management

**Business Purpose:** The core engine of the CRM, handling the lifecycle of water delivery from scheduling to completion.

*   **User Flow:**
    1.  **Creation:** Admin creates an order manually or the system auto-generates it based on a customer's frequency.
    2.  **Assignment:** Orders are assigned to a specific Route or Driver.
    3.  **Delivery:** Driver sees the order in the mobile view, delivers water, collects empty bottles, and payment.
    4.  **Completion:** Driver marks order as `COMPLETED`. Status updates in real-time.
    5.  **Reconciliation:** Cash collected is tracked against the driver's pending handover.

*   **Key Files:**
    *   `src/features/orders/server/route.ts` (API)
    *   `src/features/orders/queries.ts` (Logic)
    *   `src/features/orders/components/order-table.tsx` (UI)

*   **Logic:**
    *   **Bottle Exchange:** Tracks `filledGiven` vs `emptyTaken`.
    *   **Pricing:** Checks `CustomerProductPrice` first, then falls back to `Product.basePrice`.

## 2. Inventory Management (Truck Inventory)

**Business Purpose:** Prevents stock theft and ensures accurate accounting of bottles leaving and entering the warehouse.

*   **User Flow:**
    1.  **Load Sheet (Morning):** Warehouse Manager creates a `LOAD` handover. Driver confirms quantity. Stock moves from `Warehouse` -> `Driver`.
    2.  **Delivery (Day):** Driver delivers bottles. Stock moves `Driver` -> `Customer` (Logic handles this virtually).
    3.  **Return Sheet (Evening):** Driver returns to warehouse. Manager creates `RETURN` handover. Stock moves `Driver` -> `Warehouse`.
    4.  **Audit:** System calculates if the returned stock matches (Loaded - Delivered + Empty Collected).

*   **Key Files:**
    *   `src/features/inventory/server/route.ts`
    *   `src/features/inventory/queries.ts`
    *   `InventoryHandover` (Prisma Model)

*   **Logic:**
    *   **Smart Load:** Can predict required stock based on scheduled orders for the day.
    *   **Strict Handover:** Requires "Sign-off" status (`CONFIRMED`) to affect stock levels.

## 3. Driver Mobile View

**Business Purpose:** A simplified, mobile-friendly interface for drivers to manage their day without accessing the full admin panel.

*   **User Flow:**
    1.  **Login:** Driver logs in with phone number/password.
    2.  **Dashboard:** Sees summary of "Today's Orders".
    3.  **Route:** View map or list of stops.
    4.  **Action:** Click "Deliver". Enter bottles given/returned. Enter payment collected.
    5.  **Proof:** Upload photo if "House Locked" or signature if "Delivered".

*   **Key Files:**
    *   `src/features/driver-view/` (UI Components)
    *   `src/app/(driver)/driver/dashboard/page.tsx`

## 4. Cash Management (Reconciliation)

**Business Purpose:** Ensures every rupee collected by drivers is accounted for and deposited.

*   **User Flow:**
    1.  **Collection:** Driver collects cash throughout the day.
    2.  **Submission:** Driver "Submits" a Cash Handover request at the end of the shift.
    3.  **Verification:** Admin sees the request. Counts physical cash.
    4.  **Approval:** Admin marks as `VERIFIED`. The amount is logged in the company ledger.

*   **Key Files:**
    *   `src/features/cash-management/`
    *   `CashHandover` (Prisma Model)

*   **Logic:**
    *   **Transaction-Based:** Links specific Orders to a specific Handover ID.
    *   **Discrepancy:** Calculates `Expected - Actual`. Stores the difference.

## 5. Customer Management

**Business Purpose:** Maintains a database of clients, their preferences, pricing, and history.

*   **User Flow:**
    1.  **Onboarding:** Admin creates profile. Sets location (Lat/Lng), Price Tier, and Credit Limit.
    2.  **Wallet:** Tracks "Bottle Balance" (how many bottles they are holding).
    3.  **History:** View all past orders and payments.

*   **Key Files:**
    *   `src/features/customers/`
    *   `CustomerProfile` (Prisma Model)

*   **Logic:**
    *   **Polymorphism:** `User` table holds login info, `CustomerProfile` holds business data.
    *   **Credit Check:** Prevents new orders if `creditLimit` is exceeded.
