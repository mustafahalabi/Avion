# Deploying Avion — production topology (MUS-269, first slice)

How to run the five moving parts of Avion somewhere real:

| Part | What it is | Shape |
|---|---|---|
| `@avion/web` | Next.js 16 platform UI + server routes | HTTP service (`:3000`) |
| `@avion/api` | NestJS REST + Socket.IO board gateway | HTTP + **persistent WebSockets** (`:4000`) |
| worker | Executes sessions: checkout → `claude -p` → guardrails → push → PR | Long-running Node process — **not serverless** |
| driver | Scheduler: enqueues tasks, advances review/QA gates | Long-running Node process — **not serverless** |
| PostgreSQL | The one shared database | Hosted Postgres in production |

This document ships with the build artifacts for all of it: three Dockerfiles
(`apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/Dockerfile.worker`),
a shared root `.dockerignore`, `docker-compose.prod.yml`, and a GHCR image
pipeline (`.github/workflows/images.yml`). **No hosting accounts exist yet and
no money has been spent** — everything below the "Proposed topology" line is a
recommendation awaiting CEO sign-off.

---

## Proposed topology (RECOMMENDED DEFAULT — CEO signs off before money is spent)

> **Status: PROPOSAL.** Nothing is provisioned. Approving this section means
> creating two paid-ish accounts (a hosted-Postgres provider and a container
> host); both have free tiers that fit a first deployment.

1. **Hosted PostgreSQL — Neon** (alternatives: Supabase, RDS).
   One database (`avion`), TLS required, connection string becomes
   `DATABASE_URL`. Neon's free tier + branch-per-environment model fits the
   current single-tenant scale; nothing in the app is Neon-specific, so
   swapping to Supabase/RDS later is a connection-string change.
2. **One container host running all four processes — Fly.io**
   (alternatives: Railway, a plain VM with docker compose).
   - `avion-web` (1× shared CPU, 512MB–1GB) — public HTTP.
   - `avion-api` (1× shared CPU, 512MB) — public HTTP/WebSocket. Fly and
     Railway both speak persistent WebSockets natively; this rules out
     serverless platforms for the api.
   - `avion-worker` + `avion-driver` (one machine each from the same
     `avion-worker` image) — **no public ports**, a persistent volume mounted
     at `/data/worker`, and an authenticated `claude` CLI (see below). The
     worker wants the most memory/disk of the four (checkouts + dependency
     installs + an agent run happen inside it): start at 2GB RAM / 10GB disk.
   - Deploy is `docker compose`-shaped everywhere, so a $10 VM running
     `docker-compose.prod.yml` is a legitimate fallback if Fly/Railway prove
     awkward for the worker's volume + CLI-auth needs.
3. **Web on the same host by default.** Vercel is a fine alternative for
   `@avion/web` alone (it is a standard Next.js app), but it splits origins —
   see "Split-origin wiring" below for the exact CORS/env consequences. The
   worker and driver can never live on Vercel/serverless.

### Split-origin wiring (only if web goes to Vercel)

The `/board` page connects from the **browser** to `@avion/api`, so with web
on Vercel and api on Fly:

- Build/deploy web with `NEXT_PUBLIC_API_URL=https://api.<domain>` (this is
  **inlined at build time** — a rebuild, not a restart, changes it).
- Run api with `WEB_ORIGIN=https://<your-web-domain>` — a comma-separated
  allowlist that feeds both the REST CORS config (`apps/api/src/main.ts`) and
  the Socket.IO handshake CORS (`board.gateway.ts`).
- Both sides must share the same **Clerk instance**: the browser sends the
  Clerk session token to the api, whose `ClerkAuthGuard` verifies it with
  `CLERK_SECRET_KEY`. Same-instance keys on both deployments, or every board
  request 401s.
- Same-host single-origin deployments can leave `NEXT_PUBLIC_API_URL` pointing
  at the api's public URL and set `WEB_ORIGIN` to the web URL — the mechanics
  are identical, just with one host.

---

## Env / secret matrix

"Source" says where the production value comes from. Dev values are in
`.env.example` (web) and `docker-compose.yml` (local Postgres on `:5433`).

