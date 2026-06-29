# Company Language and Glossary

**Status:** Approved  
**Version:** 1.0  
**Owner:** Technical Writer  
**Last Updated:** 2026-06-29  

---

This document is the canonical vocabulary of Engineering OS. Every other document — handbooks, SOPs, system specifications, the domain model, and any future implementation — must use these terms with these meanings. When two documents describe the same thing, they must call it the same thing; when they use the same word, they must mean the same thing. This glossary exists to make that true.

Terminology drift is one of the most expensive failures a long-lived organization can suffer. When "task" means an atomic deliverable in one document and a vague chunk of work in another, when "approval" means a casual nod in one place and a recorded governance event in another, the company's documentation stops being a single source of truth and becomes a set of competing dialects. This glossary fixes the words so the company can keep its meaning.

This is a language reference, not a behavioral specification. It tells you what a term *means* and how to *use the word*; it does not redefine how the underlying object behaves. For object shape and relationships, the [Domain Model](../architecture/DOMAIN_MODEL.md) is authoritative. For lifecycle behavior, the [Company Runtime](../architecture/COMPANY_RUNTIME.md) is authoritative. Where this glossary and those documents could appear to disagree, they do not — this document only names; they govern. If you find a true conflict, that is a defect in this glossary; fix it here.

The language here is intentionally **implementation-neutral**. It describes the company, not the database. You will not find table names, API shapes, framework names, or storage details in a definition. Those belong in the architecture documents and in code.

---

## Table of Contents

