# Engineering OS — Project Knowledge Base

**Status:** June 2026 — Platform v1 released and frozen (`v1.0.0`); Platform v2 in active development. The runtime now exists: a real Next.js platform, a worker that executes agents, and a driver that schedules them. The autonomous-loop critical path (epics **MUS-204 / MUS-205 / MUS-206**) is now closed — see **Recently closed** below. Tracked in the Linear project **Engineering OS Platform v2**.

> **Note on this document.** Everything below the "Current Build State" section is the *vision and organizational design* — it is intentionally aspirational and predates the platform. For the actual, current state of the software, read **Current Build State (Platform v2)** immediately below. Where the two disagree, the Current Build State section wins.

---

# Current Build State (Platform v2)

This section reflects the real codebase, not the vision. Last verified by code trace June 2026.

## What exists and works

A working Next.js 16 app (App Router, Prisma 7 / SQLite, Clerk auth, ~36 domain models) with a full management UI — dashboard, work board, tasks, plans, outcomes, repositories, releases, quality/QA, company/employees, integrations, memory, timeline, inbox, notifications — a real execution worker (`npm run worker`) that polls execution sessions, checks out a repo, runs `claude -p`, commits/pushes the result and opens a PR, and a continuous driver (`npm run driver`) that schedules work without manual clicks. The test suite has ~1,200 cases across ~54 files (`npm run test`; `npm run test:count` prints the total).

The outcome→delivery loop, traced link by link:

| Link | State |
|---|---|
| CEO submits outcome → record + timeline | ✅ wired |
| Plan generation | ✅ wired, but **deterministic/templated, not AI** (by design — no AI before models are specified) |
| Plan review → approve/reject → apply to real Project/Feature/Task records | ✅ wired, idempotent, fully traceable |
| Prepare execution → brief + queued session | ✅ wired (manual button **and** auto-prepared by the driver — MUS-210) |
| Pre-push guardrail gate (protected paths/branch, denied/dangerous commands) | ✅ enforced, independent of agent permission mode (MUS-213) |
| Autonomy approval-checkpoint policy (single source for manual + driver) | ✅ wired (MUS-214) |
| Worker executes `claude -p` in a checked-out repo | ✅ **the one truly autonomous, real-AI step** |
| Worker commits + pushes the session branch + opens a PR | ✅ wired (MUS-207/208) |
| Result ingestion → task → `in-review`, with commit/PR metadata + timeline | ✅ wired (MUS-209) |
| Auto-advance review → QA → done by autonomy level | ✅ wired (MUS-212) |
| Continuous driver loop enqueues + advances per company | ✅ wired (MUS-211) |
| CEO execution audit trail (commands, files, guardrail blocks, outcome) | ✅ wired (MUS-215) |

## Recently closed (the critical path to a self-driving loop)

The three epics that previously blocked an unattended loop are now closed and unit-tested (wired end to end in code; a full live-repo dogfood run is the remaining manual validation):

1. **The GitHub loop now closes** — the worker commits the agent's working tree on the session branch, pushes to origin (never force, never a protected branch), opens/reuses a PR, and threads `commitSha`/`prUrl`/`prNumber`/`prStatus` through ingestion. → Epic **MUS-204** (MUS-207/208/209). ✅
2. **Autonomous driver exists** — `selectNextExecutableTaskForCompany()` now has a caller: `autoPrepareNextExecutionSession` (auto-create/prepare), `advanceTaskGates` (auto-advance review→QA), and a continuous `npm run driver` process that ticks per company respecting the concurrency limit. → Epic **MUS-205** (MUS-210/211/212). ✅
3. **Agent safety enforced end-to-end** — `repository-guardrails` + `worker-permissions` are applied as a hard pre-push gate, a single `autonomy-policy` defines per-level approval checkpoints (consulted by both the manual path and the driver), and the worker audit log is surfaced to the CEO. → Epic **MUS-206** (MUS-213/214/215). ✅

Still unbuilt (0% milestones): Engineering OS Specification v1.0, CEO Control Center, Onboarding (closure), Product Alerts, Repository Validation & Environment.

**Next: exercise the closed loop end-to-end against a live repo, then pick up the 0% milestones (CEO Control Center first).**

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

> **Updated:** This section described the pre-platform state. The runtime now exists (see Current Build State). The autonomous loop — agent work reaching GitHub (MUS-204), driving without manual clicks (MUS-205), and safety enforced before unattended runs (MUS-206) — is now **closed in code and unit-tested**. The biggest missing piece today is exercising that loop end-to-end against a live repository and building the remaining 0% product milestones (CEO Control Center, Onboarding closure, Product Alerts, Repository Validation & Environment).

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

★★★★★★★☆☆☆

Runtime Architecture:

★★★★★★★☆☆☆ — runtime, worker, and execution adapter exist

Platform Implementation:

★★★★★★★★☆☆ — v1 shipped; v2 autonomous loop (MUS-204/205/206) now closed in code and unit-tested

Production Product:

★★★★☆☆☆☆☆☆ — usable and dogfooded; the self-driving loop is wired and tested, pending a live-repo end-to-end run

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
