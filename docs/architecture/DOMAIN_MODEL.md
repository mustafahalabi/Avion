# Domain Model — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-26  

This document is the single source of truth for every object inside Engineering OS. It defines what each object is, who owns it, what relationships it participates in, and what rules govern its lifecycle. All implementation — data storage, API design, workflow execution — must align with this model.

This document is intentionally implementation-neutral. It does not specify storage engines, serialization formats, programming languages, or API design. It defines the business domain.

---

## Table of Contents

- [Entity Relationship Overview](#entity-relationship-overview)
- [Core Organizational Objects](#core-organizational-objects)
  - [Company](#company)
  - [Department](#department)
  - [Employee](#employee)
  - [Role](#role)
  - [User](#user)
  - [Session](#session)
  - [Permission](#permission)
- [Workspace and Configuration Objects](#workspace-and-configuration-objects)
  - [Workspace](#workspace)
  - [Organization Settings](#organization-settings)
  - [Company Settings](#company-settings)
- [Engineering Objects](#engineering-objects)
  - [Repository](#repository)
  - [Project](#project)
  - [Initiative](#initiative)
  - [Goal](#goal)
  - [Epic](#epic)
  - [Feature](#feature)
  - [Task](#task)
  - [Subtask](#subtask)
  - [Sprint](#sprint)
  - [Milestone](#milestone)
  - [Plan](#plan)
  - [Execution](#execution)
- [Quality and Delivery Objects](#quality-and-delivery-objects)
  - [Review](#review)
  - [QA Result](#qa-result)
  - [Release](#release)
  - [Incident](#incident)
  - [Risk](#risk)
  - [Recommendation](#recommendation)
- [Knowledge and Memory Objects](#knowledge-and-memory-objects)
  - [Memory](#memory)
  - [Memory Record](#memory-record)
  - [Knowledge](#knowledge)
  - [Knowledge Record](#knowledge-record)
  - [Knowledge Source](#knowledge-source)
  - [Decision](#decision)
  - [Decision Record](#decision-record)
- [Communication Objects](#communication-objects)
  - [Conversation](#conversation)
  - [Message](#message)
  - [Notification](#notification)
  - [Comment](#comment)
- [Operational Objects](#operational-objects)
  - [Artifact](#artifact)
  - [Document](#document)
  - [Report](#report)
  - [Attachment](#attachment)
  - [Integration](#integration)
  - [Event](#event)
  - [Timeline Entry](#timeline-entry)
- [Status Objects](#status-objects)
  - [Employee Status](#employee-status)
  - [Task Status](#task-status)
  - [Review Status](#review-status)
  - [Release Status](#release-status)
  - [Repository Status](#repository-status)
- [Runtime Objects](#runtime-objects)
  - [Company Runtime](#company-runtime)
- [Cardinality Reference](#cardinality-reference)

---

## Entity Relationship Overview

The following diagram represents the top-level domain relationships. All cardinality is defined in detail in each object's section and in the [Cardinality Reference](#cardinality-reference).

```
User (1)
└── Company (1)
    ├── Company Settings (1)
    ├── Department (many)
    │   └── Employee (many)
    │       └── Employee Status (1)
    ├── Workspace (1)
    │   ├── Repository (many)
    │   │   └── Repository Status (1)
    │   ├── Sprint (many)
    │   └── Milestone (many)
    ├── Initiative (many)
    │   └── Goal (many)
    │       └── Epic (many)
    │           └── Feature (many)
    │               └── Task (many)
    │                   └── Subtask (many)
    ├── Project (many)
    │   └── Task (many)
    ├── Conversation (many)
    │   └── Message (many)
    ├── Memory (1)
    │   └── Memory Record (many)
    ├── Knowledge (1)
    │   ├── Knowledge Record (many)
    │   └── Knowledge Source (many)
    ├── Decision Record (many)
    ├── Review (many)
    │   └── Review Status (1)
    ├── QA Result (many)
    ├── Release (many)
    │   └── Release Status (1)
    ├── Incident (many)
    ├── Notification (many)
    ├── Event (many)
    ├── Timeline Entry (many)
    ├── Artifact (many)
    │   └── Attachment (many)
    ├── Document (many)
    ├── Report (many)
    ├── Risk (many)
    ├── Recommendation (many)
    ├── Plan (many)
    ├── Execution (many)
    ├── Integration (many)
    └── Company Runtime (1)
```

---

## Core Organizational Objects

---

### Company

**Purpose:** The top-level organizational unit. Every object in Engineering OS belongs to a Company.

**Description:** A Company is the virtual software organization assigned to a User. It encapsulates all employees, memory, configuration, active work, and history. The Company persists across sessions and accumulates knowledge and capability over time. A Company behaves like a real engineering organization — it has culture, structure, standards, and memory.

**Owner:** CEO (User)

**Relationships:**
- Belongs to: one User
- Owns: one Company Settings, one Workspace, one Memory, one Knowledge, one Company Runtime
- Contains: many Departments, many Initiatives, many Projects, many Conversations, many Decision Records, many Reviews, many QA Results, many Releases, many Incidents, many Notifications, many Events, many Timeline Entries, many Artifacts, many Documents, many Reports, many Risks, many Recommendations, many Plans, many Executions, many Integrations

**Lifecycle:**
- Created: when a User creates their account
- Active: from creation onward
- Archived: if the User deactivates their account
- Deleted: only by explicit User request; permanent deletion is irreversible

**Required Fields:**
- id
- name
- user_id (owner reference)
- created_at
- status (active / archived / deleted)
- autonomy_level (manual / suggest / assist / delegate / autonomous)
- culture_profile (startup / enterprise / design_first / performance_first)

**Optional Fields:**
- description
- logo
- primary_language (default coding language)
- timezone

**Responsibilities:**
- Serve as the namespace for all owned objects
- Enforce autonomy level settings across all workflows
- Propagate culture configuration to all employees

**Invariants:**
- A Company always has exactly one User owner
- A Company always has exactly one Company Runtime
- A Company always has exactly one Memory
- A Company always has exactly one Knowledge
- A Company always has exactly one Workspace
- autonomy_level is always one of the defined values

**Creation Rules:**
- A Company is created once per User account
- Initial employees are provisioned from the default roster
- Company Settings are initialized with defaults

**Update Rules:**
- autonomy_level and culture_profile can be changed by the User at any time
- Changes to autonomy_level take effect on the next workflow phase boundary, not mid-phase

**Deletion Rules:**
- Deletion is permanent and irreversible
- All owned objects are archived before deletion for compliance purposes
- Deletion requires explicit confirmation from the User

---

### Department

**Purpose:** An organizational unit that groups employees with related responsibilities.

**Description:** A Department represents a permanent business capability within the Company. Departments provide organizational stability — employees change, processes evolve, but departments persist. Each Department owns a defined category of responsibility. No two Departments own the same responsibility. Departments collaborate across boundaries; they do not compete.

**Owner:** CTO

**Relationships:**
- Belongs to: one Company
- Contains: many Employees
- Referenced by: Responsibility Matrix, SOPs, Workflow assignments

**Departments in V1:**
| Department | Mission |
|---|---|
| Executive | Long-term direction and organizational health |
| Product | Transform goals into executable work |
| Engineering | Design, implement, and maintain software |
| Quality | Protect the quality of all company output |
| Operations | Deliver software safely and reliably |
| Growth | Increase product visibility and adoption |

**Lifecycle:**
- Created: at Company creation (pre-seeded with six departments)
- Active: from creation onward
- Retired: when an organizational restructure removes the department's mission

**Required Fields:**
- id
- company_id
- name
- mission
- created_at
- status (active / retired)

**Optional Fields:**
- description
- lead_employee_id (the primary coordinating employee)

**Responsibilities:**
- Group employees by expertise domain
- Provide organizational stability across employee changes

**Invariants:**
- Every Employee belongs to exactly one primary Department
- Every Department has a distinct mission — no two Departments own the same responsibility
- A Company always has at least one active Department

**Creation Rules:**
- Six departments are created at Company creation
- New departments require CEO approval and must represent a permanent, distinct organizational capability

**Update Rules:**
- Mission may be clarified but not fundamentally changed without CEO approval
- Ownership of responsibilities may not silently shift between departments

**Deletion Rules:**
- A Department may not be deleted while it contains active Employees
- Employees must be reassigned before Department retirement

---

### Employee

**Purpose:** A specialist organizational role that owns a defined domain of work within the Company.

**Description:** An Employee is the organizational abstraction that makes Engineering OS a company rather than a collection of AI agents. Each Employee has a mission, defined responsibilities, decision-making authority, persistent memory, escalation rules, and a communication style. Employees behave as professionals — they never produce vague answers, they surface problems rather than hiding them, and they own their outputs.

Users do not interact with AI models. Users interact with Employees.

**Owner:** Department lead (CTO for most Engineering department roles; Product Manager for Product department roles)

**Relationships:**
- Belongs to: one Company, one Department
- Has: one Employee Status, one Role
- Participates in: many Tasks, many Reviews, many Conversations, many Executions
- References: Company Memory, Repository Memory, Feature Memory
- Produces: Artifacts, Documents, Decision Records, Reports, Comments
- Escalates to: other Employees (per Reporting Structure)

**Employees in V1:**
| Employee | Department | Reports To |
|---|---|---|
| CTO | Executive | CEO |
| Product Manager | Product | CTO |
| Technical Writer | Product | Product Manager |
| Tech Lead | Engineering | CTO |
| Frontend Engineer | Engineering | Tech Lead |
| Backend Engineer | Engineering | Tech Lead |
| AI Engineer | Engineering | Tech Lead |
| Infrastructure Engineer | Engineering | Tech Lead |
| Reviewer | Quality | Tech Lead |
| QA Engineer | Quality | Tech Lead |
| Security Engineer | Quality | CTO |
| DevOps Engineer | Operations | CTO |
| Release Manager | Operations | CTO |
| Monitoring Engineer | Operations | Release Manager |
| SEO Specialist | Growth | Product Manager |

**Lifecycle:**
- Active: participating in company workflows
- Unavailable: temporarily unable to participate (system state only)
- Planned: approved but not yet deployed
- Retired: removed from active workflows

**Required Fields:**
- id
- company_id
- department_id
- role_id
- name (display name)
- mission
- status (active / unavailable / planned / retired)
- created_at

**Optional Fields:**
- specialization
- seniority_level
- performance_score
- last_active_at
- current_task_id

**Responsibilities:**
- Execute work within their defined domain
- Escalate decisions that exceed their authority
- Communicate in the company's structured format (Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action)
- Update Memory records after completing significant work
- Continuously improve based on review and incident feedback

**Invariants:**
- An Employee belongs to exactly one Department
- An Employee has exactly one Role
- An Employee never performs work outside their domain unless explicitly coordinated
- Every escalation from an Employee follows a defined path

**Creation Rules:**
- V1 employees are provisioned at Company creation from the standard roster
- New employees may only be added for roles defined in the Employee Directory
- Employee creation requires CTO approval

**Update Rules:**
- Mission and responsibilities may not be unilaterally changed by the Employee
- Performance metrics update continuously based on completed work
- Memory updates are triggered by workflow completion events

**Deletion Rules:**
- An Employee may not be deleted while owning active Tasks or Reviews
- All owned work must be reassigned before deletion
- Historical records of an Employee's work persist after deletion

---

### Role

**Purpose:** The formal job definition that specifies what an Employee is authorized to do.

**Description:** A Role is the template from which an Employee is instantiated. It defines the mission, authority boundaries, decision framework, escalation rules, communication standards, KPIs, and memory ownership for a class of employee. Multiple Employees of the same Role may exist in a Company (e.g., two Frontend Engineers), but each is a separate Employee instance.

**Owner:** CTO

**Relationships:**
- Belongs to: Company (via role registry)
- Instantiated as: many Employees
- Referenced by: SOPs (participant definitions), Responsibility Matrix, Reporting Structure

**Required Fields:**
- id
- name
- department_id
- mission
- authority_level (executive / department_lead / specialist)
- decision_framework (ordered list of priorities)
- handbook_reference (path to the Role's operational handbook)

**Optional Fields:**
- parent_role_id (for role hierarchies in future versions)
- specialization_options

**Invariants:**
- Every Employee has exactly one Role
- A Role's authority boundary may not be expanded without CTO approval
- Role definitions are consistent across all Companies (they are system-level, not company-level)

---

### User

**Purpose:** The human who owns and directs the Company. The CEO.

**Description:** The User is the only human participant in Engineering OS. All other actors are Employees. The User defines goals, approves significant decisions, and receives summaries. The User never writes code, creates tickets, manages deployments, or coordinates between tools. The User experience is the CEO experience.

**Owner:** Self

**Relationships:**
- Owns: one Company
- Has: many Sessions, one set of Permissions
- Initiates: Conversations, Goals, Approvals

**Required Fields:**
- id
- email
- created_at
- status (active / suspended / deleted)
- name

**Optional Fields:**
- timezone
- notification_preferences
- preferred_language

**Invariants:**
- Each User owns exactly one Company in V1
- A User cannot impersonate an Employee
- A User's email is unique across the system

**Creation Rules:**
- Created on account registration
- Email verification required before Company is provisioned

**Deletion Rules:**
- User deletion triggers Company archival
- Permanent deletion is irreversible and requires multi-step confirmation

---

### Session

**Purpose:** A bounded period of active interaction between a User and their Company.

**Description:** A Session represents a single authenticated visit by the User. Sessions track authentication state, current workspace context, and active conversation threads. Sessions expire after inactivity.

**Owner:** System (on behalf of User)

**Relationships:**
- Belongs to: one User
- Scoped to: one Company
- References: active Conversations, active Notifications

**Required Fields:**
- id
- user_id
- created_at
- expires_at
- ip_address (hashed)
- status (active / expired / revoked)

**Invariants:**
- A Session always belongs to exactly one User
- An expired or revoked Session cannot be resumed

---

### Permission

**Purpose:** Defines what a User is authorized to do within a Company.

**Description:** Permissions govern what actions a User may take — viewing, approving, configuring, or overriding company behavior. In V1, the User (CEO) has full permissions. This object is defined now to support future multi-stakeholder companies where different users have different authority.

**Owner:** System (initialized at Company creation)

**Required Fields:**
- id
- user_id
- company_id
- scope (company / workspace / employee / settings)
- actions (list of permitted actions)

---

## Workspace and Configuration Objects

---

### Workspace

**Purpose:** The operational context in which engineering work happens for a given Company.

**Description:** The Workspace aggregates the active engineering surface — connected repositories, active sprints, and milestones. It is the "shop floor" of the company. While the Company is the organizational entity, the Workspace is where engineering execution lives.

**Owner:** Tech Lead (operationally), CTO (structurally)

**Relationships:**
- Belongs to: one Company
- Contains: many Repositories, many Sprints, many Milestones
- Referenced by: Tasks, Projects, Plans

**Required Fields:**
- id
- company_id
- name
- created_at
- status (active / inactive)

**Invariants:**
- A Company has exactly one active Workspace in V1
- All engineering work is scoped to a Workspace

---

### Organization Settings

**Purpose:** System-level configuration that applies to the entire platform.

**Description:** Settings that govern platform-wide behavior — authentication providers, notification delivery, integration credentials. Distinguished from Company Settings, which govern organizational behavior within a specific Company.

**Owner:** System

**Required Fields:**
- id
- setting_key
- setting_value
- scope (global / per_company)
- updated_at

---

### Company Settings

**Purpose:** The configuration that governs how a specific Company behaves.

**Description:** Company Settings encode the user's configuration choices: autonomy level, culture profile, notification preferences, approval thresholds, and integration configurations. These settings propagate to all employees and workflows within the company.

**Owner:** CEO (User)

**Relationships:**
- Belongs to: one Company (one-to-one)
- Referenced by: all Employees, all Workflows, all SOPs

**Required Fields:**
- id
- company_id
- autonomy_level (manual / suggest / assist / delegate / autonomous)
- culture_profile (startup / enterprise / design_first / performance_first)
- created_at
- updated_at

**Optional Fields:**
- approval_required_for (list of action types requiring explicit approval)
- notification_channels
- deployment_window_preference
- security_sensitivity_level

**Invariants:**
- Exactly one Company Settings record per Company
- autonomy_level is always a valid enum value
- culture_profile is always a valid enum value

**Update Rules:**
- autonomy_level changes take effect on the next workflow phase boundary
- culture_profile changes take effect immediately for new work; in-progress work continues under the previous profile unless explicitly changed

---

## Engineering Objects

---

### Repository

**Purpose:** A connected codebase that the Company manages.

**Description:** A Repository is the primary artifact the Engineering department operates on. It represents a version-controlled codebase — its structure, architecture, dependencies, conventions, and history. The Company builds repository-specific memory that informs all engineering decisions for that repository. In V1, a Workspace contains one Repository.

**Owner:** CTO (strategically), Tech Lead (operationally)

**Relationships:**
- Belongs to: one Workspace
- Has: one Repository Status, one Repository Memory (subset of Company Memory)
- Contains: many Projects, many Features, many Branches (conceptual)
- Referenced by: Tasks, Decisions, Architecture records

**Required Fields:**
- id
- workspace_id
- name
- url
- primary_language
- created_at
- status_id (reference to Repository Status)

**Optional Fields:**
- description
- default_branch
- framework_stack (list)
- ci_configuration_reference
- last_analyzed_at

**Lifecycle:**
- Connecting: being onboarded; CTO and Tech Lead are analyzing
- Active: fully onboarded; all workflows available
- Stale: not actively worked on
- Archived: disconnected; history retained

**Invariants:**
- A Repository URL must be unique within a Company
- An Active Repository must have at least a partially populated Repository Memory record

**Creation Rules:**
- The User connects the Repository by providing its URL and credentials
- CTO and Tech Lead analyze the repository and populate initial memory before it enters Active status
- The User reviews the architecture summary before the repository becomes fully Active

---

### Project

**Purpose:** A bounded unit of engineering work, scoped to a single feature or initiative delivery.

**Description:** A Project groups the Tasks, Reviews, QA Results, and Artifacts that belong to a specific engineering effort. A Project is always scoped to a Repository. Projects are created by the Tech Lead from an approved Feature Brief and are closed when the feature ships.

**Owner:** Product Manager (scope), Tech Lead (execution)

**Relationships:**
- Belongs to: one Repository
- References: one Feature (the originating feature brief)
- Contains: many Tasks, many Reviews, many QA Results, many Artifacts
- References: one Sprint
- Produces: one Release (on completion)

**Required Fields:**
- id
- repository_id
- feature_id
- name
- status (planning / in_progress / in_review / in_qa / releasing / done / cancelled)
- created_at
- owned_by (employee_id — Tech Lead)

**Lifecycle:**
- Planning: Feature Brief exists; tasks being decomposed
- In Progress: engineers are implementing
- In Review: code review phase
- In QA: QA validation phase
- Releasing: release readiness and deployment
- Done: shipped, documented, memory updated
- Cancelled: explicitly cancelled before completion

**Invariants:**
- A Project must reference exactly one Feature
- A Project that reaches Done must have an associated Release record
- A Project cannot move to Done without a QA Result showing a Go recommendation

---

### Initiative

**Purpose:** A strategic grouping of related Goals that together accomplish a significant business objective.

**Description:** An Initiative is the highest-level planning object. It represents a strategic direction — "Improve user onboarding," "Achieve SOC 2 compliance," "Launch mobile app." Each Initiative contains one or more Goals. Initiatives are created by the Product Manager with CEO input and reflect the Company's current strategic priorities.

**Owner:** Product Manager

**Relationships:**
- Belongs to: one Company
- Contains: many Goals
- Referenced by: Milestones, Planning cycles

**Required Fields:**
- id
- company_id
- name
- description
- status (proposed / approved / in_progress / completed / cancelled)
- created_by (employee_id — Product Manager)
- approved_by (user_id — CEO)
- created_at

**Invariants:**
- An Initiative must be CEO-approved before Goals may be created under it
- An Initiative has at least one Goal when In Progress

---

### Goal

**Purpose:** A measurable business outcome that one or more Epics deliver toward.

**Description:** A Goal is a concrete, measurable target within an Initiative. Goals bridge business intent (Initiative) and engineering execution (Epic → Feature → Task). Goals have success metrics and a clear owner. A Goal is "done" when its success metric is achieved, not when its implementation tasks are complete.

**Owner:** Product Manager

**Relationships:**
- Belongs to: one Initiative
- Contains: many Epics
- References: success metrics (defined in Goal)

**Required Fields:**
- id
- initiative_id
- title
- success_metric (specific, measurable condition)
- status (defined / in_progress / achieved / abandoned)
- owner_employee_id
- created_at

**Invariants:**
- Every Goal must have a defined success metric
- A Goal is not "achieved" solely because its Epics are complete — the success metric must be verified

---

### Epic

**Purpose:** A collection of related Features that together deliver a significant engineering capability.

**Description:** An Epic groups Features that must be built together to achieve a Goal. Epics provide intermediate-scale planning — larger than a Feature, smaller than a Goal. They are created by the Tech Lead during technical planning.

**Owner:** Tech Lead

**Relationships:**
- Belongs to: one Goal
- Contains: many Features

**Required Fields:**
- id
- goal_id
- title
- description
- status (backlog / in_progress / done)
- owner_employee_id
- created_at

---

### Feature

**Purpose:** A specific, deliverable product capability — the primary unit of product planning.

**Description:** A Feature is what the Product Manager defines in a Feature Brief. It is the bridge between product intent and engineering execution. A Feature has acceptance criteria that must be satisfied for it to be considered complete. Every Feature that ships leaves a Feature Memory record.

**Owner:** Product Manager (definition), Tech Lead (execution)

**Relationships:**
- Belongs to: one Epic
- Has: one Project (when in development)
- Defined by: one Feature Brief (a type of Document)
- Contains: many Tasks (via Project)
- Produces: one Release (on completion)
- Produces: one Feature Memory record

**Required Fields:**
- id
- epic_id
- title
- status (backlog / brief_draft / brief_approved / in_development / in_review / in_qa / done / cancelled)
- feature_brief_id (Document reference)
- acceptance_criteria (list)
- created_by (employee_id — Product Manager)
- created_at

**Optional Fields:**
- estimated_effort
- success_metrics
- out_of_scope (list)
- dependencies (list of Feature or Task IDs)

**Invariants:**
- A Feature must have an approved Feature Brief before it moves to In Development
- A Feature's acceptance criteria must be satisfied before it moves to Done
- A Feature is not Done until its Feature Memory record is created

**Deletion Rules:**
- Features are cancelled, not deleted
- Cancelled features retain their history for memory purposes

---

### Task

**Purpose:** The atomic unit of engineering work — one deliverable, one owner, one day.

**Description:** A Task is produced by the Tech Lead's decomposition of a Feature Brief. Each Task maps to one or more acceptance criteria. Each Task has a clear Definition of Done and is assigned to exactly one Engineer. Tasks must be small enough to complete within a single working day.

**Owner:** Tech Lead (assignment), assigned Engineer (execution)

**Relationships:**
- Belongs to: one Project
- Assigned to: one Employee
- May have: many Subtasks
- Produces: one or more Review requests
- References: acceptance criteria (from Feature)
- Has: one Task Status
- May depend on: other Tasks (dependency graph)

**Required Fields:**
- id
- project_id
- title
- description
- definition_of_done (list of conditions)
- status_id (Task Status reference)
- assigned_to (employee_id)
- assigned_by (employee_id — Tech Lead)
- maps_to_ac (list of acceptance criterion references)
- estimate_hours
- created_at

**Optional Fields:**
- depends_on (list of task_ids)
- notes
- actual_hours
- completed_at

**Invariants:**
- A Task always has exactly one assigned Employee
- A Task's estimate must be one working day or less; anything larger must be decomposed
- A Task must map to at least one acceptance criterion in its parent Feature
- A Task may not be marked Done without its Definition of Done fully satisfied

**Creation Rules:**
- Tasks are created exclusively by the Tech Lead
- Engineers do not self-assign tasks
- Tasks are created in bulk before a sprint begins

---

### Subtask

**Purpose:** A smaller unit of work within a Task, used to track granular implementation progress.

**Description:** Subtasks are internal checkpoints within a Task. They do not independently flow through SOPs or reviews — they exist to help the assigned Engineer track progress and for the Tech Lead to monitor granular delivery. A Subtask is always completed within its parent Task's lifecycle.

**Owner:** Assigned Engineer (same as parent Task)

**Relationships:**
- Belongs to: one Task
- Assigned to: same Employee as parent Task

**Required Fields:**
- id
- task_id
- title
- status (todo / in_progress / done)
- created_at

**Invariants:**
- All Subtasks must be completed before the parent Task moves to Done

---

### Sprint

**Purpose:** A bounded time window in which a planned set of Tasks is executed.

**Description:** A Sprint is the execution container for a set of Tasks within a Workspace. Sprints have a defined start and end date and a committed scope. Sprint scope is set by the Tech Lead and approved by the Product Manager. Sprint outcomes are reported to the CEO.

**Owner:** Tech Lead

**Relationships:**
- Belongs to: one Workspace
- Contains: many Tasks
- References: one or more Projects
- Produces: Sprint Summary Report

**Required Fields:**
- id
- workspace_id
- name
- start_date
- end_date
- status (planned / active / completed / cancelled)
- committed_task_ids (list)
- created_at

**Optional Fields:**
- velocity (tasks completed)
- notes

**Invariants:**
- A Sprint's committed tasks must all be assigned before the sprint begins
- A Sprint's end date may only be extended with CTO approval

---

### Milestone

**Purpose:** A significant, time-anchored delivery marker in the project plan.

**Description:** A Milestone marks the completion of a major phase of work — the completion of an Epic, the launch of a major feature, or the delivery of an Initiative. Milestones are visible to the CEO and serve as the primary progress markers in company reporting.

**Owner:** Product Manager

**Relationships:**
- Belongs to: one Workspace
- References: one or more Features, Epics, or Initiatives
- Referenced by: Release, Timeline

**Required Fields:**
- id
- workspace_id
- name
- target_date
- status (upcoming / in_progress / achieved / missed)
- created_at

---

### Plan

**Purpose:** A structured, written specification of how the company intends to accomplish a goal.

**Description:** A Plan is created by the Product Manager or Tech Lead at the start of a significant body of work. It captures intent before execution begins. Plans are distinct from Executions — a Plan describes what will happen; an Execution records what did happen. Plans are stored in company memory and referenced when similar work is undertaken in the future.

**Owner:** Product Manager (feature plans), Tech Lead (technical plans)

**Relationships:**
- Belongs to: one Company
- References: one or more Features, Projects, or Initiatives
- Associated with: one Execution (when executed)

**Required Fields:**
- id
- company_id
- type (feature_plan / technical_plan / release_plan / incident_plan)
- title
- description
- status (draft / approved / executing / completed / superseded)
- created_by (employee_id)
- created_at

**Optional Fields:**
- approved_by
- associated_execution_id

---

### Execution

**Purpose:** A record of what actually happened when a Plan was carried out.

**Description:** An Execution is the operational record of a Plan in action. It captures the sequence of events, decisions made, deviations from the plan, and the final outcome. Executions are essential to company memory — they are how the company learns from experience and improves future plans.

**Owner:** Tech Lead (feature/technical executions), Release Manager (release executions)

**Relationships:**
- Belongs to: one Company
- Associated with: one Plan
- References: Tasks, Reviews, QA Results, Releases
- Produces: Timeline Entries

**Required Fields:**
- id
- company_id
- plan_id
- status (in_progress / completed / failed / abandoned)
- started_at
- outcome (success / partial / failure)
- created_at

**Optional Fields:**
- completed_at
- deviations_from_plan (list of documented deviations)
- lessons_learned

---

## Quality and Delivery Objects

---

### Review

**Purpose:** A structured evaluation of code, architecture, or design before it advances to the next workflow phase.

**Description:** A Review is performed by the Reviewer role and applies the company's code quality standards to a submitted change. Every finding is classified (Blocking / Non-blocking / Question) and written in a structured format. A Review ends with one of three outcomes: Approve, Request Changes, or Escalate.

**Owner:** Reviewer (execution), Tech Lead (routing)

**Relationships:**
- Belongs to: one Company
- References: one Task or Project (the work being reviewed)
- May reference: one Security Review (when Security Engineer participates)
- Has: one Review Status
- Produces: Review findings (Comments)
- Triggers: security review (when security-relevant patterns are present)

**Required Fields:**
- id
- company_id
- subject_type (task / project / architecture)
- subject_id
- reviewer_employee_id
- status_id (Review Status reference)
- outcome (pending / approved / changes_requested / escalated)
- created_at

**Optional Fields:**
- security_review_required
- security_engineer_id
- completed_at
- findings_count_blocking
- findings_count_non_blocking
- findings_count_questions

**Lifecycle:**
- Assigned: routed to Reviewer
- In Review: Reviewer is examining the work
- Changes Requested: Blocking findings require author response
- Approved: no Blocking findings remain; code may merge
- Escalated: decision required beyond Reviewer authority

**Invariants:**
- A Review cannot be Approved while active Blocking findings exist
- A Review cannot be Approved while an active Security block exists
- Every finding must have a classification prefix, location, observation, reasoning, and suggestion

---

### QA Result

**Purpose:** The formal record of QA validation for a feature or bug fix.

**Description:** A QA Result is produced by the QA Engineer after executing a Test Plan. It contains the execution record, defect reports, defect resolution confirmations, and the written go/no-go recommendation. The go/no-go recommendation gates every release. It cannot be overridden at the Release Manager level — only the CTO may authorize an override.

**Owner:** QA Engineer

**Relationships:**
- Belongs to: one Company
- References: one Project or Feature (what was tested)
- References: one Sprint or Release (the delivery context)
- Contains: many Defect Reports (Artifacts)
- Produces: a written go/no-go recommendation (a type of Document)

**Required Fields:**
- id
- company_id
- project_id
- qa_engineer_employee_id
- recommendation (go / no_go)
- recommendation_written_at
- test_plan_id (Document reference)
- blocking_defects_resolved (boolean)
- created_at

**Optional Fields:**
- deferred_defects (list of defect IDs with deferral decisions)
- override_authorized_by (employee_id — CTO, when No-Go is overridden)
- override_rationale

**Invariants:**
- A QA Result must have a written recommendation before a Release may proceed
- A No-Go recommendation stops the release; proceeding requires a CTO-documented override
- The recommendation, once written, is never deleted or modified — only annotated with override decisions

---

### Release

**Purpose:** A formal record of a production deployment.

**Description:** A Release represents the act of delivering validated software to production. Every Release is owned by the Release Manager. No Release proceeds without a completed Release Readiness Checklist and a QA go recommendation. The Release record is the authoritative record of what shipped, when, and under what conditions.

**Owner:** Release Manager

**Relationships:**
- Belongs to: one Company
- References: one or more Features (what shipped)
- References: one QA Result (the go/no-go recommendation)
- References: one Changelog (Document)
- Has: one Release Status
- May produce: one Rollback record (if rolled back)
- References: Monitoring observations (post-release)

**Required Fields:**
- id
- company_id
- name (version or release identifier)
- status_id (Release Status reference)
- release_manager_employee_id
- qa_result_id
- checklist_completed_at
- deployment_started_at
- deployment_completed_at
- created_at

**Optional Fields:**
- rollback_record_id
- post_release_monitoring_window_closed_at
- incidents (list of incident IDs during this release)
- changelog_id

**Lifecycle:**
- Planning: Release Readiness Checklist being assembled
- Ready: Checklist complete; awaiting deployment window
- Deploying: Production deployment in progress
- Monitoring: Deployed; Monitoring Engineer watching post-release signals
- Stable: Monitoring window closed cleanly
- Rolled Back: deployment reversed; prior version restored
- Failed: deployment could not complete

**Invariants:**
- A Release cannot move to Deploying without a completed checklist
- A Release cannot move to Deploying without a QA go recommendation on record
- A Rolled Back Release retains its Release record; it is not deleted

---

### Incident

**Purpose:** A record of a production problem — its detection, response, and resolution.

**Description:** An Incident is created when a production anomaly requires active response. It tracks the timeline of the incident from detection through resolution. Every Incident produces a root cause analysis and a set of follow-up improvement actions. Incidents are critical inputs to company learning.

**Owner:** Monitoring Engineer (detection), Release Manager (response), Tech Lead (root cause)

**Relationships:**
- Belongs to: one Company
- References: one Release (the deployment associated with the incident)
- Produces: Root Cause Analysis (Document), Follow-up Tasks
- References: Rollback record (if rollback occurred)

**Required Fields:**
- id
- company_id
- severity (p0 / p1 / p2 / p3)
- status (detected / responding / mitigated / resolved / post_mortem_complete)
- detected_by (employee_id — Monitoring Engineer)
- detected_at
- created_at

**Optional Fields:**
- resolved_at
- root_cause_summary
- related_release_id
- rollback_triggered (boolean)
- follow_up_task_ids

**Invariants:**
- Every Incident must have a root cause analysis before it is fully closed
- P0 and P1 incidents require CTO and CEO notification
- An Incident record is never deleted

---

### Risk

**Purpose:** A documented uncertainty that could negatively affect work quality, timeline, or production stability.

**Description:** A Risk is identified during planning, implementation, or review and formally recorded so that it can be tracked and mitigated. Risks have likelihood and impact assessments and a named owner who is responsible for monitoring and mitigating them.

**Owner:** Employee who identified the risk (varies)

**Relationships:**
- Belongs to: one Company
- References: one or more Tasks, Features, Projects, or Releases
- May produce: Recommendation (mitigation strategy)

**Required Fields:**
- id
- company_id
- description
- likelihood (low / medium / high)
- impact (low / medium / high / critical)
- status (identified / monitoring / mitigated / accepted / realized)
- owner_employee_id
- identified_at

**Optional Fields:**
- mitigation_plan
- related_work_ids
- realized_incident_id (if the risk was realized as an Incident)

---

### Recommendation

**Purpose:** A structured suggestion from an Employee to the CEO or another Employee.

**Description:** A Recommendation is the formal output when an Employee believes a change in direction, approach, or priority would benefit the company. Recommendations follow the company's structured communication format: Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action. They are presented to the appropriate decision-maker and recorded whether accepted or rejected.

**Owner:** Recommending Employee

**Relationships:**
- Belongs to: one Company
- Created by: one Employee
- Addressed to: one Employee or User (CEO)
- References: optionally, a Task, Feature, Risk, or Decision

**Required Fields:**
- id
- company_id
- created_by_employee_id
- addressed_to (employee_id or user reference)
- recommendation (the specific action recommended)
- reasoning
- risks
- alternatives
- confidence_level (low / medium / high)
- next_action
- status (proposed / accepted / rejected / deferred)
- created_at

---

## Knowledge and Memory Objects

---

### Memory

**Purpose:** The top-level container for all company knowledge.

**Description:** Memory is one of the Company's most significant competitive assets. It is the organizational intelligence that accumulates over every project, review, incident, and deployment. Memory is not a document repository — it is an interconnected knowledge system that employees actively reference when making decisions and automatically update when completing work.

Memory is organized into layers: Employee Memory (role-specific), Team Memory (department-shared), Company Memory (organization-wide), Repository Memory (codebase-specific), Feature Memory (feature-specific), and Conversation Memory (session-scoped).

**Owner:** CTO (oversight), each Employee (their domain records)

**Relationships:**
- Belongs to: one Company (one-to-one)
- Contains: many Memory Records
- Referenced by: every Employee when making decisions

**Required Fields:**
- id
- company_id
- created_at
- record_count
- last_updated_at

**Invariants:**
- A Company has exactly one Memory
- Memory is never deleted — records are deprecated, not removed

---

### Memory Record

**Purpose:** A single, discrete piece of organizational memory.

**Description:** A Memory Record stores one fact, decision, standard, or pattern that the company knows. Records are created automatically by workflow completion events and manually by employees. Each record has a type, a scope, and a relevance indicator. Records are referenced by employees when performing work — if a relevant record exists, the employee uses it rather than re-deriving the same conclusion.

**Owner:** Employee who created it (or the workflow that generated it)

**Relationships:**
- Belongs to: one Memory
- Created by: one Employee or one Execution
- Referenced by: any Employee in relevant domain
- May supersede: another Memory Record (version chain)

**Required Fields:**
- id
- memory_id
- type (architecture / coding_standard / business_rule / decision / pattern / lesson_learned / feature_summary / repository_structure)
- scope (employee / team / company / repository / feature / conversation)
- content
- created_by_employee_id
- created_at
- status (active / deprecated / superseded)

**Optional Fields:**
- superseded_by_record_id
- relevance_context (describes when this record applies)
- source_work_item_id (the task, incident, or review that produced this record)

**Invariants:**
- A Memory Record cannot be deleted — only deprecated or superseded
- A superseded record retains a link to its successor
- Conversation-scope records are automatically expired after session close

---

### Knowledge

**Purpose:** The top-level container for structured, reference-quality organizational knowledge.

**Description:** Knowledge is the formal, curated tier of company information — architectural diagrams, coding standards, approved patterns, integration documentation. Distinguished from Memory by quality: Memory records are generated continuously and may be rough; Knowledge records are curated and authoritative. The Technical Writer maintains the Knowledge base.

**Owner:** Technical Writer (curation), CTO (authority)

**Relationships:**
- Belongs to: one Company (one-to-one)
- Contains: many Knowledge Records, many Knowledge Sources
- Referenced by: Employees, Feature Briefs, Architecture Reviews

**Required Fields:**
- id
- company_id
- created_at

---

### Knowledge Record

**Purpose:** A single, curated, authoritative piece of organizational knowledge.

**Description:** A Knowledge Record is a reference-quality document within the Knowledge base. Unlike Memory Records, Knowledge Records are intentionally authored and reviewed before publication. They represent the company's official position on a topic — the approved way to implement authentication, the documented API contract, the canonical architecture diagram.

**Owner:** Technical Writer (authorship), CTO or Tech Lead (approval)

**Relationships:**
- Belongs to: one Knowledge
- Created by: one Employee (Technical Writer)
- Reviewed by: one Employee (CTO or Tech Lead)
- May reference: Memory Records, Decisions, Artifacts

**Required Fields:**
- id
- knowledge_id
- title
- type (architecture / api_contract / pattern / standard / guide / runbook)
- content
- status (draft / in_review / published / deprecated)
- created_by_employee_id
- approved_by_employee_id
- created_at
- published_at

**Invariants:**
- A Knowledge Record must be approved before it is published
- Published records are never deleted — only deprecated with a pointer to the successor

---

### Knowledge Source

**Purpose:** An external or internal source from which company knowledge is derived.

**Description:** A Knowledge Source represents the origin of Knowledge Records — a repository analysis, an incident post-mortem, a vendor documentation set, or an architectural review. Tracking sources allows the company to re-derive knowledge when sources change and to attribute knowledge to its origin.

**Owner:** CTO

**Relationships:**
- Belongs to: one Knowledge
- Produces: many Knowledge Records
- References: Repository, Incidents, Documents, external URLs

**Required Fields:**
- id
- knowledge_id
- type (repository_analysis / incident_review / external_documentation / architectural_review / vendor_docs)
- reference (URL, file path, or identifier)
- created_at
- last_synchronized_at

---

### Decision

**Purpose:** A significant choice made by the company that has lasting consequences.

**Description:** A Decision captures a non-trivial choice — an architectural direction, a scope call, a risk acceptance, a technology selection. Decisions are distinct from implementation choices: they affect future work, constrain future options, or represent a deliberate trade-off. Every significant Decision produces a Decision Record.

**Owner:** The Employee who holds authority for the decision's domain (CTO for architecture, Product Manager for scope, etc.)

**Relationships:**
- Belongs to: one Company
- Made by: one Employee
- Approved by: one Employee or User (when approval is required)
- Produces: one Decision Record
- References: the work item or context in which the decision arose
- May reference: Alternatives considered (list within Decision Record)

**Required Fields:**
- id
- company_id
- title
- type (architecture / scope / security / risk_acceptance / process)
- description
- rationale
- decision_maker_employee_id
- status (proposed / approved / implemented / superseded / reversed)
- created_at

**Optional Fields:**
- approved_by_employee_id
- alternatives_considered (list)
- constraints_that_led_to_decision
- future_considerations

**Invariants:**
- Every Decision has exactly one decision maker
- A Decision that supersedes a prior Decision must reference the superseded Decision
- Decisions are never deleted

---

### Decision Record

**Purpose:** The permanent written record of a Decision, including its context, alternatives, and rationale.

**Description:** A Decision Record is how the company ensures that significant choices are preserved and discoverable. Unlike a Decision (which is the act), a Decision Record is the artifact that future employees reference. Decision Records answer: What was decided? Why? What alternatives were rejected? What should future decision-makers know?

**Owner:** The Employee who made the Decision

**Relationships:**
- Belongs to: one Company
- Documents: one Decision
- Stored in: Company Memory (as a Memory Record of type `decision`)
- Referenced by: future Tasks and Reviews that encounter the same domain

**Required Fields:**
- id
- company_id
- decision_id
- what_was_decided
- why
- alternatives_rejected (list with reasoning)
- trade_offs_accepted
- future_considerations
- created_by_employee_id
- created_at

---

## Communication Objects

---

### Conversation

**Purpose:** A structured dialogue between the CEO and the Company (or between Employees).

**Description:** A Conversation is the primary interface through which the CEO communicates goals and the Company communicates plans, progress, and recommendations. Conversations may be CEO-to-company (goal input, approval flow) or employee-to-employee (internal coordination). CEO conversations are always high-level — the company filters out implementation details. Employee conversations are scoped to work coordination.

**Owner:** Initiator (User for CEO conversations, Employee for internal conversations)

**Relationships:**
- Belongs to: one Company
- Initiated by: User or Employee
- Contains: many Messages
- May reference: Tasks, Features, Reviews, Decisions

**Required Fields:**
- id
- company_id
- initiated_by (user_id or employee_id)
- type (ceo_input / approval_request / internal_coordination / status_update)
- status (active / closed)
- created_at

**Optional Fields:**
- subject (brief description of the conversation topic)
- related_work_item_id

**Lifecycle:**
- Active: ongoing; new messages may be added
- Closed: concluded; read-only; retained in history

**Invariants:**
- CEO conversations never contain implementation details in responses
- Closed conversations are never deleted

---

### Message

**Purpose:** A single communication unit within a Conversation.

**Description:** A Message is an atomic communication — a goal from the CEO, a plan from the Product Manager, a status update from an Employee, or an approval request. Messages from Employees always follow the structured communication format when delivering recommendations. Messages are the operational record of how decisions were made and how work progressed.

**Owner:** Sender (User or Employee)

**Relationships:**
- Belongs to: one Conversation
- Sent by: User or Employee
- May reference: Tasks, Features, Plans, Recommendations

**Required Fields:**
- id
- conversation_id
- sender_type (user / employee)
- sender_id
- content
- created_at

**Optional Fields:**
- requires_action (boolean — triggers a Notification)
- action_type (approve / reject / review / inform)
- referenced_objects (list of object type + id)

**Invariants:**
- Messages are never deleted
- A Message that requires action creates a corresponding Notification

---

### Notification

**Purpose:** An alert surfaced to the CEO about an event that requires their attention or awareness.

**Description:** Notifications are the mechanism by which the Company communicates significant events to the CEO. They are strictly filtered — only events that genuinely require CEO attention generate notifications. Implementation details, routine task completions, and internal employee communications never surface as CEO notifications. Notifications may require action (Approve / Reject) or be informational.

**Owner:** System (generated by workflow events)

**Relationships:**
- Belongs to: one Company
- Addressed to: User (CEO)
- Generated by: workflow events, approval requirements, escalations
- References: the work item or event that generated the notification

**Required Fields:**
- id
- company_id
- user_id (recipient)
- type (approval_request / status_update / incident_alert / company_health / escalation)
- priority (critical / high / medium / low)
- content
- status (unread / read / actioned / dismissed)
- created_at
- expires_at (optional; some notifications are time-bounded)

**Optional Fields:**
- action_required (boolean)
- action_type (approve / reject)
- actioned_at
- related_object_type
- related_object_id

**Invariants:**
- Critical notifications cannot be dismissed without action
- Notification content never contains implementation details for CEO-directed notifications

---

### Comment

**Purpose:** A contextual remark attached to a work item.

**Description:** A Comment is a structured annotation on any work object — a Task, Review finding, Feature, or Decision. Comments are used for clarification, implementation notes, review responses, and coordination. Employee comments on Review findings follow the structured finding format. All comments are retained permanently.

**Owner:** Author (Employee or User)

**Relationships:**
- Belongs to: one work object (Task, Review, Feature, Decision, etc.)
- Created by: Employee or User

**Required Fields:**
- id
- subject_type (task / review / feature / decision / qa_result / release)
- subject_id
- author_type (employee / user)
- author_id
- content
- created_at

**Invariants:**
- Comments are never deleted
- Review finding responses follow the structured response format

---

## Operational Objects

---

### Artifact

**Purpose:** A file, output, or deliverable produced during the execution of work.

**Description:** An Artifact is any produced output that has value beyond the workflow that created it — a compiled binary, a test report, a generated API contract, an evaluation report, a security scan result. Artifacts are linked to the work that produced them and retained in the Company's artifact store.

**Owner:** The Employee who produced it

**Relationships:**
- Belongs to: one Company
- Produced by: one Employee during one Task or Execution
- May have: many Attachments
- Referenced by: Reviews, QA Results, Releases, Memory Records

**Required Fields:**
- id
- company_id
- type (feature_brief / test_plan / api_contract / evaluation_report / security_scan / qa_report / release_record / root_cause_analysis / architecture_diagram)
- name
- produced_by_employee_id
- produced_during_work_item_id
- created_at
- status (draft / final / superseded)

**Optional Fields:**
- file_reference
- summary

---

### Document

**Purpose:** A formal written document produced by the Company.

**Description:** A Document is a structured, named piece of written content — a Feature Brief, a Changelog, a Release Note, user-facing documentation, or an SOP reference. Documents are owned, versioned, and reviewed before publication. They are the primary external-facing output of the Technical Writer and the primary planning output of the Product Manager.

**Owner:** The Employee who authored it

**Relationships:**
- Belongs to: one Company
- Authored by: one Employee
- Reviewed by: one or more Employees
- May supersede: prior Document version
- Referenced by: Tasks, Features, Releases, Knowledge Records

**Required Fields:**
- id
- company_id
- type (feature_brief / changelog / release_note / user_documentation / architecture_guide / runbook / sop_reference / api_documentation)
- title
- content
- status (draft / in_review / published / archived)
- authored_by_employee_id
- created_at

**Optional Fields:**
- reviewed_by (list of employee IDs)
- published_at
- version
- previous_version_id

**Invariants:**
- A published Document is never deleted — only archived with a pointer to its successor
- A Feature Brief must be in Published status before its Feature may enter development

---

### Report

**Purpose:** A periodic or event-driven summary of company state, employee performance, or engineering health.

**Description:** Reports are structured summaries produced by employees to communicate state to other employees or to the CEO. Sprint Progress Reports, Company Health Reports, and Security Assessment Reports are all Reports. They are not interactive documents — they capture a point-in-time view.

**Owner:** Producing Employee

**Relationships:**
- Belongs to: one Company
- Produced by: one Employee
- Referenced by: Notifications (when a report requires CEO attention)
- References: the objects whose state it summarizes

**Required Fields:**
- id
- company_id
- type (sprint_progress / company_health / security_assessment / qa_summary / deployment_summary / post_incident)
- produced_by_employee_id
- period_start
- period_end
- content
- created_at

---

### Attachment

**Purpose:** A binary file or external reference associated with an Artifact or Document.

**Description:** Attachments are files — screenshots, exported data, log archives, architecture images — that are linked to a parent Artifact or Document. Attachments are not documents themselves; they provide supporting evidence or supplementary material.

**Owner:** Same as parent Artifact or Document

**Relationships:**
- Belongs to: one Artifact or Document
- Uploaded by: Employee or System

**Required Fields:**
- id
- parent_type (artifact / document)
- parent_id
- name
- content_type
- size_bytes
- uploaded_by_employee_id
- created_at

---

### Integration

**Purpose:** A configured connection between Engineering OS and an external tool or service.

**Description:** Integrations allow the Company to read from and write to external systems — version control platforms, deployment platforms, monitoring tools, and communication tools. Each Integration has a type, credentials, and synchronization state. In V1, Integrations are primarily read/write connections to repository hosting.

**Owner:** CTO (configuration), DevOps Engineer (operations)

**Relationships:**
- Belongs to: one Company
- Referenced by: Repository (version control integrations), Release (deployment integrations)

**Required Fields:**
- id
- company_id
- type (version_control / deployment / monitoring / communication / issue_tracking)
- provider (github / gitlab / vercel / datadog / etc.)
- status (active / inactive / errored)
- created_at
- last_synchronized_at

**Optional Fields:**
- credentials_reference (encrypted reference — never the raw credential)
- sync_configuration

**Invariants:**
- Credentials are never stored in plaintext
- An errored Integration generates a Notification to the CTO

---

### Event

**Purpose:** An immutable record of something that happened within the Company.

**Description:** Events are the audit log of the Company. Every significant state transition — a Task completing, a Review being approved, a Release deploying, a Memory Record being created — generates an Event. Events are append-only and never modified. They are the foundation for Timeline Entries and for the audit capabilities required by compliance-sensitive customers.

**Owner:** System

**Relationships:**
- Belongs to: one Company
- References: the object whose state changed
- Produces: Timeline Entries (when user-facing display is appropriate)

**Required Fields:**
- id
- company_id
- type (defined vocabulary of event types)
- actor_type (employee / user / system)
- actor_id
- subject_type (the object type whose state changed)
- subject_id
- payload (the state change details)
- created_at

**Invariants:**
- Events are immutable — never updated or deleted
- Every significant state transition produces an Event
- The Event log is the source of truth for "what happened" in the Company

---

### Timeline Entry

**Purpose:** A user-facing representation of a significant event in the Company's history.

**Description:** Timeline Entries are the human-readable layer on top of the raw Event log. While Events capture everything, Timeline Entries surface what matters to the CEO — features shipped, incidents resolved, architectural decisions made, memory records updated. The Timeline is the Company's story.

**Owner:** System (generated from Events)

**Relationships:**
- Belongs to: one Company
- Generated from: one or more Events
- References: the work items whose completion is being recorded

**Required Fields:**
- id
- company_id
- event_ids (list of Events that produced this entry)
- type (feature_shipped / incident_resolved / decision_made / milestone_reached / release_deployed / memory_updated)
- title
- description
- created_at (time of the underlying event)

---

## Status Objects

Status objects define the allowed lifecycle states for domain objects. They are value objects, not entities — they have no independent lifecycle, only meaning within their domain.

---

### Employee Status

| Value | Description |
|---|---|
| `active` | Participating in company workflows; can be assigned work |
| `unavailable` | Temporarily unable to participate (system state, not manually set) |
| `planned` | Approved for future provisioning; not yet active |
| `retired` | No longer participates; historical record retained |

---

### Task Status

| Value | Description |
|---|---|
| `backlog` | Defined; not yet in a sprint |
| `todo` | In a sprint; not yet started |
| `in_progress` | Assigned engineer is actively working |
| `blocked` | Cannot progress; blocker recorded |
| `in_review` | Submitted for code review |
| `in_qa` | In QA validation |
| `done` | Definition of Done satisfied; QA passed |
| `cancelled` | Explicitly cancelled; will not be completed |

**Invariants:**
- `done` requires all Subtasks to be complete
- `done` requires the parent Feature's acceptance criteria to be satisfied (via Review and QA)
- `cancelled` tasks retain their history

---

### Review Status

| Value | Description |
|---|---|
| `assigned` | Routed to Reviewer; not yet started |
| `in_review` | Reviewer is actively examining the work |
| `changes_requested` | One or more Blocking findings; waiting on author |
| `security_review` | Pending Security Engineer review |
| `approved` | No Blocking findings; code may merge |
| `escalated` | Decision required beyond Reviewer authority |

**Invariants:**
- `approved` is not reachable while Blocking findings are open
- `approved` is not reachable while Security Engineer has an active block

---

### Release Status

| Value | Description |
|---|---|
| `planning` | Release Readiness Checklist being assembled |
| `ready` | Checklist complete; awaiting deployment window |
| `deploying` | Production deployment in progress |
| `monitoring` | Deployed; post-release monitoring active |
| `stable` | Monitoring window closed cleanly |
| `rolled_back` | Deployment reversed; prior version restored |
| `failed` | Deployment could not complete |

**Invariants:**
- `deploying` is not reachable without a completed Release Readiness Checklist
- `deploying` is not reachable without a QA go recommendation
- `rolled_back` retains the Release record

---

### Repository Status

| Value | Description |
|---|---|
| `connecting` | Being onboarded; CTO and Tech Lead analyzing |
| `active` | Fully onboarded; all workflows available |
| `stale` | Not actively worked on |
| `errored` | Integration error; cannot synchronize |
| `archived` | Disconnected; history retained |

---

## Runtime Objects

---

### Company Runtime

**Purpose:** The live operational state of the Company — what is happening right now.

**Description:** The Company Runtime is the real-time snapshot of company activity. It tracks which Employees are active, what each Employee is currently doing, what workflow phases are in progress, and what Events are being generated. It is the data source for the Company Dashboard. Unlike the persistent domain objects, the Company Runtime represents ephemeral, present-tense state.

**Owner:** System

**Relationships:**
- Belongs to: one Company (one-to-one)
- References: active Tasks, active Reviews, active QA Results, active Releases, active Incidents
- References: Employee current activities
- Generated from: Event stream

**Required Fields:**
- id
- company_id
- active_employees (list of employee_id + current activity)
- active_work_items (list of work item type + id + status + employee)
- active_sop_phases (list of SOP + phase + work item)
- pending_approvals (list of Notification requiring CEO action)
- last_updated_at

**Invariants:**
- Exactly one Company Runtime per Company
- Company Runtime reflects the current state within an acceptable staleness window
- Company Runtime is never used as the source of truth for historical analysis — the Event log serves that purpose

---

## Cardinality Reference

| Relationship | Cardinality |
|---|---|
| User → Company | 1:1 (V1) |
| Company → Department | 1:N |
| Company → Company Settings | 1:1 |
| Company → Workspace | 1:1 (V1) |
| Company → Memory | 1:1 |
| Company → Knowledge | 1:1 |
| Company → Company Runtime | 1:1 |
| Department → Employee | 1:N |
| Employee → Role | N:1 |
| Employee → Employee Status | N:1 (status is a value, not an entity) |
| Workspace → Repository | 1:N (1:1 in V1) |
| Workspace → Sprint | 1:N |
| Workspace → Milestone | 1:N |
| Repository → Project | 1:N |
| Initiative → Goal | 1:N |
| Goal → Epic | 1:N |
| Epic → Feature | 1:N |
| Feature → Task | 1:N (via Project) |
| Task → Subtask | 1:N |
| Task → Task Status | N:1 |
| Project → Review | 1:N |
| Project → QA Result | 1:1 |
| Project → Release | N:1 (many Projects may ship in one Release) |
| Review → Review Status | N:1 |
| Release → Release Status | N:1 |
| Release → QA Result | 1:1 |
| Memory → Memory Record | 1:N |
| Knowledge → Knowledge Record | 1:N |
| Knowledge → Knowledge Source | 1:N |
| Decision → Decision Record | 1:1 |
| Conversation → Message | 1:N |
| Artifact → Attachment | 1:N |
| Event → Timeline Entry | N:1 (multiple Events can produce one entry) |
| Plan → Execution | 1:1 |
