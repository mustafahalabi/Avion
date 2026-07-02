# Communication System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

---

This document defines how the virtual company communicates. It specifies how employees collaborate with each other, how work status is reported, how questions and blockers are raised, how issues escalate to the correct authority, and how the CEO is kept informed without being exposed to implementation detail.

Communication is not a feature layered on top of the company — it is the connective tissue that lets a multi-role organization behave as one coherent system. Every collaboration, review, escalation, and status change is a communication event. This document specifies the rules those events follow.

This document has two layers, kept explicitly separate throughout:

- **Implemented today** — behavior the platform genuinely ships, grounded in the codebase (`apps/web/src/lib`, `apps/web/src/app/actions`, `apps/web/prisma/schema.prisma`).
- **Designed / planned** — behavior specified in [`COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md) and the organizational documentation that is not yet implemented.

Where this document overlaps with the [Company Runtime](../architecture/COMPANY_RUNTIME.md), the Runtime owns the canonical state-machine and event definitions; this document owns the communication rules — what is said, by whom, to whom, in what form, and what reaches the CEO.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Communication Principles](#3-communication-principles)
4. [Communication Types](#4-communication-types)
5. [The Company Communication Format](#5-the-company-communication-format)
6. [Communication Surfaces (Implemented Today)](#6-communication-surfaces-implemented-today)
7. [Direct Employee Collaboration](#7-direct-employee-collaboration)
8. [Status Update Rules](#8-status-update-rules)
9. [Routing Rules](#9-routing-rules)
10. [Escalation Rules](#10-escalation-rules)
11. [CEO Summaries — What Reaches the CEO](#11-ceo-summaries--what-reaches-the-ceo)
12. [Notification Rules (Implemented Today)](#12-notification-rules-implemented-today)
13. [Timeline and Event Records](#13-timeline-and-event-records)
14. [Approval Checkpoints as Communication](#14-approval-checkpoints-as-communication)
15. [Memory Updates](#15-memory-updates)
16. [Anti-Patterns](#16-anti-patterns)
17. [Failure Modes](#17-failure-modes)
18. [Implemented vs Designed — Summary](#18-implemented-vs-designed--summary)
19. [Relationship to Other Documents](#19-relationship-to-other-documents)

---

## 1. Purpose

The Communication System answers a single question: **how does information move through the company so that the right employee acts at the right time and the CEO sees only what requires their attention?**

It exists to enforce three outcomes:

1. **Coherence.** Employees act on the same facts. A decision made by one employee is visible to the next employee who needs it. No two employees hold contradictory understandings of the same work.
2. **Traceability.** Every consequential communication produces a durable record. Verbal coordination without a written artifact does not exist in the company. A decision that is not recorded did not happen.
3. **CEO attention discipline.** The company generates a large volume of internal communication. Only a small, deliberately filtered fraction reaches the CEO. The CEO is presented with outcomes and decisions, never with implementation chatter.

The Communication System is not a chat product. It is the set of rules and the durable artifacts through which a role-based organization coordinates itself.

---

## 2. Scope

**In scope:**

- Communication between employees (collaboration, hand-offs, review feedback, defect routing).
- Status reporting as work advances through its lifecycle.
- Questions, clarifications, blockers, and escalations.
- Decisions and the record they produce.
- All CEO-facing communication: notifications, timeline entries, approval requests, and summaries.
- The structured format every recommendation and escalation follows.

**Out of scope:**

- The work lifecycle and its gates — owned by [`COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md) and the SOPs.
- The objects communication references (Task, Review, QAResult, Release) — owned by [`DOMAIN_MODEL.md`](../architecture/DOMAIN_MODEL.md).
- How the CEO views communication surfaces in the UI — owned by [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md).
- The execution engine's internal model prompts. Employees never communicate "as a model"; they communicate as roles producing durable company artifacts.

---

## 3. Communication Principles

These principles are permanent. They constrain every other rule in this document.

