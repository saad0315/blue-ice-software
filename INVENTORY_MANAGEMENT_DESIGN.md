# Inventory Management System Design: Truck Inventory & Reconciliation

## 1. Problem Statement
The current system tracks warehouse inventory and customer sales but lacks a formal record of **"Truck Inventory"** (bottles loaded vs. bottles returned). This creates a gap where:
- Warehouse stock is decremented only at the moment of delivery (race condition).
- There is no verification that the driver loaded the correct amount.
- Returns (leftover stock) are not formally tracked.

## 2. Solution: Truck Inventory Handover
We will introduce a **"Load Sheet"** (Start of Shift) and **"Return Sheet"** (End of Shift) workflow. This will move inventory from "Warehouse" to "Driver" and back.

### 2.1 Core Concepts
1.  **Warehouse Stock:** Physical stock in the plant.
2.  **Driver Stock:** Stock currently on the truck.
3.  **Net Sales:** `Loaded - Returned` (Must match Sales).

### 2.2 New Data Models

We will introduce a `StockTransaction` model (if not already present) or extend the system to handle these moves.

**Schema Update:**

```prisma
// New Enum for Transaction Types
enum StockTransactionType {
  RESTOCK_IN         // Supplier -> Warehouse
  DRIVER_LOAD        // Warehouse -> Driver (Check-out)
  DRIVER_RETURN      // Driver -> Warehouse (Check-in)
  DAMAGE_WAREHOUSE   // Warehouse -> Trash
  DAMAGE_DRIVER      // Driver -> Trash (Broken on route)
}

model StockTransaction {
  id          String   @id @default(uuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id])

  driverId    String?  // If transaction involves a driver
  driver      DriverProfile? @relation(fields: [driverId], references: [id])

  type        StockTransactionType
  quantity    Int

  // Audit
  createdAt   DateTime @default(now())
  createdById String
  notes       String?
}
```

*Note: Since we are in a production-ready phase, we might want to avoid heavy migrations if possible. However, `StockTransaction` is essential for audit.*

### 2.3 Revised Workflow

#### Step 1: Morning Load (Warehouse -> Driver)
- **Actor:** Inventory Manager / Driver
- **Action:** "Create Load Sheet"
- **System:**
  - Creates `StockTransaction` (Type: `DRIVER_LOAD`).
  - **Decrements** `Product.stockFilled` (Warehouse).
  - **Increments** `DriverInventory` (Virtual or Real). *Ideally, we just track the transaction, but having a `DriverInventory` table helps.*

#### Step 2: Delivery (Driver -> Customer)
- **Actor:** Driver
- **Action:** Complete Order
- **System:**
  - Records Sale in `Order`.
  - **Does NOT decrement `Product.stockFilled`** (because it was already removed in Step 1).
  - *Correction:* To avoid massive refactoring, we can keep the current logic BUT modify it to check: "Did this driver do a formal Load Sheet today?".
  - **Preferred Strategy:** Switch all drivers to Load Sheet model. `updateOrder` stops touching `stockFilled` for `filledGiven`. It only touches `stockEmpty` (Driver takes empties) and `stockDamaged`.

#### Step 3: Evening Return (Driver -> Warehouse)
- **Actor:** Inventory Manager
- **Action:** "Verify Return"
- **System:**
  - Count physical bottles on truck.
  - Create `StockTransaction` (Type: `DRIVER_RETURN`).
  - **Increments** `Product.stockFilled` (Warehouse).

### 2.4 Reconciliation (End of Day)
The system calculates:
- **Starting Load:** 50
- **Sold (per Orders):** 40
- **Expected Return:** 10
- **Actual Return:** 8
- **Discrepancy:** -2 (Missing/Lost)

This Discrepancy is recorded (similar to Cash Discrepancy) and linked to the Driver.

## 3. Implementation Plan

### Phase 1: Database Schema (High Priority)
1.  Create `StockTransaction` model.
2.  Add `stockReserved` to `Product` (optional, for safety).

### Phase 2: Backend Logic
1.  Create `POST /api/inventory/load` (Driver Load).
2.  Create `POST /api/inventory/return` (Driver Return).
3.  **Refactor `updateOrder`**:
    - Remove `stockFilled` decrement logic.
    - Keep `stockEmpty` increment logic (Empties returned by customer).

### Phase 3: Frontend UI
1.  **Load Sheet Screen:** Input quantities per product.
2.  **Return Sheet Screen:** Input quantities per product.
3.  **Reconciliation Report:** Show Load vs. Sold vs. Return.

## 4. Risk Mitigation
- **Transition Period:** If we deploy this, existing `updateOrder` logic stops updating stock. We must ensure drivers start using Load Sheets immediately, or we add a feature flag `ENABLE_TRUCK_INVENTORY`.
- **Flag Logic:**
  - Add `useTruckInventory` boolean to `SystemSettings` (or env var).
  - If `true`: `updateOrder` skips stock decrement.
  - If `false`: `updateOrder` continues decrementing (Legacy Mode).

## 5. Recommendation
We proceed with **Phase 1 & 2** immediately to close the loop on inventory accuracy.
