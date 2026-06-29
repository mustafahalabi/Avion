# Architecture Decision Framework — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

This document is the decision framework the Engineering department applies to **architecture decisions** — choices about system structure, technology selection, and design patterns that affect multiple modules and are costly to reverse. It defines how the company evaluates such a choice, what it must consider, who decides it, when it must be approved, and how it is recorded.

This framework is a specialization, not a new authority. The [Decision System](../systems/DECISION_SYSTEM.md) defines how *any* decision moves through the company — its lifecycle, owners, approvers, reasoning format, and memory rules. This document supplies the **architecture-specific evaluation logic** that the Decision System refers to as "the department decision framework." Where the two overlap, the Decision System governs the process and this document governs the judgment.

This document is implementation-neutral. It defines how to reason about architecture, not which framework, language, database, or vendor to choose. It names no required tool. A decision made with this framework is recorded against the [Domain Model](../architecture/DOMAIN_MODEL.md) objects (Decision, Decision Record, Memory) and, when foundational, written as an [ADR](../adr/ADR-001-execution-runtime-and-memory-retrieval.md).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Relationship to the Decision System](#3-relationship-to-the-decision-system)
4. [Decision Criteria](#4-decision-criteria)
5. [Priority Order and the Tradeoff Model](#5-priority-order-and-the-tradeoff-model)
6. [Required Questions](#6-required-questions)
7. [Risk Scoring](#7-risk-scoring)
8. [Authority — Tech Lead Decides vs. CTO Approves](#8-authority--tech-lead-decides-vs-cto-approves)
9. [Approval Triggers](#9-approval-triggers)
10. [Output Format — the Architecture Decision Brief](#10-output-format--the-architecture-decision-brief)
11. [Worked Examples](#11-worked-examples)
12. [Anti-Patterns](#12-anti-patterns)
13. [Relationship to Other Documents](#13-relationship-to-other-documents)

---

## 1. Purpose

Architecture decisions are the most expensive decisions the company makes. They are made early, they touch every module, and they are the hardest to reverse once code depends on them. A good architecture decision compounds — every future feature is easier. A bad one compounds the other way — every future feature pays a tax.

This framework exists so that architecture decisions are **repeatable, defensible, and remembered** rather than improvised. It gives the Tech Lead and the CTO a shared method so that two different engineers, facing the same choice with the same context, reason in the same order, ask the same questions, and reach a decision they can both defend.

The framework has three jobs:

1. **Make the reasoning repeatable.** The same criteria, in the same priority order, every time. A decision is not "my preference" — it is the output of a method any employee can re-run.
2. **Force alternatives and reasoning.** No architecture decision is complete without the options that were rejected and the specific trade-off that disqualified each. A conclusion without alternatives is a default, not a decision (see [Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives)).
3. **Route the decision to the right authority.** Most technical-approach choices are the Tech Lead's to make. Choices that change the architecture beyond its current bounds are the CTO's to approve. This framework draws that line precisely so neither over-escalation nor silent over-reach happens.

This aligns directly with the [Company Playbook](../company/COMPANY_PLAYBOOK.md): *Architecture beats hacks. Long-term quality beats short-term speed. Every action should reduce future work.*

---

## 2. Scope

**In scope.** Decisions that shape system structure and are costly to reverse:

- System and module boundaries — what owns what, how components are decomposed, where responsibilities live.
- Technology selection at a structural level — adopting a class of dependency, a storage model, a runtime model, a queue model, an integration pattern.
- Cross-cutting patterns — how the system handles persistence, eventing, retries, authentication, error handling, and observability *as conventions*, not as one-off implementations.
- Data model and contract design that multiple modules depend on.
- Provider-independence and replaceability decisions — what the company commits to versus what it keeps swappable (see [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md)).

**Out of scope.** Local implementation choices that are an engineer's job to make and that this framework would only slow down:

- Variable names, file layout, and internal structure within a single module.
- Choosing between two equivalent existing patterns already approved for the codebase.
- Test-case selection, log message wording, and other reversible local detail.

The dividing line is the same one the [Decision System §2](../systems/DECISION_SYSTEM.md#2-scope) draws: **consequence and reversibility**. If the choice constrains future work across modules, is expensive to undo, or sets a convention others must follow, it is an architecture decision and this framework applies. If it is local, reversible, and within one engineer's domain, it is a technical-approach detail and the framework would be ceremony.

---

## 3. Relationship to the Decision System

This framework does not restate the Decision System. It plugs into it. The mapping is exact:

| Concern | Owned by | Reference |
|---|---|---|
| Decision lifecycle (identified → framed → evaluated → decided → recorded → remembered) | Decision System | [§4](../systems/DECISION_SYSTEM.md#4-decision-lifecycle) |
| Owner and approver assignment | Decision System | [§5](../systems/DECISION_SYSTEM.md#5-owners-and-approvers) |
| Required reasoning format (Recommendation → Reasoning → Risks → Alternatives → Confidence → Next action) | Decision System | [§8](../systems/DECISION_SYSTEM.md#8-required-reasoning-format) |
| Decision record fields and immutability | Decision System | [§9](../systems/DECISION_SYSTEM.md#9-decision-record-format) |
| Memory update and supersession rules | Decision System | [§13](../systems/DECISION_SYSTEM.md#13-memory-updates) |
| **How to evaluate an architecture choice** | **This framework** | §4–§7 |
| **When the Tech Lead decides vs. the CTO approves** | **This framework** | §8–§9 |
| **What an architecture decision brief contains** | **This framework** | §10 |

In short: the Decision System tells you *that* an architecture decision must be framed, reasoned, owned, approved where required, recorded, and remembered. This framework tells you *how to do the framing and reasoning well* for architecture specifically.

---

## 4. Decision Criteria

Every architecture decision is evaluated against six criteria. These are not a scorecard to be averaged — they are dimensions every option must be examined on, in the priority order defined in [§5](#5-priority-order-and-the-tradeoff-model). An option that is strong on five and silently fatal on one is not a strong option.

| # | Criterion | The question it answers | What "good" looks like |
|---|---|---|---|
| 1 | **Maintainability** | Can a future engineer understand, change, and extend this safely? | Clear boundaries, consistent with existing patterns, low coupling, no hidden state, documented intent. |
| 2 | **Scalability** | Does this hold up as load, data, team size, and feature count grow? | Headroom for realistic growth; no structural ceiling that forces a rewrite at the next milestone. |
| 3 | **Security** | What is the blast radius if this is wrong or abused? | Least privilege, no new secret-handling burden, no new trust boundary crossed silently, fails closed. |
| 4 | **Simplicity** | Is this the simplest structure that satisfies the requirement? | Few moving parts, justifiable complexity, nothing added "in case." Complexity must earn its place. |
| 5 | **Observability** | When this breaks in production, can the company see why? | Failures are detectable, attributable, and explainable; the design exposes its state rather than hiding it. |
| 6 | **Long-term cost** | What does this cost to own over five years, not one sprint? | Operational, cognitive, dependency, and migration cost are all accounted for — not just time-to-first-commit. |

**Notes on each criterion:**

- **Maintainability** is weighted first because the company optimizes for the engineers who come after, not the one writing the code today. *Readable beats clever; consistency beats novelty* ([Company Playbook](../company/COMPANY_PLAYBOOK.md)).
- **Scalability** is judged against *realistic* growth, not imagined growth. Designing for a scale the product will never reach is itself a maintainability and cost failure. See the anti-pattern *Architecting for imaginary scale* in [§12](#12-anti-patterns).
- **Security** is never traded away for speed. A decision that weakens a trust boundary is a security exception and is governed by the [Security Engineer's blocking authority](../systems/DECISION_SYSTEM.md#14-relationship-to-roles), not by this framework's trade-off logic.
- **Simplicity** is the company's tie-breaker value. When two options are otherwise comparable, the simpler one wins — *Simplicity wins; complexity must justify itself.*
- **Observability** is a first-class criterion, not an afterthought bolted on later. An architecture that cannot be observed cannot be operated, and an unobservable failure is an [Incident](../architecture/DOMAIN_MODEL.md#incident) waiting to happen.
- **Long-term cost** is the criterion most often skipped under deadline pressure and the one this framework most insists on. It includes the cost of *removing* the choice later.

---

## 5. Priority Order and the Tradeoff Model

Criteria conflict. The simplest option may not be the most scalable; the most observable may add cost. The framework resolves conflict with an explicit **priority order**, not a weighted average, because averaging hides fatal weaknesses behind strong scores elsewhere.

### Priority order

The company's decision priority, inherited from the [Company Playbook](../company/COMPANY_PLAYBOOK.md) and specialized for architecture:

```
User Value
   ↓
Security & Correctness   (a wrong or unsafe answer has no value)
   ↓
Maintainability          (the cost paid by every future engineer)
   ↓
Scalability & Performance
   ↓
Observability            (we must be able to operate what we build)
   ↓
Simplicity               (the tie-breaker; the default when equal)
   ↓
Delivery Speed
```

**How to read it:** a higher criterion is only traded for a lower one when the higher one is genuinely satisfied, never to rescue a lower one. Delivery speed never overrides security or correctness. Simplicity is the tie-breaker: when two options are comparable on everything above it, the simpler one wins by default and the burden of proof is on the more complex option.

### The tradeoff model

Every architecture decision is, explicitly, a trade. The model has four steps:

1. **Name the forces.** State the requirement and the constraints that create tension — the reason a decision is needed at all. If there is no tension, there is no decision; pick the obvious option and move on.
2. **Generate at least two real alternatives.** "Do nothing / keep the status quo" is always a valid and often the correct alternative, and it must be considered explicitly. A decision with only one option on the table is a default in disguise (see [§12](#12-anti-patterns)).
3. **Evaluate each alternative against all six criteria in priority order.** Stop at the first criterion where an option is fatally weak — a fatal weakness on a high-priority criterion eliminates the option regardless of how it scores below.
4. **Record the trade you accepted.** State plainly what the chosen option gives up. Every architecture decision sacrifices something; a decision that claims to sacrifice nothing has not been examined honestly.

The output of the model is never "Option A is best." It is "Option A, accepting [named trade], because it satisfies [higher criteria] where Option B fails on [specific criterion]." That sentence is the spine of the decision record.

---

## 6. Required Questions

Before an architecture decision is recorded, the owner must be able to answer every question below. These are mandatory. An unanswered question is a gap in the decision, not a detail to fill in later. They map directly onto the criteria in [§4](#4-decision-criteria) and the reasoning format in [Decision System §8](../systems/DECISION_SYSTEM.md#8-required-reasoning-format).

**Framing**
1. What requirement or constraint forces this decision? What breaks if we do nothing?
2. What is the blast radius — how many modules, how many future features does this touch?
3. Is this reversible? If we are wrong, what does it cost to undo, and when is the last cheap moment to change our mind?

**Memory and consistency**
4. Has the company already decided something relevant? (Retrieval is mandatory — see [Decision System §13](../systems/DECISION_SYSTEM.md#13-memory-updates).) Does this contradict an existing decision, and if so, are we superseding it deliberately?
5. Does this follow an existing pattern in the codebase, or introduce a new one? If new, why is the existing pattern insufficient?

**Evaluation**
6. What are the alternatives, including "keep the status quo"? Why is each rejected? (Mandatory — [Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives).)
7. How does the chosen option score against each of the six criteria, in priority order?
8. What does the chosen option give up? What is the named trade?

**Operability and cost**
9. How will we know in production when this is working — and when it is failing?
10. What does this cost to own over the next five years, including the cost to remove it?

**Authority**
11. Does this stay within the current architecture, or change it beyond current bounds? (This determines who approves — see [§8](#8-authority--tech-lead-decides-vs-cto-approves).)
12. Does it cross a trust boundary, accept a high-severity risk, or deviate from policy? (This triggers a mandatory gate — see [§9](#9-approval-triggers).)

A decision that cannot answer questions 4, 6, and 11 is returned to the owner. Those three are the difference between a remembered, defensible architecture decision and an improvisation.

---

## 7. Risk Scoring

Risk is a first-class part of every architecture decision, not a closing caveat. This framework uses the company's standard risk attributes — **severity**, **description**, **mitigation**, **owner role** — defined in [Decision System §11](../systems/DECISION_SYSTEM.md#11-risk-notes), and adds a lightweight scoring step so the owner and approver agree on how serious a risk is before the decision is made.

### Scoring an individual risk

Each risk attached to an architecture option is scored on two axes:

| Axis | Levels | Meaning |
|---|---|---|
| **Likelihood** | low / medium / high | How probable is it that the risk materializes under realistic conditions? |
| **Impact** | low / medium / high / critical | If it materializes, how bad is the consequence to correctness, security, or the ability to deliver? |

The two combine into a single **severity** that drives the response:

| Severity | Typical combination | Required response |
|---|---|---|
| **Low** | low impact, any likelihood | Note it in the record; no mitigation required. |
| **Medium** | medium impact, or high-likelihood low-impact | Document an explicit mitigation and an owner role. |
| **High** | high impact, medium+ likelihood; or any **critical**-impact risk | Mitigation is mandatory **and** acceptance is a separate, recorded decision — see below. |

### Risk acceptance is its own decision

Accepting a high-severity architecture risk is never silent and never bundled invisibly into the design choice. Per [Decision System §11](../systems/DECISION_SYSTEM.md#11-risk-notes):

- **Technical risk** is accepted by the **CTO**.
- **Business risk** is framed by the CTO and accepted by the **CEO**.
- A **security** risk that crosses a trust boundary is a security exception — it is held by the [Security Engineer](../systems/DECISION_SYSTEM.md#14-relationship-to-roles) and proceeds only on a CTO-authorized, recorded exception. It is not a trade this framework can make on its own.

### How risk feeds the decision

The scored risks for every alternative are part of the trade-off model ([§5](#5-priority-order-and-the-tradeoff-model)), not a separate exercise. An option whose only path to viability requires accepting a high-severity risk is weaker than an option that does not — and the decision record must show that the approver saw the risk *before* the choice was made, exactly as the [planner surfaces a risk register into every plan the CEO reviews](../systems/DECISION_SYSTEM.md#15-what-engineering-os-implements-today).

---

## 8. Authority — Tech Lead Decides vs. CTO Approves

Architecture decisions are **owned by the Tech Lead and approved by the CTO** — but only some of them require approval. The frequent case is the Tech Lead deciding alone; the consequential case is the CTO approving. Drawing this line precisely is the point of this section, because both failure modes are real: a Tech Lead who escalates everything trains the CTO to rubber-stamp, and a Tech Lead who escalates nothing makes architecture decisions the CTO should own.

| Decision character | Owner (frames + proposes) | Authority to decide | Recorded as |
|---|---|---|---|
| **Technical approach within the approved architecture** — reusing an existing pattern, sequencing work, choosing among already-sanctioned options | Tech Lead | **Tech Lead decides** | Memory record (category `decision`) |
| **A new pattern or dependency local to one module**, fully reversible, no new trust boundary | Tech Lead | **Tech Lead decides**, records the rationale | Memory record |
| **A change to the architecture beyond its current bounds** — new module boundary, new cross-cutting pattern, new structural dependency, change to a contract many modules depend on | Tech Lead | **CTO approves** | Decision record / ADR |
| **Provider-independence or replaceability commitment** — committing to or removing a swappable boundary | Tech Lead | **CTO approves** | ADR |
| **Any option that requires accepting a high-severity technical risk** | Tech Lead | **CTO approves** (acceptance is the CTO's per [§7](#7-risk-scoring)) | Decision record + risk record |
| **Anything crossing a trust boundary or deviating from security policy** | Security Engineer flags; Tech Lead frames | **CTO approves**, on Security Engineer input | Decision record + security exception |

This mirrors [Decision System §5](../systems/DECISION_SYSTEM.md#5-owners-and-approvers) exactly: *Architecture → owner Tech Lead, approver CTO; Technical approach → Tech Lead decides.* The escalation path is the company reporting structure — Engineering → Tech Lead → CTO → CEO.

**The test.** A Tech Lead asks one question to decide whether to escalate: *"Does this change the architecture, or work within it?"* Working within it — the Tech Lead decides and records. Changing it beyond current bounds — the Tech Lead frames a recommendation in the [required reasoning format](../systems/DECISION_SYSTEM.md#8-required-reasoning-format) and routes it to the CTO. The Tech Lead never escalates a blank question; they escalate a recommendation the CTO can confirm or redirect.

**The CEO is never asked to choose between technical options.** Architecture decisions reach the CEO only as *outcomes* — and only when an architecture choice changes scope, accepts a business risk, or affects an outcome the CEO submitted. The CEO sees "this approach adds two weeks but removes a class of future failures," never "adopt a DB-backed queue versus a dedicated queue service." See [Decision System §14](../systems/DECISION_SYSTEM.md#14-relationship-to-roles).

---

## 9. Approval Triggers

Some architecture decisions require CTO approval **regardless of autonomy level** because they cross a mandatory gate. These are not subject to the trust model — raising the company's autonomy does not waive them. They restate, for architecture, the mandatory gates in [Decision System §6](../systems/DECISION_SYSTEM.md#6-which-decisions-require-approval).

**Always requires CTO approval, at any autonomy level:**

- A change to the system architecture beyond its current bounds.
- Introducing a new structural dependency or a new cross-cutting pattern.
- Crossing or weakening a trust boundary (also a security exception — Security Engineer involved).
- Accepting a high-severity technical risk to make an option viable.
- Removing or committing a provider-independence / replaceability boundary.

**Requires CEO involvement (framed by the CTO):**

- An architecture decision that materially changes the scope, timeline, or cost of an outcome the CEO submitted — surfaced as a business-level trade, not a technical one.
- Acceptance of a business risk created by an architecture choice.

**Stays with the Tech Lead (no approval gate):**

- Technical-approach decisions within the approved architecture.
- Reversible, module-local choices with no new trust boundary and no high-severity risk.

A useful rule: **if the decision is hard to reverse and touches more than one module, assume it needs CTO approval until shown otherwise.** The cost of an unnecessary approval is a few minutes; the cost of an unapproved architecture change is paid for years.

Note the distinction from execution authorizations: the autonomy policy that gates *agentic actions* (running the agent, pushing, opening a PR, merging) is enforced in code and described in [Decision System §7](../systems/DECISION_SYSTEM.md#7-autonomy-and-the-approval-gate). This section governs the *human architecture decision*, which is a documented practice, not a code-enforced gate.

---

## 10. Output Format — the Architecture Decision Brief

Every architecture decision produces a written record. For routine, in-architecture decisions this is a memory record (category `decision`); for foundational, architecture-changing decisions it is an **Architecture Decision Record (ADR)** — see [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md) for the canonical example. Both use the same field set, which is the [Decision System §9](../systems/DECISION_SYSTEM.md#9-decision-record-format) record format specialized for architecture.

### The Architecture Decision Brief

| Field | Content |
|---|---|
| **Title** | A one-line statement of the decision (e.g., "Standardize cross-module eventing on a single persisted queue"). |
| **Status** | `decided`, `superseded`, or `reversed`. |
| **Owner / Approver** | Tech Lead (owner); CTO when approval was required. |
| **Date** | When the decision was made. |
| **Context / Forces** | The requirement and the tension that made a decision necessary. What breaks if we do nothing. |
| **Decision** | The choice itself, stated unambiguously. |
| **Criteria evaluation** | How the chosen option scores against the six criteria in priority order ([§4](#4-decision-criteria), [§5](#5-priority-order-and-the-tradeoff-model)). |
| **Alternatives rejected** | Each genuine alternative — including the status quo — and the **specific** trade-off that disqualified it. |
| **Trade accepted** | What the chosen option gives up. Stated plainly; never "none." |
| **Risks** | Each risk with severity, mitigation, and owner role ([§7](#7-risk-scoring)). High-severity risks show who accepted them. |
| **Consequences** | What this constrains or enables for future work. |
| **Supersedes / Superseded by** | Links to prior or subsequent decisions, when applicable. |

**Format rules** (inherited from [Decision System §9](../systems/DECISION_SYSTEM.md#9-decision-record-format)):

- **Plain language.** A brief is understandable by any employee, not only the author. *Documentation is engineering* ([Company Playbook](../company/COMPANY_PLAYBOOK.md)).
- **Immutable in intent.** A brief is never edited to change the decision. A new record supersedes it and links back; the original alternatives and dissent are preserved.
- **Self-contained.** A reader understands the decision and why it was made without reconstructing the conversation around it.
- **Written to memory.** Every brief is stored as company memory so future work references it instead of re-deriving or contradicting it ([Decision System §13](../systems/DECISION_SYSTEM.md#13-memory-updates)).

---

## 11. Worked Examples

These examples show the framework applied end to end. They are illustrative reasoning, not records of specific shipped decisions.

### Example A — A decision the Tech Lead makes alone

**Situation.** A new feature needs to react to a change in another module. The codebase already has an approved eventing pattern.

**Framing.** Forces: the feature must respond to an upstream change. Blast radius: one module. Reversible: yes. Memory: an approved eventing pattern exists.

**Evaluation.** Reusing the existing pattern scores well on maintainability (consistent with the codebase) and simplicity (no new machinery). The only alternative — a bespoke listener local to this feature — is more complex and inconsistent for no gain.

**Authority.** Works *within* the approved architecture. **Tech Lead decides**, records a memory record. No CTO approval. Escalating this would be over-escalation.

### Example B — A decision the CTO must approve

**Situation.** Several modules have grown ad-hoc ways of reacting to changes. The Tech Lead proposes standardizing on a single persisted, cross-module eventing mechanism.

**Framing.** Forces: divergent eventing is becoming a maintainability and observability problem. Blast radius: every module. Reversible: expensive — modules will be rewired to depend on it.

**Evaluation (priority order).** Correctness: a persisted queue is durable and recoverable. Maintainability: one pattern replaces many — strong. Scalability: holds for realistic load. Observability: every event becomes an auditable record — strong. Simplicity: more machinery than today, but it *removes* net complexity by consolidating. Trade accepted: more upfront infrastructure and a migration cost now, to remove a recurring tax later.

**Risk.** Migration risk — medium (medium impact, medium likelihood); mitigated by migrating module-by-module behind the existing interfaces. Owner role: Tech Lead.

**Authority.** Changes the architecture beyond current bounds and introduces a cross-cutting pattern → **CTO approves.** The Tech Lead frames a recommendation in the required reasoning format; the CTO confirms. Recorded as an ADR. This is the shape of the real decision in [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md).

### Example C — A decision that escalates to the CEO

**Situation.** Meeting a non-functional requirement properly would add two weeks to an outcome the CEO submitted; a quick alternative ships on time but accepts a high-severity operational risk.

**Framing.** This is no longer purely technical — it is a business trade between time and risk.

**Authority.** The high-severity risk acceptance and the schedule impact make this a **business risk framed by the CTO and accepted by the CEO** ([§7](#7-risk-scoring), [§9](#9-approval-triggers)). The CEO is shown the *outcome trade* — "two weeks, or ship now and carry a real chance of a production failure of this kind" — never the technical options. The CEO decides; the decision and its risk are recorded.

---

## 12. Anti-Patterns

Each anti-pattern below is a recurring way architecture decisions go wrong. They specialize the failure modes in [Decision System §16](../systems/DECISION_SYSTEM.md#16-failure-modes) for architecture.

### Resume-driven / novelty-driven architecture
A technology is chosen because it is new or interesting, not because it best satisfies the criteria. **Caught when:** the reasoning cites the technology's appeal rather than the requirement. **Response:** *Consistency beats novelty.* The decision must show why the existing pattern is insufficient before a new one is adopted.

### Architecting for imaginary scale
The design optimizes for a scale the product will not reach for years, paying maintainability and cost now for headroom never used. **Caught when:** the scalability justification cites no realistic growth number. **Response:** scalability is judged against realistic growth. Over-design is a simplicity and cost failure, not prudence.

### The decision with one option
A conclusion is presented with no genuine alternatives, including no "keep the status quo." **Caught when:** the brief's alternatives section is empty or a token list. **Response:** a decision without alternatives is a default — it is returned to the owner ([Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives)).

### The silent architecture change
A consequential structural choice is made mid-implementation and never escalated or recorded. **Caught when:** two modules embody opposite structural assumptions and no record explains either. **Response:** an architecture change beyond current bounds requires CTO approval and a record. *A decision that is not recorded did not happen.*

### Speed overriding correctness or security
Delivery pressure is used to justify trading away a higher-priority criterion. **Caught when:** the trade accepted is a security or correctness weakness "to hit the date." **Response:** the priority order ([§5](#5-priority-order-and-the-tradeoff-model)) is not negotiable downward. Security and correctness are never traded for speed; a security trade is a CTO-authorized exception, not a Tech Lead's call.

### Trade-off denial
A decision claims to give up nothing. **Caught when:** the "trade accepted" field reads "none." **Response:** every architecture decision sacrifices something. A decision with no stated trade has not been examined honestly and is returned for a real evaluation.

### Unobservable by design
A structure ships with no way to see its state or failures in production. **Caught when:** the operability questions ([§6](#6-required-questions), Q9) cannot be answered. **Response:** observability is a first-class criterion. An architecture that cannot be operated is not done.

### Re-litigating settled trade-offs
An option that was already considered and rejected is proposed again with no new information. **Caught when:** no one can say why the prior decision chose otherwise — because memory was not consulted. **Response:** retrieval before deciding is mandatory ([§6](#6-required-questions), Q4). Reversing a prior decision is legitimate only with new conditions, and it supersedes the original rather than ignoring it.

---

## 13. Relationship to Other Documents

- **[Decision System](../systems/DECISION_SYSTEM.md)** — the governing process for all decisions: lifecycle, owners and approvers, reasoning format, record format, risk notes, and memory. This framework is the architecture-specific *judgment* the Decision System refers to as "the department decision framework."
- **[Company Playbook](../company/COMPANY_PLAYBOOK.md)** — the company values this framework operationalizes: *Architecture beats hacks; simplicity wins; consistency beats novelty; documentation is engineering; every action should reduce future work.*
- **[Domain Model](../architecture/DOMAIN_MODEL.md)** — defines the Decision, Decision Record, Risk, Memory, and Incident objects that architecture decisions are recorded against.
- **[ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md)** — the canonical worked example of a foundational architecture decision recorded with this framework's output format.
- **[Company Runtime](../architecture/COMPANY_RUNTIME.md)** — defines escalation and approval behavior at the runtime level; this framework specializes the architecture-decision portion of it.
- **[GitHub Workflow Foundation](../architecture/GITHUB_WORKFLOW_FOUNDATION.md)** — defines the guardrails that bound execution; architecture decisions may never propose a structure that depends on overriding an invariant.
- **Engineering OS Specification v1.0** (planned) — will formalize the decision model and unlock AI-assisted decision framing; until then this framework is the authoritative method for architecture decisions, applied by the Tech Lead and CTO.
