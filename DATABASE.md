# Database Schema

## Overview

The database is **PostgreSQL**. The schema is managed by **Prisma**.
The design focuses on **Relational Integrity** and **Auditability**.

## Core Tables

### 1. `User` (Polymorphic Base)
*   **Purpose:** Authentication and basic profile.
*   **Key Fields:** `id`, `phoneNumber`, `password`, `role` (ENUM).
*   **Roles:** `SUPER_ADMIN`, `ADMIN`, `DRIVER`, `CUSTOMER`.

### 2. `CustomerProfile`
*   **Purpose:** Extends User for clients.
*   **Key Fields:** `address`, `geoLat`, `geoLng`, `creditLimit`, `cashBalance`.
*   **Relations:** `orders`, `bottleWallets` (Inventory at customer), `specialPrices`.

### 3. `DriverProfile`
*   **Purpose:** Extends User for employees.
*   **Key Fields:** `vehicleNo`, `licenseNo`, `currentLat`, `currentLng`.
*   **Relations:** `assignedOrders`, `inventoryHandovers`, `cashHandovers`.

### 4. `Order`
*   **Purpose:** A single delivery transaction.
*   **Key Fields:** `status` (SCHEDULED, COMPLETED...), `totalAmount`, `cashCollected`.
*   **Relations:** `items` (OrderItems), `customer`, `driver`.

### 5. `Product`
*   **Purpose:** Items being sold/rented.
*   **Key Fields:** `sku`, `basePrice`, `stockFilled`, `stockEmpty`.

### 6. `InventoryHandover`
*   **Purpose:** Tracks movement of stock between Warehouse and Driver.
*   **Key Fields:** `type` (LOAD/RETURN), `status`, `driverId`.
*   **Relations:** `items`.

### 7. `CashHandover`
*   **Purpose:** Reconciliation of cash collected by drivers.
*   **Key Fields:** `expectedCash`, `actualCash`, `discrepancy`.
*   **Logic:** Linked to `Order` via `cashHandoverId`.

## Entity Relationship Diagram (Text)

```
User (1) ---- (0..1) CustomerProfile
User (1) ---- (0..1) DriverProfile

CustomerProfile (1) ---- (N) Order
DriverProfile   (1) ---- (N) Order

Order (1) ---- (N) OrderItem
OrderItem (N) ---- (1) Product

DriverProfile (1) ---- (N) InventoryHandover
InventoryHandover (1) ---- (N) InventoryHandoverItem

DriverProfile (1) ---- (N) CashHandover
CashHandover (1) ---- (N) Order (Orders settled in this handover)
```

## Migration Strategy
*   **Tool:** Prisma Migrate (`npx prisma migrate dev`).
*   **Seed:** `prisma/seed.ts` populates initial data.
