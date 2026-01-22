# Blue Ice CRM

Blue Ice CRM is a comprehensive **Water Delivery Management System** built for optimizing operations, tracking inventory, managing drivers, and streamlining customer orders. It is designed to handle the specific complexities of the water delivery business, such as bottle exchange (filled vs. empty), driver route optimization, and cash reconciliation.

## 🚀 Key Features

*   **Order Management:** Automated scheduling, bulk assignment, and real-time status tracking.
*   **Driver Mobile View:** Mobile-first interface for drivers to view routes, complete deliveries, and capture proof of delivery.
*   **Inventory Tracking:** End-to-end tracking of water bottles (Warehouse ↔ Truck ↔ Customer).
*   **Cash Reconciliation:** Transaction-based settlement system for driver cash handovers.
*   **Customer Management:** Detailed profiles, pricing tiers, bottle wallets, and delivery history.
*   **Route Optimization:** Assign customers to specific routes and sequences.
*   **Financials:** Expense tracking, customer credit limits, and automated ledger updates.

## 🛠 Tech Stack

*   **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Database:** PostgreSQL (via [Prisma ORM](https://www.prisma.io/))
*   **API:** [Hono](https://hono.dev/) (mounted on Next.js API Routes)
*   **State Management:** TanStack Query (React Query)
*   **UI Components:** Shadcn/ui, Tailwind CSS, Lucide React
*   **Forms:** React Hook Form, Zod
*   **Maps:** Leaflet / React-Leaflet
*   **Testing:** Playwright (E2E), Vitest (Unit)
*   **Authentication:** Custom JWT-based Auth (HTTP-only cookies)

## 🏗 Architecture

The project follows a **Feature-Sliced Design** pattern to ensure scalability and maintainability.

*   `src/features/*`: Contains domain-specific logic (e.g., `orders`, `drivers`, `inventory`).
*   `src/lib/*`: Shared utilities, database connections, and middleware.
*   `src/app/*`: Next.js App Router structure.

## ⚡ Getting Started

### Prerequisites

*   Node.js 18+
*   PostgreSQL
*   Bun (optional, but used in lockfile) or npm/yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-org/blue-ice-crm.git
    cd blue-ice-crm
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    bun install
    ```

3.  **Environment Variables:**
    Create a `.env` file in the root directory:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/blue_ice_db"
    NEXT_PUBLIC_APP_URL="http://localhost:3000"
    JWT_SECRET="your-super-secret-key"
    SMTP_SERVER_USERNAME="email@example.com"
    SMTP_SERVER_PASSWORD="password"
    # ... see .env.example
    ```

4.  **Database Setup:**
    ```bash
    npx prisma generate
    npx prisma db push
    # Seed the database (optional)
    npx prisma db seed
    ```

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:3000`.

## 🧪 Testing

*   **Unit Tests:** `npm run test:unit` (Vitest)
*   **E2E Tests:** `npm run test` (Playwright)

## 📦 Deployment

The application is designed to be deployed on **Vercel** or via **Docker**.

*   **Vercel:** Standard Next.js deployment. Ensure environment variables are set.
*   **Docker:** Use the provided `docker-compose.yml` for containerized deployment.

## 📚 Documentation

Detailed documentation is available in the root directory:

*   [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and data flow.
*   [FEATURES.md](./FEATURES.md) - Detailed feature breakdowns.
*   [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API endpoints and usage.
*   [DATABASE.md](./DATABASE.md) - Schema and relationships.
*   [USER_FLOW.md](./USER_FLOW.md) - User journeys and UX.
*   [DEPLOYMENT.md](./DEPLOYMENT.md) - Build and deploy guide.