| Variable | Component(s) | Source | Dev | Prod |
|---|---|---|---|---|
| `DATABASE_URL` | web, api, worker, driver, migrate | Hosted-Postgres console | `postgresql://postgres:postgres@localhost:5433/avion` | Secret on every service; TLS string from Neon/Supabase/RDS |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web (**build-time**, inlined) | Clerk dashboard | keyless mode (auto `.clerk/`) | `pk_live_…` passed as `--build-arg` |
| `CLERK_SECRET_KEY` | web, api (shared Clerk instance) | Clerk dashboard | keyless mode | `sk_live_…` runtime secret on both |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` etc. | web (build-time) | static | `/sign-in`, `/sign-up`, `/dashboard`, `/onboarding` | build args (defaults baked into the Dockerfile) |
| `CREDENTIALS_ENCRYPTION_KEY` | web, worker, driver | generate once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | `.env` | Runtime secret — **the same value everywhere**, rotating it orphans every stored provider token |
| `NEXT_PUBLIC_API_URL` | web (**build-time**, inlined) | your api URL | `http://localhost:4000` | `https://api.<domain>` as `--build-arg` |
| `WEB_ORIGIN` | api | your web URL | `http://localhost:3000` | comma-separated allowlist of browser origins |
| `PORT` | web (3000), api (4000) | images set defaults | — | host's port config if it must differ |
| `BOARD_POLL_MS` | api | tuning knob | 2000 | optional |
| `EOS_PLANNING_PROVIDER` | web, driver | product decision | unset (deterministic) | `ai` to enable real-AI planning (per-company override exists in CompanySettings) |
| `OAUTH_REDIRECT_BASE_URL` | web | your web URL | `http://localhost:3000` | `https://<web-domain>` — must match provider app registrations byte-for-byte |
| `OAUTH_STATE_SECRET` | web | generate once (32-byte hex) | `.env` | runtime secret |
| `GITHUB_OAUTH_CLIENT_ID/SECRET` | web | GitHub OAuth app | optional | optional — manual-token fallback exists |
| `LINEAR_OAUTH_CLIENT_ID/SECRET` | web | Linear OAuth app | optional | optional |
| GitHub tokens (per company) | worker, driver, web | **not env** — stored AES-256-GCM-encrypted in the DB (`ProviderConnection`), decrypted with `CREDENTIALS_ENCRYPTION_KEY` | seeded/connected in UI | same |
| `WORKER_REPO_BASE_DIR` | worker | image default `/data/worker` | `/tmp/eos-worker` | persistent volume mount |
| `WORKER_SESSION_TIMEOUT_SECONDS` | worker | tuning knob | 1800 | sizes the liveness window too (see below) |
| `WORKER_MAX_RETRIES`, `WORKER_INSTALL_TIMEOUT_SECONDS`, `WORKER_POLL_INTERVAL_MS`, `WORKER_PERMISSION_MODE` | worker/driver | tuning knobs | defaults in `worker-config.ts` | optional |
| `DRIVER_TICK_INTERVAL_MS` | driver | tuning knob | 15000 | optional |
| `WORKER_HEARTBEAT_FILE` / `DRIVER_HEARTBEAT_FILE` | worker / driver | liveness (MUS-269) | default `<WORKER_REPO_BASE_DIR>/{worker,driver}.heartbeat` | compose sets the driver's explicitly |
| `HEARTBEAT_FILE`, `HEARTBEAT_MAX_AGE_SECONDS` | container HEALTHCHECK probe | image defaults | — | worker 3600s window, driver 300s |
| `claude` CLI auth | worker | Anthropic account | host login (`claude` login flow) | mounted config dir or API-key env — see below |

**Never bake a secret into an image.** The `.dockerignore` excludes `.env*`
and `.clerk/`; compose reads secrets from the shell/env-file at run time. The
only build-time values are `NEXT_PUBLIC_*`, which are public by definition.

---

## The worker's special needs

The worker is the one process that touches the outside world with write
access. It needs, beyond env vars:

1. **git** — installed in the image. No global identity needed: commits are
   authored via explicit `-c user.name="Avion Worker" -c user.email=…` flags
   (`src/worker/repo-manager.ts`), and pushes authenticate with the per-company
   GitHub token decrypted from the DB.
2. **An authenticated `claude` CLI.** The image installs
   `@anthropic-ai/claude-code` globally, but **authentication is a runtime
   concern** — credentials must never live in a layer. Two options:
   - Mount an authenticated config dir to `/home/node/.claude` (what
     `docker-compose.prod.yml` does via `CLAUDE_CONFIG_DIR`); log in once on
     the host with the same UID mapping.
   - Or inject the appropriate Anthropic API-key env for your plan into the
     worker service.
   Verify inside the container with `claude -p "say hi"` before trusting a
   deployment.
3. **Disk at `WORKER_REPO_BASE_DIR`** (`/data/worker` in the image) — a
   persistent volume sized for full checkouts + `node_modules` installs of the
   target repositories (10GB is a sane start). The heartbeat files live here
   too, so the volume doubles as the liveness surface.
4. **Outbound network** to GitHub (clone/push/PR) and Anthropic (agent runs).
   No inbound ports at all.

The driver shares the image and the volume but never runs `claude` or git
itself — it only talks to Postgres and the GitHub API (PR feedback ingestion).

---

## Health / liveness

