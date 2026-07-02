# Avion (formerly Engineering OS) — Project Knowledge Base

**Status:** July 2026 — the product was **rebranded to Avion** (PR #76) and re-platformed into a **pnpm 11.9 / Turborepo monorepo** (PR #80). Platform v1 remains released and frozen (`v1.0.0`); **Platform v2**'s core — the autonomous outcome→PR loop — is built, tested, and **verified live end-to-end**. The full **loop-integrity** behavior (self-correcting rework re-loop, truthful real-check QA gates, no-op detection + bounded retries with CEO escalation, a gated task-status mutation boundary, and gated auto-merge) shipped in **PRs #84–#89 (MUS-250–259, MUS-225)** and was then **proven live in a real sandbox** (MUS-266): a failing QA opened a change request, the driver re-worked the fix onto the **same PR**, and at `autonomous` the PR **auto-merged (squash)** with the outcome reaching `completed`. A second batch (**PRs #90–#102, merged July 2**) added **monorepo CI + container-image workflows** (MUS-256), an **authenticated + company-scoped `apps/api`** with a schema-drift gate and read-only DB role (MUS-255, MUS-265), **company health scores** (MUS-263), a **second execution adapter (Codex)** (MUS-264), a **deployment slice** (Dockerfiles/heartbeats/image CI, MUS-269), **conversational chat follow-ups** (MUS-261), and a **per-company planning-provider override** (MUS-262). Tracked in the Linear project **Engineering OS Platform v2** (team **Mustafa's Space**, `MUS`). Tests: **1,647 cases across 99 files in `apps/web`** plus **32 cases in `apps/api`** (`pnpm --filter @avion/web test`, `pnpm --filter @avion/api test`).

> **How to read this document.** It has two layers:
> 1. **Current Build State (Platform v2)** — the actual, current software, grounded in the codebase *and* the Linear project. This is authoritative; where it disagrees with anything below, it wins.
> 2. **The Vision & Philosophy** (everything from "What Engineering OS Is" onward) — the durable product vision and organizational design. It is intentionally aspirational and predates the platform; it is the north star, not a status report. It retains the original **Engineering OS** name — Avion is the same product, rebranded.

---

# Current Build State (Platform v2)

This section reflects the real codebase **and** the Linear project. Last verified by code trace, July 2026.

## What Platform v2 is for

From the Linear project charter: Platform v2 should turn Avion from a working company-management platform into a **self-improving virtual software company**. The key shift is from *manually managing development* to **dogfooding Avion as the system that plans, tracks, and helps build itself.**

- **Product goal.** v2 is complete when Avion can be used as the primary operating layer for its own development: a user acts as CEO, requests a software outcome, and Avion produces company-level planning, repository understanding, recommended next actions, tasks, ownership, review flow, QA flow, and release visibility.
- **Operating principle.** From this project onward, **use Avion to build Avion wherever possible.**
- **Non-goals (hard rules).** Do not mutate the frozen v1 baseline except through `release/v1` critical fixes. Do not rebuild v1 features from scratch. Do not create fake repository intelligence or fake automation. AI behavior stays behind the specification's gates: real-AI planning is live behind a provider seam (deterministic by default; `EOS_PLANNING_PROVIDER=ai`), always validated against the quality + grounding gates with a deterministic fallback. New AI must keep that pattern: validated, grounded in real data, reviewable, never bypassing the gates.

## The monorepo

Root package `avion-monorepo` — **pnpm 11.9 workspaces + Turborepo** (never `npm install` here). Three packages:

| Package | Path | What it is |
|---|---|---|
| `@avion/web` | `apps/web` | The platform itself — **Next.js 16** (App Router, Prisma 7, Clerk auth, ~37 domain models). All prior `src/…` code now lives at `apps/web/src/…`; the schema at `apps/web/prisma/schema.prisma`. Also owns the worker, driver, scripts, and the Electron shell (`apps/web/electron`). |
| `@avion/api` | `apps/api` | **NestJS** realtime board backend — REST under `/api` + a **Socket.IO** gateway (namespace `/board`) on port **4000** that polls Postgres every 2s (`BOARD_POLL_MS`) and pushes `BoardSnapshot`s to the `/board` page. |
| `@avion/shared` | `packages/shared` | The contract layer — `BoardSnapshot` types + Socket.IO event names imported by both ends. Dependency-free. |

**Database: PostgreSQL** (MUS-247 — SQLite and `better-sqlite3` are gone). `apps/web/prisma/schema.prisma` has `provider = "postgresql"` via `@prisma/adapter-pg`; migrations were re-baselined at `20260630052132_init`. Local dev: `pnpm db:up` (docker compose, `postgres:16` on host port **5433**, database `avion`).

## What exists and works

A working management UI — dashboard, work board, tasks, plans, outcomes, repositories, releases, quality/QA, company/employees, integrations, memory, timeline, inbox, notifications. Behind it:

- **Repository intelligence** — real file-tree ingestion, package-manager/dependency detection, framework/route/API detection, database/schema detection, a repository intelligence dashboard, and **change intelligence** (snapshot model + comparison + impact analysis between analyses).
- **Outcome → plan → work** — a CEO submits an outcome; a planner generates a reviewable plan; approval **applies** it idempotently into real Project/Feature/Task records with full traceability. Planning runs through a **provider seam** (`apps/web/src/lib/planning/planning-adapter.ts`): **deterministic templated generator by default**, and a **real-AI planner** (`EOS_PLANNING_PROVIDER=ai`) that grounds in repository intelligence + company memory, validates output against `validatePlanningDraftQuality` + a hallucination guard, and **falls back to deterministic** on any failure. Verified live.
- **Compounding memory** — durable lessons auto-captured from completed reviews/QA/releases (`apps/web/src/lib/memory/`, idempotent by source), a learning engine that promotes recurring findings to **standards**, and memory fed into the **AI planner, the deterministic planner, and both the implementation and review execution briefs** (MUS-258). The driver ingests + promotes each tick (best-effort). *(Caveat: the `live:*`/`dogfood` scripts build briefs off a path that omits memory — MUS-273.)*
- **Product surfaces** — the **CEO Control Center** (`/control-center`), guided **Onboarding** (`/onboarding`), **Repository Validation & Environment** (env/validation profiles + readiness gate), and the newer **workspace-scoped UX**: nested routing under `/w/[workspace]/…` with an active-workspace cookie + sidebar switcher (MUS-248), a **live workflow graph** at `/work/live` (React Flow over SSE, MUS-249), and a **realtime `/board`** view fed by `apps/api` over Socket.IO.
- **Review + QA automation** — review briefs, change requests, QA checklists from acceptance criteria, and acceptance gates with truthful status transitions (no task reaches `done` without a recorded approved review **and** passing QA).
- **Release automation** — release candidates from completed work + CEO release summaries.
- **Integration auth** — first-class provider connections (GitHub, Linear OAuth, hosting provider) with scopes/refresh/disconnect and **encrypted** credential storage.
- **The runtime** — an **execution adapter** interface with a **Claude Code adapter** and a **Codex adapter** (agentType-selected per company via `CompanySettings.defaultAgentType`, MUS-264); an **execution worker** (`pnpm worker`) that polls sessions, checks out a repo, runs the agent CLI, applies guardrails, commits/pushes and opens a PR; and a **continuous driver** (`pnpm driver`) that enqueues and advances work per company with no manual clicks.
- **Closing the loop with reality** — a pre-run validation readiness gate (`assessExecutionReadiness`); real validation-command runs in the worker; and driver ingestion of GitHub PR review decisions + CI status each tick (`ingestPullRequestFeedbackForCompany`) — CI failure / changes-requested opens a change request, merged PRs are recorded.
- **Loop integrity (PRs #84–#89, merged — MUS-250–259; verified live MUS-266)** — see the loop table below: the rework re-loop, dependency install + real-check-driven QA verdicts, no-op/retry handling, the gated status mutation boundary, gated auto-merge, and outcome-lifecycle completion.
- **Tests** — **1,647 cases across 99 files in `apps/web`** (`pnpm --filter @avion/web test`; `test:count` prints the total) plus **32 cases across 5 files in `apps/api`** (`pnpm --filter @avion/api test`). Real-Postgres integration suites for the DB-backed services (each isolates into its own schema on `TEST_DATABASE_URL`/`DATABASE_URL`); pure unit suites for the planner/memory/view-model/loop helpers. `apps/api` gained its first tests (auth guard, board service, schema-drift, database-url) in MUS-255/MUS-265; `packages/shared` still has **no tests**. CI runs both suites against a Postgres service on every PR (MUS-256).

## The self-driving loop — verified live

The outcome→delivery loop, traced link by link. The loop was run **end-to-end against a real GitHub sandbox** (a real `claude -p` agent opened real PRs):

| Link | State |
|---|---|
| CEO submits outcome → record + timeline | ✅ wired |
| Plan generation (deterministic default; real AI via provider seam, validated, deterministic fallback) | ✅ wired |
| Plan review → approve/reject → apply to real Project/Feature/Task records | ✅ wired, idempotent, fully traceable |
| Prepare execution → brief + queued session (manual button **and** auto-prepared by the driver) | ✅ wired (MUS-210) |
| Pre-push guardrail gate (protected paths/branch, denied/dangerous commands) | ✅ enforced, independent of the agent's permission mode (MUS-213) |
| Autonomy approval-checkpoint policy (one source for manual + driver) | ✅ wired (MUS-214) |
| Worker executes `claude -p` in a checked-out repo | ✅ **the one truly autonomous, real-AI step** |
| Worker commits + pushes the session branch + opens a PR | ✅ wired (MUS-207/208) |
| Result ingestion → task → `in-review`, with commit/PR metadata + timeline | ✅ wired (MUS-209) |
| Auto-advance review → QA → done by autonomy level | ✅ wired (MUS-212) |
| Continuous driver loop enqueues + advances per company | ✅ wired (MUS-211) |
| CEO execution audit trail (commands, files, guardrail blocks, outcome) | ✅ wired (MUS-215) |
| Pre-run validation readiness gate (fail-fast on bad environments) | ✅ wired (MUS-240) |
| Ingest GitHub PR review + CI status → change requests / re-loop | ✅ wired; driver polls open PRs each tick (MUS-243/244/245) |
| **Rework re-loop** — change-requested / CI-failed tasks re-enter the driver as rework candidates; briefs gain a "Rework Required" section pinning the existing branch/PR; approvals + passing QA resolve ChangeRequests | ✅ shipped (PR #84) · verified live (MUS-266) |
| **Real validation in fresh checkouts** — the worker installs dependencies (lockfile-aware, permission-guarded) and runs the repo's real detected validation commands, embedding a machine-readable marker the QA gate parses | ✅ shipped (PR #84) · verified live (MUS-266) |
| **Truthful automated QA verdicts** — derived from the REAL recorded results: failing checks fail QA → change request → rework loop; an honest note when no evidence exists | ✅ shipped (PR #84) · verified live (MUS-266) |
| **No-op detection + bounded retries** — agent runs that succeed with no commit ingest as failed; `WORKER_MAX_RETRIES` with exponential backoff; exhausted tasks blocked + escalated | ✅ shipped (PR #84) · verified live (MUS-266) |
| **Gated mutation boundary** — `updateTaskStatus` routes `done` through the acceptance gates (approved review + passed QA) and validates status enums; `markReleased` requires a complete checklist | ✅ shipped (PR #84) · gated mutation boundary (MUS-253) |
| **Gated auto-merge** — at `autonomous`, a PR whose task passed the internal gates merges (squash) when CI is green-or-absent and no reviewer objects | ✅ shipped (PR #84) · **auto-merged PR #17 live** (MUS-266) |

**Verified live:** at `assist` autonomy the loop opened a real PR then **paused for CEO review** (`awaiting_review`); at `autonomous` it opened a real PR and **auto-advanced review → QA → `done`** with no human checkpoint. Same code, same guardrails — the only difference is the autonomy level. Guardrails are always on: never push to a protected branch, never touch protected paths (`.env*`, lockfiles, `prisma/migrations/**`, `.github/workflows/**`, secrets), never force-push; a blocked run fails the session with the offending paths recorded in the audit trail. **Verified again from a CEO request, fully hands-off:** with AI planning on and autonomy `autonomous`, a chat outcome (*"i want login screen"*) was AI-planned and the loop autonomously opened multiple real PRs and drove the tasks to `done` — no human steps after the single plan approval. **Loop-integrity proven live (MUS-266):** in the sandbox, a copy-change task shipped source-only, its test then failed → **truthful QA failure** (real `npm run build`/`npm run test` results, not a fabricated pass) → **change request** → the driver re-selected it as **rework** with a "Rework Required" brief on the **same branch/PR** → the fix landed on **PR #17** → QA passed on real results → the change request resolved → **auto-merge squashed PR #17** (`pr_merged` timeline, `mergeStatus=merged`) → the **outcome reached `completed`**. Separately, a no-op rework was ingested as failed and, after `WORKER_MAX_RETRIES` consecutive failures, the task was **blocked with an urgent CEO notification** (`execution_retries_exhausted`).

Dogfood it locally with no external accounts via `pnpm --filter @avion/web dogfood:local` (real Postgres schema + a local git remote, agent step stubbed), or do the full real run via `apps/web/scripts/DOGFOOD.md` (`live:prepare` → `live:worker` → `live:status`, all under `apps/web`).

## Honest caveats (read before grounding a plan in this doc)

*(The pre-#84 caveats — no api auth, memory only reaching the planner, the outcome lifecycle never completing, no CI, open `MUS-225` — are all **resolved**: MUS-255/265 authed + hardened `apps/api`, MUS-258 fed memory into the deterministic planner + execution/review briefs, MUS-259 completed the outcome lifecycle, MUS-256 stood up CI + image workflows, and MUS-225 ingests the env inventory. The live gaps below are current as of July 2.)*

- **The default deterministic plan template builds nothing** (MUS-274, P2, next up). Its generated tasks are all scaffolding — write-brief, map-touchpoints, define-contracts, design-workflow, review-checklist, QA-plan — with **no task that edits product code**, yet the outcome can still reach `completed`. Only the **AI** planner (`EOS_PLANNING_PROVIDER=ai`) emits a real "Implement:" task (that is what MUS-266 exercised). Grounding a deterministic-planned outcome in "it shipped" is false.
- **The AI→deterministic planner fallback is silent** (MUS-271): when AI planning fails its quality/grounding gates it falls back to the deterministic generator with **no provenance recorded**, so the CEO can't tell which planner produced a draft.
- **CEO edits to a plan-borne task's `description` never reach the brief** (MUS-277): the implementation brief renders only the plan item's **title + acceptanceCriteria** (from `PlanningDraft.generatedTasks`), not the `Task.description` column — so editing a task's description silently has no effect on what the agent is told. (Steer reworks via acceptanceCriteria; that is how MUS-266's rework was corrected.)
- **Validation profiles can run inapplicable commands** (MUS-272): a missing `test` script or absent Prisma reads as a change-caused failure rather than "not applicable", producing false QA failures.
- **The driver can't rework ad-hoc tasks** (MUS-270): task selection requires an approved/applied planning draft, so a task with no draft (e.g. a chat- or manually-created one) that gets a change request strands — its rework never re-enters the loop. (Live: sandbox PR #10's task sits `in-progress` with no draft.)
- **`live:*`/`dogfood` scripts bypass the production prepare path** (MUS-273): they build briefs without company memory, so a live run under-represents what the real driver injects.
- **Audit-trail + retry-budget bugs found in the MUS-266 run:** the adapter `filesChanged` parser can capture Implementation-Summary bullets as fake file paths (MUS-278); a rework that **commits** but fails QA resets the bounded-retry budget, so only *no-op* reworks are truly bounded (MUS-279); and a worker crash mid-run leaves an orphaned `running` session that permanently stalls the driver for that task (MUS-280).
- **Electron production packaging is deliberately deferred/broken** since the Postgres migration: `apps/web/scripts/build-db-template.mjs` intentionally exits 1 (the shipped SQLite template DB no longer applies; `better-sqlite3` was removed), and the native rebuild step is stale. **Dev mode works**: `pnpm --filter @avion/web electron:dev`. Fate to be decided in **MUS-267** (`docs/ELECTRON.md` describes the pre-Postgres design).
- **Two live views coexist**: `/board` (Socket.IO via `apps/api`) and `/work/live` (SSE served by the web app itself) overlap in purpose and have not been consolidated (MUS-260).

## Linear state

Project **Engineering OS Platform v2**, team **Mustafa's Space** (`MUS`). The original 20-milestone roadmap closed at 100%. Since then:

- **Done:** `MUS-247` (Postgres), `MUS-248` (nested workspace UX), `MUS-249` (live workflow graph), `MUS-250`–`MUS-259` + `MUS-225` (loop integrity + lifecycle + envInventory, PRs #84–#89), `MUS-255` (api auth + first api tests), `MUS-256` (CI), `MUS-257` (an earlier docs pass), `MUS-261` (chat follow-ups), `MUS-262` (per-company planner), `MUS-263` (health scores), `MUS-264` (Codex adapter), `MUS-265` (api schema-drift + read-only role), `MUS-269` (deployment slice), and **`MUS-266` (loop-integrity live dogfood — every checkbox proven)**. `MUS-7`/`MUS-9` were canceled as superseded.
- **Open (Backlog), by priority:** `MUS-274` (deterministic plan builds nothing, P2) → `MUS-271` (silent planner fallback), `MUS-277` (briefs ignore task description), `MUS-279`/`MUS-280` (retry-budget + orphaned-session bugs, P2), `MUS-270` (ad-hoc rework strands), `MUS-272` (inapplicable validation commands), `MUS-278` (filesChanged parser) → then `MUS-260` (consolidate live views), `MUS-267` (Electron fate), `MUS-268` (pgvector recall), `MUS-273` (live scripts bypass memory), `MUS-275` (TS6 chore), `MUS-276` (Codex provider connection/auth story).

## How to run

```
pnpm install                          # pnpm-only workspace — never npm/yarn
pnpm db:up                            # postgres:16 in docker on localhost:5433 (db "avion")
pnpm db:generate                      # prisma generate for @avion/web + @avion/api
pnpm --filter @avion/web exec prisma migrate deploy
pnpm dev                              # turbo: @avion/web (:3000) + @avion/api (:4000)
pnpm dev:web / pnpm dev:api           # one side only
pnpm worker                           # execution worker: claim sessions → claude -p → commit/push → PR
pnpm driver                           # scheduler: enqueue next task + advance review/QA gates
pnpm --filter @avion/web test         # tsc --noEmit && vitest run (99 files / 1,647 cases)
pnpm --filter @avion/api test          # NestJS suite (5 files / 32 cases)
pnpm --filter @avion/web test:count   # print total test files / suites / cases
pnpm --filter @avion/web dogfood:local  # self-driving loop end-to-end, agent stubbed
# real live run (sandbox repo + token in apps/web/.env.live): see apps/web/scripts/DOGFOOD.md
```

Environment gotchas:

- **`DATABASE_URL` must be exported** for the worker, driver, and integration tests — they don't auto-load `.env` (e.g. `DATABASE_URL="postgresql://postgres:postgres@localhost:5433/avion" pnpm worker`). The `live:*` scripts source `apps/web/.env` themselves.
- Postgres listens on **5433**, not 5432 (avoids clashing with a host Postgres).
- Without Clerk keys, the app runs in **Clerk keyless mode** (generated credentials land in a gitignored `.clerk/` directory) — fine for local dev.

## Where to go next

Tiers 1 and 2 (loop truthfulness + platform health) have largely shipped and are verified live (see the Status line and MUS-266). What remains:

- **Tier 1 — Make every "it shipped" true.** `MUS-274` (P2, next up): the **default deterministic planner emits no implementation task**, so a deterministic-planned outcome can reach `completed` without building the requested change — the single biggest gap between what the loop records and what is true. Then the audit-trail/retry-budget bugs from the MUS-266 run: `MUS-279` (committing reworks reset the retry budget), `MUS-280` (orphaned `running` sessions stall the driver), `MUS-278` (filesChanged parser). Plus planner honesty: `MUS-271` (silent AI→deterministic fallback provenance), `MUS-277` (CEO task-description edits never reach the brief), `MUS-272` (inapplicable validation commands), `MUS-270` (ad-hoc tasks can't rework).
- **Tier 2 — Consolidation & product direction (decisions first).** Consolidate `/board` vs `/work/live` (`MUS-260`); decide Electron's fate (`MUS-267`); `MUS-273` (live scripts bypass the memory-carrying prepare path); `MUS-275` (TypeScript 6 chore); `MUS-276` (Codex provider connection + worker-host CLI auth before any company flips to the codex agent).
- **Tier 3 — Mission frontier.** Semantic memory retrieval via pgvector (`MUS-268`); Company Chat depth; additional execution-provider adapters beyond Claude/Codex; and a richer per-company planning story on top of the `MUS-262` provider override.

---

# What Engineering OS Is

Engineering OS is **not an AI coding assistant**.

It is the world's first **Virtual Software Company**.

The fundamental shift is:

Instead of using AI as a tool...

the user hires an engineering organization.

The user becomes the CEO.

The company performs software development.

Everything in the product should reinforce this illusion without becoming roleplay.

The user should feel like they hired Stripe's engineering organization.

---

# Core Vision

Today's software development requires humans to coordinate:

Slack

↓

Linear

↓

GitHub

↓

Cursor

↓

Terminal

↓

CI

↓

Deployment

↓

Documentation

↓

Monitoring

↓

Repeat

Engineering OS removes orchestration.

The CEO communicates outcomes.

The company performs execution.

Example:

CEO:

> Build subscriptions.

Company:

* understands repository
* analyzes architecture
* creates roadmap
* breaks work into engineering tasks
* assigns employees
* implements
* reviews
* tests
* deploys
* updates documentation
* updates memory
* closes project

No manual coordination.

---

# Product Philosophy

This is **not**:

* ChatGPT for coding
* Cursor competitor
* GitHub Copilot
* AutoGPT
* AI Agent Framework

This is a programmable software company.

The runtime is invisible.

The organization is the product.

---

# Product Identity

Users should stop thinking about:

* prompts
* models
* MCP
* orchestration
* agents

Instead they should think:

"I have an engineering company."

---

# Organizational Philosophy

Engineering OS is modeled after a real software organization.

Everything exists because real engineering companies specialize.

Departments exist.

Employees exist.

Ownership exists.

Processes exist.

The implementation layer is hidden.

---

# Current Organizational Structure

Executive

* CEO (User)
* CTO

Product

* Product Manager
* Product Analyst
* Technical Writer

Engineering

* Tech Lead
* Frontend Engineer
* Backend Engineer
* Mobile Engineer
* AI Engineer
* Infrastructure Engineer

Quality

* Reviewer
* QA Engineer
* Security Engineer

Operations

* DevOps
* Release Manager
* Monitoring Engineer

Growth

* SEO Specialist
* Analytics
* Marketing

Long term additional departments:

* Support
* Finance
* HR
* Legal
* Sales
* Customer Success

---

# Organizational Principles

Everything follows several permanent rules.

* One owner.
* Clear accountability.
* Responsibility before authority.
* Specialization.
* Collaboration.
* Long-term thinking.
* Documentation is engineering.
* Security is engineering.
* Simplicity wins.
* Continuous improvement.

---

# Current Documentation Status

## Completed

Vision

Company Operating System

Company Playbook

Employee Template

Organization

Departments

Employee Directory

Reporting Structure

Responsibility Matrix

These define the company itself.

Not implementation.

---

# Missing Documentation

The biggest missing area is employee handbooks.

Every employee should have an operational handbook roughly 1,000–2,000 lines long.

Remaining handbooks include:

Executive

* CTO (started)
* COO
* Chief Designer

Product

* Product Manager
* Product Analyst
* Technical Writer

Engineering

* Tech Lead
* Frontend Engineer
* Backend Engineer
* Mobile Engineer
* AI Engineer
* Infrastructure Engineer

Quality

* Reviewer
* QA Engineer
* Security Engineer

Operations

* DevOps
* Release Manager
* Monitoring Engineer

Growth

* SEO Specialist
* Analytics
* Marketing

These become the true expertise of Engineering OS.

---

# Employee Philosophy

Employees are not prompts.

Employees own:

Identity

Mission

Responsibilities

Authority

Memory

KPIs

Learning

Communication

Decision Framework

Definition of Done

They should feel like long-term employees.

Not temporary AI sessions.

---

# Memory Architecture

Engineering OS has several memory layers.

Employee Memory

Every employee remembers things relevant to their role.

Example:

Frontend remembers

* accessibility
* animation preferences
* UI conventions

Backend remembers

* architecture
* APIs
* databases

---

Team Memory

Knowledge shared within departments.

---

Company Memory

Everything everyone knows.

Examples:

* coding standards
* architecture
* naming
* deployment
* business rules

---

Repository Memory

Repository-specific knowledge.

Folder structure.

Architecture.

History.

Dependencies.

Patterns.

---

Feature Memory

Every feature stores:

* purpose
* requester
* technical decisions
* limitations
* future work

---

Conversation Memory

Temporary working memory.

Expires automatically.

---

# Learning Engine

Employees improve permanently.

Inputs include:

* reviews
* production incidents
* retrospectives
* deployments
* QA findings
* user feedback

The organization should continuously improve.

---

# Company Culture

Culture changes employee behavior globally.

Examples:

Startup

Enterprise

Design First

Performance First

Security First

Future companies should customize culture.

---

# Trust Model

Five autonomy levels exist.

Manual

Suggest

Assist

Delegate

Autonomous

The entire company adapts based on autonomy.

---

# Company Health

Engineering OS measures organizational health.

Examples:

Architecture

Security

Velocity

Documentation

Technical Debt

Testing

Deployment Stability

Review Quality

Knowledge Coverage

Engineering Satisfaction

This is more important than repository metrics alone.

---

# CEO Experience

The CEO never manages implementation.

The CEO should never decide:

* branch names
* pull requests
* task hierarchy
* deployments
* engineering ownership

The CEO communicates goals.

The company owns execution.

---

# Current Product Scope (Platform v1)

The first version focuses on software engineering only.

Workflow:

CEO Request

↓

Repository Analysis

↓

Planning

↓

Task Breakdown

↓

Engineering

↓

Review

↓

QA

↓

Deployment

↓

Documentation

↓

Knowledge Update

↓

Completed

---

# Current Technical Direction

Technology is intentionally secondary.

The organization defines behavior.

Technology implements behavior.

Everything should be replaceable:

LLMs

MCP

Providers

Frameworks

Memory engines

Orchestration

The company remains constant.

---

# Current Implementation Strategy

Current development is based around:

Linear

↓

GitHub

↓

Claude Code

↓

Codex Review

↓

Engineering OS documentation

This validates organizational behavior before building the platform itself.

---

# Existing Agent Workflow

Current prototype:

CEO

↓

ChatGPT

↓

Linear

↓

Claude Code

↓

GitHub PR

↓

Codex Review

↓

Merge

↓

Documentation

↓

Done

This is considered a temporary implementation proving the operating model.

---

# Biggest Missing Piece

> **Updated:** This section described the pre-platform state. The runtime now exists (see Current Build State). The autonomous loop — agent work reaching GitHub (MUS-204), driving without manual clicks (MUS-205), and safety enforced before unattended runs (MUS-206) — is **closed and verified live** (a real agent opened real PRs; sub-threshold autonomy pauses for CEO approval, full autonomy drives to `done`). The product around the loop (the Specification, CEO Control Center, Onboarding, Product Alerts, Repository Validation) has since shipped as well. The biggest missing pieces today are **platform health** (an authenticated, company-scoped realtime API; CI) and the **mission frontier** (memory into the execution agents, outcome lifecycle completion) — see "Where to go next" in the Current Build State layer.

Original framing (kept for context):

The organization exists on paper.

The next milestone is translating the company into software.

Not by writing prompts.

By building infrastructure that allows employees to exist.

---

# Platform Architecture (Expected)

Major systems expected:

Company Runtime

Organization Engine

Workflow Engine

Employee Runtime

Memory Engine

Knowledge Graph

Decision Engine

Repository Intelligence

Planning Engine

Execution Engine

Review Engine

QA Engine

Deployment Engine

Notification System

Company Dashboard

CEO Interface

These should emerge naturally from the organizational documentation.

---

# Long-Term Vision

Eventually a founder should be able to say:

"Build me Airbnb for pets."

The company should:

Understand the business.

Write the PRD.

Research competitors.

Design architecture.

Break work into milestones.

Assign employees.

Build software.

Review.

QA.

Deploy.

Monitor.

Suggest improvements.

All while the founder simply manages the company.

---

# What Makes Engineering OS Different

Every existing AI coding product focuses on generating code.

Engineering OS focuses on generating an engineering organization.

That distinction changes everything.

The organization becomes the product.

Not the model.

Not the prompt.

Not the workflow.

---

# Current State Assessment

> **Updated June 2026** to reflect the shipped Platform v1 and in-progress v2. Ratings below supersede the earlier pre-platform scores.

Documentation Maturity:

★★★★★★★★★☆

Organization Design:

★★★★★★★★★☆

Vision Clarity:

★★★★★★★★★★

Employee Specifications:

★★☆☆☆☆☆☆☆☆

Workflow Definitions:

★★★★★★★★★☆ — outcome→plan→execute→review→QA→release wired and automated; **Specification v1.0 shipped** and real-AI planning is live behind a provider seam (validated, grounded, deterministic fallback)

Runtime Architecture:

★★★★★★★★☆☆ — execution adapter, worker, driver, guardrail gate, and autonomy policy all exist and self-drive

Platform Implementation:

★★★★★★★★★★ — the v2 core roadmap shipped (see the Current Build State layer for the live milestone map); the autonomous loop is **verified live**, plus real-AI planning and compounding memory on top

Production Product:

★★★★★★★☆☆☆ — usable, dogfooded, proven to open real PRs, and now first-run-ready (Onboarding, CEO Control Center, the Specification, and real-AI planning all shipped); the frontier is platform health (API auth, CI) and production hardening — see "Where to go next" in the Current Build State layer

---

# Recommended Next Milestones

## Phase 1 — Complete Organizational Documentation

* Finish every employee handbook.
* Add SOPs.
* Add decision frameworks.
* Add KPI system.
* Add engineering standards.

---

## Phase 2 — Company Runtime

Build:

* Organization Engine
* Employee Runtime
* Workflow Engine
* Memory Engine

---

## Phase 3 — Repository Intelligence

Teach employees how to understand repositories.

---

## Phase 4 — CEO Experience

Build the actual product interface.

The user should never think about agents.

Only employees.

---

## Phase 5 — Autonomous Company

Complete end-to-end software development.

Planning.

Implementation.

Review.

QA.

Deployment.

Monitoring.

Continuous learning.

---

# Ultimate Goal

Engineering OS should become to software engineering what an ERP is to business operations.

Not another AI tool.

A complete programmable software company.

When users think:

"I need software."

The answer should be:

"I'll hire my Engineering OS company."

Not:

"I'll open ChatGPT."

That is the product.
