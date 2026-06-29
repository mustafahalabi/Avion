# Engineering OS — Project Knowledge Base

**Status:** June 2026 — Platform v1 released and frozen (`v1.0.0`); **Platform v2** in active development. The runtime exists and self-drives: a real Next.js platform, a worker that executes agents, and a driver that schedules them. The autonomous-loop critical path (epics **MUS-204 / MUS-205 / MUS-206**) is built, unit-tested, **and verified live** against a real GitHub repo (a real agent opened real PRs end-to-end). Tracked in the Linear project **Engineering OS Platform v2** (`MUS` team, 18 milestones, ~78 issues).

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
- **Non-goals (hard rules).** Do not mutate the frozen v1 baseline except through `release/v1` critical fixes. Do not rebuild v1 features from scratch. **Do not add AI behavior before the company model, repository model, and decision model are specified.** Do not create fake repository intelligence or fake automation. (This is why plan generation is deterministic/templated today — real AI is deliberately gated behind specification.)

## What exists and works

A working **Next.js 16** app (App Router, **Prisma 7 / SQLite**, **Clerk** auth, ~37 domain models) with a full management UI — dashboard, work board, tasks, plans, outcomes, repositories, releases, quality/QA, company/employees, integrations, memory, timeline, inbox, notifications. Behind it:

- **Repository intelligence** — real file-tree ingestion, package-manager/dependency detection, framework/route/API detection, database/schema detection, a repository intelligence dashboard, and **change intelligence** (snapshot model + comparison + impact analysis between analyses).
- **Outcome → plan → work** — a CEO submits an outcome; a **deterministic** planner generates a reviewable plan (projects/milestones/features/tasks/risks/assignments/QA/release); approval **applies** it idempotently into real Project/Feature/Task records with full traceability.
- **Company intelligence** — detects stuck work / waiting approvals and recommends the CEO's next action.
- **Review + QA automation** — review briefs, change requests, QA checklists from acceptance criteria, and acceptance gates with truthful status transitions (no task reaches `done` without a recorded approved review **and** passing QA).
- **Release automation** — release candidates from completed work + CEO release summaries.
- **Integration auth** — first-class provider connections (GitHub app, Linear OAuth, hosting provider) with scopes/refresh/disconnect and **encrypted** credential storage.
- **The runtime** — an **execution adapter** interface + a **Claude Code adapter**; an **execution worker** (`npm run worker`) that polls sessions, checks out a repo, runs `claude -p`, applies guardrails, commits/pushes and opens a PR; and a **continuous driver** (`npm run driver`) that enqueues and advances work per company with no manual clicks.
- **Tests** — ~1,217 cases across ~55 files (`npm run test`; `npm run test:count` prints the total). Real-SQLite integration suites for the DB-backed services.

## The self-driving loop — verified live

The outcome→delivery loop, traced link by link. Every link is wired; the loop was run **end-to-end against a real GitHub sandbox** (a real `claude -p` agent opened real PRs):

| Link | State |
|---|---|
| CEO submits outcome → record + timeline | ✅ wired |
| Plan generation | ✅ wired, **deterministic/templated, not AI** (by design — no AI before models are specified) |
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

## Recent additions (beyond the critical path)

- **Approval checkpoints are now visible and actionable.** When a sub-threshold gate pauses, a `decision` notification fires, the **Inbox** shows a "Needs your approval" item with **Approve / Reject** that resumes the flow through the real services, and counts appear on the **sidebar bell + Inbox badge** and a **dashboard "Pending approvals" card**. (This begins to satisfy the *Product Alerts* milestone.)
- **Dogfood + live-run tooling** — `dogfood-local.ts`, `live-run-prepare.ts` / `live-run-status.ts`, and `DOGFOOD.md`.
- **Test hardening** — fixed transient parallel-load timeouts (generous vitest timeouts + `forks` pool) and grew the suite substantially; `npm run test:count`.

## Linear milestone map (18 milestones)

**14 of 18 milestones are at 100%.** The three critical-path epics (**MUS-204** Close the GitHub Execution Loop, **MUS-205** Autonomous Execution Driver, **MUS-206** Agent Safety and Permissions) are now closed with their child PRs attached, flipping their milestones (GitHub Workflow Foundation, Agent Execution Engine, Agent Safety and Permissions) to 100%.

**Shipped (100%)**
- Stabilization and Dogfooding (MUS-171)
- Outcome Planning Engine (MUS-138–145)
- Repository Intelligence V2 (MUS-159–164)
- Repository Intelligence V2 — Slice 2 / Change Intelligence (MUS-196–199)
- Company Intelligence (MUS-165–167)
- Review and QA Automation (MUS-154–158)
- Release Automation (MUS-168–170)
- Integration Authentication (MUS-172–177)
- Product UX and Visual Design (MUS-180–184, 190, 194, 200)
- Agent Execution Engine — foundation (MUS-146–150, 201–203) **+ Autonomous Execution Driver MUS-205 (210/211/212)**
- GitHub Workflow Foundation — incl. **Close the GitHub Execution Loop MUS-204 (207/208/209)**
- Agent Safety and Permissions — **MUS-206 (213/214/215)**
- Product Alerts — **first slice only**: MUS-216 (approval alerts: inbox approve/reject, `decision` notifications, sidebar bell + inbox badge, dashboard card). The milestone reads 100% on that one ticket, but broader app-wide notices for other work states are a natural follow-up.

**Not started (0%) — the roadmap**
- **Engineering OS Specification v1.0** — the canonical spec (company / employee / work / memory / runtime / repository models, permissions, events, state machines, invariants). *Gates real AI behavior.*
- **CEO Control Center** — the command center for decisions, alerts, approvals, attention items, and current company state.
- **Onboarding and Setup** — guided first-run: understand EOS, create a company, connect providers, add repositories, submit the first outcome.
- **Repository Validation and Environment** — validation profiles, env-var inventory, secret references, validation-command detection, real completion gates.

**Loose Backlog tickets (no milestone):** MUS-178 Build CEO home screen, MUS-179 Build activity panel, MUS-181 Design app navigation — feed the CEO Control Center.

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

The autonomous engineering loop is functionally complete and proven live. The frontier is now the **product around it**: write **Engineering OS Specification v1.0** (which unlocks real-AI planning), build the **CEO Control Center** + **Onboarding**, finish **Product Alerts**, and add **Repository Validation & Environment** so autonomous runs fail fast on bad environments rather than mid-flight. Closing the three open critical-path epics in Linear (204/205/206) is bookkeeping that should follow.

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

★★★★★★★★☆☆ — outcome→plan→execute→review→QA→release wired and automated; the formal Specification v1.0 (state machines/invariants) is still 0%

Runtime Architecture:

★★★★★★★★☆☆ — execution adapter, worker, driver, guardrail gate, and autonomy policy all exist and self-drive

Platform Implementation:

★★★★★★★★★☆ — 14 of 18 v2 milestones shipped; the autonomous loop (MUS-204/205/206) is closed and **verified live** on a real repo

Production Product:

★★★★★☆☆☆☆☆ — usable, dogfooded, and proven to open real PRs; still missing Onboarding, the Specification, and the CEO Control Center for a first-run-ready product

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
