# CEO Dashboard — UX Specification

**Status:** Approved  
**Version:** 1.0  
**Owner:** Product Manager  
**Approved By:** CEO  
**Last Updated:** 2026-06-29  

This document specifies the experience of the CEO Dashboard — the primary surface of Engineering OS and the first thing the CEO sees on every visit. It defines what the Dashboard communicates, how it is prioritized, and how it should feel. It is a UX specification, not a frontend implementation. It prescribes no components, routes, pixel values, colors, or framework choices. Those belong to wireframes and engineering, which this document exists to guide.

The structural inventory of the Dashboard — which objects appear and where they live — is owned by [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md), Section 8. The behavior that populates the Dashboard is owned by [Company Runtime](../architecture/COMPANY_RUNTIME.md). This document is the experience layer between them: it takes the structure the IA defines and the live state the Runtime produces, and specifies how that becomes an interface a CEO trusts.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Design Principles](#2-design-principles)
3. [Information Hierarchy](#3-information-hierarchy)
4. [Main Sections](#4-main-sections)
5. [The Daily Summary](#5-the-daily-summary)
6. [Employee Activity Model](#6-employee-activity-model)
7. [Active Work Cards](#7-active-work-cards)
8. [Risk and Blocker Surfaces](#8-risk-and-blocker-surfaces)
9. [Decision Request Surfaces](#9-decision-request-surfaces)
10. [Recent Completions](#10-recent-completions)
11. [Company Health Surface](#11-company-health-surface)
12. [Upcoming](#12-upcoming)
13. [Empty States](#13-empty-states)
14. [Interaction Model](#14-interaction-model)
15. [Language and Tone](#15-language-and-tone)
16. [Density and Refresh Behavior](#16-density-and-refresh-behavior)
17. [Success Criteria](#17-success-criteria)
18. [Out of Scope](#18-out-of-scope)
19. [Relationship to Other Documents](#19-relationship-to-other-documents)

---

## 1. Purpose

The Dashboard exists to answer one question the moment the CEO arrives: **"What is my company doing right now, and does anything need me?"**

Everything on the Dashboard serves that question. It is not a reporting tool, an analytics console, or a settings panel. It is the front door of a working engineering organization. Opening it should feel like walking into an office where a team is already at work — not like opening a database, a ticket queue, or an AI chat window.

The Dashboard has three jobs, in priority order:

1. **Surface what needs the CEO.** Pending approvals, blocked work, and escalations are the only things that should ever make the CEO act. These are presented first because acting on them is the CEO's actual job.
2. **Show the company is alive.** A live view of who is working on what, in plain language, so the CEO feels the organization moving without having to manage it.
3. **Confirm progress.** Recently completed work and current company health, so the CEO closes the Dashboard reassured rather than anxious.

If the Dashboard succeeds, the CEO can understand the entire state of their company in well under a minute, take any action that is required of them, and leave — without ever learning a branch name, a pull request number, or a file path. This is the embodiment of Product Principle 1, *The User Is Always the CEO* (see [Product Requirements](../product/PRODUCT_REQUIREMENTS.md), Section 7), and of feature F-01, Company Dashboard.

---

## 2. Design Principles

These principles govern every decision on the Dashboard. When two principles conflict, the earlier one wins.

**2.1 Attention before activity.**  
What requires the CEO comes before what the company is doing on its own. A blocked task or a pending approval always outranks a smooth in-progress task, regardless of recency or size.

**2.2 Outcomes, never operations.**  
Every item is framed by what it accomplishes or what it needs, never by how the engineering was done. The Dashboard describes "Implementing the password reset email" — not a commit, a diff, or a CI job. This follows IA Principle 1.1, *The CEO sees outcomes, not operations.*

**2.3 The summary is the surface; depth is earned.**  
The Dashboard is breadth-first. It shows the top of every section and nothing more. The CEO drills into detail only by choosing to. No section on the Dashboard is the full version of itself — each is a doorway, per IA Principle 1.4.

**2.4 Silence is information.**  
An empty Pending Approvals queue is a feature, not a gap. When nothing needs the CEO, the Dashboard says so plainly and calmly. The product never manufactures urgency, badges, or red counts to drive engagement.

**2.5 The company speaks for itself.**  
Activity is written in the voice of employees doing work, in the first person where it adds life, never theatrically. The CEO should feel they have a team, not that they are watching a progress bar. This follows Product Principle 7, *The experience should feel alive without being theatrical.*

**2.6 One glance, one truth.**  
Every number, status, and label on the Dashboard reflects live company state at load time. The Dashboard never shows stale or optimistic state. If the company's state is uncertain, the Dashboard says it is uncertain rather than guessing.

**2.7 The CEO acts in four ways only.**  
Every interactive element on the Dashboard maps to one of the four CEO interaction modes defined in IA Section 21: **goal input, approval, browse, configure.** Anything that asks the CEO to do something outside those four modes does not belong here.

---

## 3. Information Hierarchy

The Dashboard is read top to bottom in descending order of demand on the CEO. The hierarchy is fixed; it does not reorder based on volume, because a predictable layout is what lets the CEO scan in seconds.

| Rank | Zone | Question it answers | CEO demand |
|---|---|---|---|
| 1 | Daily Summary | "What changed and what needs me?" | Read, then act |
| 2 | Decision Requests (Pending Approvals) | "What am I blocking?" | Act now |
| 3 | Risks and Blockers | "What is stuck or at risk?" | Act or acknowledge |
| 4 | Active Work | "What is the company doing right now?" | Observe |
| 5 | Recent Completions | "What did we finish?" | Reassure |
| 6 | Company Health | "Is the company in good shape?" | Reassure |
| 7 | Upcoming | "What is coming next?" | Anticipate |

The top three zones are the **action layer** — they are why a responsible CEO opens the product daily. The bottom four are the **awareness layer** — they make the company feel real and progress feel tangible. On a first glance the action layer must be fully visible without scrolling when it contains anything; the awareness layer may extend below the fold.

This is the experience expression of the structural sections enumerated in IA Section 8 (Active Work, Pending Approvals, Recent Completions, Company Health, Upcoming). Decision Requests and Risks/Blockers are pulled to the top of the experience because acting on them is the CEO's job; the IA inventory does not imply visual order, and this document sets it.

---

## 4. Main Sections

The Dashboard is composed of seven zones, each a doorway into a deeper surface. No zone is its own full view; each links onward into the [Inbox](../architecture/INFORMATION_ARCHITECTURE.md#19-notification-structure), [Work](../architecture/INFORMATION_ARCHITECTURE.md#12-project-structure), [Company](../architecture/INFORMATION_ARCHITECTURE.md#9-company-structure), or [Timeline](../architecture/INFORMATION_ARCHITECTURE.md#18-timeline-structure) sections.

| Zone | Primary content | Drills into |
|---|---|---|
| Daily Summary | One narrative paragraph + the day's key counts | The relevant zone below |
| Decision Requests | Approval and escalation queue | Inbox → Approval Request |
| Risks and Blockers | Stuck, at-risk, and failed work | Work → Project / Incident |
| Active Work | Live employee activity cards | Work → Project → Task |
| Recent Completions | Last N shipped/approved/passed items | Timeline / Work → Release |
| Company Health | Organizational health indicators | Company → Health Metrics |
| Upcoming | Next milestones and planned releases | Work → Milestones / Releases |

A persistent **Goal Input** affordance is available from the Dashboard at all times — the single most important action a CEO can take is to state a new goal. It is always reachable but never competes visually with the action layer. Its behavior (planning, Feature Brief generation, approval) is specified in [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) F-02 and is out of scope for this document beyond its placement.

---

## 5. The Daily Summary

The Daily Summary is the Dashboard's headline. It is a single, short, plain-language narrative that tells the CEO what has happened since they last looked and what — if anything — is waiting on them. It is the one place the Dashboard speaks *to* the CEO rather than showing them objects.

### 5.1 Purpose

The Summary lets a CEO who has thirty seconds understand their entire company without reading a single card. It is the company's standup delivered to the CEO, not a dashboard widget.

### 5.2 Content model

The Summary is assembled from live runtime state, not authored copy. It draws from at most four facts, in this order, and omits any that are empty:

1. **What needs you** — count and one-line characterization of pending approvals and escalations.
2. **What is at risk** — count of blocked or at-risk work items.
3. **What moved** — count of items completed and items started since the last visit.
4. **Overall posture** — a single calm characterization of company health (e.g., "healthy," "steady," "watch security").

### 5.3 Examples

> "Two things need you: a release approval for **Password Reset** and a security escalation on **Billing**. Three tasks moved forward overnight. The company is healthy."

> "Nothing needs you right now. Your team shipped **Dark Mode** and is implementing two tasks on **Customer Dashboard**. The company is healthy."

> "All quiet. No active work and nothing awaiting you. Ready when you are — state a goal to get the company moving."

### 5.4 Rules

- The Summary never exceeds three sentences.
- It always leads with what needs the CEO; if nothing does, it says so first and plainly.
- It uses feature and project names, never task identifiers, employee internals, or implementation nouns.
- It never invents reassurance. If health is degraded, the Summary says so without alarm.
- The "since you last looked" window is anchored to the CEO's previous Dashboard visit, not a fixed calendar day, so the Summary is always relevant to *this* CEO's rhythm.

---

## 6. Employee Activity Model

The Employee Activity model is what makes the Dashboard feel like an office rather than a tracker. It is the visible answer to "who is doing what right now," and it is the emotional core of feature F-03, Employee Status Feed.

### 6.1 The unit: an employee at work

Each active employee is represented by their current activity, expressed as a role acting on a named piece of work. The model has five fields, all CEO-safe:

| Field | Example | Notes |
|---|---|---|
| Employee | "Backend Engineer" | Role-first; a name may accompany the role |
| Activity verb | "Implementing," "Reviewing," "Testing," "Planning," "Releasing" | Plain-language phase, derived from the SOP phase |
| Subject | "the password reset email endpoint" | The work, in outcome language |
| Context | "Password Reset · Customer Auth" | Project · Feature |
| Duration | "for 40 minutes" | How long on this activity |

### 6.2 Voice

Activity may be rendered in the first person where it adds life — "I'm implementing the password reset email endpoint" — but is never performative, never narrates internal reasoning, and never reports mechanical steps ("running tests," "pushing a commit"). The CEO sees a professional at work, described at the altitude of a status, not a log.

### 6.3 What it must never expose

Per [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) Section 2, employee activity never surfaces branch names, pull request numbers, CI status, file paths, diffs, commands, or model/provider details. The activity verb is derived from the work item's current SOP phase (see [Company Runtime](../architecture/COMPANY_RUNTIME.md), Section 35), translated into a word a CEO uses, not an engineer.

### 6.4 Idle and availability

An employee with no current assignment is not shown as a card in Active Work; absence from the feed is how the Dashboard communicates idleness. The full roster, including who is available and who is idle, lives in the [Company](../architecture/INFORMATION_ARCHITECTURE.md#9-company-structure) section. The Dashboard shows only employees who are actively working, so a busy feed always means a busy company.

---

## 7. Active Work Cards

Active Work is the live feed of employee activity from Section 6, presented as a set of cards. It is the largest awareness-layer zone and the one the CEO browses most.

### 7.1 Card anatomy

Each card carries exactly the five activity fields, plus a single status indicator and an optional one-line "latest" note — the most recent thing the employee communicated, if it adds information. Nothing else appears on the face of a card. A card is a doorway, not a detail view.

### 7.2 Status indicator

Every card shows one status from the shared vocabulary defined in IA Section 21.2:

| Indicator | Meaning |
|---|---|
| In progress | Work is moving normally |
| Awaiting approval | Paused at an autonomy gate, waiting on the CEO |
| Blocked | Cannot proceed; needs a dependency or decision |
| At risk | Moving, but behind estimate or flagged by the company |

Cards in **Awaiting approval** or **Blocked** states are also represented in the action layer (Sections 8 and 9); the Active Work card is their awareness-layer echo, not their primary call to action. The same underlying item is never counted twice as a demand on the CEO.

### 7.3 Ordering

Active Work cards are ordered by status severity first (Blocked, At risk, Awaiting approval, In progress) and by duration second. This keeps anything wobbling near the top of the feed without promoting it into the action layer, which is reserved for items that genuinely require the CEO.

### 7.4 Drill-down

A card links to its parent Project's overview (IA Section 12), never directly to a Task list. The CEO enters work through the Project, which is the unit they are meant to follow, and reaches Tasks only on further drill-down.

---

## 8. Risk and Blocker Surfaces

This zone answers "what is stuck or at risk?" It exists because the single most damaging failure mode for a delegating CEO is silent stalling — work that has quietly stopped while the CEO assumes it is moving.

### 8.1 What appears here

| Surface | Trigger | Severity |
|---|---|---|
| Blocked work | A task or project cannot proceed without a dependency or a CEO decision | High |
| At-risk work | Work is materially behind its estimate or flagged by the company | Medium |
| Active incident | A production incident is open (P0/P1 surfaced prominently) | Critical |
| Failed execution | An execution run was halted — for example, a guardrail block | High |

Severity and incident handling follow [Company Runtime](../architecture/COMPANY_RUNTIME.md) Sections 17 (Escalation Rules) and 30 (Blocked Work). The Dashboard presents the outcome of those rules, not the rules themselves.

### 8.2 Presentation model

Each entry states, in plain language and in this order:

1. **What is stuck** — the feature or project, named.
2. **Why** — the blocking reason in outcome terms ("waiting on a decision about which email provider to use"), never an error string, stack trace, or command.
3. **Who is waiting** — the employee or workflow that is paused.
4. **What would unblock it** — the specific thing needed, ideally an action the CEO can take or delegate.

### 8.3 The CEO's escape hatch

Where a blocker is something only the CEO can resolve, the entry becomes a Decision Request and is mirrored into Section 9 with an action. Where a blocker is internal — one employee waiting on another — the Dashboard shows it for awareness but presents no CEO action, because resolving it is the company's job, not the CEO's. The distinction must be unmistakable: the CEO must never be left wondering whether a blocker is theirs to clear.

### 8.4 When it is empty

When nothing is blocked or at risk, this zone collapses to a single calm line ("Nothing is blocked. Everything in progress is on track.") rather than disappearing entirely, so the CEO actively learns the absence of risk rather than inferring it.

---

## 9. Decision Request Surfaces

Decision Requests are the only part of the Dashboard that asks the CEO to act. This is the action layer's core and the Dashboard's most important zone. It is the surface expression of the [Inbox](../architecture/INFORMATION_ARCHITECTURE.md#19-notification-structure) approval queue and of feature F-10, Notifications and Approvals.

### 9.1 What qualifies as a Decision Request

Only events that genuinely require the CEO appear here. Per IA Section 19, routine completions and implementation details never generate a request. The qualifying types are:

| Type | Why it reaches the CEO |
|---|---|
| Approval request | An autonomy gate requires CEO sign-off before the company proceeds |
| Escalation | An employee routed a decision that exceeds internal authority |
| Incident decision | A production incident requires a CEO-level call (e.g., approve rollback) |

The points at which approvals appear are determined by the company's **autonomy level** (Manual / Assist / Delegate / Autonomous — see [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) F-06). At higher autonomy fewer requests reach the Dashboard; at Autonomous, the company may pause only for escalations and critical decisions. The Dashboard reflects this faithfully — it never fabricates approvals the autonomy level does not require, and it never suppresses one the autonomy level does require.

### 9.2 Each request must answer four questions

Following IA Section 19's Notification Detail model, every Decision Request states, before the CEO is asked to act:

1. **What is being requested** — in one plain sentence.
2. **Why it matters** — the stakes, in outcome terms.
3. **What happens if you approve** — the concrete next step.
4. **What happens if you reject** — the alternative path.

A request the CEO cannot understand without drilling in has failed its job. The four answers are present on the face of the request; drill-down exists for those who want the full context chain, not as a prerequisite for deciding.

### 9.3 Actions

Each request exposes the minimal action set: **Approve**, **Reject**, and **View**. Approve and Reject act in place and resume the underlying workflow through the real company services; the CEO does not navigate away to decide. Every approval and rejection is permanently recorded in the work item's history (F-06 acceptance criteria; [Company Runtime](../architecture/COMPANY_RUNTIME.md) Section 18). Critical requests — an open P0 incident, for example — cannot be dismissed without an action, per IA Section 19's notification rules.

### 9.4 Ordering

Decision Requests are ordered by priority (Critical → High → Medium) and then by age, oldest first within a priority, so the thing the CEO has been blocking longest rises to the top. Count and priority of pending requests are also reflected on the global Inbox indicator so the CEO sees the demand even from other surfaces.

---

## 10. Recent Completions

Recent Completions is the reassurance layer's anchor. It answers "what did we finish?" and is the visible proof that delegation is producing results.

### 10.1 What appears

The last N significant completions, drawn from the company [Timeline](../architecture/INFORMATION_ARCHITECTURE.md#18-timeline-structure):

- Features shipped
- Releases deployed
- Reviews approved
- QA validations passed
- Incidents resolved

### 10.2 Presentation

Each completion is a single line: what was completed, in feature/outcome language, and when. A shipped feature links to its [Release](../architecture/INFORMATION_ARCHITECTURE.md#15-release-structure) record and, through it, to its Feature Memory entry. The CEO can trace any completion back to the work that produced it, but the Dashboard shows only the headline.

### 10.3 Rules

- Only meaningful, CEO-relevant completions appear. Individual task completions do not — they would turn the reassurance layer into a noise feed and violate IA Section 19's notification discipline.
- Completions are stated as accomplishments ("Shipped Password Reset"), never as state transitions ("task moved to done").
- This zone is read-only. It informs; it never asks the CEO to act.

---

## 11. Company Health Surface

Company Health is the Dashboard's at-a-glance assurance that the organization is in good shape — not just busy. It is a compressed summary of the indicators defined in IA Section 9 (Health Metrics) and surfaces feature F-01's health requirement.

### 11.1 Indicators shown

| Indicator | What it tells the CEO |
|---|---|
| Architecture health | Is the codebase structurally sound? |
| Security status | Are there open security concerns? |
| Documentation coverage | Is the work being documented? |
| Technical debt | Is debt accumulating? |
| Deployment stability | Are releases landing cleanly? |
| Active incidents | Is anything broken in production right now? |

### 11.2 Presentation

Each indicator is a single qualitative state — healthy, watch, or attention — not a raw score, percentage, or chart on the Dashboard. The Dashboard's job is to tell the CEO whether to worry, not to make them interpret metrics. Detailed breakdowns, trends, and underlying numbers live in [Company → Health Metrics](../architecture/INFORMATION_ARCHITECTURE.md#9-company-structure), which this surface links into.

### 11.3 Rules

- An indicator in "attention" links directly to the work or finding that caused it, so concern is always traceable to a cause.
- Health is never gamified — no streaks, no celebratory states, no manufactured red.
- If health data is unavailable (for example, immediately after onboarding before analysis completes), the indicator reads "not yet measured," never a fabricated "healthy."

---

## 12. Upcoming

Upcoming answers "what is coming next?" It is the lowest-demand zone and exists to let the CEO anticipate without managing.

### 12.1 What appears

- Milestones planned within the next sprint window
- Releases scheduled or pending readiness
- Features approaching their estimated completion

### 12.2 Presentation

Each item is a single line: what is expected and when, in outcome language. Items link into [Work → Milestones](../architecture/INFORMATION_ARCHITECTURE.md#12-project-structure) or the relevant Release. Estimates are presented as estimates, never as commitments — the Dashboard never implies a certainty the company has not earned (see [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) Open Question OQ-04 on estimation confidence).

---

## 13. Empty States

Empty states are first-class UX, not afterthoughts. Because the Dashboard's most desirable condition — "nothing needs you" — is itself an empty state, these screens carry as much design intent as the populated ones. Every empty state is calm, honest, and points the CEO toward their next meaningful action.

### 13.1 Brand-new company (first run)

Before a repository is connected or any goal is stated, the Dashboard is mostly empty by design. It must not look broken. It introduces the company and points to the first step.

> "Your engineering company is staffed and ready. Connect a repository so your team can learn your codebase, then state your first goal."

The single prominent action is repository connection (F-08), followed by goal input. No fabricated activity, sample data, or placeholder cards are ever shown. (Detailed first-run guidance is owned by the Onboarding experience, not the Dashboard; this is the Dashboard's resting state until the company has work.)

### 13.2 Connected, no active work

The company knows the codebase but has nothing in flight.

> "Your team is ready and idle. Nothing is in progress and nothing needs you. State a goal to put the company to work."

Goal input is the single highlighted affordance.

### 13.3 Nothing needs you (the steady state)

Work is in progress, but the action layer is empty. This is the Dashboard's ideal everyday condition.

- Daily Summary leads with "Nothing needs you right now."
- Decision Requests collapses to "Your inbox is clear."
- Risks and Blockers collapses to "Nothing is blocked."
- Active Work, Recent Completions, Health, and Upcoming populate normally.

The message is one of trust: the company is handling itself, and the CEO is free to step away.

### 13.4 Awaiting analysis

Immediately after repository connection, while the company is still building its understanding, the Dashboard shows that the company is learning rather than that it is empty.

> "Your CTO and Tech Lead are studying your repository. You'll see a summary here when they're done."

### 13.5 Empty-state principles

- An empty zone always explains itself; it never simply vanishes, leaving the CEO unsure whether it failed to load.
- Every empty state offers exactly one clear next action, never a menu of options.
- Empty states never use sample or mock data to appear fuller than the company is.
- The tone is calm and confident, never apologetic and never urgent.

---

## 14. Interaction Model

The CEO interacts with the Dashboard through only the four modes defined in IA Section 21.4. Every interactive element maps to one of them.

| Mode | On the Dashboard | Leads to |
|---|---|---|
| Goal input | State a new goal | Planning flow (F-02) |
| Approval | Approve / Reject a Decision Request | Workflow resumes (F-10) |
| Browse | Open any card, completion, health indicator, or upcoming item | The relevant detail surface |
| Configure | Reach company settings (e.g., autonomy level) | [Company → Settings](../architecture/INFORMATION_ARCHITECTURE.md#9-company-structure) |

Rules:

- **Browse never mutates.** Opening a card, a completion, or a health indicator only navigates; it never changes company state.
- **Approve and Reject are the only state-changing actions inline on the Dashboard**, and both are confirmed by a recorded outcome the CEO can see.
- **There is no in-line editing of work.** The CEO cannot rename a task, reassign an employee, or alter a plan from the Dashboard — those are implementation acts the CEO never performs (Product Principle 1).
- **Every drill-down is reversible** via breadcrumbs (IA Section 21.1); the CEO never gets lost going deep and can always return to the Dashboard in one step.

---

## 15. Language and Tone

The Dashboard's words carry the CEO experience as much as its layout. The standard is consistent across every zone.

- **Outcome nouns, not engineering nouns.** "The password reset email," not "the `sendResetEmail` handler."
- **Plain verbs for phases.** "Implementing," "Reviewing," "Testing," "Releasing" — never "executing," "running," "merging."
- **Active, professional voice.** The company is competent and calm. It does not hedge excessively, over-apologize, or over-celebrate.
- **No identifiers.** No branch names, PR numbers, commit hashes, file paths, task IDs, model names, or provider names ever appear on the Dashboard. Their presence is a defect, per IA Section 2.
- **First person where it adds life, third person where it adds clarity.** Employee activity may speak in the first person; system summaries and counts speak plainly in the third.
- **Honest framing.** The Dashboard never overstates progress, manufactures urgency, or implies certainty the company has not earned (Product Principle 7).

---

## 16. Density and Refresh Behavior

This section specifies experience expectations, not implementation mechanics.

**16.1 Glanceability.** The action layer (Daily Summary, Decision Requests, Risks and Blockers) must be comprehensible in a single glance when it contains anything. The CEO should never have to scroll to discover that something needs them.

**16.2 Liveness.** The Dashboard reflects current company state. Active Work, Decision Requests, and Risks update as the company moves, so a CEO watching the Dashboard sees the office in motion rather than a snapshot they must manually refresh. The exact refresh mechanism is an engineering decision; the experience requirement is that the Dashboard never silently shows stale state.

**16.3 Truthful loading.** While live state is being fetched, zones show a neutral loading state, never last-known or optimistic values presented as current. A momentarily unknown state is shown as unknown.

**16.4 Volume discipline.** When a zone has more items than fit comfortably, it shows the top N by its ordering rule and offers a single "view all" path into the owning section. The Dashboard never becomes a long scroll; overflow is a doorway, not a dump.

**16.5 Calm by default.** The Dashboard does not animate for attention, pulse, or use alarm color outside genuine Critical states. Motion and emphasis are reserved for things that have actually changed and genuinely matter.

---

## 17. Success Criteria

The Dashboard is successful when all of the following are true. These criteria are testable against wireframes and against the shipped product, and they trace directly to the ticket's acceptance criteria.

**17.1 The office test.** A new CEO opening the Dashboard for the first time describes the experience as "walking into an engineering team that's already working," not "opening a tool."

**17.2 The thirty-second test.** A CEO can determine, in under thirty seconds and without scrolling past the action layer, (a) whether anything needs them, (b) what the company is currently doing, and (c) whether the company is healthy.

**17.3 The no-implementation test.** Nowhere on the Dashboard — in any populated, empty, or loading state — does a branch name, PR number, CI status, file path, diff, command, task ID, model name, or provider name appear. This is a hard pass/fail gate (the *protects the user from implementation detail* acceptance criterion).

**17.4 The action-clarity test.** Every Decision Request communicates what is being requested, why it matters, and the consequence of approving versus rejecting — before the CEO acts, and without drilling in.

**17.5 The silence test.** When nothing needs the CEO, the Dashboard says so plainly and the CEO leaves reassured rather than hunting for hidden problems.

**17.6 The four-modes test.** Every interactive element maps to goal input, approval, browse, or configure. Anything that asks the CEO to do something else is removed.

**17.7 The wireframe test.** A designer can produce faithful wireframes of every zone and every empty state from this document without inventing structure or making product decisions (the *can guide later wireframes and UI work* acceptance criterion).

---

## 18. Out of Scope

To keep this specification focused, the following are explicitly handled elsewhere:

- **Visual design.** Layout, grid, spacing, color, typography, iconography, and motion are wireframe and engineering concerns, constrained but not specified here.
- **Goal input flow.** The planning, Feature Brief generation, and plan-approval experience after a goal is stated belongs to [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) F-02 and a future goal-input UX spec.
- **First-run onboarding.** The guided setup that precedes a working Dashboard (account, repository connection, autonomy and culture selection) belongs to the Onboarding experience; the Dashboard only specifies its resting empty state until onboarding completes.
- **Inbox detail.** The full approval and notification surface — beyond the Decision Request summaries mirrored onto the Dashboard — is owned by [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) Section 19.
- **Runtime behavior.** What causes work to block, escalate, complete, or change health is owned by [Company Runtime](../architecture/COMPANY_RUNTIME.md). The Dashboard presents the results; it does not define the rules.
- **Object structure.** The canonical inventory and hierarchy of every object the Dashboard references is owned by [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md), Sections 5–19.

---

## 19. Relationship to Other Documents

- **[INFORMATION_ARCHITECTURE.md](../architecture/INFORMATION_ARCHITECTURE.md)** — defines the Dashboard's structural inventory (Section 8), the navigation model, the status vocabulary, the notification rules, and the four CEO interaction modes this specification builds the experience on top of. Where structure and experience meet, the IA owns structure and this document owns experience.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — defines the live behavior that populates every Dashboard zone: SOP phases, escalation and blocking rules, approval requests, completions, and CEO interaction points. The Dashboard is a window onto runtime state.
- **[PRODUCT_REQUIREMENTS.md](../product/PRODUCT_REQUIREMENTS.md)** — defines the product principles, personas, and the features this surface realizes: F-01 (Company Dashboard), F-03 (Employee Status Feed), F-06 (Autonomy Controls), and F-10 (Notifications and Approvals).
- **[MVP_ROADMAP.md](../product/MVP_ROADMAP.md)** — defines which Dashboard capabilities ship in V1 and which are deferred.
- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)** — defines the objects (Project, Task, Review, Release, Notification, Employee, Health metrics) the Dashboard renders.
