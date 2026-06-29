# Notification System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

The Notification System is how Engineering OS decides what deserves a person's attention, who receives it, when, and — just as importantly — what does *not* warrant interruption. It is the company's attention-management layer: the mechanism that lets a CEO close the app and return to find the few things that genuinely need them, without wading through the thousands of internal events the company produces to get there.

Its single most important job is to protect the CEO. A real engineering organization generates an enormous volume of internal communication — task hand-offs, review comments, defect reports, staging deploys, memory writes — and a good organization shields its executive from nearly all of it. The Notification System encodes that discipline. The default is silence. A notification is the exception, earned by an event that the CEO must act on or genuinely benefits from knowing.

This document describes a real subsystem. Where behavior is implemented in the codebase today it is marked **Implemented today**; where it is specified by the organization but not yet built it is marked **Designed**. Inventing capability the platform does not have would violate a hard project rule, so the two are kept strictly separate (see [Section 14](#14-implementation-status)).

This document does not describe a delivery transport — there is no email, SMS, push, or chat-channel layer specified or built, and none should be assumed. Notifications are durable company records surfaced inside the product. The rules here are channel-agnostic and survive any future addition of a transport.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Signal Versus Noise](#3-signal-versus-noise)
4. [What the CEO Is Protected From](#4-what-the-ceo-is-protected-from)
5. [Notification Types](#5-notification-types)
6. [Priority and Severity Levels](#6-priority-and-severity-levels)
7. [Recipients](#7-recipients)
8. [Notification Anatomy](#8-notification-anatomy)
9. [Notification Catalog](#9-notification-catalog)
10. [Timing and Delivery](#10-timing-and-delivery)
11. [Escalation](#11-escalation)
12. [Digest Behavior](#12-digest-behavior)
13. [Notifications Versus Approval Checkpoints](#13-notifications-versus-approval-checkpoints)
14. [Implementation Status](#14-implementation-status)
15. [Failure Modes](#15-failure-modes)
16. [KPIs](#16-kpis)
17. [Relationship to Other Documents](#17-relationship-to-other-documents)

---

## 1. Purpose

The Notification System exists to answer one question for whoever is looking at Engineering OS: *what, if anything, needs me right now?*

It has three responsibilities:

1. **Surface decisions.** When a work item reaches a gate that requires a person's action — most often the CEO's approval — the system raises a notification so the work is not silently stalled.
2. **Surface exceptions.** When something goes wrong — a blocker, a changes-requested review, a failed QA validation — the system raises it so the condition is not invisible until someone happens to look.
3. **Confirm outcomes.** When something the person initiated reaches completion, the system confirms it, closing the loop on a request without requiring the person to poll for status.

Everything else the company does internally is *not* the Notification System's concern. Internal hand-offs are coordinated by the [Company Runtime](../architecture/COMPANY_RUNTIME.md) through durable artifacts and events, and recorded in the Timeline. The Notification System sits on top of that machinery and pulls forward only the small fraction that a human must see.

The Notification System is not a log. The Timeline records what happened, durably and completely. A notification is a deliberate interruption — a claim on attention. The cost of a notification is the attention it spends; the system is designed to spend that attention rarely and well.

---

## 2. Scope

**In scope:**

- The decision of *whether* an event becomes a notification (the signal/noise judgment).
- The classification of a notification by **type** and **priority**.
- The **recipient** a notification is addressed to.
- The content rules that keep notifications outcome-focused and free of implementation detail.
- The surfaces inside the product that render notifications and their unread state.
- The read/acknowledgement lifecycle.

**Out of scope:**

- **Delivery transports.** Email, SMS, push, and chat integrations are not specified or built. The system addresses notifications to a user; how a future transport might fan them out is intentionally left open.
- **The Timeline.** The Timeline is the complete, immutable record of significant events and is owned by the Company Runtime (see [COMPANY_RUNTIME §24](../architecture/COMPANY_RUNTIME.md#24-timeline-updates)). Notifications reference the same events but are a curated subset, not the source of record.
- **Approval execution.** The act of approving or rejecting a gated checkpoint is owned by the approval-checkpoint flow (see [Section 13](#13-notifications-versus-approval-checkpoints)). The Notification System points at that work; it does not perform it.
- **Company health scoring.** The metrics that might trigger a health alert are defined elsewhere; this document defines only how such an alert would behave as a notification.

---

## 3. Signal Versus Noise

The defining principle of this system is the separation of signal from noise. Most of what a software company does is noise to its executive — necessary, valuable work that the executive should never have to see. Signal is the rare event that changes what the executive should do or know.

**An event is signal when at least one is true:**

- It requires an action only the recipient can take (an approval, a decision).
- It is an exception that will worsen if unseen (a blocker, a failed validation, an incident).
- It is the completion of something the recipient initiated and is waiting on.

**An event is noise when:**

- It is a routine internal hand-off between employees.
- It is an intermediate step in a process whose outcome will itself be reported.
- It is implementation activity (a commit, a branch, a staging deploy, a memory write).
- It is information the recipient does not need in order to act or to understand the company's state.

The same underlying event can be noise at one altitude and signal at another. A single review finding is noise to the CEO; a review that comes back **changes-requested** and stalls a feature the CEO is waiting on is signal. The system's job is to hold that line: aggregate the noise into a reported outcome, and raise only the outcome.

**The bias is toward silence.** When it is unclear whether an event is signal, the default is not to notify. A missed notification costs a delay; an unnecessary notification costs trust in every future notification. Over time, a noisy notification system trains its recipient to ignore it, which defeats the entire purpose. Silence is the safe default precisely because the Timeline still records everything for anyone who chooses to look.

---

## 4. What the CEO Is Protected From

The CEO communicates outcomes and approves what leaves the company. They do not manage implementation, and the Notification System enforces that boundary by never raising implementation detail to them.

A notification to the CEO **never** contains:

- Branch names, commit hashes, or pull-request numbers.
- File paths or diffs.
- Raw review comments or individual findings.
- Task identifiers or internal status codes.
- Technical jargon, model names, or process internals.

The test is the one stated in [COMPANY_RUNTIME §25](../architecture/COMPANY_RUNTIME.md#25-notification-rules): a notification that reads *"PR #442 was approved by the Reviewer after addressing 3 blocking findings"* has failed. A notification that reads *"Your authentication feature has passed code review and is now in QA"* has succeeded. The first describes the machinery; the second describes the outcome.

The CEO is also protected from **volume**. The events the CEO never receives a notification for include individual task completions, review findings and their resolution, defect reports and their resolution, internal employee communication, routine QA test-case creation, documentation drafts under review, and staging deployments. These are real, tracked, and visible on demand — they are simply not interruptions.

This protection is what makes Engineering OS feel like an organization rather than a tool. An executive at a real company is not CC'd on every engineer's commit; they are told when a feature ships and when a decision is needed. The Notification System reproduces that experience.

---

## 5. Notification Types

Every notification carries a **type** that classifies the nature of the event. The type drives how the notification is presented (icon and accent) and signals to the recipient what kind of attention it asks for.

**Implemented today** — the type is a field on every notification, defaulting to `info`, with six defined values:

| Type | Meaning | Typical use |
|---|---|---|
| `info` | Neutral status; no action required. | A new request was accepted and routed. |
| `progress` | A tracked work item advanced or completed. | A request the CEO submitted reached completion. |
| `decision` | The recipient must make a decision before work continues. | A feature brief is ready for approval; a review/QA checkpoint awaits a decision. |
| `warning` | A condition the recipient should be aware of that is not yet failing. | Reserved for soft-warning conditions. |
| `alert` | Something failed or was rejected and needs attention. | A review returned changes-requested; a QA validation failed. |
| `blocker` | Work cannot proceed until the recipient acts. | A request is blocked and needs the CEO. |

These six types map cleanly onto the deliverable categories in the originating ticket: **CEO notifications** and **project updates** are carried by `info`, `progress`, and `decision`; **risk and incident alerts** are carried by `warning`, `alert`, and `blocker`. Release updates, when they are wired (see [Section 14](#14-implementation-status)), use `progress` and `decision`.

The type vocabulary is intentionally small. A large taxonomy invites miscategorization and forces the recipient to learn the difference between subtly different labels. Six types, each with an unambiguous meaning, keep the system legible.

---

## 6. Priority and Severity Levels

Independent of type, every notification carries a **priority** that expresses urgency — how soon the recipient should look.

**Implemented today** — priority is a field on every notification, defaulting to `medium`, with four levels:

| Priority | Meaning | Examples in use today |
|---|---|---|
| `urgent` | Act now; work is stopped or at risk. | A blocked request. |
| `high` | Act soon; a decision or failure is waiting. | A brief awaiting approval; changes-requested; QA failed; a checkpoint awaiting decision. |
| `medium` | Awareness; act when convenient. | A new request was routed. |
| `low` | Informational confirmation. | A request completed. |

Type and priority are orthogonal and both matter. A `decision` is usually `high` because a decision blocks progress; a `progress` confirmation is usually `low` because nothing is waiting on it. The recipient reads type to know *what kind* of thing this is, and priority to know *how soon* to engage.

**Designed** — a distinct **incident severity** scale (P0–P3) governs production incidents and is defined in the operational SOPs and the [Company Runtime](../architecture/COMPANY_RUNTIME.md#31-recovery-from-failure). When incident alerting is wired into the Notification System, P0/P1 incidents map to `alert`/`blocker` type at `urgent` priority, and P2/P3 fold into a digest rather than an immediate interruption. The four-level priority scale above is the implemented mechanism; the P0–P3 mapping is the planned policy layered on top of it.

---

## 7. Recipients

A notification is addressed to a specific user. It is not broadcast.

**Implemented today** — every notification carries a `userId` (the recipient) and an optional `companyId` (the company context). In the current product every notification is addressed to the **company owner — the CEO**. The CEO is the only human user of the system today, so the recipient is, in practice, always the CEO. The system reads notifications scoped to the signed-in user, so the addressing model is already correct even though only one recipient exists.

**Recipient classes (the model the addressing supports):**

| Recipient | Receives | Status |
|---|---|---|
| **CEO (company owner)** | Decisions, exceptions, and completions of work they initiated. | Implemented today |
| **Employees** | Role-scoped hand-offs and assignment notifications. | Designed |
| **Departments / teams** | Shared notifications for a department-owned concern. | Designed |

**Designed — employee and team notifications.** In the full organizational model, employees are invoked by the runtime through events and durable artifacts, not by always-on listeners (see [COMPANY_RUNTIME §36](../architecture/COMPANY_RUNTIME.md#36-event-driven-employee-invocation)). Employee notifications are therefore a thin layer over that invocation: a way to record that a specific role's attention was requested. The data model already supports per-user addressing, so adding employee recipients is a routing change, not a schema change. It is deliberately not built yet — there is no second human user, and fabricating employee notification traffic would be fabricating activity.

---

## 8. Notification Anatomy

**Implemented today** — every notification is a durable record with the following fields:

| Field | Purpose |
|---|---|
| `id` | Stable identifier. |
| `userId` | The recipient (see [Section 7](#7-recipients)). |
| `companyId` | The company context (optional). |
| `title` | The headline, in plain organizational language. |
| `body` | A one-line elaboration (optional). |
| `type` | One of the six types (see [Section 5](#5-notification-types)). |
| `priority` | One of the four priorities (see [Section 6](#6-priority-and-severity-levels)). |
| `entityType` / `entityId` | The work item this notification is about — e.g. a `request` or a `task`. |
| `actionUrl` | A deep link to the surface where the recipient acts or learns more. |
| `read` / `readAt` | Acknowledgement state and timestamp. |
| `createdAt` / `updatedAt` | Lifecycle timestamps. |

**Content rules:**

- The `title` and `body` are written for the recipient's altitude. For the CEO, that means outcomes, not machinery (see [Section 4](#4-what-the-ceo-is-protected-from)).
- The `entityType`/`entityId` pair links the notification to its work item without exposing internal identifiers in the visible text.
- The `actionUrl` takes the recipient directly to where they act — the inbox for a decision, the quality surface for a review or QA outcome — so a notification is one click from resolution, not a dead end.

**Creation is centralized.** All notifications are created through a single helper, with a transaction-aware variant so a notification can be written atomically alongside the state change that justifies it. Centralizing creation means the type/priority defaults, the field contract, and the content discipline are enforced in one place rather than re-implemented at every call site.

---

## 9. Notification Catalog

This is the catalog of notifications the system raises today, traced to the events that produce them. Every entry below is **Implemented today**; the planned categories follow in [Section 14](#14-implementation-status).

**Request lifecycle (CEO notifications + project updates):**

| Event | Type | Priority | What the CEO sees |
|---|---|---|---|
| A new outcome/request is submitted and routed | `info` | `medium` | "New request: …" with where it was routed. |
| A request reaches `awaiting_approval` | `decision` | `high` | "Decision needed: …" — a brief is ready to approve. |
| A request becomes `blocked` | `blocker` | `urgent` | "Blocked: …" — needs attention to proceed. |
| A request reaches `complete` | `progress` | `low` | "Complete: …" — the work is done. |

**Quality outcomes (exception alerts):**

| Event | Type | Priority | What the CEO sees |
|---|---|---|---|
| A review returns **changes-requested** | `alert` | `high` | "Changes requested" on the named work, with a short note. |
| A QA validation **fails** | `alert` | `high` | "QA failed", with a short note. |

**Autonomy gate checkpoints (decisions):**

| Event | Type | Priority | What the CEO sees |
|---|---|---|---|
| A task pauses at a review or QA checkpoint below the autonomy threshold | `decision` | `high` | "Approval needed: review/QA" — a deep link to the inbox decision. |

The checkpoint notification is the connective tissue between the autonomy policy and the CEO's attention: when the [Review System](./REVIEW_SYSTEM.md) gate-advancement halts a task instead of auto-advancing it, this notification is what tells the CEO their decision is what the work is waiting on. It is raised **best-effort** — see [Section 15](#15-failure-modes).

Notice what is *absent* from this catalog: there is no notification for a task being created, an engineer being assigned, a successful review, a passing QA, a commit, or a staging deploy. Those are the company working as expected, and the company working as expected is not a notification.

---

## 10. Timing and Delivery

**Implemented today:**

- **Notifications are created at the moment the justifying event occurs**, synchronously with the state change. A request that transitions to `blocked` writes its notification in the same operation that records the transition. There is no polling delay and no batching window for an individual notification.
- **Notifications are surfaced inside the product on three surfaces:**
  - The **Notifications page**, which lists unread notifications first and earlier (read) notifications below, each linking to its `actionUrl`.
  - The **sidebar bell badge**, which shows the count of unread notifications (capped at "99+").
  - The **Inbox badge**, which shows the count of pending approval checkpoints — a related but distinct count (see [Section 13](#13-notifications-versus-approval-checkpoints)).
- **The affected surfaces are revalidated when a notification-bearing event occurs**, so the inbox, dashboard, and notifications page reflect the new state on the next view rather than going stale.

**Delivery is in-app only.** There is deliberately no external transport. A notification is a record the recipient sees when they are in the product. This is a real constraint, not an omission to paper over: the deliverable for this system explicitly avoids implementation-specific delivery channels, and the system honors that by being transport-agnostic.

**Designed:**

- **Real-time push to an open session** (so an unread count updates without a navigation) is a presentation enhancement, not yet built.
- **Out-of-product transports** (email, chat, mobile push) would attach to the existing per-user addressing if and when the organization decides an executive needs to be reachable while away from the product. Until then, the absence is intentional.

---

## 11. Escalation

Escalation is the discipline of routing an unaddressed or higher-severity event to the right authority rather than letting it sit. In the organizational model it is owned by the [Company Runtime](../architecture/COMPANY_RUNTIME.md#17-escalation-rules); the Notification System is the surface through which an escalation reaches a human.

**Implemented today:**

- The system raises a `blocker`/`urgent` notification when a request is blocked and an `alert`/`high` notification when a review or QA outcome is negative. These are the first rung of escalation: an exception is made visible to the CEO immediately rather than waiting to be discovered.
- The autonomy-gate checkpoint notification escalates a paused task to the CEO's decision queue.

**Designed:**

- **Time-based escalation** — a decision that sits unacknowledged past a threshold being re-raised or elevated in priority — is not built. Today a `decision` notification stays at its original priority until the recipient acts on it.
- **Severity-based incident escalation** — the P0/P1 path that immediately raises an incident to the CEO and holds their attention with status updates until resolution (see [COMPANY_RUNTIME §31](../architecture/COMPANY_RUNTIME.md#31-recovery-from-failure) and [SOP: Release](../sops/RELEASE.md)) — is specified by the organization but not yet wired into the Notification System.
- **Chain-of-authority routing** — directing an escalation up the Engineer → Tech Lead → CTO → CEO chain — is a runtime concern that will produce notifications addressed to the appropriate authority once employee recipients exist (see [Section 7](#7-recipients)).

The principle the designed work will follow is the one already in force: the CEO is the final escalation point and never receives an escalation that a lower authority should have resolved. The Notification System's role is to make the escalation visible, not to decide who owns it — that decision belongs to the runtime.

---

## 12. Digest Behavior

A digest is the aggregation of many low-signal events into a single periodic summary, so that information the recipient wants but does not need *immediately* arrives as one calm report rather than a stream of interruptions.

**Implemented today:** there is no digest mechanism. Every notification is raised individually at the moment of its event. This is acceptable today because the implemented catalog ([Section 9](#9-notification-catalog)) is already curated to decisions, exceptions, and completions — categories that warrant individual attention. The volume is low by design, so the absence of a digest does not produce noise.

**Designed:** as lower-severity notification categories come online — P2/P3 incidents, health-metric drift, routine release confirmations, employee-level activity — a digest becomes necessary to keep them out of the immediate-interruption path. The intended model is:

- **Immediate** for `decision`, `blocker`, and `urgent`/`high` exceptions.
- **Digested** for low-priority informational and progress notifications, delivered as a periodic summary.
- The digest is itself subject to the signal/noise rule: a digest with nothing worth reporting is not sent.

The digest is explicitly a *future* layer. Building it before there is a meaningful volume of low-priority notifications to aggregate would be solving a problem the system does not yet have.

---

## 13. Notifications Versus Approval Checkpoints

The Notification System and the approval-checkpoint flow are closely related and easy to conflate, so the boundary is stated explicitly.

- A **notification** is a record that claims attention. It can be marked read. Its count drives the **sidebar bell badge**.
- An **approval checkpoint** is a piece of *work that is paused* — a task halted at a review or QA gate below the autonomy threshold, persisted as a pending review or QA record, waiting for the CEO to approve or reject. Its count drives the **Inbox badge** and a **dashboard "Pending approvals" card**.

These are two different counts measuring two different things. Marking a notification read does not resolve the underlying checkpoint; the checkpoint is resolved only by acting on it (approving or rejecting), which resumes the work through the real review/QA services so no gate is bypassed.

The relationship between them is one-directional: when a checkpoint is created, the gate-advancement service *also* raises a `decision` notification pointing at the inbox. The notification is the prompt; the checkpoint is the work. A person can act on the checkpoint whether or not they ever read the notification — the inbox surfaces pending checkpoints directly. The checkpoint mechanics are owned by the [Review System](./REVIEW_SYSTEM.md) and the autonomy policy; this document only documents the notification that announces them.

---

## 14. Implementation Status

A precise separation of what runs today from what is specified but unbuilt.

**Implemented today:**

- A durable notification record with `type`, `priority`, recipient, company context, entity link, action link, and read state.
- A centralized creation helper (with a transaction-aware variant) enforcing the field contract and defaults.
- Six notification types and four priority levels.
- The notification catalog in [Section 9](#9-notification-catalog): request submitted / awaiting-approval / blocked / complete, changes-requested, QA failed, and review/QA checkpoint.
- Three product surfaces: the Notifications page, the sidebar unread bell badge, and the Inbox pending-approvals badge, plus a dashboard pending-approvals card.
- Read and mark-all-read actions, scoped to the signed-in user.
- Best-effort creation for non-critical notifications, so a notification failure cannot break the work that triggered it.
- Per-user addressing — the model already supports recipients beyond the CEO.

**Designed (specified, not built):**

- **Employee and team notifications** — addressing beyond the company owner ([Section 7](#7-recipients)).
- **Release-update notifications** — release automation exists, but it does not yet raise notifications for release-candidate readiness or a shipped release.
- **Risk and incident alerts** with the P0–P3 severity mapping ([Section 6](#6-priority-and-severity-levels)).
- **Company-health alerts** for material metric changes.
- **Time-based and severity-based escalation** ([Section 11](#11-escalation)).
- **Digest behavior** ([Section 12](#12-digest-behavior)).
- **Real-time and out-of-product transports** ([Section 10](#10-timing-and-delivery)).

This separation is load-bearing. Engineering OS does not fabricate automation or capability, so a reader can trust that everything under "Implemented today" can be observed in the running product, and everything under "Designed" is roadmap, not reality.

---

## 15. Failure Modes

### A notification claims attention it has not earned
A non-signal event — a routine hand-off, an intermediate step — is wired to raise a notification. The recipient's unread count grows with things they do not need to act on. Over time they stop trusting the bell and start ignoring it, which silently disables the one signal that mattered.

**Response:** Every new notification is justified against the signal test in [Section 3](#3-signal-versus-noise) before it is added. The default is not to notify. A notification that cannot be tied to a decision, an exception, or a completion the recipient is waiting on is not built.

### A notification leaks implementation detail to the CEO
A notification's `title` or `body` is written from the machinery's point of view — naming a task, a branch, a finding — rather than the outcome. The CEO is pulled down into implementation, which is exactly the level the product exists to keep them above.

**Response:** Content is written at the recipient's altitude ([Section 4](#4-what-the-ceo-is-protected-from)). The test is whether the recipient can understand and act on the notification without knowing any internal detail. If not, it is rewritten.

### A notification failure breaks the work it was reporting on
A notification is written in the same path as a state change, and a failure in notification creation aborts the state change — so a transient notification problem stalls real work.

**Response:** Non-critical notifications are raised best-effort: the checkpoint notification, for example, is wrapped so a failure to notify can never break gate advancement. Notifications that *must* be atomic with their state change use the transaction-aware path deliberately, with the understanding that they share the transaction's fate. The default for anything non-essential is best-effort.

### The unread count and the pending-decision count are confused
A reader assumes the bell's unread count and the inbox's pending-approvals count are the same number, and treats clearing notifications as clearing work.

**Response:** The two counts are kept distinct and labeled ([Section 13](#13-notifications-versus-approval-checkpoints)). Marking notifications read never resolves a checkpoint; only acting on the checkpoint does.

### Silence is mistaken for inactivity
Because the system is quiet by design, a recipient infers that a quiet company is an idle company.

**Response:** The Timeline and the dashboard carry the full, continuous picture of company activity on demand. Notifications are the exception layer, not the activity feed. The product makes the distinction visible: the absence of a notification means nothing needs you, not that nothing is happening.

---

## 16. KPIs

| KPI | Target | Why it matters |
|---|---|---|
| Notification actionability | Every CEO notification maps to a decision, an exception, or an awaited completion | Enforces the signal/noise discipline; a notification with no purpose is a defect |
| Implementation-detail leakage | 0 CEO notifications containing branch/PR/file/finding detail | Protects the CEO's altitude |
| Decision latency | Time from a `decision` notification to the CEO acting on it, trending down | Measures whether decisions are surfaced clearly enough to act on quickly |
| Unread-to-acted ratio | High proportion of notifications acted on rather than dismissed unread | A low ratio signals the system is over-notifying |
| Notification volume per active work item | Bounded and stable | A rising trend signals noise creeping in |
| Best-effort notification non-blocking | 100% — a notification failure never breaks the triggering work | Protects the integrity of the runtime |

These KPIs are written against the implemented system. As the designed categories come online, two more become relevant: incident-alert timeliness (a P0/P1 raised within its SLA) and digest fidelity (a digest that omits nothing worth reporting and includes nothing that should have been immediate).

---

## 17. Relationship to Other Documents

- **[Company Runtime](../architecture/COMPANY_RUNTIME.md)** — defines the events the Notification System draws from, the [Notification Rules §25](../architecture/COMPANY_RUNTIME.md#25-notification-rules) this document implements and expands, the [Timeline §24](../architecture/COMPANY_RUNTIME.md#24-timeline-updates) that notifications are a curated subset of, and the [escalation §17](../architecture/COMPANY_RUNTIME.md#17-escalation-rules) and [recovery §31](../architecture/COMPANY_RUNTIME.md#31-recovery-from-failure) flows that produce incident and blocker notifications.
- **[Review System](./REVIEW_SYSTEM.md)** — owns the review and QA gates whose outcomes and autonomy-gated checkpoints generate the quality and decision notifications in [Section 9](#9-notification-catalog).
- **[Planning System](./PLANNING_SYSTEM.md)** — produces the plans whose approval generates the "Decision needed" notification, and the requests whose lifecycle drives the request notifications.
- **[Organizational Memory System](./ORGANIZATIONAL_MEMORY_SYSTEM.md)** — the durable record layer; notifications point at memory and work items but are not themselves the company's long-term record.
- **[SOP: Release](../sops/RELEASE.md)** — defines the release and incident events that the designed release-update and incident-alert notifications will surface.