- **Communication produces artifacts.** A collaboration that produces a decision creates a record. Engineering OS does not recognize undocumented coordination.
- **Communication is scoped to need.** Employees retrieve and produce communication relevant to the work at hand. The company does not broadcast everything to everyone.
- **The CEO receives outcomes, not mechanics.** A notification that reads "PR #442 was approved after 3 blocking findings" has failed. "Your authentication feature passed review and is now in QA" has succeeded.
- **Authority routes communication, not volume.** Escalations and decisions flow to the employee who holds the authority to act, not to whoever is loudest or most available.
- **One question at a time.** When the company needs CEO input, it asks one focused question with a default where reasonable. It never asks the CEO to choose between implementation options.
- **Communication never bypasses ownership.** The employee who owns a work item remains accountable even when others contribute to it.
- **Best-effort signalling never blocks work.** CEO notifications and timeline entries are emitted as a side effect of state changes; their failure must never fail the underlying work (this is enforced in code — see §12, §13).

---

## 4. Communication Types

Engineering OS recognizes a fixed set of communication types. Each has a defined producer, audience, and durability.

| Type | Producer | Audience | Durability | Status |
|---|---|---|---|---|
| **Request** | CEO | Company (routed to first receiver) | Durable (`RuntimeRequest`, `Message`) | Implemented |
| **Notification** | Runtime / services | CEO | Durable, dismissible (`Notification`) | Implemented |
| **Timeline entry** | Runtime / services | CEO (and audit) | Durable, immutable (`TimelineEntry`) | Implemented |
| **Runtime event** | Runtime / CEO actions | Audit / per-request log | Durable (`RuntimeEvent`, `Event`) | Implemented |
| **Review finding** | Reviewer | Author + Tech Lead | Durable (`Review.findings`, `ChangeRequest`) | Implemented |
| **QA result** | QA Engineer | Tech Lead + Release Manager | Durable (`QAResult`) | Implemented |
| **Approval request** | Runtime (autonomy gate) | CEO | Durable + actionable (pending `Review`/`QAResult`) | Implemented |
| **Recommendation** | Any employee | The deciding authority | Durable | Partial (see §5) |
| **Escalation** | Any employee | The next authority up the chain | Durable | Designed |
| **Inter-employee comment / decision record** | Any employee | Specific employees | Durable (`Comment`/`Decision`) | Designed (no model yet) |
| **Status update** | Owning employee | Tech Lead / CEO summary | Durable | Partial |

The distinction between **Notification** (something the CEO may need to act on or be aware of, now) and **Timeline entry** (an immutable record of something that happened) is foundational and is enforced by separate models and separate writers.

---

## 5. The Company Communication Format

Every recommendation, escalation, and approval request follows the company's structured communication format. This format is the single most important discipline in the Communication System: it forces the producing employee to express judgment, not just opinion, and it gives the receiving authority everything needed to decide.

The format has six fields, in order:

| Field | What it states |
|---|---|
| **Recommendation** | What the employee recommends doing. A clear, single proposed action — not a menu. |
| **Reasoning** | Why this recommendation. The basis in evidence, memory, and the company's decision framework. |
| **Risks** | What could go wrong — both with the recommendation and with the alternatives. |
| **Alternatives** | The other options considered and why they were not chosen. |
| **Confidence** | How certain the employee is (high / medium / low). |
| **Next action** | What the receiver must decide, approve, or do. |

**Rules:**

- An escalation that omits the format is incomplete and is returned to the sender. The format is what converts "I'm stuck" into a decidable proposal.
- The format is used **up** the authority chain (recommendation to a higher authority) and **out** to the CEO (approval requests). It is not used for routine implementation chatter between peers.
- The employee who loses a decision records their objection inside the format's record. The objection is preserved, never erased.

> **Implemented today (partial).** The CEO-facing next-action recommender (`apps/web/src/lib/next-action-recommendation.ts`) already emits a structured object per recommendation — `{ title, reason, priority, confidence, href, cta }`. This maps directly onto four of the six fields: `title` → **Recommendation**, `reason` → **Reasoning** (a one-sentence grounding in workspace state), `confidence` → **Confidence**, and `cta`/`href` → **Next action**. The two remaining fields — explicit **Risks** and **Alternatives** — are not yet generated because plan and recommendation generation is deterministic/templated by design (no AI before the models are specified). The full six-field format on every employee escalation is **designed**, and is documented here as the target contract.

---

## 6. Communication Surfaces (Implemented Today)

