# Avion — Next Steps (hand-off goal prompts)

Grounded in a **July 3–4 2026 session** that shipped two PRs (live agent-output streaming `#153`, chat-send freeze fix `#154`) and — more importantly — *operated the autonomous loop live end-to-end*. The loop works (plans auto-apply at `autonomous`, PRs open and auto-merge, tasks reach `done`), but running it exposed that the frontier is now **operational**: making autonomous execution *safe, capable, and legible* enough to run unattended.

> **STATUS — all five goals shipped (July 4 2026).**
> - **Goal 1 — Sandbox the worker:** `WORKER_SANDBOX=docker` runs every session surface (agent CLI + install/validation shells) in an ephemeral `docker run` container mounting only the checkout. Proven with real Docker: 5 container PIDs vs the host's hundreds — the agent can't touch host processes. `WORKER_PERMISSION_MODE` is now dev-only; un-sandboxed `full` auto-caps to `execute`. Seam: `lib/adapters/sandbox-runner.ts`, `worker-effective-permission.ts`, `worker/sandbox-command-spawn.ts`, `apps/web/Dockerfile.sandbox`.
> - **Goal 2 — Planning live feedback:** the planner emits `plan.progress` heartbeats that surface as a live "Avion is drafting your plan…" chat indicator that advances through phases and hands off to the plan-ready bubble. Additive; planning stays deferred (no send-freeze). Seam: `outcome-planning-lifecycle.ts`, `chat-activity.ts`, `chat/[id]/chat-thread.tsx`.
> - **Goal 3 — Cost + activity observability:** REAL usage captured from the CLI (`stream-json` executor + `json` planner) → a `UsageRecord` ledger → per-outcome spend meter in chat + a `/work/spend` "running now + spend" ops view + a configurable per-outcome spend ceiling that halts a runaway outcome. Seam: `adapters/agent-usage.ts`, `adapters/claude-stream-json.ts`, `agent-usage-service.ts`, `spend-ceiling.ts`, `execution-spend-guard.ts`.
> - **Goal 4 — Operational hardening:** a Postgres advisory-lock **single-instance guard** (auto-released on crash) refuses a second worker/driver (proven: 2nd worker exits), and `pnpm supervise` brings up exactly one of each with crash-restart + a heartbeat watchdog. Seam: `worker/single-instance-lock.ts`, `scripts/supervise.mjs`.
> - **Goal 5 — Product depth:** a `WORKER_CONCURRENCY` **worker pool** (each session its own sandbox + live feed), **mid-flight chat steering** (a CEO note on an applied plan opens a gate-safe steering change request that re-works the active task), and **semantic memory recall** (embedding provider seam, deterministic default, cosine ranking by the outcome's request). Seam: `worker/worker-pool.ts`, `mid-flight-steering.ts`, `memory/embedding-provider.ts`.
>
> pgvector remains unavailable in the local `postgres:16` image, so semantic recall computes cosine in-app behind the provider seam (pgvector is the future *scale* index, not a correctness gap). The original prompts below are kept for provenance.

Each section below is a **self-contained prompt** you can hand to an agent. Do them **in order** — Goal 1 is a hard prerequisite for the parallel-execution part of Goal 5. Baseline: `pnpm --filter @avion/web test` is green at **127 files / 1,921 cases**; keep it green and `tsc --noEmit` clean.

---

## Goal 1 — Sandbox the execution worker (HIGHEST PRIORITY)

**Why.** The worker runs the execution agent (`claude -p`) directly on the host. At autonomy `autonomous` the permission maps to `full` → `--permission-mode bypassPermissions`, which lets the agent run **arbitrary host shell commands**. In the July 3–4 session this **SIGTERM'd the local dev server twice** (the agent, told to "fix everything and revamp it", ran sweeping commands that killed local node processes). The git guardrails protect what gets *pushed* (protected paths/branches), **not** what the agent runs *during* a session. A stopgap `WORKER_PERMISSION_MODE=execute` cap (→ `acceptEdits`, Bash denied in headless) was added to `apps/web/.env` — but that also blocks the agent from running installs/tests/codegen, so it can't complete many real tasks. Today you must choose "powerful but crashes the host" or "safe but can't do much."

**Objective.** Run each execution session in an **isolated environment** (Docker container or ephemeral VM) so the agent cannot touch the host, and can therefore safely run at **full power inside the sandbox**. Then relax the `WORKER_PERMISSION_MODE` cap for isolated runs (keep it only as a dev safety net for unsandboxed local runs).

**Pointers.**
- `apps/web/src/worker/index.ts` — `processSession` (checkout → `adapter.run` → guardrails → commit/push/PR).
- `apps/web/src/lib/adapters/claude-code-adapter.ts` / `codex-adapter.ts` — where the agent is `spawn`ed.
- `apps/web/src/worker/worker-config.ts` — `WORKER_PERMISSION_MODE` (env `WORKER_PERMISSION_MODE`, maps to a `PermissionLevel`, then `PERMISSION_MODE_MAP` → claude `--permission-mode`).
- `apps/web/src/lib/worker-permissions.ts` — autonomy → permission mapping.
- `docs/DEPLOYMENT.md` + the MUS-269 Dockerfiles/heartbeats — the existing deployment slice to build on.

**Acceptance.**
- An execution session runs in a sandbox with no ability to affect host processes or files outside its checkout.
- At `autonomous` the agent runs at full power *inside* the sandbox; a task that genuinely needs Bash (e.g. install deps + run tests) completes without touching the host.
- The `WORKER_PERMISSION_MODE` host-safety cap is documented as *unsandboxed-dev-only*.
- 1,921 tests + `tsc` stay green; the pre-push guardrails and adapter contract are unchanged.

---

## Goal 2 — Live feedback for the planning phase

**Why.** Plan generation runs the AI planner (`claude -p`, ~1–2 min) in a deferred `after()` on the web server (PR #154). During that window the chat sits silently at "Intake · Product Manager" and the CEO cannot tell if it is stuck — this caused repeated "is it stuck?" confusion in the session. The *execution* phase now streams live output (SessionStream, PR #153); *planning* does not.

**Objective.** Extend the live-output stream to the planning phase: an "Avion is drafting your plan…" indicator/feed in the chat that shows planning is alive and advances until the draft lands, then hands off to the existing plan-generated activity.

**Pointers.**
- PR #153 primitives: `apps/web/src/lib/agent-stream/*` (`types`, `session-log-store`, `humanize`, the SSE route `app/api/work/sessions/[sessionId]/stream`, `use-session-stream`, `SessionStream.tsx`).
- `apps/web/src/app/actions/chat.ts` — `sendMessage` (the `after()` that generates the plan).
- `apps/web/src/lib/planning-draft-service.ts` → `resolvePlanningAdapter`; `apps/web/src/lib/llm/claude-cli-client.ts` (the planner CLI).
- The chat thread: `apps/web/src/app/(app)/chat/[id]/`.

**Acceptance.** Sending a chat shows a live "planning" state until the draft lands — no silent "Intake" limbo. Additive; must NOT reintroduce the send freeze (planning stays deferred). Tests + `tsc` green.

---

## Goal 3 — Cost + activity observability

**Why.** The session ran multiple concurrent `claude -p` processes (planners + agents) with **zero** visibility into cost/tokens or what was running, and stray duplicate workers/drivers accumulated invisibly. Retry budgets bound *correctness*, not *spend* — nothing stops a runaway outcome from burning money.

**Objective.** A per-outcome cost/token meter + a live "what's running right now" ops view (agents, planners, elapsed). Optionally a configurable per-outcome spend ceiling that halts a runaway outcome.

**Pointers.** `claude-cli-client.ts` / `claude-code-adapter.ts` (the claude invocations — capture usage), `ExecutionSession` model, `apps/web/src/lib/live-pipeline-data.ts`, Mission Control (`/work/live`).

**Acceptance.** A CEO can see spend per outcome and currently-running agents; a configurable ceiling stops a runaway outcome. Numbers grounded in real usage, not estimates.

---

## Goal 4 — Operational hardening (supervision + single-instance)

**Why.** Running worker/driver/dev as loose background processes led to a **stray-process pileup** (2 workers + 3 drivers alive at once in the session), silent SIGTERM crashes, and orphaned `running` sessions that confused the driver's `live X/3` accounting. The deployment slice (MUS-269 Dockerfiles/heartbeats) exists but is not wired for a supervised run.

**Objective.** Supervised, health-checked, **single-instance** processes (compose/supervisor or the deployment slice): clean startup/shutdown, crash detection + restart, and robust orphaned-session reaping.

**Pointers.** `docs/DEPLOYMENT.md`, MUS-269 Dockerfiles, `apps/web/src/worker/` (index, driver, the stale-session reaper, heartbeats), the driver's `live/prepared` accounting in `execution-driver-service.ts`.

**Acceptance.** One command brings up exactly one of each, health-checked; a crashed process is detected/restarted; orphaned `running` sessions are reliably reaped. Local dev stays easy.

---

## Goal 5 — Product depth: parallel execution, mid-flight steering, semantic memory

**Why.** (a) The worker is **single-threaded** — one session at a time; a real "engineering company" runs a team in parallel. (b) Chat is **observe + approve** — the CEO can't yet say "stop, do it differently" mid-flight and have it route into the running loop. (c) Memory recall is keyword-based; semantic recall (pgvector, `MUS-268`) is pending.

**Objective.** (a) Parallel execution — a worker pool running N concurrent sessions, each with the live feed from PR #153. (b) Mid-flight chat steering that routes a course-correction into an in-flight outcome (builds on the MUS-304 reply seam). (c) Semantic memory recall via pgvector (`MUS-268`).

**Pointers.** `apps/web/src/worker/index.ts` (single poll loop), `execution-driver-service.ts` (`live X/3` concurrency accounting), `apps/web/src/lib/chat-followup-service.ts` (reply/routing seam), `apps/web/src/lib/memory/`, Linear `MUS-268`.

**Acceptance.** Multiple agents run concurrently, each with its own live feed; a CEO can redirect an in-flight outcome from chat; memory recall is semantic.

> **Hard constraint:** do **Goal 1 (sandbox) first**. Running multiple full-permission agents in parallel *on the host* would be catastrophic.