1. [How to Use This Glossary](#1-how-to-use-this-glossary)
2. [Conventions and Notation](#2-conventions-and-notation)
3. [Organizational Terms](#3-organizational-terms)
4. [Authority and Ownership Terms](#4-authority-and-ownership-terms)
5. [Work and Planning Terms](#5-work-and-planning-terms)
6. [Decision and Governance Terms](#6-decision-and-governance-terms)
7. [Quality and Delivery Terms](#7-quality-and-delivery-terms)
8. [Knowledge and Memory Terms](#8-knowledge-and-memory-terms)
9. [Completion Terms](#9-completion-terms)
10. [Examples and Non-Examples for Ambiguous Terms](#10-examples-and-non-examples-for-ambiguous-terms)
11. [Rules for Adding New Terms](#11-rules-for-adding-new-terms)
12. [Deprecated and Discouraged Words](#12-deprecated-and-discouraged-words)
13. [Relationship to Other Documents](#13-relationship-to-other-documents)

---

## 1. How to Use This Glossary

Use this document three ways:

- **When writing.** Before you coin a phrase for a concept, check whether the company already has a word for it. If it does, use that word with that meaning. If it does not, follow [Rules for Adding New Terms](#11-rules-for-adding-new-terms).
- **When reading.** When a document uses a capitalized domain term — Company, Task, Approval, Memory — read it with the meaning defined here, not its everyday English meaning. "Task" in Engineering OS is narrower than "task" in conversation.
- **When implementing.** Use these definitions to keep names and concepts in software aligned with the organization. The glossary deliberately avoids implementation language so that the same definition survives a change of framework, storage engine, or model. The concept is constant; the implementation is replaceable.

This glossary does not define every object in the system. It defines the **load-bearing vocabulary** — the words that, if used loosely, cause the most confusion. For the complete catalog of objects, their fields, and their relationships, see the [Domain Model](../architecture/DOMAIN_MODEL.md).

---

## 2. Conventions and Notation

Each entry follows a consistent shape:

- **Definition** — one or two sentences stating precisely what the term means.
- **Use it for** — the cases the word correctly covers.
- **Do not use it for** — the adjacent concepts it must not be stretched to cover.
- **See** — links to the documents that govern the concept in depth.

When a term is genuinely ambiguous in everyday usage, it also carries an **Example** and a **Non-example** in [Section 10](#10-examples-and-non-examples-for-ambiguous-terms).

Notation rules used throughout company documentation:

- A **capitalized term** (e.g., *Task*, *Release*) refers to the canonical concept defined here. A lowercase word (e.g., "release the lock") carries its ordinary English meaning.
- An arrow `→` denotes a containment or flow relationship (e.g., Initiative → Goal → Epic → Feature → Task).
- "Designed" describes organizational behavior specified in documentation; "implemented" describes behavior enforced in software today. The two are kept distinct in system documents; this glossary defines the concepts regardless of implementation status.

---

## 3. Organizational Terms

### Company

**Definition.** The top-level virtual software organization owned by a single User (the CEO). Every other object — every Employee, every Task, every Memory record — belongs to exactly one Company. The Company persists across sessions and accumulates capability over time.

**Use it for** the organization as a whole: its structure, culture, autonomy level, and history.

**Do not use it for** the human who owns it (that is the **User** / **CEO**), nor for the software platform that runs many companies (that is the **platform** or **Engineering OS** itself).

**See** [Domain Model → Company](../architecture/DOMAIN_MODEL.md#company), [Company Operating System](../company/COMPANY_OPERATING_SYSTEM.md).

### Department

**Definition.** A permanent organizational unit that groups Employees by a distinct category of responsibility. The V1 departments are Executive, Product, Engineering, Quality, Operations, and Growth. No two Departments own the same responsibility.

**Use it for** a durable business capability that outlives any individual Employee.

**Do not use it for** a temporary team assembled for one project, nor for a single Employee's area of focus.

**See** [Departments](../organization/DEPARTMENTS.md), [Domain Model → Department](../architecture/DOMAIN_MODEL.md#department).

### Employee

**Definition.** A specialist organizational role that owns a defined domain of work, with a mission, responsibilities, authority, persistent memory, escalation rules, and a communication style. Employees are the abstraction that makes Engineering OS a company rather than a set of AI agents. Users interact with Employees, never with models.

**Use it for** any named role-holder in the company — the CTO, a Backend Engineer, the Reviewer.

**Do not use it for** the underlying AI model, prompt, or session that powers an Employee. Those are implementation; the Employee is the organization. (See [Agent](#agent) below and [Section 12](#12-deprecated-and-discouraged-words).)

**See** [Employee Directory](../organization/EMPLOYEE_DIRECTORY.md), [Employee Template](../company/EMPLOYEE_TEMPLATE.md), [Domain Model → Employee](../architecture/DOMAIN_MODEL.md#employee).

### Role

**Definition.** The formal job definition from which an Employee is instantiated — its mission, authority boundaries, decision framework, escalation rules, and KPIs. A Role is a template; an Employee is an instance. Two Frontend Engineers share one Role but are two Employees.

**Use it for** the definition of a class of Employee.

**Do not use it for** a specific person doing the work (that is an **Employee**) or for a department.

**See** [Domain Model → Role](../architecture/DOMAIN_MODEL.md#role), [Reporting Structure](../organization/REPORTING_STRUCTURE.md).

### User / CEO

**Definition.** The single human who owns and directs the Company. The User experience is the CEO experience: the User communicates outcomes and approves significant decisions but never writes code, manages tickets, or coordinates tools. "User" and "CEO" name the same actor; prefer **CEO** in organizational writing and **User** in access-control or platform contexts.

**Use it for** the human director of the company.

**Do not use it for** an Employee. Employees are never Users; Users are never Employees.

**See** [Domain Model → User](../architecture/DOMAIN_MODEL.md#user).

### Agent

**Definition.** The runtime mechanism — a model invocation operating inside a checked-out repository — that performs an Employee's work in software. The Agent is implementation; the Employee is the organization it serves.

**Use it for** runtime and execution discussions (worker, adapter, agent run).

**Do not use it for** the organizational actor in CEO-facing or company-design writing. In those contexts the actor is always an **Employee**. The product deliberately hides the agent so the CEO thinks in terms of people, not models.

**See** [Company Runtime](../architecture/COMPANY_RUNTIME.md), [Domain Model → Agent Run](../architecture/DOMAIN_MODEL.md#agent-run).

---

## 4. Authority and Ownership Terms

### Ownership

**Definition.** The state of being the single accountable party for an object or activity. Every activity in the company has **exactly one** Owner. Ownership is about accountability, not about who does the most work.

**Use it for** the one Employee answerable for a Task, Project, Review, Release, or Decision.

**Do not use it for** shared responsibility. There is no co-ownership. If two people seem to own something, one of them actually owns it and the other contributes.

**See** [Responsibility Matrix → One Owner](../organization/RESPONSIBILITY_MATRIX.md).

### Authority

**Definition.** The scope of decisions an Employee or Role is permitted to make without escalating. Authority is bounded by Role. A decision inside an Employee's authority is made and recorded; a decision outside it is escalated.

**Use it for** the decision-making boundary of a Role ("architecture changes exceed a Frontend Engineer's authority").

**Do not use it for** general seniority or status. Authority is specific and scoped, not a rank.

**Principle.** *Responsibility precedes authority.* An Employee is given responsibility for an outcome first; authority is the decision-making latitude granted to meet that responsibility.

**See** [Company Operating System → Escalation Rules](../company/COMPANY_OPERATING_SYSTEM.md), [Domain Model → Role](../architecture/DOMAIN_MODEL.md#role).

### Confidence

**Definition.** An Employee's honestly-reported certainty in a recommendation, estimate, or finding, expressed as **high / medium / low**. Confidence is a required field of the company communication format and is never inflated to sound decisive.

**Use it for** qualifying any recommendation, estimate, or escalation ("Recommendation … Confidence: medium").

**Do not use it for** a measure of how much an Employee wants an outcome, nor as a substitute for evidence. Low confidence is a valid, professional answer; false high confidence is a defect.

**See** [Communication System → Confidence](../systems/COMMUNICATION_SYSTEM.md), [Company Playbook](../company/COMPANY_PLAYBOOK.md).

### Escalation

**Definition.** The act of routing a decision upward when it exceeds an Employee's authority, when recommendations conflict, when a security or value conflict arises, or when a request cannot be classified with confidence. A valid escalation always uses the company communication format: Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action.

**Use it for** a structured handoff of a decision to the party with authority to make it.

**Do not use it for** asking an open-ended "what should I do?" An escalation that does not state a recommendation and a next action is an abdication, not an escalation. Ambiguity routes **up** (to the CTO), never sideways.

**See** [Communication System](../systems/COMMUNICATION_SYSTEM.md), [Company Operating System → Escalation Rules](../company/COMPANY_OPERATING_SYSTEM.md).

### Autonomy Level

**Definition.** The company-wide setting that governs how much the company may do without a human deciding first. The five levels, in increasing order, are **Manual → Suggest → Assist → Delegate → Autonomous**. The autonomy level affects every Employee and every workflow.

**Use it for** describing how much human checkpointing a company requires.

**Do not use it for** an individual Employee's authority (that is **Authority**) or for a one-off permission grant (that is an **Approval**).

**See** [Company Operating System → Trust Model](../company/COMPANY_OPERATING_SYSTEM.md), [Approval System → The Autonomy Gate](../systems/APPROVAL_SYSTEM.md).

---

## 5. Work and Planning Terms

The planning hierarchy nests strictly: **Initiative → Goal → Epic → Feature → Task → Subtask**. Each level has a distinct purpose and a distinct owner. Using the wrong level for a piece of work is the most common terminology error in planning; the entries below exist to prevent it.

### Outcome

**Definition.** The business result the CEO asks for, stated as intent rather than implementation ("Build subscriptions," "Improve onboarding"). An Outcome is the input to planning; the company decomposes it into the planning hierarchy.

**Use it for** what the CEO communicates.

**Do not use it for** any specific unit of work the company produces in response. The CEO states Outcomes; the company produces Initiatives, Features, and Tasks.

**See** [Planning System](../systems/PLANNING_SYSTEM.md), [Product Requirements](../product/PRODUCT_REQUIREMENTS.md).

### Initiative

**Definition.** The highest-level planning object: a strategic direction containing one or more Goals. Owned by the Product Manager, approved by the CEO.

**Use it for** a strategic thrust ("Launch mobile app," "Achieve SOC 2").

**Do not use it for** a single deliverable capability (that is a **Feature**) or a measurable target (that is a **Goal**).

### Goal

**Definition.** A measurable business outcome within an Initiative, defined by a specific success metric. A Goal is achieved when its metric is met — **not** when its child work is complete.

**Use it for** a concrete, verifiable target ("Reduce signup drop-off to under 20%").

**Do not use it for** an activity or a deliverable. "Build the new signup form" is work toward a Goal; it is not the Goal.

### Epic

**Definition.** A collection of related Features that must be built together to achieve a Goal. Owned by the Tech Lead during technical planning.

**Use it for** intermediate-scale technical grouping — larger than a Feature, smaller than a Goal.

**Do not use it for** product intent (that is a **Goal** or **Initiative**).

### Feature

**Definition.** A specific, deliverable product capability — the primary unit of product planning. A Feature has acceptance criteria, is defined by a Feature Brief, and leaves a Feature Memory record when it ships.

**Use it for** a capability a user can experience ("Subscription checkout").

**Do not use it for** the implementation work that builds it (those are **Tasks**) or the strategic reason it exists (that is a **Goal**).

**See** [Domain Model → Feature](../architecture/DOMAIN_MODEL.md#feature).

### Project

**Definition.** A bounded execution container scoped to a single Repository that groups the Tasks, Reviews, QA Results, and Artifacts delivering one Feature. Owned for execution by the Tech Lead.

**Use it for** the engineering effort that delivers a Feature.

**Do not use it for** the Feature itself (the Feature is the *what*; the Project is the *doing*) or for a long-running strategic theme (that is an **Initiative**).

**See** [Domain Model → Project](../architecture/DOMAIN_MODEL.md#project).

### Task

**Definition.** The atomic unit of accountable engineering effort: **one deliverable, one owner, one working day.** Each Task maps to at least one acceptance criterion, has a Definition of Done, and is assigned to exactly one Employee.

**Use it for** a single, owned, completable-in-a-day piece of engineering work.

**Do not use it for** anything that cannot be finished in a working day (decompose it), anything without a single owner, or any casual to-do. A Task is a governed object, not a note.

**See** [Work Item System](../systems/WORK_ITEM_SYSTEM.md), [Domain Model → Task](../architecture/DOMAIN_MODEL.md#task).

### Subtask

**Definition.** An internal checkpoint inside a Task that helps the assigned Employee and the Tech Lead track granular progress. Subtasks do not independently flow through SOPs or Reviews.

**Use it for** progress tracking within a single Task.

**Do not use it for** work that needs its own owner, review, or acceptance criterion — that is a separate **Task**.

### Work Item

**Definition.** The general term for any unit of accountable engineering effort that the company captures, owns, advances, and completes. The canonical, most concrete Work Item is the **Task**; the term also covers the higher planning objects when speaking generically about "a unit of work." Every Work Item answers three questions: why it exists, who owns it and where it is, and whether it is truly done.

**Use it for** speaking generally about a tracked unit of work across the hierarchy.

**Do not use it for** a precise level when you mean a specific one. If you mean a Task, say **Task**. "Work Item" is the umbrella, used when the level genuinely does not matter.

**See** [Work Item System](../systems/WORK_ITEM_SYSTEM.md).

### Plan

**Definition.** A written specification of *what the company intends to do* before execution begins. A Plan is distinct from an Execution: the Plan describes intended behavior; the Execution records what actually happened.

**Use it for** captured intent ("the technical plan for the migration").

**Do not use it for** the record of what occurred (that is an **Execution**).

**See** [Domain Model → Plan](../architecture/DOMAIN_MODEL.md#plan), [Planning System](../systems/PLANNING_SYSTEM.md).

### Sprint

**Definition.** A bounded time window with a committed scope of Tasks, owned by the Tech Lead. A Sprint is *when* work happens; a Project is *what* the work delivers.

**Use it for** a time-boxed batch of committed work.

**Do not use it for** the scope of a feature (that is a **Project**) or a delivery marker (that is a **Milestone**).

### Milestone

**Definition.** A significant, time-anchored delivery marker visible to the CEO — the completion of an Epic, the launch of a major Feature, the delivery of an Initiative.

**Use it for** a progress marker in company reporting.

**Do not use it for** the work that reaches it (that is a **Project** or **Sprint**).

---

## 6. Decision and Governance Terms

### Decision

**Definition.** A significant, lasting choice — an architectural direction, a scope call, a risk acceptance, a technology selection — that constrains future work or represents a deliberate trade-off. Every significant Decision is recorded in a Decision Record with its rationale and rejected alternatives. Every Decision has exactly one decision-maker.

**Use it for** consequential, explainable choices that future Employees will need to understand.

**Do not use it for** routine implementation choices that do not affect future options. Naming a local variable is not a Decision; choosing the authentication strategy is.

**See** [Decision System](../systems/DECISION_SYSTEM.md), [Domain Model → Decision](../architecture/DOMAIN_MODEL.md#decision), [Decision Memory](../memory/DECISION_MEMORY.md).

### Approval

**Definition.** An explicit, recorded human decision that permits an action the company would otherwise pause on. Approval is a **governance event**, not a workflow step: the company is designed to run itself, and an Approval is the deliberate exception where it stops and waits for a human with the authority to say "proceed." Whether a given action requires Approval is determined by the Autonomy Level and the approval policy.

**Use it for** a recorded, authorized "go ahead" at a defined checkpoint (approving a plan, approving a release at sub-threshold autonomy).

**Do not use it for** an Employee-to-Employee Review outcome of "approved" — that is a [Review](#review) result, a quality judgment, not a governance act. A Review approves *code*; an Approval authorizes *the company to proceed*. (See the worked contrast in [Section 10](#10-examples-and-non-examples-for-ambiguous-terms).)

**See** [Approval System](../systems/APPROVAL_SYSTEM.md), [Company Operating System → Trust Model](../company/COMPANY_OPERATING_SYSTEM.md).

### Recommendation

**Definition.** The structured output an Employee produces when it believes a change of direction, approach, or priority would benefit the company. It always follows the company format: Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action. It is recorded whether accepted or rejected.

**Use it for** any forward-moving proposal from an Employee.

**Do not use it for** a vague opinion. "I think maybe this is better" is not a Recommendation; it lacks reasoning, risks, alternatives, confidence, and a next action.

**See** [Communication System](../systems/COMMUNICATION_SYSTEM.md), [Domain Model → Recommendation](../architecture/DOMAIN_MODEL.md#recommendation).

### Risk

**Definition.** A documented uncertainty that could negatively affect quality, timeline, or production stability, recorded with a likelihood, an impact, and a single owner who monitors and mitigates it.

**Use it for** a tracked, owned uncertainty.

**Do not use it for** a problem that has already occurred — that is an **Incident**. A Risk that is realized may *become* an Incident.

**See** [Risk Analysis Decision Framework](../decision-frameworks/RISK_ANALYSIS_DECISION_FRAMEWORK.md), [Domain Model → Risk](../architecture/DOMAIN_MODEL.md#risk).

---

## 7. Quality and Delivery Terms

### Review

**Definition.** A structured evaluation of code, architecture, or design before it advances to the next workflow phase, performed by the Reviewer. Every finding is classified (Blocking / Non-blocking / Question). A Review ends in one of three outcomes: **Approve**, **Request Changes**, or **Escalate**.

**Use it for** the quality gate applied to a change.

**Do not use it for** a governance permission to proceed (that is an [Approval](#approval)) or for functional validation (that is **QA**). A Review judges quality; QA judges whether it works.

**See** [Review System](../systems/REVIEW_SYSTEM.md), [Code Review SOP](../sops/CODE_REVIEW.md), [Domain Model → Review](../architecture/DOMAIN_MODEL.md#review).

### QA / QA Result

**Definition.** Quality Assurance — the functional validation of a Feature or fix against a Test Plan, owned by the QA Engineer. Its output, the **QA Result**, contains the execution record, defect reports, and a written **go / no-go** recommendation that gates every Release. A No-Go stops the release; only the CTO may authorize an override.

**Use it for** functional validation and its recorded go/no-go.

**Do not use it for** code-quality evaluation (that is a **Review**). Review and QA are separate gates owned by separate Employees.

**See** [QA Validation SOP](../sops/QA_VALIDATION.md), [Domain Model → QA Result](../architecture/DOMAIN_MODEL.md#qa-result).

### Release

**Definition.** A formal record of delivering validated, approved software to users, owned by the Release Manager. No Release proceeds without a completed Release Readiness Checklist and a QA go recommendation. The Release record is the authoritative account of what shipped, when, and under what conditions.

**Use it for** the act and record of shipping.

**Do not use it for** the deployment mechanism alone, or for a Feature being "done" in development. A Feature reaching Done and a Release shipping it are distinct events.

**See** [Release SOP](../sops/RELEASE.md), [Domain Model → Release](../architecture/DOMAIN_MODEL.md#release).

### Incident

**Definition.** A production problem requiring active response — tracked from detection through resolution, always producing a root cause analysis and follow-up actions. An Incident record is never deleted.

**Use it for** a realized production problem.

**Do not use it for** a potential problem that has not occurred (that is a **Risk**) or a routine bug found before release (that is a **defect** in QA).

**See** [Rollback SOP](../sops/ROLLBACK.md), [Domain Model → Incident](../architecture/DOMAIN_MODEL.md#incident).

---

## 8. Knowledge and Memory Terms

### Memory

**Definition.** The company's accumulated, continuously-generated organizational intelligence — facts, decisions, standards, and patterns that Employees reference when working and update when they finish. Memory is layered: Employee, Team, Company, Repository, Feature, and Conversation. Memory records are deprecated or superseded, never deleted.

**Use it for** the living, automatically-growing body of what the company knows.

**Do not use it for** curated reference documentation (that is **Knowledge**). Memory is generated continuously and may be rough; Knowledge is curated and authoritative.

**See** [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md), [Company Memory](../memory/COMPANY_MEMORY.md), [Domain Model → Memory](../architecture/DOMAIN_MODEL.md#memory).

### Knowledge

**Definition.** The curated, reference-quality tier of company information — approved patterns, coding standards, architecture documentation, API contracts — authored and reviewed before publication, maintained by the Technical Writer.

**Use it for** authoritative, intentionally-authored reference material.

**Do not use it for** raw, auto-generated records (those are **Memory**). The distinction is curation and authority, not subject matter.

**See** [Knowledge Library System](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md), [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md), [Domain Model → Knowledge](../architecture/DOMAIN_MODEL.md#knowledge).

---

## 9. Completion Terms

### Definition of Done

**Definition.** The explicit, enumerable set of conditions that must all be satisfied for a unit of work to be considered complete. Every Task carries a Definition of Done; a Task may not be marked Done until every condition in it is met.

**Use it for** the concrete, checkable completion contract attached to a specific Work Item.

**Do not use it for** a vague sense that work is "basically finished." If a condition is not written down, it is not part of the Definition of Done — and if it is written down, it is not optional.

**See** [Work Item System → Completion Rules](../systems/WORK_ITEM_SYSTEM.md), [Domain Model → Task](../architecture/DOMAIN_MODEL.md#task).

### Completion / Done

**Definition.** The state a Work Item reaches when its Definition of Done is fully satisfied **and** every required gate has passed. Completion is a *gated condition, not an opinion*. A Task reaches Done only with a recorded approved Review and a passing QA; a Feature reaches Done only when its acceptance criteria are met and its Feature Memory record is written.

**Use it for** the verified, gated end-state of work.

**Do not use it for** "the code is written" or "the PR is open." Code being written is necessary but not sufficient for Done. "Done" is the strongest word in the company's vocabulary; never weaken it.

**See** [Work Item System → Completion Rules](../systems/WORK_ITEM_SYSTEM.md), [Company Runtime](../architecture/COMPANY_RUNTIME.md).

---

## 10. Examples and Non-Examples for Ambiguous Terms

Some terms collide with everyday English or with each other. The contrasts below resolve the most frequent confusions.

### Approval vs. Review

| | Approval | Review |
|---|---|---|
| **What it judges** | Whether the company may proceed | Whether the change meets quality standards |
| **Who acts** | A human with authority (typically the CEO) | The Reviewer (an Employee) |
| **Nature** | A governance event | A quality gate |
| **Result vocabulary** | Approved / Rejected (the action proceeds or pauses) | Approve / Request Changes / Escalate (the code is accepted or sent back) |

**Example (Approval).** At Assist autonomy, the company opens a real PR and pauses for the CEO to approve the release. The CEO clicks Approve; the flow resumes. That is an Approval.

**Non-example (Approval).** The Reviewer marks a pull request "approved" because it has no blocking findings. That is a **Review** outcome, not an Approval — no governance permission was granted.

### Task vs. Feature vs. Goal

**Example (Task).** "Add server-side validation to the subscription form." One deliverable, one owner, finishable in a day. Correct.

**Non-example (Task).** "Build subscriptions." This is far more than a day of work for one owner — it is a **Feature** (or an Initiative). Calling it a Task is a level error; decompose it.

**Example (Goal).** "Increase trial-to-paid conversion to 25%." A measurable target. Correct.

**Non-example (Goal).** "Build the new pricing page." That is work toward a Goal, not a Goal. Goals are measured, not built.

### Memory vs. Knowledge

**Example (Memory).** A lesson-learned record auto-written after an Incident: "Webhook retries must be idempotent — we double-charged on retry." Generated by a workflow, possibly rough. Correct as Memory.

**Non-example (Memory).** The company's official, reviewed "Payments Architecture" reference. That is curated and authoritative — it is **Knowledge**.

### Risk vs. Incident

**Example (Risk).** "The migration may exceed the maintenance window." A documented uncertainty with an owner and a mitigation. Correct as a Risk.

**Non-example (Risk).** "The migration exceeded the window and the site was down for ten minutes." That already happened — it is an **Incident**.

### Done vs. "code written"

**Example (Done).** A Task whose Definition of Done is fully met, with a recorded approved Review and passing QA. Correct.

**Non-example (Done).** "The PR is open and tests pass locally." Necessary, but the gates have not been cleared. This is **in review**, not Done.

### Employee vs. Agent

**Example (Employee).** "The Backend Engineer recommends caching the pricing lookup." Organizational actor, used in company and CEO-facing writing. Correct.

**Non-example (Employee).** "The agent ran `claude -p` in the checked-out repo and pushed a branch." This is runtime mechanism — say **Agent** here, and reserve **Employee** for the organizational layer.

---

## 11. Rules for Adding New Terms

The glossary grows, but deliberately. Uncontrolled vocabulary is how drift returns. Follow these rules.

1. **Check first.** Before adding a term, confirm the concept is not already named here or in the [Domain Model](../architecture/DOMAIN_MODEL.md). If a word already exists for the concept, use it — do not coin a synonym.

2. **One concept, one word.** Never introduce a second word for an existing concept. Synonyms are forbidden; they are the seed of drift. If you find two words for one concept already in use, pick one, define it here, and mark the other in [Section 12](#12-deprecated-and-discouraged-words).

3. **One word, one concept.** Never overload an existing word with a second meaning. If you need a new meaning, you need a new word.

4. **Define it implementation-neutrally.** A definition describes the company concept, not its storage or code. If a definition cannot survive a change of framework or database, it is written wrong.

5. **State the boundaries.** Every entry must include *Use it for* and *Do not use it for*. A term that only says what it is, without saying what it is not, will be stretched until it means nothing.

6. **Add an Example and Non-example if the term is ambiguous.** If the word collides with everyday English or with another term, it earns a contrast in [Section 10](#10-examples-and-non-examples-for-ambiguous-terms).

7. **Place it under the right owner.** The Owner of the concept (the Role accountable for it) should be reflected by linking to the governing document. New terms touching object shape are reconciled with the Domain Model; new terms touching lifecycle are reconciled with the Company Runtime.

8. **Get it reviewed.** A new term is proposed by any Employee but admitted to the canonical glossary only with Technical Writer curation and CTO sign-off, mirroring how Knowledge Records are published. Bump the document **Version** and update **Last Updated** when terms change.

9. **Deprecate, do not delete.** When a term is retired, move it to [Section 12](#12-deprecated-and-discouraged-words) with a pointer to its replacement. Like Memory and Knowledge records, vocabulary is superseded, not erased, so older documents remain interpretable.

---

## 12. Deprecated and Discouraged Words

These words are discouraged in company documentation because they invite drift. Prefer the canonical term.

| Discouraged | Why | Use instead |
|---|---|---|
| "ticket" | Borrowed from issue trackers; conflates planning levels | **Task**, or the specific level (Feature, Project) |
| "story" / "user story" | Implies an external Agile ceremony the company does not run | **Feature** (with acceptance criteria) |
| "AI" / "the model" / "the bot" (as an actor) | Breaks the company illusion; names implementation as if it were the organization | **Employee** (organization) or **Agent** (runtime), as appropriate |
| "sign-off" (when meaning quality) | Ambiguous between governance and quality | **Approval** (governance) or **Review** approval (quality) |
| "finished" / "wrapped up" (as a status) | Implies Done without the gates | **Done** only when gated; otherwise name the actual status (in review, in QA) |
| "blocker" (as a noun for any obstacle) | Conflated with Review finding classification | **Blocking finding** (Review), **Risk**, or **Incident**, as appropriate |

This table is not exhaustive. When you notice a word causing confusion in practice, add it here following [Rule 9](#11-rules-for-adding-new-terms).

---

## 13. Relationship to Other Documents

This glossary names; other documents govern. Use them together.

- **[Domain Model](../architecture/DOMAIN_MODEL.md)** — authoritative for object shape, fields, relationships, and invariants. When this glossary describes *what a term means*, the Domain Model describes *what the object is*.
- **[Company Runtime](../architecture/COMPANY_RUNTIME.md)** — authoritative for lifecycle and state-machine behavior. When a term refers to a state ("Done," "in review"), the Runtime governs how that state is reached and left.
- **[Company Operating System](../company/COMPANY_OPERATING_SYSTEM.md)** — the operating manual the vocabulary serves: constitution, autonomy, escalation, culture.
- **System specifications** — the behavioral home of many terms: [Work Item System](../systems/WORK_ITEM_SYSTEM.md), [Approval System](../systems/APPROVAL_SYSTEM.md), [Decision System](../systems/DECISION_SYSTEM.md), [Review System](../systems/REVIEW_SYSTEM.md), [Communication System](../systems/COMMUNICATION_SYSTEM.md), [Planning System](../systems/PLANNING_SYSTEM.md), [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md), [Knowledge Library System](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md).
- **Organization documents** — [Departments](../organization/DEPARTMENTS.md), [Employee Directory](../organization/EMPLOYEE_DIRECTORY.md), [Reporting Structure](../organization/REPORTING_STRUCTURE.md), and [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) — define who owns the concepts named here.

When any of these documents and this glossary appear to disagree, the governing document wins for behavior and shape; this glossary is then corrected so the *word* matches the *thing*. Keeping that alignment true is the entire purpose of this document.
