# Product Requirements Document — Engineering OS

**Status:** Approved for Development  
**Version:** 1.0  
**Owner:** Product Manager  
**Approved By:** CEO  
**Last Updated:** 2026-06-26  

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Target Customer](#3-target-customer)
4. [Value Proposition](#4-value-proposition)
5. [Competitive Differentiation](#5-competitive-differentiation)
6. [Product Vision](#6-product-vision)
7. [Product Principles](#7-product-principles)
8. [User Personas](#8-user-personas)
9. [Core Use Cases](#9-core-use-cases)
10. [Primary User Journey](#10-primary-user-journey)
11. [Product Scope](#11-product-scope)
12. [V1 Features](#12-v1-features)
13. [V2 Ideas](#13-v2-ideas)
14. [Explicit Non-Goals](#14-explicit-non-goals)
15. [Success Metrics](#15-success-metrics)
16. [Constraints](#16-constraints)
17. [Risks](#17-risks)
18. [Assumptions](#18-assumptions)
19. [Glossary](#19-glossary)
20. [Open Questions](#20-open-questions)

---

## 1. Product Overview

### What is Engineering OS?

Engineering OS is the world's first virtual software company.

It is not an AI coding assistant. It is not a project management tool. It is not a code editor or a developer IDE. It is a complete, structured engineering organization that a user hires to build software on their behalf.

When a user subscribes to Engineering OS, they become the CEO of a fully staffed virtual company. That company employs a Product Manager, a Tech Lead, Frontend and Backend Engineers, a QA Engineer, a Code Reviewer, a Security Engineer, a DevOps Engineer, a Release Manager, a Monitoring Engineer, a Technical Writer, and several other specialists. Each employee has a defined identity, a specific area of responsibility, persistent memory, and a commitment to the company's standards.

The user communicates goals. The company figures out everything else.

**Before Engineering OS:**

```
User → thinks about requirements
User → creates tickets in Linear
User → assigns work
User → writes code in Cursor
User → reviews their own work
User → runs CI
User → deploys
User → monitors
User → writes documentation
User → closes tickets
```

Every step requires the user to act as an engineer, a project manager, and a DevOps specialist simultaneously.

**With Engineering OS:**

```
User → "Add subscriptions."
Engineering OS → ships subscriptions.
```

The user communicates outcomes. The company delivers them.

### Why Does It Exist?

Software development has become extraordinarily tool-heavy. A modern developer team uses Slack for communication, Linear for tickets, GitHub for code, Cursor or an IDE for implementation, Claude Code for AI assistance, Vercel for deployment, Datadog for monitoring, and dozens of other tools. The human brain serves as the integration layer between all of them.

This is not a tooling problem. It is an organizational problem.

The real bottleneck in software development is not writing code — it is coordinating the people and processes required to produce and ship quality software. AI tools have dramatically reduced the cost of writing code. But nobody has reorganized the entire process around that capability shift.

Engineering OS reorganizes the entire process. It replaces tool coordination with organizational delegation. The user stops managing tools and starts managing outcomes.

---

## 2. Problem Statement

### The Core Problem

Individual developers and small teams spend the majority of their time on coordination overhead rather than value creation:

- Translating goals into tasks
- Assigning and tracking work
- Switching between tools
- Reviewing code
- Managing deployments
- Writing documentation
- Monitoring production

This overhead scales linearly with team size. As a team grows, coordination costs grow proportionally — which is why most software organizations plateau in productivity despite increasing headcount.

### Who Experiences This Problem

**Solo developers and indie founders** carry the entire coordination burden alone. They are simultaneously engineer, product manager, QA, DevOps, and documentation writer. This forces constant context switching and caps how much software they can produce.

**Small technical teams** (2–10 engineers) spend a disproportionate fraction of their time on process rather than product. A 5-person startup may dedicate the equivalent of 1.5 full-time roles to coordination that produces no direct user value.

**Non-technical founders and operators** who want to build software cannot participate effectively in the development process at all. They lack the vocabulary and context to direct engineers, review pull requests, or understand deployment pipelines. Their role is permanently peripheral.

### What Is Not the Problem

The problem is not that engineers write code slowly. Modern AI tools have largely addressed code generation speed. The problem is that fast code generation without organizational infrastructure creates low-quality, inconsistent, undocumented software that is hard to maintain and nearly impossible to scale.

Engineering OS does not compete with tools that make coding faster. It competes with the organizational model that requires coding to be the user's problem at all.

---

## 3. Target Customer

### Primary Segment: Technical Founders Building Products

**Who:** Founders of software-based businesses who have engineering backgrounds but are bottlenecked by the operational overhead of software development rather than the technical capability.

**What they need:** A way to delegate execution without losing quality, visibility, or control over what gets built.

**Why Engineering OS:** They can communicate goals in plain terms and trust that the company will produce high-quality, production-ready software without needing to micromanage every implementation detail.

### Secondary Segment: Non-Technical Founders and Operators

**Who:** Business leaders, product thinkers, and domain experts who want to build software but cannot effectively direct a traditional development team or AI coding tool.

**What they need:** A product that translates their business intent into working software without requiring them to learn engineering vocabulary, tools, or processes.

**Why Engineering OS:** The user interface is goals and outcomes, not technical instructions. A non-technical CEO can say "build me a customer portal" and the company handles the architecture, implementation, review, testing, and deployment.

### Tertiary Segment: Small Engineering Teams Seeking Organizational Leverage

**Who:** Teams of 2–10 engineers at early-stage startups who want to punch above their weight by augmenting their capacity with specialist roles they cannot afford to hire.

**What they need:** A code reviewer, a QA engineer, a security engineer, and a release manager — roles that are essential but too expensive to hire at early stage.

**Why Engineering OS:** They get the organizational depth of a 20-person engineering company at a fraction of the cost, with specialists who bring domain expertise to every task.

### Who Is Not the Target Customer

- Large enterprise engineering organizations with established processes and full staffing
- Developers who primarily want a faster code completion tool
- Teams whose bottleneck is computing infrastructure rather than engineering coordination
- Users building non-software products

---

## 4. Value Proposition

### Core Value

Engineering OS gives users an elite software engineering organization that they can direct toward any goal — without hiring, onboarding, managing, or motivating a single person.

### The CEO Experience

Every interaction with Engineering OS should reinforce one experience: the user is a CEO. Not a developer. Not a prompt engineer. Not a product manager. A CEO whose job is to define what matters and approve what gets shipped.

This experience is not cosmetic. It is structural. The company has a real organizational hierarchy. Employees have real responsibilities. Work follows real processes. Memory persists across projects. The company improves over time.

### Why Users Pay For It

**Time reduction.** Tasks that require hours of coordination, context switching, and implementation complete without user involvement.

**Quality assurance.** Every piece of work passes through code review, security validation, QA testing, and documentation — processes most small teams skip because they are too expensive to maintain.

**Organizational depth.** Users get access to specialist expertise — security engineers, QA engineers, release managers, technical writers — that is prohibitively expensive to hire directly.

**Memory and continuity.** The company remembers everything: architectural decisions, past implementations, coding standards, business rules. New projects benefit from accumulated organizational knowledge rather than starting from scratch.

**Confidence.** Users can approve deployments knowing that a structured review, testing, and release process has already been executed. They are not trusting a single AI output — they are trusting an organizational process.

---

## 5. Competitive Differentiation

Engineering OS occupies a category that does not currently exist. The following analysis explains why existing tools do not solve the same problem.

### Linear / Jira — Project Management Tools

**What they do:** Track work items. Manage backlogs. Report progress.  
**What they don't do:** Execute work. Create plans from goals. Review or ship anything.  
**Relationship:** Engineering OS can use a project management tool internally. The user of Engineering OS never needs to open one.

### GitHub — Code Hosting and Collaboration

**What it does:** Stores code. Manages pull requests. Runs CI.  
**What it doesn't do:** Write code. Plan features. Review for intent, not just syntax.  
**Relationship:** Engineering OS operates on top of GitHub (or equivalent). The user of Engineering OS never needs to manage branches, PRs, or CI configuration.

### Cursor / GitHub Copilot — AI Coding Assistants

**What they do:** Accelerate code writing within an IDE. Autocomplete and suggest implementations.  
**What they don't do:** Plan features. Assign work. Review, test, or deploy. Maintain organizational memory.  
**Relationship:** These tools make an individual developer faster. Engineering OS replaces the individual developer model entirely.

### Claude Code / ChatGPT — AI Assistants

**What they do:** Answer questions and generate content in response to prompts. Can write code when instructed.  
**What they don't do:** Operate as an organization. Maintain persistent identity and memory across sessions. Follow structured workflows. Enforce quality gates.  
**Relationship:** Engineering OS is powered by AI internally. The user never prompts an AI — they delegate to an employee.

### Devin / SWE-agent — Autonomous Coding Agents

**What they do:** Attempt to autonomously complete coding tasks given a specification.  
**What they don't do:** Provide organizational structure. Maintain persistent memory. Support multiple specialist roles. Support configurable autonomy. Enforce quality gates before shipping.  
**Relationship:** Autonomous coding agents are single-role (one engineer) with no organizational wrapper. Engineering OS is an entire company. The quality, safety, and reliability guarantees are fundamentally different.

### The Differentiation Summary

| Capability | Linear | GitHub | Cursor | Claude Code | Devin | Engineering OS |
|---|---|---|---|---|---|---|
| Goal-to-execution without user coding | ✗ | ✗ | ✗ | Partial | Partial | ✓ |
| Multi-role organizational structure | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Persistent memory across projects | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Configurable autonomy level | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Structured quality gates (review, QA, security) | ✗ | Partial | ✗ | ✗ | ✗ | ✓ |
| Company culture configuration | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| CEO experience (outcome-only interface) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Provider-independent execution engines | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Work history survives model/provider changes | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Interactive and background execution modes | ✗ | ✗ | ✗ | ✗ | Partial | ✓ |

**Positioning clarification:**

Engineering OS is not:
- A Claude Code wrapper
- A Codex wrapper
- A LangGraph application
- A generic AI chat interface
- A simple issue tracker
- A vector-search knowledge base

Engineering OS is the company runtime, organizational memory system, task and workflow layer, and CEO experience. Execution engines are the workers it directs — not the product itself.

---

## 6. Product Vision

Engineering OS exists to become the organizational layer on top of AI — the structure that transforms raw AI capability into a reliable, trustworthy, continuously improving software company.

In the long term, a founder should be able to say:

> Build me a platform where pet owners can book veterinary appointments.

And the company should:

- Create the Product Requirements
- Design the architecture
- Build the roadmap
- Break the work into tasks
- Assign engineers
- Implement all features
- Review every line of code
- Run full QA validation
- Deploy to production
- Monitor the live system
- Write and maintain documentation
- Suggest future improvements

The founder becomes the CEO of a software company that never sleeps, never loses context, and continuously improves.

---

## 7. Product Principles

These principles govern every product decision. When choices conflict, earlier principles take precedence.

### 1. The User Is Always the CEO

The product protects the user from implementation details in every interaction. The user approves outcomes. The company executes them. If the user is being asked to make an implementation decision, the product has failed.

### 2. The Company, Not the AI, Is the Product

Users should never be aware of the underlying models or prompts. The experience is organizational. The value is organizational. The trust the user builds is with the company, not with AI technology.

### 3. Quality Gates Are Non-Negotiable

Every piece of work that ships passes through a structured review, testing, and release process. The product does not allow shortcuts that bypass these gates. The quality process is a competitive advantage — it is why users trust Engineering OS with production deployments.

### 4. Memory Makes the Company Better Over Time

Every project teaches the company something. Architectural decisions, coding standards, business rules, past mistakes — all of this accumulates in company memory. A company that has been used for six months should visibly outperform the same company on its first day. Memory is the compounding asset.

### 5. Autonomy Is Configurable, Not Assumed

Not every user wants full autonomy. Some want to review every change before it merges. Others want the company to ship independently. The product supports the full spectrum and defaults to a level appropriate for the user's trust level with the company.

### 6. Employees Are Specialists, Not Generalists

Every employee has a defined domain and enforces the boundaries of that domain. A Frontend Engineer never makes backend architectural decisions. A Code Reviewer never approves security exceptions. Specialization produces better outcomes than generalism.

### 7. The Experience Should Feel Alive Without Being Theatrical

The company behaves professionally, precisely, and constructively. Employees communicate with appropriate confidence. The product does not overclaim, add unnecessary ceremony, or personify employees beyond what adds value.

### 8. Execution Engines Are Configurable Infrastructure, Not the Product

Engineering OS is the company runtime, memory system, task and workflow layer, and CEO experience. Execution engines — Claude Code, Codex CLI, Gemini CLI, API providers, local models — are replaceable infrastructure that perform work when the Company Runtime invokes them.

This distinction is a product principle, not just an architecture preference. Users choose their execution engines based on cost, quality, privacy, and workflow needs. The company — its memory, employees, organizational history, and standards — persists regardless of which engine is in use. Work history survives model and provider changes because it is stored as durable company artifacts, not inside any AI model's session.

Provider independence is a competitive advantage and a trust property. A user who has built six months of company memory should never lose it because a model provider changes pricing, availability, or terms.

---

## 8. User Personas

### Persona 1: The Technical Founder (Primary)

**Name:** Alex  
**Role:** Founder and CEO of an early-stage SaaS company  
**Engineering background:** Strong individual contributor who has been the primary engineer for 2 years  
**Team size:** 1–3 people  

**Current situation:**  
Alex spends 60% of their time on engineering execution — writing code, reviewing their own work, managing deployments, writing documentation. They spend 40% on the business. They want to invert this ratio.

**Frustrations:**  
- Every feature requires them to context-switch into implementation mode
- Nothing ships without them personally touching every part of it
- They cannot take a week off without engineering stalling
- Documentation is always behind
- Security reviews never happen

**What they want from Engineering OS:**  
To say "build billing" once and come back to a production-ready billing system with documentation, passing tests, and a clean deployment — without touching a single file.

**Success indicator:**  
Alex can run the company for a week without opening their IDE.

---

### Persona 2: The Non-Technical Founder (Secondary)

**Name:** Jordan  
**Role:** CEO of a pre-product startup  
**Engineering background:** None  
**Team size:** 0 engineers (Jordan has been using contractors)

**Current situation:**  
Jordan has a product vision and domain expertise but cannot effectively direct engineering work. Contractors produce inconsistent output. Jordan cannot evaluate code quality, enforce standards, or ensure anything is production-ready.

**Frustrations:**  
- Cannot tell whether code is good or bad
- Has no way to enforce consistency across contractors
- Documentation never exists
- Features take longer than expected and rarely match the original intent
- "Done" from an engineer often means "it works on my machine"

**What they want from Engineering OS:**  
To communicate product goals in plain language and trust that what gets built is production-quality, consistent, and documented.

**Success indicator:**  
Jordan ships a working product to early customers without hiring a full-time engineer.

---

### Persona 3: The Small Team Lead (Tertiary)

**Name:** Sam  
**Role:** CTO of a 5-person startup  
**Engineering background:** Principal engineer with 8 years of experience  
**Team size:** 4 engineers

**Current situation:**  
Sam's team moves fast but skips quality processes because they cannot afford specialists. No dedicated code reviewer. No QA engineer. No security audit. No release manager. The team ships frequently but accumulates technical debt and occasionally ships bugs to production.

**Frustrations:**  
- Code review is perfunctory because there's nobody whose job it is
- Security gets ignored until something breaks
- Documentation is written by nobody
- Deployments are stressful because there's no process
- New engineers can't get up to speed because there's no organizational memory

**What they want from Engineering OS:**  
Specialist roles that fill the organizational gaps — a dedicated reviewer, a QA engineer, a security engineer, and a release manager — integrated into their existing workflow.

**Success indicator:**  
Sam's team's defect escape rate drops by 50% in three months and deployments become predictable.

---

## 9. Core Use Cases

### Use Case 1: New Feature Development

**Trigger:** The user states a goal — "Add dark mode" or "Build a customer dashboard."

**Expected outcome:** The feature is planned, implemented, reviewed, tested, documented, and deployed to production without the user writing code or managing any intermediate step.

**Company behavior:**
1. Product Manager creates a Feature Brief with acceptance criteria
2. CTO reviews for technical feasibility
3. Tech Lead decomposes into tasks and assigns to engineers
4. Engineers implement
5. Reviewer performs code review
6. Security Engineer validates where applicable
7. QA Engineer validates against acceptance criteria
8. Release Manager coordinates deployment
9. Technical Writer updates documentation
10. Product Manager closes the feature with memory update

**User touchpoints:** Approve the goal. Optionally review the Feature Brief. Approve the final deployment (if autonomy level requires it).

---

### Use Case 2: Bug Fix

**Trigger:** A defect is reported — by the user, detected by the Monitoring Engineer, or found during QA.

**Expected outcome:** The defect is classified, root-caused, fixed, validated, and deployed. The fix is not just a patch — it addresses the underlying cause and is covered by a regression test.

**Company behavior:** Follows Bug Fix SOP (SOP-002). Tech Lead classifies severity. Assigned engineer investigates and fixes. Reviewer validates the fix. QA validates in staging. Release Manager deploys.

**User touchpoints:** Informed of critical issues. Approves deployment for Critical severity fixes.

---

### Use Case 3: Repository Onboarding

**Trigger:** The user connects an existing codebase to Engineering OS.

**Expected outcome:** The company understands the repository — its architecture, patterns, dependencies, conventions, and technical debt — and builds a working knowledge base that informs all future work.

**Company behavior:** CTO and Tech Lead analyze the repository. Architecture, naming conventions, dependency choices, and known issues are recorded in company memory. Future tasks reference this knowledge automatically.

**User touchpoints:** Reviews the company's understanding of the repository. Corrects misunderstandings.

---

### Use Case 4: Production Incident Response

**Trigger:** Monitoring Engineer detects an anomaly in production.

**Expected outcome:** The incident is classified, diagnosed, mitigated (rollback if needed), root-caused, and documented — with a follow-up improvement plan.

**Company behavior:** Follows Rollback SOP (SOP-006) if needed. Monitoring Engineer classifies severity and notifies the Release Manager and CTO. Tech Lead leads root cause analysis. Post-incident review produces process improvements.

**User touchpoints:** Notified of P0/P1 incidents immediately. Receives a root cause summary and improvement plan.

---

### Use Case 5: Security Audit

**Trigger:** User requests a security review, or a scheduled security audit is triggered.

**Expected outcome:** A structured security assessment of the repository is produced, covering authentication, authorization, dependencies, secrets management, and vulnerability exposure. High-priority findings are immediately turned into work items.

**Company behavior:** Security Engineer leads the assessment. CTO reviews. Tech Lead creates remediation tasks. Engineering implements. Security Engineer validates.

**User touchpoints:** Reviews the security assessment summary. Approves remediation priorities.

---

### Use Case 6: Documentation Update

**Trigger:** A feature ships, an API changes, or the user requests documentation coverage.

**Expected outcome:** Documentation is written, reviewed for accuracy, and published — without the user writing a single sentence.

**Company behavior:** Technical Writer drafts documentation. The relevant engineer validates for technical accuracy. Product Manager validates for user framing. Published as part of the release.

**User touchpoints:** Reviews documentation for significant features before publication if desired.

---

## 10. Primary User Journey

This is the canonical V1 user experience — from first interaction to first shipped feature.

### Step 1: Account Creation and Company Setup

The user creates an account and is assigned their company. The company is pre-staffed with V1 employees: CTO, Product Manager, Tech Lead, Frontend Engineer, Backend Engineer, QA Engineer, Reviewer, Security Engineer, DevOps Engineer, Release Manager, Monitoring Engineer, Technical Writer.

The user selects:
- Autonomy level (Manual → Assist → Delegate → Autonomous)
- Company culture profile (Startup / Enterprise / Design-First / Performance-First)

### Step 2: Repository Connection

The user connects their repository. The CTO and Tech Lead analyze the codebase and build the initial repository memory. The company produces a brief architecture summary for the user's review.

### Step 3: First Goal

The user states their first goal in plain language:

> "I want users to be able to reset their password."

### Step 4: Planning

The Product Manager creates a Feature Brief. The CTO reviews for technical feasibility. The Tech Lead decomposes into tasks. The user receives a summary: "Your team has planned 4 tasks for this feature. Estimated completion: 6 hours."

### Step 5: Execution

The company works. The user can observe progress — which employee is working on what, what has been completed — but does not need to intervene. The experience is a live feed of organizational activity, not a log of AI prompts.

### Step 6: Review and Quality

The Reviewer performs code review. Security Engineer validates the password reset flow for authentication risks. QA Engineer validates against the acceptance criteria. Any defects are fixed and re-validated.

### Step 7: Release

The Release Manager confirms readiness: QA go recommendation is in, documentation is ready, rollback is prepared. The user receives a notification: "Your feature is ready for release." The user approves (if autonomy level requires it) or the company deploys automatically.

### Step 8: Post-Release

The Monitoring Engineer watches the deployment. Documentation is published. Company memory is updated. The feature is closed.

The user's next interaction: "Add dark mode."

---

## 11. Product Scope

### In Scope for V1

- Single-user companies (one CEO per company)
- Single active repository per company
- Core employee roster: CTO, Product Manager, Tech Lead, Frontend Engineer, Backend Engineer, QA Engineer, Reviewer, Security Engineer, DevOps Engineer, Release Manager, Monitoring Engineer, Technical Writer
- Feature development workflow (New Feature SOP)
- Bug fix workflow (Bug Fix SOP)
- Code review workflow (Code Review SOP)
- QA validation workflow (QA Validation SOP)
- Release workflow (Release SOP)
- Rollback workflow (Rollback SOP)
- Company memory: architecture, coding standards, decisions, patterns
- Repository memory: structure, dependencies, conventions
- Feature memory: what was built, why, how
- Conversation interface: CEO communicates via natural language
- Company dashboard: live view of company activity
- Autonomy level configuration
- Company culture configuration

### Deferred to Later

- Multi-user companies (multiple CEOs / stakeholders)
- Multiple concurrent repositories
- Mobile Engineer
- Product Analyst
- Analytics Specialist
- Marketing Specialist
- Hiring and customization of employees
- Employee promotions and seniority levels
- Growth department (SEO, Analytics, Marketing) workflows
- External tool integrations (Stripe, Datadog, etc.)
- Public API
- White-label / multi-tenant

---

## 12. V1 Features

### F-01: Company Dashboard

**What it is:** The primary interface. Shows the live state of the company — what each employee is working on, recently completed work, upcoming tasks, and company health indicators.

**Acceptance criteria:**
- User sees a real-time view of active work by employee
- User can see which SOP phase each active work item is in
- Company health metrics are visible: security score, documentation coverage, technical debt level, deployment stability
- User can navigate from the dashboard to any active work item for detail

**Why it matters:** This is the product's emotional core. Opening Engineering OS should feel like arriving at work and seeing an active engineering team. It replaces the need for standup.

---

### F-02: Goal Input Interface

**What it is:** The primary way the CEO communicates with the company. A natural language interface where the user states goals and the company responds with a plan.

**Acceptance criteria:**
- User can state any goal in natural language
- Company responds with a structured plan (Feature Brief summary) within a reasonable time
- User can approve, modify, or reject the plan before execution begins
- User does not need to select which employee handles the request — the company routes internally

**Why it matters:** This is the product's differentiating interface. Every other product in the market requires the user to create a task, assign it, and specify how it should be done. Engineering OS requires only the goal.

---

### F-03: Employee Status Feed

**What it is:** A visible representation of what each employee is currently doing, what they have completed, and what they are next assigned.

**Acceptance criteria:**
- Each employee shows current activity: "Working on: Payment API endpoint" or "Reviewing: Password Reset PR"
- Completed work is recorded with timestamps
- User can view any employee's recent history
- Employees communicate status in first person with the company's communication style

**Why it matters:** The product's core promise is that users have a team working for them. This feature makes that promise tangible.

---

### F-04: Work Item Tracking

**What it is:** The internal system that tracks all work items — features, tasks, bugs, reviews, QA validations, and releases — through their lifecycle.

**Acceptance criteria:**
- Every work item is visible to the CEO
- Work items show: status, owner, created date, estimated completion, current phase, and history
- Work items reference the SOP phase they are in
- CEO can comment on any work item
- CEO receives notifications for items requiring their approval

**Why it matters:** Transparency and control. The CEO should always be able to see what the company is doing and why.

---

### F-05: Company Memory

**What it is:** The persistent organizational knowledge base that spans all projects and retains architectural decisions, coding standards, business rules, past features, and employee learnings.

**Acceptance criteria:**
- Architecture decisions are recorded automatically when made during feature development
- Coding standards are captured from the repository during onboarding and updated over time
- Feature memory records what was built, the acceptance criteria as shipped, and key decisions
- Company memory is referenced automatically by employees when performing new work
- CEO can browse and search company memory
- CEO can annotate or correct memory records

**Why it matters:** This is the product's primary compounding asset. Every project makes the company smarter. Companies that have used Engineering OS for a year should demonstrably outperform new companies.

---

### F-06: Autonomy Controls

**What it is:** Company-level settings that define how much authority the company has to act without CEO approval.

**Levels:**
- **Manual:** Company plans and recommends; CEO approves every action
- **Assist:** Company implements; CEO approves before any code is merged
- **Delegate:** Company completes features end-to-end; CEO approves before deployment
- **Autonomous:** Company operates independently; CEO receives summaries

**Acceptance criteria:**
- Autonomy level is visible and configurable in company settings
- Approval requests reach the CEO at the correct points in each workflow
- Approval requests include a concise summary of what is being approved and why
- CEO approvals are recorded in the work item history

**Why it matters:** Trust is built incrementally. New users need more control. Experienced users with high-confidence companies should be able to delegate completely.

---

### F-07: Culture Configuration

**What it is:** Company-level settings that configure the values and priorities the entire company operates under.

**Profiles:**
- **Startup:** Move quickly, accept calculated technical debt, optimize for learning speed
- **Enterprise:** Extensive reviews, security-first, documentation required, test coverage enforced
- **Design First:** Premium user experience, accessibility, motion, typography
- **Performance First:** Minimal resource usage, fast loading, lean architecture

**Acceptance criteria:**
- Culture profile is visible and selectable in company settings
- Changing culture profile visibly affects employee decision behavior
- Culture is referenced in employee decisions and reasoning

**Why it matters:** Different companies have genuinely different needs. A startup's definition of "done" is different from an enterprise's. The product must support this diversity without asking users to configure hundreds of individual settings.

---

### F-08: Repository Onboarding

**What it is:** The process by which the company learns an existing codebase and builds its initial repository memory.

**Acceptance criteria:**
- User can connect a repository by URL or integration
- CTO and Tech Lead analyze the repository and produce an architecture summary
- Repository memory is populated: folder structure, frameworks, dependencies, identified patterns, identified technical debt
- Company presents the architecture summary to the CEO for review and correction
- Onboarding completes without requiring the user to describe the codebase manually

**Why it matters:** Users have existing codebases. Engineering OS must be able to work with them from day one, not require a greenfield project.

---

### F-09: Standard Operating Procedures (SOPs) Engine

**What it is:** The internal workflow engine that executes the predefined SOPs for every category of work. The SOP engine is provider-independent — it drives work through phases and gates regardless of which execution engine performs the underlying reasoning.

**SOPs in V1:**
- New Feature (SOP-001)
- Bug Fix (SOP-002)
- Code Review (SOP-003)
- QA Validation (SOP-004)
- Release (SOP-005)
- Rollback (SOP-006)

**Execution modes supported:**
- **Interactive supervised** — the CEO can observe execution in real time; the execution engine runs in a visible session
- **Background automation** — work proceeds without an active CEO session; the CEO receives notifications at approval gates and on completion

**Acceptance criteria:**
- Work items progress through SOP phases automatically
- Gates between phases enforce required outputs before proceeding
- Escalations surface to the correct employee and, when required, to the CEO
- SOP phase is always visible on the work item
- Deviations from SOPs are flagged, not silently absorbed
- Execution mode is configurable per-company (interactive or background)
- Switching execution engines does not require re-configuring or re-running SOPs

**Why it matters:** The SOPs are the organizational backbone. They encode the company's standards into every workflow. Provider independence means those standards persist regardless of which AI model is used.

---

### F-10: Notifications and Approvals

**What it is:** The system that routes significant events and approval requests to the CEO.

**Acceptance criteria:**
- CEO receives notifications for: completed features, production deployments, incidents, approval requests, and company health changes
- Approval requests include: what is being approved, context, risks, and the recommending employee
- Notifications are prioritized by importance — the CEO is not overwhelmed with implementation details
- CEO can approve, reject, or request changes from the notification itself

**Why it matters:** The CEO experience depends on receiving only meaningful information. A CEO who receives 50 notifications a day about file changes and commit messages is no longer a CEO — they are a developer.

---

## 13. V2 Ideas

The following are validated directions for future development. They are not committed to V1.

**V2-01: Multi-Repository Support**  
One company managing multiple repositories — a frontend repo, a backend repo, and a mobile repo all under the same organizational roof.

**V2-02: Employee Hiring and Customization**  
Users can configure employee specializations, seniority levels, and behavioral preferences. A Frontend Engineer can be specialized for accessibility or animation. A Backend Engineer can be specialized for distributed systems or financial services.

**V2-03: Employee Learning and Promotion**  
Employees improve measurably over time based on review outcomes, QA results, and incident history. High-performing employees are eligible for promotion, which unlocks greater authority and responsibility.

**V2-04: Multi-Stakeholder Companies**  
Multiple users can be part of the same company with different roles — a technical co-founder as CTO, a product co-founder as CPO.

**V2-05: Growth Department Activation**  
SEO, Analytics, and Marketing employees become fully functional, running growth workflows — improving search visibility, reporting on user behavior, and executing marketing initiatives.

**V2-06: External Tool Integrations**  
Native integrations with Stripe, Datadog, PagerDuty, Slack, Vercel, and other tools that the company can interact with directly — not just through code, but through APIs.

**V2-07: Company Health Benchmarking**  
Compare company health metrics across similar companies (anonymized). "Your security score is in the bottom 20% of companies your size" is actionable context.

**V2-08: Incident and Decision History**  
A full timeline of every significant decision, incident, and change the company has ever made — searchable, filterable, and linked to current code.

**V2-09: Knowledge Graph**  
A visual representation of how concepts in the codebase relate to each other — Invoice connects to Subscription connects to Stripe connects to Webhook. The company navigates by concept, not by file search.

**V2-10: Mobile Engineer and Native App Support**  
iOS and Android development as first-class capabilities within the company.

---

## 14. Explicit Non-Goals

The following are things Engineering OS will not do. Clarity about non-goals is as important as clarity about goals.

**Engineering OS is not a code editor.**  
Users do not write code inside Engineering OS. If a user opens Engineering OS to write a function, something has gone wrong.

**Engineering OS is not an AI chat interface.**  
Users do not prompt AI models. Users direct their company. The conversation interface is organizational, not conversational.

**Engineering OS does not replace GitHub.**  
Code still lives in version control. Engineering OS directs work on repositories; it does not replace repositories.

**Engineering OS does not own infrastructure.**  
The user's application runs on the user's infrastructure. Engineering OS manages the engineering process; it does not own cloud accounts, domain names, or databases.

**Engineering OS does not make business decisions.**  
What to build, who the customer is, what the company should prioritize — these belong to the CEO. Engineering OS converts those decisions into execution. It does not generate business strategy.

**Engineering OS does not replace human engineers.**  
For teams with existing engineers, Engineering OS augments their capacity and provides organizational structure. It does not replace the judgment, creativity, and domain expertise of experienced engineers.

**Engineering OS is not a monitoring platform.**  
The Monitoring Engineer observes and reports. The product does not replace Datadog, Prometheus, or any other observability tool.

---

## 15. Success Metrics

### Business Metrics

| Metric | V1 Target | Rationale |
|---|---|---|
| Weekly Active Companies | Growth | The primary adoption signal |
| Feature Completion Rate | >85% of started features shipped | Demonstrates the core workflow works end-to-end |
| CEO Retention (Week 4) | >60% | Indicates the product delivers ongoing value |
| Net Promoter Score | >50 | Measures whether users recommend it to others |

### Product Quality Metrics

| Metric | V1 Target | Rationale |
|---|---|---|
| Defect Escape Rate | <5% of shipped features have post-release defects | Validates the quality gate process |
| Deployment Success Rate | >95% of deployments succeed without rollback | Validates the release process |
| CEO Approval Intervention Rate | Declining over time per company | Indicates growing trust and autonomy |
| Memory Utilization Rate | >70% of engineering decisions reference existing memory | Indicates the memory system is functioning |

### Experience Metrics

| Metric | V1 Target | Rationale |
|---|---|---|
| Time-to-First-Feature | <24 hours from account creation | Validates onboarding and first-use experience |
| CEO Actions Per Feature | Trending down over time | Indicates the CEO experience is being protected |
| Support Ticket Rate | <5% of active companies per week | Indicates the product is intuitive |

---

## 16. Constraints

**Constraint 1: No Breaking of the CEO Experience**  
Every product decision must be evaluated against whether it adds cognitive load to the CEO. Features that require the CEO to understand implementation details, manage individual employees, or make technical choices violate this constraint.

**Constraint 2: SOPs Are Mandatory**  
No workflow may ship without a defined SOP. The SOP is not optional documentation — it is the behavioral specification for that workflow. Work that proceeds without an SOP produces unpredictable results.

**Constraint 3: Memory Must Be Trustworthy**  
The company will only be as good as the quality of its memory. Memory records that are inaccurate, incomplete, or outdated will degrade the quality of future work. The memory system must be continuously maintained and verifiable by the CEO.

**Constraint 4: Autonomy Levels Must Be Enforced**  
If a user has set their autonomy level to "Assist," no action beyond planning and implementation may occur without approval. Violating autonomy settings destroys trust and may cause real-world harm if production changes are deployed without authorization.

**Constraint 5: The Company Has One CEO**  
In V1, there is one user per company. Features that assume multiple CEOs or conflicting directions violate this constraint.

---

## 17. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI quality variance produces inconsistent output quality | High | High | Structured SOPs with quality gates catch poor outputs before they reach production; memory improves consistency over time |
| Users attempt to use Engineering OS as a coding assistant | Medium | Medium | UX design reinforces the CEO experience; the product resists and redirects coding-level interactions |
| Memory becomes stale and produces incorrect decisions | Medium | High | Memory validation step in each SOP; CEO can review and correct memory records |
| Security vulnerabilities in generated code reach production | Medium | Critical | Security Engineer review is a mandatory gate for all security-relevant changes; Security Engineer has blocking authority |
| Users over-trust the Autonomous autonomy level before sufficient company maturity | Low | High | Autonomy level recommendations are surfaced; users are warned when switching to fully Autonomous with a young company |
| Competing products add organizational features | Medium | Medium | Memory compounding and organizational depth create a durable moat that improves with use; commoditization of raw code generation accelerates our value proposition |
| Long-running tasks exceed context or cost limits | High | Medium | V1 scopes tasks to single-day deliverables; complex features are decomposed before execution begins |

---

## 18. Assumptions

**A-01: Users have a repository to connect.**  
Engineering OS V1 assumes an existing codebase. Greenfield project creation from scratch may behave differently and is not the primary design scenario.

**A-02: Users accept that the company needs time to learn their codebase.**  
Repository onboarding takes time. The company improves with exposure. Users who expect perfect output on day one will be disappointed; the product is designed for ongoing use.

**A-03: The quality of work improves monotonically over time for a given company.**  
Memory accumulation is assumed to improve outcomes. If memory degradation becomes a problem in practice, this assumption must be revisited.

**A-04: Users will use natural language to communicate goals.**  
The input interface is natural language. Users who attempt to communicate in structured formats (e.g., writing their own PRDs and uploading them) may experience friction. V1 optimizes for the conversational goal input.

**A-05: V1 users are primarily technical or can work with a technical advisor.**  
While the CEO experience does not require engineering knowledge, V1 users who have zero exposure to software development concepts may struggle with the approval flows and architecture summaries. Non-technical founder support is a V2 priority.

**A-06: SOPs represent the current best practices and will evolve.**  
The six V1 SOPs are a starting point. As the company learns from shipped features, incidents, and user feedback, SOPs will be updated. The SOP engine must support versioning and updates.

---

## 19. Glossary

| Term | Definition |
|---|---|
| **CEO** | The user of Engineering OS. Responsible for company direction and goal-setting. Never responsible for implementation. |
| **Company** | The virtual software organization assigned to a CEO. Consists of all employees, memory, settings, and active work. |
| **Employee** | A specialized AI-powered organizational role within the company — e.g., Tech Lead, QA Engineer, Reviewer. Each employee has a defined mission, responsibilities, and behavioral standards. |
| **SOP (Standard Operating Procedure)** | A predefined, structured workflow that governs how a specific category of work is executed — e.g., New Feature, Bug Fix, Release. |
| **Feature Brief** | The authoritative written specification for a feature, produced by the Product Manager. Includes problem statement, proposed solution, acceptance criteria, out-of-scope items, and success metrics. |
| **Company Memory** | The persistent, organizational-level knowledge base that accumulates across all projects. Includes architecture decisions, coding standards, business rules, and feature history. |
| **Repository Memory** | A subset of company memory specific to a connected codebase — its structure, frameworks, patterns, and technical debt. |
| **Autonomy Level** | The configuration that defines how much authority the company has to act without CEO approval. Ranges from Manual (everything approved) to Autonomous (company operates independently). |
| **Culture Profile** | A company-level configuration that sets the values and priorities all employees operate under — e.g., Startup, Enterprise, Design First, Performance First. |
| **Gate** | A required checkpoint within a SOP that must be satisfied before work progresses to the next phase. Gates enforce quality standards. |
| **Escalation** | The process by which an employee routes a decision to a higher authority because the decision exceeds the employee's authority or because organizational values conflict. |
| **Definition of Done** | The complete set of conditions that must be true for a work item to be considered complete. Defined by the Product Manager; validated by QA. |
| **Delivery Readiness** | A pre-review checklist owned by the Tech Lead. Work that does not pass Delivery Readiness is not routed to the Reviewer. |
| **QA Go/No-Go** | A written recommendation from the QA Engineer that gates every release. A No-Go stops the release; only CTO-level override can proceed past it. |
| **Release Readiness Checklist** | A formal checklist owned by the Release Manager that must be fully satisfied before any deployment proceeds. |
| **Company Health** | A set of organizational metrics — architecture health, security score, documentation coverage, deployment stability, technical debt — that measure the overall quality of the company's engineering output. |
| **Execution Engine** | The software that performs actual reasoning, code generation, and file operations when an employee role is invoked. Examples include Claude Code, Codex CLI, Gemini CLI, API providers, and local models. Execution engines are replaceable adapters; they are not the product. |
| **Execution Adapter** | The interface layer that connects AgentRunner to a specific execution engine. Adapters translate a Context Package into engine-specific input and translate engine-specific output into a Structured Result. |
| **Interactive Execution** | An execution mode in which the CEO can observe the execution engine working in real time. Appropriate for high-trust, supervised use. |
| **Background Execution** | An execution mode in which work proceeds without an active CEO session. The CEO receives notifications at approval gates and on completion. Available in V1.5. |
| **Company Memory** | The persistent organizational knowledge base that spans all projects. Stored in PostgreSQL as relational records. The primary source of truth for everything the company has learned. Not tied to any AI model or provider. |
| **Provider Independence** | The architectural property that allows Engineering OS to operate with different execution engines without loss of company state, organizational memory, or workflow continuity. A core product principle and competitive advantage. |

---

## 20. Open Questions

These questions are unresolved and will require decisions during or after V1.

**OQ-01: What is the right onboarding experience for a greenfield project?**  
V1 assumes an existing repository. A user who wants to build something from scratch needs a different initial experience. How should the company handle the absence of an existing codebase?

**OQ-02: How do employees handle conflicting signals in memory?**  
If memory records conflict — two past decisions that contradict each other — how does an employee resolve the conflict? Does it escalate to the CEO, or does the company have an internal resolution process?

**OQ-03: What is the right default autonomy level for new companies?**  
New users need high visibility. But a very low autonomy level creates so many approval requests that the CEO experience becomes burdensome. What is the right default, and how does it suggest upgrades?

**OQ-04: How does the company communicate estimation confidence?**  
The Tech Lead estimates task duration. Those estimates will sometimes be wrong. How does the product communicate estimation confidence, and how does it handle estimates that turn out to be significantly off?

**OQ-05: How are memory records versioned and corrected?**  
When the CTO makes an architectural decision that supersedes a previous one, how is the old record updated? What is the audit trail?

**OQ-06: What happens when an employee cannot complete a task within defined standards?**  
If a QA Engineer cannot validate a feature because the acceptance criteria are ambiguous, or an Engineer cannot implement a task because the architecture is under-specified, what is the user experience? How does the company communicate this without creating cognitive overhead for the CEO?

**OQ-07: How does the product handle tasks that span multiple days?**  
The SOP framework assumes tasks fit within one working day. In practice, complex features may require continuous execution over several days. What is the session and continuity model?

**OQ-08: What is the data privacy model for repository content?**  
User repositories contain proprietary code, credentials, and business logic. What are the retention, processing, and access controls? How is this communicated to security-conscious enterprise customers?

**OQ-09: How does the product support auditing and compliance requirements?**  
Some customers will need to demonstrate that their software development process meets specific compliance standards (SOC 2, ISO 27001). Can Engineering OS produce audit trails that satisfy these requirements?

**OQ-10: What is the right pricing model?**  
Monthly subscription per company? Usage-based? Per-seat for multi-stakeholder companies in V2? The pricing model must align with the value delivery model.
