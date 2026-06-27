# Company Runtime — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-26  

This document defines how the virtual company behaves. It is the single most important behavioral specification in Engineering OS.

It bridges organizational documentation and product implementation. Every behavior described here follows directly from the Company Operating System, the Company Playbook, the Reporting Structure, the SOPs, and the Domain Model. This document does not invent behavior — it specifies how documented behaviors manifest when the company is running.

This document does not describe AI orchestration, prompts, or implementation technology. It describes company behavior.

---

## Table of Contents

1. [Runtime Purpose](#1-runtime-purpose)
2. [Runtime States](#2-runtime-states)
3. [State Transitions](#3-state-transitions)
4. [Request Intake](#4-request-intake)
5. [Context Gathering](#5-context-gathering)
6. [Repository Understanding](#6-repository-understanding)
7. [Planning](#7-planning)
8. [Clarification Questions](#8-clarification-questions)
9. [Goal Creation](#9-goal-creation)
10. [Task Creation](#10-task-creation)
11. [Employee Assignment](#11-employee-assignment)
12. [Employee Collaboration](#12-employee-collaboration)
13. [Knowledge Retrieval](#13-knowledge-retrieval)
14. [Memory Retrieval](#14-memory-retrieval)
15. [Decision Making](#15-decision-making)
16. [Conflict Resolution](#16-conflict-resolution)
17. [Escalation Rules](#17-escalation-rules)
18. [Approval Requests](#18-approval-requests)
19. [Review Cycle](#19-review-cycle)
20. [QA Cycle](#20-qa-cycle)
21. [Release Cycle](#21-release-cycle)
22. [Memory Updates](#22-memory-updates)
23. [Knowledge Updates](#23-knowledge-updates)
24. [Timeline Updates](#24-timeline-updates)
25. [Notification Rules](#25-notification-rules)
26. [Completion Criteria](#26-completion-criteria)
27. [Parallel Work](#27-parallel-work)
28. [Sequential Work](#28-sequential-work)
29. [Long-Running Work](#29-long-running-work)
30. [Blocked Work](#30-blocked-work)
31. [Recovery From Failure](#31-recovery-from-failure)
32. [Cancellation](#32-cancellation)
33. [Retry](#33-retry)
34. [Runtime Events](#34-runtime-events)
35. [CEO Interaction Points](#35-ceo-interaction-points)
36. [Event-Driven Employee Invocation](#36-event-driven-employee-invocation)
37. [Runtime Ownership Boundaries](#37-runtime-ownership-boundaries)

---

## 1. Runtime Purpose

The Company Runtime is the living operational state of the company. It answers: what is the company doing right now?

The runtime is not a log. The Event log records what has happened. The runtime records what is happening.

The runtime drives the Company Dashboard. It is the data source that makes Engineering OS feel like a living organization rather than a static tool.

The runtime has three responsibilities:

1. **Track active work** — every active Project, Task, Review, QA validation, and Release is tracked with its current owner, status, and SOP phase.
2. **Track active employees** — every employee's current activity, current assignment, and availability.
3. **Track pending CEO decisions** — every approval gate that is waiting on CEO input.

The Company Runtime drives this by reacting to events, not by maintaining persistent employee connections. When a task reaches a state where the next employee must act, the runtime emits an event. A dispatcher claims the event. AgentRunner assembles the employee's context and invokes them. The employee produces a structured output. The runtime persists that output and emits the next event. Employees are invoked — they do not listen.

When the CEO opens Engineering OS, the runtime tells them: this is your company, this is what it is doing, and this is what it needs from you.

---

## 2. Runtime States

The company is always in one of these states. A company may have multiple active work items simultaneously, each in its own runtime state. These states describe individual work items, not the company as a whole.

| State | Description |
|---|---|
| `idle` | No active work items. Company is available for new requests. |
| `intake` | A CEO request has been received. The company is routing and evaluating it. |
| `planning` | Product Manager and CTO are producing a Feature Brief. |
| `awaiting_approval` | A work item is paused pending CEO approval at an autonomy gate. |
| `executing` | Engineers are actively implementing assigned tasks. |
| `in_review` | Reviewer is examining the code. |
| `in_security_review` | Security Engineer review is in progress. |
| `in_qa` | QA Engineer is validating against acceptance criteria. |
| `releasing` | Release Manager is coordinating the production deployment. |
| `monitoring` | Deployment is complete. Monitoring Engineer is watching post-release signals. |
| `complete` | Memory updated. Feature shipped and documented. |
| `blocked` | Work cannot proceed. Blocker is recorded and routed. |
| `failed` | A phase could not complete. Recovery sequence initiated. |
| `cancelled` | Work was explicitly cancelled before completion. |

---

## 3. State Transitions

The following diagram shows the complete lifecycle of a work item through the company runtime.

```
idle
  ↓ (CEO submits goal)
intake
  ↓ (Product Manager routes goal; sufficient context)
planning
  ↓ (Feature Brief drafted)
awaiting_approval [Gate 1]
  ↓ (CEO or CTO approves Feature Brief)
executing
  ↓ (Tech Lead confirms Delivery Readiness)
in_review [Gate 3 → Gate 4]
  ↓ (Reviewer approves; no Blocking findings)
in_security_review [if triggered]
  ↓ (Security Engineer clears review)
in_qa [Gate 5]
  ↓ (QA Engineer issues Go recommendation)
releasing [Gates 6 → Gate 7]
  ↓ (Deployment successful)
monitoring
  ↓ (monitoring window closed cleanly)
complete [Gate 8]
```

Any state may transition to `blocked` when a blocker is identified. Any state may transition to `failed` when an unrecoverable error occurs. `failed` triggers the Recovery sequence. `cancelled` is terminal.

Transitions that cross autonomy gates pause at `awaiting_approval` until the CEO acts.

---

## 4. Request Intake

Request intake begins when the CEO communicates a goal to the company. It ends when the goal is routed to the correct employee and the company has sufficient context to proceed.

**How it works:**

The CEO states a goal in natural language through the conversation interface. No structure is required. The goal is received by the company's intake function, which performs the following:

1. **Classify the request type.** Is this a new feature, a bug fix, a question about existing work, a change to configuration, or something else? The classification determines which SOP and which first-receiver employee applies.

   | Request Type | First Receiver |
   |---|---|
   | New feature or product goal | Product Manager |
   | Bug fix or defect report | Tech Lead |
   | Architecture or technical question | CTO |
   | Security concern | Security Engineer |
   | Documentation request | Technical Writer |
   | Configuration change | CTO |
   | Performance or monitoring concern | Monitoring Engineer |
   | Status request | Company Runtime (Dashboard) |

2. **Check for ambiguity.** If the request cannot be classified with confidence, the company routes it to the CTO, who interprets it and asks the CEO a focused clarification question. The company never routes an ambiguous request and silently applies assumptions.

3. **Check for conflicts.** If the request contradicts existing memory or knowledge — e.g., the CEO asks for something the company has already identified as out of scope or technically infeasible — the company surfaces the conflict before planning begins.

4. **Confirm and proceed.** Once the request is classified and any blocking ambiguity is resolved, the company confirms the classification to the CEO in plain language and transitions to the planning state.

**Intake does not:**
- Begin implementation
- Create tasks
- Make architectural decisions
- Assume scope beyond what the CEO stated

---

## 5. Context Gathering

Once a request is classified, the company gathers the context needed to produce a good plan. Context gathering is internal — the CEO is not asked to supply context that the company should already know.

**Context sources:**

1. **Company Memory** — What does the company know about this topic already? Architecture decisions, previous implementations, business rules, coding standards. If the company has implemented authentication before, it does not re-derive how authentication works in this codebase.

2. **Repository Memory** — What does the company know about the codebase? Folder structure, frameworks, dependencies, existing patterns, technical debt areas. This is the company's onboarding knowledge applied to the current request.

3. **Feature Memory** — Has something similar been built before? If the CEO asks for dark mode and the company has previously implemented theme switching, that history is relevant.

4. **Decision Records** — Are there prior decisions that constrain or inform this request? A prior architectural decision to use a specific database type affects how a new feature is designed.

5. **Active Work** — Is there anything in progress that this request interacts with? Dependencies, conflicts, and opportunities for parallelism are identified here.

**Context gathering is silent.** The company assembles context internally. If context is missing and that absence would materially affect planning quality, the company asks one focused question rather than proceeding with incomplete information.

---

## 6. Repository Understanding

When a request involves changes to the connected repository, the company activates its repository understanding before planning begins.

Repository understanding encompasses:
- The folder structure and how it is organized
- The framework and architectural patterns in use
- The conventions for naming, testing, and documentation
- The known areas of technical debt
- The dependencies and their versions
- The deployment configuration

The Tech Lead owns repository understanding for execution decisions. The CTO owns repository understanding for architectural decisions.

If the repository has not been analyzed yet (new connection), or if the repository understanding is stale (significant time since last analysis), the CTO surfaces this to the CEO before planning proceeds. The company does not plan against a repository it does not understand.

**Repository understanding is referenced, not regenerated.** The company reads what it already knows about the repository from Repository Memory. It does not re-analyze the entire codebase for every request. Re-analysis is triggered by explicit events: initial connection, CEO request, or CTO determination that the memory is stale.

---

## 7. Planning

Planning begins after intake completes and context is gathered. Planning is owned by the Product Manager.

**Planning sequence:**

```
Product Manager receives classified request
  ↓
Product Manager drafts Feature Brief
  ↓
CTO reviews for technical feasibility
  ↓
CEO approves (if required by autonomy level or feature significance)
  ↓
Tech Lead receives approved Feature Brief
  ↓
Tech Lead performs technical planning:
  - Reviews Feature Brief
  - Identifies technical approach
  - Identifies required employees
  - Flags security review requirement if applicable
  - Flags monitoring requirements
  - Flags documentation requirements
  ↓
Tech Lead decomposes into tasks:
  - One task = one deliverable, one working day, one Definition of Done
  - All tasks map to Feature Brief acceptance criteria
  - Dependencies between tasks mapped
  ↓
Tech Lead assigns tasks to engineers
  ↓
Planning complete → Execution begins
```

**Planning does not begin execution.** The planning phase produces a plan. Execution begins only when the plan is complete and approved.

**Planning surfaces estimates.** The Tech Lead provides time estimates for the task list. Estimates are communicated to the CEO in terms of calendar time ("this feature is planned for 3 engineering days"), not in terms of tasks or complexity.

**Planning identifies risk.** During technical planning, the Tech Lead identifies any risks — architectural unknowns, dependency concerns, capacity constraints — and records them as Risks. Significant risks are surfaced to the CEO during the planning approval.

---

## 8. Clarification Questions

The company asks the CEO a clarification question only when:

1. The request cannot be classified without additional information
2. The acceptance criteria cannot be determined from the goal as stated
3. A prior decision or business rule directly conflicts with the request
4. The scope is ambiguous in a way that would produce materially different plans

**Clarification rules:**

- One question at a time. The company never asks multiple questions simultaneously.
- The question is focused. It identifies exactly what is unclear and offers a default if one is reasonable ("We'll implement email-based password reset unless you have a different preference").
- The question explains why clarification is needed. The CEO understands what the company is trying to determine, not just what they are being asked.
- The company does not ask clarification questions for things it should already know from memory.
- The company does not ask clarification questions for implementation details. Those belong to the company, not the CEO.

**After clarification is received**, the company confirms its understanding back to the CEO in one sentence and proceeds. It does not ask follow-up questions unless the answer introduced new ambiguity.

---

## 9. Goal Creation

A Goal is created when the CEO's request maps to a new measurable business outcome that will require structured planning.

Not every CEO request creates a Goal. A bug fix does not create a Goal. A configuration change does not create a Goal. A Goal is created when the CEO is directing the company toward a significant new capability.

**Goal creation sequence:**

1. Product Manager identifies the measurable business outcome from the CEO's request
2. Product Manager defines the success metric for the Goal
3. Product Manager links the Goal to the appropriate Initiative (or proposes a new Initiative if none exists)
4. CTO confirms that the Goal is feasible within the current repository and constraints
5. Goal is approved and becomes the organizing object for all downstream Epics, Features, and Tasks

**Goals are success-metric driven, not task driven.** A Goal is "Users can successfully complete checkout without abandoning because of payment errors." It is not "Build payment error handling." The distinction matters because it defines what Done means — the metric, not the completion of tasks.

---

## 10. Task Creation

Tasks are created exclusively by the Tech Lead during technical planning. No other employee creates tasks. The CEO does not create tasks.

**Task creation rules:**

- One task maps to one deliverable
- One task is completable within one working day
- Every task has a Definition of Done (a checklist of conditions, not a description of what to implement)
- Every task maps to at least one acceptance criterion from the Feature Brief
- Dependencies between tasks are explicit and directed — circular dependencies are rejected

**What happens when a feature is too large to decompose into tasks:**

If the Tech Lead cannot decompose a Feature into tasks that each fit within one working day, the Feature is too large and must be split. The Tech Lead escalates to the Product Manager to refine the Feature Brief scope. Execution does not begin on a Feature with tasks that exceed the one-day limit.

**Task creation is not negotiated with engineers.** The Tech Lead creates the task list. Engineers receive assignments. Engineers who identify that a task is under-specified or conflicting raise the concern to the Tech Lead — they do not silently expand or modify the task scope.

---

## 11. Employee Assignment

The Tech Lead assigns tasks to engineers. No other employee assigns tasks. Engineers do not self-assign.

**Assignment rules:**

- Tasks are assigned to the engineer whose expertise matches the task domain
- No engineer is assigned more work than is feasible within the sprint window
- The assignment is communicated to the engineer with the task definition, the Definition of Done, and any relevant context from Feature Memory or Repository Memory
- The Tech Lead maintains visibility of all active assignments

**When no suitable engineer is available:**

If no engineer with the required expertise is available, the Tech Lead escalates to the CTO. The CTO determines whether to delay the task, restructure the work, or escalate to the CEO.

**Multi-domain tasks:**

If a task requires expertise from more than one engineer (e.g., both frontend and backend changes are required for a single atomic deliverable), the Tech Lead splits the task into two tasks and sequences them appropriately. Tasks are not co-assigned to multiple engineers.

---

## 12. Employee Collaboration

Employees collaborate directly with each other. Collaboration does not route through the CEO. Collaboration does not require the CEO's knowledge.

**Collaboration patterns:**

```
Backend → Frontend
Backend publishes the API contract before Frontend implements against it.
Frontend does not implement until the API contract is published.

Engineering → Security
When a security-relevant pattern is introduced, the engineer consults the Security Engineer
before implementation is complete. Security is not a post-implementation review step.

QA → Engineering
When QA identifies a defect, QA routes it directly to the assigned engineer through the Tech Lead.
QA does not send defects to the CEO.

Reviewer → Engineering
The Reviewer communicates findings directly to the author. The Tech Lead is informed.
The CEO is never in the review loop.

Tech Lead → Engineering
The Tech Lead communicates progress concerns immediately, not at sprint end.
If an engineer's estimate is at risk, the Tech Lead escalates before the deadline passes.

Technical Writer → Engineering
Documentation begins during implementation, not after. The Technical Writer coordinates
directly with the relevant engineer for technical accuracy review.
```

**Collaboration boundaries:**

- Employees respect each other's domain. A Reviewer does not make architecture decisions in review comments. A QA Engineer does not suggest implementation approaches. A Backend Engineer does not impose UI decisions on the Frontend Engineer.
- Collaboration produces written outputs. Verbal coordination without a written artifact does not exist in the company. Every collaboration that produces a decision creates a record.
- Collaboration never bypasses ownership. The employee who owns a work item remains accountable even when others contribute.
- Employees never communicate through hidden model sessions or transient channels. All inter-employee communication takes the form of durable company artifacts — Comments, Reviews, Plans, Decisions, QA Results, Reports, and Timeline Events — that the runtime can route, track, and reference across sessions.

---

## 13. Knowledge Retrieval

Before any employee produces an output, they retrieve relevant knowledge from two sources: Memory (accumulated experiential knowledge) and Knowledge (curated authoritative knowledge).

**When knowledge retrieval occurs:**

- Before the Product Manager drafts a Feature Brief — to understand what has been built before and what decisions have been made
- Before the Tech Lead plans tasks — to understand the repository architecture and existing patterns
- Before an engineer implements — to understand the coding standards, approved patterns, and API contracts
- Before the Reviewer reviews — to understand the company's quality standards and the architectural intent
- Before the QA Engineer tests — to understand the acceptance criteria history and past defect patterns
- Before the Release Manager releases — to understand the deployment history and rollback patterns

**Knowledge retrieval is not optional.** An employee who makes a decision that contradicts existing company memory or knowledge has failed their responsibilities. The knowledge retrieval step is what makes the company smarter over time — skipping it breaks the compounding effect.

**Knowledge gaps:**  
If an employee retrieves knowledge and finds a gap — the company has no recorded knowledge about a topic that is relevant to the current work — the employee records this gap and proceeds with their best judgment, then creates a memory record of the decision they made so the gap is filled.

---

## 14. Memory Retrieval

Memory retrieval is scoped to the task at hand. Employees do not retrieve all memory — they retrieve memory relevant to the current context.

**Memory retrieval scope by employee:**

| Employee | Primary Memory Scope |
|---|---|
| Product Manager | Feature Memory, business rules, past product decisions |
| Tech Lead | Repository Memory, architecture decisions, past task estimates |
| Frontend Engineer | UI conventions, accessibility standards, animation preferences |
| Backend Engineer | API conventions, security patterns, database decisions |
| AI Engineer | Evaluation standards, model selection decisions |
| Infrastructure Engineer | Infrastructure topology, deployment decisions |
| Reviewer | Code quality standards, past review patterns, anti-patterns |
| QA Engineer | Test coverage history, past defect patterns, known edge cases |
| Security Engineer | Security posture, past vulnerabilities, approved patterns |
| Release Manager | Deployment history, rollback history, release checklist versions |
| Monitoring Engineer | Monitoring baselines, past incident signals |
| Technical Writer | Documentation standards, feature history |

**Conflict resolution during retrieval:**  
If two memory records conflict — for example, two architectural decisions that point in different directions — the employee surfaces the conflict to the Tech Lead (for technical conflicts) or the Product Manager (for product conflicts) rather than arbitrarily applying one. Conflicts in memory are escalated, not silently resolved.

---

## 15. Decision Making

Every significant decision made during company operation follows the company's decision framework. Employees do not make arbitrary decisions.

**Decision classification:**

| Decision Type | Authority |
|---|---|
| Architecture | Tech Lead (proposes) → CTO (approves) |
| Technical approach within architecture | Tech Lead |
| Scope | Product Manager (proposes) → CEO (approves if significant) |
| Security exception | Security Engineer (flags) → CTO (approves) |
| Risk acceptance | CTO (for technical risk) → CEO (for business risk) |
| Process deviation | Release Manager (for release) → CTO |

**Decision making process:**

1. The deciding employee states the decision being made
2. The employee applies their department's decision framework (priority ordering from the Company Operating System)
3. The employee considers alternatives and documents the rejected alternatives
4. If the decision exceeds their authority, the employee escalates with a recommendation rather than making the decision themselves
5. The decision is recorded as a Decision Record in company memory

**Employees never make decisions silently.** A decision that is not documented did not happen from the company's perspective. If it was important enough to make, it is important enough to record.

---

## 16. Conflict Resolution

Conflicts arise when two employees or two departments have competing recommendations for the same decision. This is expected and healthy. The company has defined resolution rules.

**Conflict types and resolution paths:**

**Technical conflict** (two engineers disagree on implementation approach):  
Tech Lead decides. If Tech Lead cannot resolve, CTO decides. This is the most common conflict type.

**Product vs. Engineering conflict** (Product Manager wants a scope or feature that Engineering considers infeasible or high-risk):  
1. Engineering documents the technical concern as a Risk
2. Product Manager reviews the risk
3. If they cannot agree, CTO is consulted
4. If CTO cannot resolve, CEO is presented with a structured summary: what is being proposed, what the risk is, and what the alternatives are

**Security conflict** (Security Engineer recommends a change that Engineering or Product disagrees with):  
Security Engineer has blocking authority. Security concerns are not overridden by implementation preference. If a Security hold cannot be resolved at the employee level, CTO decides. The CEO is notified of security holds that affect release timelines.

**Quality conflict** (Reviewer or QA recommends blocking a release; Release Manager or Product Manager wants to proceed):  
Quality has blocking authority. A QA No-Go stops the release. A Blocking review finding stops the merge. These cannot be bypassed at the employee level. Only CTO-level override can proceed past a Quality block, and the override is permanently recorded.

**Resolution principles:**

- Conflicts are resolved by authority, not by consensus. Someone has the authority to decide.
- The employee who loses the conflict documents their objection in the Decision Record. The objection is preserved.
- Conflicts are never resolved by asking the CEO to choose between technical options. The CEO is presented with outcomes, not implementation options.

---

## 17. Escalation Rules

Escalation is the mechanism by which decisions that exceed an employee's authority are routed to the correct authority. Escalation is not failure — it is organizational discipline.

**Escalation triggers:**

An employee escalates when:
- The decision changes the product scope
- The decision changes the system architecture
- The decision involves accepting security risk
- The decision involves proceeding despite a Quality block
- Two valid approaches exist and the choosing authority is above the employee's level
- Company values are in conflict (e.g., speed vs. quality)
- An external or legal concern is involved

**Escalation does NOT occur for:**
- Routine implementation choices
- Minor scope clarifications within a Feature Brief
- Technical approach choices within approved architecture
- QA test case selection
- Documentation structure

**Escalation format:**

Every escalation follows the company's structured communication format:
- Recommendation (what the escalating employee recommends)
- Reasoning (why this recommendation)
- Risks (what could go wrong with this recommendation and with alternatives)
- Alternatives (the other options considered)
- Confidence level (how certain the employee is)
- Next action (what the escalation receiver needs to decide or approve)

**Escalation paths:**

```
Engineering employee → Tech Lead → CTO → CEO
Product employee → Product Manager → CTO → CEO
Operations employee → Release Manager → CTO → CEO
Security employee → Security Engineer → CTO → CEO
```

The CEO is the final escalation point for any decision that requires it. The CEO never receives escalations that could have been resolved at a lower level.

---

## 18. Approval Requests

Approval requests are a specific type of CEO interaction — they are decisions that cannot be made without CEO input. They differ from escalations in that escalations may be resolved internally; approval requests always require CEO action.

**What generates an approval request:**

Approval requests are generated by the autonomy level setting and by certain mandatory gates:

| Autonomy Level | Approval Required At |
|---|---|
| Manual | Every SOP gate (Feature Brief, Task list, Review completion, QA Go, Release) |
| Assist | Feature Brief approval, Release authorization |
| Delegate | Release authorization only |
| Autonomous | No routine approvals; only P0 incidents and security holds |

Additionally, these situations always generate an approval request regardless of autonomy level:
- A request to change the system architecture beyond current bounds
- A QA No-Go override request (requires CTO action; CEO is informed)
- A P0 production incident (CEO is notified and provided with status)
- A security exception to an established company policy

**Approval request format:**

Every approval request presented to the CEO contains:
- What is being requested (in plain organizational language)
- Why it requires CEO approval
- What happens if approved
- What happens if rejected
- Who is recommending approval and why
- How long this can wait (urgency indicator)

The CEO never reads raw review comments, task descriptions, or technical specifications in an approval request. The request is organizational and outcome-focused.

---

## 19. Review Cycle

The review cycle begins when the Tech Lead confirms Delivery Readiness on a completed body of work. It ends when the Reviewer approves the work or an escalation resolves a blocking finding.

**Review cycle sequence:**

```
Tech Lead confirms Delivery Readiness
  ↓
Tech Lead routes work to Reviewer
  ↓
Reviewer examines the work against:
  - Feature Brief acceptance criteria
  - Company coding standards
  - Architecture consistency
  - Maintainability and readability
  - Company culture profile requirements
  ↓
Reviewer classifies all findings:
  - Blocking: must be resolved before approval
  - Non-blocking: should be addressed but does not block
  - Question: clarification requested, does not block
  ↓
(if security-relevant patterns are present)
  Tech Lead flags Security Engineer
  Security Engineer reviews in parallel with Reviewer
  ↓
Engineer addresses Blocking findings and responds to Non-blocking and Questions
  ↓
Reviewer re-examines resolved findings
  ↓
(if no Blocking findings remain AND no active Security hold)
  Reviewer approves
  Tech Lead merges
  ↓
QA Cycle begins
```

**Review principles:**

- The Reviewer never reviews their own work. The Tech Lead never merges unreviewed code.
- Non-blocking findings are documented even if they do not block approval. The engineer responds — they may agree and commit to address it, or explain why they disagree. Neither is a failure.
- Questions in a review are collaborative, not critical. The Reviewer asks because they want to understand, not to challenge.
- The Reviewer considers the Feature Brief acceptance criteria. Code that passes all tests but does not satisfy an acceptance criterion is not approved.

**What the CEO sees:** The review status is visible on the Project as a status indicator (In Review / Changes Requested / Security Review / Approved). The CEO never reads individual review findings.

---

## 20. QA Cycle

The QA cycle begins after code review approval and code merge. It ends when the QA Engineer issues a go/no-go recommendation.

**QA cycle sequence:**

```
Code merged after review approval
  ↓
QA Engineer creates Test Plan:
  - Covers all acceptance criteria from Feature Brief
  - Covers edge cases and boundary conditions
  - Covers regression scope (shared code, dependent APIs, core flows)
  - Covers risk areas identified during planning
  ↓
DevOps Engineer deploys merged code to staging environment
  ↓
QA Engineer executes Test Plan against staging
  ↓
QA Engineer documents all defects:
  - Blocking: prevents release
  - High: must be addressed before release
  - Medium: should be addressed before release
  - Low: may be deferred
  ↓
Tech Lead routes Blocking and High defects to engineers for resolution
  ↓
Engineers fix → QA Engineer re-validates
  (this cycle repeats until no Blocking or High defects remain)
  ↓
QA Engineer issues go/no-go recommendation in writing
  ↓
(if Go) Release Cycle begins
(if No-Go) Release is blocked until CTO authorizes override
```

**QA principles:**

- QA is never optional. A release without a QA go recommendation does not proceed.
- The QA Test Plan is created before execution begins, not after. Testing against an ad hoc scope is not QA.
- The QA Engineer validates against the Feature Brief's acceptance criteria, not against what was built. If what was built does not satisfy the acceptance criteria, it is a defect regardless of whether the implementation is technically correct.
- The go/no-go recommendation is the QA Engineer's professional judgment. It is not a formality. A No-Go is as valid as a Go.

**What the CEO sees:** QA status is visible on the Project (In QA / Defects Open / Go / No-Go). The CEO is notified if a No-Go blocks a release they were expecting.

---

## 21. Release Cycle

The release cycle begins after the QA go recommendation is issued. It ends when the production deployment is stable and memory is updated.

**Release cycle sequence:**

```
QA go recommendation issued
  ↓
Release Manager assembles Release Readiness Checklist:
  - QA go recommendation: confirmed
  - Security clearance: confirmed (if applicable)
  - DevOps deployment readiness: confirmed
  - Monitoring baseline: confirmed
  - Documentation readiness: confirmed (Technical Writer confirms in writing)
  - Rollback validated: confirmed (DevOps confirms rollback procedure is ready)
  ↓
(if autonomy level requires approval) CEO approves release
  ↓
Release Manager issues go decision
  ↓
DevOps Engineer executes production deployment
  ↓
Monitoring Engineer watches post-deployment signals:
  - 5-minute mark: initial signal report
  - 30-minute mark: monitoring window close report
  ↓
(if signals are clean)
  Release Manager declares release stable
  Documentation published
  Release record closed
  Memory Update cycle begins
  ↓
(if signals indicate a problem)
  Monitoring Engineer alerts Release Manager and CTO
  Rollback evaluation begins immediately
  (see Recovery From Failure)
```

**Release principles:**

- The Release Manager does not issue a go without a complete checklist. A checklist with unchecked items is not a complete checklist.
- Documentation readiness is a release gate. A release without documentation is not a release — it is a deployment without a feature.
- The monitoring window is not optional. Declaring stability before the 30-minute window closes is not permitted.

**What the CEO sees:** The CEO is notified when the release goes to production and again when it is declared stable. If the CEO's autonomy level requires release approval, they receive an approval request before the deployment begins.

---

## 22. Memory Updates

Memory updates are phase 8 of the New Feature SOP. They are not optional cleanup — they are the mechanism by which the company learns.

**Memory update sequence:**

```
Feature ship confirmed
  ↓
Product Manager updates Feature Memory:
  - What the feature does
  - What problem it solves
  - Acceptance criteria as shipped (noting any deviations from the original brief)
  - Release version
  - Key decisions made during development
  ↓
Tech Lead records architectural decisions:
  - Any architectural direction chosen during this feature
  - Alternatives rejected and why
  - Future considerations
  ↓
Technical Writer confirms documentation indexed
  ↓
(if new security patterns were introduced)
  Security Engineer records approved pattern in Memory
  ↓
(if new monitoring signals were introduced)
  Monitoring Engineer records signal definitions in Memory
  ↓
Memory update complete
  ↓
Feature status: Done
```

**Memory update rules:**

- The feature is not Done until memory is updated. Done status is gated on memory completion.
- Memory records are written in plain language. They must be understandable by any employee, not only the employee who wrote them.
- If a decision was made during the feature that deviates from prior memory, the prior memory record is superseded, not contradicted. The new record links to the old one.

---

## 23. Knowledge Updates

Knowledge updates are distinct from Memory updates. While Memory records are accumulated continuously, Knowledge updates are deliberate curatorial acts by the Technical Writer.

**When Knowledge updates occur:**

- A new pattern is established that should become the company's official standard
- An API contract is published or updated
- Architecture documentation needs to reflect a change made during a feature
- A post-incident review produces a new operational runbook
- A feature ships with user-facing capabilities that require official documentation

**Knowledge update sequence:**

```
Technical Writer identifies knowledge that needs documentation
  ↓
Technical Writer drafts Knowledge Record
  ↓
Technical Writer routes to CTO or Tech Lead for accuracy approval
  ↓
CTO or Tech Lead approves
  ↓
Technical Writer publishes
  ↓
Prior version deprecated (if applicable) with link to new version
```

**The Technical Writer owns curation, not content.** Engineers provide the technical content. The Technical Writer organizes, edits for clarity, and publishes. The Technical Writer does not invent technical content.

---

## 24. Timeline Updates

Timeline entries are generated automatically by the system from significant events. No employee is responsible for creating Timeline entries — they are a system output.

**Events that produce Timeline entries:**

- A Feature ships (feature_shipped)
- A production incident is resolved (incident_resolved)
- A significant architectural decision is recorded (decision_made)
- A Milestone is reached (milestone_reached)
- A Release is deployed (release_deployed)
- Significant company memory is added (memory_updated)
- A Repository is connected and onboarded (repository_connected)
- A Security review produces a clearance or exception (security_cleared)

**Timeline entry creation rules:**

- Timeline entries are written in plain language for the CEO
- Timeline entries reference the underlying work items (linked)
- Timeline entries never expose implementation details (file names, commit hashes, branch names)
- Timeline entries are immutable — they record what happened, not the current state

---

## 25. Notification Rules

Notifications are the CEO's attention management system. The company generates many events; only a small fraction reach the CEO as notifications.

**Notification generation rules:**

Notifications are sent to the CEO when:
1. An approval gate requires CEO action (approval request)
2. A P0 or P1 production incident is detected (critical alert)
3. A security hold affects a release the CEO is expecting (security notification)
4. A feature the CEO submitted has completed and is live (completion notification)
5. A significant company health metric changes (health alert)
6. A QA No-Go blocks an expected release (status update)

**Notifications are NOT sent to the CEO for:**
- Individual task completions
- Review findings or their resolution
- Defect reports and their resolution
- Internal employee communications
- Routine QA test case creation
- Documentation drafts under review
- Staging deployments

**Notification content rules:**

Every notification contains only information the CEO needs to act on it or understand it. No implementation details. No technical jargon. No internal process references.

A notification that reads "PR #442 was approved by the Reviewer after addressing 3 blocking findings" has failed. A notification that reads "Your authentication feature has passed code review and is now in QA" has succeeded.

---

## 26. Completion Criteria

A work item is complete when all of the following are true. These criteria are non-negotiable. Partial completion is not completion.

**For a Feature:**
- [ ] Feature Brief was approved before implementation began (Gate 1)
- [ ] All tasks were created and assigned before implementation began (Gate 2)
- [ ] Tech Lead confirmed Delivery Readiness before code went to review (Gate 3)
- [ ] Reviewer approved; all Blocking findings resolved; code merged (Gate 4)
- [ ] QA Engineer issued a Go recommendation in writing (Gate 5)
- [ ] Documentation complete and accuracy-reviewed (Gate 6)
- [ ] Production deployment stable; monitoring window closed cleanly (Gate 7)
- [ ] Feature Memory updated; architectural decisions recorded (Gate 8)

**For a Bug Fix:**  
- [ ] Defect severity classified
- [ ] Root cause identified
- [ ] Fix implemented with regression test coverage
- [ ] Reviewer approved the fix
- [ ] QA validated the fix and confirmed no regression
- [ ] Deployed to production
- [ ] Monitoring confirmed no recurrence
- [ ] Root cause documented in memory

**For a Release:**  
- [ ] QA go recommendation on record
- [ ] Release Readiness Checklist fully completed
- [ ] Production deployment executed
- [ ] Monitoring window closed cleanly
- [ ] Documentation published
- [ ] Release record closed

---

## 27. Parallel Work

The company coordinates parallel work when independent work can proceed simultaneously without creating conflicts or dependencies.

**What can run in parallel:**

- Documentation (Technical Writer) begins during implementation (Engineering), not after QA
- Search visibility review (SEO Specialist) runs in parallel with final QA
- Security Engineer review runs in parallel with the primary Reviewer review
- Multiple Tasks within a Sprint run in parallel, provided they have no dependencies on each other
- Monitoring setup runs in parallel with late-stage implementation

**What cannot run in parallel:**

- Implementation cannot begin before the Feature Brief is approved (Gate 1)
- Code review cannot begin before Delivery Readiness is confirmed (Gate 3)
- QA cannot begin before code is merged (Gate 4)
- Release cannot begin before QA go recommendation is issued (Gate 5)
- Memory update cannot be considered complete until documentation is confirmed

**Parallel work tracking:**

When multiple work streams are running simultaneously, the company tracks each independently. Blocking in one stream does not block unrelated streams. The CEO sees a combined view of all active streams on the Dashboard.

---

## 28. Sequential Work

Some work is strictly sequential. Violating sequencing produces lower quality outcomes and is not permitted.

**Mandatory sequential dependencies:**

```
Feature Brief Approved (Gate 1)
→ Task Decomposition (Gate 2)
→ Implementation (Gate 3: Delivery Readiness)
→ Review (Gate 4: Approval)
→ QA (Gate 5: Go recommendation)
→ Release (Gate 7: Stable deployment)
→ Memory Update (Gate 8: Done)
```

Between these mandatory phases, parallelism is permitted. Within each phase, work may also be sequential (e.g., Backend API contract must be published before Frontend implementation can begin).

**The Tech Lead manages sequencing.** The Tech Lead identifies dependencies between tasks and sequences them appropriately. Engineers do not decide their own sequencing.

---

## 29. Long-Running Work

Long-running work is work that spans multiple sessions or days. The company handles it without requiring the CEO to manually track continuity.

**Long-running work rules:**

- The company maintains full state for any active work item across sessions. A CEO who closes Engineering OS and returns the next day finds the company exactly where it was.
- Progress reports are surfaced to the CEO at meaningful intervals — completion of a phase, not completion of individual tasks.
- Long-running work has a declared expected completion. When the expected completion is at risk, the Tech Lead surfaces this to the CEO before the deadline, not after.
- Memory records are written at each phase boundary during long-running work, not only at final completion.

**Multi-day tasks:**

Individual tasks are designed to complete within one working day. If a task is taking longer, the Tech Lead assesses whether it needs to be split (the task was too large), whether there is a blocker (the engineer is stuck), or whether the estimate was wrong (for memory update and future planning improvement).

Multi-day tasks do not represent failure — they represent a planning calibration opportunity. The Tech Lead records the deviation and its reason.

---

## 30. Blocked Work

A work item is blocked when it cannot proceed and the blocker is external to the assigned employee's authority.

**Types of blockers:**

| Blocker Type | Resolution Owner |
|---|---|
| Missing information from Product Manager | Product Manager |
| Architecture question beyond engineer authority | Tech Lead |
| Dependency on another task not yet complete | Tech Lead (resequencing) |
| Security hold | Security Engineer → CTO |
| Environment unavailable (staging, etc.) | DevOps Engineer |
| CEO approval not yet received | Notification to CEO |
| External dependency (third-party API, vendor) | CTO → CEO |

**Blocked work rules:**

- A blocked work item is immediately surfaced to the Tech Lead. Engineers do not wait in silence.
- The blocker is recorded explicitly: what is blocking, who owns the resolution, what the impact is on timeline.
- The Tech Lead attempts to resolve blockers or reassign the engineer to unblocked work while the blocker is resolved.
- A blocker that cannot be resolved within one working day is escalated to the CTO.
- Blockers that require CEO input generate a Notification with the blocker described in plain language.

---

## 31. Recovery From Failure

Failure is defined as a situation where a work item cannot proceed and there is no standard resolution path. Recovery is the structured process by which the company addresses failure and returns to normal operation.

**Failure scenarios and recovery paths:**

**Implementation failure** (engineer cannot complete a task):
1. Engineer surfaces the failure to the Tech Lead immediately
2. Tech Lead assesses: is this a scope problem (task too large/ambiguous), a capability problem (wrong employee assigned), or a blocker?
3. Tech Lead restructures the task or reassigns it
4. If the failure affects the Feature's timeline, the Tech Lead surfaces this to the Product Manager and CTO
5. CEO is notified only if the feature timeline is materially affected

**Production incident** (monitoring signals indicate a problem post-release):
1. Monitoring Engineer classifies severity immediately
2. P0/P1: CTO and Release Manager alerted immediately; CEO notified
3. P2/P3: CTO and Release Manager alerted; CEO notified in next summary
4. Rollback evaluation begins: Release Manager assesses whether rollback is warranted
5. If rollback: DevOps executes rollback immediately; Monitoring Engineer confirms restoration
6. Root cause investigation begins regardless of whether rollback occurs
7. Tech Lead owns root cause analysis
8. Post-incident review produces: root cause document, follow-up tasks, memory update
9. Company memory is updated with incident lessons

**QA No-Go** (QA blocks a release):
1. QA Engineer documents No-Go recommendation with specific defects cited
2. Tech Lead routes defects to engineers for resolution
3. Engineers fix; QA re-validates
4. If timeline impact is significant, CTO is consulted
5. If CTO decides to override, the override is recorded permanently and the CEO is notified

**Review block** (Reviewer cannot approve):
1. Reviewer communicates blocking findings to the author
2. Author addresses findings and responds
3. If the finding reveals a fundamental architectural issue, Tech Lead is consulted
4. If Tech Lead cannot resolve, CTO is consulted
5. The review finding record and all responses are retained permanently

**The company does not hide failures.** A failure that is detected and resolved is a learning opportunity. A failure that is hidden is an organizational integrity problem. Every failure produces a memory record.

---

## 32. Cancellation

A work item may be cancelled before it reaches completion. Cancellation is explicit — work items are not silently abandoned.

**Cancellation rules:**

- Cancellation of a Feature or Project requires CEO input. Employees do not cancel features.
- Cancellation of an individual Task may be initiated by the Tech Lead (e.g., the task is no longer needed due to a scope change). The CEO is not required for task-level cancellations.
- Cancelled work items retain their full history. They are not deleted.
- If a cancellation occurs after significant work has been completed, a memory record is written explaining what was built, what decisions were made, and why the work was cancelled. Future work in this area benefits from this record.

---

## 33. Retry

Certain operations may be retried when they fail transiently. Retry is distinct from recovery — retry is for transient failures; recovery is for substantive failures.

**Retryable operations:**

- External API calls (repository hosting, deployment platform) — retry with exponential backoff
- Memory write failures — retry until confirmed; a successful execution without a memory write is not acceptable
- Notification delivery failures — retry until the CEO's session is active
- Integration synchronization failures — retry with alerting after N failures

**Non-retryable operations:**

- A QA No-Go is not a transient failure — it reflects a substantive problem with the work
- A security hold is not retried — it is cleared by the Security Engineer or escalated
- A failed deployment is assessed for rollback, not retried automatically

---

## 34. Runtime Events

The Company Runtime produces and consumes the following events that are specific to runtime coordination. (Module-specific events are defined in TECHNICAL_ARCHITECTURE.md.)

**Runtime coordination events:**

| Event | Trigger |
|---|---|
| `runtime.work_item_started` | A work item entered an active state |
| `runtime.work_item_phase_changed` | A work item advanced to the next SOP phase |
| `runtime.work_item_blocked` | A work item entered blocked state |
| `runtime.work_item_unblocked` | A blocked work item resumed |
| `runtime.work_item_completed` | A work item reached Done |
| `runtime.work_item_failed` | A work item entered failed state |
| `runtime.work_item_cancelled` | A work item was cancelled |
| `runtime.approval_required` | An autonomy gate requires CEO input |
| `runtime.approval_received` | CEO acted on an approval gate |
| `runtime.company_health_changed` | A company health metric changed materially |

**Domain workflow events emitted during the standard feature lifecycle:**

| Event | Emitted After |
|---|---|
| `task.ready_for_implementation` | Task created and assigned by Tech Lead |
| `task.ready_for_review` | Engineer confirms Delivery Readiness |
| `review.completed` | Reviewer approves with no Blocking findings |
| `task.ready_for_qa` | Code merged after review approval |
| `qa.passed` | QA Engineer issues Go recommendation |
| `qa.failed` | QA Engineer issues No-Go recommendation |
| `task.blocked` | A work item cannot proceed |
| `release.ready` | Release Readiness Checklist complete |
| `release.stable` | Post-deployment monitoring window closes cleanly |

These events are the mechanism by which the Company Runtime advances work through the SOP lifecycle. Employees do not self-advance — the runtime evaluates whether gate conditions are satisfied and emits the next event when they are.

---

## 35. CEO Interaction Points

The CEO interacts with the company at exactly four points during any work lifecycle. Everything else the company handles internally.

**Interaction 1: Goal Submission**  
The CEO states what they want the company to work on. This is the only required CEO interaction to initiate any body of work.

**Interaction 2: Plan Approval** *(at Assist or Manual autonomy level)*  
The CEO reviews the Feature Brief summary and approves or provides direction. At Delegate or Autonomous levels, the CTO approves the Feature Brief and the CEO is informed.

**Interaction 3: Release Approval** *(at Delegate or lower autonomy level)*  
The CEO approves the production release before it proceeds. The approval request contains: what is shipping, what was tested, and any open risks. At Autonomous level, the company releases without CEO approval and notifies after.

**Interaction 4: Incident Response** *(for P0/P1 incidents only)*  
The CEO is notified immediately of P0 and P1 incidents and receives regular status updates until resolution. The CEO does not direct the incident response — the company handles it. The CEO is informed, not coordinating.

**What the CEO never does:**

- Create tasks
- Assign engineers
- Review code
- Run tests
- Choose deployment windows
- Write documentation
- Manage integrations

These are the company's responsibilities. The CEO's job is to direct where the company goes, approve what leaves the company (ships to production), and make decisions that require CEO authority.

**When the CEO asks about status:**  
The CEO can ask about status at any time. The company responds with a plain-language summary of where any work item currently is in its lifecycle. The CEO never has to remember where something was last time they checked — the company maintains that context.

---

## 36. Event-Driven Employee Invocation

The Company Runtime does not maintain always-on employee processes. Employees are persistent company roles — not background daemons that continuously listen for work. They are invoked by the runtime when a task, event, or state change requires their attention.

**Invocation sequence:**

```
Runtime detects task or state change
  ↓
Runtime emits a structured domain event (e.g., task.ready_for_review)
  ↓
Dispatcher claims the pending event from the event queue
  ↓
AgentRunner receives the claimed event
  ↓
AgentRunner identifies the responsible employee from the event
  ↓
Context Builder assembles the execution context package:
  - relational data (task, project, feature brief, dependencies)
  - repository context
  - company memory (scoped to employee role and task)
  - employee handbook and responsibilities
  - runtime state
  - knowledge records
  ↓
AgentRunner invokes the assigned Execution Engine with the context package
  ↓
Execution Engine performs the reasoning or code execution step
  ↓
Execution Engine returns a Structured Result
  ↓
Runtime persists the result as durable company artifacts
  (Comment, Review, Plan, Decision, QA Result, Memory Record, Report, etc.)
  ↓
Runtime updates task and event state
  ↓
Runtime evaluates next gate conditions and emits the next event
```

**Example A: End-to-end feature flow**

```
CEO goal submitted
  → Product Manager invoked: produces Feature Brief
  → CTO invoked: reviews feasibility, approves Feature Brief
  → CEO approval received (if required by autonomy level)
  → Tech Lead invoked: decomposes into tasks, assigns engineers
  → Engineers invoked: implement tasks, confirm Delivery Readiness
  → Reviewer invoked: reviews code, produces findings
  → QA Engineer invoked: executes test plan, writes QA Result
  → Release Manager invoked: assembles Release Readiness Checklist
  → DevOps Engineer invoked: executes deployment
  → Monitoring Engineer invoked: observes post-release signals
  → Tech Lead invoked: writes architectural Decision Record
  → Product Manager invoked: updates Feature Memory
  → CEO notified: feature shipped
```

**Example B: Tech Lead → QA handoff**

```
Tech Lead creates QA checklist as part of task assignment
  ↓
Runtime emits task.ready_for_qa when code is merged
  ↓
Dispatcher claims event; AgentRunner identifies QA Engineer
  ↓
Context Builder assembles context package:
  - task definition and acceptance criteria
  - Feature Brief and its acceptance criteria
  - QA checklist produced by Tech Lead
  - prior QA Result history from company memory
  - repository context relevant to what was implemented
  ↓
QA Engineer executes test plan against the assembled context
  ↓
QA Engineer writes QA Result (a durable artifact)
  ↓
Runtime persists QA Result; updates project state
  ↓
  If Go:    Runtime emits qa.passed → routes to Release phase
  If No-Go: Runtime emits qa.failed → routes defects back to Tech Lead
```

The Execution Engine that performs the reasoning step is replaceable. Whether the work is done through Claude Code, Codex CLI, Gemini CLI, an API provider, or a local model, the invocation sequence, the context package structure, and the Structured Result contract remain the same. The Company Runtime's behavior does not depend on which execution engine is used.

---

## 37. Runtime Ownership Boundaries

The Company Runtime, employees, and execution engines each own a distinct layer of responsibility. These boundaries must not blur as the system evolves.

**The Company Runtime owns:**

- **Orchestration** — which employee acts, in what order, on what work
- **Scheduling** — when events are dispatched and when work is eligible to begin
- **Dispatch** — which worker claims which pending event
- **Runtime state** — the current phase of every active work item
- **Retries** — reattempting invocations that fail transiently
- **Cancellation** — terminating a work item in progress
- **Escalation routing** — surfacing blocked decisions to the correct authority
- **Persistence** — writing structured outputs to durable company records
- **Timeline updates** — recording significant events in company history
- **Notifications** — routing events to the CEO when their attention is required
- **Company memory** — accumulating and serving the long-term organizational knowledge
- **Event routing** — which modules and subscribers receive which events

**Employees own:**

- Role-specific analysis and reasoning
- Role-specific recommendations following the company's structured communication format
- Role-specific artifact production — plans, reviews, QA results, decisions, reports, memory records
- Updates to company state within their domain, such as memory records and comments

**Execution engines own:**

- Performing the actual reasoning, code generation, or file operation step when invoked
- Operating on the context package delivered by the Context Builder
- Returning a Structured Result to AgentRunner

Execution engines are replaceable providers. The same employee role — Tech Lead, QA Engineer, Reviewer — can be invoked through different execution engines at different times without changing the organizational behavior. No execution engine is architecturally required. Provider independence is a first-class property of the architecture.

The execution engine is never responsible for:
- Querying company memory directly
- Making routing or scheduling decisions
- Persisting results to company records
- Emitting events to the event stream

These responsibilities always belong to the Company Runtime.

---

## Relationship to Other Architecture Documents

- **DOMAIN_MODEL.md** defines the objects this runtime manages and their lifecycle rules.
- **INFORMATION_ARCHITECTURE.md** defines how the CEO views the runtime state through the Dashboard and Company sections.
- **TECHNICAL_ARCHITECTURE.md** defines the modules that implement the runtime behaviors described here.
- **MVP_ROADMAP.md** defines which runtime behaviors ship in V1 and which are deferred.
- **SOPs** (NEW_FEATURE.md, BUG_FIX.md, CODE_REVIEW.md, QA_VALIDATION.md, RELEASE.md, ROLLBACK.md) define the detailed phase-by-phase procedures that the runtime executes.
