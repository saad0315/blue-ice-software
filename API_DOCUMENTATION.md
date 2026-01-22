# API Documentation

## Base URL
`/api`

## Authentication
All endpoints (except login/register) require an **HTTP-only Cookie** named `auth_cookie`.
Headers: `Content-Type: application/json`

## Endpoints

### 1. Authentication
*   **POST** `/auth/login`
    *   **Body:** `{ "emailOrPhone": "...", "password": "..." }`
    *   **Response:** `{ "data": { "user": ... } }` (Sets Cookie)
*   **GET** `/auth/current`
    *   **Response:** `{ "data": { "id": "...", "role": "..." } }`

### 2. Orders
*   **GET** `/orders`
    *   **Query Params:** `?page=1&limit=10&status=PENDING&driverId=...`
    *   **Response:** `{ "data": [...], "pagination": {...} }`
*   **POST** `/orders`
    *   **Body:** `{ "customerId": "...", "products": [{ "id": "...", "quantity": 2 }] }`
*   **PATCH** `/orders/:id`
    *   **Body:** `{ "status": "COMPLETED", "cashCollected": 400 }`

### 3. Inventory
*   **GET** `/inventory/stats`
    *   **Response:** `{ "warehouse": { "filled": 100, "empty": 50 }, "trucks": ... }`
*   **POST** `/inventory/handover/load`
    *   **Body:** `{ "driverId": "...", "items": [{ "productId": "...", "quantity": 50 }] }`

### 4. Drivers
*   **GET** `/drivers`
    *   **Response:** List of active drivers.

## Error Handling
Standard HTTP Status Codes:
*   `200`: Success
*   `400`: Validation Error (Zod)
*   `401`: Unauthorized (Not logged in)
*   `403`: Forbidden (Wrong role)
*   `404`: Not Found
*   `500`: Server Error

## RPC Client (Type-Safe)
The frontend uses `hono/client` for type-safe requests.
```typescript
const response = await client.api.orders.$get({ query: { status: 'PENDING' } });
const data = await response.json();
```
