# Authentication & Authorization

## Strategy
We use a **Custom JWT Implementation** with **HTTP-Only Cookies** for maximum security against XSS.

## Authentication Flow

1.  **Login Request:**
    *   User sends `emailOrPhone` and `password` to `/api/auth/login`.
    *   Server verifies credentials (bcrypt hash comparison).
    *   Server generates a JWT containing `userId` and `role`.
    *   Server sets the `auth_cookie` with `HttpOnly`, `Secure`, `SameSite=Strict` flags.

2.  **Protected Requests:**
    *   Client sends request (cookie is attached automatically by browser).
    *   `sessionMiddleware` runs on the server.
    *   It extracts the token from the cookie.
    *   Verifies signature using `JWT_SECRET`.
    *   Fetches the latest User data from DB (checks `suspended` and `isActive`).
    *   Attaches `user` object to the request context (`ctx.set('user', user)`).

3.  **Logout:**
    *   Server deletes the cookie.

## Authorization (RBAC)

We use **Role-Based Access Control**. The `UserRole` enum defines permissions.

### Roles
*   `SUPER_ADMIN`: Full access. Can delete data.
*   `ADMIN`: Operational access. Can manage orders, drivers, inventory.
*   `INVENTORY_MGR`: Restricted to Inventory features.
*   `DRIVER`: Restricted to Mobile View (own orders only).
*   `CUSTOMER`: (Future) Own profile and order history only.

### Implementation
Access control is enforced at the **Route Handler** level.

```typescript
// Example Authorization Check
const user = ctx.get('user');
if (user.role !== 'SUPER_ADMIN') {
  return ctx.json({ error: 'Unauthorized' }, 403);
}
```

## Security Best Practices
*   **No LocalStorage:** Tokens are never stored in LocalStorage to prevent XSS theft.
*   **CSRF Protection:** `SameSite=Strict` cookie attribute mitigates CSRF.
*   **Rate Limiting:** `authRateLimiter` middleware protects login endpoints from brute-force attacks.
