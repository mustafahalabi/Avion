# Engineering OS — Project Knowledge Base

**Status:** June 2026 — Platform v1 released and frozen (`v1.0.0`); **Platform v2** effectively feature-complete on its core. The autonomous outcome→PR loop is built, unit-tested, **and verified live**. Since then the product around it has shipped: the full documentation/spec backlog, the **CEO Control Center**, **Onboarding**, **Repository Validation**, **real-AI outcome planning** (grounded + validated, behind a provider seam), and **compounding organizational memory**. **18 of 19 milestones are at 100%** (the 19th, Compounding Memory & Learning Engine, just landed). Tracked in the Linear project **Engineering OS Platform v2** (`MUS` team). Tests: **~1,314 cases across ~68 files** (`npm run test`).

> **How to read this document.** It has two layers:
> 1. **Current Build State (Platform v2)** — the actual, current software, grounded in the codebase *and* the Linear project. This is authoritative; where it disagrees with anything below, it wins.
> 2. **The Vision & Philosophy** (everything from "What Engineering OS Is" onward) — the durable product vision and organizational design. It is intentionally aspirational and predates the platform; it is the north star, not a status report.

---

# Current Build State (Platform v2)

This section reflects the real codebase **and** the Linear project. Last verified by code trace + Linear read, June 2026.

## What Platform v2 is for

From the Linear project charter: Platform v2 should turn Engineering OS from a working company-management platform into a **self-improving virtual software company**. The key shift is from *manually managing development* to **dogfooding Engineering OS as the system that plans, tracks, and helps build itself.**

- **Product goal.** v2 is complete when Engineering OS can be used as the primary operating layer for its own development: a user acts as CEO, requests a software outcome, and Engineering OS produces company-level planning, repository understanding, recommended next actions, tasks, ownership, review flow, QA flow, and release visibility.
- **Operating principle.** From this project onward, **use Engineering OS to build Engineering OS wherever possible.**
- **Non-goals (hard rules).** Do not mutate the frozen v1 baseline except through `release/v1` critical fixes. Do not rebuild v1 features from scratch. Do not create fake repository intelligence or fake automation. **AI behavior was gated behind specification — that gate is now satisfied:** *Engineering OS Specification v1.0* shipped (`docs/architecture/ENGINEERING_OS_SPECIFICATION.md`), and real-AI planning is now live behind a provider seam (deterministic by default; `EOS_PLANNING_PROVIDER=ai`), always validated against the quality + grounding gates with a deterministic fallback. New AI must keep that pattern: validated, grounded in real data, reviewable, never bypassing the gates.

## What exists and works

A working **Next.js 16** app (App Router, **Prisma 7 / SQLite**, **Clerk** auth, ~37 domain models) with a full management UI — dashboard, work board, tasks, plans, outcomes, repositories, releases, quality/QA, company/employees, integrations, memory, timeline, inbox, notifications. Behind it:

- **Repository intelligence** — real file-tree ingestion, package-manager/dependency detection, framework/route/API detection, database/schema detection, a repository intelligence dashboard, and **change intelligence** (snapshot model + comparison + impact analysis between analyses).
- **Outcome → plan → work** — a CEO submits an outcome; a planner generates a reviewable plan (projects/milestones/features/tasks/risks/assignments/QA/release); approval **applies** it idempotently into real Project/Feature/Task records with full traceability. Planning runs through a **provider seam** (`src/lib/planning/planning-adapter.ts`): **deterministic templated generator by default**, and a **real-AI planner** (`EOS_PLANNING_PROVIDER=ai`) that grounds in repository intelligence + company memory, validates output against `validatePlanningDraftQuality` + a hallucination guard, and **falls back to deterministic** on any failure (so AI is never worse than the baseline). Verified live.
- **Compounding memory** — durable lessons are auto-captured from completed reviews/QA/releases (`src/lib/memory/`, idempotent by source), a learning engine promotes recurring findings to **standards**, and relevant memory is fed into the AI planner's prompt so plans improve as the company learns. The driver ingests + promotes each tick (best-effort).
- **Product surfaces** — the **CEO Control Center** (`/control-center`: unified attention queue over approvals + stuck-work + provider health), guided **Onboarding** (`/onboarding`), and **Repository Validation & Environment** (env/validation profiles + readiness gate on the repo page).
- **Company intelligence** — detects stuck work / waiting approvals and recommends the CEO's next action.
- **Review + QA automation** — review briefs, change requests, QA checklists from acceptance criteria, and acceptance gates with truthful status transitions (no task reaches `done` without a recorded approved review **and** passing QA).
- **Release automation** — release candidates from completed work + CEO release summaries.
- **Integration auth** — first-class provider connections (GitHub app, Linear OAuth, hosting provider) with scopes/refresh/disconnect and **encrypted** credential storage.
- **The runtime** — an **execution adapter** interface + a **Claude Code adapter**; an **execution worker** (`npm run worker`) that polls sessions, checks out a repo, runs `claude -p`, applies guardrails, commits/pushes and opens a PR; and a **continuous driver** (`npm run driver`) that enqueues and advances work per company with no manual clicks.
- **Tests** — ~1,314 cases across ~68 files (`npm run test`; `npm run test:count` prints the total). Real-SQLite integration suites for the DB-backed services; pure unit suites for the planner/memory/view-model helpers.

