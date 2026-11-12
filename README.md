# Sivashanmuka POS

Phase 1 foundation for one business operating two physical shops. This repository contains a React/TypeScript/Vite client and a modular Express/TypeScript API using PostgreSQL and Prisma. Product catalogue, inventory, sales, purchasing, transfers, returns, cash sessions, expenses, and reports are intentionally not implemented in Phase 1.

The approved requirements source is [docs/Shop_POS_Yuva_Developer_Plan.pdf](docs/Shop_POS_Yuva_Developer_Plan.pdf). The document marks business policy and deployment details that still need owner approval as OPEN; this repository does not treat them as confirmed.

## Requirements

- Node.js 22 or newer and npm 10 or newer.
- A Neon account and a Neon PostgreSQL development branch.
- Git.

## Install

From the repository root:

```sh
npm run install:all
```

Create or select a **development branch** in the Neon project (for example, name it `development`). Get both connection strings from that branch: use its pooled connection for `DATABASE_URL` and its direct (non-pooled) connection for `DIRECT_DATABASE_URL`. Keep `sslmode=require` in both URLs. Confirm that both endpoints identify the same development branch.

After creating and verifying the branch, pin the local Neon CLI link to it without pulling or overwriting environment files. For a branch named `development`, run:

```sh
neon link --branch development --no-env-pull --no-config
```

Copy `server/.env.example` to `server/.env` only if the latter does not already exist. Otherwise update only the required values, preserving existing configuration. Set `NEON_TARGET_BRANCH` to the exact verified non-production branch name only after confirming both URLs point to it. Replace `SESSION_SECRET` with a private random value of at least 32 characters. The API validates required settings at startup. Never commit `.env` files or real credentials.

For a non-default API URL, copy `client/.env.example` to `client/.env` and set `VITE_API_URL` (without a trailing slash). The default is `http://localhost:4000`.

## Database

Prisma Client application queries and the seed use the pooled `DATABASE_URL`. Prisma Migrate uses `DIRECT_DATABASE_URL` through the Prisma 6 `directUrl` datasource setting. Before any database-changing command, the safety check requires all of the following:

- `NODE_ENV=development`
- `NEON_TARGET_BRANCH` is the exact non-production development branch name
- the local `.neon` link selects the same branch
- the pooled URL has Neon's `-pooler` host suffix, the direct URL does not, both require SSL, and both identify the same endpoint/database.

The branch-name setting is an explicit operator assertion; it cannot prove the Neon account's branch identity by itself. Verify both URLs and the `.neon` link in Neon before setting it. The checked-in scripts refuse to run while the local Neon link points to `production` or disagrees with `NEON_TARGET_BRANCH`. Do not bypass the guard by invoking Prisma or the seed script directly.

Validate the schema (no database connection or mutation):

```sh
npm run db:validate
```

Only after verifying the target is the Neon development branch, apply committed migrations and generate Prisma Client:

```sh
npm run db:deploy
npm run db:generate
npm run db:seed
```

The seed creates the two initial shop records idempotently. It creates no predictable staff account unless both `BOOTSTRAP_OWNER_EMAIL` and `BOOTSTRAP_OWNER_PASSWORD` are set in the private server environment. The bootstrap password must be at least 12 characters; the one-time seed grants the owner membership in both shops. Remove bootstrap values after use. A password reset and owner recovery process has not been selected.

Use `npm run db:migrate` to create/apply a migration on the verified Neon development branch. `npm run db:deploy` applies committed migrations to that same development branch; it is not a production deployment command. Both migration commands use the direct connection. `npm run db:seed` uses the pooled connection and is likewise restricted to the verified development target. No production migration/deployment workflow is configured here. Never use reset or destructive database commands.

## Run

Start the API and frontend in separate terminals:

```sh
npm run dev
npm run dev:client
```

The API defaults to `http://localhost:4000` and the Vite client to `http://localhost:5173`. Set `CLIENT_ORIGIN` to the exact browser origin. The session is PostgreSQL-backed and uses an HttpOnly, SameSite Strict cookie; Secure cookies and HTTPS-related headers are enabled for staging/production. Browser state-changing requests require the configured Origin and a session-bound CSRF token. `X-Shop-Id` is only a requested context: the API verifies the signed-in user's membership in PostgreSQL.

`GET /health/live` reports process liveness; `GET /health/ready` checks PostgreSQL connectivity. Set `TRUST_PROXY=true` only behind a trusted single reverse proxy. Use separate databases and unique secrets for development, staging, and production.

## Phase 1 behavior

- Users, shops, per-shop role memberships (OWNER, MANAGER, CASHIER), and append-style audit records are persisted through Prisma migrations.
- Login regenerates the session ID, applies rate limiting, hashes passwords with bcrypt, returns generic credential errors, and uses CSRF/origin checks. Signed-in users can change their password; the current password is verified, other sessions are revoked, and the change is audited.
- User listing, provisioning, membership assignment, and deactivation are owner-only API operations. Shop access is explicit and checked server-side; shop IDs and roles from the browser are never trusted as authorization claims.
- The starter workspace provides sign-in, assigned-shop visibility, and owner-only staff provisioning. It does not show a sales dashboard because the approved plan places reporting outside Phase 1.
- Audit events currently cover successful login/logout, password changes, and staff account create/update. Future sensitive operations must add audit writes as those modules are approved.

The manager permission matrix, manager shop assignments, password reset/recovery workflow, and exact official shop names/contact data remain subject to owner confirmation. The current Phase 1 role model stores explicit per-shop roles and grants no default shop access to managers or cashiers.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm run db:validate
```

Database-backed migration, seed, login/session, and shop-isolation integration checks require a separate PostgreSQL test database. The automated HTTP tests cover liveness, anonymous access rejection, origin/CSRF rejection, and pure role/shop-membership helpers without a database. Do not point tests at production data.

GitHub Actions runs the schema, typecheck, unit/API test, lint, and build gates on pushes and pull requests. The CI database URL is a placeholder for schema validation only; the workflow does not connect to a database or apply migrations.

Production hosting, TLS termination, automated backups, retention, restore testing, monitoring, and agreed RPO/RTO are infrastructure/handover work and are not provisioned here. Configure these in customer-owned infrastructure before launch.
