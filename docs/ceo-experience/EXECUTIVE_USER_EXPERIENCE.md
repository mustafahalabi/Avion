# Executive User Experience — The CEO Experience

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

This document defines the **executive user experience** of Engineering OS: the lived experience of the single person who uses the product. That person is not a developer, a prompt engineer, or a project manager. That person is the **CEO** of a virtual software company. This document specifies what that role means, what the CEO owns, what the company owns, how the CEO communicates, where the CEO is asked to decide, how trust is configured, and how we measure whether the experience is working.

It is a product document, not an implementation specification. It does not prescribe screens, components, or routes — those trace to [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md). It does not redefine product scope or features — those live in [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md). This document owns one thing: the experiential contract between the user and the company, and the principle that **the user owns outcomes while the company owns execution.**

Where this document describes behavior, it distinguishes **Implemented today** (real, traceable software in the current build) from **Designed / planned** (specified product intent not yet built). It never claims capability that does not exist.

---

## Table of Contents

1. [Product Philosophy](#1-product-philosophy)
2. [The User's Role](#2-the-users-role)
3. [What the User Manages](#3-what-the-user-manages)
4. [What the Company Manages](#4-what-the-company-manages)
5. [Outcome-Based Communication](#5-outcome-based-communication)
6. [Approval Moments](#6-approval-moments)
7. [Decision Moments](#7-decision-moments)
8. [Trust Levels](#8-trust-levels)
9. [Experience Principles](#9-experience-principles)
10. [Success Criteria](#10-success-criteria)
11. [Implementation Status Summary](#11-implementation-status-summary)
12. [Related Documents](#12-related-documents)

---

## 1. Product Philosophy

Engineering OS is not an AI coding assistant. It is a **virtual software company**, and the user is its CEO. Every experiential decision in the product reinforces one fact: the user hired an engineering organization, and that organization performs the software development.

The philosophy rests on a single inversion. In conventional software work — and in every AI coding tool — the human is the integration layer. The human translates a goal into tasks, assigns the tasks, opens the editor, writes the code, reviews the result, runs the tests, deploys, and writes the docs. The tools accelerate individual steps, but the coordination remains the human's job.

Engineering OS removes the coordination. The CEO communicates an **outcome**. The company performs **execution** — planning, implementation, review, QA, release, and memory — and returns the outcome delivered. The CEO's attention is reserved for two things only: stating what matters, and deciding at the small number of points where a decision genuinely belongs to the person accountable for the business.

Three commitments follow from this philosophy and govern the entire experience:

- **The company, not the AI, is the product.** The user never sees a model name, a prompt, a token budget, or an agent framework. The trust the user builds is with the company and its process, not with a model. (Product principle 2 in [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md#7-product-principles).)
- **The user is always the CEO.** If the product asks the user to make an implementation decision — a branch name, a file path, a library choice — the product has failed. (Product principle 1.)
- **The runtime is invisible.** Execution engines are replaceable infrastructure. The CEO's company, its memory, and its history persist regardless of which engine runs underneath. (Product principle 8.)

This document treats those commitments as non-negotiable. The sections below define how they manifest in the day-to-day experience.

---

## 2. The User's Role

The user occupies exactly one role: **Chief Executive Officer of the company.** This is a structural role, not a cosmetic label. The company has a real organizational hierarchy ([`ORGANIZATION.md`](../organization/ORGANIZATION.md), [`REPORTING_STRUCTURE.md`](../organization/REPORTING_STRUCTURE.md)); the CEO sits at the top of it.

### 2.1 What the CEO is responsible for

The CEO is responsible for **direction and judgment**:

- Deciding **what** the company should build and in what order of importance.
- Approving the company's proposed plans before work begins.
- Approving high-consequence actions when the company's autonomy configuration requires it.
- Reviewing the company's understanding of the business and correcting it.
- Setting the company's operating posture — how much it should review, how fast it should move, how much it should act without asking.

### 2.2 What the CEO is never responsible for

The CEO is never responsible for execution mechanics. The CEO does not, and must never be asked to:

- Name branches or pull requests.
- Decompose work into tasks or assign engineers.
- Choose libraries, frameworks, or architectural patterns.
- Read diffs, resolve merge conflicts, or manage CI.
- Operate deployment commands or manage environments.

The information architecture enforces this: primary navigation never exposes git branches, pull request numbers, CI statuses, file paths, diffs, deployment commands, or environment names (see [`INFORMATION_ARCHITECTURE.md` §2](../architecture/INFORMATION_ARCHITECTURE.md#2-navigation-philosophy)). If any of those appear in front of the CEO, the experience is broken.

### 2.3 The four interaction modes

The CEO interacts with the company in exactly four ways. Every product surface either supports one of these or it does not belong in the product:

| Mode | What the CEO does | Where it lives today |
|---|---|---|
| **Outcome input** | States what the company should work on next | Inbox / Outcomes |
| **Approvals** | Approves, rejects, or requests changes to a proposal | Inbox, Dashboard |
| **Browse** | Reviews company state, work, history, and memory | Dashboard, Work, Memory, Timeline |
| **Configure** | Adjusts company settings (autonomy, repository) | Settings |

**Implemented today:** all four modes have working surfaces — outcome submission (`apps/web/src/app/actions/outcomes.ts`), approval actions (`apps/web/src/app/actions/approvals.ts`), browse views under `/dashboard`, `/work`, `/memory`, `/timeline`, and configuration under `/settings`.

---

## 3. What the User Manages

The CEO manages a small, deliberately bounded set of objects. Each is framed in business terms — outcomes, plans, decisions, posture — never in engineering terms.

### 3.1 Outcomes

An **outcome** is the CEO's statement of a desired result, in plain language: "I want users to be able to reset their password." The CEO creates outcomes; the company turns them into work. The CEO manages the **portfolio of outcomes** and their relative priority — not the tasks beneath them.

**Implemented today.** An outcome is a first-class record (`Outcome` model). The CEO submits a title, a free-text description, an optional target repository, and a priority (`low` / `medium` / `high` / `urgent`); the company records it as `proposed` and logs the submission to the company timeline (`recordOutcomeSubmittedEvent`). No engineering decision is requested at submission time.

### 3.2 Plans (at the approval level)

When the company proposes a plan for an outcome, the CEO manages it at the **approve / reject / request-changes** level. The CEO reads a plain-language summary — what will be delivered, why, and the shape of the work — and gives a verdict. The CEO does not edit the task breakdown; the CEO accepts or returns the plan.

**Implemented today.** Plans are generated **deterministically** and reviewed by the CEO; approval **applies** the plan idempotently into real Project / Feature / Task records with full traceability. Plan generation is intentionally templated, not AI — real-AI planning is deliberately gated behind the forthcoming Specification (see §11).

### 3.3 Decisions and approvals

The CEO manages the **decision queue** — the prioritized set of items the company has surfaced for the CEO's input. The CEO works this queue down; the company never advances a gated action until the CEO clears it. See §6 and §7.

### 3.4 Operating posture

The CEO manages the company's **autonomy level** and other company settings (such as the connected repository). Posture is the lever that determines how much the company does on its own versus how much it pauses to ask. See §8.

### 3.5 What the CEO browses but does not "manage"

The CEO can browse employees, work in progress, releases, company memory, and the timeline. These are **visibility**, not management surfaces — the CEO observes them to stay informed, not to operate them. Reassigning an engineer or reordering a task list is the company's job, not the CEO's.

---

## 4. What the Company Manages

The company manages **everything execution**. The CEO states the outcome; from there, the organization owns the work end to end. Internally, this is a staffed organization of specialists — a CTO, a Product Manager, a Tech Lead, Frontend and Backend Engineers, a Reviewer, a Security Engineer, a QA Engineer, a Release Manager, a Monitoring Engineer, and a Technical Writer (see [`EMPLOYEE_DIRECTORY.md`](../organization/EMPLOYEE_DIRECTORY.md)). The CEO does not direct these employees individually; the company routes work internally.

The company owns the full delivery chain:

| Phase | What the company owns | Owning role |
|---|---|---|
| Planning | Turning an outcome into a Feature Brief and a task breakdown | Product Manager, Tech Lead |
| Repository understanding | Analyzing the codebase: structure, frameworks, dependencies, patterns | CTO, Tech Lead |
| Implementation | Writing the code | Engineers |
| Review | Code review and security review | Reviewer, Security Engineer |
| QA | Validating against acceptance criteria | QA Engineer |
| Release | Assembling and shipping the release | Release Manager |
| Documentation | Writing and publishing docs | Technical Writer |
| Memory | Recording what was built, why, and what was learned | All roles |

These phases are governed by the company's Standard Operating Procedures — for example [`NEW_FEATURE.md`](../sops/NEW_FEATURE.md), [`CODE_REVIEW.md`](../sops/CODE_REVIEW.md), [`QA_VALIDATION.md`](../sops/QA_VALIDATION.md), and [`RELEASE.md`](../sops/RELEASE.md). The CEO does not read these SOPs to use the product; they are the company's internal operating standard.

**Implemented today.** The full chain is wired and has run end to end against a real GitHub repository:

- **Planning → work.** Deterministic plan generation; CEO approval applies the plan into real Project / Feature / Task records.
- **Repository intelligence.** Real file-tree ingestion, dependency / framework / route detection, and change-intelligence comparison between analyses (`repository-intelligence-service.ts`, `repository-change-intelligence.ts`).
- **Execution.** An execution worker checks out the repository, runs the agent, applies guardrails, commits, pushes the session branch, and opens a pull request — then ingests the result back to the task as `in-review` with commit/PR metadata.
- **Review & QA gates.** No task reaches `done` without a recorded approved review **and** passing QA (`review-service.ts`, `qa-service.ts`, `gate-advancement-service.ts`).
- **Release.** Release candidates are assembled from completed work with a CEO-facing summary.
- **Guardrails.** The company never pushes to a protected branch, never touches protected paths (`.env*`, lockfiles, `prisma/migrations/**`, `.github/workflows/**`, secrets), and never force-pushes; a blocked run fails the session and records the offending paths in the audit trail (`worker-permissions.ts`, `repository-guardrails.ts`).

The CEO sees none of this machinery. They see an outcome move from "proposed" to "delivered," with status framed in plain language at every step.

---

## 5. Outcome-Based Communication

The CEO communicates **outcomes, not instructions**. This is the product's defining interaction model, and it is what separates Engineering OS from every tool that requires the user to create a task, assign it, and specify how it should be done.

### 5.1 The shape of a request

A request is a desired result stated the way a CEO would state it to their team:

> "Add dark mode."
> "Let users reset their password."
> "Make checkout faster."

The CEO does not specify the implementation. They do not choose which employee handles the request — the company routes it internally. They do not pre-decompose the work. They state the result and let the organization figure out the rest.

### 5.2 The response: a plan, not a prompt-completion

The company responds with a **plan** the CEO can reason about as a business artifact: what will be delivered, roughly how much work it is, and what state it is in. The response is organizational ("Your team has planned this feature"), never conversational ("Here is what the AI generated"). The CEO can approve, request changes, or reject before any execution begins.

### 5.3 Outcome lifecycle the CEO observes

| Stage | What the CEO sees | Implemented today |
|---|---|---|
| Submitted | "Outcome proposed" + timeline entry | ✅ `Outcome` record, lifecycle event |
| Planned | A reviewable plan summary | ✅ deterministic plan, CEO review |
| Approved | Plan applied to real work records | ✅ idempotent apply with traceability |
| In progress | Work advancing, framed in plain language | ✅ task/session status, dashboard |
| Delivered | PR opened; task in review or done by posture | ✅ verified live end to end |

### 5.4 What outcome-based communication forbids

The interface never asks the CEO to communicate in engineering terms. Per [`PRODUCT_REQUIREMENTS.md` §14](../product/PRODUCT_REQUIREMENTS.md#14-explicit-non-goals), Engineering OS is **not** an AI chat interface and **not** a code editor. The CEO directs a company; they do not prompt a model and they do not write code. If a user opens Engineering OS to write a function, something has gone wrong.

**Designed / planned.** The richest form of outcome-based communication — fully natural-language goal input with conversational refinement, and **real-AI** plan generation — is specified but deliberately gated. Plan generation is templated/deterministic today by design; real-AI planning unlocks only after the canonical Specification defines the company, repository, and decision models (see §11).

---

## 6. Approval Moments

An **approval moment** is a point where the company pauses and waits for the CEO to say "yes, proceed" (or "no") before it takes a consequential action. Approval moments are how the CEO retains control without managing execution. They are deliberately rare, deliberately high-signal, and entirely governed by the company's autonomy posture.

### 6.1 The two kinds of approval

**Plan approval.** Before any execution begins, the CEO approves the company's plan for an outcome. This is the highest-leverage approval: it is where the CEO confirms the company understood the request correctly and is about to build the right thing. **Implemented today** via plan review → approve/reject → apply.

**Action checkpoints.** During execution, certain agentic actions are gated by the company's autonomy level. A gated action does not happen until the CEO clears a checkpoint.

### 6.2 The gated actions

The single source of truth for which actions require approval at which posture is the **autonomy policy** (`apps/web/src/lib/autonomy-policy.ts`). Both the manual path (the CEO clicking a button) and the autonomous driver consult the same policy, so authorization is identical regardless of how the action was initiated. The gated agentic actions are:

| Action | Meaning |
|---|---|
| `create_session` | Prepare/queue an execution session for a task |
| `run_agent` | Start the agent against the checked-out repository |
| `push` | Push the agent's branch to origin |
| `open_pr` | Open a pull request from the session branch |
| `auto_review` | Drive a code review to sign-off without a human |
| `auto_qa` | Pass the QA gate without a human |
| `auto_merge` | Merge the PR without human review |

Each action, at each autonomy level, resolves to one of three dispositions: **allow** (proceeds immediately), **requires approval** (a checkpoint must clear first), or **deny** (never permitted at this level). The full matrix is in §8.4.

### 6.3 How an approval moment is presented

When a sub-threshold action pauses, the company surfaces it to the CEO as a **"needs your approval"** item, with the context required to decide without digging: what is being approved, which task or session it belongs to, and a one-line summary. The CEO approves or rejects in place, and the company resumes the real workflow — approvals never bypass a gate.

**Implemented today.** Approval checkpoints are visible and actionable:

- Tasks paused at a review or QA gate are listed as the CEO's decision queue (`listPendingCheckpoints`, `apps/web/src/lib/approval-checkpoints.ts`).
- The CEO approves or rejects from the **Inbox**; approval resumes the flow through the real review/QA services (`approveReviewCheckpoint`, `rejectReviewCheckpoint`, `approveQaCheckpoint`), and a rejected review sends the task back to implementation.
- A `decision` notification fires, and pending counts appear on the **sidebar bell**, the **Inbox badge**, and a **dashboard "Pending approvals" card** (`countPendingCheckpoints`).

### 6.4 The approval contract

- An approval request always states what happens if the CEO approves **and** what happens if they reject.
- Routine task completions never generate a CEO approval; only genuinely consequential gates do.
- Approvals and rejections are permanently recorded against the work item.
- The company never advances a `requires_approval` action while its checkpoint is unresolved. This is enforced in code, not by convention (`evaluateAutonomyCheckpoint`).

---

## 7. Decision Moments

A **decision moment** is broader than an approval. An approval is a yes/no on a specific gated action. A decision moment is any point where the CEO's judgment is genuinely required — a fork the company cannot or should not resolve on its own. The product's job is to surface decision moments clearly, with enough context to decide quickly, and to surface **only** decision moments — never implementation minutiae dressed up as a decision.

### 7.1 The categories of decision

| Decision category | Example | How it reaches the CEO today |
|---|---|---|
| **Direction** | What to build next; how to prioritize competing outcomes | CEO-initiated via outcome input |
| **Plan acceptance** | Is this the right plan for the outcome? | Plan review → approve/reject |
| **Gated action** | May the company run, push, open a PR, or merge? | Approval checkpoints (§6) |
| **Quality verdict** | Is this work good enough to advance past review/QA? | Inbox review/QA checkpoints |
| **Unblock / clarify** | An agent paused needing context, or work is blocked | Next-action recommendation, Inbox |
| **Escalation** | A judgment exceeds an employee's authority | Designed (notification type) |

### 7.2 The company tells the CEO what to decide next

The CEO should never have to hunt for what needs their attention. The company computes a prioritized **next action** from live workspace state and presents it.

**Implemented today.** A deterministic recommendation engine (`apps/web/src/lib/next-action-recommendation.ts`) ranks the CEO's attention items by priority — urgent → high → medium → low — and surfaces one primary action plus up to three secondary actions. Its priority order is:

1. Pending plan approvals (urgent)
2. Failed or stalled executions, and sessions needing clarification (high)
3. Blocked tasks or requests (high)
4. Ready-to-run execution sessions (medium)
5. Active work being monitored (low)
6. Idle / new company — prompt to submit the next outcome (low)

Each recommendation carries a one-sentence reason grounded in actual workspace state, a confidence level, and a single call to action. The CEO reads the recommendation, acts, and the queue recomputes.

### 7.3 What is never a decision moment

The CEO is never asked to decide:

- Which file to edit or which function to change.
- What to name a branch, commit, or pull request.
- Which dependency version to pin.
- Whether CI should run, or how a pipeline is configured.

These are execution decisions. They belong to the company. The relevant decision frameworks the company uses internally — for example [`PRIORITIZATION_DECISION_FRAMEWORK.md`](../decision-frameworks/PRIORITIZATION_DECISION_FRAMEWORK.md), [`ARCHITECTURE_DECISION_FRAMEWORK.md`](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md), and [`SECURITY_DECISION_FRAMEWORK.md`](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md) — exist so employees make these decisions consistently **without** burdening the CEO.

---

## 8. Trust Levels

Trust between the CEO and the company is **configurable, not assumed.** A new CEO with a young company wants to see and approve more. An experienced CEO with a proven company wants to delegate. The autonomy level is the single dial that adapts the entire company's behavior to the CEO's current level of trust.

### 8.1 The five levels

The implemented autonomy ladder has five levels (`AutonomyLevel` in `apps/web/src/lib/worker-permissions.ts`). The company default is **`assist`**.

| Level | Posture |
|---|---|
| **Manual** | The company plans and recommends; a human performs each consequential step. Every agent action is gated; merges are never automated. |
| **Suggest** | The company may prepare work freely, but running, pushing, and opening a PR are gated; merges are never automated. |
| **Assist** *(default)* | The company executes with a confirmation gate before running; pushing and opening a PR proceed; merging, review sign-off, and QA sign-off stay gated. |
| **Delegate** | Supervised autonomy. Everything proceeds — including automated review and QA — except auto-merge, which is gated. |
| **Autonomous** | Fully automated within guardrails, including auto-merge. The CEO receives summaries rather than approvals. |

> **Note on naming.** [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md#f-06-autonomy-controls) describes a four-level ladder (Manual / Assist / Delegate / Autonomous) for the CEO-facing narrative. The implemented runtime adds **Suggest** between Manual and Assist as a distinct enforced tier. This document follows the implemented set, which is authoritative for behavior.

### 8.2 Trust adapts the whole company, not just merges

Autonomy is not only about whether a PR auto-merges. It cascades through several layers, each grounded in code:

- **Agentic-action gating** — which of `create_session`, `run_agent`, `push`, `open_pr`, `auto_review`, `auto_qa`, `auto_merge` proceed vs. require approval (`autonomy-policy.ts`).
- **Worker capability** — what the agent may write and run. Autonomy maps to a permission profile: `manual → read_only`, `suggest → suggest`, `assist → execute`, `delegate`/`autonomous → full`. Higher levels widen allowed file patterns, allowed commands, the per-session file ceiling, and the change-size threshold above which the agent must pause for approval (`getWorkerPermissions`, `worker-permissions.ts`).
- **Run mode** — how work is scheduled. Autonomy suggests a run-mode config: interactive and confirmation-gated at lower levels, supervised at `delegate`, and background with auto-start at `autonomous` (`getRunModeConfig`, `run-mode.ts`).

### 8.3 Guardrails are constant across all levels

Trust raises **what proceeds without asking**; it never lowers the safety floor. Regardless of autonomy level, the company always blocks writes to protected paths (`.env*`, key/cert files, `prisma/migrations/**`, `.git/**`, `node_modules/**`) and always blocks destructive or exfiltration commands (`rm -rf`, `curl`, `wget`, `ssh`, `sudo`, and similar). These block lists are evaluated after any allow list and always win (`DEFAULT_BLOCKED_FILE_PATTERNS`, `DEFAULT_BLOCKED_COMMANDS`). A blocked action fails the session with the offending path recorded — even at `autonomous`.

### 8.4 The autonomy action matrix (implemented)

This is the authoritative, code-grounded disposition of each gated action at each level (`AUTONOMY_POLICY_MATRIX`). `appr.` = requires CEO approval.

| Action | manual | suggest | assist | delegate | autonomous |
|---|---|---|---|---|---|
| `create_session` | appr. | allow | allow | allow | allow |
| `run_agent` | appr. | appr. | appr. | allow | allow |
| `push` | appr. | appr. | allow | allow | allow |
| `open_pr` | appr. | appr. | allow | allow | allow |
| `auto_review` | appr. | appr. | appr. | allow | allow |
| `auto_qa` | appr. | appr. | appr. | allow | allow |
| `auto_merge` | deny | deny | appr. | appr. | allow |

**Verified live.** With the *same code and the same guardrails*, the only difference is the level: at `assist` the loop opened a real PR and **paused for CEO review**; at `autonomous` it opened a real PR and **auto-advanced review → QA → `done`** with no human checkpoint.

### 8.5 Trust is meant to grow

The intended trajectory is that a CEO starts lower, watches the company perform, and raises autonomy as confidence accumulates. A declining rate of CEO approval interventions over a company's life is a **healthy** signal (see §10). The product should make raising trust easy and reversible: the CEO can lower autonomy at any time, and guardrails ensure even the top level is safe.

---

## 9. Experience Principles

These principles govern every executive-experience decision. They are derived from, and consistent with, the product principles in [`PRODUCT_REQUIREMENTS.md` §7](../product/PRODUCT_REQUIREMENTS.md#7-product-principles); this section makes them concrete for the CEO's lived experience. When principles conflict, earlier ones win.

**9.1 Protect the CEO's attention above all.** The scarcest resource in the product is the CEO's attention. Every notification, every approval, every surfaced decision must earn its place. A CEO who receives fifty notifications a day about file changes is no longer a CEO — they are a developer. The product filters ruthlessly and surfaces only what genuinely needs the CEO.

**9.2 Outcomes in, outcomes out.** The CEO speaks in outcomes and the company answers in outcomes. Status is always framed as accomplishment, decision-needed, or current state — never as a log of engineering steps.

**9.3 Never expose the machine.** Models, prompts, agents, branches, PRs, CI, file paths, and environments stay behind the curtain. The company is the product; the runtime is invisible and replaceable.

**9.4 Every decision arrives with its context.** When the company asks the CEO to decide, it brings the context to decide — what, why, and what happens either way — so the CEO never has to go digging.

**9.5 Control without micromanagement.** The CEO retains real control through plan approval, action checkpoints, and the autonomy dial — none of which require operating the work. Control is exercised at the level of intent and consequence, not mechanics.

**9.6 Quality gates are non-negotiable.** No work ships without passing the company's review and QA gates. The CEO can raise autonomy to skip *waiting on themselves*, but never to skip the *gates*. A task cannot reach `done` without a recorded approved review and passing QA — enforced in code.

**9.7 Alive, not theatrical.** The company communicates with appropriate professional confidence. It does not over-personify employees, add ceremony, or overclaim. The experience should feel like an active, capable team — not a performance.

**9.8 The company compounds.** Each outcome teaches the company something it retains. The experience should make the CEO feel that the company they use for six months is visibly better than the one they used on day one. Memory is the compounding asset, and the experience should make its value felt.

---

## 10. Success Criteria

The executive user experience succeeds when the CEO can run a software company by managing outcomes and decisions alone, and when the company reliably delivers production-quality software without the CEO touching execution. The criteria below operationalize that and align with the experience and quality metrics in [`PRODUCT_REQUIREMENTS.md` §15](../product/PRODUCT_REQUIREMENTS.md#15-success-metrics).

### 10.1 Experience criteria

| Criterion | Target signal | Why it matters |
|---|---|---|
| CEO actions per delivered outcome | Trending down over a company's life | Confirms the CEO experience is being protected, not eroded |
| Approval-intervention rate | Declining as trust grows | Indicates the autonomy ladder is working as designed |
| Time-to-first-delivered-outcome | Short, from setup to first shipped result | Validates that onboarding and first use deliver value fast |
| Implementation details surfaced to the CEO | Zero in primary surfaces | The CEO must never be asked an engineering question |

### 10.2 Trust criteria

| Criterion | Target signal |
|---|---|
| Autonomy raised over time | CEOs move up the ladder as confidence grows |
| Approvals are high-signal | Few approval requests, each genuinely consequential |
| No gate ever bypassed | A task reaches `done` only with approved review + passing QA |
| Guardrails never breached | No protected path or denied command ever executes, at any level |

### 10.3 Outcome-delivery criteria

| Criterion | Target signal |
|---|---|
| Outcome completion rate | A large majority of started outcomes ship |
| Deviation visibility | When work stalls, fails, or needs clarification, the CEO is told what to do next |
| Decision-queue freshness | The recommended next action always reflects real, current state |

### 10.4 The single sentence

The experience succeeds when the CEO can truthfully say: **"I run an engineering company. I tell it what I want, I make a few decisions, and it ships."** Everything in this document exists to make that sentence true.

---

## 11. Implementation Status Summary

A consolidated, honest view of what backs this experience **today** versus what is **designed and planned**. This separation is a hard project rule: the product never fabricates capability.

### 11.1 Implemented today

- **Outcome input** — `Outcome` records with priority and timeline events (`outcomes.ts`, `outcome-planning-lifecycle.ts`).
- **Deterministic planning** — reviewable plans, applied idempotently to real Project/Feature/Task records on CEO approval.
- **Approval moments** — plan approval, plus action checkpoints surfaced in the Inbox with approve/reject, `decision` notifications, sidebar bell, and dashboard pending-approvals card (`approval-checkpoints.ts`, `approvals.ts`).
- **Decision moments** — the next-action recommendation engine (`next-action-recommendation.ts`).
- **Trust levels** — the five-level autonomy ladder enforced through one policy (`autonomy-policy.ts`) shared by the manual path and the autonomous driver; cascading to worker permissions and run mode.
- **Constant guardrails** — protected-path and denied-command enforcement at every level (`worker-permissions.ts`, `repository-guardrails.ts`).
- **End-to-end delivery** — execution worker → commit/push → PR → result ingestion → review/QA gates → release, **verified live** on a real GitHub repo.

### 11.2 Designed / planned

- **Real-AI planning** — gated behind the canonical **Engineering OS Specification v1.0**; planning is deterministic by design until the company/repository/decision models are specified.
- **CEO Control Center** — a dedicated command center for decisions, alerts, attention items, and current company state (today these are distributed across Dashboard, Inbox, and the recommendation engine).
- **Onboarding & first-run** — a guided flow to create a company, connect providers, add a repository, and submit the first outcome.
- **Broader Product Alerts** — the approval-alert slice ships today; app-wide notices for other work states are a planned follow-up.
- **Conversational goal input** — fully natural-language outcome submission with refinement.

These planned items are tracked in the Engineering OS Platform v2 roadmap. This document specifies the **target experience**; it does not claim the planned portions are built.

---

## 12. Related Documents

- [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) — product scope, principles, personas, V1 features, and success metrics. Owns *what* the product is.
- [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) — how information is organized and navigated. Owns *where* things live; enforces that implementation details never reach the CEO.
- [`MVP_ROADMAP.md`](../product/MVP_ROADMAP.md) — what ships in V1 and what is deferred.
- [`ORGANIZATION.md`](../organization/ORGANIZATION.md), [`REPORTING_STRUCTURE.md`](../organization/REPORTING_STRUCTURE.md), [`EMPLOYEE_DIRECTORY.md`](../organization/EMPLOYEE_DIRECTORY.md), [`RESPONSIBILITY_MATRIX.md`](../organization/RESPONSIBILITY_MATRIX.md) — the company the CEO leads and who owns what.
- SOPs — [`NEW_FEATURE.md`](../sops/NEW_FEATURE.md), [`CODE_REVIEW.md`](../sops/CODE_REVIEW.md), [`QA_VALIDATION.md`](../sops/QA_VALIDATION.md), [`RELEASE.md`](../sops/RELEASE.md), [`BUG_FIX.md`](../sops/BUG_FIX.md), [`ROLLBACK.md`](../sops/ROLLBACK.md) — the execution standards the company runs so the CEO does not have to.
- Decision frameworks — [`PRIORITIZATION_DECISION_FRAMEWORK.md`](../decision-frameworks/PRIORITIZATION_DECISION_FRAMEWORK.md), [`ARCHITECTURE_DECISION_FRAMEWORK.md`](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md), [`SECURITY_DECISION_FRAMEWORK.md`](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md) — how employees decide so the CEO does not have to.
