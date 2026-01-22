# System Architecture

## Overview

Blue Ice CRM uses a **Monolithic Architecture** built on **Next.js 14**, leveraging the **App Router** for the frontend and **Hono** for a structured backend API layer running within Next.js API routes.

The system is designed to be **modular**, following a **Feature-Sliced Design** approach where business logic is encapsulated within specific feature folders (`src/features/*`) rather than being scattered across generic `components` or `utils` folders.

## High-Level Architecture Diagram

```ascii
+-------------------------------------------------------------+
|                       Client Layer                          |
|  (Browser / Mobile Web)                                     |
|                                                             |
|  +----------------+   +----------------+   +-------------+  |
|  |  Admin Panel   |   |   Driver App   |   | Customer App|  |
|  | (React/Next.js)|   | (React/Next.js)|   |  (Future)   |  |
|  +-------+--------+   +--------+-------+   +-------------+  |
+----------|---------------------|----------------------------+
           | HTTP / REST         | HTTP / REST
           v                     v
+-------------------------------------------------------------+
|                       API Layer                             |
|                (Next.js API Routes + Hono)                  |
|                                                             |
|  +-------------------+  +-------------------+               |
|  |   Auth Middleware |  |   Validation (Zod)|               |
|  +---------+---------+  +---------+---------+               |
|            |                      |                         |
|            v                      v                         |
|  +-------------------------------------------------------+  |
|  |                 Feature Modules (RPC)                 |  |
|  |  [Orders] [Inventory] [Drivers] [Customers] [Finance] |  |
|  +--------------------------+----------------------------+  |
+-----------------------------|-------------------------------+
                              | Prisma ORM
                              v
+-------------------------------------------------------------+
|                       Data Layer                            |
|                                                             |
|   +--------------+     +--------------+    +------------+   |
|   |  PostgreSQL  |     | Redis (Cache)|    | Blob Store |   |
|   | (Relational) |     |  (Optional)  |    | (Images)   |   |
|   +--------------+     +--------------+    +------------+   |
+-------------------------------------------------------------+
```

## Folder Structure Strategy

We prioritize **collocation**. Everything related to a feature stays with that feature.

```
src/
├── app/                  # Next.js App Router (Pages & Layouts)
│   ├── (dashboard)/      # Admin Dashboard Routes
│   ├── (driver)/         # Driver Mobile Routes
│   └── api/              # API Entry Point
├── features/             # Core Business Logic
│   ├── orders/
│   │   ├── components/   # Order-specific UI
│   │   ├── queries.ts    # Database/Prisma Queries
│   │   ├── schema.ts     # Zod Validation Schemas
│   │   └── server/       # Hono API Routes
│   ├── inventory/
│   └── drivers/
├── components/           # Shared UI (Buttons, Inputs, Modals)
├── lib/                  # Global Utilities (DB, Auth, Dates)
└── hooks/                # Global React Hooks
```

## Data Flow

1.  **Client Request:** The user interacts with the UI. A TanStack Query hook (e.g., `useGetOrders`) fires.
2.  **RPC Call:** The request is sent to `/api/[[...route]]`. Hono routes the request to the specific feature controller (e.g., `src/features/orders/server/route.ts`).
3.  **Validation:** Zod schemas validate the input (`ctx.req.valid('json')`).
4.  **Middleware:** `sessionMiddleware` verifies the JWT `auth_cookie` and attaches the `user` object to the context.
5.  **Service Layer:** The route handler calls a function from `queries.ts` (e.g., `getOrders`).
6.  **Database Access:** Prisma Client executes the SQL query against PostgreSQL.
7.  **Response:** The data is returned as JSON.
8.  **Client Update:** TanStack Query caches the result and updates the UI.

## Database Design Principles

*   **Relational Integrity:** We use foreign keys extensively to ensure data consistency (e.g., `Order` -> `Customer`, `Order` -> `Driver`).
*   **Audit Trails:** Critical actions (Inventory, Cash) record snapshots of state before and after changes.
*   **Soft Deletes:** `isActive` or `status` fields are used instead of physical deletion for core entities like Users and Orders.
*   **Polymorphism:** The `User` table handles Auth, while `DriverProfile` and `CustomerProfile` extend it with role-specific data.

## Scalability Considerations

*   **Serverless Ready:** The API structure is compatible with Serverless functions (Vercel) or Edge runtimes.
*   **Database:** PostgreSQL can be scaled vertically or horizontally (Read Replicas).
*   **Caching:** TanStack Query handles client-side caching. Redis can be added for server-side caching if needed.

## Security Considerations

*   **Authentication:** HTTP-only Secure Cookies prevent XSS attacks on tokens.
*   **Authorization:** Role-based access control (RBAC) checks are performed at the API route level.
*   **Input Validation:** Strict Zod schemas prevent SQL injection and malformed data.
*   **Environment:** Sensitive keys (JWT Secret, DB URL) are managed via `.env` files.