These are the real, shipping channels through which communication flows. Each is a Prisma model plus the services that write it.

### 6.1 Conversations and Messages

`Conversation` and `Message` (`apps/web/prisma/schema.prisma`) back the CEO request-intake chat. The CEO states an outcome in natural language; `sendMessage` (`apps/web/src/app/actions/chat.ts`) persists the message, creates the `Outcome`, and seeds a planning draft. A `Message` carries `role` (default `user`), `content`, `type`, and an optional `requestId` linking it to the originating `RuntimeRequest`. This is the CEO → company channel.

### 6.2 Notifications

`Notification` is the CEO's attention channel. It carries `title`, `body`, a `type` (`info` | `warning` | `alert` | `decision` | `progress` | `blocker`), a `priority` (`low` | `medium` | `high` | `urgent`), an optional `entityType`/`entityId`, an `actionUrl`, and `read`/`readAt`. All notifications are created through `notify()` / `notifyInTx()` (`apps/web/src/lib/notify.ts`) so the shape stays uniform. Surfaced at `/notifications` (with mark-read / mark-all-read actions in `apps/web/src/app/actions/notifications.ts`), on the sidebar bell, and on the dashboard "Pending approvals" card.

### 6.3 Timeline and Events

`TimelineEntry` (`entityType`, `entityId`, `eventType`, `summary`, `actorId`, `metadata`) is the immutable history of what happened. `Event` and `RuntimeEvent` are lower-level audit logs — `RuntimeEvent` records per-request transitions with an `actor` (e.g. `"CEO"`) and a `description`. Timeline writers live in `review-service`, `qa-service`, `gate-advancement-service`, `planning-draft-service`, `plan-application-service`, `release-candidate-service`, and `outcome-planning-lifecycle`. Every writer is best-effort and wrapped so a failed write never fails the work.

### 6.4 Reviews and Change Requests

`Review` carries a `verdict`, free-text `notes`, `changeRequestNotes`, and a JSON `findings` array of `{ severity, description, actionable }`. `ChangeRequest` records a `reason`, `requestedBy`, `resolution`, and `resolved` flag. This is the Reviewer → author communication channel, recorded durably and gating the task lifecycle.

### 6.5 QA Results

`QAResult` carries `status`, `passedCount`, `failedCount`, `notes`, and a JSON `checks` array. The QA Engineer's go/no-go judgment is expressed here. A `failed` verdict raises an `alert` notification (`apps/web/src/app/actions/quality.ts`).

### 6.6 Inbox and Approval Queue

The Inbox (`/inbox`) is the CEO's action surface. It lists incoming requests and — critically — pending approval checkpoints (see §14), each with Approve / Reject controls wired to `apps/web/src/app/actions/approvals.ts`.

---

## 7. Direct Employee Collaboration

Employees collaborate **directly** with each other. Collaboration never routes through the CEO and never requires the CEO's knowledge.

