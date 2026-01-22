# Codebase Structure

## Root Directory

*   `package.json`: Project dependencies and scripts.
*   `prisma/`: Database schema and migrations.
*   `public/`: Static assets (images, fonts).
*   `src/`: Source code.

## `src/` Directory Breakdown

### `src/app/` (Next.js App Router)
Handles routing and layout.

*   `api/`: The single entry point for Hono API.
    *   `[[...route]]/route.ts`: Catches all API requests and routes them to feature handlers.
*   `(dashboard)/`: Routes for the Admin Panel. Protected by auth middleware.
    *   `layout.tsx`: Sidebar, Header, and Auth Provider.
*   `(driver)/`: Routes for the Mobile Driver App.

### `src/features/` (Feature Modules)
The core of the application. Each folder represents a business domain.

Example: `src/features/orders/`
*   `components/`: UI components specific to orders (e.g., `OrderCard`, `OrderForm`).
*   `hooks/`: React Query hooks (e.g., `useGetOrders`, `useCreateOrder`).
*   `server/`: Backend logic.
    *   `route.ts`: Hono router definition.
*   `queries.ts`: Direct database interactions (Prisma).
*   `schema.ts`: Zod validation schemas for API inputs.
*   `types.ts`: TypeScript interfaces.

### `src/lib/` (Shared Utilities)
Code used across multiple features.

*   `db.ts`: Singleton instance of `PrismaClient`.
*   `hono.ts`: RPC Client configuration.
*   `session-middleware.ts`: Verifies JWT tokens on the server.
*   `utils.ts`: Helper functions (class merging, formatting).
*   `date-utils.ts`: Standardized date handling (UTC consistency).

### `src/components/` (Shared UI)
Generic, reusable UI elements.

*   `ui/`: Shadcn/ui components (Buttons, Inputs, Dialogs).
*   `layout/`: Sidebar, Header components.
*   `providers/`: Context providers (Theme, QueryClient).

### `src/hooks/` (Global Hooks)
React hooks useful across the app.

*   `use-mobile.tsx`: Detect screen size.
*   `use-toast.tsx`: Toast notifications.

## Key Conventions

1.  **Server Actions vs API:** We primarily use **Hono RPC** over Next.js Server Actions for better type safety and separation of concerns.
2.  **Validation:** All API inputs **must** be validated with Zod.
3.  **Naming:**
    *   Files: `kebab-case.ts`
    *   Components: `PascalCase.tsx`
    *   Functions: `camelCase`
4.  **Database Access:** Only allowed in `queries.ts` or `route.ts` files. UI components should never import `db`.
