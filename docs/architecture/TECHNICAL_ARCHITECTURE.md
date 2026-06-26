# Technical Architecture — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-26  

This document translates the organizational model of Engineering OS into a software architecture. It defines system boundaries, module responsibilities, data ownership, event contracts, and failure modes. It does not prescribe implementation choices — no frameworks, no databases, no programming languages. It defines what the system must do and where each concern lives.

All implementation decisions must align with this architecture. All future architecture proposals that contradict this document require CTO approval and a recorded Decision Record.

---

## Table of Contents

1. [System Principles](#1-system-principles)
2. [System Overview](#2-system-overview)
3. [System Boundaries](#3-system-boundaries)
4. [Core Modules](#4-core-modules)
   - [Identity & Access](#41-identity--access-boundary)
   - [Company](#42-company-boundary)
   - [Repository](#43-repository-boundary)
   - [Planning](#44-planning-boundary)
   - [Task](#45-task-boundary)
   - [Execution](#46-execution-boundary)
   - [Review](#47-review-boundary)
   - [QA](#48-qa-boundary)
   - [Release](#49-release-boundary)
   - [Memory](#410-memory-boundary)
   - [Knowledge](#411-knowledge-boundary)
   - [Employee](#412-employee-boundary)
   - [Dashboard](#413-dashboard-boundary)
   - [Notification](#414-notification-boundary)
   - [Chat](#415-chat-boundary)
   - [Timeline](#416-timeline-boundary)
   - [Security Boundary](#417-security-boundary)
   - [Integration](#418-integration-boundary)
5. [Event Architecture](#5-event-architecture)
6. [Data Ownership Rules](#6-data-ownership-rules)
7. [Runtime Boundaries](#7-runtime-boundaries)
8. [Cross-Module Communication](#8-cross-module-communication)
9. [Open Questions](#9-open-questions)

---

## 1. System Principles

**1.1 Modules own their data.**  
Each module is the authoritative source of truth for the objects it owns. Other modules consume data from owning modules; they do not duplicate or shadow it.

**1.2 Boundaries are enforced by contracts, not by convention.**  
Modules expose defined interfaces. No module accesses another module's internal data directly. All cross-module communication goes through defined contracts.

**1.3 Events carry intent, not state.**  
Events describe what happened and why. They are not state synchronization messages. Consumers derive their own state from events, not from polling another module's state.

**1.4 The CEO never sees the system boundary.**  
All system complexity — module communication, event routing, state management, retry logic — is invisible to the CEO. The product presents a unified organizational experience.

**1.5 Autonomy levels are enforced at the boundary, not inside modules.**  
When a module is about to perform an action that requires CEO approval at the current autonomy level, it emits an approval request and pauses. It does not proceed. Approval gates live at module boundaries.

**1.6 Every significant state change is an Event.**  
The Event log is the source of truth for "what happened." Modules may hold derived state, but the Event log can always reconstruct the authoritative history.

**1.7 Failure is first-class.**  
Every module defines its failure modes and specifies what happens when it fails. Silent failures that corrupt state are not acceptable.

**1.8 Memory is a service, not a side effect.**  
Memory updates are explicit module operations, not background cleanup. Every workflow phase that produces memory records does so through a defined write contract to the Memory module.

---

## 2. System Overview

Engineering OS is organized into 18 core modules. Each module owns a bounded set of domain objects and exposes a defined public interface.

```
┌─────────────────────────────────────────────────────┐
│                    CEO Interface                    │
│         (Dashboard, Chat, Inbox, Work, Memory)      │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│                  Company Module                     │
│    (Company, Department, Employee, Settings)        │
└──┬────────┬───────┬────────┬────────┬───────────────┘
   │        │       │        │        │
   ▼        ▼       ▼        ▼        ▼
Planning  Task   Execution  Review  Release
Module    Module  Module    Module  Module
   │        │       │        │        │
   └────────┴───────┴────────┴────────┘
                    │
          ┌─────────▼──────────┐
          │   Memory Module    │
          │  Knowledge Module  │
          │  Timeline Module   │
          └────────────────────┘
```

All modules publish to and consume from a shared Event stream. The Event stream is the integration mechanism. No module calls another module's internal implementation.

---

## 3. System Boundaries

The following boundaries separate concerns within Engineering OS from the outside world:

**External boundary: CEO**  
The only human who interacts with the system. Communicates goals in natural language. Receives outcomes in plain language. Never interacts with internal module state.

**External boundary: Repository hosting**  
The system reads from and writes to external repository hosting (version control). The Repository module owns this integration.

**External boundary: Deployment platform**  
The system coordinates deployments through external deployment infrastructure. The Release module owns this integration.

**External boundary: Monitoring infrastructure**  
The system reads signals from external monitoring tools. The Dashboard module aggregates these signals; the Integration module manages the connections.

**Internal boundary: Company namespace**  
Every object, event, and operation is scoped to a Company. No cross-company data access is possible at any module boundary. The Company module enforces this invariant.

---

## 4. Core Modules

---

### 4.1 Identity & Access Boundary

**Purpose:**  
Authenticate users, authorize access, and maintain session state. This module has no domain knowledge of Engineering OS concepts — it knows only Users, Sessions, and Permissions.

**Responsibilities:**
- Authenticate the User via standard credential mechanisms
- Establish and expire Sessions
- Enforce Permission boundaries — what a User may view and what they may act on
- In V1, the User has full permissions within their Company

**Owned Objects:**
- User
- Session
- Permission

**Consumed Objects:**
- Company (to verify Company membership after authentication)

**Produced Objects:**
- Authenticated session token
- Permission grant records

**Dependencies:**
- No internal module dependencies; this is the first module in any request path

**Events Published:**
- `user.registered` — a new User account was created
- `session.started` — a User session began
- `session.expired` — a User session expired
- `user.deleted` — a User account was deleted

**Public Interface (conceptual):**
- Authenticate a credential and return a session
- Validate a session token
- Check whether a session is authorized for a given action
- Create and delete Users

**Failure Scenarios:**
- Credential validation service unavailable: surface authentication error; do not degrade silently
- Session store unavailable: invalidate active sessions and require re-authentication
- Permission store corruption: deny access until repaired; do not grant unverified permissions

**Open Questions:**
- What is the MFA strategy for V1?
- How are email verification and password reset flows coordinated with the Company module?

---

### 4.2 Company Boundary

**Purpose:**  
Own the top-level organizational entity and enforce all company-level invariants. This module is the namespace for everything else.

**Responsibilities:**
- Create and manage Company records
- Enforce the invariant that every Company has exactly one User owner
- Provision default Departments, Employees, Company Settings, Workspace, Memory, and Knowledge at Company creation
- Propagate autonomy level and culture profile settings to all dependent modules
- Enforce that autonomy level changes take effect at workflow phase boundaries, not mid-phase

**Owned Objects:**
- Company
- Department
- Company Settings
- Organization Settings

**Consumed Objects:**
- User (to verify ownership)
- Workspace (delegate to Workspace sub-module)

**Produced Objects:**
- Initialized Company with full default roster
- Company-scoped namespace for all other modules

**Dependencies:**
- Identity & Access (to verify User before Company creation)
- Employee module (to provision default roster)
- Memory module (to initialize Memory)
- Knowledge module (to initialize Knowledge)
- Planning module (to initialize Workspace)

**Events Published:**
- `company.created` — triggers default provisioning across all modules
- `company.settings_changed` — propagates autonomy or culture changes
- `company.archived` — triggers archival of all owned objects
- `company.deleted` — triggers permanent deletion sequence

**Public Interface (conceptual):**
- Create Company for a given User
- Read Company by ID
- Update Company Settings
- Read current autonomy level and culture profile (consumed by every other module)
- Archive / delete Company

**Failure Scenarios:**
- Company creation fails mid-provisioning: the entire creation must roll back; a partial Company is worse than no Company
- Settings propagation fails: queue the propagation; never silently allow stale settings to remain active

**Open Questions:**
- How are default employees parameterized? Are they seeded from a system-level role registry?
- What is the recovery path if Company creation partially succeeds?

---

### 4.3 Repository Boundary

**Purpose:**  
Own the connection between Engineering OS and external codebases. Manage repository onboarding, analysis, and ongoing synchronization.

**Responsibilities:**
- Connect a Repository by accepting an external URL and credentials
- Orchestrate the repository analysis workflow: CTO and Tech Lead analyze the repository and produce the initial Repository Memory
- Maintain Repository Status across its lifecycle (Connecting → Active → Stale → Archived)
- Synchronize repository state changes (new commits, branch changes) as needed for active work
- Manage credentials securely — credentials are never stored in plaintext

**Owned Objects:**
- Repository
- Repository Status
- Integration (version control type)

**Consumed Objects:**
- Workspace (to associate the Repository with the company's Workspace)
- Memory (to write Repository Memory records during and after analysis)

**Produced Objects:**
- Repository Memory records (architecture, structure, dependencies, patterns, technical debt)
- Architecture summary (a Document) for CEO review

**Dependencies:**
- Company module (for company namespace and settings)
- Memory module (to write Repository Memory)
- Employee module (to invoke CTO and Tech Lead for analysis)
- Knowledge module (to initialize Knowledge Sources from the repository)

**Events Published:**
- `repository.connected` — a Repository was connected and credentials validated
- `repository.analysis_started` — CTO and Tech Lead have begun analysis
- `repository.analysis_complete` — initial Repository Memory is ready for CEO review
- `repository.activated` — CEO confirmed the architecture summary; Repository is Active
- `repository.errored` — integration error detected; synchronization cannot proceed

**Public Interface (conceptual):**
- Connect a Repository (accept URL, credentials, Workspace)
- Read Repository state and current memory summary
- Trigger re-analysis of a connected Repository
- Update Repository Status
- Disconnect / archive a Repository

**Failure Scenarios:**
- External repository unavailable during connection: surface error; do not create a partial Repository record
- Analysis exceeds acceptable time window: surface status to CEO; do not silently stall
- Credentials become invalid post-connection: alert CTO via Notification; pause dependent workflows

**Open Questions:**
- How does the Repository module handle monorepos with multiple services?
- What is the re-analysis trigger strategy (time-based, commit count, or on-demand)?

---

### 4.4 Planning Boundary

**Purpose:**  
Own the full planning hierarchy from Initiative to Sprint. Translate CEO goals and approved Features into structured, executable work.

**Responsibilities:**
- Manage the Initiative → Goal → Epic → Feature hierarchy
- Produce and manage Feature Briefs (via the Product Manager employee)
- Manage Sprints and Milestones within the Workspace
- Enforce the invariant that a Feature Brief must be approved before a Feature enters development
- Route Feature Briefs through the CTO feasibility review and CEO approval (where required)
- Create Plans for each body of work before execution begins

**Owned Objects:**
- Initiative
- Goal
- Epic
- Feature
- Sprint
- Milestone
- Plan

**Consumed Objects:**
- Company Settings (for autonomy level and approval gates)
- Employee (to assign Product Manager, CTO, and Tech Lead roles to planning activities)
- Repository (to verify that planned work is scoped to the connected Repository)

**Produced Objects:**
- Approved Feature Briefs (Documents)
- Sprint plans (task lists by sprint, once Planning → Execution handoff occurs)
- Milestone status updates

**Dependencies:**
- Company module (namespace)
- Employee module (to invoke planning employees)
- Task module (to receive decomposed tasks after planning completes)
- Notification module (to surface approval requests to CEO)

**Events Published:**
- `initiative.approved` — CEO approved a new Initiative
- `goal.created` — a Goal was defined under an Initiative
- `feature_brief.drafted` — Product Manager has drafted a Feature Brief
- `feature_brief.approved` — CTO (or CEO) approved the Feature Brief; triggers Gate 1
- `sprint.started` — a Sprint has begun
- `milestone.achieved` — a Milestone has been reached

**Public Interface (conceptual):**
- Create / update Initiative, Goal, Epic, Feature
- Submit Feature Brief for approval
- Read approved Feature Briefs (consumed by Task module to begin decomposition)
- Create / read Sprint and Milestone
- Record Plan

**Failure Scenarios:**
- Feature Brief approval stalls (no CTO response within expected window): surface to CEO as a blocked state notification
- Sprint scope changes after sprint start: require CTO approval; do not allow silent scope changes

**Open Questions:**
- How does the system handle Features that span multiple sprints?
- What is the product experience for a CEO who wants to re-prioritize mid-sprint?

---

### 4.5 Task Boundary

**Purpose:**  
Own the atomic unit of engineering work. Manage task decomposition, assignment, status, and completion.

**Responsibilities:**
- Receive decomposed task lists from the Tech Lead (via the Execution module's SOP engine)
- Assign tasks to engineers as directed by the Tech Lead
- Track Task Status through its full lifecycle
- Enforce the invariant that tasks are one working day or less; reject tasks that violate this
- Track Subtasks within parent Tasks
- Surface blocked tasks to the Tech Lead for resolution
- Record Definition of Done satisfaction before marking tasks Done

**Owned Objects:**
- Task
- Subtask
- Task Status

**Consumed Objects:**
- Feature Brief (to validate that tasks map to acceptance criteria)
- Employee (to verify engineer assignment is valid)
- Sprint (to scope tasks to an active Sprint)

**Produced Objects:**
- Task completion events (consumed by Review module)
- Blocked task notifications (consumed by Notification module)

**Dependencies:**
- Planning module (receives Feature Brief after approval)
- Employee module (for assignment)
- Review module (to hand off completed tasks)
- Notification module (for blocked task alerts)

**Events Published:**
- `task.created` — a new Task was created
- `task.assigned` — a Task was assigned to an engineer
- `task.started` — an engineer began work on a Task
- `task.blocked` — a Task is blocked; blocker recorded
- `task.completed` — all Subtasks done; Definition of Done satisfied
- `task.submitted_for_review` — Task is ready for code review

**Public Interface (conceptual):**
- Create tasks (for Tech Lead only; engineers do not create their own tasks)
- Assign task to employee
- Update task status
- Record Definition of Done satisfaction
- Read task list for a Sprint or Project

**Failure Scenarios:**
- Engineer unavailable when task is assigned: surface to Tech Lead; do not allow tasks to be silently unassigned
- Task estimate exceeded without completion: alert Tech Lead; do not allow silent overruns

**Open Questions:**
- How does the system handle tasks that require coordination between two engineers simultaneously?
- What is the recovery path if an engineer becomes unavailable mid-task?

---

### 4.6 Execution Boundary

**Purpose:**  
Own the SOP engine — the mechanism that drives work through its defined phases and enforces gates between phases.

**Responsibilities:**
- Maintain the active state of every running SOP instance
- Advance work through SOP phases when gate conditions are satisfied
- Block advancement when gate conditions are not satisfied
- Surface gate failures and blockers to the appropriate employee
- Enforce autonomy level at each gate: pause for approval where required
- Record Execution records that capture what actually happened during each SOP run
- Coordinate parallel work (e.g., documentation drafted in parallel with implementation)

**Owned Objects:**
- Execution (the runtime record of a Plan in action)

**Consumed Objects:**
- Plan (to know what SOP is being executed and what its phases are)
- Company Settings (for current autonomy level)
- Employee (to know which employees participate in each phase)

**Produced Objects:**
- Execution records
- Phase transition events
- Approval request notifications (when autonomy level requires CEO input)

**Dependencies:**
- Planning module (receives approved Plans)
- Task module (coordinates task assignment and completion)
- Review module (coordinates review phase)
- QA module (coordinates QA phase)
- Release module (coordinates release phase)
- Notification module (for approval gates)
- Memory module (to trigger memory updates at Execution completion)

**Events Published:**
- `sop.phase_started` — an SOP phase began
- `sop.phase_completed` — an SOP phase completed; gate satisfied
- `sop.gate_blocked` — a gate condition is not satisfied; work is paused
- `sop.approval_requested` — an approval gate requires CEO input
- `sop.execution_completed` — all SOP phases completed; work is done
- `sop.execution_failed` — a phase failed irrecoverably; work is halted

**Public Interface (conceptual):**
- Start a SOP execution for a given Plan
- Record gate completion for a given phase
- Handle CEO approval or rejection of an approval gate
- Cancel a SOP execution
- Read current SOP state for a given work item

**Failure Scenarios:**
- Gate condition never becomes satisfied (infinite stall): surface to CTO after a defined wait; do not let work stall silently
- Execution state becomes inconsistent with underlying work items: re-derive from Event log; never patch state directly
- CEO approval request goes unanswered: surface as a persistent Notification; allow the CEO to snooze but not dismiss until actioned

**Open Questions:**
- How does the Execution module handle SOPs that are updated after an execution is in progress?
- What is the retry behavior for failed phases?

---

### 4.7 Review Boundary

**Purpose:**  
Own the code review process. Manage review assignment, findings, and approval.

**Responsibilities:**
- Receive review requests from the Execution module when a Task completes
- Assign the Reviewer employee to the review
- Classify findings as Blocking / Non-blocking / Question
- Track Security Engineer involvement when security-relevant patterns are present
- Enforce the invariant that approval is not possible while Blocking findings are open
- Enforce the invariant that approval is not possible while a Security Engineer block is active
- Produce the final approval or escalation decision

**Owned Objects:**
- Review
- Review Status

**Consumed Objects:**
- Task (the work being reviewed)
- Employee (to assign Reviewer and Security Engineer)
- Company Settings (to check if security review is required by default)

**Produced Objects:**
- Review findings (Comments)
- Security review records (when applicable)
- Approved code signal (consumed by QA module and Execution module)

**Dependencies:**
- Task module (receives completed tasks)
- Employee module (for Reviewer and Security Engineer)
- QA module (signals QA to begin after review approval)
- Notification module (for security holds and escalation)

**Events Published:**
- `review.assigned` — a Review was routed to a Reviewer
- `review.started` — Reviewer began examining the work
- `review.changes_requested` — Blocking findings were recorded
- `review.security_requested` — Security Engineer review is required
- `review.approved` — all Blocking findings resolved; no active security block
- `review.escalated` — decision beyond Reviewer authority; routed to Tech Lead

**Public Interface (conceptual):**
- Create a Review for a given Task or Project
- Record findings with classification
- Request Security Engineer involvement
- Approve or request changes
- Escalate to Tech Lead

**Failure Scenarios:**
- Reviewer unavailable: surface to Tech Lead; do not allow reviews to be silently unassigned
- Security Engineer review not completed within expected window: alert CTO; do not allow approval to proceed

**Open Questions:**
- How does the Review module handle reviews for infrastructure changes vs. application code?
- What is the escalation path when the Reviewer and Security Engineer disagree?

---

### 4.8 QA Boundary

**Purpose:**  
Own the QA validation process. Manage test plans, defect tracking, and the go/no-go recommendation.

**Responsibilities:**
- Receive QA requests from the Execution module after code review approval
- Assign the QA Engineer to create and execute a Test Plan
- Track defect reports and their resolution
- Issue the go/no-go recommendation as a formal, permanent record
- Enforce the invariant that a No-Go recommendation stops the release
- Record CTO-authorized overrides when they occur

**Owned Objects:**
- QA Result
- Test Plan (a Document, owned via Document module)
- Defect Reports (Artifacts)

**Consumed Objects:**
- Feature Brief acceptance criteria (to validate Test Plan coverage)
- Review approval record (to confirm review completed before QA begins)
- Employee (to assign QA Engineer)

**Produced Objects:**
- Go/No-Go recommendation (written, permanent)
- Defect reports
- QA summary (consumed by Release module)

**Dependencies:**
- Review module (to confirm review is approved before QA begins)
- Execution module (receives QA request, returns go/no-go)
- Release module (QA recommendation gates release)
- Notification module (for No-Go alerts to CTO)

**Events Published:**
- `qa.test_plan_created` — QA Engineer has drafted the Test Plan
- `qa.validation_started` — QA Engineer began executing the Test Plan
- `qa.defect_reported` — a defect was found and classified
- `qa.defect_resolved` — a previously reported defect was confirmed fixed
- `qa.go_recommendation` — QA Engineer issued a Go recommendation; release may proceed
- `qa.no_go_recommendation` — QA Engineer issued a No-Go; release is blocked
- `qa.no_go_overridden` — CTO authorized override of a No-Go; override is on record

**Public Interface (conceptual):**
- Create Test Plan for a given Feature or Project
- Record defect (with severity classification)
- Confirm defect resolution
- Issue go/no-go recommendation
- Record CTO override (with rationale)

**Failure Scenarios:**
- QA Engineer issues a Go without a complete Test Plan on record: this is a system invariant violation; the QA module must not permit it
- Defects are resolved but QA Engineer cannot re-validate within the release window: surface to Release Manager and CTO; do not silently defer

**Open Questions:**
- How does the QA module coordinate staging environment availability with the Execution module?
- What is the minimum acceptable Test Plan for a bug fix vs. a new feature?

---

### 4.9 Release Boundary

**Purpose:**  
Own the deployment and release process. Coordinate all pre-release requirements and own the production deployment record.

**Responsibilities:**
- Receive release authorization from the Execution module after all gates are satisfied
- Assemble the Release Readiness Checklist and enforce completion before deployment
- Coordinate with DevOps Engineer for production deployment execution
- Coordinate with Monitoring Engineer for the post-release monitoring window
- Own the Release record as the authoritative record of what shipped
- Authorize rollback when post-release signals require it
- Coordinate changelog and release note publication

**Owned Objects:**
- Release
- Release Status

**Consumed Objects:**
- QA Result (go recommendation required before release)
- Feature Brief and Feature records (to identify what is being released)
- Employee (to assign Release Manager, DevOps, Monitoring Engineer)
- Document (changelog, release notes — produced by Technical Writer)

**Produced Objects:**
- Release record
- Rollback record (if applicable)
- Post-release monitoring summary

**Dependencies:**
- QA module (go recommendation required)
- Execution module (receives release authorization signal)
- Integration module (for deployment platform interaction)
- Monitoring module / Dashboard module (for post-release signal monitoring)
- Memory module (to record the Release in company history)
- Notification module (to notify CEO of release status)

**Events Published:**
- `release.planned` — Release record created; checklist being assembled
- `release.ready` — Checklist complete; awaiting deployment window
- `release.deploying` — Deployment to production begun
- `release.monitoring` — Deployment complete; monitoring window active
- `release.stable` — Monitoring window closed cleanly
- `release.rolled_back` — Deployment reversed; prior version restored
- `release.failed` — Deployment could not complete

**Public Interface (conceptual):**
- Create Release for one or more Features
- Update Release Readiness Checklist items
- Issue go/no-go decision for deployment
- Authorize rollback
- Close Release record
- Read Release record and its associated checklist

**Failure Scenarios:**
- Deployment fails mid-deployment: immediately evaluate rollback criteria; notify Release Manager and CTO; do not leave the system in an indeterminate state
- Monitoring window detects anomaly: alert Monitoring Engineer and Release Manager; escalate to CTO if severity warrants

**Open Questions:**
- How does the Release module handle multiple Features in a single release?
- What is the atomic unit of rollback — a full release or individual feature?

---

### 4.10 Memory Boundary

**Purpose:**  
Own the company's persistent organizational knowledge — memory records across all scopes and layers.

**Responsibilities:**
- Accept memory writes from every other module after significant events
- Organize Memory Records by type and scope
- Enforce that Memory Records are never deleted — only deprecated or superseded
- Expire Conversation-scope records after session close
- Serve memory records to the Employee module for decision-making context
- Allow the CEO to browse, search, and annotate memory records
- Maintain the version chain for superseded records

**Owned Objects:**
- Memory (company-level container)
- Memory Record

**Consumed Objects:**
- Events from all modules (to know when to create memory records)
- Employee output (the content of memory records)

**Produced Objects:**
- Memory Records (available to all employees as decision context)
- Memory search results

**Dependencies:**
- All modules publish events that trigger memory writes
- Employee module reads Memory Records as decision context
- Execution module triggers memory updates at Phase 8 of the New Feature SOP

**Events Published:**
- `memory.record_created` — a new Memory Record was written
- `memory.record_deprecated` — a Memory Record was superseded
- `memory.record_annotated` — the CEO annotated a Memory Record

**Public Interface (conceptual):**
- Write a Memory Record (accepting type, scope, content, source work item)
- Read Memory Records by type, scope, or relevance query
- Deprecate / supersede a Memory Record
- Annotate a Memory Record (CEO only)
- Search Memory Records

**Failure Scenarios:**
- Memory write fails after a successful Execution: the system must retry; a completed execution without memory records violates the Definition of Done
- Conflicting memory records exist: surface conflict to the CTO via Notification; do not silently allow contradictions

**Open Questions:**
- How does the memory module resolve conflicting records when two employees have written contradictory facts?
- What is the staleness detection strategy for repository-scope memory?

---

### 4.11 Knowledge Boundary

**Purpose:**  
Own the curated, authoritative tier of company knowledge. Distinguish from Memory by quality — Knowledge records are authored and reviewed, not auto-generated.

**Responsibilities:**
- Manage Knowledge Records through their authoring, review, and publication lifecycle
- Enforce that Knowledge Records are approved before publication
- Maintain Knowledge Sources and their synchronization state
- Never delete a published Knowledge Record — archive with successor pointer
- Serve Knowledge Records to Employees as reference material

**Owned Objects:**
- Knowledge (company-level container)
- Knowledge Record
- Knowledge Source

**Consumed Objects:**
- Memory Records (may be promoted to Knowledge Records by the Technical Writer)
- Repository analysis outputs (as Knowledge Sources)
- Employee outputs (Technical Writer authors Knowledge Records)

**Produced Objects:**
- Published Knowledge Records (authoritative reference material for all employees)

**Dependencies:**
- Memory module (Memory Records as raw inputs to Knowledge curation)
- Employee module (Technical Writer authors; CTO or Tech Lead approves)
- Repository module (analysis results as Knowledge Sources)

**Events Published:**
- `knowledge.record_drafted` — Technical Writer submitted a Knowledge Record for review
- `knowledge.record_published` — Knowledge Record approved and published
- `knowledge.record_deprecated` — Knowledge Record superseded by a successor

**Public Interface (conceptual):**
- Create / update Knowledge Record (Technical Writer only)
- Submit Knowledge Record for approval
- Approve / reject Knowledge Record (CTO or Tech Lead only)
- Publish approved Knowledge Record
- Read Knowledge Records by type or search query
- Register Knowledge Source

**Failure Scenarios:**
- Knowledge Record approved but never published: surface to Technical Writer as an incomplete item
- Knowledge Source becomes unavailable: mark as stale; alert CTO; do not silently serve outdated knowledge

**Open Questions:**
- How does the Knowledge module handle Knowledge Records that conflict with active Memory Records?

---

### 4.12 Employee Boundary

**Purpose:**  
Own the definition, state, and decision-making context of every employee within the company. This is the organizational intelligence layer of Engineering OS.

**Responsibilities:**
- Maintain the Employee roster for each Company
- Enforce employee specialization — each employee only acts within their defined domain
- Provide employees with appropriate memory and knowledge context when they perform work
- Track Employee Status and current assignment
- Record performance metrics after each significant work contribution
- Enforce escalation paths when an employee's authority is exceeded
- Provide the structured communication format for all employee outputs

**Owned Objects:**
- Employee
- Employee Status
- Role

**Consumed Objects:**
- Memory Records (as decision context for all employees)
- Knowledge Records (as reference material for all employees)
- Company Settings (autonomy level and culture profile shape employee behavior)
- Task, Review, QA Result, Release (as the work items employees participate in)

**Produced Objects:**
- Employee outputs (plans, reviews, recommendations, memory contributions, documents)
- Structured communications following the Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action format
- Decision Records (when a significant decision is made)
- Performance updates

**Dependencies:**
- Memory module (reads memory for decision context; writes memory after significant contributions)
- Knowledge module (reads knowledge as reference material)
- Company module (for autonomy level and culture configuration)
- All workflow modules (participates in all workflow phases)

**Events Published:**
- `employee.assigned_task` — an employee was assigned work
- `employee.work_completed` — an employee completed their contribution to a work item
- `employee.escalated` — an employee escalated a decision beyond their authority
- `employee.memory_written` — an employee contributed a Memory Record

**Public Interface (conceptual):**
- Read Employee profile and current state
- Assign work to an employee
- Receive employee output (plan, review, recommendation, etc.)
- Update Employee Status
- Read employee performance metrics

**Failure Scenarios:**
- Employee produces output that violates their domain boundary: the system must reject the output and surface it as an error; it does not silently accept out-of-scope contributions
- All employees in a required role are unavailable: surface to CTO; do not allow workflows to proceed with missing participants

**Open Questions:**
- How is the employee's decision-making context assembled for a given work item?
- What is the memory retrieval strategy — all relevant records, or ranked by recency and relevance?

---

### 4.13 Dashboard Boundary

**Purpose:**  
Own the live view of company state. Aggregate the Company Runtime into a coherent CEO-facing summary.

**Responsibilities:**
- Maintain the Company Runtime record — the real-time snapshot of all active work
- Aggregate active tasks, active employees, active SOP phases, and pending approvals into a unified view
- Surface company health indicators (from Memory, QA, Release, and Incident data)
- Generate the "morning summary" experience when the CEO opens the product
- Never expose raw system state — all data is translated into organizational language before display

**Owned Objects:**
- Company Runtime

**Consumed Objects:**
- Events from all modules (to keep Company Runtime current)
- Employee Status (for active employee activity)
- Task Status, Review Status, QA Result, Release Status (for work summary)
- Notification (for pending approval queue)

**Produced Objects:**
- Company Runtime snapshot (consumed by the CEO interface)
- Company health aggregate

**Dependencies:**
- All modules (reads from the Event stream)
- Notification module (for pending approvals)

**Events Published:**
- `dashboard.snapshot_updated` — Company Runtime was refreshed

**Public Interface (conceptual):**
- Read Company Runtime (current active state)
- Read company health aggregate
- Read pending approvals (summary)

**Failure Scenarios:**
- Company Runtime becomes stale due to Event stream lag: surface a staleness indicator; do not display stale data as current
- Company Runtime inconsistency with underlying object states: re-derive from Event log; never patch Company Runtime directly

---

### 4.14 Notification Boundary

**Purpose:**  
Own the CEO's decision queue. Filter, prioritize, and deliver only meaningful events to the CEO.

**Responsibilities:**
- Subscribe to events from all modules
- Apply filtering rules: only events that genuinely require CEO attention generate Notifications
- Prioritize notifications by type and urgency
- Deliver notifications through the CEO's active session
- Enforce that Critical notifications cannot be dismissed without action
- Record CEO actions (approve / reject / dismiss) permanently

**Owned Objects:**
- Notification

**Consumed Objects:**
- Events from all modules (source of all potential notifications)
- Company Settings (notification preferences)

**Produced Objects:**
- CEO Notifications
- CEO action records (approve / reject / dismiss logged against the Notification)

**Dependencies:**
- All modules (event subscriptions)
- Execution module (for approval gate notifications)
- Incident management (for P0/P1 alerts)

**Events Published:**
- `notification.created` — a new Notification was generated for the CEO
- `notification.actioned` — the CEO acted on a Notification (approved / rejected / dismissed)

**Public Interface (conceptual):**
- Read current Notifications for a given User (prioritized)
- Mark Notification as read
- Record action on Notification
- Dismiss Notification (for non-critical types)

**Failure Scenarios:**
- Critical notification delivery fails: retry until delivered; surface failure to CTO; do not allow P0 incidents to go unnotified
- Notification volume spike (e.g., many events simultaneously): batch and summarize; never flood the CEO with individual notifications

**Open Questions:**
- What is the notification delivery channel for V1 (in-product only, or email / push)?

---

### 4.15 Chat Boundary

**Purpose:**  
Own the CEO's natural language conversation interface with the company.

**Responsibilities:**
- Accept CEO goal inputs in natural language
- Route CEO goals to the appropriate employee (Product Manager for new features, CTO for technical direction, etc.)
- Surface employee responses in plain, organizational language
- Manage Conversation and Message records
- Distinguish between CEO-to-company conversations and internal employee coordination
- Maintain Conversation history for CEO browsing

**Owned Objects:**
- Conversation
- Message

**Consumed Objects:**
- Employee outputs (translated from structured format to conversational language for the CEO)
- Notification (approval request conversations are routed through Chat)

**Produced Objects:**
- Conversation records
- Goal inputs (consumed by Planning module to initiate Feature Briefs)
- Approval decisions (consumed by Execution module)

**Dependencies:**
- Employee module (routes input to appropriate employee)
- Planning module (translates goals into Feature Briefs)
- Execution module (receives approval decisions)
- Notification module (surfaces approval requests as Conversations)

**Events Published:**
- `conversation.started` — a new Conversation was initiated
- `conversation.message_sent` — a Message was sent within a Conversation
- `conversation.goal_submitted` — CEO submitted a goal to the company

**Public Interface (conceptual):**
- Create a Conversation
- Send a Message within a Conversation
- Read Conversation history
- Route a CEO goal to the planning flow

**Failure Scenarios:**
- CEO goal is ambiguous and cannot be routed to a planning employee: surface a clarification request; do not guess

---

### 4.16 Timeline Boundary

**Purpose:**  
Own the company's historical record — the user-facing narrative of what has happened.

**Responsibilities:**
- Subscribe to significant events across all modules
- Translate Events into human-readable Timeline Entries
- Maintain chronological order
- Support filtering by entry type, date range, and participant

**Owned Objects:**
- Timeline Entry

**Consumed Objects:**
- Events from all modules (selectively — not every event becomes a Timeline Entry)

**Produced Objects:**
- Timeline Entries (consumed by the Work section of the CEO interface)

**Dependencies:**
- All modules (Event subscriptions)

**Events Published:**
- `timeline.entry_created` — a new Timeline Entry was recorded

**Public Interface (conceptual):**
- Read Timeline Entries (with filter support)
- Read Timeline Entry detail (linked to originating work items)

**Failure Scenarios:**
- Timeline Entry creation fails for a significant event: retry from the Event log; the Timeline must not have gaps for significant events

---

### 4.17 Security Boundary

**Purpose:**  
Define the security perimeter of the system — not a module that owns domain objects, but a cross-cutting concern applied at every module boundary.

**Responsibilities:**
- Enforce that no User can access another User's Company data
- Enforce that credentials and secrets are never stored in plaintext anywhere in the system
- Enforce that all external communications use encrypted transport
- Enforce that Permission checks occur on every action, not only at the session level
- Enforce audit logging for every action taken by a User or Employee
- Surface security-sensitive events for the Security Engineer employee to review

**Cross-cutting Rules:**
- Every API endpoint that reads or writes a Company-scoped object must verify that the requesting Session belongs to the owning User
- Credentials (repository credentials, deployment credentials, API keys) are stored in an encrypted credential store, referenced by ID, never inline
- All inter-module communication is authenticated — modules do not trust unauthenticated calls from internal services
- The Event log is append-only and immutable; no Event may be modified or deleted

**Events Published:**
- `security.anomaly_detected` — an unexpected access pattern was detected
- `security.credential_rotated` — a credential was rotated

**Failure Scenarios:**
- Permission check service is unavailable: deny access; never default to open
- Credential store is unavailable: halt operations that require external credentials; surface alert to DevOps Engineer

---

### 4.18 Integration Boundary

**Purpose:**  
Own all connections between Engineering OS and external systems.

**Responsibilities:**
- Manage Integration records — their type, provider, credentials reference, and synchronization state
- Provide a consistent abstraction over external system APIs so that the rest of the system does not depend on specific provider implementations
- Alert the CTO when an Integration enters an error state
- Ensure credential references are valid; never surface raw credentials to calling modules

**Owned Objects:**
- Integration

**Consumed Objects:**
- Company (for namespace scoping)
- Security boundary (for credential storage requirements)

**Produced Objects:**
- Normalized external system responses (consumed by Repository, Release, and Dashboard modules)

**Dependencies:**
- All modules that interact with external systems (Repository, Release, Dashboard)

**Events Published:**
- `integration.connected` — an Integration was successfully established
- `integration.errored` — an Integration encountered an error; synchronization paused
- `integration.restored` — a previously errored Integration resumed normal operation

**Public Interface (conceptual):**
- Register a new Integration
- Read Integration status
- Execute an operation against an external system (via the Integration abstraction)
- Deactivate an Integration

**Failure Scenarios:**
- External provider API unavailable: queue the operation; surface timeout to calling module; do not fail silently
- Integration credentials expire: alert CTO; pause all dependent operations; do not retry with invalid credentials

---

## 5. Event Architecture

The Event stream is the central integration mechanism. All significant state changes produce Events. All cross-module dependencies are expressed as Event subscriptions, not direct calls.

### Event Structure

Every Event contains:
- `id` — unique event identifier
- `company_id` — the Company this event belongs to
- `type` — the event type identifier (e.g., `feature_brief.approved`)
- `actor_type` — who caused this event (`employee`, `user`, `system`)
- `actor_id` — the specific actor
- `subject_type` — the object whose state changed
- `subject_id` — the specific object
- `payload` — the state change details
- `created_at` — when the event occurred

### Event Guarantees

- Events are immutable — once written, never modified
- Events are ordered within a Company — no event ordering ambiguity within a Company's namespace
- All modules receive events they subscribe to — delivery is guaranteed; duplication is handled by idempotent consumers

### Event Categories

| Category | Prefix | Description |
|---|---|---|
| Lifecycle | `<object>.created`, `<object>.deleted` | Object creation and removal |
| State Change | `<object>.status_changed` | Status transitions |
| Gate | `sop.gate_*` | SOP phase gates |
| Approval | `sop.approval_*` | CEO approval events |
| Memory | `memory.*` | Memory system events |
| Integration | `integration.*` | External system events |
| Security | `security.*` | Security-relevant events |

---

## 6. Data Ownership Rules

Every object is owned by exactly one module. Only the owning module may write to that object. Other modules read via the owning module's public interface.

| Object | Owning Module |
|---|---|
| User, Session, Permission | Identity & Access |
| Company, Department, Company Settings | Company |
| Repository, Repository Status, Integration (VC) | Repository |
| Initiative, Goal, Epic, Feature, Sprint, Milestone, Plan | Planning |
| Task, Subtask, Task Status | Task |
| Execution | Execution |
| Review, Review Status | Review |
| QA Result | QA |
| Release, Release Status | Release |
| Memory, Memory Record | Memory |
| Knowledge, Knowledge Record, Knowledge Source | Knowledge |
| Employee, Employee Status, Role | Employee |
| Company Runtime | Dashboard |
| Notification | Notification |
| Conversation, Message | Chat |
| Timeline Entry | Timeline |
| Integration (all types) | Integration |
| Event | System (immutable log, no owning module may modify) |
| Artifact, Document, Report | The module whose workflow produces them |
| Decision, Decision Record | Employee (the decision maker) via Memory |
| Incident | Execution (incident tracking is a runtime concern) |
| Comment | The module that owns the subject object |

---

## 7. Runtime Boundaries

### Request Lifecycle

A CEO request enters the system through the Chat boundary. The Chat boundary routes it to the Employee boundary (Product Manager or CTO). The Employee boundary consults Memory and Knowledge, then produces a structured output. The Execution boundary begins the SOP. The system drives itself from that point until the next CEO interaction point.

```
CEO Input
↓
Chat Boundary (receives and routes)
↓
Employee Boundary (Product Manager receives goal)
↓
Planning Boundary (Feature Brief creation)
↓
Execution Boundary (SOP engine begins)
↓
[Task → Review → QA → Release phases via SOP gates]
↓
Notification Boundary (surfaces completion or approval needs)
↓
CEO Output
```

### Autonomy Level Enforcement

At every SOP gate, the Execution boundary checks the current autonomy level from Company Settings:

| Level | Gate Behavior |
|---|---|
| Manual | Every gate requires CEO approval |
| Assist | Implementation gate requires CEO approval; QA and Release do not |
| Delegate | Release gate requires CEO approval; implementation and QA do not |
| Autonomous | No gates require CEO approval; CEO receives completion notification |

Changes to autonomy level take effect at the next gate boundary, never mid-phase.

---

## 8. Cross-Module Communication

### Direct vs. Event-Based

Modules communicate in two ways:

**Synchronous (direct call):** Used only when a module needs an immediate response to continue processing — e.g., identity validation, permission check, reading a Feature Brief before decomposing tasks.

**Asynchronous (event-based):** Used when a module needs to inform other modules of a state change without requiring immediate response — e.g., `feature_brief.approved` triggering the Execution module to begin the SOP.

The Event stream handles the majority of cross-module integration. Direct calls are minimized and only used where latency constraints demand it.

### Module Dependency Graph

```
Identity
↑ (all modules authenticate through Identity)

Company
↑ (all modules scope to Company)

Planning → Task → Execution → Review → QA → Release
                     ↓           ↓       ↓       ↓
                  Memory      Memory  Memory   Memory
                     ↓
                Knowledge

Employee → reads: Memory, Knowledge
        → participates in: Planning, Task, Execution, Review, QA, Release

Notification ← subscribes to: all modules
Timeline ← subscribes to: all modules
Dashboard ← subscribes to: all modules

Integration ← consumed by: Repository, Release, Dashboard
```

---

## 9. Open Questions

The following questions are unresolved at this architecture level and require answers before implementation of affected modules begins.

**OQ-ARCH-01:** What is the event ordering guarantee across Companies? Is the Event stream per-Company or shared?

**OQ-ARCH-02:** How is the Memory module's relevance ranking implemented? What signals determine which memory records are most relevant to a given work context?

**OQ-ARCH-03:** How are long-running SOP executions (multi-day features) persisted across system restarts? Is Execution state derived from the Event log, or maintained independently?

**OQ-ARCH-04:** What is the boundary between the Employee module's "decision-making" and the underlying AI execution layer? This is intentionally not specified in this document to avoid implementation coupling, but the boundary must be defined before implementation.

**OQ-ARCH-05:** How does the system handle concurrent Feature development? If two Features are in progress simultaneously, how does the Execution module track their independent SOP states without collision?

**OQ-ARCH-06:** What is the data retention policy for Conversation-scope Memory Records? They expire at session close — but what constitutes "session close" if the CEO is active for an extended period?

**OQ-ARCH-07:** How does the Integration module abstract over fundamentally different external systems (version control vs. deployment vs. monitoring)?

**OQ-ARCH-08:** What is the system's behavior when the CEO changes autonomy level while a SOP execution is in progress mid-phase?

---

## Relationship to Other Architecture Documents

- **DOMAIN_MODEL.md** defines the business objects this architecture organizes into modules.
- **INFORMATION_ARCHITECTURE.md** defines how the CEO navigates the product surfaces built on these modules.
- **COMPANY_RUNTIME.md** describes how these modules behave together to produce the runtime behavior of the company.
- **MVP_ROADMAP.md** defines which modules must be built in V1 and in what order.
