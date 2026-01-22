# User Journeys

## 1. Admin / Manager Journey

### Entry Point
*   **URL:** `/login`
*   **Credentials:** Admin Email & Password.

### Dashboard Overview
*   **Home:** See high-level stats (Total Orders, Revenue, Active Drivers).
*   **Sidebar:** Navigation to Orders, Customers, Inventory, Drivers.

### Workflow: Assigning Deliveries
1.  Navigate to **Orders**.
2.  Filter by Status: `SCHEDULED`.
3.  Select multiple orders using checkboxes.
4.  Click **Bulk Assign**.
5.  Select a **Driver** from the dropdown.
6.  **Confirm**. Status updates to `PENDING`.

### Workflow: Inventory Load (Morning)
1.  Navigate to **Truck Inventory**.
2.  Click **New Load Sheet**.
3.  Select **Driver**.
4.  System auto-fills quantity based on scheduled orders (Smart Load).
5.  Adjust if necessary.
6.  **Submit**. Status: `PENDING`.
7.  Once physically loaded, mark as `CONFIRMED`.

## 2. Driver Journey (Mobile)

### Entry Point
*   **URL:** `/login` (Mobile optimized).
*   **Credentials:** Phone Number & Password.

### Daily Routine
1.  **Login:** View Dashboard.
2.  **Accept Load:** See "Pending Load Sheet". Verify bottles on truck. Accept.
3.  **Start Route:** Click "Start Duty". Location tracking begins (if enabled).
4.  **Deliver:**
    *   Tap on a Customer Card.
    *   Click **Complete Delivery**.
    *   Input:
        *   Bottles Given: `2`
        *   Bottles Returned: `2`
        *   Payment: `Cash` -> `400`
    *   **Submit**.
5.  **End of Day:**
    *   Return to warehouse.
    *   **Cash Handover:** Enter total cash collected. Submit.
    *   **Return Stock:** Warehouse manager checks truck. Driver confirms Return Sheet.

## 3. Customer Journey (Future / Proxy)
*Currently, customers interact via Phone/WhatsApp, and the Admin acts on their behalf.*

1.  **Call:** Customer calls to place order.
2.  **Admin:** Opens **Create Order** modal.
3.  **Search:** Finds customer by Name/Phone.
4.  **Input:** Selects Product & Quantity.
5.  **Save:** Order is created.

## Error Paths

*   **Driver Shortage:** If a driver submits less cash than expected, the system flags a **Discrepancy**.
    *   Admin must review and either "Reject" or "Adjust" the handover.
*   **Stock Loss:** If `Return Sheet` shows missing bottles.
    *   Logged as `LOSS_OUT` in Stock Transaction.
    *   Driver may be penalized (Manual process).