| Process | Signal | Probe |
|---|---|---|
| api | `GET /api/health` → `{ status, db, uptimeSeconds }` — checks DB reachability with `SELECT 1` | HTTP healthcheck baked into `apps/api/Dockerfile` |
| web | any `< 500` response on `/` | HTTP healthcheck baked into `apps/web/Dockerfile` |
| worker | heartbeat file freshness | `node scripts/heartbeat-check.mjs` HEALTHCHECK |
| driver | heartbeat file freshness | same probe, tighter window |

The worker and driver listen on no ports, so their liveness signal is a
**heartbeat file** (MUS-269): each loop iteration writes an ISO timestamp to
`<WORKER_REPO_BASE_DIR>/{worker,driver}.heartbeat`
(`src/worker/heartbeat.ts`; override with `WORKER_HEARTBEAT_FILE` /
`DRIVER_HEARTBEAT_FILE`). A failed write warns once and never crashes the
loop. The Docker `HEALTHCHECK` (`apps/web/scripts/heartbeat-check.mjs`) exits
non-zero when the file is missing or stale.

**Choose the freshness window honestly:** the driver beats every tick
(default 15s → 300s window is generous). The worker beats once per *loop
iteration*, and one iteration legitimately spans an entire agent session —
up to `WORKER_SESSION_TIMEOUT_SECONDS` (default 1800s) plus dependency
install and validation time. Hence the image's default worker window of
**3600s**. If you raise the session timeout, raise
`HEARTBEAT_MAX_AGE_SECONDS` with it, or healthy long sessions will be
reported as dead (and a restart-on-unhealthy policy would kill mid-run
agents). A finer-grained mid-session heartbeat is possible follow-up work.

---

## Images and the promotion flow

`.github/workflows/images.yml` builds three images and pushes them to GHCR
**on every push to master** (tags: `latest` + `sha-<commit>`):

| Image | Dockerfile | Contents |
|---|---|---|
| `ghcr.io/<owner>/avion-web` | `apps/web/Dockerfile` | `next build` standalone output (`AVION_STANDALONE=1`), runs `node server.js` as non-root |
| `ghcr.io/<owner>/avion-api` | `apps/api/Dockerfile` | compiled NestJS `dist/` + production-only deps, non-root |
| `ghcr.io/<owner>/avion-worker` | `apps/web/Dockerfile.worker` | full `@avion/web` workspace install + tsx + git + prisma CLI + `claude` CLI; default CMD is the worker, the driver overrides CMD |

PRs that touch the container build inputs get a **build-only** smoke test (no
push). All builds run from the repo root context with the shared
`.dockerignore`; BuildKit layer cache is kept in GHA cache per image.

**Deployment stays manual for now.** The pipeline *publishes* images; nothing
auto-rolls them out. Promotion is:

1. Merge to master → CI (`ci.yml`) is green → `images.yml` pushes
   `sha-<commit>` + `latest`.
2. Apply migrations against the hosted Postgres (one-off container):
   `docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate`
   (the worker image carries the prisma CLI + the committed migrations).
3. Point the host at the new `sha-<commit>` tag (never deploy `latest`
   blind — the sha tag is the audit trail) and restart services:
   web → api → driver → worker, so the scheduler never feeds sessions to a
   half-upgraded worker.
4. Check health: `/api/health` says `db: "up"`, web serves, both heartbeat
   files are fresh.

Caveat repeated on purpose: the GHCR `avion-web` image is built with **empty
`NEXT_PUBLIC_*` args** — good for smoke tests, but a real environment needs a
rebuild with its own publishable key + api URL (or a decision to move those
reads server-side later).

---

## Local verification (no accounts needed)

```bash
# Build all three images
docker build -f apps/api/Dockerfile        -t avion-api    .
docker build -f apps/web/Dockerfile        -t avion-web    .
docker build -f apps/web/Dockerfile.worker -t avion-worker .

# Or the compose way (worker/driver/web/api against any reachable Postgres):
DATABASE_URL=postgresql://… CREDENTIALS_ENCRYPTION_KEY=… \
  docker compose -f docker-compose.prod.yml build
```

Do **not** run the full prod compose stack on a dev machine that already runs
a live worker/driver against the dev DB — two workers polling one database
will fight over sessions.

---

## Open questions for the CEO (blocking real deployment)

1. **Approve the default topology?** Neon (Postgres) + Fly.io (all four
   processes) is the recommendation; Railway or a plain VM are equivalent.
   Money is only spent after this sign-off.
2. **Web on the same host or Vercel?** Same-host is simpler (one origin, one
   provider); Vercel gives the usual Next.js edge/preview benefits at the cost
   of the split-origin wiring above.
3. **Which Clerk instance for production** (new production instance vs the
   current dev instance), and its `pk_live/sk_live` keys.
4. **How to authenticate `claude` on the worker host** — mounted config dir
   from an interactive login vs an API key, which is a plan/billing decision.
