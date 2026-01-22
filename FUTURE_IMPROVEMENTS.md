# Future Improvements & Roadmap

## Technical Debt

*   **Complex Forms:** Some forms (like Order Creation) are becoming large. Refactor into smaller sub-components.
*   **Query Invalidations:** Review `queryKey` invalidation strategies to ensure data freshness without over-fetching.
*   **Type Safety:** Increase Zod schema coverage for all API responses, not just requests.

## Performance Improvements

*   **Virtualization:** Implement `tanstack/react-virtual` for large lists (Orders Table, Customer List).
*   **Image Optimization:** Use Next.js Image component more consistently with proper sizing.
*   **Redis Caching:** Implement Redis for caching expensive aggregate queries (e.g., Dashboard Stats).

## Security Improvements

*   **2FA:** Implement Two-Factor Authentication for Admin accounts.
*   **Audit Logs:** Expand the `AuditLog` table to cover *every* write action in the system.
*   **API Rate Limiting:** Apply rate limiting to all API routes, not just Auth.

## Feature Roadmap

### Phase 2: Finance & Accounting
*   **Double-Entry Ledger:** Move from simple balances to a full double-entry system.
*   **Expense Approval:** detailed workflow for driver expense reimbursements.

### Phase 3: Customer App
*   **Self-Service:** Allow customers to login, view history, and place orders.
*   **Online Payments:** Integrate Stripe / JazzCash for direct payments.

### Phase 4: Advanced Logistics
*   **Route Optimization:** Use Google Maps API to auto-sort delivery sequence based on traffic.
*   **Live Tracking:** Real-time driver location on map for Admins.
