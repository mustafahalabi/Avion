# Engineering OS — Desktop App (Electron)

> **⚠️ STATUS (July 2026): production packaging is deferred/broken since the PostgreSQL migration (MUS-247).**
> The desktop build described below shipped a schema-only **SQLite** template database — but the platform
> now runs on **hosted PostgreSQL** and `better-sqlite3` has been removed. `apps/web/scripts/build-db-template.mjs`
> now **intentionally exits 1** rather than produce a broken template, and the better-sqlite3 Electron rebuild
> step is stale. Reworking the packaging for a Postgres `DATABASE_URL` (connection-string config, no offline
> file DB) is a deliberate follow-up that has not landed.
> **Dev mode still works:** `pnpm --filter @avion/web electron:dev`.
> Everything below documents the **pre-Postgres design** and is kept for that rework; its SQLite/`npm run`
> references are historical.

Engineering OS ships as a desktop application via Electron. The desktop build
runs the **entire Next.js application** (UI, Server Components, Server Actions,
API routes, the SQLite database, and optionally the autonomous worker/driver)
as a self-contained local app — no separate web server, no `vercel deploy`, no
terminal. Double-click and you're the CEO of your company.

This document explains the architecture, the dev workflow, how to build
installers, and the known caveats.

---

## Architecture

Electron has two process types: a **main** process (Node.js) and **renderer**
windows (Chromium). A full-stack Next.js 16 app can't run _inside_ a renderer —
it needs a Node server for Server Actions, Prisma, and Clerk. So the main
process **boots the Next.js server locally** and the window simply points at it.

```
┌─────────────────────────── Electron main process (Node) ───────────────────────────┐
│                                                                                      │
│  1. ensureUserDatabase()   →  copy shipped template.db → userData/engineering-os.db  │
│  2. startServer()          →  spawn standalone Next server on 127.0.0.1:<port>       │
│                               (ELECTRON_RUN_AS_NODE; prod) or attach to `next dev`    │
│  3. createMainWindow()     →  BrowserWindow.loadURL("http://127.0.0.1:<port>")       │
│  4. automation (optional)  →  spawn worker.js + driver.js child processes            │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                        │ HTTP (loopback only)
                                        ▼
                         ┌──────────── BrowserWindow (Chromium) ───────────┐
                         │   The Engineering OS web UI, unchanged           │
                         └──────────────────────────────────────────────────┘
```

### Why a standalone server (not `next export`)

The app depends on Server Actions, Prisma, Clerk middleware and API routes —
none of which survive a static export. `next build` with
`output: 'standalone'` (enabled only when `EOS_ELECTRON_BUILD=1`) emits a
minimal self-contained Node server (`.next/standalone/server.js` + traced
`node_modules`) that the main process launches. Normal `next build` / Vercel
deploys are unaffected.

### The database

The app's Prisma client uses the **better-sqlite3 driver adapter** — there is
**no Prisma query-engine binary**, only the native `better_sqlite3.node`. The
client opens the SQLite file directly and **does not run migrations**, so the
file must already contain the schema.

- At **build time** `scripts/build-db-template.mjs` runs `prisma db push`
  against a throwaway file to materialise the schema from `schema.prisma`
  (the migration history is squashed and can't be replayed onto a fresh DB),
  producing `build/template.db`.
- On **first launch** the app copies `template.db` into the OS-standard
  per-user data directory (`app.getPath('userData')/engineering-os.db`) and
  points Prisma at it via `ENGINEERING_OS_DATABASE_PATH`.

> **Schema upgrades across app versions are not yet automated.** An existing
> user database is left untouched on update. See _Future work_.

### Native module ABI (the important bit)

`better-sqlite3` is a native addon and must match the runtime's ABI. Electron's
Node ABI differs from system Node, so the binding is rebuilt for Electron — but
**only in an isolated copy** (`build/native/…`) that is then placed inside
`build/standalone/node_modules/better-sqlite3`. The project's own
`node_modules` is never touched, so `npm test`, `npm run dev`, and
`npm run worker` keep working on system Node. `electron-builder` is configured
with `npmRebuild: false`, and its `files` allowlist **excludes `node_modules`**
(the main process needs none of it), so packaging never rebuilds — and never
corrupts — the project's `better-sqlite3`.

> If you ever see `NODE_MODULE_VERSION` mismatch errors in `npm test` after
> building the desktop app, your project `better-sqlite3` got rebuilt for
> Electron. Restore it with `npm rebuild better-sqlite3`.

### Per-install secrets

`CREDENTIALS_ENCRYPTION_KEY` and `OAUTH_STATE_SECRET` are **generated and
persisted on first run** into `userData/eos.env` (mode 0600), so encrypted
integration credentials remain decryptable across launches. Users can edit
that file to supply their own keys, a `CLERK_SECRET_KEY`, OAuth client
secrets, etc.

---

## Development

```bash
npm install            # installs electron, electron-builder, esbuild, etc.
npm run electron:dev   # runs `next dev` + Electron together (Electron waits for :3000)
```

In dev the main process **does not** spawn a server — it attaches to the
`next dev` server on `127.0.0.1:3000`. Native modules stay on system Node, so
there's no ABI juggling. DevTools opens automatically.

The autonomous worker/driver are **off by default**. Toggle them from the
**Automation** menu, or set `EOS_RUN_AUTOMATION=1`. In dev they run from source
via `tsx`; they need the external `claude` CLI + a GitHub token to do real work.

---

## Building installers

```bash
npm run electron:build   # build/ : standalone server, worker.js, driver.js, template.db
npm run dist             # electron-builder → release/ (dmg/zip, nsis, AppImage)
npm run dist:dir         # unpacked app dir only (fast smoke test, no installer)
```

`electron:build` flags:

- `--skip-next` — reuse an existing `.next/standalone` (skip the long build).
- `--skip-native` — skip the Electron rebuild of better-sqlite3. The produced
  bundle will **not** load inside a packaged app; use only for CI smoke builds.

`next build` requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and the other build
env) to be present — keep a populated `.env`/`.env.local` as in normal dev.
The build runs `prisma generate` first (the client is gitignored), so a clean
checkout / CI runner works.