**Established collaboration patterns** (from [`COMPANY_RUNTIME.md` §12](../architecture/COMPANY_RUNTIME.md#12-employee-collaboration)):

- **Backend → Frontend.** Backend publishes the API contract before Frontend implements against it.
- **Engineering → Security.** A security-relevant pattern is reviewed with the Security Engineer *during* implementation, not after.
- **QA → Engineering.** QA routes a defect to the assigned engineer through the Tech Lead — never to the CEO.
- **Reviewer → Author.** The Reviewer communicates findings directly to the author; the Tech Lead is informed; the CEO is never in the loop.
- **Technical Writer → Engineering.** Documentation begins during implementation, coordinated directly with the relevant engineer.

**Collaboration boundaries:**

- Employees respect each other's domain. A Reviewer does not make architecture decisions in review comments; a QA Engineer does not propose implementations.
- Every collaboration that produces a decision produces a written record.
- Employees never communicate through hidden model sessions or transient channels. All inter-employee communication takes the form of durable company artifacts the runtime can route and reference across sessions.

> **Implemented today.** The Reviewer → author channel (`Review` + `ChangeRequest`) and the QA → Tech Lead channel (`QAResult`) are real and gate the lifecycle. **Designed:** a general-purpose `Comment` / `Decision` record for arbitrary inter-employee collaboration does not yet exist as a model — today, direct collaboration is expressed through the typed review/QA artifacts above. The broader durable-comment substrate is part of the Engineering OS Specification v1.0 work.

---

## 8. Status Update Rules

Status is communicated as work advances, but at the right altitude for each audience.

- **Phase-level, not task-level, for the CEO.** The CEO is informed at phase boundaries (request received, brief ready for approval, blocked, complete) — not on individual task completions. This is enforced by the notification call sites in `apps/web/src/app/actions/runtime.ts`, which fire on request status transitions, not on every internal step.
- **Immediate, not deferred, for the Tech Lead.** A progress concern is communicated the moment it is known, not at the end of a sprint. If an estimate is at risk, the owning employee surfaces it before the deadline passes.
- **Status is pulled as well as pushed.** The CEO can ask for status at any time and receives a plain-language summary of where any work item currently sits in its lifecycle. The company holds the continuity so the CEO never has to.
- **Long-running work reports at phase boundaries.** Work spanning multiple sessions writes a record at each phase boundary, not only at final completion, so state survives across sessions.

> **Implemented today.** Request-level status transitions (`awaiting_approval`, `blocked`, `complete`) each emit a typed notification, and the next-action recommender (§5, §11) computes a live, prioritized status summary from real workspace counts (pending approvals, failed/stalled executions, blocked work, ready/running sessions). **Designed:** narrative phase summaries authored per feature.

---

## 9. Routing Rules

Routing decides which employee receives a communication first.

**Request routing (implemented).** Incoming CEO requests are routed by type via `REQUEST_ROUTING` (`apps/web/src/lib/request-routing.ts`):

| Request type | First receiver |
|---|---|
| `feature` | Product Manager |
| `bug` | Tech Lead |
| `architecture` | CTO |
| `security` | Security Lead |
| `documentation` | Technical Writer |
| `configuration` | DevOps Lead |
| `performance` | Tech Lead |
| `question` | Company |

When a request is created, the runtime records the assignee and notifies the CEO that the request was "Routed to {assignee}. Team is reviewing." (`apps/web/src/app/actions/runtime.ts`).

**Routing principles:**

- **Ambiguity routes up, not sideways.** A request that cannot be classified with confidence routes to the CTO for interpretation rather than being acted on under a silent assumption.
- **Conflicts route before action.** A request that contradicts existing memory or a prior decision surfaces the conflict before planning begins.
- **Defects route through the Tech Lead.** QA never routes a defect directly to an engineer without the Tech Lead in the path; the Tech Lead owns sequencing.

---

## 10. Escalation Rules

Escalation routes a decision that exceeds an employee's authority to the authority that holds it. Escalation is organizational discipline, not failure.

**An employee escalates when** the decision changes product scope, changes system architecture, accepts security risk, proceeds past a Quality block, requires choosing between valid approaches above the employee's level, puts company values in conflict, or involves an external/legal concern.

**An employee does NOT escalate** for routine implementation choices, minor scope clarifications, technical approaches within approved architecture, QA test-case selection, or documentation structure.

**Escalation paths:**

```
Engineering employee → Tech Lead → CTO → CEO
Product employee     → Product Manager → CTO → CEO
Operations employee  → Release Manager → CTO → CEO
Security employee    → Security Engineer → CTO → CEO
```

**Escalation rules:**

- Every escalation uses the [company communication format](#5-the-company-communication-format) — recommendation, reasoning, risks, alternatives, confidence, next action.
- The CEO is the final escalation point and never receives an escalation that a lower authority could have resolved.
- **Quality and Security hold authority.** A QA No-Go stops a release; a Blocking review finding stops a merge; a Security hold cannot be overridden by implementation preference. Only a CTO-level override proceeds past a Quality block, and the override is recorded permanently.
- Conflicts are resolved by authority, not consensus. The dissenting employee's objection is preserved in the record.

> **Implemented today.** Quality/Security gating is enforced in code — no task reaches `done` without an approved `Review` and a passing `QAResult`, and a sub-threshold autonomy gate halts the task as a pending checkpoint (see §14). The full escalation-as-formatted-artifact chain across employee roles is **designed** and depends on the employee runtime.

---

## 11. CEO Summaries — What Reaches the CEO

The defining discipline of the Communication System is the filter between internal company traffic and the CEO. The CEO interacts with the company at a small number of points; everything else is handled internally.

**Reaches the CEO:**

| Reaches the CEO | Mechanism (today) |
|---|---|
| A request was received and routed | `info` notification |
| A feature brief / plan is ready for approval | `decision` notification, Inbox item |
| A review or QA checkpoint needs the CEO's decision | `decision` notification, Inbox Approve/Reject |
| Work is blocked and needs CEO attention | `blocker` notification (`urgent`) |
| Changes were requested on a review | `alert` notification |
| QA failed | `alert` notification |
| A request completed | `progress` notification (`low`) |
| The recommended next action and overall company status | Next-action recommender (dashboard) |

**Does NOT reach the CEO:**

- Individual task completions.
- Raw review findings, change-request text, or defect detail.
- Internal employee-to-employee collaboration.
- Routine QA test-case creation and staging deployments.
- Branch names, commit hashes, PR numbers, file paths, or any implementation mechanic.

**Content rules for CEO communication:**

- Plain organizational language. No jargon, no internal process references.
- Every CEO-facing message contains only what the CEO needs to act on or understand it.
- Approval requests state, in order: what is requested, why it needs CEO approval, what happens if approved, what happens if rejected, who recommends it and why, and how long it can wait.
- The CEO is never asked to choose between implementation options. The CEO is presented with outcomes.

---

## 12. Notification Rules (Implemented Today)

Notifications are created exclusively through `notify()` / `notifyInTx()` so every notification has a consistent shape and a single audit point. The mapping from company event to notification is real and lives at the following call sites:

| Trigger | Type | Priority | Source |
|---|---|---|---|
| New request created and routed | `info` | `medium` | `apps/web/src/app/actions/runtime.ts` |
| Request → `awaiting_approval` | `decision` | `high` | `apps/web/src/app/actions/runtime.ts` |
| Request → `blocked` | `blocker` | `urgent` | `apps/web/src/app/actions/runtime.ts` |
| Request → `complete` | `progress` | `low` | `apps/web/src/app/actions/runtime.ts` |
| Review/QA checkpoint paused (autonomy gate) | `decision` | `high` | `apps/web/src/lib/gate-advancement-service.ts` |
| Changes requested on a review | `alert` | `high` | `apps/web/src/app/actions/quality.ts` |
| QA failed | `alert` | `high` | `apps/web/src/app/actions/quality.ts` |

**Rules:**

- **Notifications are best-effort.** The checkpoint notifier (`notifyCheckpoint`) is wrapped in a try/catch and explicitly comments that "Notifications are best-effort" — a failed notification never fails the gate transition.
- **Every notification carries an `actionUrl`** so the CEO can navigate straight to the thing that needs them (`/inbox`, `/work/quality/...`, `/inbox/requests/...`).
- **`read`/`readAt` track attention.** The unread set drives the sidebar bell count and the dashboard pending-approvals card.
- **Notifications are scoped to the company owner.** Checkpoint notifications resolve the company's `ownerId` and address the CEO directly.

---

## 13. Timeline and Event Records

The timeline is the company's immutable narrative; events are its audit log. Together they make the company legible after the fact.

- **`TimelineEntry`** records that something happened — e.g. `review_approved`, planning applied, a release prepared. Each entry has a plain-language `summary` and structured `metadata`. Entries are immutable: they record what happened, not current state.
- **`RuntimeEvent`** records per-request transitions with an `actor` and `description` (e.g. a CEO advancing a request). **`Event`** is the generic company event log.
- **Timeline writes are best-effort.** `writeTimelineEntry` in `gate-advancement-service` is wrapped so a timeline failure never fails gate advancement. The same discipline applies across the review, QA, planning, plan-application, and release services.

**Timeline content rules:**

- Written in plain language for the CEO.
- Reference the underlying work item, but never expose file names, commit hashes, or branch names.
- Immutable — corrections are new entries, never edits.

> **Designed.** A unified, fully CEO-facing timeline view that merges domain timeline entries across all work streams into a single narrative feed is partially present (planning timeline is surfaced on the outcome page) and is expected to grow with the CEO Control Center.

---

## 14. Approval Checkpoints as Communication

An approval checkpoint is the most consequential CEO-facing communication: the company pauses real work and asks the CEO to decide.

**How it works (implemented, `apps/web/src/lib/approval-checkpoints.ts`):**

- At sub-threshold autonomy, the gate-advancement service halts a task at a review or QA gate instead of auto-advancing. The pause is **persisted** as a pending `Review` or `QAResult` row whose task is still `in-review`.
- `listPendingCheckpoints(companyId)` reads those rows as the CEO's "needs your decision" queue (reviews before QA, newest first). `countPendingCheckpoints` feeds the sidebar bell and Inbox badge.
- A `decision` notification fires when the pause occurs (§12).
- The CEO acts from the Inbox. `approveReviewCheckpointAction` records an `approved` verdict and resumes the flow (creating the pending QA step); `rejectReviewCheckpointAction` records `changes_requested` and sends the task back to implementation; `approveQaCheckpointAction` marks the stored checks passed and records a `passed` verdict.
- Every approval resolves **through the real review/QA services** (`recordReviewResult`, `recordQaResult`), so no gate is bypassed: QA approval is still gated on an approved review.

This is the embodiment of the principle that the CEO approves what leaves the company. The same code path drives manual and driver-initiated flows; only the autonomy level decides whether a checkpoint pauses for the CEO or advances automatically.

---

## 15. Memory Updates

Communication feeds the company's memory; it does not evaporate when a message is read.

- **Decisions become memory.** Every significant decision is recorded as a Decision Record so future work inherits it (designed; see [`COMPANY_RUNTIME.md` §15](../architecture/COMPANY_RUNTIME.md#15-decision-making)).
- **Reviews and QA results are durable.** They persist beyond the task that produced them and inform future review and QA patterns.
- **Timeline entries are permanent.** They are never deleted, even for cancelled work — a cancelled item retains its full communication history.
- **Superseded records link forward.** When a new decision deviates from prior memory, the prior record is superseded and linked, not contradicted or erased.
- **Objections are preserved.** When an employee loses a conflict, their dissent is retained inside the decision record.

> **Implemented today.** `Memory` / `MemoryRecord` and `Knowledge` / `KnowledgeRecord` models exist and are written by the planning and quality flows; `TimelineEntry` provides the permanent communication history. A dedicated `Decision` record model is **designed** — today, decisions are captured implicitly through reviews, QA results, and timeline metadata.

---

## 16. Anti-Patterns

**The CEO firehose.** Forwarding every internal event to the CEO as a notification. This destroys the attention filter that makes the CEO experience tolerable. The fix is the §11 filter: phase-level and decision-level only.

**Implementation detail in a CEO message.** A notification or timeline summary that mentions a PR number, branch name, or commit hash. The CEO communicates in outcomes; the company communicates back in outcomes.

**Verbal coordination.** A decision reached "in conversation" with no artifact. From the company's perspective it did not happen. Every consequential communication produces a record.

**Escalation without the format.** "This is blocked, what should I do?" is not an escalation — it is an abdication. An escalation states a recommendation, its reasoning, the risks, the alternatives, a confidence level, and the next action required.

**Asking the CEO to pick an implementation.** Presenting the CEO with two technical approaches and asking them to choose. The CEO is presented with outcomes and decisions that require CEO authority, never with engineering options.

**Bypassing a gate by talking around it.** Treating a notification or comment as approval. A checkpoint is resolved only through the real review/QA services (§14); chat does not advance a gate.

**Letting signalling block work.** Making a gate transition depend on a notification or timeline write succeeding. These are best-effort by design; coupling them to the work path is a regression.

---

## 17. Failure Modes

### A notification fails to send

The CEO does not learn that a checkpoint is waiting because the notification write failed. **Response:** notifications are best-effort and must never block the underlying state change (enforced via try/catch at the call sites). The pending checkpoint still persists as a `Review`/`QAResult` row and still appears in `listPendingCheckpoints`, so the Inbox and badge surface it even if the notification was lost. The durable queue, not the notification, is the source of truth.

### The CEO is over-notified into ignoring notifications

Too many low-value notifications train the CEO to dismiss the bell, so a genuine `decision` or `blocker` is missed. **Response:** the §11 filter and the typed priority scale exist precisely to prevent this. Routine internal events do not generate notifications; only the events in §12 do. Priority (`urgent` for blockers, `high` for decisions, `low` for completions) lets the surface rank attention.

### A decision is made but not recorded

An employee resolves a conflict or chooses an approach without writing a record. The next employee re-derives or contradicts it. **Response:** communication produces artifacts is a hard principle. A decision without a record is treated as not having been made; the work is returned for documentation.

### A timeline summary leaks implementation detail

A summary written with a commit hash or branch name reaches the CEO. **Response:** timeline content rules (§13) forbid implementation mechanics in CEO-facing text. The test: would the CEO understand it without knowing the codebase? If not, it is rewritten.

### A gate is "approved" through the wrong channel

A checkpoint is treated as resolved because someone acknowledged it informally, rather than through the approval action. **Response:** §14 — approvals resolve only through `recordReviewResult` / `recordQaResult`. QA approval remains gated on an approved review. No informal acknowledgement advances a gate.

### Ambiguous request acted on under a silent assumption

A request that could not be classified is acted on anyway. **Response:** §9 — ambiguity routes to the CTO for one focused clarification before action. The company never applies a silent assumption to an ambiguous request.

---

## 18. Implemented vs Designed — Summary

| Capability | State |
|---|---|
| CEO request intake via conversation/messages | **Implemented** (`Conversation`, `Message`, `chat.ts`) |
| Typed CEO notifications with priority + action URL | **Implemented** (`Notification`, `notify.ts`) |
| Notification surfaces: page, bell count, dashboard card | **Implemented** |
| Immutable timeline + audit events | **Implemented** (`TimelineEntry`, `Event`, `RuntimeEvent`) |
| Reviewer → author communication | **Implemented** (`Review`, `ChangeRequest`) |
| QA go/no-go communication | **Implemented** (`QAResult`) |
| Approval checkpoints as a CEO decision queue | **Implemented** (`approval-checkpoints.ts`, `approvals.ts`) |
| Request routing by type | **Implemented** (`REQUEST_ROUTING`) |
| Quality/Security gating (no `done` without review + QA) | **Implemented** |
| Structured next-action recommendation (4 of 6 format fields) | **Implemented (partial)** (`next-action-recommendation.ts`) |
| Full six-field communication format on every escalation | **Designed** |
| General inter-employee `Comment` / `Decision` records | **Designed** (no model yet) |
| AI-authored CEO summaries / narrative status | **Designed** (deterministic today, by rule) |
| Cross-stream unified CEO timeline feed | **Designed (partial)** |

Per the project's hard rule, no AI-authored communication is added before the company, employee, and decision models are specified in **Engineering OS Specification v1.0**. The deterministic surfaces above are deliberate, not placeholders.

---

## 19. Relationship to Other Documents

- [`COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md) — owns the work lifecycle, runtime states, escalation paths, notification rules, and event definitions that this document's communication rules operate within. Sections [§12](../architecture/COMPANY_RUNTIME.md#12-employee-collaboration), [§17](../architecture/COMPANY_RUNTIME.md#17-escalation-rules), [§18](../architecture/COMPANY_RUNTIME.md#18-approval-requests), [§24](../architecture/COMPANY_RUNTIME.md#24-timeline-updates), and [§25](../architecture/COMPANY_RUNTIME.md#25-notification-rules) are the canonical sources this document elaborates.
- [`DOMAIN_MODEL.md`](../architecture/DOMAIN_MODEL.md) — defines `Notification`, `TimelineEntry`, `Review`, `QAResult`, `Message`, and the other objects communication references.
- [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) — defines how the CEO views these communication surfaces (Inbox, Notifications, Timeline, Dashboard).
- [`TECHNICAL_ARCHITECTURE.md`](../architecture/TECHNICAL_ARCHITECTURE.md) — defines the modules and services that emit the communications described here.
- [`SOP: Release`](../sops/RELEASE.md) and the other SOPs — define the phase-by-phase procedures whose hand-offs and notifications this system carries.
- [`COMPANY_OPERATING_SYSTEM.md`](../company/COMPANY_OPERATING_SYSTEM.md) — defines the decision frameworks and authority model that the communication format and escalation rules enforce.
