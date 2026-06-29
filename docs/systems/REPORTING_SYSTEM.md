# Reporting System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

The Reporting System is how Engineering OS summarizes the state of the company for the people who must act on it. It turns the raw work records — requests, tasks, reviews, QA results, releases, incidents, decisions — into concise, decision-oriented summaries: what progressed, what is healthy, what is at risk, what shipped, and what needs the reader's attention next. It is the company's reporting voice. When the CEO asks "what is my company doing?", the answer is a report.

A report is not a data dump and not a feed. The Communication System owns the channels a message travels through (notifications, timeline, the dashboard); the Reporting System owns the **content and shape** of the periodic and on-request summaries that flow through those channels. The two are deliberately separated so that "how a message is delivered" never gets confused with "what a good summary contains."

This document describes a real subsystem. Where behavior exists in the codebase today it is marked **Implemented today**; where it is specified by the organization but not yet built it is marked **Designed**. Inventing capability the platform does not have would violate a hard project rule, so the two are kept strictly separate (see [Section 12](#12-implementation-status)).

This document does not describe AI orchestration, prompts, or model selection. It describes how the company reports on itself.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Reporting Principles](#3-reporting-principles)
4. [Report Types](#4-report-types)
5. [Cadence](#5-cadence)
6. [Owners and Recipients](#6-owners-and-recipients)
7. [Report Formats — What Belongs in Each Report](#7-report-formats--what-belongs-in-each-report)
8. [Inputs and Data Sources](#8-inputs-and-data-sources)
9. [Quality Standards](#9-quality-standards)
10. [Escalation Rules](#10-escalation-rules)
11. [KPIs](#11-kpis)
12. [Implementation Status](#12-implementation-status)
13. [Failure Modes](#13-failure-modes)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

The Reporting System answers one question for every audience: *what do you need to know, and what do you need to do about it?*

It exists because Engineering OS is autonomous and continuous. The company is always doing something — planning, executing, reviewing, releasing — and a CEO who had to read every event to understand state would be doing the orchestration work the platform is meant to remove. Reporting is the compression layer. It reads the full work state and produces a short, prioritized summary the reader can act on without first reconstructing context.

The Reporting System has three responsibilities:

1. **Summarize** the current state of a body of work, a department, or the whole company at the right altitude for the reader.
2. **Prioritize** what the reader should attend to first — approvals, risks, blockers, incidents — so the most consequential item is never buried.
3. **Ground** every statement in a real record. A report never asserts progress, health, or completion that the underlying work items do not support.

A report is always decision-oriented. If a reader finishes a report and does not know what is going on or what (if anything) is being asked of them, the report has failed regardless of how much it contains.

---

## 2. Scope

The Reporting System governs the periodic and on-request summaries the company produces about its own state. It covers:

- **CEO reports** — the executive summary of company state: active work, pending approvals, recommended next action, recent completions.
- **Project reports** — the status of a single outcome/project: progress, phase, blockers, what shipped, what is next.
- **Department reports** — the load and output of a department or its employees.
- **Health reports** — the organizational-health view: velocity, quality, technical debt, knowledge coverage, and other company-health signals.
- **Release reports** — the CEO-facing summary of a release candidate: what is shipping, what was reviewed and QA'd, open risks, and follow-ups.
- **Incident reports** — the summary of a production incident: what happened, severity, status, impact, and resolution.

The Reporting System does **not** own:

- **Delivery channels** — notifications, the timeline, and the dashboard surface are owned by the [Communication System](./COMMUNICATION_SYSTEM.md). Reporting decides what a summary says; Communication decides how and when it reaches the reader.
- **The judgments being reported** — review verdicts belong to the [Review System](./REVIEW_SYSTEM.md), decisions to the [Decision System](./DECISION_SYSTEM.md), approvals to the [Approval System](./APPROVAL_SYSTEM.md). Reporting summarizes these records; it does not produce them.
- **The durable record itself** — work records and memory are owned by the [Work Item System](./WORK_ITEM_SYSTEM.md) and the [Organizational Memory System](./ORGANIZATIONAL_MEMORY_SYSTEM.md). A report is a derived view, never a source of truth.

---

## 3. Reporting Principles

Every report in Engineering OS follows the same principles, regardless of type.

- **Decision-oriented over comprehensive.** A report exists to drive a decision or confirm a state, not to enumerate everything. The most important item leads; detail is available by drilling into the linked record.
- **Altitude matches the reader.** A CEO report speaks in outcomes ("your authentication feature passed QA and is ready to ship"). A department report speaks in work items. A report that gives the CEO commit hashes, or gives an engineer business framing, is reporting at the wrong altitude.
- **Grounded in records, never invented.** Every figure, status, and claim traces to a stored record — a task status, a QA result, a release checklist, an incident. The system never fabricates progress, health scores, or completion. This is the same hard rule that keeps plan generation deterministic until the models are specified.
- **Prioritized by what needs attention.** Approvals, blockers, failures, and incidents sort above routine progress. A report orders its contents by consequence, not by recency.
- **Plain language.** Reports avoid internal jargon, ticket IDs in prose, and implementation references except where the reader is the audience for them (e.g., a department report for an engineering lead).
- **Stable and idempotent.** Generating the same report against the same state produces the same summary. A report is a pure function of the records it reads.

---

## 4. Report Types

The company produces six report types. Each has a distinct audience, altitude, and decision it supports.

| Report | Audience | Altitude | Primary question it answers |
|---|---|---|---|
| **CEO report** | CEO | Outcomes | What is my company doing, and what does it need from me? |
| **Project report** | CEO; Tech Lead | Work item | Where is this outcome in its lifecycle, and is it on track? |
| **Department report** | CTO; department lead | Employee / load | What is this department working on and is it overloaded? |
| **Health report** | CEO; CTO | Company | Is the organization healthy across velocity, quality, debt, and knowledge? |
| **Release report** | CEO; Release Manager | Release | What is shipping, was it validated, and what are the open risks? |
| **Incident report** | CEO; CTO; Release Manager | Incident | What broke, how bad is it, and is it resolved? |

These types are not interchangeable. A release report is not a project report with deployment fields; it answers a different question for a different decision (authorize the release vs. understand progress). Mixing types produces summaries that serve no reader well.

---

## 5. Cadence

Reports are produced on three triggers. A given report type may use more than one.

| Trigger | Meaning | Example |
|---|---|---|
| **On-request** | Generated when the reader opens a surface or asks for status | CEO opens the dashboard; CEO asks "what's the status of checkout?" |
| **Event-driven** | Generated when a significant work event occurs | A release candidate is assembled; an incident is opened; a feature ships |
| **Scheduled** *(Designed)* | Generated on a fixed cadence as a digest | A daily company digest; a weekly health report |

**Current behavior is on-request and event-driven.** The dashboard recomputes the CEO report every time it is loaded; a release report is built when a release candidate is assembled; the timeline records event-driven entries as work crosses phase boundaries. Scheduled digests (a periodic push report on a daily/weekly cadence) are **Designed** — the platform does not run a report scheduler today. Cadence by report type:

| Report | Cadence today |
|---|---|
| CEO report | On-request (dashboard load) |
| Project report | On-request (work board / outcome view) |
| Department report | On-request (company / department view) — partial |
| Health report | Designed (no health scoring engine yet) |
| Release report | Event-driven (release-candidate assembly) + on-request |
| Incident report | Event-driven (incident opened) — record exists; report builder Designed |

A scheduled cadence does not change what a report contains — it only changes when it is produced. The format definitions in [Section 7](#7-report-formats--what-belongs-in-each-report) hold across all three triggers.

---

## 6. Owners and Recipients

Reporting is a shared responsibility. The **CTO owns the Reporting System** as a whole and its standards; each report type has an accountable owner who is responsible for its correctness.

| Report | Accountable owner | Recipients |
|---|---|---|
| CEO report | Company Runtime (system-generated) | CEO |
| Project report | Tech Lead | CEO; CTO |
| Department report | Department lead | CTO; CEO on request |
| Health report | CTO | CEO |
| Release report | Release Manager | CEO; CTO |
| Incident report | Monitoring Engineer (during incident) → Tech Lead (root cause) | CEO; CTO; Release Manager |

**Recipient rules:**

- The CEO receives outcome-altitude reports only. The CEO never receives a department or incident report that has not been translated out of implementation detail (see the CEO summary rules in the [Communication System](./COMMUNICATION_SYSTEM.md#11-ceo-summaries--what-reaches-the-ceo)).
- A report is addressed to a specific reader. A report with no defined recipient is a log entry, not a report, and belongs in the timeline.
- Delivery of a report to its recipient (as a notification, a dashboard card, or a timeline entry) is governed by the Communication System's routing and notification rules. The Reporting System hands a finished summary to that system; it does not decide the channel.

---

## 7. Report Formats — What Belongs in Each Report

This is the core of the system: each report type has a defined shape, and information that does not belong in a type does not appear in it.

### 7.1 CEO Report

The CEO report is the executive summary of the whole company. It is what the CEO sees first.

**Contains:**
- **Recommended next action** — the single highest-priority thing the CEO should do, with a one-sentence reason grounded in current state, plus up to a few secondary actions.
- **Pending approvals** — count and short list of decisions waiting on the CEO.
- **Active work** — outcomes/requests in progress, each with its current runtime phase (intake, planning, executing, in review, in QA, releasing).
- **Recent completions** — what shipped or finished recently.
- **Attention items** — blocked or failed work surfaced as company intelligence.

**Excludes:** task-level detail, branch/PR/commit references, review findings, individual employee assignments.

> **Implemented today.** The dashboard composes this report from `computeNextActions` (prioritized recommendations from a pure workspace snapshot — pending plan approvals, failed/stalled executions, blocked work, ready-to-run sessions, active work, idle company), pending-checkpoint counts, the planning lifecycle, and active runtime requests grouped by phase.

### 7.2 Project Report

The project report covers a single outcome and its delivery.

**Contains:**
- The outcome and its current phase in the lifecycle.
- Progress: tasks complete vs. in progress vs. not started.
- What shipped (merged tasks, PRs at the work altitude, releases tied to the outcome).
- What is next and any blockers, with the owner of each blocker.
- Open risks recorded during planning.

**Excludes:** business framing the CEO does not need at this altitude when the reader is a Tech Lead; or, conversely, implementation detail when the reader is the CEO. The same project has a CEO rendering and a Tech Lead rendering — same facts, different altitude.

### 7.3 Department Report

The department report covers a department's load and output.

**Contains:**
- Active employees in the department and their current assignments.
- In-progress and blocked work owned by the department.
- Throughput over the reporting window.
- Capacity signal: is the department overloaded, balanced, or idle?

**Excludes:** cross-department work the department does not own; CEO-altitude outcome framing.

### 7.4 Health Report

The health report is the organizational-health view. It is the report that measures the *organization*, not the repository.

**Contains** (per the company-health model): velocity, quality/review health, testing coverage, technical debt, documentation/knowledge coverage, deployment stability, and review quality — each as a current signal with direction (improving / steady / degrading) and the records behind it.

**Excludes:** raw repository metrics presented without organizational interpretation; a number with no direction or grounding.

> **Designed, not implemented.** There is no health-scoring engine in the codebase today. The dashboard surfaces live counts (active work, tasks by status, employees, pending approvals) but does not compute health signals such as velocity or technical debt. The health report is specified here so the format is settled before the engine is built; it must not be presented as if it exists.

### 7.5 Release Report

The release report is the CEO-facing summary of a release candidate. It supports the release-authorization decision.

**Contains:**
- Release version, title, status, and deployment status.
- The release readiness checklist and which items are confirmed.
- Completed work in the release scope, each with its review status, QA pass/fail counts, and validation summary.
- Open risks and follow-ups.
- The outcome the release delivers.

**Excludes:** commit messages, technical implementation logs, raw review comments. The release report answers "is this safe and ready to ship?" — it is not a developer changelog (the user-facing changelog is a separate artifact owned by the Technical Writer per [SOP-005: Release](../sops/RELEASE.md#changelog-standard)).

> **Implemented today.** `buildCeoReleaseSummary` produces this report as Markdown from stored release, task, review, QA, and session records, and explicitly does not invent data beyond its structured input.

### 7.6 Incident Report

The incident report summarizes a production incident.

**Contains:**
- What happened, in plain language.
- Severity (P0–P3) and current status (open / mitigating / resolved).
- Impact: what users experienced and the scope.
- Timeline: detected → mitigated → resolved.
- Resolution and the root cause once known, with the follow-up work and memory record it produced.

**Excludes:** speculation before facts are established; CEO-directed coordination (the company runs the incident; the CEO is informed, not coordinating — see [COMPANY_RUNTIME.md §35](../architecture/COMPANY_RUNTIME.md#35-ceo-interaction-points)).

> **Partially grounded.** An `Incident` model exists (title, description, severity, status, resolvedAt) and incident timeline events are defined, but there is no incident-report builder service today. The summary format above is **Designed** on top of an existing record.

---

## 8. Inputs and Data Sources

Every report is a pure derivation of stored records. The Reporting System reads; it never writes to the work record. Its sources:

| Source | Feeds |
|---|---|
| RuntimeRequest / Outcome | CEO report, project report (active work, phase) |
| Task / Feature / Project | CEO report, project report, department report (progress, load) |
| PlanningDraft | CEO report (pending plan approvals), project report (risks) |
| ExecutionSession | CEO report (running / failed / ready sessions), release report (branch/PR/validation) |
| Review / QAResult / ChangeRequest | release report, project report (review verdicts, QA evidence) |
| Release | release report (version, checklist, deployment status) |
| Incident | incident report |
| Employee / Department | department report |
| Event / TimelineEntry | the historical spine all reports reference for "what happened" |

Because reports are derived, they are always consistent with the records: a report cannot show a task as done that the Work Item System holds as in review. Where a report needs a value the records do not contain (e.g., a health score), that value is absent, not estimated — see [Section 13](#13-failure-modes).

---

## 9. Quality Standards

A report meets the company standard only when all of the following hold:

- **Leads with the decision.** The first thing the reader sees is the most consequential item — an approval, a blocker, an incident — not a chronological list.
- **Concise.** A report says what is needed and stops. A CEO report that requires scrolling to find the pending approval has failed its purpose.
- **Grounded.** Every status and figure traces to a record. No invented progress, no estimated health, no completion that the work items do not support.
- **Correctly scoped.** The report contains exactly the fields its type defines (Section 7) — no more, no less. Release detail does not leak into a project report; business framing does not leak into a department report.
- **Right altitude for the recipient.** The CEO rendering and the engineering rendering of the same facts differ in altitude, never in truth.
- **Action is explicit.** If the report asks something of the reader, the ask is unambiguous and tells them where to act. If it asks nothing, it says so ("no action needed").
- **Reproducible.** The same state yields the same report.

---

## 10. Escalation Rules

A report is also an escalation surface: it is frequently the moment a problem first reaches the person who can act on it. Escalation through reporting follows the company's escalation paths and structured format (see [COMPANY_RUNTIME.md §17](../architecture/COMPANY_RUNTIME.md#17-escalation-rules) and the [Communication System](./COMMUNICATION_SYSTEM.md#10-escalation-rules)).

| Situation surfaced in a report | Escalate to | Trigger |
|---|---|---|
| Pending approval blocking the next cycle | CEO | Present as the leading item in the CEO report |
| Work blocked beyond one working day | Tech Lead → CTO | Surfaced as an attention item; escalated if unresolved |
| Failed or stalled execution loop | Tech Lead | Surfaced immediately in the CEO report attention items |
| QA No-Go blocking an expected release | Release Manager → CTO; CEO informed | Release report shows No-Go; release does not proceed |
| Degrading health signal | CTO → CEO | Health report shows a degrading trend (Designed) |
| P0/P1 incident | CTO and CEO immediately | Incident report generated and pushed at detection |

Reporting never *resolves* an escalation — it surfaces it to the correct authority in the correct format. The decision itself is owned by the [Decision System](./DECISION_SYSTEM.md) and the relevant SOP. A report that buries a P0 incident below routine progress, or that surfaces a decision to the wrong authority, is an escalation failure (see [Section 13](#13-failure-modes)).

---

## 11. KPIs

| KPI | Target | Measured by |
|---|---|---|
| Report grounding | 100% — every figure in a report traces to a record | Audit of report fields against source records |
| Leading-item correctness | The highest-consequence item leads the report in ≥99% of generations | Comparison of report ordering against the priority model |
| CEO report latency | Recomputed on every dashboard load with no stale state | Dashboard render path |
| Approval surfacing | 100% — every pending approval appears in the CEO report | Pending-checkpoint count vs. report contents |
| Altitude correctness | 0 implementation references in CEO-altitude reports | Review of CEO-facing summaries |
| Release report completeness | Every release candidate has a CEO release summary on file | Release records vs. summaries |
| Incident report timeliness | P0/P1 incident report generated within minutes of detection | Incident record vs. report timestamp (Designed) |

---

## 12. Implementation Status

This section is the authoritative separation of what the platform does today from what is specified but not yet built. It supersedes any impression the prose above might give.

### Implemented today

- **CEO report (next-action recommendation).** `computeNextActions` is a pure rule engine that takes a workspace snapshot (pending plan approvals, awaiting-approval requests, failed/needs-clarification executions, blocked tasks/requests, ready and running sessions, active requests, new-company flag) and returns one primary and several secondary prioritized actions, each with a grounded reason, priority, confidence, and a link.
- **Company intelligence / attention items.** `detectStuckWork` performs a read-only scan for tasks stuck in review/QA/execution, stale approvals, and failed execution/validation loops, returning prioritized, severity-tagged items with recommendations and links.
- **CEO dashboard composition.** The dashboard assembles the CEO report on each load: active runtime requests grouped by phase, task rollups by status, pending-approval counts, the planning lifecycle, and active employees with their assignments.
- **Release report.** `buildCeoReleaseSummary` builds a CEO-facing Markdown release summary from release/task/review/QA/session records, with checklist state, per-task review and QA status, risks, and follow-ups — and does not invent data beyond its input.
- **Historical spine.** `Event` and `TimelineEntry` records capture significant work events; the timeline surface renders company history that all reports reference.
- **Notification delivery of reports.** Approval and decision items surface as notifications, a sidebar bell count, and an inbox/dashboard card (delivery owned by the Communication System).

### Designed (specified, not yet built)

- **Health reports.** No health-scoring engine exists. Velocity, technical debt, quality, knowledge coverage, and deployment-stability signals are specified but not computed.
- **Scheduled digests.** Reports are on-request and event-driven; there is no report scheduler producing daily/weekly push digests.
- **Department reports.** Department load is viewable but there is no dedicated department-report builder with throughput and capacity signals.
- **Incident report builder.** The `Incident` record exists; a service that renders the incident-report format and pushes it at detection does not.
- **Project report as a distinct artifact.** Project status is surfaced live on the dashboard and work board, but there is no standalone, exportable project-report builder separate from those views.

Real-AI summarization of any report is deliberately gated behind the Engineering OS Specification, consistent with the project rule that no AI behavior precedes the specified models. Until then, reports are deterministic derivations of records.

---

## 13. Failure Modes

### A report invents progress or health
A summary shows a feature as "nearly done" or a health score as "good" without records to support it. The CEO makes a shipping or staffing decision on a number the company cannot defend. Caught when a reader drills into the record and finds it does not match the report.

**Response:** Every report field is a derivation of a stored record. A value the records do not contain is absent, not estimated. This is the same hard rule that keeps planning deterministic — fabricated reporting intelligence is forbidden.

### The leading item is buried
A pending approval, a blocked outcome, or a P0 incident appears far down a chronological list while routine progress leads. The reader misses the thing that needed action. Caught when an approval or incident sits unattended despite the reader having "seen" the report.

**Response:** Reports sort by consequence, not recency. Approvals, blockers, failures, and incidents lead. The CEO report's first element is the highest-priority recommended action.

### Wrong altitude
A CEO report includes branch names, PR numbers, or review findings; or a department report is handed to the CEO untranslated. The reader is given detail they cannot use or framing that obscures the point. Caught when the CEO asks "what does this mean?" about their own report.

**Response:** Altitude is matched to the recipient. The same facts are rendered differently for the CEO and for an engineer. Implementation references never appear in CEO-altitude reports.

### Report mistaken for the record
Someone treats a report as the source of truth and edits or acts on it as if changing it changes the work. Caught when the report and the work records diverge.

**Response:** A report is a derived view, never authoritative. The Work Item System and Organizational Memory System own the truth; reports read from them and are regenerated, never edited in place.

### Scheduled digest presented as live
A future scheduled digest is read as current state when it reflects a snapshot from hours earlier, hiding a fresh incident or approval. Caught when an urgent item is acted on late because the reader trusted a stale digest.

**Response:** Every report states the moment it reflects, and urgent items (P0/P1 incidents, blocking approvals) are pushed event-driven and never wait for the next digest. A digest supplements live surfaces; it does not replace them.

### Format drift between report types
Release detail leaks into a project report, or two report types blur into a single generic summary that serves no reader well. Caught when a reader cannot find the field their decision needs.

**Response:** Each type contains exactly the fields Section 7 defines. The decision a report supports determines its shape; a report that tries to serve every reader serves none.

---

## 14. Relationship to Other Documents

- **[COMMUNICATION_SYSTEM.md](./COMMUNICATION_SYSTEM.md)** owns the channels reports travel through — notifications, timeline, CEO summaries, and the structured communication format. Reporting decides *what a summary says*; Communication decides *how and when it is delivered*.
- **[WORK_ITEM_SYSTEM.md](./WORK_ITEM_SYSTEM.md)** owns the work records every report derives from. Reports read these; they never write them.
- **[REVIEW_SYSTEM.md](./REVIEW_SYSTEM.md)** and **[APPROVAL_SYSTEM.md](./APPROVAL_SYSTEM.md)** own the verdicts and gates a report surfaces; the report summarizes them, it does not produce them.
- **[DECISION_SYSTEM.md](./DECISION_SYSTEM.md)** owns the decisions a report escalates to the correct authority.
- **[ORGANIZATIONAL_MEMORY_SYSTEM.md](./ORGANIZATIONAL_MEMORY_SYSTEM.md)** and **[KNOWLEDGE_LIBRARY_SYSTEM.md](./KNOWLEDGE_LIBRARY_SYSTEM.md)** own the durable knowledge reports may reference; a report is a transient view, not a memory record.
- **[PLANNING_SYSTEM.md](./PLANNING_SYSTEM.md)** owns the plans and risks that feed project and CEO reports.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** defines the runtime states, notification rules, timeline updates, and CEO interaction points that reporting renders.
- **[SOP-005: Release](../sops/RELEASE.md)** defines the release procedure whose readiness checklist and changelog the release report summarizes (the changelog itself is a separate, user-facing artifact).
