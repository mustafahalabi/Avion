# Work Item System — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** Tech Lead
**Last Updated:** 2026-06-29

This document defines how work is captured, structured, owned, prioritized, decomposed, tracked, reviewed, completed, and archived inside Engineering OS. It is a behavioral system specification — it describes how the company treats a unit of work, not the database tables or UI screens that store it.

A "work item" is the company's atomic unit of accountable engineering effort. The most concrete work item is the **Task**: one deliverable, one owner, one working day. This system explains what a work item is, what it is *not*, how it moves, who is responsible at each step, and what the company learns when it closes.

This document follows the behavior already specified in [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) and the object definitions in [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md). Where this document and those disagree, the Domain Model wins for object shape and the Company Runtime wins for lifecycle behavior; this document binds the two together into one operating system for work.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Core Concepts](#3-core-concepts)
4. [Work Items vs. Adjacent Objects](#4-work-items-vs-adjacent-objects)
5. [The Work Item Lifecycle](#5-the-work-item-lifecycle)
6. [Statuses](#6-statuses)
7. [Ownership Model](#7-ownership-model)
8. [Creation Rules](#8-creation-rules)
9. [Assignment Rules](#9-assignment-rules)
10. [Prioritization](#10-prioritization)
11. [Decomposition](#11-decomposition)
12. [Progress Tracking](#12-progress-tracking)
13. [Review Rules](#13-review-rules)
14. [Completion Rules](#14-completion-rules)
15. [Archival and Cancellation](#15-archival-and-cancellation)
16. [Inputs and Outputs](#16-inputs-and-outputs)
17. [Relationship to SOPs](#17-relationship-to-sops)
18. [Responsibility Rules](#18-responsibility-rules)
19. [Memory Updates](#19-memory-updates)
20. [Failure Modes](#20-failure-modes)
21. [Implemented Today vs. Designed](#21-implemented-today-vs-designed)
22. [Relationship to Other Documents](#22-relationship-to-other-documents)

---

## 1. Purpose

The Work Item System exists so that every piece of engineering effort in the company is **captured, owned, and accountable** from the moment it is identified to the moment it ships and is remembered.

Without it, work would live in conversations, intentions, and the heads of whoever happened to be doing it. With it, the company can answer three questions at any time, about any unit of work:

1. **What is this work, and why does it exist?** Every work item traces back to a business outcome.
2. **Who owns it, and where is it?** Every work item has exactly one owner and exactly one status.
3. **Is it actually done?** "Done" is a gated condition, not an opinion.

The Work Item System is the substrate the [Company Runtime](../architecture/COMPANY_RUNTIME.md) operates on. The runtime advances work; the work item is the thing being advanced.

---

## 2. Scope

**In scope:**

- The Task as the primary, schedulable unit of work, and the Subtask as its internal checkpoint.
- The structural containers a Task lives in: Feature, Project, Sprint, and Milestone.
- How work is created, assigned, prioritized, decomposed, tracked, reviewed, completed, and archived.
- The ownership, responsibility, and status rules that govern a work item.
- The relationship between a work item and the quality artifacts it produces (Review, QA Result).

**Out of scope (owned elsewhere):**

- The precise field-level shape and invariants of each object — owned by [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md).
- The phase-by-phase procedures that act on work items — owned by the [SOPs](../sops/).
- The orchestration mechanics (events, dispatch, employee invocation) — owned by [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md).
- The mechanics of getting code to GitHub — owned by [GITHUB_WORKFLOW_FOUNDATION.md](../architecture/GITHUB_WORKFLOW_FOUNDATION.md).

---

## 3. Core Concepts

The company organizes work in a strict containment hierarchy. Each level answers a different question.

| Concept | Question it answers | Owner |
|---|---|---|
| **Initiative** | What strategic direction are we pursuing? | Product Manager (with CEO) |
| **Project** | What bounded engineering effort delivers part of that direction? | Tech Lead |
| **Feature** | What user-facing capability are we building? | Product Manager |
| **Task** | What single deliverable does an engineer complete in a day? | Tech Lead (assigns), Engineer (executes) |
| **Subtask** | What granular checkpoint tracks progress inside a Task? | Assigned Engineer |
| **Sprint** | In what time window is this set of Tasks executed? | Tech Lead |
| **Milestone** | What significant delivery marker have we reached? | Product Manager |

**The Task is the center of this system.** Everything above it is structure; everything below it is detail. A Task is the smallest object that flows independently through the full SOP lifecycle — it is created, assigned, implemented, reviewed, validated, and completed as one unit.

Key properties of a Task (per [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)):

- **One deliverable.** A Task produces one shippable thing.
- **One owner.** Exactly one Employee is accountable for execution at any time.
- **One day.** A Task that cannot complete in a single working day is too large and must be decomposed.
- **Traceable.** Every Task maps to at least one acceptance criterion of its parent Feature, and through it to a business outcome.
- **Gated.** A Task cannot reach `done` without a recorded approved review and passing QA.

A **Subtask** is an internal progress marker inside a Task. Subtasks do not flow through SOPs, do not get their own reviews, and are never independently assigned. They exist so the engineer and Tech Lead can see granular progress. In the current schema a Subtask carries only a title and a `completed` boolean.

---

## 4. Work Items vs. Adjacent Objects

A frequent source of confusion is treating everything in the company as a "task." It is not. The Work Item System is deliberately narrow. The following objects are **not** work items, and conflating them breaks ownership and tracking.

| Object | What it is | Why it is not a work item |
|---|---|---|
| **Project** | A *container* for related work items, scoped to a feature/effort. | A Project does not get executed, reviewed, or assigned to an engineer. It is closed when its work items are done. It groups work; it is not work. |
| **Initiative** | A *strategic direction* ("improve onboarding"). | An Initiative is a planning object with a success metric, not a deliverable. It is satisfied when its outcomes are achieved, not when tasks are checked off. |
| **Decision** | A *recorded choice* (architecture, scope, risk acceptance). | A Decision records *what was chosen and why*. It is durable knowledge, not work to be done. Decisions are produced *during* work items; they are not work items. See [COMPANY_RUNTIME.md §15](../architecture/COMPANY_RUNTIME.md). |
| **Message / Comment / Conversation** | *Communication* between the CEO and the company, or between employees. | A message may *trigger* the creation of a work item, but the message is not the work. A CEO request becomes an Outcome and then structured work; it does not itself become a Task. |
| **Outcome** | The CEO's *requested business result* before planning. | An Outcome is the seed. Planning turns it into Projects, Features, and Tasks. The Outcome persists as the "why," but it is not scheduled or executed. |
| **Review / QA Result** | *Quality artifacts* a work item produces. | These are outputs of a Task's lifecycle, not work items themselves. They gate completion; they do not get assigned and decomposed. |

**The test:** *Can it be assigned to one engineer and completed in a working day, producing one deliverable?* If yes, it is (or should be decomposed into) a Task. If no, it is structure, strategy, communication, knowledge, or a quality artifact.

---

## 5. The Work Item Lifecycle

A work item moves through a defined sequence of states. The company never silently advances or abandons a work item — every transition is explicit and recorded.

```
(captured)        Outcome submitted → plan generated → plan approved & applied
   ↓
todo              Task created and (optionally) assigned; eligible for execution
   ↓
in-progress       Implementation underway (engineer or execution session running)
   ↓
in-review         Implementation complete; work submitted for code review
   ↓              (review gate → QA gate; both must pass)
done              Review approved AND QA passed; Definition of Done satisfied
```

Two transitions can occur from almost any active state:

- **→ blocked** when the work cannot proceed and the blocker is outside the owner's authority (see [§20](#20-failure-modes) and [COMPANY_RUNTIME.md §30](../architecture/COMPANY_RUNTIME.md)).
- **→ cancelled** when the work is explicitly abandoned. `cancelled` is terminal and retains full history.

**The review and QA gates are the heart of the lifecycle.** When implementation completes, the work item lands in `in-review` and *stops*. It does not advance on its own. The [gate-advancement service](#21-implemented-today-vs-designed) then drives it through two ordered gates:

1. **Review gate** — a Review must exist and reach `approved`.
2. **QA gate** — a QA Result must reach `passed`.

Only when *both* gates clear does the Task become `done`. The behavior at each gate depends on the company's autonomy level (see [§13](#13-review-rules)): at lower autonomy the gate pauses and raises a CEO checkpoint; at higher autonomy the gate is driven automatically — but it is never bypassed.

---

## 6. Statuses

A work item is always in exactly one status. There are two status vocabularies in the system, and the distinction is real and load-bearing.

**Canonical status set** (the conceptual model, per [DOMAIN_MODEL.md §Task Status](../architecture/DOMAIN_MODEL.md)):

| Value | Meaning |
|---|---|
| `backlog` | Defined; not yet in a sprint |
| `todo` | In a sprint; not yet started |
| `in_progress` | Assigned engineer is actively working |
| `blocked` | Cannot progress; blocker recorded |
| `in_review` | Submitted for code review |
| `in_qa` | In QA validation |
| `done` | Definition of Done satisfied; QA passed |
| `cancelled` | Explicitly cancelled; will not be completed |

**Implemented status set** (what the running platform persists on `Task.status` today):

| Value | Meaning |
|---|---|
| `todo` | Eligible for an implementation attempt (the only executable status) |
| `in-progress` | Implementation underway |
| `in-review` | Implementation complete; awaiting both the review gate and the QA gate |
| `blocked` | Cannot progress |
| `done` | Review approved and QA passed |
| `cancelled` | Explicitly cancelled |

Two notes that matter for anyone reading the code or the data:

- The implemented set uses **hyphenated** values (`in-progress`, `in-review`) and folds the conceptual `in_qa` state into `in-review`: a Task stays `in-review` while it traverses *both* the review and QA gates. QA progress is tracked on the QA Result artifact, not by a distinct Task status.
- `backlog` is conceptual today. Newly created Tasks default to `todo`. Only `todo` Tasks are eligible to be selected for a new implementation attempt; `in-progress`, `in-review`, `done`, `blocked`, and `cancelled` are never re-selected.

This document treats the implemented set as authoritative for runtime behavior and the canonical set as the target the system is converging toward.

---

## 7. Ownership Model

**Every work item has exactly one owner at all times.** This is the first organizational principle of Engineering OS, applied to work: *one owner, clear accountability.*

| Lifecycle phase | Accountable owner |
|---|---|
| Capture / planning | Product Manager (Feature), Tech Lead (decomposition) |
| Creation & assignment | Tech Lead |
| Implementation | Assigned Engineer |
| Review | Reviewer |
| QA validation | QA Engineer |
| Completion sign-off | Tech Lead (Delivery Readiness) → quality gates |
| Memory update | Product Manager / Tech Lead |

Ownership rules:

- **Ownership is singular.** A Task is never co-owned. Multi-domain work is split into separate Tasks and sequenced (see [COMPANY_RUNTIME.md §11](../architecture/COMPANY_RUNTIME.md)).
- **Ownership moves, accountability follows.** When a Task moves from implementation to review, the *active* owner changes (Engineer → Reviewer), but the Engineer remains accountable for the deliverable until it is `done`.
- **The CEO never owns a work item.** The CEO submits outcomes and approves gates; the company owns execution. The CEO does not create, assign, or close Tasks.
- **Self-assignment is prohibited.** Engineers do not assign themselves Tasks. The Tech Lead assigns.

---

## 8. Creation Rules

Work items are created through two paths, and both are constrained.

**Path A — Plan application (the primary path).**
A CEO Outcome is turned into a reviewable plan by the deterministic planner. When the CEO approves the plan, applying it creates real Project, Feature, and Task records idempotently, each carrying the plan-item identity that produced it (`planningDraftId` + `planItemId`). This traceability is what lets the company connect a running Task back to the outcome that justified it, and what lets the executable-task selector reason about which plan items remain.

**Path B — Direct creation.**
A Task can also be created directly against a Project (with an optional Feature, assignee, and priority). This is the manual path used during dogfooding and for ad-hoc work. Direct creation still enforces ownership scoping: the Project must belong to the acting user's company, a referenced Feature must belong to that Project, and a referenced assignee must belong to the same company. Cross-company references are rejected.

Creation rules that hold on both paths:

- **Tasks are created by the Tech Lead** (conceptually). In the platform, creation is gated by company ownership rather than role, but the organizational rule stands: decomposition into Tasks is the Tech Lead's responsibility.
- **A new Task defaults to `todo`** and `medium` priority unless specified.
- **Every Task should map to an acceptance criterion** of its parent Feature. This is the canonical invariant; the running platform allows a Task without a Feature for ad-hoc work, but feature-bound work must satisfy it.
- **The CEO does not create Tasks.** Task creation is an engineering act.

---

## 9. Assignment Rules

- **Tasks are assigned by the Tech Lead** to the Engineer whose expertise matches the Task domain.
- **An assignee must belong to the same company** as the Task. The platform validates this on every assignment to prevent cross-company injection.
- **Assignment is singular.** Exactly one Employee is assigned; multi-domain work is split, not co-assigned.
- **Unassigned Tasks are valid but not executable by a human owner.** A Task may exist with no assignee (e.g., freshly applied from a plan). The autonomous execution path can still pick up an unassigned `todo` Task; the human-ownership path requires an assignee.
- **When no suitable engineer is available,** the Tech Lead escalates to the CTO rather than overloading an engineer (see [COMPANY_RUNTIME.md §11](../architecture/COMPANY_RUNTIME.md)).

---

## 10. Prioritization

Each work item carries a priority: `low`, `medium`, `high`, or `urgent` (default `medium`). Priority orders *attention and selection*, not status.

How priority is used today:

- **Executable-task selection.** When the company needs the next Task to execute for a given company, it considers only `todo` Tasks belonging to **approved or applied** plans, respects plan-item dependencies (a Task whose prerequisite plan items are not yet `done` is not selected), and orders the remaining candidates. Tasks not yet unblocked by their dependencies are deferred, not skipped.
- **CEO attention.** Higher-priority blocked or waiting work surfaces ahead of lower-priority work in the company's "next action" recommendations.

Prioritization is an engineering and product responsibility. The CEO sets outcomes and their relative importance; the company translates that into Task-level priority. The CEO does not hand-order the Task queue.

---

## 11. Decomposition

Decomposition is how large intentions become executable work. It is owned by the Tech Lead and governed by one hard rule: **a Task must be completable within a single working day.**

The decomposition chain:

```
Initiative → Project → Feature → Task → Subtask
```

Rules:

- **If a Feature cannot be split into day-sized Tasks, it is too large** and the scope must be refined with the Product Manager before execution begins. Execution does not start on a Feature with oversized Tasks (see [COMPANY_RUNTIME.md §10](../architecture/COMPANY_RUNTIME.md)).
- **Each Task maps to at least one acceptance criterion.** Decomposition is not arbitrary slicing; every Task must justify itself against the Feature's acceptance criteria.
- **Dependencies are explicit and directed.** A Task may depend on other Tasks (or, in plan terms, other plan items). Circular dependencies are rejected. The selector enforces dependency order at execution time.
- **Subtasks are the engineer's tool, not the company's.** They track granular progress inside a Task and must all be complete before the Task can be `done`.

---

## 12. Progress Tracking

The company tracks where every active work item is without requiring the CEO to chase it. Progress is observable at two granularities.

**Lifecycle status** — the work item's `status` field, as defined in [§6](#6-statuses). This is the coarse, organization-facing view: is this work not started, underway, in review, done, blocked, or cancelled?

**Implementation phase** — for work that flows through the GitHub execution loop, the platform derives a four-phase progress view from the combined state of the Task, its execution session, its pull request, and its review:

| Phase | Derived when |
|---|---|
| `planned` | No session activity yet; ready for an implementation brief |
| `running` | A session is queued/prepared/running, or implementation is recorded with a PR open |
| `reviewed` | The review is approved, or the Task is `in-review`/`done` |
| `merged` | The pull request has merged |

This derived phase exists purely for visibility — it does not drive the lifecycle. The lifecycle is driven by status transitions and the gate-advancement service. Progress reporting to the CEO is at meaningful boundaries (a phase completing), never per-Subtask or per-commit (see [COMPANY_RUNTIME.md §25](../architecture/COMPANY_RUNTIME.md)).

When an execution session completes, the system moves its Task to `in-review` — but only if the Task is not already `done`, `cancelled`, or `in-review`. A failed session leaves the Task in `todo` so it can be retried; the system never auto-advances a Task to `done` on a session result alone.

---

## 13. Review Rules

When a work item reaches `in-review`, it must clear two ordered gates before completion. This is the single most important quality property of the Work Item System: **no Task reaches `done` without a recorded approved review and passing QA.**

The gate-advancement behavior is autonomy-aware (see the autonomy policy referenced in [COMPANY_RUNTIME.md §18](../architecture/COMPANY_RUNTIME.md)):

**Review gate:**

- If no Review exists for the Task, one is created in `pending` status with a generated review brief, and a `review_requested` timeline entry is written.
- At autonomy levels that do **not** permit automated review, the gate **stops**: a `decision` notification is raised to the CEO ("Approval needed: review") and the Task stays `in-review` as a "needs CEO action" item. The CEO approves or rejects from the Inbox.
- At autonomy levels that **do** permit automated review, the review is recorded as `approved` through the same service the human path uses (`recordReviewResult`), which also creates the pending QA item.
- A Review in `changes_requested`, `blocked`, or `needs_clarification` is **not advanceable** — the gate refuses to proceed and the work routes back for resolution.

**QA gate (only after review is approved):**

- A QA Result is ensured to exist (`pending`). A QA checklist is generated from the work context (acceptance criteria, review findings, files changed, and the standard validation commands: `npx tsc --noEmit`, `npm run lint`, `npm run test`).
- At autonomy levels that do **not** permit automated QA, the checklist is attached, a `qa_requested` timeline entry is written, a CEO checkpoint is raised once, and the Task stays `in-review` for a human decision.
- At autonomy levels that **do** permit automated QA, the generated checks are marked passed and the result is recorded as `passed` through `recordQaResult` — the same service the human path uses.

When both gates clear, the Task becomes `done`. **Same code, same gates, same artifacts at every autonomy level — the only difference is whether a gate pauses for a human or is driven automatically.** A gate is never skipped.

---

## 14. Completion Rules

A work item is `done` only when all of the following are true. Partial completion is not completion.

- [ ] Implementation is complete and recorded (an execution session result or a manual transition moved the Task to `in-review`).
- [ ] A Review exists and is `approved` (recorded through `recordReviewResult`).
- [ ] A QA Result exists and is `passed` (recorded through `recordQaResult`).
- [ ] The Task's Definition of Done is satisfied (canonical invariant).
- [ ] All Subtasks are complete (canonical invariant).

The completion artifacts are durable: the Review and QA Result persist as company records linked to the Task (`entityType: "task"`, `entityId: <taskId>`), and timeline entries record the gate transitions. "Done" is therefore **auditable** — the company can always show *why* a Task is complete, not merely that someone marked it so.

The CEO sees completion as a plain-language outcome ("your authentication feature has passed code review and QA and is now done"), never as raw review findings or QA check rows (see [COMPANY_RUNTIME.md §25](../architecture/COMPANY_RUNTIME.md)).

---

## 15. Archival and Cancellation

Work items are never deleted. They are completed, cancelled, or retained as history.

**Cancellation:**

- A Task may be moved to `cancelled` explicitly. Cancellation is a deliberate act, not silent abandonment.
- Cancelling a *Feature or Project* requires CEO input; cancelling an individual *Task* may be initiated by the Tech Lead (e.g., a scope change made it unnecessary) — see [COMPANY_RUNTIME.md §32](../architecture/COMPANY_RUNTIME.md).
- A `cancelled` work item **retains its full history**. The record, its Subtasks, any Review or QA artifacts, and its timeline are preserved.

**Archival:**

- Completed work items are not removed. A `done` Task remains queryable as part of the company's record and as input to the executable-task selector (a `done` plan-item unblocks the Tasks that depended on it).
- When work is cancelled *after* significant effort, a memory record is written explaining what was built, what decisions were made, and why it was cancelled — so future work in the area benefits.

The principle: **the company's record of work is append-only.** Status changes; history does not disappear.

---

## 16. Inputs and Outputs

**Inputs that produce or modify work items:**

| Input | Effect |
|---|---|
| CEO Outcome | Seeds a plan that, when approved and applied, creates Projects/Features/Tasks |
| Approved & applied PlanningDraft | Creates Task records carrying plan-item identity |
| Direct creation (against a Project) | Creates a single Task, ownership-scoped to the company |
| Execution session result | Moves a Task to `in-review` (on success) or leaves it `todo` (on failure) |
| Review verdict | Advances or blocks the review gate |
| QA verdict | Advances or blocks the QA gate |
| CEO checkpoint decision | Resumes a paused gate via the real review/QA services |

**Outputs a work item produces:**

| Output | Purpose |
|---|---|
| Review record | Durable evidence of code review and its verdict |
| QA Result record | Durable evidence of validation and its verdict |
| Timeline entries | `review_requested`, `qa_requested`, gate transitions — the work item's audit trail |
| Notifications | CEO checkpoints (`decision` type) when a gate pauses |
| Memory records | What was built and decided, written at completion |
| Status transitions | The observable progress of the work |

---

## 17. Relationship to SOPs

The Work Item System defines *what a work item is and how it moves*. The SOPs define *the detailed procedure each phase follows*. They are complementary: the system is the noun, the SOP is the verb.

| Lifecycle phase | Governing SOP |
|---|---|
| Feature → Task decomposition and the full feature path | [NEW_FEATURE.md](../sops/NEW_FEATURE.md) |
| Defect-driven work items | [BUG_FIX.md](../sops/BUG_FIX.md) |
| Review gate | [CODE_REVIEW.md](../sops/CODE_REVIEW.md) |
| QA gate | [QA_VALIDATION.md](../sops/QA_VALIDATION.md) |
| Shipping completed work | [RELEASE.md](../sops/RELEASE.md) |
| Reverting a shipped change | [ROLLBACK.md](../sops/ROLLBACK.md) |

A work item does not invent its own procedure. When a Task enters the review gate, the Reviewer follows [CODE_REVIEW.md](../sops/CODE_REVIEW.md); when it enters QA, the QA Engineer follows [QA_VALIDATION.md](../sops/QA_VALIDATION.md). The Work Item System guarantees the *sequence and the gates*; the SOPs guarantee the *quality of each step*.

---

## 18. Responsibility Rules

These rules are non-negotiable. They encode the organizational principles ("one owner," "responsibility before authority," "documentation is engineering") into the behavior of work items.

1. **One owner at all times.** A work item without a clear owner is an organizational defect.
2. **The Tech Lead owns decomposition and assignment.** Engineers execute; they do not self-assign or silently re-scope.
3. **The CEO owns outcomes and gate approvals, never execution.** No Task creation, assignment, code review, or test running by the CEO.
4. **Gates are owned by quality roles and cannot be bypassed.** A Reviewer's blocking finding stops the merge; a QA No-Go stops completion. Overriding a quality block requires CTO-level authority and is permanently recorded (see [COMPANY_RUNTIME.md §16](../architecture/COMPANY_RUNTIME.md)).
5. **Every consequential transition is recorded.** A status change that is not reflected in the work item's record and timeline did not happen, from the company's perspective.
6. **Ownership scoping is enforced.** A work item, its assignee, and its parent always belong to the same company; cross-company references are rejected at creation and assignment.
7. **Escalation, not silence.** An owner who cannot proceed surfaces a blocker rather than letting the work item stall invisibly (see [§20](#20-failure-modes)).

---

## 19. Memory Updates

A work item that completes without teaching the company anything has wasted its most valuable byproduct. Closing a work item is also a learning act.

When a Task completes, the company records:

- **Feature Memory** — what the work delivered, the problem it solved, acceptance criteria as shipped (noting deviations), and key decisions made during the work (Product Manager).
- **Architectural decisions** — any direction chosen, alternatives rejected, and future considerations (Tech Lead).
- **Quality patterns** — new approved security or QA patterns introduced, recorded by the relevant role.

When a Task is **cancelled after significant effort**, a memory record captures what was built and why it was abandoned, so the area is not re-explored blindly later.

Memory rules (per [COMPANY_RUNTIME.md §22](../architecture/COMPANY_RUNTIME.md)):

- Memory records are written in plain language any employee can understand.
- A decision that supersedes prior memory links to the record it replaces rather than contradicting it silently.
- The work item is not considered complete from a learning standpoint until its memory is updated.

---

## 20. Failure Modes

The Work Item System is designed to make failure visible and recoverable, never hidden.

**A work item stalls silently.**
An owner is stuck but does not surface it; the Task sits in `in-progress` with no movement. *Response:* a blocker is recorded explicitly (what is blocking, who owns resolution, timeline impact) and the Task moves to `blocked`. The Tech Lead reassigns the engineer to unblocked work or escalates a blocker that outlasts a working day to the CTO (see [COMPANY_RUNTIME.md §30](../architecture/COMPANY_RUNTIME.md)).

**A Task is marked `done` without clearing its gates.**
This is the failure the system most aggressively prevents. *Response:* completion flows only through `recordReviewResult` and `recordQaResult`, which require an approved review and a passing QA result. A direct status write to `done` is an integrity violation; the supported path is the gate-advancement service.

**A gate pauses and nobody notices.**
At lower autonomy a gate stops for a CEO decision; if the CEO never sees it, the work stalls. *Response:* pausing a gate raises a `decision` notification once, surfaces the item in the Inbox as "needs your approval," and reflects it in the sidebar bell and dashboard counts. The checkpoint is actionable from the Inbox, resuming through the real services.

**An oversized Task is accepted.**
A Task that cannot finish in a day was not decomposed. *Response:* the Feature is sent back to the Product Manager for scope refinement; execution does not begin on oversized Tasks.

**A session result over-advances a Task.**
A completed execution session could naively flip a Task to `done`. *Response:* a session result moves a Task only to `in-review` (and only if it is not already `done`/`cancelled`/`in-review`); a failed session leaves it `todo` for retry. The runtime never skips review and QA on the strength of a session result.

**Work loses its lineage.**
A Task whose origin is unknown cannot be prioritized or learned from. *Response:* plan-applied Tasks carry `planningDraftId` + `planItemId`; direct Tasks are scoped to a Project. The selector relies on this lineage to honor dependencies and avoid re-running completed work.

---

## 21. Implemented Today vs. Designed

Per the project's hard rule against fabricated capability, this section separates what the running platform does **today** from what is **designed** but not yet fully built.

**Implemented today (grounded in code):**

- Task, Subtask, Project, Feature, Sprint, and Milestone records exist in the schema, with company-scoped ownership and plan-item traceability (`planningDraftId` + `planItemId`).
- Direct Task creation with ownership scoping, Feature/assignee validation, and a status enum of `todo`, `in-progress`, `in-review`, `done`, `blocked`, `cancelled`.
- Executable-task selection over approved/applied plans, honoring plan-item dependencies; only `todo` Tasks are selectable.
- Execution-session result ingestion that moves a Task to `in-review` on success (guarded against `done`/`cancelled`/`in-review`) and leaves it `todo` on failure.
- A gate-advancement service that drives the review gate then the QA gate, autonomy-aware: pausing with a CEO checkpoint at lower autonomy, driving automatically at higher autonomy, and **never** bypassing either gate. Completion always flows through `recordReviewResult` and `recordQaResult`.
- A derived four-phase GitHub workflow view (`planned` → `running` → `reviewed` → `merged`) for progress visibility.
- Timeline entries (`review_requested`, `qa_requested`) and CEO `decision` notifications on gate pauses, surfaced in the Inbox.

**Designed / planned (not fully implemented):**

- The full canonical status set, including distinct `backlog` and `in_qa` states (today `backlog` is conceptual and `in_qa` is folded into `in-review`).
- Field-level Definition-of-Done checklists and `maps_to_ac` enforcement on every Task (the canonical invariants in [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md) are stricter than the current schema enforces).
- Role-based creation/assignment authority (today these are gated by company ownership, not by the Tech Lead role specifically).
- Subtask status beyond a `completed` boolean, and Subtask-gated completion enforcement.
- Acceptance-criteria-derived QA checklists wired end to end (the checklist generator accepts acceptance criteria, but the gate path currently passes an empty set pending the Specification).

Real-AI behavior on work items remains deliberately gated behind [Engineering OS Specification v1.0](../architecture/COMPANY_RUNTIME.md); the deterministic, gated behavior described above is the current, intentional state.

---

## 22. Relationship to Other Documents

- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)** — the authoritative object shapes, fields, and invariants for Task, Subtask, Project, Feature, Sprint, Milestone, and Task Status. This system document references those definitions rather than restating them.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — the lifecycle, state transitions, gates, escalation, and CEO interaction model that this system operates within.
- **[GITHUB_WORKFLOW_FOUNDATION.md](../architecture/GITHUB_WORKFLOW_FOUNDATION.md)** — how a work item's implementation reaches GitHub as commits and pull requests.
- **[TECHNICAL_ARCHITECTURE.md](../architecture/TECHNICAL_ARCHITECTURE.md)** — the modules that implement the behaviors described here.
- **[SOPs](../sops/)** — the phase-by-phase procedures ([NEW_FEATURE.md](../sops/NEW_FEATURE.md), [BUG_FIX.md](../sops/BUG_FIX.md), [CODE_REVIEW.md](../sops/CODE_REVIEW.md), [QA_VALIDATION.md](../sops/QA_VALIDATION.md), [RELEASE.md](../sops/RELEASE.md), [ROLLBACK.md](../sops/ROLLBACK.md)) that act on work items.
