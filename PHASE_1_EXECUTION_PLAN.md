# Phase 1 Execution Plan: Transaction-Based Settlement

## 1. Deep-Dive Scope Definition

**Phase 1 Goal:** Establish a flawless financial linkage between Orders/Expenses and Cash Handovers.

**In Scope:**
*   **Schema Update:** Add `cashHandoverId` to `Order` and `Expense` tables. Remove unique date constraints on `CashHandover`.
*   **Submission Logic:** Rewrite `submitCashHandover` to perform atomic linkage (snapshotting) of all pending items at the moment of submission.
*   **Verification Logic:** Rewrite `verifyCashHandover` to rely solely on linked items (not dates).
*   **Dashboard Updates:** Update `getDriverDaySummary` and `getDriverStats` to sum unlinked items for "Pending Cash".
*   **Frontend Tweaks:** Minor updates to the Driver Handover screen to handle "snapshot" logic (e.g., refreshing the summary before submit).

**Out of Scope (Deferred to Phase 2):**
*   **Double-Entry Ledger:** We will stick to the current "Discrepancy Ledger" for launch.
*   **Partial Handovers:** Drivers must hand over *all* currently pending cash. Partial selection is a complex UI feature deferred for later.
*   **Historical Migration:** Since we are starting fresh (greenfield), no data migration scripts are needed.

**Edge Cases to Handle:**
*   **Concurrency:** An order completes while the driver is on the Handover screen.
    *   *Solution:* The Submission API will re-calculate the total based on *currently* available unlinked orders. It returns the actual linked amount. If this differs from what the driver typed, it creates a discrepancy. This is safer than locking UI.
*   **Resubmission:** Driver submits, realizes mistake, wants to fix.
    *   *Solution:* If status is `PENDING`, allow "Cancel/Delete" which unlinks all orders. Then driver submits new one. (Simpler than "Edit").

---

## 2. Phase 1 Completion Criteria

1.  **Database Integrity:** `Order` and `Expense` tables have `cashHandoverId` column.
2.  **Logic Verification:**
    *   Submitting a handover sets `cashHandoverId` on all target orders.
    *   Verifying a handover does *not* seal future dates or unrelated orders.
    *   A late-completed order (after yesterday's verification) appears in *today's* pending list.
3.  **UI Verification:** Driver sees correct "Pending Cash" even across multiple days.
4.  **Financial Check:** `Sum(Completed Orders) - Sum(Approved Expenses)` matches `Sum(Verified Handovers) + Pending Balance` exactly.

---

## 3. Step-by-Step Implementation Plan

### Step 1: Schema Changes
1.  Modify `prisma/schema.prisma`:
    *   Add `cashHandoverId` (String?, nullable) to `Order` model.
    *   Add `cashHandoverId` (String?, nullable) to `Expense` model.
    *   Add relations in `CashHandover` model (`orders Order[]`, `expenses Expense[]`).
    *   **Remove** `@@unique([driverId, date])` from `CashHandover`.
2.  Run `npx prisma migrate dev --name init_transaction_based`.

### Step 2: Core Logic Changes (Backend)
1.  **Update `getDriverDaySummary`:**
    *   Change logic to: `pendingCash = db.order.aggregate({ where: { driverId, status: COMPLETED, cashHandoverId: NULL } })`.
    *   Include pending expenses similarly.
2.  **Update `submitCashHandover`:**
    *   Fetch all `unlinked` cash orders and `unlinked` approved expenses for the driver.
    *   Create `CashHandover` record.
    *   **Atomic Update:** `db.order.updateMany({ where: { id: { in: orderIds } }, data: { cashHandoverId: newId } })`.
    *   Calculate `expectedCash` from these linked items.
3.  **Update `verifyCashHandover`:**
    *   Remove all date-based logic.
    *   Simply update status to `VERIFIED`.
    *   (Ledger entry creation for discrepancy remains same).
4.  **Add `cancelCashHandover`:**
    *   New endpoint to delete a PENDING handover and set `cashHandoverId = null` on linked items.

### Step 3: API & Frontend Updates
1.  **Driver Stats API:** Ensure `totalPendingCash` uses the new query.
2.  **Handover Page (`src/app/(driver)/cash-handover/page.tsx`):**
    *   The "Pending from Previous Days" alert is no longer needed in its current complex form. It just becomes "Total Pending Cash".
    *   The breakdown can now list specific *Orders* instead of just *Dates*.
    *   Add a "Refresh" button to ensure the driver sees the latest "Total Expected" before typing.

---

## 4. Risk Analysis

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| **Concurrency (Cash changes during submit)** | Medium | The server calculates the "Official Expected" at the moment of submission. Discrepancies will capture the diff. |
| **Admin rejects but forgets to communicate** | Low | Rejected orders return to "Pending" pool immediately. Driver sees them again next time. |
| **Performance (Large lists)** | Low | Querying `cashHandoverId: null` is very fast with an index. |

**Acceptable for Launch:**
*   Discrepancy Ledger only (no full double-entry).
*   "All or Nothing" handover (no partial selection).

---

## 5. Senior Engineer Confidence Check

**Can we go live confidently?**
**Yes.** This architecture is standard for financial systems ("Ledger/Journal" model). It removes the specific fragility of the date-based buckets.

**Will Phase 2 break Phase 1?**
**No.**
*   Phase 2 (Double-Entry Ledger) is *additive*. It listens to the same events (`OrderCompleted`, `HandoverVerified`) and writes to a *new/updated* table (`DriverLedger`). It does not change how Handovers are created or verified.
*   The `cashHandoverId` linkage remains the source of truth for "What has been paid".

### Final Recommendation
Proceed immediately with this plan. It is the correct foundation.
