# SHOP POS - YUVA

Multi-shop point of sale for SIVASHANMUKA MULTI STORE and SIVASHANMUKA SMART SHOP. The repository keeps its existing React/TypeScript/Vite client and adds a modular Express API in TypeScript with PostgreSQL and Prisma.

## Stack and layout

- `client/`: React 19, TypeScript 6 and Vite 8 frontend.
- `server/`: Express 5, TypeScript, Prisma 6, PostgreSQL, bcrypt password hashes, PostgreSQL-backed server sessions.
- `server/prisma/`: initial schema, versioned migration and idempotent shop/optional owner seed.
- Architecture: modular monolith with a REST API. No inventory or sales features are added in Phase 1.

## Local development

Requirements: Node.js 22 LTS, npm 10+, and PostgreSQL 15+.

1. Create a local database and application role; grant that role access to the database schema.
2. Copy `server/.env.example` to `server/.env`; set `DATABASE_URL`, and replace `SESSION_SECRET` with a private random value of at least 32 characters. Keep real secrets out of Git.
3. Install dependencies from the repository root with `npm install`.
4. Apply the migration and generate Prisma Client: `npm run db:deploy` then `npm run db:generate`.
5. Seed the two shops: `npm run db:seed`.
6. Start the API using `npm run dev`, and the client in another terminal using `npm run dev:client`.

The API listens on port 4000 by default. `CLIENT_ORIGIN` must exactly match the browser origin. The session cookie is HTTP-only, SameSite strict, and Secure in staging/production. Unsafe browser requests require both the configured Origin and the CSRF token returned by login/session lookup. Send the selected authorized shop as `X-Shop-Id`; this header is only context, and the API checks membership and role against PostgreSQL on every shop-protected request.

## First owner account

The seed creates the two shops but does not create predictable staff credentials. To create the first owner, set `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_PASSWORD` (at least 12 characters), and optionally `BOOTSTRAP_OWNER_NAME` in a private environment, then run `npm run db:seed`. The owner is explicitly granted OWNER membership in both shops. Remove bootstrap values from the environment after use. Staff provisioning and account recovery workflow remain operational decisions for Phase 0/owner handover.

## Environments and deployment

Use distinct PostgreSQL databases and secrets for development, staging, and production. Set `NODE_ENV=staging` or `production`, `CLIENT_ORIGIN` to the exact HTTPS origin, `SESSION_SECRET` to a unique secret, and `TRUST_PROXY=true` only when the service is behind a trusted single reverse proxy. Apply migrations with `npm run db:deploy` during deployment; do not run development migrations against production. `/health/live` checks process liveness and `/health/ready` verifies database connectivity.

Hosting, domain, TLS termination, backup retention, restore time objectives, and production account ownership are not provisioned by this repository. Configure these in customer-owned infrastructure and verify a restore before launch. The developer handover PDF named in the task was not available in the workspace; this implementation follows the approved Phase 1 list from the finalized roadmap conversation and this README's previously recorded architecture rules.

## Phase 1 data and security baseline

- `User`, `Shop`, and per-shop `Membership` records with OWNER, MANAGER, and CASHIER roles.
- PostgreSQL-backed `user_sessions` with expiration index; no in-memory production sessions.
- Session ID regeneration on login, login rate limiting, generic credential errors, password hashing, HTTP-only cookies and CSRF/origin checks.
- Server-side membership checks derive shop access from the signed-in user, never from a client-supplied shop ID alone.
- Append-style `AuditLog` records actor, shop, action, request ID, IP, timestamp, and optional metadata for login/logout and protected shop checks.
- Prisma uses PostgreSQL `Decimal` capability for future financial fields. Sales, inventory, and their transaction rules belong to later phases.

## Checks

Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run db:validate`. The repository has no test suite yet. Database migrations and seeds additionally require a reachable PostgreSQL instance configured through `DATABASE_URL`.

## Owner decisions still OPEN

Currency and rounding, global versus shop-specific price policy, discount permissions/approval, weighed barcode behavior, expiry-tracked categories, return/refund policy, tax and receipt requirements, device specifications, supplier payment allocation, backup retention and recovery targets. These are not encoded as business rules in Phase 1.
