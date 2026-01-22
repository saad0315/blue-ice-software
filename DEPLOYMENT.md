# Deployment Guide

## Build Process

The project is built using Next.js build system.

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Build Next.js App
npm run build
```

This produces a `.next` folder containing the optimized production build.

## Environment Variables

Ensure these are set in your production environment (e.g., Vercel Project Settings or Docker `.env`).

*   `DATABASE_URL`: Connection string for PostgreSQL.
*   `JWT_SECRET`: Strong random string for token signing.
*   `NEXT_PUBLIC_APP_URL`: The domain where the app is hosted.
*   `SMTP_SERVER_*`: Email configuration.

## Deployment Options

### Option 1: Vercel (Recommended)
This project is optimized for Vercel.

1.  Push code to GitHub.
2.  Import project in Vercel.
3.  Add Environment Variables.
4.  Deploy.

**Note on Hono:** The Hono API runs within Next.js API Routes (Serverless Functions) on Vercel automatically.

### Option 2: Docker

A `docker-compose.yml` is provided for self-hosting.

1.  **Build Image:**
    ```bash
    docker build -t blue-ice-crm .
    ```

2.  **Run:**
    ```bash
    docker-compose up -d
    ```

## CI/CD

Currently, there is no automated CI/CD pipeline file (like `.github/workflows`), but the project is set up for it.

**Recommended Pipeline:**
1.  **Lint & Type Check:** `npm run lint`
2.  **Unit Tests:** `npm run test:unit`
3.  **Build:** `npm run build`
4.  **Deploy:** (Trigger Vercel or Push Docker Image)

## Database Migrations in Production

**Do not** run `prisma migrate dev` in production.
Use:
```bash
npx prisma migrate deploy
```
This applies pending migrations without resetting the database.
