# Employee Pages — UX Specification

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

This document specifies the user experience of the **Employee** surfaces in Engineering OS: the Employee list page and the Employee detail page. It defines *what the CEO sees about each employee and why* — role, department, status, workload, confidence, memory contributions, performance, active work, and collaboration — in organizational language.

This is a UX specification only. It does not prescribe layout, components, colors, routes, or data-access patterns; those belong to the frontend and to [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md). It is downstream of [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §9 (Company Structure) and §11 (Employee Structure), the [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) features F-03 (Employee Status Feed) and F-05 (Company Memory), and the [Domain Model](../architecture/DOMAIN_MODEL.md) `Employee` definition. The roster, departments, and reporting lines it presents are owned by [Employee Directory](../organization/EMPLOYEE_DIRECTORY.md) and [Reporting Structure](../organization/REPORTING_STRUCTURE.md).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Primary User and Intents](#2-primary-user-and-intents)
3. [Design Principles](#3-design-principles)
4. [Placement in the Information Architecture](#4-placement-in-the-information-architecture)
5. [Employee List Page](#5-employee-list-page)
6. [Employee Detail Page — Structure](#6-employee-detail-page--structure)
7. [Identity, Role, and Department](#7-identity-role-and-department)
8. [Status Presentation](#8-status-presentation)
9. [Workload Presentation](#9-workload-presentation)
10. [Confidence Presentation](#10-confidence-presentation)
11. [Active Work Presentation](#11-active-work-presentation)
12. [Memory Contributions Presentation](#12-memory-contributions-presentation)
13. [KPIs and Performance Presentation](#13-kpis-and-performance-presentation)
14. [Collaboration View](#14-collaboration-view)
15. [Empty States](#15-empty-states)
16. [Anti-Roleplay Guardrails](#16-anti-roleplay-guardrails)
17. [Implementation Status](#17-implementation-status)
18. [Success Criteria](#18-success-criteria)
19. [Related Documents](#19-related-documents)

---

## 1. Purpose

Employee pages exist to let the CEO understand the people they have hired: who is doing what, how loaded they are, how confident the company is in their current work, what they have contributed to the company's knowledge, and how they have performed over time.

The pages answer four questions:

1. **Who works here, and what is each person's job?** — the roster and each employee's role, department, and mission.
2. **What is this employee doing right now, and are they overloaded?** — current assignment, workload, and status.
3. **What does this employee know, and what have they taught the company?** — their memory and decision contributions.
4. **Is this employee performing well?** — role-appropriate quality and reliability signals over time.

Employee pages are a **browse** surface (one of the four CEO interaction modes in [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §21). The CEO does not assign work, set priorities, or direct individuals from these pages — work is delegated to the *company* through goals, and routed internally. Employee pages give the CEO visibility and confidence, not a control panel for micromanagement.

The hard design tension this document resolves: employees must feel **operational** — real organizational roles with real workloads and real output — without becoming **theatrical**. The CEO should feel they employ a serious engineering organization, not that they are playing a management video game with named characters. Every section below is framed to keep that balance.

---

## 2. Primary User and Intents

The sole user is the **CEO** — the human owner of the company. There is one CEO per company in V1 (see [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) §16, Constraint 5). Employees themselves are not users of these pages.

The CEO arrives at an employee surface with one of a small number of intents:

| Intent | Where it lands | What the page must do |
|---|---|---|
| "Who is on my team?" | List page | Show the full roster, grouped by department, with status and current assignment at a glance. |
| "Who is busy, and who is free?" | List page | Make workload and availability scannable across the roster without opening anyone. |
| "What is the Tech Lead doing right now?" | Detail page | Show the employee's current active work in plain language and how long they've been on it. |
| "What has the QA Engineer contributed?" | Detail page | Show memory contributions, decision records, and recent quality work. |
| "Is this employee reliable?" | Detail page | Show role-appropriate performance signals and their trend. |
| "Who worked together on this?" | Detail page (collaboration) | Show recent collaborators and the work that connected them. |

If a CEO ever arrives at an employee page wanting to *change* who does what, the product redirects them to the goal-input and autonomy surfaces — not to a per-employee control. That redirection is a feature, not a gap (see [Executive User Experience](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md)).

---

## 3. Design Principles

These principles govern every decision on the employee surfaces. Where they conflict, earlier principles win.

**3.1 Operational, not theatrical.** Everything shown must be information a real org chart, HR system, or staffing dashboard would carry: role, department, load, output, reliability. Nothing shown should exist purely to personify — no mood, no avatars-as-personality, no invented backstory, no chatter. Employees feel alive because they are *visibly working*, not because they are performing.

**3.2 Outcome language, not implementation language.** Activity is described as "Reviewing: Password Reset PR" or "Implementing: Payment API endpoint" — never as branch names, commit hashes, file paths, prompts, or model identifiers. This mirrors [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §2: if a git branch or PR number appears on an employee page, the page has failed.

**3.3 One employee per detail screen.** The detail page is anchored to exactly one employee ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §1.2). Comparisons happen on the list page, not by mixing employees on a detail screen.

**3.4 Browse, don't operate.** Employee pages support understanding, not control. They expose no buttons that assign, reprioritize, hire, fire, or reconfigure an individual. The only actions are navigational (open the work item, open the memory record, open a collaborator).

**3.5 Relationships are traversable.** From an employee, the CEO can reach their current task, the project it belongs to, the memory they authored, and the people they worked with — without losing context ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §1.6).

**3.6 Truthful signals only.** Workload, confidence, and performance are shown only where the company can compute them honestly. A signal the company cannot yet produce is omitted or explicitly marked as planned — never fabricated. This is the project-wide rule against fake intelligence, applied to people pages.

**3.7 Stable identity.** An employee occupies a stable position in the roster and keeps a consistent name, role, and department across visits. The CEO builds a mental model of "their" Tech Lead; the product must not shuffle that out from under them.

---

## 4. Placement in the Information Architecture

Employee pages live inside the **Company** section of primary navigation, under the **Employees** subsection ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §6, §7, §9).

```
Company
├── Employees        ← list page (this document)
│   └── {Employee}   ← detail page (this document)
├── Departments
├── Health Metrics
└── Settings
```

Breadcrumbs on the detail page follow the standard pattern:

```
Company › Employees › Tech Lead
```

Employee surfaces are also *reached from* other surfaces, but they are not owned by them:

- The **Dashboard** Employee Activity section ([Company Dashboard](../ceo-experience/COMPANY_DASHBOARD.md) §9) links a working employee to their detail page. The dashboard owns the live "who is working now" feed; the employee page owns the durable profile.
- A **Project** Team subsection ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §12) links each assigned employee to their detail page.
- A **Memory** or **Decision** record links its author to their detail page.

This document does not redefine the dashboard activity feed; it defines the destination those links resolve to.

---

## 5. Employee List Page

The list page answers "who works here?" in a single scan and is the canonical roster surface for the CEO.

### 5.1 Purpose

Give the CEO an at-a-glance read of the whole organization: who exists, what each person does, who is busy, and who needs nothing right now. It is breadth-first — summary first, depth on click ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §1.4).

### 5.2 Grouping and order

Employees are **grouped by department**, in the canonical department order from [Departments](../organization/DEPARTMENTS.md) (Executive, Product, Engineering, Quality, Operations, Growth). Grouping by department is what makes the roster read as a *company* rather than a flat list, and it reinforces the organizational model. Within a department, order is stable across visits (a fixed roster order; active employees are not pushed around by transient activity).

### 5.3 Per-employee summary

Each roster entry shows, in plain language:

| Field | What it shows | Notes |
|---|---|---|
| **Name** | The employee's display name | Stable; the CEO's "their Tech Lead." |
| **Role** | The employee's job title | e.g., Tech Lead, QA Engineer. |
| **Department** | Owning department | Reinforced by the group header; shown on the entry for scannability. |
| **Status** | Operational availability | `Active` / `Unavailable` / `Planned` (see §8). |
| **Current assignment** | One-line plain-language summary of active work, or "Available" | e.g., "Implementing: Payment API endpoint." |
| **Workload signal** | A coarse load indicator | Light / Steady / Heavy (see §9). |

No raw metrics, scores, or identifiers appear on the list. The list is for orientation; numbers and history live on the detail page.

### 5.4 Filtering and scanning

The list supports lightweight narrowing, all in organizational terms:

- **By department** — show only Engineering, only Quality, etc.
- **By status** — show only active, or surface planned/unavailable employees.
- **By availability** — "who is free right now?" filters to employees with no active assignment.

Search within the Company section is scoped to employees (by name and role), per [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §20. The list never exposes a search over code, files, or commits.

### 5.5 Navigation

Selecting any roster entry opens that employee's detail page. The list itself is read-only: it assigns nothing and configures nothing.

---

## 6. Employee Detail Page — Structure

The detail page is anchored to a single employee and is organized as a set of subsections, presented summary-first. The CEO sees the employee's identity and current state immediately; history and contributions are available below or on drill-down.

The canonical subsection order, derived from [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §11:

1. **Identity** — name, role, department, mission, status (§7, §8).
2. **Current Work** — what they are doing now, workload, and the company's confidence in it (§9, §10, §11).
3. **Memory Contributions** — what they have added to company knowledge (§12).
4. **Performance** — role-appropriate quality and reliability signals over time (§13).
5. **Collaboration** — who they work with and the work that connects them (§14).
6. **Escalation Path** — who they report to and escalate to (§7.4).

Each subsection that would be empty is either hidden or shown with an intentional empty message where its absence would be ambiguous (see §15). The page never invents content to fill a section.

---

## 7. Identity, Role, and Department

### 7.1 Identity block

The top of the detail page establishes who this employee is, professionally:

- **Name** — display name.
- **Role** — job title, drawn from [Employee Directory](../organization/EMPLOYEE_DIRECTORY.md).
- **Department** — owning department, with a link to the department view.
- **Mission** — the employee's one-sentence mission, taken from their handbook (e.g., [Tech Lead](../employees/TECH_LEAD.md), [QA Engineer](../employees/QA_ENGINEER.md)). The mission is what makes the role legible to a CEO who does not know what, say, a Release Manager does day to day.

### 7.2 Role framing

The role is presented as a *job*, not a personality. The page may show the role's primary responsibilities (a short, scannable list distilled from the handbook) so the CEO understands the boundary of what this employee owns. It does not show prompt text, system instructions, or any "character sheet." Specialization and seniority, when present, are shown as professional attributes (e.g., "Specialization: accessibility") — never as flavor.

### 7.3 Department context

Because the company's value is organizational, the department is always one click away. From the employee, the CEO can reach the department view ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §9) to see the team this person belongs to and the other roles around them.

### 7.4 Escalation path

The detail page shows the employee's place in the org: who they report to and who they escalate decisions to, drawn from [Reporting Structure](../organization/REPORTING_STRUCTURE.md). This is presented as a small, navigable chain (e.g., "Reports to: CTO"), not an interactive org-chart editor. It exists so the CEO understands accountability — every piece of work has a clear owner and a clear escalation route.

---

## 8. Status Presentation

Status communicates the employee's **operational availability**, not a mood. The vocabulary is fixed and matches the `Employee` lifecycle in [Domain Model](../architecture/DOMAIN_MODEL.md):

| Status | Meaning to the CEO | Visual treatment |
|---|---|---|
| **Active** | Participating in company workflows; can be assigned and is available to work. | Neutral / healthy indicator. |
| **Unavailable** | Temporarily unable to participate (a system state — e.g., a paused or degraded runtime). | Muted / attention indicator with a plain-language reason where one exists. |
| **Planned** | Approved for the roster but not yet deployed (e.g., a role reserved for a later version). | Distinct "not yet active" treatment; clearly not a working employee. |
| **Retired** | Removed from active workflows. | Shown only in history contexts, not on the live roster. |

Status is descriptive and outcome-level. It never exposes the underlying runtime, session, or process state by name. "Unavailable" tells the CEO the employee cannot work right now and, where known, why in human terms — it does not surface an execution-session error code.

---

## 9. Workload Presentation

Workload answers "is this person overloaded, or do they have capacity?" — the question a CEO actually asks about staffing.

### 9.1 Coarse signal first

Workload is presented primarily as a **coarse, honest band**, not a precise utilization percentage:

| Band | Meaning |
|---|---|
| **Light** | One or no active items; clear capacity. |
| **Steady** | A normal active load for the role. |
| **Heavy** | Carrying multiple concurrent or blocked items; a candidate for the "why is this person a bottleneck?" question. |

A coarse band is deliberate: it is truthful (the company can compute it from active assignments) and it resists the false precision of a made-up "73% utilized" figure that would imply instrumentation the company does not have.

### 9.2 Supporting detail

Beneath the band, the page may show the concrete basis for it — the count of active items the employee owns and how many are blocked — because the CEO should be able to see *why* someone reads as Heavy. Blocked items are called out specifically, since a Heavy load driven by blockers is an organizational problem (something is stuck), not a busyness signal.

### 9.3 What workload must not become

Workload is not a productivity scoreboard and not a basis for comparing employees against each other on the detail page. It is a capacity read. The page does not rank employees by "throughput" or imply that a Light employee is underperforming — different roles have different natural loads.

---

## 10. Confidence Presentation

Confidence is one of the most easily theatricalized signals, so its presentation is tightly constrained.

### 10.1 What confidence means here

Every employee communicates in the company's structured format — *Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action* ([Domain Model](../architecture/DOMAIN_MODEL.md), Employee responsibilities). **Confidence** on an employee page is the confidence the company expresses **in a specific piece of work or recommendation** — not a personality trait, not a competence rating of the human-shaped employee, and not a standing "morale" meter.

### 10.2 How it is shown

- Confidence is attached to a **work item or recommendation**, in context — e.g., on the employee's current active task, or on a recommendation surfaced in the Inbox. It reads as "Confidence: High on this recommendation," with the reasoning and risks that justify it reachable alongside.
- Confidence uses a small, fixed scale (e.g., High / Medium / Low) rather than a false-precision number.
- **Low or Medium confidence is informative, not alarming.** It signals where the CEO's judgment may add value and routes toward the structured Risks the employee already surfaced. An employee honestly flagging low confidence is the system working as designed (employees surface problems rather than hiding them).

### 10.3 What confidence must not become

There is no per-employee "confidence level" shown as a standing trait divorced from any work — that would be roleplay. The page never aggregates confidence into a character stat. If an employee has no active recommendation, no confidence figure is shown; the field is simply absent.

---

## 11. Active Work Presentation

Active Work is what makes F-03 (Employee Status Feed) tangible on the detail page: *this person is doing a real job right now.*

### 11.1 What it shows

For the employee's current assignment(s):

- **Activity in plain language** — "Reviewing: Password Reset PR," "Testing: User Registration flow," "Implementing: Payment API endpoint."
- **Parent context** — the Project and Feature the work belongs to, as navigable links ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §12).
- **Duration** — how long they have been on this activity, so unusually long-running work is visible.
- **Status signal** — healthy progress vs. blocked, consistent with the dashboard's per-task signal ([Company Dashboard](../ceo-experience/COMPANY_DASHBOARD.md) §9).
- **Confidence** — where a recommendation or checkpoint is attached (§10).

### 11.2 Outcome framing is mandatory

Active work is described by *what is being accomplished*, never by *how*. No file paths, diffs, branch names, PR numbers, commands, prompts, or model names appear here ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §2). The underlying execution mechanics are real and audited elsewhere (the CEO execution audit trail and the GitHub workflow), but they are deliberately not the CEO-facing employee view.

### 11.3 Recent history

Below current work, the page shows a concise **work history** — recent features contributed to, reviews performed, QA validations run, incidents responded to ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §11). History entries are summary-level and link to the work items. This is the evidence that the employee is a durable contributor, not a one-off session.

---

## 12. Memory Contributions Presentation

This subsection makes the company's compounding asset — memory ([Product Requirements](../product/PRODUCT_REQUIREMENTS.md) F-05) — visible per employee, and it is one of the strongest "operational, not theatrical" signals on the page: an employee that has *taught the company things* is unmistakably a worker, not a character.

### 12.1 What it shows

- **Memory records authored** — the architecture notes, coding standards, patterns, and lessons this employee has added to company memory, shown by title and type, each linking to the record in the Memory section.
- **Decision records owned** — significant decisions this employee made or recorded, linking to the [decision frameworks](../decision-frameworks/) context and the record itself.
- **Source linkage** — each contribution traces back to the work item that produced it ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §16), so the CEO can see *why* the employee recorded it.

### 12.2 Framing

Memory contributions are presented as professional output — "what this person has documented for the company" — not as a personality biography. The page shows the knowledge, not a narrative about the employee. It links into the canonical Memory surfaces rather than re-rendering memory content in full, so the Memory section remains the single home for those records.

---

## 13. KPIs and Performance Presentation

Performance answers "can I rely on this employee?" with role-appropriate signals, shown honestly or not at all.

### 13.1 Role-appropriate signals

Performance indicators are specific to the role, not a single universal score:

| Role family | Example reliability signals |
|---|---|
| Engineers (Frontend, Backend, AI, Infrastructure) | Review pass rate, rework rate, on-time task completion. |
| Reviewer | Findings that held up, escaped defects on approved work. |
| QA Engineer | Defect-catch rate, escaped-defect rate on validated features. |
| Security Engineer | Issues caught before release, clearance turnaround. |
| Release Manager | Deployment success rate, rollback rate. |
| Product Manager | Feature acceptance rate, scope stability. |

These align each role's KPIs with that role's actual job (see the per-role handbooks under [`docs/employees/`](../employees/) and the [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md)).

### 13.2 Trend over raw number

Performance is shown as a **trend** ("improving," "steady," "declining") more than a bare figure, because the product's core promise is that the company gets better over time ([Product Requirements](../product/PRODUCT_REQUIREMENTS.md) §7, Principle 4). A trend communicates the compounding-improvement story the raw number cannot.

### 13.3 Honesty rule

Performance signals appear **only where the company can compute them truthfully** from real outcomes (reviews, QA results, releases, incidents). Until a role has accumulated enough real outcomes, its performance subsection shows an honest "Not enough history yet" state (§15) rather than a fabricated score. The page never shows a confidence-inspiring number that has no basis — that would violate both the CEO's trust and the project rule against fake intelligence.

### 13.4 Not a leaderboard

Performance is presented per employee, for understanding — not as a ranked leaderboard that pits employees against one another. The product is helping the CEO trust the company, not run a performance-review tournament. Promotions, seniority changes, and comparative ranking are explicitly out of scope for V1 ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §V1 Scope).

---

## 14. Collaboration View

The collaboration view shows that the company operates as an **organization** — work flows between specialists — rather than as a set of isolated agents.

### 14.1 Purpose

Answer "who does this employee work with, and on what?" so the CEO sees the handoffs that define a real engineering team: an Engineer implements, a Reviewer reviews, a QA Engineer validates, a Release Manager ships.

### 14.2 What it shows

- **Recent collaborators** — the other employees this person has worked alongside recently, each linking to their detail page.
- **The connecting work** — for each collaboration, the Project, Feature, or work item that connected them ([Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) §22), so a collaboration is always grounded in real work rather than an abstract social graph.
- **The nature of the handoff** — in plain language ("implemented work that the Reviewer reviewed," "shipped features the QA Engineer validated"), reflecting the reporting and responsibility structure.

### 14.3 Framing

Collaboration is presented as **work relationships**, not social relationships. There is no messaging, no "team chat," no relationship sentiment. The view is a map of how work moved through the organization, traversable to the people and the work items involved. It reinforces the org model from [Reporting Structure](../organization/REPORTING_STRUCTURE.md) and [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) without turning employees into characters who "get along."

---

## 15. Empty States

Empty states are where roleplay most often creeps in, so they are specified explicitly. Every empty state is **factual and calm** — never apologetic, never personified, never filled with invented activity.

| Surface | Condition | Empty-state behavior |
|---|---|---|
| **List page** | Roster present but a department has no deployed employees | Department group shown with a quiet "No employees in this department yet" line — keeps the org structure legible. |
| **List page** | A status filter matches nobody (e.g., "Available" with everyone busy) | "No employees match this filter" with a one-click reset. Never an empty void. |
| **Detail — Current Work** | Employee is `Active` but has no current assignment | "Available — no active assignment." Explicitly *not* a fabricated task, and *not* an idle-character animation. |
| **Detail — Current Work** | Employee is `Planned` | "This role is reserved for a future version and is not yet active." Clear that it is intentional, not broken. |
| **Detail — Memory Contributions** | No contributions yet | "Hasn't contributed to company memory yet." Truthful for new companies; no placeholder records. |
| **Detail — Performance** | Not enough real outcomes to compute signals | "Not enough history yet to report performance." Honest absence over a fake score (§13.3). |
| **Detail — Collaboration** | No collaborations yet | "No collaborations recorded yet." |
| **Detail — Work History** | New employee, no completed work | "No completed work yet." |

The governing rule mirrors the dashboard ([Company Dashboard](../ceo-experience/COMPANY_DASHBOARD.md) §6): a section that would be empty is hidden, **except** where its absence would be ambiguous (Current Work, Performance, Memory) — there, an intentional empty message is shown so the CEO knows the difference between "nothing to report" and "something is broken."

---

## 16. Anti-Roleplay Guardrails

This section is a single checklist that operationalizes Acceptance Criterion "employees feel operational, not roleplay." Any employee surface that violates these has regressed.

**Do show (operational):**

- Role, department, mission, and reporting line.
- Real status, real workload, real active work in outcome language.
- Real memory contributions and decision records, linked to their source.
- Role-appropriate, truthfully computed performance trends.
- Real collaboration grounded in real work items.

**Do not show (theatrical):**

- Mood, morale, energy, happiness, or any emotional state.
- Invented backstory, hobbies, personality traits, or quotes.
- Idle animations, "thinking" theatrics, or filler chatter to imply life.
- Personified avatars whose purpose is character rather than identification.
- Standing "competence" or "confidence" stats divorced from a specific piece of work.
- Implementation mechanics: prompts, models, branches, PR numbers, commands, file paths, diffs.
- Leaderboards, head-to-head rankings, or gamified scores.

The litmus test: **would a serious staffing or engineering-management tool show this?** If yes, it is operational. If it only exists to make the employee feel like a character, it does not belong.

---

## 17. Implementation Status

This document is a specification; it leads the implementation. Grounding it in the current codebase:

- The **roster, departments, and reporting lines** it presents are real and authoritative ([Employee Directory](../organization/EMPLOYEE_DIRECTORY.md), [Reporting Structure](../organization/REPORTING_STRUCTURE.md); the `Employee` model in [Domain Model](../architecture/DOMAIN_MODEL.md)). A Company section with Employees exists in the app today.
- **Active work** in plain language is already surfaced on the dashboard's Employee Activity feed ([Company Dashboard](../ceo-experience/COMPANY_DASHBOARD.md) §9); the employee detail page is the durable destination those entries link to.
- **Status** maps directly to the implemented `Employee` lifecycle (`active` / `unavailable` / `planned` / `retired`).
- **Workload, confidence, performance trends, and the collaboration view** are partially or not-yet instrumented. Per §3.6 and §13.3, these are shown only where the company can compute them truthfully; until the underlying signals exist, the honest empty states in §15 apply. They are documented here as the canonical target so the surfaces can grow into them without redesign — not as claims that they are fully live today.

This staged honesty is consistent with the project's hard rule against fabricated repository or organizational intelligence.

---

## 18. Success Criteria

The employee pages succeed when:

1. **The CEO can answer "who works here and what do they do?"** from the list page in a single scan, grouped by department.
2. **The CEO can answer "what is this employee doing, and are they overloaded?"** from the detail page without reading anything technical.
3. **Employees read as operational, not theatrical.** A reviewer auditing the surfaces against §16 finds no mood, no backstory, no character stats, and no implementation mechanics.
4. **Every shown signal is truthful.** No fabricated workload, confidence, or performance figure appears; where a signal cannot be computed, an honest empty state is shown instead.
5. **The pages stay in browse mode.** No per-employee assign/reprioritize/hire/fire control exists; the only actions are navigational.
6. **Relationships are traversable.** From any employee the CEO can reach their current work, the originating project, the memory they authored, and their collaborators without losing context.
7. **No implementation details leak.** No branch, PR, commit, file path, prompt, command, or model identifier appears on any employee surface.
8. **Identity is stable.** Across visits, an employee keeps the same name, role, department, and roster position.

---

## 19. Related Documents

- [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md) — §9 Company Structure and §11 Employee Structure define the object hierarchy these pages present.
- [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) — F-03 Employee Status Feed and F-05 Company Memory.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — the authoritative `Employee` definition, fields, lifecycle, and invariants.
- [Company Dashboard](../ceo-experience/COMPANY_DASHBOARD.md) — the live Employee Activity feed that links into these pages (§9).
- [Executive User Experience](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) — the broader CEO-experience principles these pages inherit.
- [Employee Directory](../organization/EMPLOYEE_DIRECTORY.md) — the canonical roster.
- [Departments](../organization/DEPARTMENTS.md) — department grouping and order.
- [Reporting Structure](../organization/REPORTING_STRUCTURE.md) — reporting and escalation lines shown on the detail page.
- [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) — role ownership behind the KPI and collaboration views.
- [Employee handbooks](../employees/) — per-role missions, responsibilities, and KPIs surfaced on the detail page.