> **Build each platform on its own machine.** The native better-sqlite3 binding
> is rebuilt for the **host** OS + architecture only — there is no cross-compile.
> A macOS host produces a working macOS app; build the Windows installer on
> Windows and the Linux AppImage on Linux (e.g. one CI runner per OS). Don't
> emit `-mwl` or a non-host arch from a single machine, or the shipped
> `better_sqlite3.node` won't load and the app crashes when Prisma opens the DB.

### What ends up where

| Path (in packaged app)             | Source                    |
| ---------------------------------- | ------------------------- |
| `Resources/standalone/server.js`   | `build/standalone`        |
| `Resources/worker.js` / `driver.js`| esbuild bundles           |
| `Resources/template.db`            | `prisma db push` output   |
| `app.asar/electron/**`             | the Electron main process |

App icons: drop `icon.icns` / `icon.ico` / `icon.png` into `assets/` (see
`assets/README.md`).

---

## Configuration (env)

| Variable               | Effect                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `EOS_APP_PORT`         | Preferred prod localhost port (default `34567`).              |
| `EOS_DEV_PORT`         | Dev server port the shell attaches to (default `3000`).       |
| `EOS_RUN_AUTOMATION=1` | Auto-start the worker + driver on launch.                     |
| `EOS_ELECTRON_BUILD=1` | (build-only) enable Next standalone output.                   |
| `EOS_PRISMA_DB_URL`    | (build-only) datasource override for the template build.      |

Runtime overrides (Clerk secret key, OAuth secrets, DB path) can also be placed
in `userData/eos.env`. Note that `NEXT_PUBLIC_*` values (incl. the Clerk
publishable key and redirect URLs) are **inlined at build time** and cannot be
changed at runtime.

---

## Known caveats

- **Clerk + localhost (not 127.0.0.1).** The window is loaded on `localhost`
  (the server still *binds* `127.0.0.1`) because Clerk's development "dev
  browser" handshake is origin-sensitive and **hangs on a raw IP** — loading
  `127.0.0.1` leaves `<ClerkProvider>` stuck in a loading state and renders a
  blank/black screen. The desktop app authenticates against your Clerk instance
  over the network; dev keys (`pk_test_…`) work on any `localhost` origin.
  **Production** Clerk instances restrict origins — a desktop localhost origin
  needs that handling before shipping `pk_live_` keys.
- **The "server" runs on the user's machine.** Server-side secrets in the
  bundled `.env.production` ship with the app. Fine for dev/test instances and
  self-hosted use; a public distribution should move trust-sensitive operations
  behind a remote API.
- **OAuth callback URLs** are derived from the live origin
  (`http://127.0.0.1:<EOS_APP_PORT>/api/integrations/<provider>/callback`).
  Register that exact URL with GitHub/Linear and keep `EOS_APP_PORT` pinned.
- **The worker needs external tooling** (`claude` CLI, `git`, GitHub tokens);
  it idles harmlessly without them. It is off by default.
- **Linux AppImage + Chromium sandbox.** On hardened kernels (e.g. Ubuntu
  23.10+/24.04 with unprivileged user namespaces restricted) the AppImage can
  fail to launch with a chrome-sandbox error. Workarounds: run with
  `--no-sandbox`, install the SUID `chrome-sandbox` helper, or distribute a
  `.deb`/Flatpak instead. Verify launch on the target distro before shipping.

## Future work

- Automatic schema migration of the existing user DB on app update (ship the
  ordered migrations or run `db push`/a migration engine at launch).
- Code signing + notarization (macOS) and an auto-updater (`electron-updater`).
- Bundle app icons and a branded installer.
