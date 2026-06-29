# Approval System

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

---

The Approval System defines when Engineering OS pauses to ask a human for an explicit decision, who is entitled to make that decision, what an approval actually means, and how every approval is recorded. It is a governance system, not a workflow step. The company is designed to run itself; approval is the deliberate exception where the company stops and waits.

This document has two layers, kept visibly distinct throughout:

- **Implemented today** — behavior the platform enforces in code right now. Grounded in `src/lib/autonomy-policy.ts`, `src/lib/approval-checkpoints.ts`, `src/lib/gate-advancement-service.ts`, `src/lib/worker-permissions.ts`, `src/lib/plan-application-service.ts`, `src/app/actions/approvals.ts`, and the Prisma schema.
- **Designed / planned** — organizational behavior specified by the company documentation that is not yet (or only partially) enforced in code. Grounded in [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) and the SOPs.

Where the two disagree, the implemented layer is authoritative for what the software does today, and the designed layer is authoritative for where it is going.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Core Principle: Approval Is Exceptional](#3-core-principle-approval-is-exceptional)
4. [Approval Types](#4-approval-types)
5. [The Autonomy Gate](#5-the-autonomy-gate)
6. [Approval Lifecycle](#6-approval-lifecycle)
7. [Approvers and Authority](#7-approvers-and-authority)
8. [Approval Criteria](#8-approval-criteria)
9. [When Approval Can Be Skipped](#9-when-approval-can-be-skipped)
10. [Escalation Rules](#10-escalation-rules)
11. [Approval Records](#11-approval-records)
12. [Memory Updates](#12-memory-updates)
13. [Notifications](#13-notifications)
14. [Failure Modes](#14-failure-modes)
15. [Implementation Status Summary](#15-implementation-status-summary)
16. [Relationship to Other Documents](#16-relationship-to-other-documents)

---

## 1. Purpose

The Approval System exists to answer one question consistently across the entire company: **may this action proceed without a human deciding first?**

Engineering OS performs software development autonomously — it plans, implements, reviews, validates, and ships. For that autonomy to be safe, the company must have a single, shared definition of which actions are too consequential to take without explicit human consent at the current trust level, and a reliable mechanism to pause, surface the decision, and resume once a human acts.

The Approval System provides:

1. **One authorization source.** The same policy decides authorization for the manual path (a human clicking a button) and the autonomous path (the driver advancing work on a loop). The two paths never diverge.
2. **A durable pause.** When approval is required, the work item halts in a persisted state until a human acts. Closing the app does not lose the decision.
3. **A truthful resume.** Approval resumes work through the real review, QA, and release services. No gate is bypassed by approving — approval only authorizes the company to continue down the normal path.
4. **A complete record.** Every approval and rejection is attributable, timestamped, and traceable to the work it authorized.

---

## 2. Scope

**In scope:**

- Authorization of agentic actions that touch (or move toward touching) real code: preparing a session, running the agent, pushing, opening a pull request, merging, and driving automated review/QA sign-off.
- Review and QA gate checkpoints that pause a task for a human verdict.
- Plan approval — approving or rejecting a generated planning draft before it becomes real work records.
- The autonomy-level policy that determines, per company, which of the above require approval.
- The records, notifications, and escalation behavior that surround an approval.

**Out of scope:**

- The mechanics of *how* a review, QA validation, or release is performed. Those are owned by [CODE_REVIEW.md](../sops/CODE_REVIEW.md), [QA_VALIDATION.md](../sops/QA_VALIDATION.md), and [RELEASE.md](../sops/RELEASE.md). The Approval System gates entry to those flows; it does not define them.
- The pre-push guardrail (protected paths, protected branches, denied commands). Guardrails are *always on* and independent of autonomy — they are not approvals and cannot be approved away. See [GITHUB_WORKFLOW_FOUNDATION.md](../architecture/GITHUB_WORKFLOW_FOUNDATION.md).
- General notification routing, which is owned by the Company Runtime ([COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md), §25).

This document is intentionally free of tool-specific assumptions. It refers to "the agent" and "the execution engine," never to a particular CLI or model. Execution engines are replaceable; the Approval System's behavior does not depend on which one is used.

---

## 3. Core Principle: Approval Is Exceptional

**Approval is the exception, not the default.** A company that asks for approval on every action is not autonomous — it is a remote control. The CEO hires an engineering organization precisely so they do not have to approve branch names, pull requests, task breakdowns, or test runs.

Three rules follow from this principle and are enforced by the design:

1. **Autonomy sets the baseline, not the action.** Whether an action needs approval is decided by the company's autonomy level, set once, not by re-asking per action. A company at `delegate` proceeds through implementation, push, PR, review, and QA without a single checkpoint; only a merge pauses.
2. **The CEO sees outcomes, not mechanics.** An approval request is phrased organizationally ("this feature is awaiting your review decision"), never as raw diffs, commit hashes, or command lists. If a checkpoint cannot be described in plain language, it is not ready to surface.
3. **Silence is not approval — but neither is approval the norm.** A required checkpoint blocks until a human acts. But the system is tuned so that, at normal operating autonomy, those checkpoints are rare and meaningful. A flood of approval requests is a signal that the autonomy level is set too low for how the company is being used.

The default company autonomy level is **`assist`** (`CompanySettings.autonomyLevel @default("assist")`). At `assist`, the company prepares and pushes work freely but pauses before running the agent and before merging — a deliberate middle ground while trust is being established.

---

## 4. Approval Types

Engineering OS recognizes five approval types. Each corresponds to a class of decision with a distinct owner in the organizational model. The table marks how much of each is enforced in code today.

| Approval Type | Decides | Authority (designed) | Status |
|---|---|---|---|
| **CEO approval** | Whether the company may proceed with a goal, a plan, or a gated agentic action | CEO | **Implemented** — autonomy checkpoints, plan approval, review/QA checkpoints |
| **CTO approval** | Architecture beyond current bounds; overriding a quality block; accepting technical risk | CTO | **Designed** — organizational authority defined; resolved by the owner today |
| **Tech Lead approval** | Delivery Readiness — that a body of work is ready to leave implementation for review | Tech Lead | **Designed** — gate exists in the SOP; not a distinct enforced actor |
| **Security approval** | Clearing a security-relevant change; granting a security exception | Security Engineer | **Designed** — blocking authority defined; not a separate enforced gate |
| **Release approval** | Whether validated work may ship to production (merge / deploy) | Release Manager → CEO | **Partially implemented** — `auto_merge` is autonomy-gated; full release checklist is designed |

### 4.1 CEO approval

The CEO is the company's owning authority. CEO approval governs the three things only the CEO should decide: **what** the company works on (the goal), **the plan** that will be executed, and **whether a gated agentic action may proceed** at the current autonomy level. CEO approval is the type the platform enforces most completely today (see §5 and §6).

### 4.2 CTO approval

CTO approval governs decisions that exceed engineering authority but do not require the CEO: changing the system architecture beyond current bounds, accepting technical risk, and — critically — **overriding a quality block** (a QA No-Go or a blocking review finding). Per [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) §16, only a CTO-level override may proceed past a quality block, and the override is recorded permanently. *Designed:* today the single human owner resolves all checkpoints; the CTO is not yet a separately enforced approver identity.

### 4.3 Tech Lead approval

Tech Lead approval is **Delivery Readiness** (Gate 3 in the runtime lifecycle): the Tech Lead confirms that a completed body of work is ready to leave implementation and enter review. It is an internal engineering approval — the CEO is never in this loop. *Designed:* the gate is specified in the runtime and SOPs; in code, a completed session moves a task to `in-review` and the gate is expressed as the review checkpoint rather than a distinct Tech Lead sign-off.

### 4.4 Security approval

Security approval clears a security-relevant change or grants a documented exception to a security policy. The Security Engineer holds **blocking authority**: security concerns are not overridden by implementation preference, and an unresolved security hold escalates to the CTO ([COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) §16). *Designed:* security review is part of the runtime's review cycle; a dedicated, enforced security-approval gate is not yet implemented.

### 4.5 Release approval

Release approval is the decision to ship validated work to users. In the organizational model it is the Release Manager's checklist-gated go/no-go, with CEO authorization required below `autonomous` autonomy ([RELEASE.md](../sops/RELEASE.md)). **Partially implemented:** the merge step (`auto_merge`) is gated by the autonomy policy — denied at `manual`/`suggest`, approval-required at `assist`/`delegate`, allowed only at `autonomous`. The full Release Readiness Checklist is designed and lives in the Release SOP.

---

## 5. The Autonomy Gate

*(Implemented — `src/lib/autonomy-policy.ts`.)*

The autonomy gate is the heart of the implemented Approval System. It maps a company's autonomy level and a proposed agentic action to one of three dispositions:

| Disposition | Meaning |
|---|---|
| `allow` | The action may proceed immediately. No checkpoint. |
| `requires_approval` | The action is permitted, but a CEO approval checkpoint must clear first. |
| `deny` | The action is never permitted at this level. |

### 5.1 The action matrix

Seven agentic actions fall under the gate. The matrix below is the single source of truth consulted by both the manual server actions and the autonomous driver, guaranteeing identical decisions for identical inputs.

| Action | manual | suggest | assist | delegate | autonomous |
|---|---|---|---|---|---|
| `create_session` — prepare/queue a session | approval | allow | allow | allow | allow |
| `run_agent` — start the agent on the repo | approval | approval | approval | allow | allow |
| `push` — push the session branch | approval | approval | allow | allow | allow |
| `open_pr` — open a pull request | approval | approval | allow | allow | allow |
| `auto_merge` — merge without human review | deny | deny | approval | approval | allow |
| `auto_review` — automated review sign-off | approval | approval | approval | allow | allow |
| `auto_qa` — automated QA sign-off | approval | approval | approval | allow | allow |

Rationale, by level:

- **manual** — a human performs each step; every agent action is gated and merges are never automated.
- **suggest** — the agent may prepare work freely, but running, pushing, and opening a PR are gated; merges are never automated.
- **assist** *(default)* — the agent executes with a confirmation gate before running; push and PR proceed; merge, review, and QA sign-off stay gated.
- **delegate** — supervised: everything proceeds, including automated review/QA, except auto-merge, which is gated.
- **autonomous** — fully automated, including auto-merge, still within the always-on guardrails.

Unknown or missing autonomy values normalize to **`manual`** — the safest level — by `normalizeAutonomyLevel`.

### 5.2 The single evaluation seam

Two functions express the entire gate:

- `authorizeAutonomyAction(level, action)` → an `AutonomyDecision` carrying `allowed` and `requiresApproval` flags plus a human-readable reason.
- `evaluateAutonomyCheckpoint({ level, action, context, hasApproval })` → a `CheckpointOutcome` of `proceed`, `awaiting_approval` (with a freshly created checkpoint), or `blocked`.

The only difference between the manual and autonomous paths is what they pass for `hasApproval`:

- The **manual path** (`src/app/actions/execution.ts`) treats the CEO's click as the approval — it passes `hasApproval: true`, so a `requires_approval` action proceeds, and it refuses only when the level denies the action outright.
- The **autonomous driver** (`src/lib/auto-execution-service.ts`, `gate-advancement-service.ts`) passes the persisted approval state — a `requires_approval` action with no prior approval halts and raises a checkpoint.

This is why the two paths can never authorize differently: they call the same function and differ only in the approval evidence they supply.

---

## 6. Approval Lifecycle

An approval moves through a small, explicit state machine. Two concrete implementations of it exist today.

### 6.1 Checkpoint states

*(Implemented — `src/lib/autonomy-policy.ts`.)*

```
            evaluateAutonomyCheckpoint(requires_approval, no prior approval)
                                   │
                                   ▼
                          awaiting_approval
                          ╱                ╲
            approveCheckpoint        rejectCheckpoint
                  │                        │
                  ▼                        ▼
              approved                 rejected
```

A checkpoint records the autonomy `level`, the `action`, its `status`, decision `context` (task/session id and a one-line summary), and `createdAt` / `resolvedAt` / `resolvedBy`. Resolution is one-shot: `approveCheckpoint` and `rejectCheckpoint` throw if the checkpoint is not still pending, preventing double-resolution.

### 6.2 Review and QA checkpoints

*(Implemented — `src/lib/gate-advancement-service.ts`, `src/lib/approval-checkpoints.ts`, `src/app/actions/approvals.ts`.)*

The most visible approvals are the review and QA gates. When an execution session completes, the task moves to `in-review` and stops. The gate-advancement service then advances it according to autonomy:

- At a level where `auto_review` / `auto_qa` is **allowed** (`delegate`, `autonomous`): the service drives review → QA → `done`, recording an `approved` review and a `passed` QA result automatically.
- At a **sub-threshold** level: the service *requests* the gate — it creates a pending `Review` (or attaches a QA checklist to a pending `QAResult`) — fires a single `decision` notification, and halts. The task stays `in-review`, surfacing as "needs your approval."

The pause is **persisted as the pending row itself**. `listPendingCheckpoints(companyId)` reads pending `Review` and `QAResult` rows whose task is still `in-review` and presents them as the CEO's decision queue; `countPendingCheckpoints` feeds the sidebar bell and inbox badge.

Resolution flows through the real services — approval never fabricates a result:

| CEO action | Effect | Service called |
|---|---|---|
| Approve review | Records an `approved` verdict, which creates the pending QA step | `approveReviewCheckpoint` → `recordReviewResult` |
| Reject review | Records `changes_requested`, sending the task back to implementation | `rejectReviewCheckpoint` → `recordReviewResult` |
| Approve QA | Marks the stored checklist items passed and records a `passed` verdict, completing the task | `approveQaCheckpoint` → `recordQaResult` |

Crucially, `recordQaResult` independently re-checks that an **approved review exists** before it will mark QA passed — "QA cannot pass without an approved review for this task." Approving the QA checkpoint authorizes the company to proceed; it does not let it skip the review gate.

### 6.3 Plan approval

*(Implemented — `src/lib/plan-application-service.ts`.)*

A generated planning draft is a proposal, not work. It must be approved before it becomes real Project / Feature / Task records. `approvePlanningDraft` and `rejectPlanningDraft` are **idempotent**: re-approving an already-approved draft is a no-op, an already-applied draft reports `already_applied`, and illegal transitions (approving a rejected draft, rejecting an approved one) throw. Approval and rejection stamp `approvedAt` / `approvedById` or `rejectedAt` / `rejectedById` / `rejectionReason` on the `PlanningDraft` and write a timeline entry. Rejection creates **no work records** — the draft is recorded as rejected and the company waits for new direction.

---

## 7. Approvers and Authority

**Implemented today:** there is a single human approver — the company **owner**, acting as CEO. Server actions resolve the company by `ownerId`, refuse when unauthenticated, and record resolutions as "Approved by CEO." All checkpoint types (autonomy, review, QA, plan) are resolved by this one identity.

**Designed:** approval authority is distributed across roles, and an approver may only resolve approvals within their authority (from [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) §15–18):

| Decision class | Approver (designed) |
|---|---|
| Goal, plan, gated agentic action, production release (below `autonomous`) | CEO |
| Architecture beyond bounds, technical risk, quality-block override | CTO |
| Delivery Readiness (work ready to leave implementation) | Tech Lead |
| Security clearance / exception | Security Engineer |
| Release go/no-go | Release Manager (CEO authorizes below `autonomous`) |

The governing rule is constant across both layers: **conflicts are resolved by authority, not consensus**, and an approval that exceeds the approver's authority is escalated rather than granted (see §10).

---

## 8. Approval Criteria

An approver is being asked a real question, not rubber-stamping. The criteria below define what a sound approval considers.

**Autonomy-gated agentic action (CEO):**
- Is the autonomy level appropriate for this action, or is the checkpoint a sign the level is mis-set?
- Does the action move real code (push, PR, merge) in a way the CEO is willing to authorize now?

**Plan approval (CEO):**
- Does the plan match the intended outcome in scope and non-scope?
- Are the risks, assumptions, and dependencies acceptable?
- Approval authorizes the plan to become real work; rejection (with a reason) sends it back without creating records.

**Review approval (CEO today; Reviewer designed):**
- Does the work satisfy the task's acceptance criteria — not merely "does it run"?
- Are there blocking findings that must be resolved before the work proceeds?

**QA approval (CEO today; QA Engineer designed):**
- Have the checklist items genuinely passed?
- Is there an approved review on record? (Enforced — QA cannot pass without it.)

**Release / merge approval:**
- Is the change validated (review approved, QA passed) and within guardrails?
- At `assist` / `delegate`, a merge is a deliberate, gated decision; at `autonomous` it proceeds within guardrails.

A common thread: **approval authorizes the company to continue down the normal path; it never authorizes skipping a step.** The review, QA, and release services re-verify their own preconditions regardless of how the approval arrived.

---

## 9. When Approval Can Be Skipped

Approval is exceptional, so the system is explicit about when it is *not* required. An action proceeds without a checkpoint in exactly these cases:

1. **The autonomy level `allow`s the action.** Per the matrix in §5.1, most actions are `allow`ed at `delegate` and all are at `autonomous`. This is the primary, intended way approval is skipped — by raising trust, set once, rather than by overriding per action.
2. **A prior approval already exists for this action.** `evaluateAutonomyCheckpoint` proceeds when `hasApproval` is true. On the manual path the CEO's own initiating click is that approval (e.g. a CEO-initiated session preparation is the human-supplied approval for the `create_session` checkpoint).
3. **The change set is within the worker's approval threshold.** The worker permission profile declares `requiresApprovalAbove` — the file count above which a change set must request approval (20 at `assist`/`execute`, 40 at `full`). A change set at or below the threshold proceeds without a per-change-set approval (`src/lib/worker-permissions.ts`).

Approval **cannot** be skipped in these cases:

- The autonomy level **`deny`s** the action (e.g. `auto_merge` at `manual`/`suggest`). A denied action is blocked outright — there is no checkpoint to approve, and raising autonomy is the only path.
- The action would violate an **always-on guardrail** (protected branch, protected path, denied command). Guardrails are not approvals and cannot be waived by approving; a blocked run fails the session with the offending paths recorded.
- A downstream service's **precondition is unmet** (e.g. QA passing without an approved review). Approving the QA checkpoint does not satisfy the review precondition; the service refuses.

---

## 10. Escalation Rules

Escalation is how a decision that exceeds an approver's authority reaches the correct authority. It is organizational discipline, not failure. The implemented system surfaces the decision and waits; the designed routing distributes it.

**Implemented today:**
- A sub-threshold checkpoint fires a `decision` notification (priority `high`) to the company owner with a deep link to the inbox, then waits. Counts surface on the sidebar bell, the inbox badge, and a dashboard "Pending approvals" card.
- A denied action returns its blocking reason to the caller rather than proceeding.

**Designed (from [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) §17 and the SOPs):**

| Situation | Escalates to | Trigger |
|---|---|---|
| Quality block (QA No-Go / blocking review) override requested | CTO | Before any override decision; override recorded permanently |
| Security hold unresolved at the employee level | CTO | When Security Engineer authority cannot clear it |
| Architecture change beyond current bounds | CTO → CEO | When the change exceeds engineering authority |
| Release delay crossing a sprint boundary | CTO, CEO | When the delay is significant |
| Any decision requiring CEO authority | CEO | Final escalation point |

The escalation format is structured: recommendation, reasoning, risks, alternatives, confidence, and the specific next action the receiver must decide. The CEO never receives an escalation that could have been resolved at a lower level, and is never asked to choose between implementation options — only between outcomes.

---

## 11. Approval Records

Every approval and rejection is durable and attributable. Nothing important is decided verbally — a decision that is not recorded did not happen.

| Record | Where | What it captures |
|---|---|---|
| Autonomy checkpoint | In-memory `ApprovalCheckpoint` (level, action, context) raised by the policy seam | The pending decision, its status, and `resolvedBy` / `resolvedAt` |
| Review checkpoint | `Review` row (`status`, `verdict`, `notes`, `findings`) | The review verdict and notes; "Approved by CEO." / change-request notes |
| QA checkpoint | `QAResult` row (`status`, `checks`, `passedCount` / `failedCount`, `notes`) | The QA verdict and the per-item check results |
| Plan approval | `PlanningDraft` (`approvedAt` / `approvedById`, `rejectedAt` / `rejectedById`, `rejectionReason`) | Who approved/rejected, when, and why |
| Timeline entry | `TimelineEntry` (`review_requested`, `review_approved`, `qa_requested`, plan approved/rejected, …) | Plain-language history of the gate transition |
| Notification | `Notification` (`type: "decision"`, priority `high`) | The "needs your approval" item the CEO acted on |

Records are written so the company can answer, after the fact, *who authorized this and on what basis* — which is exactly what a quality-block override or a post-incident review needs.

---

## 12. Memory Updates

Approvals feed the company's learning loop. The records above are the raw material; the company is designed to distill them into memory.

**Implemented today:** approvals and rejections write `TimelineEntry` rows and stamp the originating records, providing a complete, queryable history of decisions.

**Designed (from [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) §22–23):**
- A rejected plan or a change-requested review should produce a memory record of *why*, so the same proposal is not re-generated identically.
- A quality-block override should be recorded as a Decision Record, with the objection preserved.
- Repeated approval friction at a given level is a calibration signal: it should inform the recommended autonomy level for the company.

The principle: an approval is a decision, and decisions accrue to memory so the company gets better at knowing when to ask.

---

## 13. Notifications

*(Implemented — `src/lib/gate-advancement-service.ts` via `notify`.)*

When a sub-threshold gate pauses, the company notifies the owner exactly once, when the checkpoint is first raised — not on every driver loop. The notification:

- Uses `type: "decision"`, priority `high`.
- Is phrased organizationally: `"{task} is awaiting your review decision."` — never raw findings or diffs.
- Deep-links to `/inbox`, where the **Approve / Reject** controls resume the flow through the real services.

Notification delivery is best-effort: a missing notification surface never breaks gate advancement. Routing of notifications generally is the Company Runtime's responsibility ([COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) §25).

---

## 14. Failure Modes

### Approval used to bypass a gate
A CEO approves a QA checkpoint to "just ship it," expecting approval to skip the review that has not happened. **Response:** approval authorizes continuation, never skipping. `recordQaResult` independently requires an approved review; approving QA on a task with no approved review fails. The services re-verify their own preconditions regardless of how the approval arrived.

### Guardrail mistaken for an approval
An action is blocked by a protected-path or protected-branch guardrail and someone looks for an "approve anyway" button. **Response:** guardrails are not approvals. There is no checkpoint to clear — the run fails with the offending paths recorded. Guardrails are independent of autonomy and cannot be waived by approving. See [GITHUB_WORKFLOW_FOUNDATION.md](../architecture/GITHUB_WORKFLOW_FOUNDATION.md).

### Autonomy level set too low for how the company is used
Every action raises a checkpoint; the CEO is buried in approvals and approval becomes a reflex rather than a decision. **Response:** a flood of checkpoints is a signal, not a workflow. The fix is to raise the autonomy level (set once) — not to approve faster. Approval is meant to be exceptional; if it is constant, the trust setting is wrong.

### Manual and autonomous paths diverging
A future change makes the driver authorize an action the manual path would have gated (or vice versa). **Response:** both paths call the same `authorizeAutonomyAction` / `evaluateAutonomyCheckpoint`, differing only in the `hasApproval` evidence they supply. Any new agentic action must be added to the action matrix and routed through this seam — never gated ad hoc in a caller.

### Double-resolution of a checkpoint
A checkpoint is approved twice (e.g. a double click, or a stale UI). **Response:** `approveCheckpoint` / `rejectCheckpoint` throw if the checkpoint is not still pending; plan approval is idempotent and reports `already_approved` / `already_applied`. Re-resolution cannot silently re-fire the authorized action.

### Quality-block override left unrecorded
A QA No-Go or blocking review is overridden under deadline pressure with no record of who authorized it. **Response (designed):** only a CTO-level decision may proceed past a quality block, and the override is recorded permanently alongside the original recommendation. "The team felt the risk was acceptable" is not a documented decision (see [RELEASE.md](../sops/RELEASE.md)).

### Unattributed approval
An approval is recorded with no actor. **Response:** server actions refuse when unauthenticated, resolve the company by owner, and stamp the resolver. A checkpoint without a `resolvedBy` is, by construction, still pending.

---

## 15. Implementation Status Summary

| Capability | Status | Source |
|---|---|---|
| Autonomy action matrix (5 levels × 7 actions) | Implemented | `src/lib/autonomy-policy.ts` |
| Single authorization seam for manual + driver | Implemented | `autonomy-policy.ts`, `execution.ts`, `auto-execution-service.ts` |
| Checkpoint lifecycle (awaiting → approved/rejected, one-shot) | Implemented | `autonomy-policy.ts` |
| Review checkpoint (pause, surface, approve/reject) | Implemented | `gate-advancement-service.ts`, `approval-checkpoints.ts`, `approvals.ts` |
| QA checkpoint (pause, surface, approve) with review precondition | Implemented | `gate-advancement-service.ts`, `qa-service.ts` |
| Plan approval / rejection (idempotent) | Implemented | `plan-application-service.ts` |
| Worker change-set approval threshold | Implemented (declared) | `worker-permissions.ts` |
| `decision` notifications + inbox/dashboard surfacing | Implemented | `gate-advancement-service.ts` |
| Role-distributed approver identities (CTO, Tech Lead, Security, Release Manager) | Designed | [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) |
| Quality-block override as a recorded CTO decision | Designed | [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md), [RELEASE.md](../sops/RELEASE.md) |
| Full Release Readiness Checklist gate | Designed | [RELEASE.md](../sops/RELEASE.md) |
| Approval-derived memory records | Designed | [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) §22–23 |

---

## 16. Relationship to Other Documents

- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — defines approval requests, escalation, autonomy gates, and CEO interaction points at the organizational level (§15–18, §25, §35). The Approval System is the implemented, action-level expression of that behavior.
- **[GITHUB_WORKFLOW_FOUNDATION.md](../architecture/GITHUB_WORKFLOW_FOUNDATION.md)** — defines the always-on pre-push guardrails that sit *beneath* approvals and cannot be approved away.
- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)** — defines the `Review`, `QAResult`, `PlanningDraft`, `CompanySettings`, and `Notification` objects whose lifecycles approvals drive.
- **[CODE_REVIEW.md](../sops/CODE_REVIEW.md)** and **[QA_VALIDATION.md](../sops/QA_VALIDATION.md)** — define the review and QA procedures that a checkpoint gates entry to.
- **[RELEASE.md](../sops/RELEASE.md)** — defines the Release Readiness Checklist and the QA No-Go override authority that release approval governs.

---

*This is an internal company system document. It describes governance behavior, not implementation tooling. Execution engines are replaceable; the Approval System's behavior does not depend on which one is used.*