## The self-driving loop — verified live

The outcome→delivery loop, traced link by link. Every link is wired; the loop was run **end-to-end against a real GitHub sandbox** (a real `claude -p` agent opened real PRs):

| Link | State |
|---|---|
| CEO submits outcome → record + timeline | ✅ wired |
| Plan generation | ✅ wired; **deterministic by default, real AI planning available** (provider seam, `EOS_PLANNING_PROVIDER=ai`) — grounded in repo intelligence + company memory, validated, with deterministic fallback |
| Plan review → approve/reject → apply to real Project/Feature/Task records | ✅ wired, idempotent, fully traceable |
| Prepare execution → brief + queued session | ✅ manual button **and** auto-prepared by the driver (MUS-210) |
| Pre-push guardrail gate (protected paths/branch, denied/dangerous commands) | ✅ enforced, independent of the agent's `claude -p` permission mode (MUS-213) |
| Autonomy approval-checkpoint policy (one source for manual + driver) | ✅ wired (MUS-214) |
| Worker executes `claude -p` in a checked-out repo | ✅ **the one truly autonomous, real-AI step** |
| Worker commits + pushes the session branch + opens a PR | ✅ wired (MUS-207/208) |
| Result ingestion → task → `in-review`, with commit/PR metadata + timeline | ✅ wired (MUS-209) |
| Auto-advance review → QA → done by autonomy level | ✅ wired (MUS-212) |
| Continuous driver loop enqueues + advances per company | ✅ wired (MUS-211) |
| CEO execution audit trail (commands, files, guardrail blocks, outcome) | ✅ wired (MUS-215) |

**Verified live:** at `assist` autonomy the loop opened a real PR then **paused for CEO review** (`awaiting_review`); at `autonomous` it opened a real PR and **auto-advanced review → QA → `done`** with no human checkpoint. Same code, same guardrails — the only difference is the autonomy level. Guardrails are always on: never push to a protected branch, never touch protected paths (`.env*`, lockfiles, `prisma/migrations/**`, `.github/workflows/**`, secrets), never force-push; a blocked run fails the session with the offending paths recorded in the audit trail.

Dogfood it locally with no external accounts via `npm run dogfood:local` (real DB + a local git remote, agent step stubbed), or do the full real run via `scripts/DOGFOOD.md` (`npm run live:prepare` → `live:worker` → `live:status`).

## Recent additions (the product around the loop)

- **Documentation/spec backlog complete** — ~67 docs (company systems, decision frameworks, memory, SOPs, UX, design, README indexes) **+ the canonical `docs/architecture/ENGINEERING_OS_SPECIFICATION.md`**.
- **CEO Control Center** (`/control-center` — unified attention queue over approvals + stuck-work + provider health), guided **Onboarding** (`/onboarding`), **Repository Validation & Environment** (env/validation profiles + readiness gate on the repo page).
- **Real-AI outcome planning** — provider seam (`src/lib/planning/`), grounded prompt, zod-validated draft, hallucination guard, deterministic fallback; eval harness (`scripts/planning-eval.ts`); **verified live** (AI scored equal to deterministic on grounding checks).
- **Compounding memory** (`src/lib/memory/`) — auto-capture lessons from reviews/QA/releases, a learning engine that promotes recurring findings to **standards**, and memory fed into the AI planner; the driver ingests + promotes each tick (best-effort).
- **Approval alerts + dogfood/live-run tooling** — inbox approve/reject, `decision` notifications, sidebar/inbox/dashboard badges; `dogfood-local.ts`, `live-run-prepare.ts` / `live-run-status.ts`, `DOGFOOD.md`.

