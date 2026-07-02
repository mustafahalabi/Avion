# Company Dashboard

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

The Company Dashboard is the primary surface of Engineering OS — the screen the CEO lands on when they open the product. It exists to answer one question in a single view: *what is the state of my company right now, and what, if anything, needs me?* This document defines the content and behavior of the dashboard. It does not prescribe layout, components, colors, or routes — those belong to the frontend. Where this document references concrete behavior, that behavior is grounded in the current implementation (`apps/web/src/app/(app)/dashboard/page.tsx` and its supporting services); aspirational content is explicitly marked.

This document is a CEO-experience specification. It defines *what the CEO sees and why*, in outcome language. It is downstream of [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §8 (Dashboard Structure) and the [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) feature F-01 (Company Dashboard), and it draws its live data from the [Company Runtime](../architecture/COMPANY_RUNTIME.md).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Primary User](#2-primary-user)
3. [Design Principles](#3-design-principles)
4. [Dashboard Sections](#4-dashboard-sections)
5. [Information Hierarchy](#5-information-hierarchy)
6. [States and Empty States](#6-states-and-empty-states)
7. [Health Indicators](#7-health-indicators)
8. [Risk Indicators](#8-risk-indicators)
9. [Employee Activity](#9-employee-activity)
10. [Notifications](#10-notifications)
11. [Recommended Next Action](#11-recommended-next-action)
12. [Implementation Status](#12-implementation-status)
13. [Success Criteria](#13-success-criteria)
14. [Related Documents](#14-related-documents)

---

## 1. Purpose

The Company Dashboard exists to give the CEO complete situational awareness of their company without requiring any navigation, and to route their attention to the one or two things that actually need a decision.

It is the emotional and functional core of the product. Opening Engineering OS should feel like walking into a company that is already at work — people are mid-task, decisions are queued for the CEO, and progress has happened since the last visit. The dashboard replaces the standup, the status meeting, and the act of checking five tools to assemble a mental picture of where things stand.

The dashboard serves three jobs, in priority order:

1. **Surface what needs the CEO.** Pending approvals, blocked work, and failed work are elevated above everything else. If the company is waiting on the CEO, the dashboard says so first.
2. **Recommend the next action.** Beyond listing state, the dashboard computes a single best next action and presents it prominently, so the CEO is never left wondering "what should I do now?"
3. **Show the company at work.** Active requests, employee activity, and recent history give the CEO confidence that the company is making progress without their involvement.

The dashboard is read-and-route, not a workspace. The CEO scans it, then either acts on a surfaced decision or moves on. Deep work — reviewing a plan, approving a checkpoint, inspecting a project — happens on the destination surfaces the dashboard links to (Inbox, Work, Company). The dashboard never asks the CEO to make an implementation decision; if it did, it would have failed the first principle of [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) §7.

---

## 2. Primary User

The sole primary user is the **CEO** — the human owner of the company. There is one CEO per company in V1 (see [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) §16, Constraint 5).

The CEO arrives at the dashboard with one of a small number of intents:

| Intent | What the dashboard must do |
|---|---|
| "Did anything happen?" | Show recent completions, planning activity, and the company timeline. |
| "Does anything need me?" | Elevate pending approvals, blocked work, and failed executions to the top. |
| "What should I do next?" | Present a single recommended next action with a clear reason. |
| "Is my team working?" | Show active requests and per-employee activity. |
| "I want to start something." | Provide an always-available path to submit a new request. |

The CEO is explicitly *not* a project manager, an engineer, or a prompt operator. The dashboard never exposes branch names, pull request numbers, file paths, diffs, CI status, or model/prompt details — consistent with [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §2. Everything is framed in organizational language: requests, plans, tasks, employees, approvals, releases.

The dashboard assumes the CEO may be non-technical. Every surfaced item is written to be understood without engineering vocabulary, and every recommendation carries a plain-language reason.

---

## 3. Design Principles

These principles govern every decision about dashboard content. They are specific applications of the broader product principles.

**3.1 Attention is the scarce resource.** The dashboard is ranked, not exhaustive. The most decision-critical items appear first and are visually distinct. Routine progress is shown but de-emphasized. A CEO who sees fifty equally weighted items has no dashboard at all.

**3.2 Every item is actionable or informational — never ambiguous.** An item either requires a decision (and links to where that decision is made) or it is explicit status. There is no third category of "something might be wrong, figure it out."

**3.3 The reason is always shown.** Recommendations and alerts state *why* — grounded in real workspace state ("2 planning drafts are ready for CEO review"), not generic prompts. The CEO should never have to reverse-engineer why something is on their dashboard.

**3.4 The dashboard reflects the company, not the database.** Sections map to how a CEO thinks — *what needs me*, *what's in motion*, *who's working*, *what happened* — not to underlying tables.

**3.5 Live, not stale.** The dashboard reads current runtime state on each load. It reflects the company as it is now, including work the autonomous driver advanced without the CEO present.

---

## 4. Dashboard Sections

The dashboard is composed of the following sections, presented top-to-bottom in attention-priority order. Sections are conditional: a section that has nothing to show is omitted entirely rather than rendered empty, so the dashboard stays dense with signal. The one exception is the "no active requests" empty state, which is shown deliberately for an established company at rest (see §6).

| # | Section | Shown when | Purpose |
|---|---|---|---|
| 1 | **Header / Submit request** | Always | Persistent entry point to submit a new request. |
| 2 | **Setup banner** | Company has no connected repository | Nudges the CEO to finish onboarding (connect a repository, configure company style). |
| 3 | **Greeting** | Always | Time-of-day greeting addressing the CEO, plus a one-line company status (e.g. "3 active requests in motion"). |
| 4 | **Pending approvals banner** | One or more tasks paused at a review/QA checkpoint | Single high-priority callout: *N tasks awaiting your review/QA approval*, routing to the Inbox. |
| 5 | **Recommended Next Action** | A best action exists (almost always) | The computed primary action plus up to three secondary actions. See §11. |
| 6 | **Getting started** | New company (no requests, tasks, or events) | Onboarding affordance: submit the first request, or meet the team. |
| 7 | **Company stats** | Always | Four headline counts: Active Employees, Active Projects, Tasks in Progress, Memory Banks. See §7. |
| 8 | **Planning sections** | Pending or recently approved plans exist | Plans awaiting approval and recently approved plans (from the outcome-planning lifecycle). |
| 9 | **Decisions Awaiting Your Approval** | Requests in `awaiting_approval` | Requests stalled until the CEO approves them. |
| 10 | **Risks & Blockers** | Any blocked task or blocked request | Blocked requests and blocked tasks. See §8. |
| 11 | **Active Requests** | Requests in motion (not awaiting/blocked/complete) | The live pipeline, each showing its runtime phase. |
| 12 | **Requests empty state** | Established company with zero active requests | Explicit "nothing in flight" affordance with a submit path. |
| 13 | **Employee Activity** | The company has employees | Per-employee current activity. See §9. |
| 14 | **Outcome Planning Activity** | Planning lifecycle events exist | Recent planning timeline (drafted, reviewed, approved, applied). |
| 15 | **Recent Company Timeline** | Runtime events exist | The most recent company events, each linked to its originating request. |

The header also exposes a **Submit request** affordance that is always present regardless of company state, because stating a new outcome is the CEO's most fundamental interaction (see [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §21, CEO Interaction Points).

---

## 5. Information Hierarchy

The dashboard's ordering is deliberate and encodes the company's understanding of CEO attention. Reading top to bottom, the CEO encounters information in decreasing order of "does this need a decision from me?"

```
1. Blocking decisions      → Pending approvals, decisions awaiting approval
2. Recommended action      → The single best next thing to do
3. Company vitals          → Headline counts (employees, projects, tasks, memory)
4. Work needing attention  → Plans to approve, risks and blockers
5. Work in motion          → Active requests, employee activity
6. History                 → Planning activity, recent company timeline
```

Three rules govern this hierarchy:

**5.1 Decisions outrank status.** Anything that pauses the company waiting on the CEO (a review/QA checkpoint, an `awaiting_approval` request, a plan pending approval) is surfaced above anything that is merely informational.

**5.2 Recommendations outrank raw lists.** The Recommended Next Action section sits near the top precisely because it has already done the ranking work for the CEO. It collapses the entire workspace state into one prioritized instruction. The detailed sections below it exist for the CEO who wants to see the underlying state.

**5.3 Depth is earned.** Each section shows a summary and links deeper. The dashboard caps how many items it shows per section (for example, a handful of active requests, the top blocked tasks, the first several employees with work) and provides a "view all" path to the owning surface rather than rendering an unbounded list. This is the breadth-first principle of [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §1.4.

The CEO can satisfy the "does anything need me?" question by reading only the top of the page, and the "what's my company doing?" question by scrolling. The information architecture guarantees they never have to leave the dashboard to form a complete picture.

---

## 6. States and Empty States

The dashboard renders meaningfully across the full lifecycle of a company. Empty states are first-class — they are designed moments, not blank screens.

### 6.1 Loading

While the dashboard's data is being assembled, a lightweight skeleton stands in for the content. The CEO sees structure immediately rather than a blank page, and the real content replaces the skeleton when ready.

### 6.2 New company

A company is treated as **new** when it has no requests, no tasks, and no recorded events. In this state the dashboard:

- Greets the CEO with "Ready for your first request."
- Shows a prominent getting-started affordance: the team is standing by; submit the first request, or meet the team.
- Suppresses the work-in-motion and history sections, which would otherwise be empty.

This is the first-run experience. Its job is to convert a freshly provisioned company into a first submitted outcome with the least friction possible.

### 6.3 Onboarding incomplete

Independently of whether work exists, if the company has **no connected repository**, a setup banner persists at the top of the dashboard directing the CEO to complete setup (connect a repository, configure company style). Repository connection is a prerequisite for execution, so this banner remains until satisfied.

### 6.4 Established company at rest

A company that has done work but currently has **no active requests** is not "new." For this company the dashboard shows an explicit "No active requests" state with a clear path to submit the next request. This deliberately distinguishes *"you haven't started yet"* from *"everything is finished; what's next?"* — two very different messages for the CEO.

### 6.5 Section-level empty states

Individual sections handle their own empty conditions:

| Section | Empty behavior |
|---|---|
| Employee Activity | If no employee has an active task, shows "No employees have active tasks assigned" with a path to assign work, rather than hiding the section. |
| Active Requests | Omitted when there is nothing in motion; the company-level requests empty state covers the at-rest case. |
| Risks & Blockers | Omitted entirely when there are no blocked items — absence of the section *is* the signal that nothing is blocked. |
| Planning / Timeline | Omitted when there is no corresponding activity. |

The governing rule: a section that would be empty is hidden, except where its absence would be ambiguous to the CEO (employee activity, company-at-rest), in which case an intentional empty message is shown.

---

## 7. Health Indicators

Health indicators answer "is my company in good shape?" at a glance.

### 7.1 Implemented today — headline vitals

The dashboard currently surfaces four headline counts as the company's vital signs. Each links to the surface where the underlying objects live:

| Indicator | Meaning | Links to |
|---|---|---|
| **Active Employees** | Number of employees currently in `active` status — the size of the working company. | Company › Employees |
| **Active Projects** | Projects in `active` or `planning` status — how much is in flight. | Work › Projects |
| **Tasks in Progress** | Tasks currently in `in-progress` — the company's working surface. | Work |
| **Memory Banks** | Count of company memory records — the compounding knowledge asset. | Memory |

These are deliberately simple, trustworthy counts derived directly from runtime state. They give the CEO an immediate sense of scale and motion without interpretation risk.

### 7.2 Designed / planned — qualitative company health

[Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §8 and §9 and [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) F-01 describe a richer **Company Health** panel covering qualitative organizational indicators:

- Architecture health
- Security posture / score
- Documentation coverage
- Technical-debt level
- Deployment stability
- Test coverage
- Engineering velocity

These qualitative health metrics are **not yet implemented** on the dashboard. They are the canonical target for the health panel and depend on instrumentation that the company does not yet produce. They are documented here as the planned evolution of §7.1 so the headline vitals can grow into a true health summary. Until then, the dashboard intentionally shows only metrics it can compute truthfully — consistent with the project rule against fabricated intelligence.

---

## 8. Risk Indicators

Risk indicators answer "is anything stuck or broken?" and route the CEO toward resolution. They are the highest-signal content on the dashboard after pending approvals.

### 8.1 Implemented today — surfaced risks

The dashboard elevates the following risk classes:

| Risk | Source | How it is surfaced |
|---|---|---|
| **Blocked requests** | Requests in `blocked` status | Listed under Risks & Blockers, each routing to the request. |
| **Blocked tasks** | Tasks in `blocked` status | Listed under Risks & Blockers (top items shown, with an overflow link to the work board). |
| **Failed executions** | Execution sessions in `failed` status | Drives a Recommended Next Action ("N execution sessions failed"). |
| **Executions needing clarification** | Sessions in `needs_clarification` | Drives a Recommended Next Action ("needs clarification") — an agent paused for CEO input. |
| **Stale approvals** | Requests in `awaiting_approval`, plans pending | Surfaced as their own decision sections (see §10, §11). |

The Risks & Blockers section appears **only** when there is at least one blocked task or blocked request. Its presence is itself the alert; its absence means the pipeline is flowing.

Each risk item is paired with a destination so the CEO can act, never just observe. Blocked requests and tasks link to their detail surfaces; failed and clarification-needed sessions are surfaced through recommended actions that explain whether to retry, provide input, or escalate.

### 8.2 Stuck-work detection (read-only intelligence)

Beyond live `blocked` status, the company runs a **read-only stuck-work detector** (`apps/web/src/lib/stuck-work-detector.ts`) that scans for work that is technically progressing but has stalled past time thresholds:

- Tasks stuck in review beyond a review threshold (default 24h)
- Tasks blocked for an extended period
- Execution sessions running or queued beyond an execution threshold (default 48h)
- Plans awaiting CEO approval past threshold
- Recently failed execution / validation loops (last 7 days)

Each detected item carries a severity (`high` / `medium` / `low`), a plain-language description with elapsed duration, and a recommendation. This detector is the foundation for time-based risk surfacing. It powers company-intelligence recommendations and is the designed source for an expanded dashboard risk panel that flags *silently stalled* work — not just work explicitly marked blocked. Its severity model (high → medium → low, then longest-stuck first) defines how such risks should be ranked when surfaced.

### 8.3 Designed / planned — risk panel expansion

The planned evolution is a unified **Risks** panel that merges live `blocked` status with stuck-work intelligence and presents one ranked list of everything threatening velocity, each with a recommended resolution. Until that lands, blocked status and recommended actions are the implemented risk surface.

---

## 9. Employee Activity

The Employee Activity section makes the company's core promise tangible: *you have a team working for you.*

### 9.1 What it shows

For each employee with active work, the dashboard shows:

- The employee's name and role (or department).
- Their department, used to visually group the organization.
- Their current active task(s) — the work in `in-progress` or `blocked` status that they own — shown in plain language.
- A status signal per task distinguishing healthy progress from a blocker.

Employees are drawn from the active roster and ordered consistently so the same employee occupies a stable position across visits. The section shows the first several employees who have work, with a "view all" path to the full roster in Company › Employees.

### 9.2 Idle employees

Employees with no assigned active task are summarized rather than listed individually — for example, "4 employees with no assigned tasks." This communicates available capacity without cluttering the section with idle rows. When *no* employee has active work, the section shows an intentional empty message with a path to assign tasks, rather than disappearing — because an all-idle company is a meaningful state the CEO should see.

### 9.3 Framing

Employee activity is always framed organizationally. The CEO sees "implementing the password-reset endpoint," never "running `claude -p` on branch X." This section is the product's answer to the standup: a live, scannable view of who is doing what, consistent with [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) F-03 (Employee Status Feed).

### 9.4 Designed / planned

The richer per-employee feed described in [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §8 — how long each employee has been on their current activity, first-person status updates in the company's communication style, and direct links into the specific work item being acted on — is a planned enhancement. Today the dashboard shows current task ownership and status; elapsed-time-on-activity and first-person narration are not yet implemented.

---

## 10. Notifications

The dashboard is one consumer of the company's notification and approval surfaces; it elevates the decision-critical ones and defers the rest to the Inbox and Notifications surfaces. See [Notification System](../systems/NOTIFICATION_SYSTEM.md) and [Approval System](../systems/APPROVAL_SYSTEM.md) for the full model.

### 10.1 Decision surfaces on the dashboard

The dashboard renders three classes of attention item:

| Class | Source | Dashboard treatment |
|---|---|---|
| **Approval checkpoints** | Tasks paused at a review/QA gate by autonomy policy (pending `Review` / `QAResult` rows) | A single banner: *N tasks awaiting your review/QA approval*, linking to the Inbox where approve/reject resumes the flow. |
| **Decisions awaiting approval** | Requests in `awaiting_approval` | Their own section, each routing to the request. |
| **Plans pending approval** | Planning drafts in `draft` / `reviewing` | Surfaced via the planning sections and the recommended action. |

Approval checkpoints are the product of sub-threshold autonomy: when the autonomy level is below the bar for a gate, the gate-advancement service halts the task and persists the pause as a pending review or QA record rather than auto-advancing. The dashboard reads the count of these pauses and surfaces it; resolution happens in the Inbox, always through the real review/QA services so no quality gate is bypassed.

### 10.2 Sidebar and Inbox counts

Two persistent counts complement the dashboard and are visible from every surface:

- **Notifications (bell):** the count of the CEO's unread notifications.
- **Inbox:** the count of pending approval checkpoints awaiting a decision.

When a sub-threshold gate pauses a task, a `decision`-type notification is also created, so the CEO is alerted both in their notification feed and via the Inbox count even if they are not currently on the dashboard.

### 10.3 Notification discipline

Notifications are strictly filtered. Implementation details and routine task completions never generate CEO notifications — only events that genuinely require attention or represent significant milestones do. Notification types in the system include `info`, `warning`, `alert`, `decision`, `progress`, and `blocker`, each carrying a priority. The dashboard's role is to elevate the highest-priority, decision-bearing ones (approvals and blockers) and let the rest live in the Notifications and Inbox surfaces. This protects the CEO experience: a CEO who receives fifty notifications a day about file changes is no longer a CEO (see [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) F-10).

---

## 11. Recommended Next Action

The Recommended Next Action section is the dashboard's most distinctive feature: rather than only listing state, the company computes the single best thing the CEO should do and presents it with a reason.

### 11.1 How it works

A pure rule engine evaluates a snapshot of workspace state and returns one **primary** action plus up to three **secondary** actions. Each action carries a title, a one-sentence reason grounded in real counts, a priority (`urgent` / `high` / `medium` / `low`), a confidence (`high` / `medium` / `low`), a call-to-action, and a destination link. Actions are ranked by priority, then by confidence.

### 11.2 Priority order

The engine evaluates candidates in this fixed order, so the most consequential item always wins the primary slot:

| Rank | Trigger | Example action | Priority |
|---|---|---|---|
| 1 | Plans awaiting approval | "2 plans awaiting your approval" | urgent |
| 1 | Requests awaiting approval | "1 request awaiting approval" | urgent |
| 2 | Failed executions | "1 execution session failed" | high |
| 2 | Executions needing clarification | "An agent paused and requested context" | high |
| 3 | Blocked requests | "2 requests blocked" | high |
| 3 | Blocked tasks | "3 tasks blocked" | high (medium confidence) |
| 4 | Ready-to-run sessions | "1 session ready to execute" | medium |
| 5 | Running sessions / active pipeline | "Company is executing" | low |
| 6 | Idle or new company | "Submit your first outcome" / "No active requests" | low |

If nothing else applies, the engine always returns a sensible default (submit the first outcome for a new company, or submit a request for an idle one), so the CEO is never shown a dashboard with no recommended action.

### 11.3 Why it matters

This section collapses the entire workspace into a single instruction. A CEO who reads nothing else still knows the one most valuable thing to do and why. It is the operational embodiment of "the CEO communicates outcomes; the company handles everything else" — here, the company even tells the CEO where their attention is most valuable.

---

## 12. Implementation Status

This section is the authoritative separation of what the dashboard does **today** from what is **designed but not yet built**, in keeping with the project rule against representing planned capability as real.

### 12.1 Implemented today

- Time-of-day greeting with live company status line.
- Setup banner when no repository is connected.
- Pending review/QA approval banner driven by real persisted checkpoints.
- Recommended Next Action (primary + up to three secondary) from the rule engine.
- New-company getting-started state.
- Four headline vital counts (employees, projects, tasks-in-progress, memory).
- Plans-awaiting-approval and recently-approved-plan sections.
- Decisions Awaiting Your Approval (requests in `awaiting_approval`).
- Risks & Blockers (blocked tasks and blocked requests).
- Active Requests with per-request runtime phase.
- Employee Activity with idle-capacity summary.
- Outcome Planning Activity and Recent Company Timeline.
- Loading skeleton and section-level empty states.
- Sidebar notification (bell) and Inbox approval counts.
- Read-only stuck-work detection service (feeds intelligence; not yet a dedicated dashboard panel).

### 12.2 Designed / planned

- Qualitative Company Health panel (architecture, security, documentation, technical debt, deployment stability, velocity) — §7.2.
- Unified Risks panel merging live `blocked` status with stuck-work intelligence — §8.3.
- Per-employee elapsed-time-on-activity and first-person status narration — §9.4.
- Upcoming milestones / planned-releases section described in [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §8.

All planned items above are documented as targets, not current behavior. The dashboard's standing rule is to show only metrics and state it can compute truthfully.

---

## 13. Success Criteria

The Company Dashboard is successful when the following are all true:

1. **Single-view situational awareness.** A CEO can open the dashboard and, without navigating, answer: does anything need me, what is my company doing, and what happened recently.
2. **Attention is correctly routed.** Decision-bearing items (approvals, blockers, failures) always appear above informational ones, and the most consequential decision occupies the recommended-action primary slot.
3. **Every surfaced item is actionable or clearly informational.** No item leaves the CEO unsure what it means or what to do, and every decision item links to where the decision is made.
4. **No implementation leakage.** No branch names, PR numbers, file paths, diffs, CI status, or model/prompt details appear anywhere on the dashboard.
5. **Truthful health and risk.** Every count and indicator reflects real runtime state; no fabricated metrics are shown. Planned indicators are absent until they can be computed truthfully.
6. **Graceful across the lifecycle.** The dashboard renders meaningfully for a brand-new company, an onboarding-incomplete company, an active company, and an established company at rest — with intentional empty states, never blank screens.
7. **Live and autonomous-aware.** The dashboard reflects work the autonomous driver advanced while the CEO was away, including checkpoints that paused for the CEO's approval.
8. **The CEO feels like a CEO.** The experience reads as arriving at a working company, not operating a tool. This is the qualitative bar that overrides all others — consistent with [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) §4 and §7.

---

## 14. Related Documents

- [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) — §8 Dashboard Structure, §19 Notification Structure; defines the IA this surface implements.
- [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) — F-01 Company Dashboard, F-03 Employee Status Feed, F-10 Notifications and Approvals.
- [Company Runtime](../architecture/COMPANY_RUNTIME.md) — the live behavioral layer that populates the dashboard's requests, events, and recommendations.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — definitions of the objects the dashboard summarizes (requests, tasks, projects, reviews, QA results, employees, notifications).
- [Notification System](../systems/NOTIFICATION_SYSTEM.md) — the full notification model the dashboard elevates a subset of.
- [Approval System](../systems/APPROVAL_SYSTEM.md) — the approval-checkpoint model behind the pending-approval banner and Inbox count.
- [Work Item System](../systems/WORK_ITEM_SYSTEM.md) — the work-item lifecycle and statuses the dashboard reports.
- [Planning System](../systems/PLANNING_SYSTEM.md) — the outcome-planning lifecycle behind the planning sections.
