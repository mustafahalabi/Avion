# MVP Roadmap — Engineering OS

**Status:** Approved for Implementation  
**Version:** 1.0  
**Owner:** Product Manager  
**Approved By:** CEO  
**Last Updated:** 2026-06-26  

This document turns the product architecture into an executable implementation roadmap. It defines what ships in V1, in what order, and why. It is not a project plan with dates — it is an engineering contract that defines scope, priorities, and the critical path.

This roadmap builds on the approved PRODUCT_REQUIREMENTS.md and aligns with the Linear project "Engineering OS Product Architecture v1.0." It does not introduce scope beyond what has been documented and approved.

---

## Table of Contents

1. [Product Thesis](#1-product-thesis)
2. [Vision for V1](#2-vision-for-v1)
3. [Definition of MVP](#3-definition-of-mvp)
4. [Success Criteria](#4-success-criteria)
5. [Target User](#5-target-user)
6. [Core Workflow](#6-core-workflow)
7. [Critical User Journey](#7-critical-user-journey)
8. [Implementation Phases](#8-implementation-phases)
9. [Milestones](#9-milestones)
10. [Dependencies](#10-dependencies)
11. [Scope](#11-scope)
12. [Explicit Non-Goals](#12-explicit-non-goals)
13. [Technology Strategy and Phasing](#13-technology-strategy-and-phasing)
14. [Technical Risks](#14-technical-risks)
15. [Product Risks](#15-product-risks)
16. [Validation Strategy](#16-validation-strategy)
17. [Release Strategy](#17-release-strategy)
18. [What Ships in V1](#18-what-ships-in-v1)
19. [What Moves to V2](#19-what-moves-to-v2)
20. [What Is Intentionally Postponed](#20-what-is-intentionally-postponed)
21. [Recommended Implementation Order](#21-recommended-implementation-order)

---

## 1. Product Thesis

Software development has an organizational bottleneck, not a code generation bottleneck. AI tools have largely solved the cost of writing code. Nobody has solved the cost of coordinating the people and processes required to produce quality software reliably.

Engineering OS solves the organizational bottleneck by replacing tool coordination with organizational delegation. The CEO states goals. The company delivers them.

V1 must demonstrate this thesis with a single end-to-end workflow: a CEO submits a goal, and the company produces a planned, implemented, reviewed, tested, documented, deployed feature — without the CEO touching any implementation tool.

If V1 accomplishes this for even one feature, the thesis is proven and the compounding value of memory and organizational depth can be built on top.

---

## 2. Vision for V1

V1 Engineering OS is a working virtual software company that a CEO can use to ship one complete, production-quality feature from a single natural language goal.

V1 does not attempt to be a complete product. It attempts to prove that the core workflow works end-to-end. Everything in V1 is chosen because it is necessary to demonstrate the complete workflow, not because it is a nice-to-have.

The CEO experience in V1 looks like this:

> The CEO opens Engineering OS. Their company is staffed and ready.  
> The CEO says: "I want users to be able to reset their password."  
> The company plans the feature, breaks it into tasks, implements it, reviews the code, validates it in QA, and deploys it to production.  
> The CEO approves the feature brief and approves the final release.  
> The company ships the feature and updates its memory.  
> The CEO says: "Add dark mode."  
> The company already knows the repository, knows the conventions, and begins planning immediately.

This is V1 done.

---

## 3. Definition of MVP

The MVP is the smallest version of the product that proves the core thesis: a CEO can delegate a software feature to their company and receive a shipped, production-quality result.

**The MVP must demonstrate:**

1. A CEO can submit a goal in natural language
2. The company produces a plan (Feature Brief) the CEO can approve or redirect
3. The company decomposes the plan into tasks and assigns them to engineers
4. The company implements the feature
5. The company reviews the implementation against quality standards
6. The company validates the implementation against the acceptance criteria
7. The company deploys the validated feature to production
8. The company documents the feature and updates its memory
9. The company remembers what it built and uses that knowledge when the next feature is requested

The MVP does not need to be fast. It does not need to be beautiful. It does not need to support every SOP or every employee. It needs to prove the loop works.

---

## 4. Success Criteria

### V1 Product Success

| Criterion | Target | Measurement |
|---|---|---|
| End-to-end feature shipping | 100% of submitted features that enter implementation reach production | Feature completion rate from release records |
| CEO satisfaction with first feature | CEO confirms the feature meets their original intent | Post-feature confirmation |
| Zero CEO implementation interventions | CEO never directly touches a file, branch, or deployment command | CEO interaction log analysis |
| Memory utilization | Second feature references knowledge from first feature | Memory retrieval log analysis |
| Quality gate compliance | 100% of features pass all 8 SOP gates in documented sequence | Release records |

### V1 Business Success (from PRODUCT_REQUIREMENTS.md)

| Metric | V1 Target |
|---|---|
| Feature completion rate | >85% of started features shipped |
| CEO retention (Week 4) | >60% |
| Time-to-first-feature | <24 hours from account creation |
| Defect escape rate | <5% of shipped features have post-release defects |
| Deployment success rate | >95% of deployments succeed without rollback |

---

## 5. Target User

The primary V1 user is a **technical founder** who:
- Has an existing codebase in a major version control system
- Has enough engineering background to evaluate what the company produces (at least read-level understanding)
- Is currently the primary or sole engineer on their codebase
- Wants to delegate engineering execution while retaining product direction

V1 is not designed for non-technical founders. The approval flows, architecture summaries, and QA reports contain concepts that require basic engineering literacy. Non-technical founder support is a V2 priority.

V1 is also not designed for large teams. The single-user, single-repository constraint means V1 is optimized for soloists and small teams where one person holds both the CEO and engineering decision authority.

---

## 6. Core Workflow

The single workflow V1 must fully support is the **New Feature SOP** (SOP-001).

```
CEO submits goal
↓
Product Manager produces Feature Brief
↓
CTO reviews for feasibility
↓
CEO approves Feature Brief
↓
Tech Lead decomposes into tasks, assigns engineers
↓
Engineers implement
↓
Reviewer reviews code
↓
Security Engineer reviews (when applicable)
↓
QA Engineer validates against acceptance criteria
↓
Technical Writer drafts documentation in parallel
↓
Release Manager coordinates deployment
↓
DevOps deploys to production
↓
Monitoring Engineer watches post-release signals
↓
Documentation published
↓
Company memory updated
↓
Feature Done
```

Every phase of this workflow must work before V1 ships. A workflow that stalls at QA or documentation does not demonstrate the thesis.

---

## 7. Critical User Journey

This is the specific sequence the CEO experiences in V1. It is the design target. Every implementation decision must be evaluated against whether it supports this journey.

### Step 1: Account Creation (Day 0)

The CEO creates an account. Their company is provisioned immediately with the V1 employee roster. No setup wizard. No onboarding questionnaire longer than the two required choices.

The CEO makes exactly two choices:
1. Autonomy level (default: Assist)
2. Culture profile (default: Startup)

The company is ready.

**Success indicator:** CEO has an active company with all V1 employees within 2 minutes of signing up.

### Step 2: Repository Connection (Day 0)

The CEO connects their repository. The CTO and Tech Lead analyze the codebase.

The CEO sees: "Your company is reviewing your repository. This usually takes a few minutes."

The CEO receives: An architecture summary in plain language. "Your repository is a Next.js application with a PostgreSQL database. We've identified 3 areas of technical debt and your current test coverage is estimated at 40%."

The CEO confirms the summary or provides corrections.

**Success indicator:** CEO confirms the architecture summary and the repository enters Active status within 30 minutes of connection.

### Step 3: First Goal (Day 0 or 1)

The CEO types their first goal.

The company classifies it, gathers context from the (newly populated) repository memory, and routes to the Product Manager.

**Success indicator:** The company responds to the CEO's goal within a defined time window, either with a clarification question or with a Feature Brief.

### Step 4: Feature Brief Approval

The CEO receives a Feature Brief summary: what the company proposes to build, its acceptance criteria, what is explicitly out of scope, and the estimated timeline.

The CEO approves or requests changes. If they request changes, the Product Manager revises and resubmits.

**Success indicator:** The CEO approves a Feature Brief. The approval is recorded.

### Step 5: Company Works

The CEO does not need to do anything. The company is working.

The Dashboard shows: which employees are working on what, progress against the task list, and which phase the feature is in.

The CEO can check in at any time and see an accurate status update. They never need to ask "where is this?" — the Dashboard shows them.

**Success indicator:** The Dashboard reflects accurate, live company activity without CEO interaction.

### Step 6: Review and QA

The CEO sees status changes: "In Review" → "Changes Requested" → "In Review" → "Approved" → "In QA" → "QA Passed."

If QA finds defects, they are fixed internally. The CEO sees the status update when QA passes. The CEO does not see individual defect reports unless they navigate into the Project detail.

**Success indicator:** Code review and QA complete without CEO intervention.

### Step 7: Release Approval

The CEO receives a notification: "Password Reset is ready for release. QA has validated all acceptance criteria. Review: approved. Documentation: ready. Your company recommends deployment."

The CEO approves or schedules.

**Success indicator:** CEO approves the release with one action. The release proceeds.

### Step 8: Post-Release

The CEO receives: "Password Reset shipped to production. Monitoring shows all signals stable. Documentation published."

The CEO's next interaction: "Add dark mode."

**Success indicator:** The CEO's next request references no prior context — the company already knows what it built.

---

## 8. Implementation Phases

V1 is organized into six implementation phases. Each phase must fully complete before the next phase begins, because each phase is a prerequisite for the next.

### Phase 1: Foundation

**What:** Core data model, identity, company provisioning, and the basic CEO interface shell.

**Deliverables:**
- User account creation and authentication
- Company provisioning with default employee roster
- Company Settings (autonomy level, culture profile)
- Database schema matching the Domain Model for all V1 objects
- Basic navigation shell (Dashboard, Company, Work, Inbox, Memory)

**Done when:** A CEO can create an account, see their company, see their employees, and configure their autonomy level and culture profile.

**Architectural milestone:** MUS-74 (Information Architecture) and MUS-82 (Technical Architecture) are the reference documents for all implementation decisions in this phase.

---

### Phase 2: Repository Connection

**What:** Repository onboarding, analysis, and Repository Memory initialization.

**Deliverables:**
- Repository connection via URL and credentials
- Repository analysis workflow (CTO and Tech Lead roles analyzing the codebase)
- Repository Memory population (architecture, structure, dependencies, patterns, technical debt)
- Architecture summary presentation to CEO
- CEO confirmation / correction flow
- Repository entering Active status

**Done when:** A CEO can connect a repository, receive an architecture summary, and confirm it — and the company has populated Repository Memory that will inform all future work.

**Dependencies:** Phase 1 complete (Company and Employee infrastructure must exist before repository analysis can occur).

---

### Phase 3: Conversation and Planning

**What:** The CEO's goal input interface and the planning workflow from goal to approved Feature Brief.

**Deliverables:**
- Natural language goal input interface
- Request classification (feature, bug, architecture question, etc.)
- Product Manager role: Feature Brief creation from goal
- CTO role: Technical feasibility review
- CEO approval flow for Feature Brief (at Assist and Manual autonomy levels)
- CTO approval flow for Feature Brief (at Delegate and Autonomous autonomy levels)
- Planning notification to CEO: "Your company has planned N tasks for this feature"
- Tech Lead role: Task decomposition and assignment
- Task creation with Definition of Done, acceptance criteria mapping, and estimates

**Done when:** A CEO can submit a goal in natural language and receive back an approved Feature Brief and a task list ready for execution.

**Dependencies:** Phase 2 complete (Repository Memory is required for planning to reference codebase context).

---

### Phase 4: Execution Engine

**What:** The SOP engine, task execution, and the implementation phase.

**Deliverables:**
- SOP execution engine (Phase 1 through Phase 3 of SOP-001)
- Task status tracking through implementation
- Employee assignment and work simulation for each engineering role
- Delivery Readiness confirmation (Tech Lead gate before review)
- Dashboard: live employee activity updates during execution
- Blocked task detection and routing

**Done when:** The company can take an approved task list and execute it — with engineers producing outputs, the Tech Lead monitoring progress, and the work reaching Delivery Readiness.

**Dependencies:** Phase 3 complete (approved task list required to begin execution).

---

### Phase 5: Quality Gates

**What:** Code review, security review, and QA validation.

**Deliverables:**
- Code review workflow (Reviewer role, finding classification, approval)
- Security review workflow (Security Engineer role, triggered by pattern detection)
- QA validation workflow (QA Engineer role, Test Plan, defect tracking, go/no-go)
- Defect routing back to engineers and re-validation loop
- Go/No-Go recommendation as a permanent record
- Quality gate enforcement: review approval required before QA; QA go required before release

**Done when:** A feature can pass through code review and QA — including defect remediation cycles — and emerge with an approved review and a written QA go recommendation.

**Dependencies:** Phase 4 complete (implemented work must exist before quality gates can be applied).

---

### Phase 6: Release and Memory

**What:** Release coordination, deployment, documentation, and memory update.

**Deliverables:**
- Release Readiness Checklist (Release Manager role)
- Documentation parallel workflow (Technical Writer role, runs from Phase 4)
- CEO release approval notification (at Delegate and lower autonomy levels)
- Release record creation
- Deployment coordination (DevOps role)
- Post-release monitoring window (Monitoring Engineer role)
- Release stable declaration
- Documentation publication
- Feature Memory update (Phase 8 of SOP-001)
- Decision Record creation
- Timeline entry generation
- Feature status: Done

**Done when:** A CEO can receive a deployment notification, see the feature go live, and see "Done" on their Dashboard — with all memory updated and documentation published.

**Dependencies:** Phase 5 complete (QA go recommendation is a release prerequisite).

---

## 9. Milestones

These milestones align with the Linear project milestones in "Engineering OS Product Architecture v1.0."

| Milestone | Definition | Phase |
|---|---|---|
| **Foundation Complete** | CEO can create account, provision company, and connect repository | Phase 1–2 |
| **First Plan** | CEO can submit a goal and receive an approved Feature Brief with task list | Phase 3 |
| **First Execution** | A feature can be implemented end-to-end through the SOP engine | Phase 4 |
| **Quality Gates Live** | Code review, security review, and QA validation all work end-to-end | Phase 5 |
| **First Feature Shipped** | A complete feature is planned, implemented, reviewed, tested, documented, deployed, and memorized | Phase 6 |
| **V1 Released** | The product is available to the first external user | After Phase 6 validation |

---

## 10. Dependencies

### Internal Dependencies (between phases)

```
Phase 1 (Foundation)
  ↓ must complete before
Phase 2 (Repository)
  ↓ must complete before
Phase 3 (Planning)
  ↓ must complete before
Phase 4 (Execution)
  ↓ must complete before
Phase 5 (Quality)
  ↓ must complete before
Phase 6 (Release & Memory)
```

### Document Dependencies

| Implementation Area | Required Document |
|---|---|
| All modules | DOMAIN_MODEL.md |
| Navigation and routing | INFORMATION_ARCHITECTURE.md |
| Module boundaries and events | TECHNICAL_ARCHITECTURE.md |
| Runtime behavior | COMPANY_RUNTIME.md |
| New Feature workflow | docs/sops/NEW_FEATURE.md |
| Bug Fix workflow | docs/sops/BUG_FIX.md |
| Code Review | docs/sops/CODE_REVIEW.md |
| QA Validation | docs/sops/QA_VALIDATION.md |
| Release | docs/sops/RELEASE.md |
| Rollback | docs/sops/ROLLBACK.md |
| Employee behavior | docs/employees/*.md |

### External Dependencies

| Dependency | Where It Appears | Risk if Unavailable |
|---|---|---|
| Repository hosting API (GitHub or equivalent) | Phase 2 (Repository connection) | Repository analysis and code operations cannot proceed |
| Deployment platform API | Phase 6 (Release) | Deployment coordination cannot proceed |
| Version control read access | Phase 2, 4 | Repository analysis and code operations cannot proceed |

---

## 11. Scope

### In Scope for V1

All items from PRODUCT_REQUIREMENTS.md §11 (Product Scope) are in scope for V1:

- Single-user companies (one CEO per company)
- Single active repository per company
- Core employee roster: CTO, Product Manager, Tech Lead, Frontend Engineer, Backend Engineer, QA Engineer, Reviewer, Security Engineer, DevOps Engineer, Release Manager, Monitoring Engineer, Technical Writer
- New Feature SOP (SOP-001) — complete 8-phase implementation
- Bug Fix SOP (SOP-002) — required for MVP validation
- Code Review SOP (SOP-003) — embedded in New Feature SOP Phase 4
- QA Validation SOP (SOP-004) — embedded in New Feature SOP Phase 5
- Release SOP (SOP-005) — embedded in New Feature SOP Phase 6
- Rollback SOP (SOP-006) — required for production readiness
- Company Memory: architecture records, coding standards, decisions, patterns, feature memory, repository memory
- Conversation interface: CEO communicates via natural language
- Company Dashboard: live view of company activity
- Autonomy level configuration (Manual / Assist / Delegate / Autonomous)
- Culture profile configuration (Startup / Enterprise / Design-First / Performance-First)
- Notification system: approval requests, incident alerts, completion notifications
- Repository onboarding and architecture summary
- Timeline (auto-generated from significant events)

### Minimum Viable Scope Within V1

If scope must be reduced further to hit the first ship date, the following are the minimum required:

1. Account creation and company provisioning with default employees
2. Repository connection and basic Repository Memory
3. Goal input and Feature Brief creation
4. Feature Brief approval (CEO)
5. Task decomposition and assignment
6. Implementation phase with at least two engineer roles (Frontend + Backend)
7. Code review (Reviewer)
8. QA validation (QA Engineer)
9. Release coordination (Release Manager + DevOps)
10. Memory update (Feature Memory only)
11. Dashboard with live employee activity

Everything beyond this minimum is still in scope for V1 but may be implemented after the minimum viable demo is complete.

---

## 12. Explicit Non-Goals

These are explicitly not in scope for V1. Scope pressure should not cause these to slide into V1.

**Multiple users per company.** V1 is single-user. Adding a second CEO or stakeholder requires a trust model, conflict resolution rules, and notification routing that are not designed for V1. Do not scope in.

**Multiple repositories per company.** V1 supports one active repository. Multi-repo support requires changes to the Planning module, the Memory module, and the routing model. Do not scope in.

**Employee hiring and customization.** V1 has a fixed employee roster. Hiring, firing, specializing, or promoting employees is V2.

**Growth Department employees (SEO, Analytics, Marketing).** These roles are defined in the organization but are not active in V1.

**External tool integrations beyond repository and deployment.** Stripe, Datadog, PagerDuty, Slack — all V2.

**Public API.** No external developer API in V1.

**White-label or multi-tenant.** V1 is a single product for end users.

**Knowledge Graph visualization.** The graph exists in the data model but the visual product surface is V2.

**Mobile Engineer.** The Mobile Engineer role exists in the organization but is not provisioned in V1.

**Company health benchmarking.** Comparative metrics across companies require sufficient company count. V2.

**Employee promotions and seniority progression.** V2 — requires performance tracking over time.

**LangGraph as the core runtime.** Engineering OS owns its own Company Runtime backed by a database event table and a local Worker model. LangGraph is not required and would create an avoidable third-party dependency on the core orchestration path. Do not scope in for V1; evaluate only if product needs later justify it.

**Temporal as the core runtime.** Same reasoning as LangGraph. The V1 Worker + event table model is sufficient. Temporal adds operational complexity without commensurate V1 benefit.

**Separate backend service.** V1 is a Next.js full-stack application. A separate backend service is not required and would increase deployment complexity without V1 benefit. Introduce only if implementation demonstrates a genuine need.

**Separate vector database.** V1 memory is structured PostgreSQL. Pinecone, Weaviate, Qdrant, and similar products are not required. pgvector inside PostgreSQL is the designated path for semantic retrieval when it becomes necessary in V1.5.

**Hard dependency on Claude Code.** Execution engines are replaceable adapters. V1 may launch with Claude Code as the primary adapter, but the architecture must not assume it. Provider-specific flags (e.g., `--permission-mode bypassPermissions`) must live in the adapter layer, not the Company Runtime.

**Always-running autonomous employee processes.** Employees are invoked by the Company Runtime through AgentRunner; they do not run continuously. V1 does not include persistent background agents that independently poll for work.

**`claude -p` as free or always available.** V1 execution costs are real and provider-specific. The architecture does not assume `claude -p` usage is covered by a consumer subscription or always available. Execution cost is an adapter-level concern, not a runtime assumption.

---

## 13. Technology Strategy and Phasing

This section documents the agreed implementation strategy for the Engineering OS platform. It exists to prevent premature adoption of complex infrastructure and to protect V1 scope.

### V1 Technology Stack

| Component | Decision |
|---|---|
| Application framework | Next.js (full-stack) |
| Authentication | Clerk |
| Primary database | PostgreSQL |
| ORM | Prisma |
| Runtime event queue | DB-backed event table in PostgreSQL |
| Execution model | Local Worker process |
| Execution engines | Provider-independent adapters (Claude Code as initial adapter) |
| Memory | Structured relational records; PostgreSQL |
| Semantic retrieval | Not in V1; schema designed to support it |
| Workflow engine | None required; Company Runtime owns orchestration |

### V1 Scope: What Is Required

- Company Runtime (orchestration, scheduling, dispatch, state, retry, cancellation, escalation, persistence, notifications, memory, event routing)
- AgentRunner (generic employee invocation)
- Context Builder (context assembly before each invocation)
- Local Worker model (polls DB event table, claims events, delegates to AgentRunner)
- Execution Adapter interface (provider-independent contract)
- Interactive execution mode (user can observe execution in real time)
- Structured memory records (relational, PostgreSQL)
- Employee handbook and role definitions used in context assembly

### V1.5 Additions (Planned)

- Background execution workers (run without active user session)
- Execution Adapter registry with per-company and per-employee configuration
- Improved runtime dispatch with retry policies and backoff
- Provider configuration UI per company
- First semantic retrieval experiments with pgvector

### V2 Additions (Deferred)

- pgvector production semantic recall (hybrid relational + semantic retrieval)
- Deeper repository Knowledge Graph traversal
- Advanced automation modes
- Durable workflow engine evaluation if product scale justifies it (Temporal or equivalent)
- Graph-based reasoning evaluation if product needs require it

### Deferred Indefinitely (Until Justified)

- Separate backend service (unless Next.js full-stack demonstrates a concrete limitation)
- Separate vector database (pgvector inside PostgreSQL is the correct path)
- LangGraph or equivalent as the core runtime (Company Runtime owns orchestration)
- Temporal or equivalent as the core runtime (Worker + event table is the V1 model)

---

## 14. Technical Risks  

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Repository analysis produces poor or incomplete memory for complex codebases | High | High | Scope the initial analysis to a defined set of signals (folder structure, framework detection, dependency list, pattern heuristics); make CEO confirmation step robust so poor initial memory can be corrected |
| Long-running SOP executions lose state across system restarts | Medium | High | Derive all state from the Event log; ensure SOP state is reconstructible; never rely on ephemeral in-memory state for durability |
| Quality output variance — the company produces inconsistent review or QA outputs | High | High | Structured SOPs with defined gate conditions are the primary mitigation; the gate conditions catch poor outputs before they advance |
| The conversation interface fails to classify ambiguous goals | Medium | Medium | Default to CTO routing for unclassifiable goals; ask one focused clarification question rather than failing silently |
| Memory retrieval context window — relevant memory exceeds what can be provided as context | Medium | High | Implement memory scoring/ranking; rank by recency, relevance, and scope; do not attempt to provide all memory for every decision |
| Autonomy level enforcement gaps — gates bypass in edge cases | Low | Critical | Autonomy level enforcement is implemented in the Execution module as a first-class concern; all gate transitions must check autonomy level before proceeding |
| Deployment coordination timing — the company cannot reliably coordinate timing across async operations | Medium | Medium | Use event-based coordination throughout; never rely on timing assumptions; every handoff is an explicit Event |

---

## 15. Product Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The core workflow takes too long and the CEO loses confidence | Medium | High | Set accurate time expectations during planning ("this feature is estimated at 3 hours"); surface meaningful progress updates during execution |
| The company asks too many clarification questions | Medium | Medium | Strict rules on when clarification is acceptable (see COMPANY_RUNTIME.md §8); memory and repository knowledge should answer most questions the company would otherwise ask |
| The CEO experience feels like AI, not a company | Medium | High | Employee names, structured communication format, and organizational framing in every response; explicit product investment in organizational language |
| The memory system fills with low-quality records that hurt rather than help | Medium | Medium | Scope memory writes to significant events; Technical Writer curation escalates to Knowledge; CEO annotation allows correction |
| First-time users don't understand what to say to the company | High | Medium | Example goals in the conversation interface; company responds to vague goals with a focused proposal rather than asking for more detail |
| V1 requires too much user setup before the value is clear | Medium | High | Two-choice onboarding (autonomy + culture), repository connection, done; the company should feel ready within 15 minutes |

---

## 16. Validation Strategy

### Pre-Ship Validation

Before V1 ships, the following scenarios must be end-to-end validated by a tester who plays the role of CEO:

**Scenario 1: First-time use**
- New account
- Repository connected
- Architecture summary confirmed
- Goal submitted: "Add email notifications when a user's password is changed"
- Feature Brief received and approved
- Task list reviewed on Dashboard
- Implementation completes
- Review passes
- QA passes
- Documentation ready
- Release approved
- Production deployment confirmed stable
- Memory updated
- Second goal submitted: "Add a notification preferences page"
- Confirm second Feature Brief references memory from first feature

**Scenario 2: Defect handling**
- Trigger a scenario where QA finds a defect
- Confirm defect is routed internally, fixed, and re-validated
- CEO is not involved in defect resolution
- CEO receives QA Go notification when defects are resolved

**Scenario 3: Approval flows**
- Test at each autonomy level: Manual, Assist, Delegate, Autonomous
- Confirm correct gates are paused at each level
- Confirm CEO receives correct notifications at each level

**Scenario 4: Blocked work**
- Trigger a blocked task
- Confirm CEO receives an appropriate notification (plain language, not technical detail)
- Confirm the company attempts resolution before surfacing to CEO

**Scenario 5: Post-release monitoring**
- Confirm monitoring window is observed post-deployment
- Confirm Release Manager declares stability appropriately

### Post-Ship Validation

The following metrics are monitored after V1 ships:

- Feature completion rate (target: >85%)
- Time-to-first-feature (target: <24 hours)
- CEO approval intervention rate (target: declining trend)
- Memory utilization rate in second feature (target: >70% of decisions reference first-feature memory)
- Post-release defect rate (target: <5%)

---

## 17. Release Strategy

### V1 Release Approach

V1 ships to a closed beta group of technical founders. Access is invitation-only. Beta users are selected to represent the primary target user (technical founders with existing codebases, 1–3 person teams).

The goal of the closed beta is to validate the core workflow with real users and real codebases before open access.

**Beta selection criteria:**
- Has an existing codebase (not greenfield)
- Is the primary engineer on their product
- Is willing to provide structured feedback after each feature they submit
- Has a codebase in a supported repository hosting platform

### Beta Success Gate

The closed beta proceeds to open access when:
- 5 distinct beta users have each shipped at least one complete feature end-to-end
- Feature completion rate is >80% across all beta attempts
- No critical production incidents in beta (P0/P1 incidents in the product's own infrastructure)
- Post-release defect rate <5% for beta-shipped features

### V1 General Availability

After the beta success gate is cleared, V1 is released to general access with:
- Public landing page
- Self-serve account creation
- Documentation covering: what Engineering OS is, how to connect a repository, how to submit a goal, what to expect

---

## 18. What Ships in V1

This is the complete list of what V1 includes.

**Product surfaces:**
- Company Dashboard (F-01) — live view of company activity
- Goal Input Interface (F-02) — natural language conversation with the company
- Employee Status Feed (F-03) — what each employee is doing
- Work Item Tracking (F-04) — features, projects, tasks, reviews, QA, releases
- Company Memory (F-05) — browsable, searchable, CEO-annotatable
- Autonomy Controls (F-06) — Manual / Assist / Delegate / Autonomous
- Culture Configuration (F-07) — Startup / Enterprise / Design-First / Performance-First
- Repository Onboarding (F-08) — connect, analyze, summarize, confirm
- SOP Engine (F-09) — New Feature, Bug Fix, Code Review, QA Validation, Release, Rollback
- Notifications and Approvals (F-10) — filtered, prioritized, actionable

**Employees active in V1:**
- CTO, Product Manager, Technical Writer, Tech Lead, Frontend Engineer, Backend Engineer, AI Engineer, Infrastructure Engineer, Reviewer, QA Engineer, Security Engineer, DevOps Engineer, Release Manager, Monitoring Engineer

**SOPs active in V1:**
- SOP-001: New Feature
- SOP-002: Bug Fix
- SOP-003: Code Review (embedded in New Feature Phase 4)
- SOP-004: QA Validation (embedded in New Feature Phase 5)
- SOP-005: Release
- SOP-006: Rollback

**Memory types active in V1:**
- Repository Memory
- Feature Memory
- Company Memory (architecture, coding standards, decisions, patterns, business rules)
- Conversation Memory (session-scoped)

---

## 19. What Moves to V2

These are confirmed directions for V2. They are not deferred due to uncertainty — they are deferred due to scope discipline.

| Feature | Rationale for V2 Timing |
|---|---|
| Multi-repository support | Requires routing and memory changes beyond V1 architecture |
| Employee hiring and customization | Requires a hiring UX and configuration model not designed for V1 |
| Employee learning and promotion | Requires sustained performance data to be meaningful |
| Multi-stakeholder companies | Requires trust model and conflict resolution for multiple CEOs |
| Growth Department (SEO, Analytics, Marketing) | Roles defined; workflows not designed for V1 |
| External tool integrations (Stripe, Datadog, Slack) | Integration module exists; external-specific workflows are V2 |
| Company health benchmarking | Requires sufficient company population |
| Knowledge Graph visualization | Data exists; visual product surface is V2 |
| Mobile Engineer | Role defined in organization; iOS/Android workflow is V2 |
| Non-technical founder experience improvements | Requires V1 learning on what non-technical users struggle with |
| Public API | Requires stable internal API contracts, which V1 is establishing |

---

## 20. What Is Intentionally Postponed

Some items are not V2 commitments — they are genuinely open questions that will be resolved based on what V1 teaches.

**Greenfield project creation**  
V1 assumes an existing repository. Building a new repository from scratch requires a different initial experience. V1 will teach how users think about this; V2 may address it.

**Autonomy recommendations**  
The product may eventually recommend autonomy level upgrades based on company history and trust signals. The data model supports it; the recommendation logic requires V1 maturity data.

**Employee performance visibility**  
Performance metrics are defined in the Domain Model. The V1 question is whether CEOs want to see them, and at what level of detail. This is a V2 UX problem informed by V1 usage.

**CEO feedback on employee outputs**  
Can the CEO provide feedback on a Feature Brief and have that feedback change how the Product Manager operates in the future? The Learning Engine architecture supports it; the V1 implementation focuses on the core workflow.

**Incident escalation automation**  
The Monitoring Engineer can detect and create work items automatically. V1 implements this as a manual trigger from the Monitoring Engineer; V2 may automate based on signals.

---

## 21. Recommended Implementation Order

This is the recommended build sequence within V1. It optimizes for demonstrating value as early as possible and de-risking the most uncertain components first.

### Build sequence

**1. Data Model and Persistence Layer**  
Implement the schema for all V1 domain objects as defined in DOMAIN_MODEL.md. This is the first dependency for everything else. Include the Event table with append-only constraints.

**2. Identity and Company Provisioning**  
User registration, authentication, Company creation, default employee roster provisioning. Validates that the organizational model can be instantiated.

**3. Repository Connection and Analysis**  
Repository connection, credential storage, analysis workflow, Repository Memory population, architecture summary. This is the first meaningful external integration and should be validated early.

**4. SOP Engine Core**  
The Execution module's SOP engine — phase tracking, gate evaluation, autonomy level enforcement. This is the most critical internal system. Validate with a stub workflow before connecting real employees.

**5. Conversation Interface and Planning**  
Goal input, request classification, Product Manager Feature Brief workflow, CTO feasibility review, CEO approval. The first CEO-visible functionality.

**6. Task Decomposition and Execution**  
Tech Lead task creation, engineer assignment, implementation phase, Delivery Readiness gate. The first demonstration of the company doing work.

**7. Code Review and Security Review**  
Reviewer workflow, finding classification, Security Engineer workflow. Quality gate #1.

**8. QA Validation**  
QA Engineer workflow, Test Plan, defect reporting, go/no-go recommendation. Quality gate #2.

**9. Release Coordination**  
Release Readiness Checklist, deployment coordination, monitoring window, stable declaration. The first end-to-end completion.

**10. Memory and Documentation**  
Feature Memory update, Technical Writer documentation, Knowledge Records, Timeline entries. Validates the compounding asset.

**11. Dashboard and Notifications**  
Company Runtime aggregation, live activity view, notification filtering, approval requests. The CEO experience layer on top of the working system.

**12. Bug Fix SOP**  
Second SOP — validates that the SOP engine generalizes, not just the New Feature path.

**13. Rollback SOP**  
Production safety net. Required before any external users are added.

**14. End-to-End Validation**  
Full Critical User Journey test per §15. Required before beta access is granted.

---

## Relationship to Other Architecture Documents

- **DOMAIN_MODEL.md** defines all objects this roadmap builds.
- **INFORMATION_ARCHITECTURE.md** defines the product surfaces this roadmap delivers.
- **TECHNICAL_ARCHITECTURE.md** defines the module boundaries this roadmap implements.
- **COMPANY_RUNTIME.md** defines the runtime behaviors this roadmap produces.
- **PRODUCT_REQUIREMENTS.md** defines the features this roadmap is organized around (F-01 through F-10).
- **docs/sops/*.md** define the specific workflows the SOP engine must execute.
