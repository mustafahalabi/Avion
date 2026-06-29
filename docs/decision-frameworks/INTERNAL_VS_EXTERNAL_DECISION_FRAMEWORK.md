# Internal vs External Solution Decision Framework — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

This document is the decision framework the company applies when a capability is needed and there is more than one way to obtain it: **build it internally**, **buy a managed service**, **adopt a library or open-source dependency**, or **defer** — choose to not solve the problem yet. It is the company's "build vs. buy" framework, generalized to the four real options Engineering OS actually faces.

This framework is a specialization, not a new authority. The [Decision System](../systems/DECISION_SYSTEM.md) defines how *any* decision moves through the company — its lifecycle, owners, approvers, reasoning format, record format, and memory rules. This document supplies the **sourcing-specific evaluation logic** that the Decision System refers to as "the department decision framework." Where the two overlap, the Decision System governs the process and this document governs the judgment.

This document is implementation-neutral. It defines how to reason about where a capability should come from — not which vendor, library, or service to pick in any given case. A decision made with this framework is recorded against the [Domain Model](../architecture/DOMAIN_MODEL.md) objects (Decision, Decision Record, Risk, Memory) and, when it commits or removes a replaceability boundary, written as an [ADR](../adr/ADR-001-execution-runtime-and-memory-retrieval.md).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Relationship to the Decision System](#3-relationship-to-the-decision-system)
4. [The Four Options](#4-the-four-options)
5. [Evaluation Criteria](#5-evaluation-criteria)
6. [The Cost Model](#6-the-cost-model)
7. [The Risk Model](#7-the-risk-model)
8. [Required Questions](#8-required-questions)
9. [Ownership Model — Who Decides, Who Is Consulted](#9-ownership-model--who-decides-who-is-consulted)
10. [Approval Triggers](#10-approval-triggers)
11. [Output Format — the Sourcing Decision Brief](#11-output-format--the-sourcing-decision-brief)
12. [Worked Examples](#12-worked-examples)
13. [Anti-Patterns](#13-anti-patterns)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

Most capabilities the company needs can be obtained in more than one way, and the cheapest way to obtain something is rarely the cheapest way to *own* it. A library that saves a week now can cost a quarter when it is abandoned upstream. A managed service that ships a feature today can become the thing the whole product is hostage to tomorrow. Code written internally to "just get it done" becomes a permanent maintenance line item that no vendor will ever patch for free.

This framework exists so that sourcing decisions — **build, buy, adopt, or defer** — are **repeatable, defensible, and remembered** rather than decided by whoever happened to be at the keyboard. It gives Product, the CTO, the Tech Lead, Security, and Engineering a shared method so that the same capability, evaluated by two different employees with the same context, reaches the same answer for the same stated reasons.

The framework has four jobs:

1. **Make the reasoning repeatable.** The same criteria, the same cost model, the same risk model, in the same priority order, every time. A sourcing decision is not "I'd rather not depend on a vendor" or "I'd rather not maintain this" — it is the output of a method any employee can re-run.
2. **Cost the full lifetime, not the first commit.** The framework's center of gravity is the [cost model](#6-the-cost-model): the five-year cost of ownership, including the cost to *remove* the choice later. *Every action should reduce future work* ([Company Playbook](../company/COMPANY_PLAYBOOK.md)).
3. **Force alternatives and the named trade.** No sourcing decision is complete without the options that were rejected — including "do nothing" — and the specific trade-off that disqualified each. A conclusion without alternatives is a default, not a decision (see [Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives)).
4. **Route the decision to the right authority.** Adopting a small reversible library is the Tech Lead's call. Committing the product to an external service, or building a system the company will own forever, is the CTO's — and when it changes scope, cost, or risk the CEO sees a business trade, never a technical one.

This operationalizes the [Company Playbook](../company/COMPANY_PLAYBOOK.md) directly: *Simplicity wins; complexity must justify itself. Long-term quality beats short-term speed. Every improvement should make future projects easier. Architecture beats hacks.*

---

## 2. Scope

**In scope.** Any decision about *where a capability comes from* when more than one source is viable:

- **Build internally** — write and own the capability inside the codebase.
- **Buy** — depend on an external managed service or paid platform (hosting, auth, monitoring, an LLM provider, a queue service).
- **Adopt** — pull in an open-source library or framework as a dependency.
- **Defer** — decide the problem does not need solving yet, and record that as a deliberate choice rather than an oversight.

This includes adopting a *class* of dependency, committing the product to a provider, replacing an internal capability with an external one (or the reverse), and choosing to keep a boundary swappable versus committing to it. These overlap heavily with structural choices, so a sourcing decision that also changes system structure is **co-governed** by the [Architecture Decision Framework](./ARCHITECTURE_DECISION_FRAMEWORK.md): this framework decides *where the capability comes from*; that one decides *how it is structured into the system*.

**Out of scope.** Local, reversible choices that this framework would only slow down:

- Choosing between two libraries already approved for the codebase for the same purpose.
- A trivial, single-use utility an engineer writes inline rather than pulling a dependency for.
- Picking which already-sanctioned internal module to call.

The dividing line is the same one the [Decision System §2](../systems/DECISION_SYSTEM.md#2-scope) draws: **consequence and reversibility**. If the choice creates a lasting dependency, commits the product to an external party, adds a maintenance obligation the company carries for years, or is expensive to undo, this framework applies. If it is local, reversible, and within one engineer's domain, the framework would be ceremony.

---

## 3. Relationship to the Decision System

This framework does not restate the Decision System. It plugs into it. The mapping is exact:

| Concern | Owned by | Reference |
|---|---|---|
| Decision lifecycle (identified → framed → evaluated → decided → recorded → remembered) | Decision System | [§4](../systems/DECISION_SYSTEM.md#4-decision-lifecycle) |
| Owner and approver assignment | Decision System | [§5](../systems/DECISION_SYSTEM.md#5-owners-and-approvers) |
| Required reasoning format (Recommendation → Reasoning → Risks → Alternatives → Confidence → Next action) | Decision System | [§8](../systems/DECISION_SYSTEM.md#8-required-reasoning-format) |
| Decision record fields and immutability | Decision System | [§9](../systems/DECISION_SYSTEM.md#9-decision-record-format) |
| Risk attributes (severity, mitigation, owner role) | Decision System | [§11](../systems/DECISION_SYSTEM.md#11-risk-notes) |
| Memory update and supersession rules | Decision System | [§13](../systems/DECISION_SYSTEM.md#13-memory-updates) |
| **How to evaluate build vs. buy vs. adopt vs. defer** | **This framework** | §4–§8 |
| **Who decides and who is consulted** | **This framework** | §9–§10 |
| **What a sourcing decision brief contains** | **This framework** | §11 |

In short: the Decision System tells you *that* a sourcing decision must be framed, reasoned, owned, approved where required, recorded, and remembered. This framework tells you *how to do the framing and reasoning well* for a sourcing choice specifically.

---

## 4. The Four Options

Every sourcing decision is a choice among four options. The framework requires that **at least two be evaluated genuinely**, and that **Defer always be considered explicitly** — it is the status-quo alternative that the [Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives) makes mandatory.

| Option | What it means | Strongest when | Weakest when |
|---|---|---|---|
| **Build** | Write and own the capability internally. | The capability is core to the product's value, must be controllable, or no acceptable external option exists. | The capability is undifferentiated plumbing that many vendors solve better and cheaper. |
| **Buy** | Depend on an external managed service. | The capability is hard, undifferentiated, and operationally heavy (auth, hosting, monitoring, an LLM provider). | The capability is core differentiation, or the service would become an irreplaceable dependency. |
| **Adopt** | Pull in an open-source library or framework. | A well-maintained library solves a bounded, well-understood problem and the dependency is reversible. | The library is unmaintained, heavyweight, or would set a convention across the codebase without scrutiny. |
| **Defer** | Decide not to solve the problem now. | The need is unproven, the cost is high, or solving it now would commit the company prematurely. | A real, present need is being ignored and "defer" is being used to avoid a hard decision. |

**Core vs. context is the first cut.** The single most useful question is: *is this capability part of what makes Engineering OS distinctive, or is it undifferentiated infrastructure that simply has to exist?* The company's standing bias, consistent with the [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) and [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md), is:

- **Build the core.** The company model, the employee runtime, memory, the decision and planning engines, repository intelligence, the guardrail gate — the things that *are* the product — are built and owned internally.
- **Buy or adopt the context.** Authentication, hosting, the database engine, the LLM runtime, version-control hosting — undifferentiated capability is sourced externally and kept **replaceable** behind an interface. *Everything should be replaceable: LLMs, providers, frameworks, memory engines* ([AGENTS.md](../../AGENTS.md)).
- **Defer the unproven.** Per the v2 non-goals, the company does **not** build real AI behavior before the company, repository, and decision models are specified — a deliberate, recorded deferral, not an omission.

This is a bias, not a rule. The framework still requires every option to be evaluated; the bias only sets the burden of proof.

---

## 5. Evaluation Criteria

Every sourcing option is evaluated against seven criteria. These are not a scorecard to be averaged — they are dimensions every option must be examined on, in the priority order below, because averaging hides a fatal weakness behind strong scores elsewhere. An option that is strong on six and silently fatal on one is not a strong option.

| # | Criterion | The question it answers | What "good" looks like |
|---|---|---|---|
| 1 | **Strategic fit (core vs. context)** | Is this part of the product's differentiation, or undifferentiated plumbing? | Core capability is built and owned; undifferentiated capability is sourced externally and kept replaceable. |
| 2 | **Security & data exposure** | What is the blast radius, and what data crosses a trust boundary to a third party? | No secret or sensitive data leaves a boundary silently; the option fails closed; least privilege holds. |
| 3 | **Control & replaceability** | Can the company change its mind later without a rewrite? | The capability sits behind an interface; switching cost is bounded; no single irreplaceable dependency. |
| 4 | **Total cost of ownership** | What does this cost to *own* over five years, not to start? | Build, integration, operational, license, and exit costs are all named — see [§6](#6-the-cost-model). |
| 5 | **Maintainability** | Who maintains this, and can a future engineer understand and change it safely? | A clear owner exists; the dependency is maintained upstream; internal builds follow existing patterns. |
| 6 | **Reliability & support** | When this breaks in production, who fixes it and how fast? | Mature, supported, observable; a bus factor above one; a known support path, not an abandoned repo. |
| 7 | **Delivery speed** | How fast does this unblock the outcome? | Fast — but never at the cost of a higher criterion. Speed is the last tie-breaker, never the first reason. |

**Notes on each criterion:**

- **Strategic fit** is first because the company optimizes for owning what differentiates it and outsourcing what does not. Building undifferentiated plumbing, or buying the thing that *is* the product, are both strategic-fit failures regardless of cost.
- **Security & data exposure** is never traded away for speed or convenience. An option that sends sensitive data across a new trust boundary is a security exception governed by the [Security Engineer's blocking authority](../systems/DECISION_SYSTEM.md#14-relationship-to-roles), not by this framework's trade-off logic. Credentials for any bought service are stored encrypted, never in plaintext (see [Domain Model — Integration](../architecture/DOMAIN_MODEL.md#integration)).
- **Control & replaceability** is the criterion the company's architecture is explicitly built to protect — the execution-adapter and provider-integration boundaries exist so that *buy* decisions stay reversible. A *buy* that cannot be unwound is a far heavier commitment than one that can.
- **Total cost of ownership** is detailed in [§6](#6-the-cost-model). It is the criterion most often skipped under deadline pressure and the one this framework most insists on.
- **Maintainability** asks the question that kills more adopted libraries than any other: *who owns this in two years?* An unmaintained dependency is a liability whatever it saved on day one.
- **Reliability & support** distinguishes a mature service or library from a hobby project. A *buy* with no support path and an *adopt* with a bus factor of one carry similar hidden risk.
- **Delivery speed** matters and is real — but it is the tie-breaker, not the lead criterion. *Long-term quality beats short-term speed* ([Company Playbook](../company/COMPANY_PLAYBOOK.md)).

---

## 6. The Cost Model

The defining mistake in sourcing decisions is comparing the **acquisition cost** of one option to the **acquisition cost** of another. The framework forbids this. Every option is costed across its full lifetime, and the comparison is always **total cost of ownership over five years, including exit**.

Cost is estimated across five categories for each option:

| Cost category | Build | Buy | Adopt |
|---|---|---|---|
| **Acquisition** | Engineering time to design and write it. | Integration time + onboarding. | Integration time + learning curve. |
| **Operation** | Hosting, on-call, incident response — the company owns uptime. | Subscription / usage fees; the vendor owns uptime. | Usually low; runs inside the company's own runtime. |
| **Maintenance** | Bug fixes, security patches, refactors — **forever**, and only the company will do them. | Keeping the integration current as the vendor's API evolves. | Tracking upstream releases, breaking changes, and CVEs. |
| **Cognitive** | Every engineer must understand a system the company invented. | The integration surface and the vendor's mental model. | The library's API and its sharp edges. |
| **Exit** | Already owned; removal is a normal refactor. | **Migration off the vendor** — often the largest hidden cost; high if no abstraction boundary exists. | Removing or replacing the dependency; low if isolated, high if it set conventions. |

**Rules for using the cost model:**

1. **Always cost exit.** The cost to *leave* an option is part of its cost. A cheap-to-enter, expensive-to-leave *buy* is a more serious commitment than its sticker price suggests. The replaceability boundary in [§5](#5-evaluation-criteria) exists precisely to keep this cost bounded.
2. **Maintenance is forever for Build.** An internal build's true cost is acquisition *plus* the open-ended maintenance line no vendor will ever cover. The question "would we rather own this bug for five years or pay someone else to own it?" is the heart of build-vs-buy.
3. **Cheap acquisition is not cheap ownership.** An adopted library with a near-zero acquisition cost but an unmaintained upstream can be the most expensive option in the table.
4. **Estimate honestly, label the confidence.** Costs are estimates; the brief states the confidence level ([Decision System §8](../systems/DECISION_SYSTEM.md#8-required-reasoning-format)). A confident wrong number is worse than an honest range.

The output of the cost model is never "Option A is cheaper." It is "Option A's five-year cost is lower **because** its exit cost is bounded and its maintenance is carried upstream, accepting [named trade]." That sentence feeds directly into the decision record.

---

## 7. The Risk Model

Risk is a first-class part of every sourcing decision, not a closing caveat. This framework uses the company's standard risk attributes — **severity**, **description**, **mitigation**, **owner role** — from [Decision System §11](../systems/DECISION_SYSTEM.md#11-risk-notes), and adds the risk categories specific to sourcing.

### The sourcing risk categories

| Risk category | Where it bites | Typical for |
|---|---|---|
| **Vendor lock-in** | Exit cost; the product becomes hostage to one provider's pricing and roadmap. | Buy |
| **Vendor viability** | The service is discontinued, acquired, or degraded. | Buy |
| **Supply-chain / abandonment** | An adopted dependency is unmaintained, or ships a malicious or vulnerable version. | Adopt |
| **Data exposure** | Sensitive data crosses a trust boundary to a third party. | Buy, some Adopt |
| **Maintenance burden** | The company owns an open-ended liability no one else will patch. | Build |
| **Opportunity cost** | Engineering spent building undifferentiated plumbing was not spent on the core product. | Build |
| **Premature commitment** | The company commits before the need is proven and cannot cheaply reverse. | Build, Buy |
| **Unmet need** | Deferring a real, present need degrades the product or blocks an outcome. | Defer |

### Scoring and acceptance

Each risk is scored on **likelihood** (low / medium / high) and **impact** (low / medium / high / critical), combining into a **severity** that drives the response, exactly as the [Architecture Decision Framework §7](./ARCHITECTURE_DECISION_FRAMEWORK.md#7-risk-scoring) defines:

- **Low** — note it in the record; no mitigation required.
- **Medium** — document an explicit mitigation and an owner role.
- **High** (high impact at medium+ likelihood, or any **critical**-impact risk) — mitigation is mandatory **and** acceptance is a separate, recorded decision.

**Acceptance authority**, per [Decision System §11](../systems/DECISION_SYSTEM.md#11-risk-notes):

- **Technical risk** (lock-in, abandonment, maintenance burden) is accepted by the **CTO**.
- **Business risk** (a vendor cost or viability risk that affects an outcome the CEO submitted) is framed by the CTO and accepted by the **CEO**.
- **Data-exposure / trust-boundary risk** is a security exception held by the [Security Engineer](../systems/DECISION_SYSTEM.md#14-relationship-to-roles); it proceeds only on a CTO-authorized, recorded exception. It is never a trade this framework can make on its own.

The standard mitigation for the two most common sourcing risks is the same one the architecture is built around: **keep it replaceable.** Lock-in and abandonment both shrink to manageable when the capability sits behind an interface, so that switching is a bounded refactor rather than a rewrite.

---

## 8. Required Questions

Before a sourcing decision is recorded, the owner must be able to answer every question below. These are mandatory; an unanswered question is a gap in the decision, not a detail to fill in later. They map onto the criteria in [§5](#5-evaluation-criteria), the cost model in [§6](#6-the-cost-model), and the reasoning format in [Decision System §8](../systems/DECISION_SYSTEM.md#8-required-reasoning-format).

**Framing**
1. What capability is needed, and what breaks if we do nothing? (If nothing breaks, the answer may be **Defer** — record it as a decision.)
2. Is this capability **core** to the product's differentiation, or **context** — undifferentiated plumbing?
3. How reversible is each option? What does it cost to undo, and when is the last cheap moment to change course?

**Memory and consistency**
4. Has the company already decided something relevant? (Retrieval is mandatory — [Decision System §13](../systems/DECISION_SYSTEM.md#13-memory-updates).) Is there an existing internal capability or already-approved dependency that covers this?
5. Does this introduce a new external dependency or provider where the company already has one for the same purpose?

**Evaluation**
6. What are the alternatives, including **Defer**? Why is each rejected? (Mandatory — [Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives).)
7. What is each option's **five-year total cost of ownership, including exit** ([§6](#6-the-cost-model))?
8. What does the chosen option give up? What is the named trade?

**Security, control, and operability**
9. What data, if any, crosses a trust boundary to a third party? (If any, Security is consulted — [§9](#9-ownership-model--who-decides-who-is-consulted).)
10. If this is a **buy** or **adopt**, is it isolated behind a replaceable boundary? What is the switching cost?
11. When this breaks in production, who fixes it, and how do we know it broke?

**Authority**
12. Does this commit the product to an external party, build a system the company owns forever, or accept a high-severity risk? (This determines who approves — [§9](#9-ownership-model--who-decides-who-is-consulted), [§10](#10-approval-triggers).)

A decision that cannot answer questions 2, 6, 7, and 9 is returned to the owner. Those four are the difference between a remembered, defensible sourcing decision and an improvisation.

---

## 9. Ownership Model — Who Decides, Who Is Consulted

Sourcing decisions are **owned by the Tech Lead and approved by the CTO** when consequential — but the right people must be *consulted* before the decision is framed, because a sourcing decision touches strategy, security, and product scope at once. This section names who contributes what.

| Perspective | Role | What they contribute |
|---|---|---|
| **Strategic fit & cost** | **CTO** | Whether the capability is core or context; whether a commitment is acceptable; accepts technical risk; approves consequential decisions. |
| **Product scope & priority** | **Product Manager** | Whether the need is real and now, or can be deferred; whether building this is the best use of capacity versus the outcome the CEO asked for. |
| **Technical evaluation** | **Tech Lead** | Frames the options, runs the cost and risk models, recommends. Decides reversible, low-consequence cases alone. |
| **Security & data** | **Security Engineer** | Whether any option crosses a trust boundary or exposes data; holds blocking authority on security exceptions. |
| **Implementation reality** | **Engineering** | Integration effort, the library's real sharp edges, the true maintenance burden of a build — the ground truth the estimate depends on. |

**The authority line:**

| Decision character | Owner (frames + proposes) | Authority to decide | Recorded as |
|---|---|---|---|
| **Adopt a reversible, module-local library**; no new trust boundary, bounded switching cost | Tech Lead | **Tech Lead decides**, records rationale | Memory record (category `decision`) |
| **Build a small, internal, undifferentiated utility** fully within the codebase | Tech Lead | **Tech Lead decides** | Memory record |
| **Buy / commit the product to an external service**, or build a system the company will own long-term | Tech Lead frames | **CTO approves** | Decision record / ADR |
| **Commit or remove a replaceability boundary** (provider independence) | Tech Lead frames | **CTO approves** | ADR |
| **Any option requiring acceptance of a high-severity technical risk** (lock-in, abandonment, long-term burden) | Tech Lead frames | **CTO approves** | Decision record + risk record |
| **Any option crossing a trust boundary or exposing data** | Security Engineer flags; Tech Lead frames | **CTO approves**, on Security input | Decision record + security exception |
| **Defer, or a sourcing choice that changes scope/cost of a CEO outcome** | CTO frames the business trade | **CEO decides** | Decision record |

This mirrors [Decision System §5](../systems/DECISION_SYSTEM.md#5-owners-and-approvers): the escalation path is the company reporting structure — Engineering → Tech Lead → CTO → CEO.

**The test.** A Tech Lead asks one question to decide whether to escalate: *"Does this create a lasting dependency, commit the product to an external party, or build something we own forever?"* If no — reversible, local, low-consequence — the Tech Lead decides and records. If yes, the Tech Lead frames a recommendation in the [required reasoning format](../systems/DECISION_SYSTEM.md#8-required-reasoning-format) and routes it to the CTO. The Tech Lead never escalates a blank question; they escalate a recommendation the CTO can confirm or redirect.

**The CEO is never asked to choose between technical options.** A sourcing decision reaches the CEO only as a *business trade* — "owning this ourselves costs two engineers for a quarter; the managed service costs $X/month but ties us to one vendor" — and only when it changes the scope, cost, or risk of an outcome the CEO submitted. The CEO never chooses "library A versus library B." See [Decision System §14](../systems/DECISION_SYSTEM.md#14-relationship-to-roles).

---

## 10. Approval Triggers

Some sourcing decisions require CTO approval **regardless of autonomy level** because they cross a mandatory gate. Raising the company's autonomy does not waive them. They restate, for sourcing, the mandatory gates in [Decision System §6](../systems/DECISION_SYSTEM.md#6-which-decisions-require-approval).

**Always requires CTO approval, at any autonomy level:**

- Committing the product to an external paid service or platform (a **buy**).
- Building a capability the company will own and maintain long-term.
- Committing or removing a provider-independence / replaceability boundary.
- Adopting a dependency that introduces a new cross-cutting convention across the codebase.
- Accepting a high-severity sourcing risk (lock-in, vendor viability, abandonment, long-term maintenance burden) to make an option viable.

**Always requires Security involvement (and a CTO-authorized exception if accepted):**

- Any option where data crosses a trust boundary to a third party.
- Any option that changes how secrets or credentials are handled.

**Requires CEO involvement (framed by the CTO):**

- A sourcing decision that materially changes the scope, timeline, or recurring cost of an outcome the CEO submitted — surfaced as a business trade, not a technical one.
- Acceptance of a business risk created by a vendor commitment.

**Stays with the Tech Lead (no approval gate):**

- Adopting a reversible, module-local library with no new trust boundary and bounded switching cost.
- Building a small, internal, undifferentiated utility within the codebase.

A useful rule: **if the decision creates a dependency that is hard to leave, assume it needs CTO approval until shown otherwise.** The cost of an unnecessary approval is a few minutes; the cost of an unowned vendor lock-in is paid every month for years.

Note the distinction from execution authorizations: the autonomy policy that gates *agentic actions* (running the agent, pushing, opening a PR) is enforced in code and described in [Decision System §7](../systems/DECISION_SYSTEM.md#7-autonomy-and-the-approval-gate). This section governs the *human sourcing decision*, which is a documented practice, not a code-enforced gate.

---

## 11. Output Format — the Sourcing Decision Brief

Every sourcing decision produces a written record. For routine, reversible decisions this is a memory record (category `decision`); for decisions that commit or remove a replaceability boundary it is an **ADR** — see [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md), which is itself a sourcing decision (build the execution runtime and memory retrieval internally, keep the LLM and storage replaceable). Both use the same field set, the [Decision System §9](../systems/DECISION_SYSTEM.md#9-decision-record-format) record format specialized for sourcing.

### The Sourcing Decision Brief

| Field | Content |
|---|---|
| **Title** | A one-line statement of the decision (e.g., "Use a managed auth provider for sign-in; keep it behind the integration boundary"). |
| **Status** | `decided`, `superseded`, or `reversed`. |
| **Owner / Approver** | Tech Lead (owner); CTO when approval was required; CEO when a business trade was decided. |
| **Date** | When the decision was made. |
| **Capability & forces** | The capability needed and what breaks if we do nothing. Whether it is core or context. |
| **Decision** | The chosen option — Build / Buy / Adopt / Defer — stated unambiguously, with the specific provider, library, or scope. |
| **Options evaluated** | Each of the genuine alternatives, **including Defer**, scored against the seven criteria in priority order. |
| **Cost model** | The five-year total cost of ownership for each option, **including exit cost**, with confidence noted ([§6](#6-the-cost-model)). |
| **Trade accepted** | What the chosen option gives up. Stated plainly; never "none." |
| **Risks** | Each sourcing risk with severity, mitigation, and owner role ([§7](#7-the-risk-model)). High-severity risks show who accepted them. |
| **Replaceability** | For Buy/Adopt: where the boundary is and what the switching cost is. |
| **Consequences** | What this constrains or enables for future work. |
| **Supersedes / Superseded by** | Links to prior or subsequent decisions, when applicable. |

**Format rules** (inherited from [Decision System §9](../systems/DECISION_SYSTEM.md#9-decision-record-format)):

- **Plain language.** A brief is understandable by any employee, not only the author. *Documentation is engineering* ([Company Playbook](../company/COMPANY_PLAYBOOK.md)).
- **Immutable in intent.** A brief is never edited to change the decision. A new record supersedes it and links back; the original alternatives and dissent are preserved.
- **Self-contained.** A reader understands the decision and why it was made without reconstructing the conversation around it.
- **Written to memory.** Every brief is stored as company memory so future work references it instead of re-deriving or contradicting it ([Decision System §13](../systems/DECISION_SYSTEM.md#13-memory-updates)).

---

## 12. Worked Examples

These examples show the framework applied end to end. They are illustrative reasoning, not records of specific shipped decisions.

### Example A — Adopt, decided by the Tech Lead alone

**Situation.** A feature needs to parse a well-defined data format. A widely-used, actively-maintained library solves exactly this.

**Framing.** Capability: parsing a bounded, undifferentiated format — clearly *context*, not core. Reversible: yes; the dependency is isolated to one module. Memory: no existing internal parser.

**Evaluation.** *Adopt* wins on strategic fit (undifferentiated), cost (near-zero acquisition, low maintenance, isolated exit), and reliability (mature, supported). *Build* would mean owning a parser forever for no differentiation — an opportunity-cost and maintenance-burden failure. *Defer* is rejected: the need is real and present.

**Authority.** Reversible, module-local, no trust boundary → **Tech Lead decides**, records a memory record. Escalating this would be over-escalation.

### Example B — Buy, approved by the CTO

**Situation.** The product needs authentication. Building it means owning password storage, session security, and a permanent security-sensitive surface.

**Framing.** Capability: authentication — *context*, and security-critical. Forces: every product needs it; getting it wrong is a security incident.

**Evaluation (priority order).** Strategic fit: undifferentiated; the company should not differentiate on auth. Security: a specialized provider reduces the company's own security-sensitive surface — strong, *provided* the integration stays behind a boundary. Control & replaceability: acceptable **only** because auth is isolated behind the integration boundary, bounding the exit cost. Cost: subscription cost is far below the five-year cost of owning auth securely. Trade accepted: a recurring fee and a vendor dependency, in exchange for not owning a permanent security liability.

**Risk.** Vendor lock-in — medium, mitigated by the replaceability boundary; vendor viability — low for a mature provider. Data exposure — Security consulted; user identity data crosses to the provider, accepted under a recorded, CTO-authorized exception.

**Authority.** Commits the product to an external service and crosses a trust boundary → **CTO approves**, Security consulted. Recorded as an ADR. This is the shape of the real "buy the platform, keep it replaceable" pattern in [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md) and the [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).

### Example C — Build, because it is the core

**Situation.** The company needs the planning engine that turns an outcome into projects, milestones, features, and tasks. Generic project-management tools exist.

**Framing.** Capability: outcome→plan generation — this *is* the product. Buying it would mean outsourcing the company's differentiation.

**Authority & outcome.** Strategic fit alone is decisive: **Build**, owned internally. The interesting sub-decision is deferral of the *AI* portion — per the v2 non-goals, real-AI planning is **deferred** until the company, repository, and decision models are specified, so the engine ships **deterministic and templated** today. That deferral is itself a recorded sourcing decision: build the engine now, defer the AI until the spec exists. See [AGENTS.md](../../AGENTS.md) and [Decision System §15](../systems/DECISION_SYSTEM.md#15-what-engineering-os-implements-today).

### Example D — Defer, recorded deliberately

**Situation.** A request arrives for a capability whose need is unproven and whose best implementation would commit the company to a structure it may not want.

**Framing.** Forces: the need is speculative; building now risks premature commitment. *Defer* is evaluated as a real option, not a non-answer.

**Authority.** Product Manager confirms the need is not yet real; the CTO agrees the commitment is premature. **Defer** is recorded as a decision with the conditions that would reopen it — *not* left as silence. When those conditions appear, the decision is revisited and may be superseded.

---

## 13. Anti-Patterns

Each anti-pattern below is a recurring way sourcing decisions go wrong. They specialize the failure modes in [Decision System §16](../systems/DECISION_SYSTEM.md#16-failure-modes) for sourcing.

### Not-invented-here
A capability is built internally because the team would rather own it, when a mature external option is better and cheaper. **Caught when:** the reasoning cites preference for control over a stated requirement, and the cost model ignores maintenance. **Response:** undifferentiated capability is bought or adopted. Owning plumbing is an opportunity-cost failure, not craftsmanship.

### Resume-driven adoption
A library or service is chosen because it is new or interesting, not because it best satisfies the criteria. **Caught when:** the justification cites the technology's appeal rather than the need. **Response:** *consistency beats novelty* ([Company Playbook](../company/COMPANY_PLAYBOOK.md)). The decision must show why an existing option is insufficient.

### Acquisition-cost tunnel vision
Two options are compared on what they cost to *start*, ignoring what they cost to *own* and to *leave*. **Caught when:** the brief has no exit cost and no five-year view. **Response:** the [cost model](#6-the-cost-model) is mandatory; a sourcing decision without total cost of ownership is returned to the owner.

### Silent vendor lock-in
A managed service is adopted with no abstraction boundary, quietly making the product hostage to one provider. **Caught when:** the replaceability field is empty and the exit cost is unbounded. **Response:** *buy* keeps the capability replaceable; an irreplaceable dependency is a high-severity risk requiring explicit, recorded acceptance.

### The dependency nobody owns
An open-source library is adopted without checking whether it is maintained. **Caught when:** the brief cannot name who patches it upstream, or the project's last release is stale. **Response:** maintainability and reliability are first-class criteria; an unmaintained dependency is a liability whatever it saved.

### The decision with one option
A conclusion is presented with no genuine alternatives — and **Defer** is never considered. **Caught when:** the options section is a token list of one. **Response:** a decision without alternatives is a default; it is returned to the owner ([Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives)).

### Defer-by-default avoidance
"Defer" is used to dodge a hard decision about a real, present need. **Caught when:** the deferral records no conditions that would reopen it and a need is actively being blocked. **Response:** Defer is a legitimate, *recorded* decision with reopening conditions — not a way to avoid deciding.

### Trade-off denial
A sourcing decision claims to give up nothing. **Caught when:** the "trade accepted" field reads "none." **Response:** every option sacrifices something — build trades maintenance, buy trades control, adopt trades a dependency, defer trades a present capability. A decision with no stated trade has not been examined honestly and is returned for real evaluation.

---

## 14. Relationship to Other Documents

- **[Decision System](../systems/DECISION_SYSTEM.md)** — the governing process for all decisions: lifecycle, owners and approvers, reasoning format, record format, risk notes, and memory. This framework is the sourcing-specific *judgment* the Decision System refers to as "the department decision framework."
- **[Architecture Decision Framework](./ARCHITECTURE_DECISION_FRAMEWORK.md)** — the sibling framework for structural choices. A sourcing decision that also changes system structure is co-governed: this framework decides *where the capability comes from*, that one decides *how it is structured in*.
- **[Technical Debt Decision Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md)** — governs the debt a build-fast or defer choice may incur and how it is tracked and repaid.
- **[Company Playbook](../company/COMPANY_PLAYBOOK.md)** — the company values this framework operationalizes: *simplicity wins; consistency beats novelty; long-term quality beats short-term speed; every action should reduce future work; documentation is engineering.*
- **[Domain Model](../architecture/DOMAIN_MODEL.md)** — defines the Decision, Decision Record, Risk, Memory, and Integration objects that sourcing decisions are recorded against; Integration encodes the replaceable boundary a *buy* sits behind.
- **[ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md)** — the canonical worked example: a sourcing decision that builds the runtime and memory retrieval internally while keeping the LLM and storage replaceable.
- **[Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md)** — defines the provider and execution-adapter boundaries that make *buy* decisions reversible by design.
- **Engineering OS Specification v1.0** (planned) — will formalize the decision model and unlock AI-assisted decision framing; until then this framework is the authoritative method for sourcing decisions, applied by the Tech Lead and CTO with Product, Security, and Engineering input.