## Linear milestone map (19 milestones)

**18 of 19 milestones are at 100%.** The autonomous-loop epics (GitHub Workflow Foundation, Agent Execution Engine, Agent Safety and Permissions) closed earlier; since then every remaining roadmap milestone shipped.

**Shipped (100%)**
- Stabilization and Dogfooding; Outcome Planning Engine; Repository Intelligence V2 (+ Slice 2 / Change Intelligence); Company Intelligence; Review and QA Automation; Release Automation; Integration Authentication; Product UX and Visual Design.
- Agent Execution Engine (+ Autonomous Execution Driver); GitHub Workflow Foundation (+ Close the GitHub Execution Loop); Agent Safety and Permissions; Product Alerts (approval alerts).
- **Engineering OS Specification v1.0** (MUS-226–233) — the canonical spec doc **plus its first realization: real-AI outcome planning** (provider seam, grounded prompt, zod validation, hallucination guard, deterministic fallback, eval harness). Verified live.
- **CEO Control Center** (MUS-178/179/181/217/218); **Onboarding and Setup** (MUS-219–221); **Product UX** surfaces.
- **Repository Validation and Environment** — 3/4 shipped (MUS-222–224); `MUS-225` (real `process.env.*` ingestion + an additive `RepositoryAnalysisSnapshot.envInventory` column — the one item needing a migration) is the deliberate Backlog follow-up.
- **Compounding Memory & Learning Engine** (MUS-234–239) — auto-capture, retrieval, learning engine, planner integration, driver auto-ingest. *(Just landed.)*

**Remaining**
- `MUS-225` env-var ingestion (needs a Prisma migration; deferred to keep sessions schema-free).
- Strategic frontier (not yet ticketed): close the loop with reality (enforce validation gates, run real checks, ingest GitHub PR review comments + CI → change requests); Company Chat; additional execution-provider adapters (provider independence in practice); per-company `EOS_PLANNING_PROVIDER` toggle.

## How to run

```
npm run dev            # the Next.js app
npm run worker         # execution worker: claim sessions → claude -p → commit/push → PR
npm run driver         # scheduler: enqueue next task + advance review/QA gates per company
npm run test           # tsc --noEmit && vitest run
npm run test:count     # print total test files / suites / cases
npm run dogfood:local  # self-driving loop end-to-end, no external accounts (agent stubbed)
# real live run (needs a sandbox repo + token in .env.live): see scripts/DOGFOOD.md
```

## Where to go next

The autonomous loop, the product around it, real-AI planning, and compounding memory are all shipped and (for the loop + planning) verified live. The frontier is now **closing the loop with reality and deepening intelligence**:
- **Trust / close the loop** — enforce the Repository Validation gates as real pre-run checks (finish `MUS-225`), actually run the detected validation commands, and ingest GitHub PR review comments + CI results back into change requests so the company responds to real feedback.
- **Deepen memory** — feed memory into the *execution* agents (not just the planner), and add semantic retrieval (pgvector) once volume warrants it.
- **CEO experience** — Company Chat (conversational "talk to your company"), company health scores.
- **Breadth** — additional execution-provider adapters (Codex/others) to make provider independence real; per-company `EOS_PLANNING_PROVIDER`.
- Then turn AI planning on for the dogfood company and let it plan its own backlog.

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

> **Updated:** This section described the pre-platform state. The runtime now exists (see Current Build State). The autonomous loop — agent work reaching GitHub (MUS-204), driving without manual clicks (MUS-205), and safety enforced before unattended runs (MUS-206) — is **closed and verified live** (a real agent opened real PRs; sub-threshold autonomy pauses for CEO approval, full autonomy drives to `done`). The biggest missing piece today is no longer the engineering loop — it is the **product around it**: the canonical **Engineering OS Specification v1.0** (which gates real-AI planning), the **CEO Control Center**, **Onboarding**, **Product Alerts**, and **Repository Validation & Environment**.

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

★★★★★★★★★★ — 18 of 19 v2 milestones shipped; the autonomous loop is **verified live**, plus real-AI planning and compounding memory on top

Production Product:

★★★★★★★☆☆☆ — usable, dogfooded, proven to open real PRs, and now first-run-ready (Onboarding, CEO Control Center, the Specification, and real-AI planning all shipped); the frontier is closing the loop with real GitHub/CI feedback and production hardening

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
