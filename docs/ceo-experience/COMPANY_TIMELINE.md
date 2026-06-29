# Company Timeline — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

The Company Timeline is the CEO's narrative record of what their company did and why. It answers a single question that every founder eventually asks of any organization they own: *what has been happening here?* Where the Dashboard shows the present and the Inbox shows what needs a decision, the Timeline shows the past — a chronological, plain-language history of requests, plans, decisions, execution, review, QA, and release.

This document defines the Timeline as a product surface: its purpose, which events belong on it, how those events are organized and grouped, how the CEO reads it, and how it makes the company's activity transparent without exposing implementation. It is a product specification, not a frontend or engineering specification. Where it describes behavior, it distinguishes clearly between what the platform implements **today** and what is **designed but not yet built**.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [What the Timeline Is and Is Not](#2-what-the-timeline-is-and-is-not)
3. [Timeline Principles](#3-timeline-principles)
4. [Timeline Events](#4-timeline-events)
5. [Event Hierarchy](#5-event-hierarchy)
6. [Grouping and Ordering](#6-grouping-and-ordering)
7. [Filters and Views](#7-filters-and-views)
8. [Summaries](#8-summaries)
9. [Decision Visibility](#9-decision-visibility)
10. [Risk and Incident Visibility](#10-risk-and-incident-visibility)
11. [Privacy and CEO Framing](#11-privacy-and-ceo-framing)
12. [Relationship to Other Surfaces](#12-relationship-to-other-surfaces)
13. [Implemented Today vs. Designed](#13-implemented-today-vs-designed)
14. [Success Criteria](#14-success-criteria)
15. [Related Documents](#15-related-documents)

---

## 1. Purpose

The Timeline exists so the CEO can understand the company's activity over time without having attended to it in real time. A founder who steps away for a day, a week, or a month should be able to open the Timeline and reconstruct, in plain language, the full arc of what the company accomplished while they were gone.

The Timeline serves four distinct needs:

1. **Reconstruct history.** What requests were submitted, what was planned, what shipped, and in what order — a continuous, trustworthy account of company activity.
2. **Understand causality.** Not just *what* happened, but *why*: which outcome a plan came from, which plan produced which work, which review approved which task, which QA result gated which release.
3. **Establish accountability.** Every significant event is attributable to a moment in time and, where applicable, to the actor or workflow that produced it.
4. **Build trust over time.** Each shipped feature, passed quality gate, and cleared review that the CEO can see on the Timeline is evidence that the company's process is real. The Timeline is where organizational trust accumulates.

The Timeline is a **read surface**. The CEO does not act from it. Actions belong to the Inbox; decisions belong to approvals; state belongs to the Dashboard. The Timeline is purely about visibility into the past.

---

## 2. What the Timeline Is and Is Not

**The Timeline is** the company's history expressed in organizational terms. It is the chronological log of milestones in the life of the company's work — the events a CEO would care about if they ran a real engineering organization.

**The Timeline is not** an activity log, a debug trace, or an audit of every internal operation. It does not record every database write, every file touched, every intermediate step an employee took. Those details exist elsewhere (the per-task execution audit trail, described in [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)) and are never elevated to the CEO's Timeline.

The distinction is editorial. A real company's history is told as a sequence of meaningful events — "we shipped billing," "we caught a security issue in review," "the release went out" — not as a transaction log. The Timeline holds the former and excludes the latter.

| The Timeline shows | The Timeline excludes |
|---|---|
| An outcome was submitted | The HTTP request that carried it |
| A plan was generated and approved | The templated planner's internal steps |
| Work was created from an approved plan | Which database rows were inserted |
| A review was approved or sent back | The raw review findings, line by line |
| QA passed, failed, or needs clarification | The individual test assertions |
| A release candidate was created | The branch name, commit SHA, or PR number |
| Execution started, paused, or completed | The agent's command-by-command transcript |

---

## 3. Timeline Principles

**3.1 Every entry is a milestone, not a mutation.**
An event earns a place on the Timeline only if a CEO would recognize it as something the company *did*. Internal state changes that carry no organizational meaning do not appear.

**3.2 Newest first.**
The default ordering is reverse chronological. The most recent thing the company did is the first thing the CEO sees. History recedes downward.

**3.3 Plain language, always.**
Every entry is a complete sentence the CEO can read without translation. "Outcome submitted: 'Let users reset their password.' Planning has not started." — never an event code, status enum, or stack of identifiers.

**3.4 Every entry is anchored to context.**
Each event links to the object it concerns — the outcome, the plan, the request — so the CEO can traverse from "what happened" to "the thing it happened to" in one step.

**3.5 Time is always explicit.**
Every entry carries both a human-relative timestamp ("2h ago," "yesterday") and an exact time available on inspection. The CEO never has to guess when something occurred.

**3.6 Best-effort, never blocking.**
Recording a Timeline entry never blocks or fails the work it describes. If the company ships a feature, the ship happens whether or not the Timeline write succeeds. The Timeline is a faithful observer of work, never a gate on it.

**3.7 No implementation leakage.**
The Timeline obeys the same boundary as every other CEO surface: no branches, no PR numbers, no file paths, no commit messages, no deployment commands. (See [Section 11](#11-privacy-and-ceo-framing).)

---

## 4. Timeline Events

This section defines which events belong on the Timeline. The platform records events from two sources today, and presents them as a single merged stream.

### 4.1 Event sources

| Source | What it captures | Anchored to |
|---|---|---|
| **Planning & delivery events** | Lifecycle milestones in the outcome → plan → work → review → QA → release flow | An outcome, a plan, or a task |
| **Runtime request events** | Activity on a CEO request as it is received and routed through the runtime | A runtime request |

Both sources are read together, sorted by time, and rendered as one continuous Timeline. The CEO sees a single history, not two logs.

### 4.2 Canonical event catalog — implemented today

The following event families are emitted by the platform and appear on the Timeline today. They are organized by the phase of work they belong to.

**Intake**

| Event | Plain-language meaning |
|---|---|
| Outcome submitted | The CEO stated a goal; it has been recorded and routed. Planning has not started yet. |
| Request received | A request was received by the runtime and routed to a responsible role. |

**Planning**

| Event | Plain-language meaning |
|---|---|
| Plan generated | A reviewable plan was produced for the outcome and is awaiting the CEO's review. |
| Plan approved | The CEO approved the plan; the company may proceed to create work. |
| Plan rejected | The CEO declined the plan; no work is created from it. |
| Work created | An approved plan was applied into real projects, features, and tasks. |
| Plan failed | Plan generation could not complete; the outcome did not advance to a reviewable plan. |

**Execution**

| Event | Plain-language meaning |
|---|---|
| Execution started / progressed / paused / completed | An execution session moved through its lifecycle. The Timeline reflects the session's status as it changes. |
| Blocker raised | Work hit a blocker that prevents it from proceeding without attention. |
| Progress reported | Meaningful forward progress was recorded on a request. |

**Review**

| Event | Plain-language meaning |
|---|---|
| Review approved | A reviewer approved the work; it may advance past the review gate. |
| Changes requested | A reviewer sent the work back with required changes. |
| Review blocked | A reviewer blocked the work; it cannot advance until the block is cleared. |
| Review needs clarification | A reviewer cannot complete the review without more information. |

**QA**

| Event | Plain-language meaning |
|---|---|
| QA passed | Validation against acceptance criteria succeeded; the work may advance past the QA gate. |
| QA failed | Validation failed; the work is sent back. |
| QA blocked | QA cannot proceed and has blocked advancement. |
| QA needs clarification | QA cannot complete validation without more information. |

**Release**

| Event | Plain-language meaning |
|---|---|
| Release candidate created | Completed, validated work was assembled into a release candidate. |

**Decision**

| Event | Plain-language meaning |
|---|---|
| Decision required | Work reached a checkpoint that requires the CEO's approval before it can continue. |

### 4.3 Designed event types — not yet emitted

The information architecture for Engineering OS defines a richer set of high-level timeline entry types intended for the mature product. These are **designed but not yet emitted** by the platform. They are documented here so the gap between the current build and the intended product is explicit and honest.

| Designed entry type | Status |
|---|---|
| Feature shipped (deployed to production) | Designed — not yet emitted |
| Release deployed | Designed — not yet emitted as a discrete deploy event |
| Incident resolved | Designed — the incident model exists; resolution is not yet surfaced on the Timeline |
| Security cleared (security review completed) | Designed — not yet a distinct timeline event |
| Milestone reached | Designed — not yet emitted |
| Repository connected | Designed — not yet surfaced on the Timeline |
| Memory updated | Designed — not yet surfaced on the Timeline |

The full designed catalog is specified in [INFORMATION_ARCHITECTURE.md, Section 18](../architecture/INFORMATION_ARCHITECTURE.md#18-timeline-structure). As the corresponding workflows begin emitting these events, they will appear on the Timeline without any change to its reading model — the Timeline is designed to absorb new event types gracefully.

---

## 5. Event Hierarchy

Timeline events are not flat. They sit inside the company's work hierarchy, and the Timeline's value comes from being able to read an event *in context* of that hierarchy.

```
Outcome (what the CEO asked for)
└── Plan (how the company proposes to deliver it)
    └── Work (projects, features, tasks created from the plan)
        ├── Review event (the quality gate result)
        ├── QA event (the validation gate result)
        └── Release event (the delivery)
```

Each Timeline entry is anchored to one level of this hierarchy:

- **Outcome-level** events (submitted) anchor to the outcome.
- **Plan-level** events (generated, approved, rejected, failed, work created) anchor to the plan or its originating outcome.
- **Task-level** events (review and QA results, release candidates) anchor to the task.
- **Request-level** events (intake, progress, blocker, decision) anchor to the runtime request.

This hierarchy is what makes the Timeline a *causal* history rather than a flat feed. From a "Work created" entry, the CEO can reach the plan it came from; from the plan, the outcome that requested it. The chain from atomic result back to original intent is always traversable. The traversal model is defined in [INFORMATION_ARCHITECTURE.md, Section 22](../architecture/INFORMATION_ARCHITECTURE.md#22-relationships-between-sections).

The CEO is never required to navigate this hierarchy to understand a single event — each entry stands on its own as a readable sentence. The hierarchy exists so that *if* the CEO wants to understand the full story behind an event, the path is there.

---

## 6. Grouping and Ordering

### 6.1 Reverse chronological by default

The Timeline presents events newest-first. The merged stream from all sources is sorted by event time descending, and the most recent activity sits at the top.

### 6.2 Day grouping

Events are grouped under day headers so the CEO reads the history as a sequence of days rather than an undifferentiated stream. The grouping uses relative, human labels:

- **Today** — events from the current day
- **Yesterday** — events from the prior day
- **A full weekday-and-date label** — for any earlier day (for example, "Monday, June 23, 2026")

Within each day group, events remain in reverse chronological order. The day headers give the history a natural reading rhythm: the CEO scans day by day, most recent first.

### 6.3 Relative timestamps

Each individual entry shows a relative timestamp that degrades gracefully with age:

- Under a minute: "just now"
- Under an hour: minutes ago
- Under a day: hours ago
- One day: "yesterday"
- Under a week: days ago
- Older: an absolute short date

The exact timestamp is always available on inspection, so the relative label never costs the CEO precision when they need it.

### 6.4 Volume bounding

The Timeline surface is bounded to a recent window of the most significant events rather than rendering the company's entire history at once. This keeps the surface fast and scannable. The bound is a presentation choice, not a retention choice — events are retained; the surface simply shows the most recent slice. Deeper history retrieval is a designed extension (see [Section 13](#13-implemented-today-vs-designed)).

---

## 7. Filters and Views

### 7.1 Implemented today

The Timeline today provides **day grouping** and **reverse-chronological ordering** as its organizing structure (see [Section 6](#6-grouping-and-ordering)). Each entry is visually typed — events carry a category label and a distinct visual treatment by phase (intake, planning, execution, review, QA, release) — so the CEO can scan for a class of event by eye even without an explicit filter control. Each entry also carries a one-click link to its context object.

### 7.2 Designed filters

The information architecture defines explicit filter controls for the Timeline. These are **designed but not yet built** as interactive controls:

| Filter | Status |
|---|---|
| Filter by event type | Designed — entries are visually typed today; an explicit type filter is not yet built |
| Filter by date range | Designed — day grouping exists today; range selection is not yet built |
| Filter by related employee | Designed — actor attribution is recorded today; an employee filter is not yet built |
| Reverse to oldest-first | Designed — default is newest-first; a reverse toggle is not yet built |

The designed filter set is specified in [INFORMATION_ARCHITECTURE.md, Section 18](../architecture/INFORMATION_ARCHITECTURE.md#18-timeline-structure). Documenting them here keeps the product's intended shape visible while being truthful about what exists.

---

## 8. Summaries

The Timeline summarizes company activity at two altitudes.

### 8.1 Day-level summary

Day grouping (see [Section 6.2](#62-day-grouping)) is itself a summary device: it lets the CEO answer "what did the company do on Tuesday?" by reading a single day's group. The surface also reports a count of the events shown, so the CEO has an immediate sense of how much activity a window contains.

### 8.2 Dashboard recent-activity summary

The Dashboard carries a compact slice of the most recent Timeline activity — a short, newest-first list of the latest milestones — so the CEO sees recent history the moment they arrive, without navigating to the full Timeline. This is the same event stream, truncated to a small recent window. The Dashboard's role is defined in [INFORMATION_ARCHITECTURE.md, Section 8](../architecture/INFORMATION_ARCHITECTURE.md#8-dashboard-structure).

The relationship is deliberate: the Dashboard answers "what just happened?"; the Timeline answers "what has happened?" The first is a glance; the second is the record.

### 8.3 Empty state

Before the company has done anything, the Timeline communicates its own purpose: it tells the CEO that events will appear as the company processes requests and moves work through the pipeline, and it points to where the first request is submitted. The empty state is part of onboarding — it teaches the CEO what the Timeline is by describing what will fill it.

---

## 9. Decision Visibility

A central purpose of the Timeline is making the company's decisions visible — both the CEO's decisions and the company's.

**CEO decisions are recorded as first-class events.** When the CEO approves or rejects a plan, that approval or rejection is a Timeline entry. The history of what the CEO chose — and when — is part of the permanent record. This matters for accountability: the Timeline shows that a plan proceeded *because the CEO approved it*, not silently.

**Company decisions that gate work are recorded.** When work is sent back at review, blocked at QA, or assembled into a release candidate, the Timeline records the decision and its direction. The CEO can see that the company's quality process actually fired — that a review *did* request changes, that QA *did* fail and send work back — rather than taking the process on faith.

**Decision checkpoints are recorded.** When work reaches a point that requires the CEO's approval to continue, the Timeline records that the checkpoint was reached. Paired with the Inbox (where the CEO acts on it) and the subsequent approval event, the Timeline tells the complete story of a decision: it was required, it was surfaced, and it was resolved.

What the Timeline does **not** carry is the *content* of a decision's reasoning. The rationale behind an architectural choice, the alternatives weighed, the trade-offs accepted — those are **Decision Records**, which live in Memory, not on the Timeline. The Timeline records *that* a decision happened and links to it; Memory holds *why*. The separation is defined in [INFORMATION_ARCHITECTURE.md, Section 16](../architecture/INFORMATION_ARCHITECTURE.md#16-memory-structure). Surfacing decision-record creation as its own Timeline entry type is a designed extension (see [Section 4.3](#43-designed-event-types--not-yet-emitted)).

---

## 10. Risk and Incident Visibility

The Timeline is where risk becomes visible as it materializes into events.

**Implemented today.** The Timeline surfaces the events that represent risk *being caught and handled*:

- **Blockers** — when work hits a blocker, the Timeline records it. A run of blockers in the history is a visible signal that work is not flowing.
- **Review rejections and blocks** — changes requested, review blocked, and review-needs-clarification entries show the quality gate doing its job.
- **QA failures and blocks** — qa-failed, qa-blocked, and qa-needs-clarification entries show validation catching problems before release.
- **Plan failures** — a plan-failed entry shows that an outcome could not be turned into a reviewable plan, so the CEO is not left wondering why an outcome stalled.

These events make the company's failure modes legible. A healthy Timeline shows risk being caught *inside* the process — at review and QA — before it reaches production.

**Designed, not yet emitted.** Two categories of risk visibility are specified but not yet surfaced on the Timeline:

- **Incidents.** The platform has an incident model with severity and resolution, but incident creation and resolution are not yet emitted as Timeline events. When implemented, an "incident resolved" entry will close the loop on production risk. (See [Section 4.3](#43-designed-event-types--not-yet-emitted).)
- **Security clearance.** A distinct "security cleared" event is designed to mark that a security review completed with clearance. It is not yet emitted as its own event type.

The plan-level and per-feature risk *registers* (the documented risks attached to a plan or feature) are properties of those objects, not Timeline events. The Timeline references the work; the risk register lives on the work. The CEO sees risk in two complementary ways: as a static register on the plan, and as a stream of risk-related events on the Timeline.

---

## 11. Privacy and CEO Framing

The Timeline is bound by the same CEO-experience boundary that governs every surface in Engineering OS: it speaks the language of an organization, never the language of a toolchain.

The Timeline **never** exposes:

- Git branch names
- Pull request numbers or URLs
- Commit SHAs or commit messages
- File paths or diffs
- CI pipeline statuses
- Deployment commands or environment names
- Raw model output, prompts, or agent transcripts
- Database identifiers

The Timeline **always** speaks in:

- Outcomes, plans, and work
- Reviews, QA results, and releases — as outcomes, not as artifacts
- Decisions and approvals
- Plain-language sentences a non-engineer can read

This is not cosmetic. A "release candidate created" entry tells the CEO that completed, validated work has been assembled for delivery — which is the organizationally meaningful fact. The branch it was built from, the PR that carries it, and the commits inside it are real, and they are recorded in the per-task execution audit trail for traceability — but they are *implementation*, and implementation does not belong on the CEO's Timeline. The boundary is specified in [INFORMATION_ARCHITECTURE.md, Section 2](../architecture/INFORMATION_ARCHITECTURE.md#2-navigation-philosophy) and in the product principles of [PRODUCT_REQUIREMENTS.md, Section 7](../product/PRODUCT_REQUIREMENTS.md#7-product-principles).

---

## 12. Relationship to Other Surfaces

The Timeline is one of four time-oriented CEO surfaces. Each has a distinct job; together they cover past, present, and pending.

| Surface | Question it answers | Tense |
|---|---|---|
| **Dashboard** | What is the company doing right now? | Present |
| **Timeline** | What has the company done? | Past |
| **Inbox** | What needs my decision? | Pending |
| **Memory** | What has the company learned and decided, and why? | Durable |

**Timeline ↔ Dashboard.** The Dashboard carries a recent slice of the Timeline as its activity feed. The Timeline is the full record the Dashboard samples from.

**Timeline ↔ Inbox.** When the Timeline records that a decision checkpoint was reached, the corresponding actionable item appears in the Inbox. The Timeline observes; the Inbox lets the CEO act. After the CEO acts, the resolution becomes a new Timeline event. The Inbox and notification model is defined in [INFORMATION_ARCHITECTURE.md, Section 19](../architecture/INFORMATION_ARCHITECTURE.md#19-notification-structure).

**Timeline ↔ Memory.** The Timeline records *that* a decision happened; Memory holds *why*. A Timeline decision event and a Memory decision record describe the same moment at different depths. Memory is defined in [INFORMATION_ARCHITECTURE.md, Section 16](../architecture/INFORMATION_ARCHITECTURE.md#16-memory-structure).

**Timeline ↔ SOPs.** Many Timeline events are the externally visible milestones of an internal SOP advancing through its phases — a review event is the [Code Review SOP](../sops/CODE_REVIEW.md) reaching a verdict; a QA event is the [QA Validation SOP](../sops/QA_VALIDATION.md) reaching a recommendation; a release-candidate event is an early step of the [Release SOP](../sops/RELEASE.md). The SOPs define the gates; the Timeline records when each gate fired.

---

## 13. Implemented Today vs. Designed

This section consolidates the truthful boundary between the current build and the intended product.

### Implemented today

- A single merged Timeline stream combining planning/delivery events and runtime request events.
- Persistent event records anchored to outcomes, plans, tasks, and requests.
- The event catalog in [Section 4.2](#42-canonical-event-catalog--implemented-today): intake, plan generated/approved/rejected/failed, work created, execution status, blockers and progress, review verdicts, QA verdicts, release-candidate creation, and decision checkpoints.
- Reverse-chronological ordering, day grouping (Today / Yesterday / dated), and degrading relative timestamps.
- Per-event visual typing by phase, a one-click link to each event's context object, and a count of events shown.
- A recent-activity slice on the Dashboard drawn from the same stream.
- A purposeful empty state that teaches the CEO what the Timeline is.

### Designed — not yet built

- Discrete high-level entry types: feature shipped, release deployed, incident resolved, security cleared, milestone reached, repository connected, memory updated (see [Section 4.3](#43-designed-event-types--not-yet-emitted)).
- Explicit filter controls: by event type, by date range, by related employee, and an oldest-first reverse toggle (see [Section 7.2](#72-designed-filters)).
- Deep-history retrieval beyond the recent surface window (see [Section 6.4](#64-volume-bounding)).
- Per-employee attribution surfaced in the entry (actor is recorded today; it is not yet rendered as an organizational author on each entry).

No designed capability above should be described to a user as if it exists. The Timeline's reading model is intentionally built to absorb the designed event types without restructuring, so they will appear as their emitting workflows mature.

---

## 14. Success Criteria

The Timeline is successful when the following are true:

1. **Reconstruction.** A CEO who was away can open the Timeline and explain, in their own words, what the company accomplished while they were gone — without reading any implementation detail.
2. **Causality.** From any delivery event, the CEO can trace back to the outcome that requested it in a small number of steps.
3. **Trust.** The Timeline visibly shows the quality process firing — reviews requesting changes, QA catching failures — so the CEO trusts that the gates are real, not decorative.
4. **Plain language.** Every entry reads as a complete, jargon-free sentence. A non-technical founder understands every line.
5. **No leakage.** No branch, PR, commit, file path, or deployment command ever appears. A reviewer scanning the Timeline finds zero implementation artifacts.
6. **Faithfulness.** The Timeline never blocks the work it describes, and it never silently drops a milestone the CEO would expect to see.
7. **Coherence with siblings.** The Timeline, Dashboard, Inbox, and Memory tell one consistent story across past, present, pending, and durable knowledge — the same event appears with the right depth on each surface.

---

## 15. Related Documents

- [INFORMATION_ARCHITECTURE.md](../architecture/INFORMATION_ARCHITECTURE.md) — defines the Timeline's place in the product's information hierarchy (Sections 18, 19, 22) and the CEO-experience navigation boundary (Section 2).
- [PRODUCT_REQUIREMENTS.md](../product/PRODUCT_REQUIREMENTS.md) — defines the product principles the Timeline serves, especially the CEO experience and the prohibition on implementation leakage (Section 7).
- [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) — defines the live behavioral layer that produces runtime events and the per-task execution audit trail the Timeline deliberately does not surface.
- [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md) — defines the outcome, plan, task, review, QA, release, and incident objects that Timeline events are anchored to.
- [CODE_REVIEW.md](../sops/CODE_REVIEW.md), [QA_VALIDATION.md](../sops/QA_VALIDATION.md), [RELEASE.md](../sops/RELEASE.md) — the SOPs whose phase transitions surface as Timeline events.
