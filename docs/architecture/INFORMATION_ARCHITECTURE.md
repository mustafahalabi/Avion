# Information Architecture — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-26  

This document defines how information is organized inside Engineering OS. It is not a frontend specification. It does not prescribe layouts, components, or routes. It defines the product's information hierarchy — what exists, how it is grouped, how objects relate, and how a CEO navigates the company they own.

Every routing decision, navigation pattern, and product surface that follows must trace back to this document.

---

## Table of Contents

1. [Information Architecture Principles](#1-information-architecture-principles)
2. [Navigation Philosophy](#2-navigation-philosophy)
3. [Workspace Hierarchy](#3-workspace-hierarchy)
4. [Company Hierarchy](#4-company-hierarchy)
5. [Object Hierarchy](#5-object-hierarchy)
6. [Primary Navigation](#6-primary-navigation)
7. [Secondary Navigation](#7-secondary-navigation)
8. [Dashboard Structure](#8-dashboard-structure)
9. [Company Structure](#9-company-structure)
10. [Repository Structure](#10-repository-structure)
11. [Employee Structure](#11-employee-structure)
12. [Project Structure](#12-project-structure)
13. [Task Structure](#13-task-structure)
14. [Review Structure](#14-review-structure)
15. [Release Structure](#15-release-structure)
16. [Memory Structure](#16-memory-structure)
17. [Knowledge Structure](#17-knowledge-structure)
18. [Timeline Structure](#18-timeline-structure)
19. [Notification Structure](#19-notification-structure)
20. [Search Model](#20-search-model)
21. [Global Navigation Concepts](#21-global-navigation-concepts)
22. [Relationships Between Sections](#22-relationships-between-sections)

---

## 1. Information Architecture Principles

**1.1 The CEO sees outcomes, not operations.**  
The information hierarchy protects the CEO from implementation details. Every object exposed to the CEO is framed in terms of what was accomplished, what requires a decision, or what the company's current state is — never how the engineering was done or which files changed.

**1.2 One primary object per screen.**  
Each view is anchored to a single primary object. A Project view shows a Project. An Employee view shows an Employee. Mixing object types at the primary level creates navigational ambiguity.

**1.3 Objects belong to exactly one location.**  
Every object in the system has a canonical home. It may be referenced from other locations, but it lives in one place. Tasks live inside Projects. Projects live inside Repositories. Reviews live inside the Review section of a Project. There is no ambiguity about where to find anything.

**1.4 Depth is earned, not assumed.**  
The top-level view of every section shows the summary. The CEO navigates deeper only when they choose to. Breadth-first navigation — not detail-first — is the default information presentation.

**1.5 Navigation reflects the company, not the database.**  
The product navigates like a company, not like a data model. The CEO navigates to "Company," not to "Users and Settings." They navigate to "Work," not to "Projects and Tasks." The information architecture maps to how a CEO thinks about their organization.

**1.6 Relationships are traversable.**  
Every significant relationship between objects must be traversable in the product. From a Feature, the CEO can navigate to its originating Goal, its active Tasks, its completed Reviews, its QA Result, and its Release. The company's information is connected, not siloed.

**1.7 Time is always visible.**  
Every object carries its temporal context: when it was created, when it was last updated, what its current status is, and what happened to it. The company's history is accessible without requiring the CEO to remember it.

---

## 2. Navigation Philosophy

The product's navigation reflects a company organizational model, not a software product tree.

A CEO's mental model of their company is:

- **The company** — Who works here. What we stand for. How we operate.
- **The work** — What we are building. What is in progress. What has shipped.
- **The memory** — What we know. What we have decided. What we have learned.
- **What needs my attention** — Approvals, alerts, and decisions.

These four mental models define the top-level navigation of Engineering OS.

Navigation never exposes:
- Git branches
- Pull request numbers
- CI pipeline statuses
- File paths or diffs
- Deployment commands
- Environment names

If any of these appear in primary navigation, the product has failed.

Navigation always exposes:
- Company activity
- Employee states
- Work progress by feature or project
- Pending CEO decisions
- Company health

---

## 3. Workspace Hierarchy

The Workspace is the engineering execution context — the shop floor of the company. In V1, each Company has exactly one Workspace.

```
Company (1)
└── Workspace (1)
    ├── Repository (1 in V1)
    │   └── Projects (many)
    │       └── Tasks (many)
    ├── Sprints (many)
    └── Milestones (many)
```

The Workspace is not directly surfaced to the CEO as a navigable concept. Instead, its contents (Repository, Projects, Tasks, Sprints, Milestones) appear within the Work section.

---

## 4. Company Hierarchy

The Company is the root of all information in Engineering OS. Every object belongs to a Company.

```
Company (root)
├── Company Settings (1)
├── Company Runtime (1)
├── Departments (many)
│   └── Employees (many)
├── Workspace (1)
├── Memory (1)
├── Knowledge (1)
├── Conversations (many)
├── Notifications (many)
├── Timeline (1 — aggregated view)
├── Decisions (many)
├── Incidents (many)
└── Integrations (many)
```

From a navigation perspective, the Company maps to:

| Company Object | Navigation Section |
|---|---|
| Company Runtime | Dashboard |
| Departments / Employees | Company |
| Workspace / Repository / Projects / Tasks | Work |
| Memory / Decisions | Memory |
| Knowledge / Documents | Knowledge |
| Conversations / Notifications | Inbox |
| Timeline | Timeline |
| Company Settings | Settings |

---

## 5. Object Hierarchy

This diagram represents the full depth of the engineering planning hierarchy, from strategic intent to atomic work.

```
Initiative (strategic)
└── Goal (measurable outcome)
    └── Epic (engineering capability group)
        └── Feature (product capability)
            ├── Feature Brief (document)
            ├── Project (execution container)
            │   ├── Tasks (atomic work)
            │   │   └── Subtasks (implementation checkpoints)
            │   ├── Reviews (quality gate)
            │   ├── QA Result (validation gate)
            │   └── Release (delivery)
            └── Feature Memory (post-ship record)
```

The CEO-facing view of this hierarchy is compressed:

- Initiatives and Goals are the "What are we building" view
- Features and Projects are the "What's in progress" view
- Tasks are visible on drill-down only
- Reviews, QA, and Releases are visible as status indicators on Projects

The CEO never needs to navigate the full six-level hierarchy to understand what the company is doing. The hierarchy exists to give the company internal structure. The CEO sees the summary.

---

## 6. Primary Navigation

Primary navigation contains five sections. These map to the CEO's mental model of their company.

```
┌─────────────────┐
│  Dashboard      │  ← Company Runtime: what's happening right now
│  Company        │  ← Organization: who works here, their state
│  Work           │  ← Engineering: what is being built
│  Memory         │  ← Organizational knowledge: what we know
│  Inbox          │  ← Decisions and notifications requiring attention
└─────────────────┘
```

**Dashboard** is always the default landing surface. It aggregates live company state.

**Company** provides access to organizational structure — departments, employees, health metrics, and settings.

**Work** provides access to all active and past engineering work — initiatives, goals, projects, releases, and timelines.

**Memory** provides access to the company's accumulated organizational knowledge — memory records, decision records, and feature history.

**Inbox** contains notifications, approval requests, and conversations that require CEO attention.

Settings and Timeline are secondary surfaces, accessible from within Company and Work respectively.

---

## 7. Secondary Navigation

Secondary navigation appears contextually within each primary section.

### Within Dashboard
- Active Work
- Recent Completions
- Company Health
- Pending Approvals

### Within Company
- Employees
- Departments
- Health Metrics
- Settings

### Within Work
- Active Features
- Projects
- Repository
- Sprints
- Milestones
- Timeline
- Incidents

### Within Memory
- Company Memory
- Feature Memory
- Repository Memory
- Decision Records

### Within Inbox
- Approval Requests
- Notifications
- Conversations

---

## 8. Dashboard Structure

The Dashboard is the primary surface. It is the first thing the CEO sees when they open Engineering OS. It must communicate the full state of the company in a single view without requiring any navigation.

### Sections

**Active Work**  
A live view of every employee currently doing something. Each entry shows:
- Employee name and role
- Current activity in plain language ("Implementing: Payment API endpoint", "Reviewing: Password Reset PR", "Testing: User Registration flow")
- How long they have been on this activity
- Which Project and Feature the work belongs to

**Pending Approvals**  
A prioritized queue of items requiring CEO input. Each entry shows:
- What is being requested
- Who is requesting it
- Why it matters
- What happens if the CEO approves vs. rejects

**Recent Completions**  
The last N significant events the company has completed:
- Features shipped
- Reviews approved
- QA validations passed
- Releases deployed

**Company Health**  
A summary of organizational health indicators:
- Architecture health
- Security status
- Documentation coverage
- Technical debt indicator
- Deployment stability
- Active incidents (if any)

**Upcoming**  
Milestones and planned releases within the next sprint window.

---

## 9. Company Structure

The Company section gives the CEO a view of their organization and its current operational state.

### Subsections

**Employees**  
A roster of all employees with:
- Name and role
- Department
- Current status (active / unavailable)
- Current assignment
- Recent performance indicators (accessible on drill-down)

Employee detail view includes:
- Mission and responsibilities (from their handbook)
- Recent work history
- Active assignments
- Performance metrics
- Memory contributions (what this employee has added to company knowledge)

**Departments**  
A view of each department and its current health:
- Mission
- Active employees
- Current work items owned by department
- Department-level metrics

**Health Metrics**  
A detailed breakdown of company health across all domains:
- Architecture health
- Security posture
- Documentation coverage
- Test coverage
- Technical debt level
- Deployment stability
- Engineering velocity

**Settings**  
Company-level configuration:
- Company name and profile
- Autonomy level (Manual / Assist / Delegate / Autonomous)
- Culture profile (Startup / Enterprise / Design-First / Performance-First)
- Notification preferences
- Repository connections
- Integration management

---

## 10. Repository Structure

The Repository is the engineering anchor of the company. Its structure surfaces within the Work section.

### Repository Overview
- Name and connection status
- Architecture summary (produced during onboarding)
- Primary language and framework stack
- Repository health indicators
- Last analyzed timestamp

### Repository Detail Subsections

**Architecture**  
What the CTO and Tech Lead know about the repository structure. Includes:
- Folder organization (high-level)
- Framework and dependency summary
- Identified architectural patterns
- Known technical debt areas

**Projects**  
All Projects associated with this repository, organized by status:
- Active projects
- Completed projects
- Cancelled projects

**History**  
The full record of what has been built in this repository — every Feature that shipped, with links to their release records and feature memory entries.

**Status**  
The repository's current operational status (Active / Stale / Connecting / Errored) and any associated alerts.

---

## 11. Employee Structure

Each Employee is navigable as a primary object within the Company section.

### Employee Detail View

**Identity**
- Name, role, department
- Mission (one sentence)
- Current status and assignment

**Current Work**
- Task currently assigned
- Expected completion
- What the employee has communicated most recently

**Work History**
- Features contributed to (last N)
- Reviews performed (last N)
- QA validations performed (last N)
- Incidents responded to (last N)

**Memory Contributions**
- What this employee has added to company memory
- Decision records they own
- Knowledge records they authored

**Performance**
- Role-specific performance indicators
- Trend over time

**Escalation Path**
- Who this employee reports to
- Who they escalate to for different decision types

---

## 12. Project Structure

A Project is the primary unit of engineering execution. It is the work container the CEO follows most closely.

### Project Overview
- Name and associated Feature
- Current phase (Planning / In Progress / In Review / In QA / Releasing / Done / Cancelled)
- Owner (Tech Lead)
- Sprint context
- Estimated completion

### Project Detail Subsections

**Summary**  
A plain-language description of what this project is delivering, why, and what state it is in. Written to be readable by a CEO, not an engineer.

**Feature Brief**  
The approved Feature Brief that this Project is executing against. Shows:
- Problem statement
- Proposed solution
- Acceptance criteria
- Out-of-scope items
- Success metrics

**Work**  
The task list. Visible to the CEO at a summary level:
- Total tasks
- Completed tasks
- In-progress tasks
- Blocked tasks
Individual tasks are accessible on drill-down but not the default view.

**Team**  
Which employees are assigned to this project and their current contribution status.

**Review**  
The current state of code review for this project:
- Review status
- Reviewer assigned
- Open findings count
- Security review status

**QA**  
The current state of QA validation:
- QA Engineer assigned
- Test Plan status
- Defects open / resolved
- Go/No-Go recommendation status

**Release**  
The associated Release record for this project:
- Release status
- Planned deployment window
- Checklist completion status

**Memory**  
What this project has contributed to company memory:
- Decision records created
- Feature Memory entry

**History**  
The full chronological log of events for this Project.

---

## 13. Task Structure

Tasks are the atomic unit of engineering work. They are visible to the CEO at a summary level within Projects and at full detail on drill-down.

### Task Summary (within Project Work view)
- Title
- Assigned engineer
- Status
- Completion indicator

### Task Detail View
- Title and description
- Definition of Done (checklist)
- Assigned engineer and assigner (Tech Lead)
- Status
- Estimate and actual hours
- Acceptance criteria it maps to
- Subtasks (if any)
- Review status
- Comments
- Full status history

The CEO does not navigate directly to the Task list as a primary surface. Tasks are always accessed through their parent Project.

---

## 14. Review Structure

Reviews are the quality gate between implementation and release. They are visible as a subsection within their parent Project and as an aggregated view within the Work section.

### Review Detail View
- Subject (which Project or Task is being reviewed)
- Reviewer assigned
- Current status (Assigned / In Review / Changes Requested / Security Review / Approved / Escalated)
- Findings summary
  - Blocking count
  - Non-blocking count
  - Questions count
- Security Engineer involvement (if applicable)
- Approval status

The CEO sees the Review status on the Project overview. They drill into Review detail only if they choose to. The CEO never reads raw code review findings — they see outcome-level status.

### Aggregated Review View (within Work)
- All active reviews across all Projects
- Reviews awaiting engineer response
- Reviews approved this sprint
- Security reviews pending

---

## 15. Release Structure

Releases are the formal record of what shipped. They are one of the highest-visibility objects for the CEO because they represent the completion of the company's work.

### Release Overview (within Work)
- Name / version identifier
- Status (Planning / Ready / Deploying / Monitoring / Stable / Rolled Back / Failed)
- Features included
- Target deployment window
- Release Manager assigned

### Release Detail View
- Features included (linked to their Feature Memory entries)
- QA recommendation (Go/No-Go)
- Release Readiness Checklist status
- Deployment timeline
- Monitoring window status
- Changelog (publishable)
- Post-release signals summary
- Rollback status (if applicable)

### Release History
All past releases, ordered by date:
- Release name
- Features shipped
- Status
- Date deployed

---

## 16. Memory Structure

Memory is one of the company's most significant assets. The CEO can browse, search, and annotate memory records.

### Memory Top-Level View

```
Memory
├── Company Memory
│   ├── Architecture Records
│   ├── Coding Standards
│   ├── Business Rules
│   ├── Naming Conventions
│   └── Infrastructure Knowledge
├── Feature Memory
│   └── One record per shipped feature
├── Repository Memory
│   ├── Structure Analysis
│   ├── Dependency Records
│   └── Pattern Records
├── Decision Records
│   └── One record per significant decision
└── Conversation Memory
    └── Session-scoped (not permanently accessible)
```

### Memory Record Detail View
- Type (architecture / coding_standard / business_rule / decision / pattern / lesson_learned / feature_summary / repository_structure)
- Scope (employee / team / company / repository / feature)
- Content
- Created by (employee)
- Created at
- Source work item (the task, incident, or review that produced this record)
- Status (active / deprecated / superseded)
- CEO annotations (if any)

### Decision Record Detail View
- Title
- What was decided
- Why (rationale)
- Alternatives rejected
- Trade-offs accepted
- Future considerations
- Decision maker
- Date

---

## 17. Knowledge Structure

Knowledge is the curated, authoritative tier of company information. It is distinguished from Memory by quality — Knowledge records are intentionally authored and reviewed; Memory records are generated continuously.

### Knowledge Top-Level View

```
Knowledge
├── Architecture Guides
│   └── Canonical architecture documentation
├── API Contracts
│   └── Published API specifications
├── Coding Standards
│   └── Approved patterns and practices
├── Runbooks
│   └── Operational procedures
└── Feature Documentation
    └── User-facing documentation for shipped features
```

### Knowledge Record Detail View
- Title
- Type (architecture / api_contract / pattern / standard / guide / runbook)
- Content
- Author (Technical Writer)
- Approved by (CTO or Tech Lead)
- Published at
- Status (draft / in_review / published / deprecated)
- Successor record (if deprecated)

### Knowledge Source View
- External documentation sets indexed by the company
- Repository analysis results
- Incident-derived knowledge

---

## 18. Timeline Structure

The Timeline is the company's history. It surfaces significant events in chronological order, giving the CEO a narrative view of what the company has accomplished.

### Timeline Entry Types

| Type | Description |
|---|---|
| `feature_shipped` | A feature was successfully deployed to production |
| `incident_resolved` | A production incident was resolved |
| `decision_made` | A significant architectural or scope decision was recorded |
| `milestone_reached` | A planning milestone was achieved |
| `release_deployed` | A release was successfully deployed |
| `memory_updated` | Significant company memory was added or updated |
| `repository_connected` | A repository was onboarded |
| `security_cleared` | A security review was completed with clearance |

### Timeline View Structure
- Chronological list of entries (newest first, with option to reverse)
- Filter by entry type
- Filter by date range
- Filter by related employee
- Each entry links to the originating work item

The Timeline is accessible from within the Work section and is also referenced from the Dashboard for recent activity.

---

## 19. Notification Structure

Notifications are the CEO's decision queue. They are strictly filtered — only events that genuinely require CEO attention generate notifications.

### Notification Types

| Type | Priority | Description |
|---|---|---|
| `approval_request` | High | A workflow phase requires CEO approval to proceed |
| `incident_alert` | Critical | A P0 or P1 production incident has been detected |
| `escalation` | High | An employee has escalated a decision that exceeds internal authority |
| `status_update` | Medium | A significant milestone has been reached |
| `company_health` | Low | A company health metric has changed materially |

### Notification Detail View
- Type and priority
- What happened (plain language)
- Why it requires CEO attention
- What happens next if approved vs. rejected
- The employee or workflow that generated it
- Related work items (linked)
- Action buttons where applicable (Approve / Reject / View)

### Notification Rules
- Implementation details never generate notifications
- Routine task completions never generate CEO notifications
- Every notification has a clear action or is explicitly informational
- Critical notifications cannot be dismissed without action
- Approved and rejected actions are permanently recorded

---

## 20. Search Model

Search in Engineering OS operates across all objects visible to the CEO. It is contextual — results are filtered by what the CEO is currently viewing.

### Global Search

Available from any screen. Searches across:
- Features (by name, description)
- Projects (by name)
- Employees (by name, role)
- Memory records (by content)
- Knowledge records (by title, content)
- Decisions (by title, description)
- Releases (by name)
- Incidents (by description)

### Search Result Types

Each result shows:
- Object type (visual indicator)
- Title or name
- Status
- Most relevant context snippet
- Navigation link

### Contextual Search

Within a specific section, search is scoped:
- Inside Memory: searches only memory records
- Inside Work: searches only work items
- Inside Company: searches only employees and settings

### Search Constraints

- Search never exposes code content, file paths, or commit messages
- Search is always framed in organizational language
- No raw database identifiers appear in search results

---

## 21. Global Navigation Concepts

### Breadcrumbs

Every drill-down view shows the path from the current view back to its parent:

```
Work › Projects › Password Reset › Review
```

Breadcrumbs are navigable — clicking any level returns the CEO to that level.

### Status Indicators

Every object carries a visual status indicator. Status indicators use consistent vocabulary across all object types:
- Active work: in-progress indicators
- Completed work: completion indicators
- Blocked work: alert indicators
- Requiring approval: action-required indicators

### Object Linking

Everywhere two objects are related, the relationship is surfaced as a navigable link. A Project links to its Feature. A Feature links to its Initiative. A Release links to its QA Result. The CEO can traverse the full chain of any work item without losing context.

### CEO Interaction Points

The CEO interacts with the product in exactly four ways:
1. **Goal input** — stating what the company should work on next
2. **Approvals** — approving, rejecting, or requesting changes to proposals
3. **Browse** — reviewing company state, history, and memory
4. **Configure** — adjusting company settings

Every product surface is either supporting one of these four interaction modes or it does not belong in the product.

---

## 22. Relationships Between Sections

The following diagram shows how the primary navigation sections relate to each other and to the underlying domain model.

```
Dashboard
├── reads from: Company Runtime
├── links to: Work (for active work items)
├── links to: Inbox (for pending approvals)
└── links to: Company (for health drill-down)

Company
├── reads from: Departments, Employees, Company Settings
├── links to: Work (via Employee → current task)
└── links to: Memory (via Employee → memory contributions)

Work
├── reads from: Workspace, Repository, Projects, Features, Tasks, Reviews, QA Results, Releases, Incidents
├── links to: Memory (via Feature → Feature Memory)
├── links to: Knowledge (via Feature → Feature Brief)
└── links to: Company (via Task → assigned Employee)

Memory
├── reads from: Memory Records, Decision Records, Feature Memory
├── links to: Work (via Memory Record → source work item)
└── links to: Company (via Decision Record → decision maker)

Inbox
├── reads from: Notifications, Conversations
├── links to: Work (via Notification → work item)
└── links to: Company (via Conversation → participants)
```

### Cross-Section Traversal Examples

**From Dashboard → to the reason for an active review:**  
Dashboard → Active Work → "Reviewing: Password Reset PR" → Project → Review → Findings

**From Work → to the decision that shaped the architecture:**  
Work → Projects → Feature → Feature Brief → Memory → Decision Record

**From Company → to an employee's recent quality contribution:**  
Company → Employees → QA Engineer → Work History → QA Results → Features tested

**From Inbox → to the full context of an approval request:**  
Inbox → Approval Request → "Password Reset ready for release" → Release → QA Result → Go recommendation → Feature Brief → Acceptance Criteria

---

## Relationship to Other Architecture Documents

- **DOMAIN_MODEL.md** defines the objects this IA organizes and their rules. Every object referenced here is defined there.
- **TECHNICAL_ARCHITECTURE.md** defines the modules that own and serve the objects organized here.
- **COMPANY_RUNTIME.md** defines the live behavioral layer that populates the Dashboard and Inbox.
- **MVP_ROADMAP.md** defines which sections of this IA ship in V1 and which are deferred.

---

## V1 Scope

All sections defined in this document are in scope for V1 except the following, which are deferred:

| Section | Status | Reason |
|---|---|---|
| Growth department pages (SEO, Analytics, Marketing) | V2 | Growth employees deferred to V2 |
| Multi-repository navigation | V2 | V1 supports one repository |
| Employee hiring / customization | V2 | Fixed roster in V1 |
| Employee promotions | V2 | Performance tracking V2 |
| Knowledge Graph visualization | V2 | Defined in PRODUCT_REQUIREMENTS.md as V2-09 |
| Multi-stakeholder company views | V2 | Single CEO in V1 |
