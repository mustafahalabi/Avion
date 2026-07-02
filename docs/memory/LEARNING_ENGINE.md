# Learning Engine

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

The Learning Engine is the mechanism that turns repeated findings, incidents, reviews, feedback, and delivery outcomes into **durable changes to how the company works** — specifically into updated company standards, employee memories, SOPs, and decision frameworks. It is the write side of organizational learning: the discipline that ensures a lesson the company paid for once does not have to be paid for again.

This document sits inside the memory-layer family ([Company Memory](./COMPANY_MEMORY.md), [Employee Memory](./EMPLOYEE_MEMORY.md), [Repository Knowledge](./REPOSITORY_KNOWLEDGE.md)). It is deliberately narrow: it owns the question **"once the company has learned something, how does that learning become permanent and change future behavior?"** It does **not** re-own the company-wide improvement governance, the promotion gate, or the KPIs — those belong to the [Continuous Improvement System](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md). It does not own the record model, layers, or supersession rules — those belong to the [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md). This document is the bridge between the two: how a validated lesson lands in the right durable home and stays there.

This is organizational behavior, not storage technology. Where it names a concrete field, service, or screen, that reflects the current implementation surface ([Section 10](#10-implementation-status)); the rules themselves are storage-agnostic and survive any change of database, index, or retrieval engine. Inventing capability the platform does not have would violate a hard project rule, so designed-but-unbuilt behavior is labeled as such throughout.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [What the Learning Engine Is — and Is Not](#3-what-the-learning-engine-is--and-is-not)
4. [Learning Sources](#4-learning-sources)
5. [The Learning Lifecycle](#5-the-learning-lifecycle)
6. [Update Targets — How Learning Becomes Durable](#6-update-targets--how-learning-becomes-durable)
7. [Ownership](#7-ownership)
8. [Validation](#8-validation)
9. [Durability — Preventing Repeated Avoidable Failures](#9-durability--preventing-repeated-avoidable-failures)
10. [Implementation Status](#10-implementation-status)
11. [Examples](#11-examples)
12. [Anti-Patterns](#12-anti-patterns)
13. [Definition of Done](#13-definition-of-done)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

The Learning Engine exists to make the company's improvement **durable rather than personal**. A lesson that lives only in one employee's reasoning is lost the moment that employee is not invoked; a lesson written into the right durable home changes every future invocation that touches the domain. The engine is the set of rules that decide *where* a validated lesson goes and *how* it sticks.

It serves four purposes:

1. **Land learning in the right home.** A lesson is not generically "remembered." It is recorded as a company standard, an employee-role convention, an SOP step, or a decision-framework criterion — whichever is the surface that future work actually consults. Putting a lesson in the wrong home is the single most common way learning is lost ([Section 12](#12-anti-patterns)).
2. **Make the change binding where it must bind.** Some learning advises (an employee's role preference); some learning constrains (a company standard enforced at a gate). The engine routes each lesson to a home with the right binding power, so the lesson is followed to the degree it deserves.
3. **Preserve the chain from outcome to change.** Every durable change cites the work that produced it — the review finding, the defect, the incident, the rejected approval. The reasoning is never severed from the rule, so a future employee can see *why* a practice exists before reversing it.
4. **Stop avoidable failures from recurring.** The first occurrence of a defect is a finding; the second is a pattern; the third is an organizational failure to learn. The engine is how the company converts a recurring failure into a standard, SOP step, or framework criterion that prevents the next occurrence.

The Learning Engine is **not** an analytics dashboard, a retraining pipeline, or a backlog of "tech-debt" tickets. It is the disciplined act of writing a validated lesson into the surface that will change behavior.

---

## 2. Scope

This document governs **how a validated lesson becomes a durable change** to the company's operating surfaces.

**In scope:**

- The sources the company learns from and the kind of durable change each typically produces ([Section 4](#4-learning-sources)).
- The lifecycle from raw signal to a written, durable update ([Section 5](#5-the-learning-lifecycle)).
- The four update targets — **company standards, employee memories, SOPs, and decision frameworks** — and the routing rule that decides which one a given lesson belongs in ([Section 6](#6-update-targets--how-learning-becomes-durable)).
- The ownership, validation, and durability rules that keep those updates trustworthy and prevent repeated avoidable failures.

**Out of scope:**

- **Improvement governance, the promotion gate, retrospective cadence, and KPIs** — owned by the [Continuous Improvement System](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md). This document is the memory-side companion to that system: it details *where learning lands*, not how the company is measured on learning.
- **The record model, the six memory layers, read precedence, and supersession mechanics** — owned by the [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md). This document inherits those rules and only references them.
- **How authoritative standards are curated and published** — owned by the [Knowledge Library System](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md).
- **The mechanics of any individual review, QA cycle, release, or incident response** — owned by the [Review System](../systems/REVIEW_SYSTEM.md), [QA_VALIDATION.md](../sops/QA_VALIDATION.md), [RELEASE.md](../sops/RELEASE.md), and [ROLLBACK.md](../sops/ROLLBACK.md). The engine consumes the *lessons* those produce.
- **Storage technology.** Which database or index backs a record is an implementation choice, intentionally absent from the normative rules.

---

## 3. What the Learning Engine Is — and Is Not

The company already has two documents that border this one closely. The boundary is stated explicitly so no reader mistakes overlap for duplication.

| Concern | Owned by | This document's relationship |
|---|---|---|
| **Is this learning worth keeping? When does a pattern become a standard? How is learning measured?** | [Continuous Improvement System](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md) | The Learning Engine **executes the write** the improvement lifecycle authorizes. The promotion gate decides *whether*; the engine decides *where it lands and how it binds*. |
| **How is a memory record shaped, scoped, read, superseded, retained?** | [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md) | The Learning Engine **uses** that record model. It never redefines fields, layers, or precedence; it routes lessons into the layers that document defines. |
| **Once a lesson is durable, which operating surface changes, and how does the change stay enforced?** | **This document** | The unique contribution: routing a validated lesson to one of four targets — standard, employee memory, SOP, decision framework — and keeping the change durable. |

In one sentence: **the Continuous Improvement System decides what the company should learn, the Organizational Memory System defines how a learned fact is stored, and the Learning Engine connects the two by writing the lesson into the surface that future work obeys.**

---

## 4. Learning Sources

The company learns from a defined set of sources. Each produces signals of a characteristic kind and tends to produce a particular kind of durable change. The signal set is the same set the [Continuous Improvement System §3](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md#3-improvement-sources) enumerates; what this table adds is the **typical durable home** the learning lands in.

| Source | Signal it produces | Typically lands in | Surfaced by |
|---|---|---|---|
| **Code Review** | Findings classified `blocker` / `non_blocker`; change requests | Coding **standard** or review-checklist item; recurring author mistakes → that role's **employee memory** | Reviewer |
| **QA Validation** | Per-check pass/fail against acceptance criteria; recurring defect classes | **SOP** step in [QA_VALIDATION.md](../sops/QA_VALIDATION.md) (new checklist item); QA-role **employee memory** for brittle areas | QA Engineer |
| **Production Incidents** | Incident records (severity, root cause), follow-up work | **SOP** guardrail or release-readiness step; **decision framework** criterion when the root cause was a bad trade-off | Tech Lead / Monitoring Engineer |
| **Deployments / Releases** | Release outcomes, rollbacks, post-release monitoring | **SOP** step in [RELEASE.md](../sops/RELEASE.md) / [ROLLBACK.md](../sops/ROLLBACK.md); Release-Manager **employee memory** | Release Manager |
| **Execution Audit Trail** | Guardrail blocks, denied commands, validation runs from the agent worker | Guardrail policy / pre-flight **standard**; CTO **employee memory** | CTO |
| **Planning Outcomes** | Estimate-vs-actual deviation, scope splits, mid-flight blockers | Planning heuristic in [PLANNING_SYSTEM.md](../systems/PLANNING_SYSTEM.md); Tech-Lead **employee memory** (estimation calibration) | Tech Lead / Product Manager |
| **CEO Feedback** | Direction, rejections at approval gates, restated outcomes | Product **standard** or a **decision-framework** prioritization criterion | Product Manager |

Three rules govern sources, inherited from the improvement system and restated because they are load-bearing for durability:

1. **Every source has an accountable surfacer.** A signal no role is responsible for noticing is a signal the company will not learn from.
2. **A signal is only an input, not a conclusion.** One review finding is not yet a durable change — the lifecycle in [Section 5](#5-the-learning-lifecycle) is what turns it into one.
3. **No source is silent.** A verbal "we should do better" is not a signal. A signal exists only when it is recorded against the work that produced it.

---

## 5. The Learning Lifecycle

Every durable change moves through the same stages. The first three stages (signal → insight → pattern) are owned by the [Continuous Improvement System §4](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md#4-the-improvement-lifecycle); the Learning Engine's distinct work is the final two — **routing** the validated lesson to the correct durable home and confirming **adoption**.

```
Signal      a recorded observation from a source (a review finding, a defect, an incident)
  ↓  (worth remembering? — Memory write rule)
Insight     a named lesson written as a Memory record: what happened, why, what to do differently
  ↓  (has this happened before? — recurrence check, ≥2 independent work items)
Pattern     an insight that has recurred across independent work items, with instances linked
  ↓  (validated? — Continuous Improvement promotion gate)
Route       ◀── the Learning Engine selects the durable home (Section 6) and writes the change
  ↓
Adopt       the change is enforced where it lives: standard at a gate, SOP step in the workflow,
            framework criterion in the next decision, employee memory on the next role invocation
```

**The two stages this document owns:**

- **Route.** A validated lesson is not "saved" generically. The engine applies the routing rule ([Section 6.5](#65-the-routing-rule)) to decide whether it becomes a company standard, an employee-memory record, an SOP step, or a decision-framework criterion — and writes it there with its source and rationale intact. A lesson written to the wrong home is effectively lost: future work consulting the right surface never sees it.
- **Adopt.** A durable change is not done when it is written; it is done when future work demonstrably follows it. A standard is adopted when a gate enforces it, an SOP step when the workflow includes it, a framework criterion when the next relevant decision applies it, an employee-memory record when the next invocation of that role reads it. A change nothing consults is documentation, not learning.

**Lifecycle invariants:**

1. Learning only moves forward through evidence — a pattern is declared from linked instances, never a hunch.
2. Each stage has an owner ([Section 7](#7-ownership)); no stage advances itself.
3. Every durable change is a record, not a status in someone's memory. A lesson that is not written did not happen.

---

## 6. Update Targets — How Learning Becomes Durable

This is the core of the document. A validated lesson lands in exactly one of four homes. Each home has a different owner, binding power, and enforcement surface. Choosing the right one is the routing decision in [Section 6.5](#65-the-routing-rule).

### 6.1 Company Standards

**When learning becomes a standard.** A recurring defect, anti-pattern, or risk that should bind **every** relevant role becomes a company standard. Standards are the strongest form of learning: they constrain all future work and are enforced at a gate.

- **Where it is written.** As a [Company Memory](./COMPANY_MEMORY.md) record (the accumulating tier) and, once authoritative, promoted to a published standard in the [Knowledge Library](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md) (the curated, binding tier). The Memory→Knowledge promotion is the act of moving a lesson from "informs" to "binds."
- **How it stays durable.** The record cites its evidence (the linked instances) and its rationale. The standard is wired into the surface that enforces it — a [Review](../systems/REVIEW_SYSTEM.md) checklist item, a QA check, a release-readiness item — so a violation is caught rather than trusted not to occur.
- **Example.** "Every list endpoint must be reviewed for N+1 access and covered by a query-count assertion." This binds every Backend Engineer and is checked in review; it is not one engineer's preference.

### 6.2 Employee Memories

**When learning becomes an employee-memory record.** A lesson that informs **one role's** future work, and is not the concern of every role, becomes an [Employee Memory](./EMPLOYEE_MEMORY.md) record owned by that role. Employee memory **advises**; it does not bind other roles.

- **Where it is written.** As a role-scoped Memory record, attributed to the role, citing its source, in plain language any employee could read. The per-role content boundaries are defined in [Employee Memory §4](./EMPLOYEE_MEMORY.md#4-memory-ownership-by-role) and the [employee handbooks](../employees/).
- **How it stays durable.** The record persists across every invocation of that role, so the role behaves like one continuous professional rather than re-deriving the same convention each time. It carries a confidence value so it can be weighed on read.
- **Promotion check.** Before writing to a role's memory, the engine checks whether the lesson actually binds more than one role. If it does, it is **promoted** to a standard ([Section 6.1](#61-company-standards)) instead — filing a company-wide rule as one role's preference fragments the standard and lets other roles ignore it ([Employee Memory §5.3](./EMPLOYEE_MEMORY.md#53-promotion-on-write)).
- **Example.** "Tasks touching the auth middleware run ~1.5× the initial estimate because of the cross-cutting test surface — pad accordingly." This calibrates the Tech Lead's estimation and concerns no other role.

### 6.3 SOPs

**When learning changes an SOP.** A lesson that should change the **steps or gates of a workflow** — a missing check, a step that runs in the wrong order, a guardrail that was absent — becomes an addition or amendment to a Standard Operating Procedure ([SOPs](../sops/)).

- **Where it is written.** As a new step, gate, or checklist item in the owning SOP: a QA check in [QA_VALIDATION.md](../sops/QA_VALIDATION.md), a release-readiness item in [RELEASE.md](../sops/RELEASE.md), a rollback trigger in [ROLLBACK.md](../sops/ROLLBACK.md), a review step in [CODE_REVIEW.md](../sops/CODE_REVIEW.md), a phase in [NEW_FEATURE.md](../sops/NEW_FEATURE.md) or [BUG_FIX.md](../sops/BUG_FIX.md). Each SOP already concludes with a **memory-update phase** ([NEW_FEATURE.md Phase 8](../sops/NEW_FEATURE.md)) that is the natural moment to feed learning back.
- **How it stays durable.** A workflow step is the most enforced form of learning because the workflow cannot complete without passing through it. An SOP amendment turns "remember to check X" into "the procedure does not advance until X is checked."
- **Example.** After an incident traced to an un-run migration, [RELEASE.md](../sops/RELEASE.md) gains a readiness item: "Confirm pending migrations are applied in the target environment before deploy." The next release cannot reach the deploy step without it.

### 6.4 Decision Frameworks

**When learning changes a decision framework.** A lesson that a class of **decisions keeps coming out wrong** — the company repeatedly under-weights a factor, or accepts a trade-off it should not — becomes a new or amended criterion in the relevant [decision framework](../decision-frameworks/).

- **Where it is written.** As a criterion, threshold, or weighting in the owning framework: [ARCHITECTURE_DECISION_FRAMEWORK.md](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md), [SECURITY_DECISION_FRAMEWORK.md](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md), [DEPENDENCY_CHOICE_DECISION_FRAMEWORK.md](../decision-frameworks/DEPENDENCY_CHOICE_DECISION_FRAMEWORK.md), [TECHNICAL_DEBT_DECISION_FRAMEWORK.md](../decision-frameworks/TECHNICAL_DEBT_DECISION_FRAMEWORK.md), [PERFORMANCE_DECISION_FRAMEWORK.md](../decision-frameworks/PERFORMANCE_DECISION_FRAMEWORK.md), [PRIORITIZATION_DECISION_FRAMEWORK.md](../decision-frameworks/PRIORITIZATION_DECISION_FRAMEWORK.md), [RISK_ANALYSIS_DECISION_FRAMEWORK.md](../decision-frameworks/RISK_ANALYSIS_DECISION_FRAMEWORK.md), or others. The change itself is recorded as a [Decision](../systems/DECISION_SYSTEM.md).
- **How it stays durable.** A framework criterion changes how the *next* decision of that class is made, not just the one that produced the lesson. It is the most leveraged target: it improves a whole category of future judgments at once.
- **Example.** A dependency that was abandoned upstream and stranded the company adds a criterion to the dependency framework: "Reject a dependency whose maintenance has lapsed beyond the agreed staleness threshold, regardless of feature fit."

### 6.5 The Routing Rule

A single validated lesson goes to **one** home. The routing question is *who must obey this, and at what surface is it enforced?*

| If the lesson… | …it lands in | Binding power | Enforced at |
|---|---|---|---|
| Binds **every** relevant role and is checkable at a gate | **Company standard** (Memory → Knowledge) | Constrains all future work | Review / QA / Release gate |
| Informs **one role's** craft and concerns no other role | **Employee memory** | Advises that role | The role's next invocation |
| Should change the **steps or gates of a workflow** | **SOP** | Procedure cannot advance without it | The workflow itself |
| Should change how a **class of decisions** is made | **Decision framework** | Shapes the next decision of that class | The next relevant decision |

Two routing safeguards:

- **One home, not many.** A lesson is not copied into all four. Duplication fragments ownership and guarantees the copies drift apart. If a lesson genuinely needs both a standard *and* an SOP step (e.g., a security rule that must also be a release-readiness check), the standard is authoritative and the SOP step **references** it rather than restating it.
- **Promote, don't misfile.** The most common routing error is filing a company-wide rule as one role's employee memory. The test is always *who must obey* — if it is more than one role, it is a standard, never a preference ([Section 12](#12-anti-patterns)).

---

## 7. Ownership

Learning is owned end-to-end by the **CTO** as the executive accountable for how the company works — consistent with the [Continuous Improvement System §6](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md#6-ownership). Within that, the *routing and write* into each durable home has a clear operational owner. One owner per home; no shared accountability.

| Update target | Write owner | Approval / authority |
|---|---|---|
| **Company standard** (Memory record) | The domain owner who surfaced it (Tech Lead, Security Engineer, etc.) | CTO (or Tech Lead by delegation for engineering standards) |
| **Company standard** (promotion to Knowledge) | Technical Writer (curates and publishes) | CTO |
| **Employee memory** | The role itself owns its records | The role's department lead resolves within-role conflicts |
| **SOP step / gate** | The SOP's owner (e.g., QA Engineer for QA SOP, Release Manager for Release SOP) | CTO for cross-cutting SOPs |
| **Decision-framework criterion** | The framework's domain owner | CTO, recorded as a [Decision](../systems/DECISION_SYSTEM.md) |

Ownership rules:

- **The CEO is never an operational owner.** The CEO sees the *result* of learning — better, faster, more reliable delivery — and is consulted only when a change would alter product scope or accept business risk, at which point it is an escalation, not a unilateral change.
- **A change with no enforcing owner is not made.** If no gate, workflow step, framework criterion, or role will actually consult the change, it is not durable and is rejected at validation ([Section 8](#8-validation)).
- **Pruning is ownership too.** The owner of a durable home is accountable for retiring entries that no longer apply, not only for adding new ones. A standard set, SOP, or framework that only ever grows becomes impossible to follow.

---

## 8. Validation

Before a lesson becomes a durable change, it passes validation. This is the gate that keeps the company's standards, SOPs, and frameworks trustworthy. A candidate that fails any check is returned to its proposer, not written. These checks are the routing-time application of the [Continuous Improvement System §7](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md#7-validation-rules) validation rules and the [memory validation](./COMPANY_MEMORY.md#9-validation) rules.

| Check | Requirement |
|---|---|
| **Evidenced** | Links to the work that produced it. A standard or framework change links to **≥2 independent instances**; an employee-memory record cites at least its originating source. A change from a single occurrence is an insight, not yet a standard. |
| **Actionable** | States what to do or not do, not merely what went wrong. The owner of the enforcing surface must be able to check compliance without interpretation. |
| **Routed correctly** | The lesson is in the home its binding power demands ([Section 6.5](#65-the-routing-rule)): a multi-role rule is a standard, not a role preference; a workflow change is an SOP step, not a memory note no gate enforces. |
| **Enforceable** | Names where it is enforced — a review checklist, a QA check, a release item, a framework criterion, or a role's read step. A change nothing consults is not validated. |
| **Non-contradicting** | Does not conflict with an active standard, SOP step, or framework criterion. A conflict is resolved by supersession ([Section 9](#9-durability--preventing-repeated-avoidable-failures)), never by leaving two contradictory rules live. |
| **Within company authority** | If adopting it requires a CEO product decision or accepts business risk, it is escalated for that decision first and only written once the decision is recorded. |
| **Sourced and weighted** | The record carries its `source` and, for memory records, a `confidence` value so downstream readers know how settled it is. |

Validation is a judgment, not a rubber stamp. The validating authority confirms the change would actually prevent the recurrence and weighs the cost of binding future work against the cost of the recurring problem. Approving a weak change is as much a failure as rejecting a strong one.

---

## 9. Durability — Preventing Repeated Avoidable Failures

The whole point of the engine is that a lesson, once learned, does not have to be re-learned. Durability is achieved by a small set of invariants, inherited from the [Organizational Memory System §9](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#9-update-and-supersession-rules) and [§11](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#11-retention-rules).

1. **Nothing is deleted; changes are appended or superseded.** A durable change is never silently rewritten into a different rule. A new standard supersedes an old one with a link to its predecessor; a deprecated SOP step or framework criterion is marked obsolete with a recorded reason, not removed. The history of what the company believed, and when, is itself organizational value — it shows future employees *why* a practice exists before they reverse it.

2. **The chain from outcome to change is never severed.** A standard in the Knowledge Library traces back through the pattern in Memory to the original review findings, defects, or incidents. An SOP step or framework criterion cites the incident or recurrence that produced it. Severing the evidence from the conclusion is how a rule becomes cargo-cult — followed without understanding, and therefore discarded the moment it is inconvenient.

3. **Adoption is re-checked after every change.** When a standard, SOP step, or framework criterion changes, the surfaces that enforce it are updated in the same change. A rule whose enforcement point lags behind its text is unevenly applied and quietly dies.

4. **Recurrence is the test of success, not activity.** The engine succeeds when a promoted lesson *stops the failure recurring*, not when many lessons are written. A rising count of standards with a flat recurrence rate is the signature failure the [Continuous Improvement System KPIs](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md#11-kpis) are designed to catch: the company is writing rules but not learning. The durability invariants serve recurrence reduction, never volume.

5. **Conflicts are surfaced, never silently resolved.** Two durable changes that contradict each other are escalated to the owning authority (the CTO for standards, the department lead for employee memory), who decides which stands and supersedes the other with recorded reasoning. The company never holds two binding rules that disagree.

The principle: a lesson is durable when a future invocation that touches the domain **cannot avoid** consulting it, when the reasoning behind it survives intact, and when its presence demonstrably reduces the failure it was written to prevent.

---

## 10. Implementation Status

Per the project's hard rule against describing capability that does not exist, this section separates what the platform implements **today** from what is **designed but not yet built**. The learning *flow* described above is the standing organizational specification; only the raw signal capture and the durable record stores are automated today. The bulk of automatic learning is deliberately gated behind real-AI work that has not begun and behind **Engineering OS Specification v1.0**.

### 10.1 Implemented today

The platform produces and persists the raw signals the engine learns from, and provides the durable stores a lesson is written into:

- **Review findings are first-class and classified.** `recordReviewResult` (`apps/web/src/lib/review-service.ts`) stores review verdicts (`approved` / `changes_requested` / `blocked` / `needs_clarification`) and findings tagged `blocker` / `non_blocker`, and opens `ChangeRequest` records when changes are requested. These are the literal signals of the Review source.
- **QA results carry pass/fail evidence and block on failure.** `recordQaResult` (`apps/web/src/lib/qa-service.ts`) stores QA verdicts and per-check results against acceptance criteria and **blocks completion** when required checks did not pass — no task reaches `done` on an unverified claim.
- **Gate advancement is truthful and recorded.** `gate-advancement-service.ts` advances tasks through review and QA strictly by autonomy level, never bypassing a gate, and writes a `TimelineEntry` for each transition. The honest gate is what makes the signals trustworthy.
- **The execution audit trail captures guardrail signals.** `worker-audit-log.ts` records `command_blocked`, `guardrail_triggered`, `validation_run`, `pr_opened`, and related events for every autonomous run — the raw material of the Execution Audit source.
- **Incidents are modeled.** An `Incident` record (`severity`, `status`, `resolvedAt`) exists in the schema as the anchor for incident-derived lessons.
- **The durable memory store exists.** `Memory` / `MemoryRecord` (`apps/web/src/app/actions/memory.ts`) persist insights with a `source` and a `confidence` value (0–1) across eight categories (`company`, `architecture`, `product`, `security`, `operations`, `employee`, `feature`, `decision`). Five company-scoped banks are seeded at company creation (`apps/web/src/lib/company-seed.ts`), and the `/memory` surfaces let the CEO browse and add records.
- **Company intelligence surfaces where the company is struggling.** `next-action-recommendation.ts` reads workspace state (blocked tasks, failed executions, stuck requests, pending approvals) and recommends the CEO's next action — an early form of surfacing where learning is needed.

### 10.2 Designed / planned (not yet built)

- **Automatic insight extraction.** The platform *records* review findings, QA defects, and audit events but does not yet distill them into Memory insights automatically. The signal→insight step is performed by employees; the runtime does not emit insight records as a byproduct of a closed review or resolved incident.
- **Pattern detection and recurrence linking.** Linking recurring insights across work items and declaring a pattern at the threshold is specified ([Section 5](#5-the-learning-lifecycle)) but not yet computed.
- **Pattern-to-standard promotion into the Knowledge tier.** The `Knowledge` / `KnowledgeRecord` models exist in the schema but have no curation workflow or UI ([KNOWLEDGE_LIBRARY_SYSTEM.md](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md)). Automatic promotion of a validated pattern into a published, enforced standard is the central planned evolution.
- **Automatic routing into SOPs and decision frameworks.** Today, SOP and decision-framework amendments are authored by employees through documentation, not emitted by the runtime. Wiring learning to update those surfaces automatically is designed, not built.
- **Supersession status and version chains.** The `active` / `superseded` / `deprecated` model in the [Domain Model](../architecture/DOMAIN_MODEL.md#memory-record) is not yet enforced by the schema; supersession is expressed today by adding the new record (citing the one it replaces) and driving the obsolete record's `confidence` toward `0`.
- **Mandatory retrieval and enforcement by real-AI employees.** Employees that retrieve and respect standards, SOP steps, and framework criteria on every invocation are gated behind **Engineering OS Specification v1.0**.
- **KPI computation.** Recurrence rates and adoption are a measurement design, not yet computed by the platform.

No part of this section should be read as claiming automation that does not exist.

---

## 11. Examples

Concrete lessons, each routed to its correct durable home, written with source and rationale intact.

**Routed to a Company Standard (binds every relevant role).**

> *From a recurring review finding across three PRs by different authors:* "Optional chaining used to silence a real null case rather than handle it." → Written as a coding standard and a Review checklist item: "Optional chaining must not be used to suppress a null case that requires handling; flag as blocking." Source: review log, sprint 7 (3 linked instances). Confidence: high.

**Routed to Employee Memory (informs one role).**

> *From sprint retrospectives:* "Tasks touching the auth middleware run ~1.5× the initial estimate because of the cross-cutting test surface." → Written to the **Tech Lead's** employee memory as an estimation-calibration record. Source: sprint 5–8 retrospective. Confidence: medium. *(It informs only the Tech Lead's estimates; it is not a company rule.)*

**Routed to an SOP (changes a workflow gate).**

> *From a production incident traced to an un-applied migration:* → Added to [RELEASE.md](../sops/RELEASE.md) as a release-readiness item: "Confirm pending migrations are applied in the target environment before deploy." Source: incident #INC-… root cause. *(The next release cannot reach the deploy step without it — the strongest enforcement.)*

**Routed to a Decision Framework (changes a class of decisions).**

> *From a dependency abandoned upstream that stranded the company:* → Added to [DEPENDENCY_CHOICE_DECISION_FRAMEWORK.md](../decision-frameworks/DEPENDENCY_CHOICE_DECISION_FRAMEWORK.md) as a criterion: "Reject a dependency whose maintenance has lapsed beyond the agreed staleness threshold, regardless of feature fit." Recorded as a [Decision](../systems/DECISION_SYSTEM.md). *(It shapes every future dependency choice, not just this one.)*

**Counter-example — a lesson misrouted.**

> "All interfaces must meet the company accessibility standard." Filing this in the Frontend Engineer's employee memory is a **misroute**: it binds every engineering role, so it is a **Company Standard**. Left as one role's preference, other roles ignore it. The routing test — *who must obey?* — sends it upward ([Section 6.5](#65-the-routing-rule)).

---

## 12. Anti-Patterns

**Misrouting a company-wide rule as a role preference.** Filing a rule that binds everyone in one role's employee memory. It fragments the standard and lets other roles ignore it. The test is *who must obey* — more than one role means it is a standard, never a preference ([Section 6.5](#65-the-routing-rule)).

**The lesson that lives only in conversation.** A review finding or incident produces a clear lesson, discussed and understood, but never written into any durable home. The next time the situation arises, the company re-derives it from scratch. A lesson that is not written did not happen ([Section 5](#5-the-learning-lifecycle)).

**Premature standardization.** Promoting a single occurrence straight to a binding standard. The company accumulates rules from anecdotes, the standard set bloats, and engineers stop respecting any of it. Promotion requires linked recurrence across independent work items ([Section 8](#8-validation)).

**The standard nothing enforces.** Writing a standard, SOP step, or framework criterion that no gate, workflow, or decision actually consults. It becomes documentation that makes the company *feel* like it learned without changing behavior. Enforceability is a validation rule; adoption, not writing, is completion.

**Copying a lesson into every home.** Writing the same rule as a standard *and* an employee memory *and* an SOP step. The copies drift apart and ownership fragments. One authoritative home; other surfaces reference it ([Section 6.5](#65-the-routing-rule)).

**The silent reversal.** Editing a standard's or framework criterion's meaning in place, so the change has no rationale and no history. Meaning changes are supersessions with a recorded reason, never in-place edits ([Section 9](#9-durability--preventing-repeated-avoidable-failures)).

**Standard-set rot.** Adding durable changes but never retiring obsolete ones. Years of accumulated, sometimes contradictory rules make the standard set, SOPs, and frameworks impossible to follow. Pruning is part of ownership ([Section 7](#7-ownership)).

**Metrics gaming.** Optimizing the count of records written, mistaking activity for learning. The engine is judged on recurrence reduction and adoption, not volume ([Section 9](#9-durability--preventing-repeated-avoidable-failures)).

---

## 13. Definition of Done

A durable change produced by the Learning Engine is **done** when:

1. It is **evidenced** — it links to the work that produced it; a standard or framework change links to ≥2 independent instances.
2. It is **routed correctly** — written to the one home its binding power demands ([Section 6.5](#65-the-routing-rule)), not misfiled and not duplicated across homes.
3. It is **actionable** — states what to do or not do, checkable without interpretation.
4. It is **enforceable and enforced** — it names its enforcement surface (gate, workflow step, framework criterion, or role read step) and that surface is updated in the same change.
5. It carries its **source** and, where applicable, its **confidence**, so the chain from outcome to change is intact.
6. If it replaces an existing rule, the prior version is **superseded** (marked and linked), not deleted.
7. It does **not contradict** an active standard, SOP step, or framework criterion; any conflict was resolved by supersession rather than left standing.

The Learning Engine as a whole is **healthy** when a lesson the company paid for once does not recur — when a future invocation that touches the domain cannot avoid consulting the change, the reasoning behind it survives intact, and recurrence of the original failure measurably declines.

---

## 14. Relationship to Other Documents

- **[CONTINUOUS_IMPROVEMENT_SYSTEM.md](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md)** — owns improvement governance: the signal→insight→pattern→standard lifecycle, the promotion gate, retrospective cadence, and KPIs. The Learning Engine executes the durable write that system authorizes; it does not re-own the governance.
- **[ORGANIZATIONAL_MEMORY_SYSTEM.md](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md)** — owns the record model, the six memory layers, read precedence, and supersession. The Learning Engine routes lessons into those layers and inherits their rules.
- **[KNOWLEDGE_LIBRARY_SYSTEM.md](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md)** — owns the curated, authoritative standard tier. Promotion from Memory to a published standard lands here.
- **[COMPANY_MEMORY.md](./COMPANY_MEMORY.md)** and **[EMPLOYEE_MEMORY.md](./EMPLOYEE_MEMORY.md)** — the company-wide and role-scoped homes two of the four update targets write into; this document references their write and validation rules rather than restating them.
- **[SOPs](../sops/)** — the workflows whose steps and gates learning amends, and whose memory-update phases ([NEW_FEATURE.md Phase 8](../sops/NEW_FEATURE.md)) are the natural moment to feed learning back.
- **[decision-frameworks/](../decision-frameworks/)** — the frameworks whose criteria learning amends; framework changes are recorded as Decisions.
- **[DECISION_SYSTEM.md](../systems/DECISION_SYSTEM.md)** — records the decision to adopt, supersede, or retire a durable change that accepts risk.
- **[REVIEW_SYSTEM.md](../systems/REVIEW_SYSTEM.md)** and **[PLANNING_SYSTEM.md](../systems/PLANNING_SYSTEM.md)** — primary signal sources and enforcement surfaces for adopted standards and heuristics.
- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)** and **[TECHNICAL_ARCHITECTURE.md](../architecture/TECHNICAL_ARCHITECTURE.md)** — define the Memory, Knowledge, Review, QA, and Incident objects and module boundaries the engine reads from and writes to.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — defines the runtime that emits the signals this engine learns from and that will, when built, write durable changes as a byproduct of work.
