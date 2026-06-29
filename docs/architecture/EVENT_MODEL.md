# Event Model — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

This document defines how Engineering OS represents significant things that happen inside the company: an outcome submitted, a plan approved, a task assigned, a review requested, QA passed, a release completed, an incident opened, memory updated, a decision recorded. It specifies what an event *is*, who produces it, who consumes it, and how events become the company's timeline, notifications, reporting, and memory.

This document is intentionally implementation-neutral about infrastructure. It defines event *behavior* — categories, schema, lifecycle, producers, consumers, and audit guarantees — without selecting a message broker, queue technology, or streaming platform. Where the live codebase already realizes part of this model, that is recorded explicitly in [§13 Implementation Status Today](#13-implementation-status-today), separated from what is still designed.

This document does not redefine the objects events describe — those live in [DOMAIN_MODEL.md](./DOMAIN_MODEL.md). It does not redefine runtime orchestration — that lives in [COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md). It defines the event layer that connects them.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Event Principles](#2-event-principles)
3. [Event Categories](#3-event-categories)
4. [Conceptual Event Schema](#4-conceptual-event-schema)
5. [Event Naming Convention](#5-event-naming-convention)
6. [Producers and Consumers](#6-producers-and-consumers)
7. [Event Lifecycle](#7-event-lifecycle)
8. [Relationship to the Timeline](#8-relationship-to-the-timeline)
9. [Relationship to Notifications](#9-relationship-to-notifications)
10. [Audit Trail Requirements](#10-audit-trail-requirements)
11. [Support for Memory and Reporting](#11-support-for-memory-and-reporting)
12. [V1 Event List](#12-v1-event-list)
13. [Implementation Status Today](#13-implementation-status-today)
14. [Open Questions](#14-open-questions)
15. [Relationship to Other Architecture Documents](#15-relationship-to-other-architecture-documents)

---

## 1. Purpose and Scope

An event is an immutable, factual record that something happened in the company at a point in time. Events are the company's nervous system: every other surface that needs to know "what happened" — the CEO timeline, the notification system, company reporting, and memory accumulation — derives from events rather than re-deriving facts from mutable state.

Events answer a different question than the domain objects they describe. A `Task` answers *what is the current state of this work item?* A task event answers *what changed, when, and who caused it?* The first is mutable and singular; the second is immutable and accumulates. This separation is deliberate: mutable state is fast to read but loses history; an append-only event record preserves history but is slow to query for "current state." Engineering OS keeps both, and the event layer is the bridge.

**In scope for this document:**

- The principles every event must obey.
- The categories events fall into.
- The conceptual fields an event carries.
- Who produces events and who consumes them.
- The lifecycle from production through consumption to retention.
- How events become Timeline Entries and Notifications.
- The audit-trail guarantees events provide.

**Out of scope:**

- The choice of broker, bus, queue, or stream technology (an infrastructure decision deferred deliberately).
- The orchestration logic that decides *which employee acts next* — that is the Company Runtime's responsibility, defined in [COMPANY_RUNTIME.md §34–§37](./COMPANY_RUNTIME.md#34-runtime-events).
- The object definitions for `Event`, `Timeline Entry`, `Notification`, and `Runtime Event` — those are in [DOMAIN_MODEL.md](./DOMAIN_MODEL.md).

---

## 2. Event Principles

Every event in Engineering OS obeys the following principles. These are non-negotiable invariants; an event surface that violates them is a defect.

1. **Events are immutable.** Once recorded, an event is never edited or deleted. A mistaken event is corrected by a compensating event, not by mutation. This is what makes the event record trustworthy as an audit trail.

2. **Events are factual, not interpretive.** An event records what happened (`review.approved`), not an opinion about it. Interpretation is the job of consumers — the notification system decides whether the CEO should hear about it; reporting decides whether it affects velocity.

3. **Events are past-tense.** An event names a completed fact. `plan.approved`, not `approve.plan`. If it has not happened yet, it is not an event.

4. **Events are self-describing.** An event carries enough context (type, subject, actor, timestamp, and a structured payload) that a consumer can act on it without re-querying the producer. A consumer should never have to ask "what did this mean?"

5. **Events are company-scoped.** Every event belongs to exactly one Company. No consumer ever sees an event from a Company it is not operating on. Cross-company leakage is a security defect.

6. **Events are ordered within a subject.** For a single work item, events are totally ordered by time of occurrence. Across unrelated subjects, only partial ordering is guaranteed.

7. **Producing an event is part of the work, not a side effect.** An execution that completes its task but fails to record the corresponding event has not finished. Event emission is committed together with the state change it describes, so the record and the fact never disagree. (This mirrors the runtime rule in [COMPANY_RUNTIME.md §22](./COMPANY_RUNTIME.md#22-memory-updates): a successful execution without its memory write is not acceptable.)

8. **Events never expose raw implementation detail to the CEO.** An event payload may contain a commit SHA or a branch name for internal consumers, but any CEO-facing surface derived from it (Timeline, Notification) strips those details. The principle from [COMPANY_RUNTIME.md §24](./COMPANY_RUNTIME.md#24-timeline-updates) holds: the CEO reads outcomes, not file names.

---

## 3. Event Categories

Events are grouped into categories by the domain area that produces them. Categories exist so that consumers can subscribe to a meaningful slice of activity (e.g., "all quality events") without enumerating every event type.

| Category | Covers | Primary Domain Owner |
|---|---|---|
| **Intake** | A CEO outcome/request is received, classified, and routed. | Product Manager / Runtime |
| **Planning** | A plan is generated, approved, rejected, or fails to generate; work is applied into real records. | Product Manager / Tech Lead |
| **Work** | Projects, Features, and Tasks are created, assigned, started, blocked, and completed. | Tech Lead |
| **Execution** | An agent session is prepared, started, completes, fails, or needs clarification. | Tech Lead / Execution Engine |
| **Review** | A review is requested, approved, returns changes, is blocked, or needs clarification. | Reviewer |
| **Quality (QA)** | QA passes, fails, is blocked, or needs clarification. | QA Engineer |
| **Release** | A release candidate is created, a release deploys, stabilizes, or rolls back. | Release Manager |
| **Incident** | A production incident is detected, mitigated, resolved, or post-mortemed. | Monitoring Engineer |
| **Decision** | A significant decision is recorded or superseded. | Decision owner (per domain) |
| **Memory & Knowledge** | A memory record is written; a knowledge record is published or deprecated. | Owning employee / Technical Writer |
| **Approval** | An autonomy gate pauses for CEO approval; the CEO approves or rejects. | Runtime / CEO |
| **Repository** | A repository is connected, analyzed, or its analysis becomes stale. | CTO / Tech Lead |

Categories are derived from the event's type name prefix (see [§5](#5-event-naming-convention)); they are not a separate stored field. This keeps the taxonomy in one place — the type name — rather than splitting it across two columns that can drift out of sync.

---

## 4. Conceptual Event Schema

Every event, regardless of category, carries the following conceptual fields. These are described in domain terms, not storage terms — the physical column names and serialization format are an implementation concern.

| Field | Required | Meaning |
|---|---|---|
| **id** | Yes | Globally unique identifier for this single occurrence. |
| **type** | Yes | The past-tense, dot-namespaced name of what happened (e.g., `plan.approved`). Determines category and consumer routing. |
| **occurred_at** | Yes | The UTC instant the fact became true. Drives ordering. |
| **company_id** | Yes | The owning Company. Enforces tenant isolation. |
| **subject_type** | Yes | The kind of object the event is about (`outcome`, `task`, `review`, `release`, …). |
| **subject_id** | Yes | The identity of that object. Together with `subject_type`, locates the event's anchor. |
| **actor** | Yes | Who or what caused the event: an Employee role, the `System`/Runtime, the `Agent` execution engine, or the `CEO`. |
| **summary** | Yes | One plain-language sentence describing the fact, suitable for an internal reader. |
| **payload** | Optional | A structured, type-specific detail object (e.g., the PR URL on an execution event, the verdict on a review event). Opaque to generic consumers; meaningful to the consumers that subscribe to that type. |
| **correlation_id** | Optional | Ties this event to the originating unit of work — typically the outcome/request that began the chain — so a full causal trace can be reconstructed. |

**Schema rules:**

- `payload` is additive. New keys may be introduced over time; consumers must ignore keys they do not recognize. Removing or repurposing a key is a breaking change.
- `summary` is written for an internal company reader, not the CEO. CEO-facing wording is produced by the Timeline and Notification consumers, which re-phrase for outcome language.
- `actor` is a role or system identity, never a raw model/session handle. "Reviewer," "Agent," "System," and "CEO" are valid actors; an internal worker process ID is not.

---

## 5. Event Naming Convention

Event types use a **`category.past_tense_verb`** dot-namespaced form. The prefix before the first dot is the category; the remainder is the specific fact.

```
outcome.submitted
plan.generated
plan.approved
plan.rejected
work.created
review.approved
review.changes_requested
qa.passed
release.deployed
incident.opened
memory.updated
decision.recorded
```

**Naming rules:**

- The prefix is a stable category token (`outcome`, `plan`, `work`, `review`, `qa`, `release`, `incident`, `memory`, `decision`, `approval`, `repository`, `execution`).
- The suffix is always past tense.
- Names are lowercase; multi-word suffixes use `snake_case` after the dot.
- A type name, once published and consumed, is never renamed — a rename is a breaking change to every consumer. A new fact gets a new name.

> **Known inconsistency (tracked in [§14](#14-open-questions)).** The live codebase currently emits *two* conventions: dot-namespaced names from the outcome-planning slice (`outcome.submitted`, `plan.approved`, `work.created`) and `snake_case` names from the review/QA/release/execution services (`review_approved`, `qa_passed`, `release_candidate_created`, `execution_completed`). This document declares the dot-namespaced form canonical; the `snake_case` emitters are to be reconciled to it. Until then, consumers must tolerate both.

---

## 6. Producers and Consumers

Events flow one way: producers emit facts; consumers react. A producer never knows or cares who consumes its events, and a consumer never reaches back into a producer. This decoupling is what lets the company add new reactions (a new report, a new alert) without touching the code that does the work.

### 6.1 Producers

| Producer | Emits |
|---|---|
| **Runtime / Intake** | `outcome.submitted`, routing/intake facts, approval-gate events. |
| **Planning services** | `plan.generated`, `plan.approved`, `plan.rejected`, `plan.failed`, `work.created`. |
| **Tech Lead (work)** | Task/feature/project creation, assignment, blocked, completed. |
| **Execution Engine (Agent)** | `execution.prepared`, `execution.started`, `execution.completed`, `execution.failed`, `execution.needs_clarification`, plus the per-session audit stream (see [§10](#10-audit-trail-requirements)). |
| **Reviewer** | `review.requested`, `review.approved`, `review.changes_requested`, `review.blocked`, `review.needs_clarification`. |
| **QA Engineer** | `qa.passed`, `qa.failed`, `qa.blocked`, `qa.needs_clarification`. |
| **Release Manager** | `release.candidate_created`, `release.deployed`, `release.stable`, `release.rolled_back`. |
| **Monitoring Engineer** | `incident.opened`, `incident.mitigated`, `incident.resolved`. |
| **Any employee** | `decision.recorded`, `memory.updated`. |
| **Technical Writer** | `knowledge.published`, `knowledge.deprecated`. |

### 6.2 Consumers

| Consumer | Reacts by |
|---|---|
| **Timeline** | Translating CEO-relevant events into plain-language [Timeline Entries](#8-relationship-to-the-timeline). |
| **Notification system** | Deciding which events warrant a CEO [Notification](#9-relationship-to-notifications) and at what priority. |
| **Company Runtime** | Evaluating gate conditions and emitting the *next* event that advances a work item ([COMPANY_RUNTIME.md §34](./COMPANY_RUNTIME.md#34-runtime-events)). |
| **Reporting** | Aggregating events into Sprint Progress, Company Health, and QA Summary reports. |
| **Memory** | Capturing decision, lesson, and feature-summary events as durable Memory Records. |
| **Audit / Compliance** | Retaining the complete, ordered event record for traceability. |

**Producer/consumer rules:**

- A single event may have many consumers, or none. Emitting an event no one currently consumes is valid and expected — it preserves history and lets future consumers backfill.
- The Company Runtime is unique in being *both* a consumer and a producer: it consumes a domain event, evaluates gate conditions, and produces the next event in the chain. This is the mechanism by which work advances without employees self-advancing.
- Consumers are idempotent. A consumer that processes the same event twice (e.g., after a retry) produces the same result as processing it once.

---

## 7. Event Lifecycle

An event moves through a small, well-defined lifecycle.

```
produced  →  committed  →  routed  →  consumed  →  retained
```

1. **Produced.** A producer constructs the event as a side product of performing work — completing a review, generating a plan, finishing an execution.

2. **Committed.** The event is persisted atomically with the state change it describes. If the state change rolls back, the event is never recorded; if the event cannot be recorded, the state change does not commit. There is no window in which the fact is true but unrecorded, or recorded but untrue.

3. **Routed.** The event is made available to consumers that subscribe to its type or category. Routing is conceptual here — whether by direct call, in-process dispatch, or an external bus is an [open infrastructure question](#14-open-questions). Today routing is implicit: producers write directly to the Timeline/Notification/Runtime-event records at the call site.

4. **Consumed.** Each interested consumer reacts: the Timeline appends an entry, the notifier may raise an alert, the runtime evaluates the next gate, reporting updates its aggregates. Consumption is idempotent and independent — one consumer failing does not block another.

5. **Retained.** The event is kept for the company's audit and history requirements. Events are never deleted (see [§10](#10-audit-trail-requirements)); session-scoped working signals may expire, but durable company events persist.

**Failure handling:**

- If a consumer fails transiently, its reaction is retried; the source event is unaffected because it is already committed and immutable.
- A failure to *produce or commit* an event fails the underlying operation — the work is not considered done. This is the same standard the runtime applies to memory writes in [COMPANY_RUNTIME.md §33](./COMPANY_RUNTIME.md#33-retry).

---

## 8. Relationship to the Timeline

The Timeline is the CEO's plain-language history of the company. It is a **projection of events**, not a separate source of truth. Every Timeline Entry is derived from one or more events; no Timeline Entry is authored by hand.

| Aspect | Event | Timeline Entry |
|---|---|---|
| Audience | Internal consumers | The CEO |
| Language | Factual, may include internal detail in payload | Plain outcome language, no implementation detail |
| Volume | High — every significant fact | Low — only CEO-relevant milestones |
| Mutability | Immutable | Immutable |
| Authoring | Emitted by producers | Generated by the Timeline consumer |

Not every event becomes a Timeline Entry. The Timeline consumer filters to events the CEO genuinely cares about — a feature shipped, a release deployed, a milestone reached, a significant decision recorded — using the same selection discipline described in [COMPANY_RUNTIME.md §24](./COMPANY_RUNTIME.md#24-timeline-updates). Routine intermediate events (a single file written, a staging deploy) are retained as events for audit and reporting but never surface on the Timeline.

A Timeline Entry references the underlying event(s) and the subject object so the CEO can navigate from "your authentication feature shipped" to the work it summarizes — without ever being shown a commit hash or branch name.

---

## 9. Relationship to Notifications

A Notification is an **attention request** raised to the CEO. Like the Timeline, it is a consumer of events — but where the Timeline is a passive history the CEO browses, a Notification actively asks for awareness or action.

The notification consumer applies a strict filter (per [COMPANY_RUNTIME.md §25](./COMPANY_RUNTIME.md#25-notification-rules)): only a small fraction of events become notifications.

| Event trigger | Notification type | Priority | Action |
|---|---|---|---|
| Autonomy gate pauses for approval (`approval.required`) | `decision` | high | Approve / Reject |
| Outcome submitted / routed (`outcome.submitted`) | `info` | medium | Awareness |
| Review returns changes (`review.changes_requested`) | `warning` | medium | Awareness |
| QA fails (`qa.failed`) | `warning` | high | Awareness |
| Work blocked (`*.blocked`) | `blocker` | urgent | Attention |
| Feature/request completed (`work.completed`) | `progress` | low | Awareness |
| P0/P1 incident opened (`incident.opened`) | `alert` | urgent | Attention |

**Distinctions that must not blur:**

- An **event** is a fact; a **notification** is a decision to interrupt the CEO about that fact. The same event (`qa.failed`) may or may not notify depending on whether the CEO was expecting that release.
- A notification that requires action (`decision`, with Approve/Reject) is resolved by the CEO acting, which itself **produces a new event** (`approval.received` → resumes the work item). This closes the loop: events drive notifications, and acting on a notification emits the next event.
- Notification content obeys the same no-implementation-detail rule as the Timeline. "Your authentication feature passed code review and is now in QA" is a valid notification; "PR #442 approved after 3 blocking findings" is not.

---

## 10. Audit Trail Requirements

The event record is the company's audit trail. For the autonomous engineering loop — where an agent edits a real repository and opens real PRs — the audit guarantees are a safety requirement, not a convenience.

**Requirements:**

1. **Completeness.** Every state-changing operation in a workflow emits a corresponding event. There is no silent gap between what happened and what is recorded. Where a richer event stream is unavailable, a consumer reconstructs an ordered trail from the recorded facts rather than showing nothing — the CEO-facing audit view does exactly this today (see [§13](#13-implementation-status-today)).

2. **Immutability.** Audit events are append-only. They are never edited or removed. A correction is a new event.

3. **Ordering.** Events for a single subject are totally ordered by occurrence time, so the trail reads as a coherent sequence.

4. **Attribution.** Every event names its actor — `System`, `Agent`, a specific employee role, or `CEO`. An anonymous event is not acceptable in the audit trail.

5. **Safety-block visibility.** Events that represent a guardrail block — a denied command, a protected-path write attempt, a forbidden branch push — are recorded distinctly and surfaced prominently. A blocked autonomous run records the offending command/path so the CEO can see exactly what the agent was prevented from doing. This realizes the safety contract in [GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md) and the runtime's guardrail gate.

6. **Scoping and retention.** Audit events are company-scoped and retained for the company's full history. The execution-level audit stream (per agent session) is retained against the session it describes.

The execution audit trail operates at finer granularity than the company event stream: it captures `file_read`, `file_written`, `command_executed`, `command_blocked`, `guardrail_triggered`, `branch_created`, `pr_opened`, and `validation_run` for a single agent session, with `info` / `warn` / `error` severities. These session-level events roll up into the company-level execution events (`execution.completed`, `execution.failed`) that the broader system consumes.

---

## 11. Support for Memory and Reporting

Events are the substrate from which the company learns and reports.

**Memory.** Certain events are inherently learning signals. `decision.recorded`, `incident.resolved`, and feature-completion events carry the content that becomes durable [Memory Records](./DOMAIN_MODEL.md#memory-record). The memory consumer captures these so the company does not re-derive the same conclusion later. The principle from [COMPANY_RUNTIME.md §13](./COMPANY_RUNTIME.md#13-knowledge-retrieval) — that skipping knowledge capture breaks the compounding effect — depends on events being emitted reliably at every phase boundary.

**Reporting.** Reports are aggregations over events across a time window. A Sprint Progress Report counts `work.completed` events; a QA Summary counts `qa.passed` versus `qa.failed`; a Company Health signal watches the ratio of `*.blocked` to `*.completed`. Because reports read from the immutable event record rather than from mutable object state, two reports over the same window always agree — the event record is the single, replayable source.

This is why event emission is treated as part of the work (Principle 7): a missing event is a missing data point that silently corrupts both memory and every report that spans it.

---

## 12. V1 Event List

The canonical V1 event catalog. Names are given in the canonical dot-namespaced form. The **Status** column distinguishes events emitted by the live codebase today from those that are designed and reserved for the autonomous loop's later phases.

| Event | Category | Subject | Typical Actor | Status |
|---|---|---|---|---|
| `outcome.submitted` | Intake | outcome | CEO / System | Emitted today |
| `plan.generated` | Planning | outcome / plan | System | Emitted today |
| `plan.approved` | Planning | plan | CEO | Emitted today |
| `plan.rejected` | Planning | plan | CEO | Emitted today |
| `plan.failed` | Planning | plan | System | Emitted today |
| `work.created` | Work | project / feature / task | Tech Lead / System | Emitted today |
| `task.assigned` | Work | task | Tech Lead | Designed |
| `task.started` | Work | task | Agent / Engineer | Designed |
| `task.blocked` | Work | task | System | Designed |
| `work.completed` | Work | request / feature | System | Emitted today (request-level) |
| `execution.prepared` | Execution | session | System | Emitted today |
| `execution.started` | Execution | session | Agent | Emitted today |
| `execution.completed` | Execution | session / task | Agent | Emitted today |
| `execution.failed` | Execution | session / task | Agent | Emitted today |
| `execution.needs_clarification` | Execution | session / task | Agent | Emitted today |
| `review.requested` | Review | task / review | Tech Lead | Designed |
| `review.approved` | Review | review | Reviewer | Emitted today |
| `review.changes_requested` | Review | review | Reviewer | Emitted today |
| `review.blocked` | Review | review | Reviewer / Security | Emitted today |
| `review.needs_clarification` | Review | review | Reviewer | Emitted today |
| `qa.passed` | Quality | qa_result | QA Engineer | Emitted today |
| `qa.failed` | Quality | qa_result | QA Engineer | Emitted today |
| `qa.blocked` | Quality | qa_result | QA Engineer | Emitted today |
| `qa.needs_clarification` | Quality | qa_result | QA Engineer | Emitted today |
| `release.candidate_created` | Release | release | Release Manager | Emitted today |
| `release.deployed` | Release | release | Release Manager / DevOps | Designed |
| `release.stable` | Release | release | Monitoring Engineer | Designed |
| `release.rolled_back` | Release | release | Release Manager | Designed |
| `incident.opened` | Incident | incident | Monitoring Engineer | Designed |
| `incident.resolved` | Incident | incident | Tech Lead | Designed |
| `decision.recorded` | Decision | decision | Decision owner | Designed |
| `memory.updated` | Memory & Knowledge | memory_record | Owning employee | Designed |
| `knowledge.published` | Memory & Knowledge | knowledge_record | Technical Writer | Designed |
| `approval.required` | Approval | work item | System | Emitted today |
| `approval.received` | Approval | work item | CEO | Emitted today |
| `repository.connected` | Repository | repository | CTO | Designed |
| `repository.analyzed` | Repository | repository | Tech Lead | Designed |

"Emitted today" is grounded in [§13](#13-implementation-status-today). Some live emitters use a `snake_case` spelling that this catalog normalizes (e.g., `review_approved` → `review.approved`); see the naming inconsistency in [§14](#14-open-questions).

---

## 13. Implementation Status Today

This section records what the live codebase actually does, so the model above is honestly separable into built versus designed. It is grounded in a June 2026 code trace.

**What exists and is wired:**

- **Three durable record types back the event layer.** The data model defines `RuntimeEvent` (a per-request timeline of intake/planning/execution facts, scoped through `RuntimeRequest`), `TimelineEntry` (a global, subject-anchored record with `entityType` / `entityId` / `eventType` / `summary` / `actorId` / `metadata`), and `Notification` (user-addressed, with `type` of `info` / `warning` / `alert` / `decision` / `progress` / `blocker` and a `priority`). A fourth model, `Event` (a generic catch-all with `type` / `entityType` / `metadata`), exists in the schema but is **not currently written by any service** — it is reserved capacity, not a live emitter.

- **Outcome-planning events are canonical dot-namespaced names.** A single source, `OUTCOME_PLANNING_EVENT_TYPES`, defines `outcome.submitted`, `plan.generated`, `plan.approved`, `plan.rejected`, `work.created`, and `plan.failed`. These are written as `TimelineEntry` rows (and, for intake/planning, mirrored onto `RuntimeEvent`).

- **Review, QA, release, and execution services emit `snake_case` timeline events** today: `review_approved`, `review_changes_requested`, `review_blocked`, `review_needs_clarification`; `qa_passed`, `qa_failed`, `qa_blocked`, `qa_needs_clarification`; `release_candidate_created`; and `execution_${status}` runtime events. The canonical catalog in [§12](#12-v1-event-list) normalizes these to dot form.

- **Notifications are produced directly at the call site.** Helpers `notify()` and `notifyInTx()` create `Notification` rows; the transaction-aware variant lets a notification commit atomically with the state change that warranted it, satisfying Principle 7. Intake, approval gates, blocked work, and completion all notify the CEO today.

- **The execution audit trail is implemented.** `WorkerAuditLog` is an append-only, in-memory log per agent session (`session_started`, `file_read`, `file_written`, `command_executed`, `command_blocked`, `guardrail_triggered`, `branch_created`, `pr_opened`, `validation_run`, …) with `info` / `warn` / `error` severities, serialized onto the session. `buildSessionAuditView()` produces the CEO-facing trail and, when no serialized log is present, **derives** an ordered trail from recorded session facts (files changed, commit, PR, final status) so there is no silent gap. Guardrail blocks are flagged distinctly via `SAFETY_BLOCK_EVENT_TYPES`.

**What is designed but not yet a live emitter:**

- **There is no central event bus or dispatcher in code.** Producers write Timeline/Notification/RuntimeEvent records *directly* at each call site; there is no publish/subscribe layer routing a single event to multiple independent consumers. The producer/consumer decoupling in [§6](#6-producers-and-consumers) and the event-driven invocation pipeline in [COMPANY_RUNTIME.md §36](./COMPANY_RUNTIME.md#36-event-driven-employee-invocation) describe the target architecture; today the wiring is point-to-point.

- Incident, decision, memory/knowledge, release-deploy/stable/rollback, and repository events in [§12](#12-v1-event-list) are reserved names without live emitters.

This split is intentional and consistent with the project's hard rule: do not build event infrastructure (or AI behavior on top of it) ahead of the specification that governs it.

---

## 14. Open Questions

These are unresolved and deliberately left open. Each must be answered before the corresponding capability hardens.

1. **Naming convention reconciliation.** The codebase emits both dot-namespaced (`plan.approved`) and `snake_case` (`qa_passed`, `review_approved`) event names. This document declares dot form canonical. When and how do we migrate the `snake_case` emitters without breaking existing Timeline history? A read-time alias layer, a one-time backfill, or dual-emission during a transition window are the candidates.

2. **One stream or three records?** Today three separate models (`RuntimeEvent`, `TimelineEntry`, `Notification`) plus the unused `Event` model carry overlapping facts. Does V1 converge on a single canonical event record from which Timeline and Notification are pure projections, or do the three remain distinct by design? The schema's idle `Event` model suggests convergence was anticipated.

3. **Bus versus point-to-point.** The producer/consumer model in [§6](#6-producers-and-consumers) assumes a routing layer. The code is point-to-point. What triggers the move to a real dispatch layer — and is it in-process or external? This is the infrastructure decision this document deliberately does not make.

4. **Company scoping for `TimelineEntry`.** `RuntimeEvent` is company-scoped via `RuntimeRequest` and `Notification` carries an optional `companyId`, but `TimelineEntry` stores `companyId` only inside its `metadata` JSON rather than as a first-class, indexed field. Should company scope be promoted to a required column to enforce tenant isolation (Principle 5) at the data layer?

5. **Event versioning.** When a payload shape must change incompatibly, do we version the `type` (`review.approved.v2`), version the payload, or forbid incompatible change outright? Principle: additive change only — but the escape hatch for genuinely breaking change is undefined.

6. **Retention and archival.** Events are never deleted, but the company will accumulate them indefinitely. What is the archival strategy for old events that preserves audit completeness while keeping the active record queryable? Session-scoped audit logs and durable company events likely need different policies.

7. **Replay.** If reporting and memory are projections of events, can the company *replay* the event record to rebuild a report or backfill a new consumer? This is a powerful property the model permits but the implementation does not yet guarantee (notably because there is no single canonical stream — see Q2).

---

## 15. Relationship to Other Architecture Documents

- **[DOMAIN_MODEL.md](./DOMAIN_MODEL.md)** defines the objects events describe and the `Event`, `Timeline Entry`, `Notification`, and `Runtime Event` objects themselves. This document defines their *behavior as an event layer*; the Domain Model defines their *structure*.
- **[COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md)** defines runtime orchestration. Its §24 (Timeline), §25 (Notifications), §34 (Runtime Events), and §36 (Event-Driven Employee Invocation) are the runtime counterparts to this document; where they overlap, the runtime owns *who acts next* and this document owns *what an event is*.
- **[GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md)** defines the agent Git workflow whose guardrail blocks and PR facts feed the execution events and audit trail in [§10](#10-audit-trail-requirements).
- **[INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md)** defines how the CEO views Timeline and Notification surfaces that consume these events.
- **[TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)** defines the modules that emit and consume events; module-specific event definitions live there.
