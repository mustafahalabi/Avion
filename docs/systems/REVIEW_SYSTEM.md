# Review System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

The Review System is how Engineering OS judges whether work is good enough to advance. It evaluates work quality across code, plans, and — by design — architecture, security, documentation, QA evidence, and release readiness. It is the company's quality conscience: the mechanism that prevents work from reaching `done` on the strength of an agent's own assertion that it is finished.

This document describes a real subsystem. Where behavior is implemented in the codebase today it is marked **Implemented today**; where it is specified by the organization but not yet built it is marked **Designed**. Inventing capability the platform does not have would violate a hard project rule, so the two are kept strictly separate (see [Section 12](#12-implementation-status)).

This document does not describe AI orchestration, prompts, or model selection. It describes how the company evaluates quality.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Review, Testing, and Approval Are Distinct](#3-review-testing-and-approval-are-distinct)
4. [Review Types](#4-review-types)
5. [Owners and Participants](#5-owners-and-participants)
6. [Inputs](#6-inputs)
7. [Outputs — What a Useful Review Produces](#7-outputs--what-a-useful-review-produces)
8. [Review Lifecycle](#8-review-lifecycle)
9. [Approval Rules](#9-approval-rules)
10. [Revision Rules](#10-revision-rules)
11. [Escalation Rules](#11-escalation-rules)
12. [Implementation Status](#12-implementation-status)
13. [KPIs](#13-kpis)
14. [Failure Modes](#14-failure-modes)
15. [Relationship to Other Documents](#15-relationship-to-other-documents)

---

## 1. Purpose

The Review System answers one question for every body of work: *is this correct, complete, and safe enough to advance to the next stage?*

It exists because Engineering OS is autonomous. An agent that implements a task also reports that it finished — and a system that trusts that report unconditionally ships whatever the agent produced, including placeholder behavior, unrelated refactors, and failing builds. The Review System is the independent second judgment that the author cannot supply for itself. Without it, "done" means "the agent stopped"; with it, "done" means "a reviewer confirmed the work satisfies its acceptance criteria and a QA gate confirmed the evidence."

The Review System has three responsibilities:

1. **Evaluate** a unit of work against an explicit standard (acceptance criteria, scope, quality, safety).
2. **Classify** every finding so the work either advances, returns for revision, halts, or escalates.
3. **Record** a durable verdict and its findings so the decision is traceable and the company learns from it.

A review is never a formality. A verdict with no findings is permitted only when the reviewer can articulate why the work is clean; an approval that is a reflex rather than a judgment is the single most damaging failure this system can produce (see [Section 14](#14-failure-modes)).

---

## 2. Scope

The Review System governs the evaluation of work products at the gates between lifecycle phases. It covers:

- **Plan review** — the CEO's evaluation of a generated plan before any execution begins.
- **Code / task review** — the evaluation of an implemented task before it can proceed to QA.
- **QA evidence evaluation** — confirming that the recorded test/validation evidence actually clears the completion gate (the Review System owns the gate; the QA System owns the testing itself — see [Section 3](#3-review-testing-and-approval-are-distinct)).
- **Architecture, security, documentation, and release-readiness review** — specified as distinct review types the company performs (see [Section 4](#4-review-types)); the first two are **Designed**, not yet implemented as independent code paths.

The Review System does **not** own:

- **Testing.** Producing and executing test/validation evidence is the QA System's job. Review consumes that evidence; it does not generate it.
- **Approval authority gating.** Whether the *CEO* must personally approve an action is decided by the autonomy policy, not by the reviewer's verdict. The two interact (see [Section 9](#9-approval-rules)) but are separate concerns.
- **Planning.** The Review System judges a plan; it does not write one. Plan generation belongs to the planning engine.
- **Release execution.** The Review System contributes a release-readiness judgment; deployment is owned by the Release Manager and [SOP-005: Release](../sops/RELEASE.md).

---

## 3. Review, Testing, and Approval Are Distinct

These three are routinely conflated and must not be. They answer different questions, are owned by different roles, and are recorded as different artifacts.

| Concern | Question it answers | Owner | Artifact | Backing service |
|---|---|---|---|---|
| **Review** | Is the work correct, in scope, and safe? | Reviewer | `Review` (verdict + findings) | `recordReviewResult` |
| **Testing (QA)** | Does the evidence show it works against acceptance criteria? | QA Engineer | `QAResult` (checks + verdict) | `recordQaResult` |
| **Approval** | Is the CEO authorized to let this proceed at the current autonomy level? | CEO / autonomy policy | Approval checkpoint | `evaluateAutonomyCheckpoint` |

Three rules keep them separate, and all three are enforced in code today:

1. **Review precedes and gates QA.** A QA result cannot reach `passed` unless an approved `Review` exists for the same task. `recordQaResult` throws *"QA cannot pass without an approved review for this task."* Testing without a passed review is not permitted.
2. **A passing review is not completion.** Approving a review does **not** mark the task `done`. It moves the task to `in-review` and creates a *pending* `QAResult`. Completion requires the QA gate to pass afterward.
3. **A clean verdict is not the same as CEO approval.** Even an approved review and a passed QA do not automatically merge a PR or ship a release if the autonomy level requires a CEO checkpoint for that action. The reviewer judges quality; the autonomy policy judges authority.

> A reviewer who "tests" by re-running the build is reading QA evidence, not generating it. A CEO who "reviews" by clicking approve at a checkpoint is exercising authority, not evaluating quality. Keep the verbs attached to the right role.

---

## 4. Review Types

Engineering OS recognizes the following review types. Each has a standard, a primary owner, and a place in the lifecycle.

| Review type | Evaluates | Primary owner | Status |
|---|---|---|---|
| **Plan review** | A generated plan's scope, sequencing, and fitness before execution | CEO (CTO advises) | Implemented today |
| **Code / task review** | An implemented task against its acceptance criteria, scope, and quality | Reviewer | Implemented today |
| **QA-evidence gate** | That recorded checks and validation clear the completion gate | QA Engineer | Implemented today |
| **Security review** | Security-relevant patterns, ownership boundaries, secret handling | Security Engineer | Designed |
| **Architecture review** | Consistency with system architecture and prior decisions | CTO / Tech Lead | Designed |
| **Documentation review** | Accuracy and completeness of user- and developer-facing docs | Technical Writer | Designed |
| **Release-readiness review** | The full checklist that authorizes a production release | Release Manager | Designed (see [SOP-005](../sops/RELEASE.md)) |

**Code / task review** is the center of gravity today. Its evaluation standard is encoded in the review brief the system generates for every completed implementation session — the reviewer must verify each acceptance criterion and confirm, item by item:

- No unrelated refactors or files changed outside the ticket scope.
- No placeholder, stub, or fake behavior introduced.
- No failing validation commands (`tsc`, lint, test, build).
- Code follows existing architecture and coding conventions.
- Security invariants and company ownership boundaries preserved.
- No external AI API calls unless the ticket explicitly requires them.

These checks mean the code/task review already carries a *security-aware* and *scope-aware* dimension even though a dedicated Security Engineer review path is **Designed**, not built. The review brief explicitly forbids approving unrelated refactors, fake behavior, or failing validation.

The detailed phase procedure for code review lives in [SOP-003: Code Review](../sops/CODE_REVIEW.md); this document describes the system that procedure runs on.

---

## 5. Owners and Participants

The Review System spans the Quality department and reaches into Engineering and Operations. The ticket asks specifically how it relates to six roles.

| Role | Relationship to the Review System |
|---|---|
| **Reviewer** | Owns code/task review end to end. Produces the verdict and the classified findings. Accountable for the accuracy of every finding and for not rubber-stamping. Never reviews their own work. |
| **QA Engineer** | Owns the QA gate that *follows* an approved review. Consumes the review's findings as inputs to the QA checklist. Cannot pass QA without an approved review on record. |
| **Security Engineer** | Owns security review (**Designed**). A security block prevents final approval; today the security dimension is partially carried by the code-review checklist line items. |
| **Tech Lead** | Confirms Delivery Readiness before a change enters review and routes change requests back to the implementing engineer when a review requests changes. First escalation point for disputed findings. |
| **CTO** | Owns this system. Final technical escalation authority; the only role that can authorize proceeding past a quality block. Owns architecture review (**Designed**). |
| **Release Manager** | Consumes review and QA verdicts as preconditions for release-readiness. A release cannot be assembled without an approved review and a QA Go on record ([SOP-005](../sops/RELEASE.md)). |

The CEO is a participant only at the points the autonomy level requires: plan approval, and any review/QA/merge checkpoint that the autonomy policy gates. The CEO never reads raw findings — they see the verdict and the plain-language summary (see [COMPANY_RUNTIME.md §19](../architecture/COMPANY_RUNTIME.md#19-review-cycle)).

---

## 6. Inputs

A review is only as good as the context it is given. The system assembles inputs automatically for code/task review.

**Implemented today** — the system builds a **review brief** for each completed implementation session from:

- **Task scope** — task id, title, and description.
- **Acceptance criteria** — extracted from the planning draft or, failing that, the task description.
- **Implementation summary** — what the agent reported it did.
- **Branch and PR metadata** — branch name, base branch, commit SHA, PR URL/number/status.
- **Files changed** — the list of modified paths, used to scope the review and seed QA categories.
- **Validation results** — recorded output of the validation commands.

From these the system generates a **per-criterion checklist** and the quality checklist in [Section 4](#4-review-types). Missing inputs are surfaced explicitly in the brief (for example, *"No acceptance criteria recorded"* or *"No validation output was recorded"*) rather than silently omitted — a reviewer must see the gap, not be misled by its absence.

**Inputs for QA evidence evaluation** include the approved review's notes and findings, the files changed, and the validation commands; these seed the generated QA checklist's functional, regression, security, performance, UX, and validation categories.

---

## 7. Outputs — What a Useful Review Produces

A review's output is a **verdict** plus a set of **classified findings**, persisted on the `Review` record and mirrored to the timeline. A useful review output is specific, classified, and actionable — never a bare thumbs-up.

**The four verdicts (implemented today):**

| Verdict | Meaning | Effect on the task |
|---|---|---|
| `approved` | Acceptance criteria met, no blockers | Task → `in-review`; a pending `QAResult` is created so the QA gate can begin |
| `changes_requested` | One or more blockers must be fixed | A `ChangeRequest` is created per blocker (or one from notes); task → `in-progress` |
| `blocked` | Work cannot proceed at all | Task → `blocked` |
| `needs_clarification` | Reviewer needs an answer before deciding | Task unchanged; review parked pending clarification |

**Findings** are classified by severity — `blocker` or `non_blocker` — with a description and an `actionable` flag. The classification is load-bearing: only `blocker` findings (or, absent structured findings, the review notes) generate `ChangeRequest` records that route the task back to implementation. Non-blocker findings are recorded for acknowledgment but do not gate approval.

**Every verdict emits a timeline entry** — `review_requested`, `review_approved`, `review_changes_requested`, `review_blocked`, or `review_needs_clarification` — giving the CEO a plain-language history without exposing raw findings.

A finding is useful when it states *where* (location), *what* (observation), *why* (reasoning), and *what would resolve it* (suggestion); the finding format is specified in [SOP-003 §Review Output Format](../sops/CODE_REVIEW.md). "The error handling needs work" is not a finding; *"`handlePayment()` swallows all exceptions and returns 200, masking failures from callers"* is.

---

## 8. Review Lifecycle

A code/task review moves through the following states. The lifecycle is enforced by `recordReviewResult`, which refuses to update a review that is already `approved` (a terminal, idempotency-protecting state).

```
(work completed by agent → task: in-review)
        │
        ▼
   review: pending  ──────────────────────────────┐
        │                                          │
        │ reviewer / autonomy records verdict      │
        ▼                                          │
  ┌─────────────┬───────────────────┬───────────┐  │
  │ approved    │ changes_requested │  blocked  │  │ needs_clarification
  ▼             ▼                   ▼           │  ▼ (task unchanged;
 task:in-review task:in-progress   task:blocked │   re-decided later)
 + pending QA   + ChangeRequest(s) └────────────┘
        │
        ▼
   QA gate (see QA System / COMPANY_RUNTIME §20)
        │ requires approved review + all checks passed
        ▼
   task: done
```

**How a review is raised:**

- **Manually** — a Reviewer (or the CEO) creates a `Review` from the task page and submits a verdict through the review verdict form at `/work/quality/[id]`.
- **Automatically by the driver** — when an execution session completes, the task lands at `in-review` and the gate-advancement service raises the review. At autonomy levels that permit automated review it records an approval and proceeds; at lower levels it creates the pending review, fires a `decision` notification to the CEO, and halts at `awaiting_review` (see [Section 11](#11-escalation-rules) and the autonomy interaction in [Section 9](#9-approval-rules)).

The gate-advancement service never bypasses a gate: even the automated path routes through `recordReviewResult` and `recordQaResult`, so the invariants in [Section 3](#3-review-testing-and-approval-are-distinct) hold regardless of autonomy level. The only thing autonomy changes is whether a human must press the button.

**Plan review** has its own short lifecycle: a planning draft is `pending` → `approved` / `rejected`, and approval is idempotent (re-approving an already-approved or already-applied draft is a no-op rather than an error). Approval is the precondition for applying the plan into real Project/Feature/Task records.

---

## 9. Approval Rules

Approval rules govern when a verdict may be recorded and when an approval requires CEO authority on top of the reviewer's judgment.

**Quality-side rules (the reviewer's judgment), implemented today:**

1. A review may be approved only when no blocker findings remain.
2. Approval is terminal: an `approved` review cannot be re-opened or re-decided; a new finding after approval requires a new review.
3. Approval creates the pending QA gate — it does not complete the task.
4. QA cannot pass without an approved review for the same task.
5. QA cannot pass unless every required check has passed; `recordQaResult` throws *"Completion blocked: one or more required QA checks have not passed."* This is why a task cannot reach `done` on assertion alone.

**Authority-side rules (the autonomy policy), implemented today:**

Whether the *automated* path may record a review/QA verdict — or must stop for the CEO — is decided by the autonomy policy, the single source of truth shared by the manual server actions and the autonomous driver. The relevant actions are `auto_review`, `auto_qa`, and `auto_merge`:

| Action | manual | suggest | assist | delegate | autonomous |
|---|---|---|---|---|---|
| `auto_review` | approval | approval | approval | allow | allow |
| `auto_qa` | approval | approval | approval | allow | allow |
| `auto_merge` | deny | deny | approval | approval | allow |

(*approval* = a CEO checkpoint must clear first; *deny* = never automated at this level.)

So at `assist`, an automated review/QA is *gated*: the loop opens a PR and then pauses at `awaiting_review` for the CEO. At `delegate` and `autonomous`, automated review and QA proceed and the task can drive review → QA → `done` with no human checkpoint. `auto_merge` is the most conservative action — never automated below `assist`, gated through `delegate`, and only fully automatic at `autonomous`. These dispositions are produced by `evaluateAutonomyCheckpoint`, which returns `proceed`, `awaiting_approval` (raising a checkpoint), or `blocked`.

When a sub-threshold gate pauses, the checkpoint becomes a *Needs your approval* item in the Inbox with Approve / Reject, fires a `decision` notification, and surfaces on the sidebar bell and dashboard pending-approvals card.

---

## 10. Revision Rules

When a review does not approve, the work must be revised before it can advance. The revision path is mechanical and recorded.

**Implemented today:**

- A `changes_requested` verdict creates a `ChangeRequest` for each blocker finding. If no structured findings were supplied, a single `ChangeRequest` is created from the review notes. Each carries a `reason` and a `requestedBy` (`"Reviewer"`).
- The task is returned to `in-progress`, signaling the implementation step to resume.
- QA findings can also generate change requests: a `failed` QA verdict on a task with an approved review creates `ChangeRequest` records (prefixed `[QA]`, `requestedBy` `"QA"`) and returns the task to `in-progress`. This is how QA defects re-enter the implementation loop without bypassing the review record.
- `ChangeRequest` records carry `resolved` and `resolution` fields so closure is tracked rather than assumed.

**Re-review:** because `approved` is terminal, a revised task produces a *new* review cycle rather than mutating the old verdict. The history of prior verdicts and findings is preserved on the timeline.

**Designed:** the SOP-003 expectation that the reviewer re-reads each blocker's resolution at its specific location (rather than taking "fixed" on faith) is an organizational standard; the system records the verdicts but does not yet enforce per-finding resolution verification.

---

## 11. Escalation Rules

Escalation routes a decision that exceeds a role's authority to the role that holds it. Escalation is discipline, not failure.

**Implemented today:**

- **`blocked` verdict** — the gate-advancement service surfaces a `review_blocked` status and stops; the task sits `blocked` until a human acts. The automated path will not advance a blocked review.
- **Sub-threshold autonomy** — when `auto_review` or `auto_qa` requires approval at the current level, the system halts at `awaiting_review` / `awaiting_qa`, notifies the CEO once (a `decision` notification with a deep link to the Inbox), and waits. This is the routine "escalate to the CEO" path.
- **`needs_clarification` verdict** — parks the review without changing the task, signaling that a question must be answered before a decision is possible.

**Designed (organizational escalation, per [SOP-003](../sops/CODE_REVIEW.md) and [COMPANY_RUNTIME.md §16–17](../architecture/COMPANY_RUNTIME.md#16-conflict-resolution)):**

- A disputed blocker escalates Reviewer → Tech Lead → CTO.
- A security risk beyond the Reviewer's authority escalates to the Security Engineer and CTO; a security block cannot be overridden by implementation preference.
- A quality block (review block or QA No-Go) can only be overridden by a CTO-level decision, which is recorded permanently; the CEO is notified when an override affects a release.
- Quality has blocking authority by design: a No-Go stops a release and cannot be bypassed at the employee level.

---

## 12. Implementation Status

This section is the authoritative separation of what runs today from what the organization has specified. Nothing below is aspirational dressed as real.

**Implemented today (grounded in code):**

| Capability | Where |
|---|---|
| `Review` model with verdict, findings (JSON), change-request notes, plan/task linkage | `apps/web/prisma/schema.prisma` (`Review`, `ChangeRequest`, `QAResult`) |
| Four review verdicts with state-routing side effects | `apps/web/src/lib/review-service.ts` (`recordReviewResult`) |
| Review brief generation (scope, criteria, checklist, decision, reviewer instructions) | `apps/web/src/lib/review-brief.ts` |
| QA gate that requires an approved review and all passing checks before `done` | `apps/web/src/lib/qa-service.ts` (`recordQaResult`) |
| QA checklist generation across functional/regression/security/performance/UX/validation | `apps/web/src/lib/qa-checklist.ts` |
| Autonomy-driven review/QA advancement that never bypasses gates | `apps/web/src/lib/gate-advancement-service.ts` |
| Single autonomy policy (`auto_review` / `auto_qa` / `auto_merge`) + approval checkpoints | `apps/web/src/lib/autonomy-policy.ts` |
| Server actions and UI for verdicts, change requests, QA checklists | `apps/web/src/app/actions/quality.ts`, `apps/web/src/app/(app)/work/quality/**` |
| Plan review (approve/reject, idempotent) and plan application | `apps/web/src/lib/plan-application-service.ts`, `apps/web/src/lib/planning-review-service.ts` |
| Timeline events for every review and QA transition | emitted by the services above |
| Approval checkpoints surfaced in the Inbox, bell, and dashboard | approvals slice (MUS-216) |

**Designed but not yet implemented as independent code paths:**

- A dedicated **Security Engineer** review with its own block authority (today the security dimension lives as checklist line items inside code review and QA).
- A dedicated **Architecture review** owned by the CTO/Tech Lead.
- A **Documentation review** gate owned by the Technical Writer.
- A formal **release-readiness review** object (the checklist is specified in [SOP-005](../sops/RELEASE.md); the release automation produces release candidates and summaries but does not yet enforce the full checklist as review gates).
- Per-finding **resolution verification** on re-review.
- Routing reviews to **distinct reviewer employees** (the `reviewerId` field exists; assignment to specialized reviewer roles is not yet automated).

The reason the implemented surface is deliberately narrow is the project's hard rule: no AI behavior — including specialized AI reviewers — is added before the company, repository, and decision models are specified. The Review System is built to be extended along the **Designed** rows once that specification lands.

---

## 13. KPIs

The Review System is measured on the quality of its judgments, not the volume of approvals.

| KPI | Target | Measured by |
|---|---|---|
| Post-merge blocker rate | <5% — approved changes later found to have blocker-level defects in QA or production | QA + incident records |
| QA-after-review gate integrity | 100% — no task reaches `done` without an approved review and a passed QA | `Review` / `QAResult` records |
| Review turnaround | <1 business day from raised to first verdict | timeline timestamps |
| Change-request closure | Tracked — `ChangeRequest.resolved` set with a `resolution` | `ChangeRequest` records |
| Finding specificity | Findings carry location, observation, reasoning, suggestion | review findings audit |
| Autonomy-gate correctness | 100% — automated review/QA only proceeds where the policy allows | autonomy policy decisions |
| Empty-approval rate | Tracked — approvals with no findings on non-trivial changes warrant audit | `Review` records |

---

## 14. Failure Modes

### Approval without genuine review
The reviewer (human or automated path) approves because the change "looks fine," and a defect the review would have caught reaches QA or production. **Response:** an empty-finding approval on a non-trivial change is a signal to audit, not proof of quality. The review brief explicitly instructs reviewers not to approve automatically, not to approve work outside the ticket scope, and not to approve placeholder behavior or failing validation. The QA gate is the backstop: even a too-generous review cannot complete a task whose checks do not pass.

### Treating the review as the finish line
A passing review is mistaken for completion and the QA gate is skipped. **Response:** the system forbids this — `recordReviewResult` moves an approved task to `in-review` and creates a *pending* QA result; only `recordQaResult` with a passed checklist and an approved review on record can set `done`.

### Testing folded into review
The reviewer regenerates test evidence inside the review instead of consuming the QA System's evidence, blurring ownership and producing un-recorded testing. **Response:** review consumes evidence; QA produces it. The QA checklist and `QAResult` are the only place test evidence is recorded, and review approval is a *precondition* for QA, not a substitute for it.

### Autonomy overrides quality
The automated driver advances a task past a gate the autonomy level should have stopped at. **Response:** both the manual and autonomous paths consult the same `autonomy-policy` and route through the same `recordReviewResult` / `recordQaResult`. There is no second, looser code path; the only difference between a paused and a self-driving loop is the autonomy level, and the guardrails are identical.

### Findings without classification
Findings are written but not marked blocker vs. non-blocker, so the routing logic cannot tell what must be fixed. **Response:** severity classification is required on every finding; only blockers generate change requests and return the task to implementation. An unclassified concern that should block must be recorded as a blocker.

### Silent change requests
A `changes_requested` verdict is recorded but no one acts because the work item never moves. **Response:** the system returns the task to `in-progress` and creates a `ChangeRequest` per blocker; the change request carries an owner (`requestedBy`) and a `resolved` flag so closure is tracked rather than assumed.

---

## 15. Relationship to Other Documents

- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — defines the runtime states (`in_review`, `in_security_review`, `in_qa`), the review cycle (§19), the QA cycle (§20), and the autonomy gates this system enforces.
- **[SOP-003: Code Review](../sops/CODE_REVIEW.md)** — the phase-by-phase procedure for code review, the finding format, and the review quality standards this system runs on.
- **[SOP-004: QA Validation](../sops/QA_VALIDATION.md)** — the testing procedure whose evidence the Review System gates on (and which this document deliberately does not own).
- **[SOP-005: Release](../sops/RELEASE.md)** — the release-readiness checklist that consumes the review and QA verdicts as preconditions; owner of the release-readiness review type.
- **[SOP-002: Bug Fix](../sops/BUG_FIX.md)** — the defect path that reviews and QA also gate.

The Review System is the connective tissue between these: it turns the procedures in the SOPs into recorded, gated verdicts, and it gives the runtime the signals it needs to advance — or stop — every piece of work.
