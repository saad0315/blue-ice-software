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

## 3. Workflow & Impact Analysis

### 3.1 Morning Load (Warehouse -> Driver)
- **Actor:** Warehouse Manager
- **Action:** Create Load Sheet
- **Logic:**
  - `Product.stockFilled` (Warehouse) **DECREMENTS** by Load Qty.
  - `Driver.truckStock` (Virtual) **INCREMENTS**.

### 3.2 Delivery Execution (Driver -> Customer)
- **Actor:** Driver
- **Action:** Complete Order (`updateOrder`)
- **Logic Changes:**
  - **STOP:** `Product.stockFilled` decrement (handled in Step 3.1).
  - **STOP:** `Product.stockEmpty` increment (handled in Step 3.3).
  - **CONTINUE:** `CustomerBottleWallet` updates (Customer balance logic remains untouched).
  - **CONTINUE:** `Order` record creation (Sales stats remain accurate).

### 3.3 Evening Return (Driver -> Warehouse)
- **Actor:** Warehouse Manager
- **Action:** Verify Return Sheet
- **Logic:**
  - Manager counts **Leftover Filled Bottles**.
    - `Product.stockFilled` (Warehouse) **INCREMENTS**.
  - Manager counts **Empty Bottles Returned**.
    - `Product.stockEmpty` (Warehouse) **INCREMENTS**.
    - *Validation:* Should match `Sum(Order.emptyTaken)`.

### 3.4 Reconciliation (End of Day)
The system calculates discrepancies:
- **Stock Reconciliation:** `Loaded - Returned = Sold`
- **Empty Reconciliation:** `Customer Returns (Orders) = Warehouse Returns (Physical)`

---

## 4. Deep Dive: Specific User Questions

### Q1: Will it affect the customer’s bottle wallet?
**Answer: No.**
The `CustomerBottleWallet` logic depends on `OrderItems` (specifically `filledGiven` and `emptyTaken`). Since the Driver still completes orders using the exact same form, the customer's balance updates correctly. The only change is *where* the inventory comes from in the backend (Truck vs Warehouse), which is invisible to the customer logic.

### Q2: How will we manage the empty bottles return flow?
**Answer: Two-Step Verification.**
1.  **Collection:** Driver collects empties from customers. This is recorded in the Order (e.g., `emptyTaken: 5`). This data stays on the "Digital Truck".
2.  **Warehouse Return:** At end of day, Warehouse Manager counts physical empties on the truck.
    - **System Check:** "Driver collected 50 empties according to orders."
    - **Physical Check:** "Driver actually returned 48 empties."
    - **Result:** 2 Empties Missing (Driver Discrepancy).
    - **Stock Update:** Warehouse `stockEmpty` increases by 48 (Physical reality).

### Q3: Will dashboard numbers (Given | Empty | Net) remain accurate?
**Answer: Yes, and they will be more verifiable.**
- **Dashboard Stats:** These are calculated from `Order` tables. Since we are *not* changing how orders are recorded, these graphs remain 100% accurate representations of *Sales Activity*.
- **Data Integrity:** By decoupling the *Sales Record* from the *Warehouse Inventory Update*, we actually prevent data corruption. Even if a driver makes a mistake in an order, the Warehouse Count (Load/Return) ensures the global inventory count remains physically accurate.

---

## 5. Risk Mitigation
- **Transition Period:** We will add a feature flag `ENABLE_TRUCK_INVENTORY`.
  - If `true`: `updateOrder` skips stock updates.
  - If `false`: `updateOrder` continues direct updates (Legacy Mode).

## 6. Recommendation
We proceed with the implementation plan. The design ensures customer data safety while fixing the warehouse inventory gaps.
