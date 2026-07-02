# Avion — Engineering OS

A **pnpm + Turborepo monorepo**. The product (a virtual software company) is the
Next.js app; a separate NestJS service provides a REST API + realtime websocket
stream that powers the **Live Board**.

## Monorepo layout

```
avion/
├─ apps/
│  ├─ web/      → Next.js 16 app (UI, Server Actions, Prisma, Clerk, Electron, worker/driver)   @avion/web
│  └─ api/      → NestJS REST API + Socket.IO realtime gateway (shares the same Postgres)         @avion/api
├─ packages/
│  └─ shared/   → REST + WebSocket contracts (types + event names) used by both sides             @avion/shared
├─ turbo.json            → task pipeline (build / dev / lint / typecheck / test)
├─ pnpm-workspace.yaml
└─ docker-compose.yml    → local PostgreSQL on :5433
```

The frontend and backend are **fully separated** and communicate two ways:
the board fetches an initial snapshot over **REST** (`/api/board/snapshot`) and
then receives live updates over **Socket.IO** (namespace `/board`). The backend
reads the same PostgreSQL database as the web app via a small read-only Prisma
projection and polls it for changes.

## Setup

### 1. Install dependencies (from the repo root)

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env   # frontend (Clerk, DATABASE_URL, NEXT_PUBLIC_API_URL, …)
cp apps/api/.env.example apps/api/.env   # backend (same DATABASE_URL, PORT, WEB_ORIGIN)
```

Web (`apps/web/.env`) required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://postgres:postgres@localhost:5433/avion`) |
| `CREDENTIALS_ENCRYPTION_KEY` | 64-char hex for AES-256-GCM — `node -e "require('crypto').randomBytes(32).toString('hex')"` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk keys from [dashboard.clerk.com](https://dashboard.clerk.com) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `…SIGN_UP_URL` / `…AFTER_SIGN_IN_URL` / `…AFTER_SIGN_UP_URL` | Clerk routing paths |
| `NEXT_PUBLIC_API_URL` | Base URL of the realtime backend (e.g. `http://localhost:4000`) |

Backend (`apps/api/.env`): `DATABASE_URL` (**same value as web**), `PORT` (default `4000`),
`WEB_ORIGIN` (CORS origin, default `http://localhost:3000`), `BOARD_POLL_MS` (default `2000`).

Optional: `TEST_DATABASE_URL` — Postgres the integration tests run against (falls
back to `DATABASE_URL`). Each suite isolates into its own `?schema=…`; point it at
a **disposable** database.

### 3. Start PostgreSQL & apply migrations

```bash
pnpm db:up                                   # postgres:16 on localhost:5433
pnpm --filter @avion/web exec prisma migrate deploy
```

### 4. Run

```bash
pnpm dev          # turbo: runs @avion/web (:3000) + @avion/api (:4000) together
# or individually:
pnpm dev:web      # Next.js frontend only
pnpm dev:api      # NestJS backend only
```

Open [http://localhost:3000](http://localhost:3000), sign in, and go to **Live Board**
in the sidebar (`/board`).

## Common scripts (root)

| Command | What it does |
|---|---|
| `pnpm dev` | Run web + api together (Turborepo) |
| `pnpm build` | Build every package (`@avion/shared` first, topologically) |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm test` | Run the test suites |
| `pnpm worker` / `pnpm driver` | Autonomous execution worker / scheduler (in `@avion/web`) |
| `pnpm db:up` / `pnpm db:down` | Start / stop local PostgreSQL |

## Desktop app (Electron) — shelved

> ⛔ **Formally SHELVED (MUS-267 decision).** Electron production packaging is
> **parked, not scheduled** — the product ships as **web + hosted services**.
> The desktop build was written for the pre-Postgres **SQLite** era; the Postgres
> migration removed `better-sqlite3` and the bundled file DB, so the production
> packaging **fails fast by design**.

Production build (`dist` → `electron:build`) exits `1` on purpose:

```bash
pnpm --filter @avion/web dist            # ⛔ exits 1: "[electron:build] SHELVED (MUS-267)"
pnpm --filter @avion/web electron:build  # ⛔ same guard
```

To attempt it anyway, opt in with `EOS_ELECTRON_BUILD_UNSHELVE=1` — but packaging
has **not** been reworked for hosted Postgres, so it won't produce a working
installer without that rework.

`electron:dev` is a thin window over `next dev` (the DB comes from whatever
Postgres `DATABASE_URL` you started `next dev` with). It is **expected to run but
is unverified** against the current Postgres runtime (the `electron` binary may
need its one-time download first):

```bash
pnpm --filter @avion/web electron:dev    # next dev + a localhost:3000 shell
```

The supported path is the web app (`pnpm dev` / `pnpm dev:web`). See
[`docs/ELECTRON.md`](docs/ELECTRON.md) for the full status and how to un-shelve.
