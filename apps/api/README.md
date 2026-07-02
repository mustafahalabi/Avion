# @avion/api

NestJS realtime backend for the Avion board — REST under `/api` plus a Socket.IO
gateway (namespace `/board`) on port **4000** that polls the shared PostgreSQL
and pushes `BoardSnapshot`s to the web app's `/board` page. Every REST request
and Socket.IO handshake is authenticated against Clerk and company-scoped
(MUS-255).

```bash
pnpm --filter @avion/api dev    # prisma generate && nest start --watch (:4000)
pnpm --filter @avion/api test   # prisma generate && vitest run
```

Copy `.env.example` to `.env` for local configuration.

## Data access model (MUS-265)

This api **reads** the Avion database that `@avion/web` owns — it must never
write and it must never own migrations. Two mechanisms harden that contract:

### 1. Schema-drift check (`schema:check`)

`prisma/schema.prisma` here is a hand-maintained **read-only projection** of
the canonical `apps/web/prisma/schema.prisma` — only the models/fields the
board reads, with names copied verbatim so Prisma maps to the same tables and
columns. Nothing in Prisma enforces that sync, so a rename/retype in the
canonical schema would silently break the board at runtime.

```bash
pnpm --filter @avion/api schema:check
```

`scripts/check-schema-drift.ts` parses both `.prisma` files (tolerant,
dependency-free parser in `src/schema-drift/schema-drift.ts`) and enforces a
**subset rule**: every model, field, enum, and block attribute declared in the
api projection must exist in the canonical schema with an identical
type/optionality/column/table shape. Canonical-only extras (models, fields,
write-side attributes like `@default(cuid())`) are fine; api-only additions,
retypes, or re-mappings fail with exit code 1. CI runs this right after
`pnpm install` (see `.github/workflows/ci.yml`), and the vitest suite also
asserts the shipped schemas are in sync.

When the check fails: update `prisma/schema.prisma` here to mirror the
canonical schema (never the other way around), then re-run.

### 2. Read-only database role (`avion_api_ro`)

By default the api connects with the same admin `DATABASE_URL` as the web app,
so "read-only" is only convention. To make Postgres enforce it, provision the
SELECT-only role and point the api at it:

```bash
# Run as the SAME role that runs Prisma migrations (locally: postgres) —
# ALTER DEFAULT PRIVILEGES only covers tables that role creates later.
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/avion" \
  pnpm --filter @avion/api db:provision-readonly
```

`scripts/provision-readonly-role.ts` is idempotent (safe to re-run; re-running
also picks up newly created tables). It creates `avion_api_ro` with `LOGIN
NOSUPERUSER NOCREATEDB NOCREATEROLE`, grants `CONNECT` on the database,
`USAGE` on schema `public`, `SELECT` on all current tables, and default
`SELECT` on future tables. Set `AVION_API_RO_PASSWORD` to choose or rotate the
password; without it, a new role gets the local-dev default `avion_api_ro`
(an existing role's password is never changed unless the env var is set).

Then, in `apps/api/.env`:

```bash
API_DATABASE_URL="postgresql://avion_api_ro:<password>@localhost:5433/avion"
```

The Prisma client (see `src/prisma/database-url.ts`) prefers
`API_DATABASE_URL` and falls back to `DATABASE_URL`, logging a warning when it
runs on the shared admin URL.
