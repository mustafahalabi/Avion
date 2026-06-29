# Entity Lifecycle State Machines — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-29  

This document defines the lifecycle of every important object in Engineering OS: its states, the transitions between them, who owns each transition, which states are terminal, and which transitions are forbidden. It is the reference that planning, execution, review, QA, and release behavior must align to before implementation.

A state machine here describes **product behavior** — the organizational meaning of each state and the rules that move an object between states. It deliberately separates that behavior from **implementation mechanics** (the literal status strings stored in the database, the services that perform the writes). Each section ends with an *Implementation note* that records the mechanics as they exist in the codebase today, so the two layers never drift silently.

This document does not redefine the objects themselves — [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) owns that. It does not redefine how the runtime advances work — [COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md) owns that. This document owns the **per-entity lifecycle contract** those two depend on.

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Implemented vs Designed](#2-implemented-vs-designed)
3. [Task](#3-task)
4. [Execution Session](#4-execution-session)
5. [Project](#5-project)
6. [Feature](#6-feature)
7. [Outcome and Planning Draft](#7-outcome-and-planning-draft)
8. [Review](#8-review)
9. [QA Result](#9-qa-result)
10. [Approval Checkpoint](#10-approval-checkpoint)
11. [Decision](#11-decision)
12. [Release](#12-release)
13. [Incident](#13-incident)
14. [Memory](#14-memory)
15. [Employee Work Status](#15-employee-work-status)
16. [Repository Onboarding](#16-repository-onboarding)
17. [Cross-Entity Gate Map](#17-cross-entity-gate-map)
18. [Relationship to Other Documents](#18-relationship-to-other-documents)

---

## 1. Conventions

**State.** A named condition an object occupies for a meaningful period. Every object is always in exactly one state.

**Transition.** A directed move from one state to another, caused by a trigger (an event, a gate passing, or an explicit human decision) and performed by a named owner.

**Owner.** The role or system component authorized to perform the transition. Owners follow the [Reporting Structure](../organization/REPORTING_STRUCTURE.md) and the [SOPs](../sops/). A human-only transition is marked **CEO**; a system transition is marked **Runtime**.

**Terminal state.** A state from which no further transitions are permitted. Terminal states are never deleted — history is retained (see [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) invariants).

**Failure state.** A non-terminal state that records that something went wrong and routes the object into a recovery path. Failure is not the same as terminal: most failure states are recoverable.

**Invalid transition.** A move that the state machine forbids. Invalid transitions are rejected, not silently coerced. Each section lists the ones that matter.

**Guard.** A precondition that must hold for an otherwise-valid transition to fire. A guard that fails leaves the object in its current state.

Notation in transition tables:

| Symbol | Meaning |
|---|---|
| `→` | a permitted transition |
| `(create)` | object instantiation into its initial state |
| `*` | "any non-terminal state" |
| **bold state** | terminal state |

---

## 2. Implemented vs Designed

Engineering OS is built under a hard rule: **no fabricated capability**. Several lifecycles below are fully implemented in code; others are specified here as the design contract but are not yet enforced by a service or even backed by a table. Every section is explicit about which is which.

| Entity | Status field today | Lifecycle enforcement today |
|---|---|---|
| Task | `Task.status` | Driven by execution, review, and QA services |
| Execution Session | `ExecutionSession.status` | Full transition guards in `execution-session-service.ts` |
| Review | `Review.status` / `Review.verdict` | `review-service.ts` |
| QA Result | `QAResult.status` | `qa-service.ts` |
| Approval Checkpoint | pending `Review` / `QAResult`; in-memory checkpoint | `autonomy-policy.ts`, `approval-checkpoints.ts` |
| Outcome | `Outcome.status` | Partial — subset of the canonical enum is exercised |
| Planning Draft | `PlanningDraft.status` | `planning-draft-service.ts`, `plan-application-service.ts` |
| Project | `Project.status` | Created by plan application; later transitions designed |
| Feature | `Feature.status` | Created by plan application; later transitions designed |
| Release | `Release.status` / `Release.deploymentStatus` | Partial — `draft` → `ready` only |
| Repository onboarding | `Repository.analysisStatus` | `repository-snapshot-service.ts` |
| Employee work status | `Employee.status` | Field exists; transitions designed |
| Incident | `Incident.status` | Schema only — no transition service yet |
| Memory | (no status field) | Append-only today; lifecycle designed |
| Decision | (no table) | Designed only — recorded as memory / timeline content today |

---

## 3. Task

**What it is.** The atomic unit of engineering work — one deliverable, one assignee. See [DOMAIN_MODEL.md › Task](./DOMAIN_MODEL.md#task).

**States**

| State | Meaning | Terminal? |
|---|---|---|
| `todo` | Created and assigned; not yet started or returned for rework. | no |
| `in-progress` | Active implementation, or rework after a returned review/QA. | no |
| `in-review` | An agent completed an implementation attempt; the task is at the review/QA gates. | no |
| `blocked` | Cannot proceed; a Blocking review finding or a QA block is recorded. | no (failure) |
| `done` | Review approved **and** QA passed; the task is complete. | **yes** |
| `cancelled` | Explicitly cancelled before completion; history retained. | **yes** |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `todo` | Plan application creates the task from an approved Planning Draft. | Runtime (Tech Lead intent) |
| `todo` → `in-review` | An execution session completes for the task. | Runtime |
| `todo` → `in-progress` | Session returns the task for rework (failed / needs-clarification path). | Runtime |
| `in-progress` → `in-review` | A subsequent execution session completes. | Runtime |
| `in-review` → `in-review` | Review approved — task holds at the gate for QA. | Reviewer |
| `in-review` → `in-progress` | Review requests changes, or QA fails — work returns to the engineer. | Reviewer / QA Engineer |
| `in-review` → `blocked` | A Review or QA verdict of `blocked` is recorded. | Reviewer / QA Engineer |
| `in-review` → `done` | QA passes (review already approved). | QA Engineer |
| `blocked` → `in-progress` | Blocker resolved; rework resumes. | Tech Lead |
| `*` → `cancelled` | CEO/Tech Lead cancels the task. | CEO / Tech Lead |

**Invalid transitions**

- `todo` → `done` — a task may never reach `done` without passing through review **and** QA.
- `in-review` → `done` without an approved Review and a passing QA Result — the completion gate is non-bypassable.
- `done` → anything — `done` is terminal.
- `cancelled` → anything — `cancelled` is terminal.

**Failure states.** `blocked` is the task-level failure state. It is recoverable: a resolved blocker returns the task to `in-progress`.

**Implementation note.** `Task.status` uses hyphenated strings: `todo`, `in-progress`, `in-review`, `blocked`, `done`, `cancelled`. On session completion, `recordExecutionResult` sets the task to `in-review` (guarded to skip tasks already in `done`/`cancelled`/`in-review`) and to `todo` on a non-completed result. `review-service.ts` sets `in-review` when a review opens, `in-progress` on `changes_requested`, and `blocked` on a `blocked` verdict. `qa-service.ts` sets `done` on `passed`, `in-progress` on `failed`, and `blocked` on `blocked`. There is no `qa` task state — the task holds at `in-review` for both gates.

---

## 4. Execution Session

**What it is.** A single implementation attempt for a task by an agent (Claude Code, Codex, or a human). It records what the agent did; Engineering OS executes no code itself. See [GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md).

**States**

| State | Meaning | Terminal? |
|---|---|---|
| `queued` | Session created; awaiting brief generation. | no |
| `prepared` | Implementation brief generated; ready for the worker to claim. | no |
| `running` | The worker has checked out the repo and is running the agent. | no |
| `completed` | Agent finished; result, files changed, and any PR metadata recorded. | **yes** |
| `failed` | The attempt failed (guardrail block, error, or validation failure). | **yes** |
| `needs_clarification` | The agent stopped needing input; the run can be re-prepared. | no |
| `canceled` | The session was cancelled before completing. | **yes** |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `queued` | Session prepared for a task. | Runtime (driver or manual) |
| `queued` → `prepared` | Task brief attached. | Runtime |
| `prepared` → `running` | Worker claims and starts the agent. | Worker |
| `running` → `completed` | Agent result ingested. | Worker / manual form |
| `running` → `failed` | Guardrail block, error, or failed validation. | Worker |
| `running` → `needs_clarification` | Agent requires CEO input to continue. | Worker |
| `prepared`/`running`/`queued` → `canceled` | Session cancelled. | CEO / Runtime |

**Invalid transitions**

- Re-recording a result on a session already in `completed` / `failed` / `canceled` — these three are guarded as terminal for idempotency, so result ingestion is rejected.
- `completed` → `running` — a finished session is never restarted; a new session is created instead.

**Failure states.** `failed` is terminal and records the offending guardrail paths or error in the audit trail. `needs_clarification` is a recoverable pause, not a failure.

**Implementation note.** `ExecutionSession.status` ∈ {`queued`, `prepared`, `running`, `completed`, `failed`, `canceled`, `needs_clarification`}. PR linkage is tracked separately: `prStatus` ∈ {`open`, `draft`, `merged`, `closed`} and `mergeStatus` ∈ {`pending`, `merged`, `conflicts`}. The pre-push guardrail gate runs independently of the agent's permission mode and forces the session to `failed` on a protected-path or protected-branch violation.

---

## 5. Project

**What it is.** A bounded unit of engineering work scoped to a feature delivery. See [DOMAIN_MODEL.md › Project](./DOMAIN_MODEL.md#project).

**States (designed)**

| State | Meaning | Terminal? |
|---|---|---|
| `planning` | Created from an approved plan; tasks being decomposed. | no |
| `in_progress` | Engineers implementing. | no |
| `in_review` | Code review phase. | no |
| `in_qa` | QA validation phase. | no |
| `releasing` | Release readiness and deployment. | no |
| `done` | Shipped, documented, memory updated. | **yes** |
| `cancelled` | Cancelled before completion. | **yes** |

**Transitions (designed)**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `planning` | Plan application creates the project. | Runtime |
| `planning` → `in_progress` | First task moves into implementation. | Tech Lead |
| `in_progress` → `in_review` | All tasks delivery-ready. | Tech Lead |
| `in_review` → `in_qa` | Review approved; code merged. | Reviewer |
| `in_qa` → `releasing` | QA Go recommendation issued. | QA Engineer |
| `releasing` → `done` | Deployment stable; memory updated. | Release Manager |
| `*` → `cancelled` | CEO cancels. | CEO |

**Invariants.** A Project may not reach `done` without an associated Release and a QA Result showing a Go recommendation (mirrors the Task gate).

**Implementation note.** `Project.status` defaults to `active` and is created by `plan-application-service.ts`. The full phase machine above is the **design contract**; today the project is created and the per-task gates carry the live state. Phase-level project transitions are not yet enforced by a service.

---

## 6. Feature

**What it is.** A deliverable product capability defined in a Feature Brief, with acceptance criteria. See [DOMAIN_MODEL.md › Feature](./DOMAIN_MODEL.md#feature).

**States (designed)**

| State | Meaning | Terminal? |
|---|---|---|
| `planned` / `backlog` | Defined but not yet in development. | no |
| `brief_draft` | Feature Brief being authored. | no |
| `brief_approved` | Brief approved; ready for decomposition. | no |
| `in_development` | Tasks in implementation. | no |
| `in_review` | Code review phase. | no |
| `in_qa` | QA validation. | no |
| `done` | Acceptance criteria satisfied; Feature Memory written. | **yes** |
| `cancelled` | Cancelled; history retained for memory. | **yes** |

**Transitions (designed)**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `planned` | Plan application creates the feature. | Runtime |
| `planned` → `brief_draft` → `brief_approved` | Product Manager drafts and the brief is approved. | Product Manager / CEO |
| `brief_approved` → `in_development` | Tasks decomposed and assigned. | Tech Lead |
| `in_development` → `in_review` → `in_qa` → `done` | Work passes the review and QA gates. | Reviewer / QA Engineer |
| `*` → `cancelled` | CEO cancels. | CEO |

**Invariants.** A Feature must have an approved Feature Brief before `in_development`, and may not reach `done` until its acceptance criteria are satisfied and its Feature Memory record exists.

**Implementation note.** `Feature.status` defaults to `planned` and is created by `plan-application-service.ts`. As with Project, downstream phase transitions are the design contract; the live signal today is carried by the Tasks under the Feature.

---

## 7. Outcome and Planning Draft

These two objects own the front of the loop — a CEO outcome and the reviewable plan generated from it. See [COMPANY_RUNTIME.md › Planning](./COMPANY_RUNTIME.md#7-planning).

### 7.1 Outcome

**Canonical states**

`proposed` · `analyzing` · `needs_clarification` · `planned` · `awaiting_approval` · `approved` · `in_delivery` · `validating` · `releasing` · `released` · `completed` · `archived` · `cancelled` · `rejected` · `deferred` · `failed` · `superseded`

**Lifecycle (canonical)**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `proposed` | CEO submits an outcome. | CEO |
| `proposed` → `analyzing` → `planned` | Planner ingests context and generates a plan. | Runtime |
| `proposed`/`analyzing` → `needs_clarification` | Ambiguity requires a CEO answer. | Runtime |
| `planned` → `awaiting_approval` → `approved` | Plan presented and approved. | CEO |
| `approved` → `in_delivery` → `validating` → `releasing` → `released` → **`completed`** | Work executes and ships. | Runtime |
| `*` → `cancelled` / `rejected` / `deferred` / `failed` / `superseded` | Off-ramps. | CEO / Runtime |

Terminal: `completed`, `released`, `archived`, `cancelled`, `rejected`, `superseded`, `failed`.

**Implementation note.** `OUTCOME_STATUSES` defines the full canonical enum above. The exercised subset today writes `proposed`, a planning state, an in-delivery state, `completed`, and `failed`; the remaining states are the designed contract and are not all driven yet.

### 7.2 Planning Draft

**States**

| State | Meaning | Terminal? |
|---|---|---|
| `draft` | Generated; ready for CEO review. | no |
| `reviewing` | Under CEO review. | no |
| `approved` | Approved; eligible to apply. | no |
| `applied` | Idempotently applied to Project/Feature/Task records. | **yes** |
| `rejected` | Rejected with a reason. | **yes** |
| `failed` | Generation or application errored. | no (failure) |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `draft` | Deterministic planner emits the draft. | Runtime |
| `draft` → `reviewing` | CEO opens the plan. | CEO |
| `reviewing` → `approved` | CEO approves. | CEO |
| `reviewing`/`draft` → `rejected` | CEO rejects (reason recorded). | CEO |
| `approved` → `applied` | Plan applied to real work records. | Runtime |
| `draft`/`approved` → `failed` | Generation or application error. | Runtime |

**Invalid transitions**

- `rejected` → anything, `applied` → anything — both terminal; a new draft version is created instead (drafts are versioned per outcome).
- Applying a draft that is not `approved` — `plan-application-service.ts` requires `approved` first.

**Implementation note.** `PLANNING_DRAFT_STATUSES` = {`draft`, `reviewing`, `approved`, `rejected`, `applied`, `failed`}. Application is idempotent and fully traceable; generation/application errors are captured in `generationError` / `applicationError`.

---

## 8. Review

**What it is.** A structured evaluation of a task's work before it advances. See [DOMAIN_MODEL.md › Review](./DOMAIN_MODEL.md#review) and the [CODE_REVIEW SOP](../sops/CODE_REVIEW.md).

**States**

| State | Meaning | Terminal? |
|---|---|---|
| `pending` | Review opened; awaiting a verdict. | no |
| `approved` | No Blocking findings; the task may proceed to QA. | **yes** (gate cleared) |
| `changes_requested` | Blocking findings returned to the author. | no |
| `blocked` | A hard block (e.g. security hold) prevents approval. | no (failure) |
| `needs_clarification` | The reviewer needs input before deciding. | no |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `pending` | Review requested when a task reaches `in-review`. | Runtime / Tech Lead |
| `pending` → `approved` | Reviewer approves; a pending QA Result is created. | Reviewer |
| `pending` → `changes_requested` | Blocking findings; task returns to `in-progress`. | Reviewer |
| `pending` → `blocked` | Hard block recorded; task → `blocked`. | Reviewer / Security |
| `pending` → `needs_clarification` | Reviewer requests clarification. | Reviewer |

**Invalid transitions**

- `pending` → `approved` while active Blocking findings exist — forbidden by the review invariant.
- Re-recording a verdict on a non-`pending` review — the verdict, once written, is the record; a new review is opened for a re-review.

**Failure state.** `blocked` is the review failure state and propagates a `blocked` status to the task.

**Implementation note.** `REVIEW_VERDICTS` = {`approved`, `changes_requested`, `blocked`, `needs_clarification`}; `Review.status` mirrors the verdict. `recordReviewResult` (in `review-service.ts`) creates the pending `QAResult` on approval, which is what keeps the task at the `in-review` gate for QA.

---

## 9. QA Result

**What it is.** The formal record of QA validation; its recommendation gates every release. See [DOMAIN_MODEL.md › QA Result](./DOMAIN_MODEL.md#qa-result) and the [QA_VALIDATION SOP](../sops/QA_VALIDATION.md).

**States**

| State | Meaning | Terminal? |
|---|---|---|
| `pending` | QA checklist attached; awaiting execution. | no |
| `passed` | Go recommendation; the task may reach `done`. | **yes** |
| `failed` | No-Go; defects returned to engineering. | **yes** |
| `blocked` | QA cannot proceed (environment or hard block). | **yes** (failure) |
| `needs_clarification` | QA needs input before deciding. | no |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `pending` | Created when a review is approved. | Runtime |
| `pending` → `passed` | All checks pass; task → `done`. | QA Engineer |
| `pending` → `failed` | Defects found; task → `in-progress`. | QA Engineer |
| `pending` → `blocked` | Hard block; task → `blocked`. | QA Engineer |
| `pending` → `needs_clarification` | Clarification requested. | QA Engineer |

**Invalid transitions**

- `pending` → `passed` with failing checks — a Go requires the checks to pass; the gate is non-bypassable at the QA Engineer level (only a CTO-recorded override may proceed past a No-Go, per [COMPANY_RUNTIME.md › Conflict Resolution](./COMPANY_RUNTIME.md#16-conflict-resolution)).
- Mutating a terminal QA Result — `passed`/`failed`/`blocked` are terminal; the recommendation is annotated, never rewritten.

**Implementation note.** `QA_VERDICTS` = {`passed`, `failed`, `blocked`, `needs_clarification`}; terminal QA statuses are `passed`, `failed`, `blocked` (`qa-service.ts`).

---

## 10. Approval Checkpoint

**What it is.** A pause where a sub-threshold autonomy gate requires explicit CEO sign-off before an agentic action proceeds. See [COMPANY_RUNTIME.md › Approval Requests](./COMPANY_RUNTIME.md#18-approval-requests).

**States**

| State | Meaning | Terminal? |
|---|---|---|
| `awaiting_approval` | Raised; waiting on a CEO decision. | no |
| `approved` | CEO approved; the gated action proceeds. | **yes** |
| `rejected` | CEO rejected; the flow returns to rework. | **yes** |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `awaiting_approval` | An action's disposition is `requires_approval` and no prior approval exists. | Runtime |
| `awaiting_approval` → `approved` | CEO approves. | CEO |
| `awaiting_approval` → `rejected` | CEO rejects. | CEO |

**Disposition source.** Whether an action even raises a checkpoint is decided by the autonomy policy matrix, the single source consulted by both the manual path and the driver:

| Action | manual | suggest | assist | delegate | autonomous |
|---|---|---|---|---|---|
| `create_session` | approval | allow | allow | allow | allow |
| `run_agent` | approval | approval | approval | allow | allow |
| `push` | approval | approval | allow | allow | allow |
| `open_pr` | approval | approval | allow | allow | allow |
| `auto_merge` | deny | deny | approval | approval | allow |
| `auto_review` | approval | approval | approval | allow | allow |
| `auto_qa` | approval | approval | approval | allow | allow |

**Invalid transitions.** Re-resolving an already `approved`/`rejected` checkpoint throws — double-resolution is forbidden. A `deny` disposition never produces a checkpoint; the action is blocked outright.

**Implementation note.** The pure state primitives (`createApprovalCheckpoint`, `approveCheckpoint`, `rejectCheckpoint`, `evaluateAutonomyCheckpoint`) live in `autonomy-policy.ts` with statuses {`awaiting_approval`, `approved`, `rejected`}. The **persisted, user-facing** checkpoint today is a pending `Review` or `QAResult` whose task is still `in-review`; `approval-checkpoints.ts` lists them and resolves them by recording the underlying review/QA verdict (approve → `approved`; reject → `changes_requested`). A `decision` notification fires when a checkpoint is first raised.

---

## 11. Decision

**What it is.** A significant, lasting choice (architecture, scope, risk acceptance) with a recorded rationale. See [DOMAIN_MODEL.md › Decision](./DOMAIN_MODEL.md#decision).

**States (designed)**

| State | Meaning | Terminal? |
|---|---|---|
| `proposed` | A decision is recommended, pending the authorizing role. | no |
| `approved` | Accepted by the authority for the decision's domain. | no |
| `implemented` | Reflected in the work it governs. | no |
| `superseded` | Replaced by a later decision (links to its successor). | **yes** |
| `reversed` | Explicitly undone. | **yes** |

**Transitions (designed)**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `proposed` | An employee records a decision needing authority. | Deciding employee |
| `proposed` → `approved` | Authorizing role accepts (CTO for architecture, PM for scope). | CTO / PM / CEO |
| `approved` → `implemented` | The decision takes effect. | Tech Lead |
| `implemented` → `superseded` | A newer decision replaces it. | Deciding employee |
| `*` → `reversed` | The decision is undone. | Authorizing role |

**Invariants.** Every Decision has exactly one decision maker; a superseding Decision must reference the one it supersedes; Decisions are never deleted.

**Implementation note.** There is **no Decision table in the schema today** and no transition service. Decisions are currently captured as Timeline entries and Memory content. This lifecycle is the design contract that a future Decision model must satisfy; it is included here so the contract is fixed before implementation, per the project's "specify before AI" rule.

---

## 12. Release

**What it is.** The authoritative record of a production deployment. See [DOMAIN_MODEL.md › Release](./DOMAIN_MODEL.md#release) and the [RELEASE SOP](../sops/RELEASE.md).

**States (designed lifecycle)**

| State | Meaning | Terminal? |
|---|---|---|
| `draft` | Release candidate assembled from completed work. | no |
| `ready` | Release Readiness Checklist complete; QA Go on record. | no |
| `deploying` | Production deployment in progress. | no |
| `deployed` | Deployed; monitoring window open. | no |
| `stable` | Monitoring window closed cleanly. | **yes** |
| `rolled_back` | Deployment reversed; prior version restored. | **yes** |
| `failed` | Deployment could not complete. | **yes** (failure) |

**Transitions (designed)**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `draft` | Release candidate created from completed tasks. | Release Manager |
| `draft` → `ready` | Checklist complete; QA Go confirmed. | Release Manager |
| `ready` → `deploying` → `deployed` | Deployment executed. | DevOps Engineer |
| `deployed` → `stable` | Monitoring window closes cleanly. | Monitoring Engineer |
| `deployed` → `rolled_back` | Post-release signals trigger a rollback. | Release Manager |
| `deploying` → `failed` | Deployment fails. | DevOps Engineer |

**Invariants.** A Release may not move to `deploying` without a completed checklist and a QA Go recommendation on record. A `rolled_back` Release retains its record.

**Implementation note.** `Release.status` defaults to `draft` and `Release.deploymentStatus` to `not_started`. `release-candidate-service.ts` implements `draft` → `ready` (with `deploymentStatus` `not_started`); the deployment, monitoring, and rollback states above are the design contract and are not yet driven by a service. Deployment status is tracked as a parallel field (`deploymentStatus`) rather than folded into `status`.

---

## 13. Incident

**What it is.** A record of a production problem from detection through resolution. See [DOMAIN_MODEL.md › Incident](./DOMAIN_MODEL.md#incident) and the [PRODUCTION_INCIDENT SOP](../sops/PRODUCTION_INCIDENT.md).

**States (designed)**

| State | Meaning | Terminal? |
|---|---|---|
| `detected` | Anomaly detected; severity being classified. | no |
| `responding` | Active response underway. | no |
| `mitigated` | Impact contained; not yet root-caused. | no |
| `resolved` | Service restored. | no |
| `post_mortem_complete` | Root cause documented; follow-ups created. | **yes** |

**Transitions (designed)**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `detected` | Monitoring Engineer detects an anomaly. | Monitoring Engineer |
| `detected` → `responding` | Response begins (CTO/CEO notified for P0/P1). | Release Manager |
| `responding` → `mitigated` → `resolved` | Impact contained and service restored. | Release Manager |
| `resolved` → `post_mortem_complete` | Root cause analysis and follow-ups recorded. | Tech Lead |

**Invariants.** Every Incident must have a root cause analysis before it is fully closed; P0/P1 incidents require CTO and CEO notification; an Incident record is never deleted.

**Implementation note.** The `Incident` model exists in the schema with `status` defaulting to `open`, a `severity` field, and a `resolvedAt` timestamp — but **no transition service exists today**. The implemented lifecycle is effectively `open` → `resolved` (via `resolvedAt`); the richer machine above, and the P0–P3 severity scale, are the design contract.

---

## 14. Memory

**What it is.** The company's accumulated organizational knowledge, stored as Memory Records. See [DOMAIN_MODEL.md › Memory Record](./DOMAIN_MODEL.md#memory-record).

**States (designed)**

| State | Meaning | Terminal? |
|---|---|---|
| `active` | The current, authoritative record. | no |
| `deprecated` | No longer current but retained. | **yes** |
| `superseded` | Replaced by a newer record it links to. | **yes** |

**Transitions (designed)**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `active` | A workflow completion or an employee writes a record. | Any employee / Runtime |
| `active` → `superseded` | A newer record replaces it (links forward). | Authoring employee |
| `active` → `deprecated` | The record is retired without a direct successor. | CTO / authoring employee |

**Invariants.** A Memory Record is never deleted — only deprecated or superseded; a superseded record retains a link to its successor; conversation-scoped records expire on session close.

**Implementation note.** `MemoryRecord` has **no status field today** — memory is append-only. The lifecycle above is the design contract for when supersession/deprecation is implemented. Until then, "superseding" is expressed by writing a newer record; nothing is mutated or removed.

---

## 15. Employee Work Status

**What it is.** The availability and engagement state of a virtual employee. See [DOMAIN_MODEL.md › Employee](./DOMAIN_MODEL.md#employee).

**States**

| State | Meaning | Terminal? |
|---|---|---|
| `active` | Participating in company workflows. | no |
| `unavailable` | Temporarily unable to participate (system state). | no |
| `planned` | Approved but not yet deployed. | no |
| `retired` | Removed from active workflows; history retained. | **yes** |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `active` | Provisioned from the standard roster at company creation. | Runtime |
| `(create)` → `planned` | Role approved but not yet deployed. | CTO |
| `planned` → `active` | Employee deployed. | CTO |
| `active` → `unavailable` | Temporarily taken out of rotation. | Runtime |
| `unavailable` → `active` | Returned to rotation. | Runtime |
| `active` → `retired` | Removed from active workflows. | CTO |

**Engagement vs availability.** `status` above is *availability*. An employee's *current engagement* (what they are working on right now) is derived from their assigned Tasks and active Execution Sessions, not from `status` — see [COMPANY_RUNTIME.md › Event-Driven Employee Invocation](./COMPANY_RUNTIME.md#36-event-driven-employee-invocation). Employees are invoked per event; they are not long-running processes.

**Invariants.** An Employee may not be `retired` while owning active Tasks or Reviews — work is reassigned first.

**Implementation note.** `Employee.status` defaults to `active`; a separate `workload` field defaults to `normal`. The transition rules above are the design contract; the field exists today but is not yet driven by a dedicated availability service.

---

## 16. Repository Onboarding

**What it is.** The process of connecting a repository and building its intelligence before the company plans against it. See [DOMAIN_MODEL.md › Repository](./DOMAIN_MODEL.md#repository), [REPOSITORY_ANALYSIS_SNAPSHOTS.md](./REPOSITORY_ANALYSIS_SNAPSHOTS.md), and the [CODEBASE_ONBOARDING SOP](../sops/CODEBASE_ONBOARDING.md).

**Analysis states (implemented)**

| State | Meaning | Terminal? |
|---|---|---|
| `pending` | Connected; not yet analyzed. | no |
| `analyzing` | Snapshot ingestion in progress. | no |
| `completed` | Analysis succeeded; intelligence available. | no |
| `failed` | Analysis errored; error recorded. | no (failure) |

**Transitions**

| From → To | Trigger | Owner |
|---|---|---|
| `(create)` → `pending` | CEO connects the repository. | CEO |
| `pending` → `analyzing` | Snapshot analysis starts. | Runtime |
| `analyzing` → `completed` | Snapshot ingested (file tree, deps, routes, schema). | Runtime |
| `analyzing` → `failed` | Analysis error. | Runtime |
| `completed`/`failed` → `analyzing` | Re-analysis (new connection event, CEO request, or stale memory). | Runtime |

**Designed repository lifecycle.** Beyond analysis status, the Repository object itself carries a coarser designed lifecycle — `connecting` → `active` → `stale` → `archived` — where `active` requires at least a partially populated Repository Memory.

**Invalid transitions.** The company does not plan against a repository whose latest analysis is not `completed` — an outcome scoped to an un-analyzed repo surfaces a warning rather than proceeding silently.

**Implementation note.** `Repository.analysisStatus` defaults to `pending`; `repository-snapshot-service.ts` drives `analyzing` → `completed`/`failed`, and each run writes a `RepositoryAnalysisSnapshot` (whose own `status` defaults to `completed`). Re-analysis is event-triggered, never per-request. The `connecting`/`active`/`stale`/`archived` Repository lifecycle is the design contract.

---

## 17. Cross-Entity Gate Map

The per-entity machines above interlock into one delivery gate chain. This is the single non-negotiable spine of the system: **no task reaches `done` without a recorded approved Review and a passing QA Result.**

```
Outcome.proposed
  → PlanningDraft.draft → reviewing → approved → applied
      ⇒ Project/Feature/Task created (Task.todo)
ExecutionSession.queued → prepared → running → completed
  ⇒ Task.todo → in-review
Review.pending → approved        ⇒ QAResult.pending created (Task holds in-review)
QAResult.pending → passed        ⇒ Task.in-review → done
  ⇒ Release.draft → ready (from completed tasks)
```

Autonomy decides only *where the chain pauses for a human*, never *whether a gate exists*:

- **assist** — the chain pauses at the Review and QA checkpoints (an Approval Checkpoint is raised; the task holds at `in-review`).
- **delegate / autonomous** — the gate-advancement service drives Review → QA → `done` automatically, still recording an approved Review and a passing QA Result through the same services. The gates are never skipped.

This is the live behavior verified end-to-end: same code, same guardrails, autonomy level is the only difference. See [COMPANY_RUNTIME.md › State Transitions](./COMPANY_RUNTIME.md#3-state-transitions).

---

## 18. Relationship to Other Documents

- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) — defines the objects whose lifecycles this document specifies. Where it lists lifecycle states per object, this document is the authoritative machine for the transitions between them.
- [COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md) — defines how the runtime advances work through these machines (events, dispatch, gates). This document defines the per-entity contract the runtime obeys.
- [GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md) — defines the branch/PR tracking that the Execution Session machine records.
- [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) — defines how these states surface to the CEO (status indicators, steppers, inbox checkpoints).
- [SOPs](../sops/) — `NEW_FEATURE.md`, `CODE_REVIEW.md`, `QA_VALIDATION.md`, `RELEASE.md`, `ROLLBACK.md`, `PRODUCTION_INCIDENT.md`, and `CODEBASE_ONBOARDING.md` define the phase-by-phase procedures whose checkpoints map onto the transitions here.

This document does not depend on Linear. Where states align with a Linear workflow (e.g. `todo` / `in-progress` / `in-review` / `done`), the alignment is convenience, not coupling — the state machines are owned by Engineering OS.
