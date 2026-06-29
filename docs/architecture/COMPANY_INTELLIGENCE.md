# Company Intelligence — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-29  

This document defines how the virtual company continuously understands its own state. Company Intelligence answers a standing set of questions: what does the company know, what changed, what needs attention, what is blocked, what risks exist, and whether the CEO should be informed.

Company Intelligence is not a feature the CEO interacts with directly. It is the awareness layer that makes the company feel alive and trustworthy — the difference between a tool that waits for instructions and an organization that notices things. It runs underneath the Dashboard, the Inbox, and the notification system, turning raw work state into a short list of things worth a human's attention.

This document follows the [Company Runtime](./COMPANY_RUNTIME.md) and the [Domain Model](./DOMAIN_MODEL.md). It does not invent behavior; it specifies how the company's awareness manifests from the objects and events those documents already define. Where the spec describes behavior that exists in code today, [Section 11](#11-implementation-status) maps each model to the real services. The rest of the document is implementation-neutral by design — it describes organizational awareness, not storage or orchestration.

---

## Table of Contents

1. [Intelligence Principles](#1-intelligence-principles)
2. [Intelligence Layers](#2-intelligence-layers)
3. [Employee Awareness Model](#3-employee-awareness-model)
4. [Company Awareness Model](#4-company-awareness-model)
5. [Change Detection Model](#5-change-detection-model)
6. [Risk Awareness Model](#6-risk-awareness-model)
7. [Blocker Detection Model](#7-blocker-detection-model)
8. [Recommendation Model](#8-recommendation-model)
9. [CEO Escalation Model](#9-ceo-escalation-model)
10. [Intelligence Refresh and Triggers](#10-intelligence-refresh-and-triggers)
11. [Implementation Status](#11-implementation-status)
12. [V1 Scope](#12-v1-scope)
13. [Deferred Capabilities](#13-deferred-capabilities)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Intelligence Principles

Company Intelligence is governed by a small set of permanent rules. Every model in this document follows from them.

1. **Awareness is read-only.** Intelligence observes company state; it never mutates it. Detecting a stuck task does not move the task. Recommending an action does not take the action. The mutation always happens through the owning service (Review, QA, Planning, Execution) after a human or an autonomy gate authorizes it. This boundary keeps intelligence safe to run continuously and impossible to blame for side effects.

2. **Grounded, never speculative.** Every intelligence item points at a real object — a Task, a Planning Draft, an Execution Session, a Review, a Repository snapshot. An item the CEO cannot click through to a concrete record does not exist. The company never reports a problem it cannot show.

3. **Useful, not theatrical.** Intelligence exists to reduce the CEO's cognitive load, not to simulate a busy office. The company does not narrate routine work, invent urgency, or surface activity for the appearance of life. A signal reaches the CEO only when it changes what they should do. Silence is a valid and common output.

4. **Filter aggressively; escalate rarely.** The company generates far more events than a CEO should ever see. Intelligence is a funnel: many signals in, a short prioritized list out. The default disposition of any event is "handle internally." Escalation to the CEO is the exception, governed by the autonomy level and a fixed set of mandatory gates.

5. **Explain every signal.** Each intelligence item carries a plain-language reason that grounds it in current state ("3 plans are ready for review; approving unlocks the next execution cycle"). The CEO never sees a bare count or a status code. The reason is organizational, not technical — no commit hashes, branch names, or file paths.

6. **Prioritize deterministically.** Ranking is rule-based and reproducible: the same state always produces the same ordered list. Intelligence is explainable and testable precisely because it does not depend on a model's mood. (Real-AI ranking is a deferred capability — see [Section 13](#13-deferred-capabilities) — and is intentionally gated behind the Engineering OS Specification.)

7. **Respect ownership.** Intelligence routes a signal to whoever owns the resolution. A blocked task goes to the Tech Lead; a stale plan goes to the CEO; a failed deployment signal goes to the Release Manager and CTO. Intelligence never collapses the [Reporting Structure](./COMPANY_RUNTIME.md#17-escalation-rules) — it respects it.

---

## 2. Intelligence Layers

Company Intelligence operates over four layers of state. Each layer answers a different awareness question, and each feeds the [Recommendation](#8-recommendation-model) and [Escalation](#9-ceo-escalation-model) models.

| Layer | Question it answers | Primary inputs |
|---|---|---|
| **Employee awareness** | What does each role know and own right now? | Employee assignments, scoped Memory, current Task |
| **Company awareness** | What is the whole organization doing? | Runtime Requests, Tasks, Execution Sessions, Plans, events |
| **Change awareness** | What changed since last time? | Repository analysis snapshots, work-state transitions |
| **Attention awareness** | What needs a human, and who? | Stuck work, blockers, risks, approval checkpoints |

These layers are cumulative. Attention awareness is computed from company awareness; company awareness is the aggregate of employee awareness; change awareness threads through all of them. The CEO only ever sees the top of the funnel — attention awareness, distilled into a recommendation.

---

## 3. Employee Awareness Model

Employee awareness is the most local layer: each employee's understanding of what they own and what they know. It is the company's intelligence at the level of a single role.

**What an employee is aware of:**

- **Their current assignment.** The Task (or Review, or QA validation) they are responsible for right now, and its Definition of Done.
- **Their scoped memory.** The slice of company memory relevant to their role, retrieved before they act. The retrieval scope per role is defined in [Company Runtime §14, Memory Retrieval](./COMPANY_RUNTIME.md#14-memory-retrieval) — a Backend Engineer is aware of API conventions and database decisions; a Reviewer is aware of quality standards and past anti-patterns.
- **Their domain knowledge.** The authoritative Knowledge Records that constrain their work (approved patterns, API contracts, architecture guides).
- **Their open obligations.** Whether they have work waiting, work blocked, or no active assignment (idle).

**What employee awareness is *not*:** an always-on consciousness. Employees are invoked, not continuously listening (see [Company Runtime §36](./COMPANY_RUNTIME.md#36-event-driven-employee-invocation)). "Awareness" here means: when an employee is invoked, the company assembles the context that makes them aware — assignment, scoped memory, knowledge, runtime state — before they reason. Awareness is a property of the context package, not a background process.

**Awareness gaps are recorded, not hidden.** If an employee retrieves their scoped knowledge and finds nothing relevant to the work at hand, the gap is recorded and the employee proceeds on best judgment, then writes a memory record so the gap is filled for next time. This is how employee awareness compounds — every gap discovered becomes future knowledge. See [Company Runtime §13, Knowledge Retrieval](./COMPANY_RUNTIME.md#13-knowledge-retrieval).

**Aggregation upward.** The dashboard's employee-activity view is employee awareness aggregated: which employees have active tasks, which are blocked, and how many are idle. This is the company's self-image at the level of its people.

---

## 4. Company Awareness Model

Company awareness is the organization's understanding of its own current state — the aggregate across all active work. It is the source of truth for the Dashboard and the input to every recommendation.

**What the company is aware of:**

| Dimension | Concretely |
|---|---|
| **Active requests** | Every Runtime Request not in a terminal state, with its current runtime status |
| **Work in flight** | Every Task by status (in-progress, in-review, in-qa, blocked, done) |
| **Execution state** | Every Execution Session by status (queued, prepared, running, failed, needs_clarification, completed) |
| **Pending decisions** | Plans awaiting CEO approval; review/QA checkpoints paused at an autonomy gate |
| **People** | Which employees are working, blocked, or idle |
| **History** | The recent runtime-event and planning-lifecycle timeline |

**Company awareness is a snapshot, not a stream.** It is computed on demand from durable records — the same records the [Domain Model](./DOMAIN_MODEL.md) defines. There is no separate "intelligence database" that can drift from reality; awareness is always derived fresh from the work itself. This is what guarantees Principle 2 (grounded, never speculative): the company cannot report a state that its own records do not show.

**Request classification is part of awareness.** When a request arrives, the company is aware of what *kind* of request it is and therefore who should receive it. Classification maps each request type to a first-receiver role (feature → Product Manager, bug → Tech Lead, architecture → CTO, security → Security Lead, and so on). An unclassifiable request is itself a signal — it routes to the CTO for interpretation rather than silently applying an assumption. See [Company Runtime §4, Request Intake](./COMPANY_RUNTIME.md#4-request-intake).

**Awareness drives the runtime state.** The company's awareness of where each work item sits is exactly the runtime state defined in [Company Runtime §2](./COMPANY_RUNTIME.md#2-runtime-states). Intelligence does not maintain a parallel notion of state — it reads the runtime and interprets it.

---

## 5. Change Detection Model

Change awareness answers "what is different now?" — both in the codebase the company manages and in the work the company is doing.

**Two kinds of change are detected.**

**1. Repository change.** When the company analyzes a connected repository more than once, it can compare the new analysis against the prior one and reason about what moved. Change detection over a repository produces three layers:

- **Comparison** — the structural diff between two analysis snapshots: files, routes, API endpoints, server actions, data models, and dependencies that were added, removed, or modified.
- **Impact** — an interpretation of that diff: which changes are material (a new data model, a removed route, a dependency change) versus incidental, and which areas of the codebase a change touches.
- **Summary** — a plain-language account of what changed since the last time the company looked.

This lets the company stay oriented as the repository evolves rather than treating every analysis as if it were the first. The mechanics are specified in [Repository Snapshot Comparison](./REPOSITORY_SNAPSHOT_COMPARISON.md), [Repository Impact Analysis](./REPOSITORY_IMPACT_ANALYSIS.md), and [Repository Analysis Snapshots](./REPOSITORY_ANALYSIS_SNAPSHOTS.md).

**2. Work-state change.** The company notices when a work item transitions — a Task moves to in-review, a plan is approved, an execution session fails, a request is blocked. These transitions are the raw material of attention awareness: a transition *into* a waiting state is precisely what later becomes a stuck-work item or an escalation if it lingers.

**Change detection is comparative and silent.** The company compares current state against a prior reference point and surfaces a change only when it is material. It does not narrate every transition. A change becomes a signal only when it crosses into the attention layer — it needs a decision, it is overdue, or it represents risk.

---

## 6. Risk Awareness Model

Risk awareness is the company's understanding of what *could* go wrong, distinct from what *has* gone wrong. A risk is an uncertainty with a likelihood and an impact; an incident is a risk realized.

**Where risk enters the company's awareness:**

- **At planning time.** During technical planning the Tech Lead identifies architectural unknowns, dependency concerns, and capacity constraints and records them as Risks. The planner surfaces significant risks at plan-approval time so the CEO sees them before work begins. The Risk object and its fields are defined in the [Domain Model](./DOMAIN_MODEL.md#risk).
- **At review and implementation time.** A reviewer or engineer who encounters a hazard records it as a Risk rather than carrying it silently.
- **From accumulating failure.** Repeated execution or validation failures on the same work are themselves a risk signal — a sign the task is mis-scoped or the approach is wrong, not just a transient miss.

**Risk severity is a function of likelihood and impact.** A high-likelihood, high-impact uncertainty demands attention; a low-likelihood, low-impact one is recorded and monitored. The company tracks each risk's status (identified → monitoring → mitigated / accepted / realized) so awareness persists rather than resetting.

**Risk awareness feeds escalation, not panic.** Identifying a risk does not stop work. It records the uncertainty, assigns an owner, and — if significant — surfaces it at the next CEO decision point. A risk that is realized becomes an Incident, which has its own response path in [Company Runtime §31, Recovery From Failure](./COMPANY_RUNTIME.md#31-recovery-from-failure).

---

## 7. Blocker Detection Model

Blocker detection is the company noticing that work has *stopped making progress*. It is the most operationally valuable layer of intelligence because a blocked work item is invisible damage — nothing is failing loudly, but nothing is moving.

**The company scans for stalled work** across the categories below. Each is read-only and produces an actionable item with a severity, a plain-language description, and a recommendation.

| Category | What it detects |
|---|---|
| **Task stuck in review** | A task sitting in `in-review` past the review threshold with no progress |
| **Task stuck in QA** | A task held in QA validation without advancing |
| **Task stuck in execution** | An execution session queued or running past the execution threshold without completing |
| **Task blocked** | A task explicitly in `blocked` status for longer than the threshold |
| **Plan awaiting approval** | A planning draft waiting on CEO review past the threshold |
| **Failed execution loop** | An execution session that failed and may be retried fruitlessly |
| **Failed validation loop** | An execution session that failed its validation checks specifically |

**Time is the trigger, not status alone.** A task being in review is normal; a task being in review for a day with no movement is a blocker. The company uses duration thresholds (a review/approval threshold and a longer execution threshold) so that healthy in-flight work is never flagged and genuinely stalled work always is. Severity escalates with duration — work stuck for several multiples of its threshold is high severity.

**Every blocker carries its resolution owner.** A stuck review routes to whoever can review or to the Tech Lead; a stale plan routes to the CEO; an orphaned execution session routes to the operator who can mark it failed. The mapping of blocker type to resolution owner follows [Company Runtime §30, Blocked Work](./COMPANY_RUNTIME.md#30-blocked-work).

**Blocker detection never resolves the blocker.** It surfaces it with a recommendation ("Assign a reviewer, or move the task back to in-progress if review is not imminent"). The resolution is a human or autonomy-gated action, consistent with Principle 1.

---

## 8. Recommendation Model

The recommendation model is the funnel's output: it turns company awareness, change awareness, and attention awareness into a single prioritized answer to "what should the CEO do next?"

**Shape of a recommendation.** The company produces **one primary action** and **up to three secondary actions**. More than that is noise. Each action carries:

- a **title** (what to do, in CEO language),
- a **reason** (one sentence grounding it in current state),
- a **priority** (`urgent` → `high` → `medium` → `low`),
- a **confidence** (`high` / `medium` / `low`),
- and a **destination** (where to go to act on it).

**Priority order.** Recommendations are ranked by a fixed precedence, highest first:

1. **Pending plan approvals** — plans ready for CEO review; approving unlocks the next cycle. *(urgent)*
2. **Requests awaiting approval** — work stalled until the CEO acts. *(urgent)*
3. **Failed or stalled executions** — agents that could not finish, or that paused needing clarification. *(high)*
4. **Blocked work** — blocked requests and blocked tasks. *(high)*
5. **Ready-to-run sessions** — prepared/queued work awaiting hand-off to an agent. *(medium)*
6. **Active work being monitored** — work in progress; check back or queue the next priority. *(low)*
7. **Idle / new company** — no active work; submit the first (or next) outcome. *(low)*

Within a priority tier, higher-confidence actions rank first. Ranking is deterministic — identical state yields identical output — satisfying Principle 6 and making the model testable.

**The recommendation is advisory.** It tells the CEO where their attention pays off most; it never takes the action. Acting on a recommendation always lands the CEO on the real surface (the Inbox, the work board, the plan review) where the owning service performs the mutation under the autonomy policy.

---

## 9. CEO Escalation Model

Escalation is the final, most consequential layer: deciding whether a signal is worth interrupting the CEO. The default answer is no. The company handles the overwhelming majority of events internally; only a filtered few become notifications.

**A signal becomes a CEO notification only when:**

1. An **approval gate** requires CEO action (a plan to approve, or a review/QA checkpoint paused at a sub-threshold autonomy level).
2. A **P0/P1 incident** is detected in production.
3. A **security hold** affects a release the CEO is expecting.
4. A **feature the CEO submitted has shipped** and is live.
5. A **material company-health change** occurs.
6. A **QA No-Go blocks an expected release.**

**The company never notifies the CEO for** routine task completions, individual review findings, defect reports and their resolution, internal employee coordination, QA test-case creation, or staging deployments. These are handled inside the organization. The full inclusion/exclusion list is the authoritative one in [Company Runtime §25, Notification Rules](./COMPANY_RUNTIME.md#25-notification-rules).

**Escalation is governed by the autonomy level.** What requires CEO approval — and therefore what escalates — is set by the company's autonomy level, applied through one shared policy so the manual path and the autonomous driver escalate identically:

| Autonomy level | The CEO is asked to approve |
|---|---|
| Manual | Every gate (prepare, run, push, PR, review, QA) |
| Suggest | Running, pushing, opening a PR, review/QA sign-off |
| Assist | Running the agent, merging, review/QA sign-off |
| Delegate | Merging only |
| Autonomous | Nothing routine — only P0/P1 incidents and security holds |

When an action `requires_approval` at the active level, the company raises a persisted **approval checkpoint** and pauses the work there rather than proceeding. The checkpoint becomes a "needs your decision" item; approving it resumes the flow through the real service, and rejecting it sends the work back. This is the mechanism by which sub-threshold autonomy pauses for the CEO while full autonomy drives straight through — same code, same guardrails, only the level differs.

**Escalation content is organizational, never technical.** A notification reads "Your authentication feature has passed review and is now in QA," not "PR #442 approved after 3 blocking findings." The CEO is shown outcomes and decisions, never implementation. Notifications that carry a decision are typed as such so the surface can offer Approve / Reject inline.

---

## 10. Intelligence Refresh and Triggers

Company Intelligence is recomputed on demand rather than maintained as a long-lived background state. This keeps awareness honest — it can never be staler than the records it reads.

**When intelligence is computed:**

- **On view.** Opening the Dashboard or the Inbox recomputes the recommendation, the pending-approval count, and the active-work view from current records.
- **On scan.** Blocker and stuck-work detection runs as a read-only scan over the company's work records, comparing each item's age against its threshold.
- **On analysis.** Repository change awareness is computed when a new analysis snapshot exists to compare against a prior one.
- **On transition.** Work-state changes (a task entering review, a session failing, a checkpoint being raised) update the durable records that the next computation reads.

**No drift, by construction.** Because every layer is derived from the same durable work records, there is no cache to invalidate and no shadow state to reconcile. The cost of this is recomputation; the benefit is that the company's self-image is always true. Where recomputation becomes expensive at scale, caching is a deferred optimization — never a separate source of truth.

---

## 11. Implementation Status

This section grounds each model in what genuinely exists in the platform today, and separates it from what is designed but not yet built. It is the bridge between this spec and the codebase; the rest of the document stays implementation-neutral.

**Implemented today:**

| Model | Where it lives | Behavior that exists |
|---|---|---|
| Recommendation | `next-action-recommendation.ts` | Pure, deterministic rule engine: takes a workspace snapshot, returns one primary + up to three secondary actions with priority/confidence/reason. Wired into the Dashboard. |
| Blocker detection | `stuck-work-detector.ts` | Read-only scan for tasks stuck in review/blocked, stuck execution sessions, stale plans, and failed/validation loops, with duration thresholds and severity. |
| Escalation / approval gates | `autonomy-policy.ts`, `approval-checkpoints.ts` | Single shared autonomy matrix; sub-threshold actions raise a persisted checkpoint; approve/reject resumes through the real Review/QA services. Pending-approval count shown on the Dashboard and Inbox. |
| Notifications | `notify.ts` | CEO notifications with type (`info` / `warning` / `alert` / `decision` / `progress` / `blocker`) and priority; `decision` notifications drive inline Approve / Reject. |
| Change detection (repository) | `repository-change-intelligence.ts` and the snapshot comparison / impact services | Snapshot-vs-snapshot comparison and impact analysis between two analyses, with a plain-language summary. |
| Company awareness | Dashboard composition over Runtime Requests, Tasks, Execution Sessions, and Planning Drafts | Derived-on-view snapshot; no separate intelligence store. |
| Request classification | `request-routing.ts` | Maps request type to first-receiver role. |

**Designed but not yet built (planned):**

- **Risk awareness as a first-class surface.** The Risk object is defined in the Domain Model and risks are produced during deterministic planning, but a dedicated risk-intelligence view and lifecycle tracking surface are not yet built.
- **Standing background scans.** Blocker detection runs on demand; a scheduled scan that proactively raises notifications for newly-stuck work (beyond approval checkpoints) is planned.
- **Health-metric intelligence.** Company-health change as an escalation trigger is specified but not yet computed from live signals.
- **AI-assisted ranking and summarization.** All ranking and summarization today is deterministic and templated. Real-AI prioritization is intentionally gated behind the Engineering OS Specification (see [Section 13](#13-deferred-capabilities)).

No capability is described in this document that the platform does not either implement today or have a defined home for in the Domain Model. Inventing intelligence the company cannot back with a real record is prohibited by Principle 2.

---

## 12. V1 Scope

Company Intelligence in V1 delivers the awareness loop that makes the company trustworthy to leave running, and nothing beyond it.

**In scope for V1:**

- Deterministic **next-action recommendations** on the Dashboard (one primary + secondary, prioritized and explained).
- **Blocker and stuck-work detection** as a read-only scan with duration thresholds and severity.
- **Approval-checkpoint awareness**: pending review/QA decisions surfaced as a count and an actionable queue, resumable through the real services.
- **CEO escalation** governed by the shared autonomy policy, with filtered notifications and inline decisions.
- **Repository change awareness** between analysis snapshots (comparison + impact + summary).
- **Request classification** to the correct first-receiver role.
- **Company-state snapshot** composed on demand from durable records.

**Explicitly out of scope for V1:** predictive intelligence, AI-ranked recommendations, autonomous risk mitigation, cross-company learning, and any awareness surface that is not backed by a concrete record. These are deferred (next section).

---

## 13. Deferred Capabilities

The following are deliberately deferred. Several are gated behind the **Engineering OS Specification v1.0**, which must define the company, work, memory, and decision models before real-AI behavior is permitted. This gating is a hard project rule, not a backlog accident.

- **AI-assisted recommendation and summarization.** Replacing the deterministic ranking with model-driven prioritization and natural-language situational summaries. *Gated by the Specification.*
- **Predictive risk awareness.** Forecasting which work is likely to stall or fail before it does, from historical patterns rather than elapsed time.
- **Standing background scans with proactive alerts.** A scheduler that continuously runs blocker detection and raises notifications for newly-stuck work, instead of computing on view.
- **Company-health intelligence.** Live computation of architecture, velocity, testing, and review-quality health, with change as an escalation trigger.
- **Cross-feature and cross-company learning.** Intelligence that improves recommendations by reasoning over the company's accumulated history of what worked.
- **Risk and incident intelligence surfaces.** Dedicated views for risk lifecycle and incident awareness, beyond the records the Domain Model already defines.
- **Caching of derived awareness.** A performance optimization for scale; never a parallel source of truth.

Until these ship, the company's intelligence is intentionally modest, deterministic, and honest — which is preferable to intelligence that is impressive and wrong.

---

## 14. Relationship to Other Documents

- **[COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md)** defines the runtime states, escalation rules, notification rules, and blocked-work handling that this document's awareness layers observe and interpret.
- **[DOMAIN_MODEL.md](./DOMAIN_MODEL.md)** defines the objects intelligence reads — Runtime Request, Task, Execution Session, Plan, Review, QA Result, Risk, Notification — and their lifecycle rules.
- **[INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md)** defines the Dashboard and Inbox surfaces where intelligence is presented to the CEO.
- **[TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)** defines the modules that implement the behaviors mapped in [Section 11](#11-implementation-status).
- **[GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md)** defines the execution-session and PR state that blocker detection and recommendations read.
- **[REPOSITORY_SNAPSHOT_COMPARISON.md](./REPOSITORY_SNAPSHOT_COMPARISON.md)**, **[REPOSITORY_IMPACT_ANALYSIS.md](./REPOSITORY_IMPACT_ANALYSIS.md)**, and **[REPOSITORY_ANALYSIS_SNAPSHOTS.md](./REPOSITORY_ANALYSIS_SNAPSHOTS.md)** define the repository change-detection mechanics summarized in [Section 5](#5-change-detection-model).
