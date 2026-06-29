# SOP: Architecture Change

**SOP ID:** SOP-007  
**Category:** Standard Operating Procedure  
**Owner:** Tech Lead  
**Version:** 1.0  

---

## Purpose

This procedure defines how Engineering OS proposes, reviews, approves, documents, and executes a change to the architecture of its software. An architecture change is a decision about system structure — a module boundary, a storage model, a runtime model, a cross-cutting pattern, a dependency adopted at a structural level — that affects multiple parts of the system and is costly to reverse. These are the most expensive decisions the company makes. They are made early, they touch every module that comes after, and once code depends on them they are the hardest decisions to undo.

This SOP exists so that architecture changes are deliberate, reasoned, approved by the right authority, and remembered. It governs the **process**: who writes the proposal, who reviews the risk, who approves, who implements, who documents, and what completion means. It does not replace the [Architecture Decision Framework](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md), which governs the **judgment** — the criteria, priority order, and trade-off model used to decide *what the right architecture is*. The framework tells an engineer how to reason about an architecture choice; this SOP tells the company how to move that choice from a proposal to a recorded, implemented reality.

An architecture change made without a written proposal, without considered alternatives, without the right approval, or without a lasting record is not a faster architecture change — it is undocumented technical debt with no owner. This procedure ensures that every structural change to the system enters with a reason, exits with a record, and is reversible only as a deliberate act because the original context survived.

---

## Trigger

This procedure is triggered when any of the following occurs:

- An engineer, Tech Lead, or the CTO identifies that a planned feature or fix requires a change to system structure that the current architecture does not cleanly support
- A repository or technical-debt assessment surfaces a structural problem (a boundary that leaks, a pattern applied inconsistently, a dependency that has become a liability) that warrants a structural change rather than a local fix
- A new external constraint — scale, security, compliance, provider change, cost — makes the current architecture inadequate
- The [Technical Debt Decision Framework](../decision-frameworks/TECHNICAL_DEBT_DECISION_FRAMEWORK.md) or a planning session escalates a debt item whose remediation is structural
- A dependency-choice decision (see the [Dependency Choice Decision Framework](../decision-frameworks/DEPENDENCY_CHOICE_DECISION_FRAMEWORK.md)) crosses from "local library selection" into "structural adoption that other modules will depend on"

When a change qualifies as an architecture change under the definition below, this SOP is mandatory. A structural change made through an ordinary feature or bug-fix path, without this procedure, is a process failure that must be documented and reviewed.

---

## Owner

**Tech Lead** — owns this procedure end to end: authoring or sponsoring the Architecture Change Proposal, routing it through risk and security review, securing the required approval, coordinating implementation, and confirming the architecture memory is written before the change is considered complete. The Tech Lead is the single accountable person for an architecture change moving through the company correctly.

The Tech Lead is the owner of the *procedure*. The **CTO** is the owner of the *decision* whenever an approval trigger is met. The line between what the Tech Lead may decide alone and what the CTO must approve is defined in [Approval Chain and Authority](#approval-chain-and-authority) and follows the same boundary set out in the [Architecture Decision Framework](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md).

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Tech Lead** | Owns the procedure; authors or sponsors the proposal; routes risk and security review; secures approval; coordinates implementation; confirms architecture memory is written |
| **CTO** | Decision authority for changes that meet an approval trigger; reviews reasoning and alternatives; accepts or rejects the proposal; authors the ADR for foundational changes |
| **Backend / Frontend / AI Engineers** | Author or co-author proposals in their area; surface impact on existing modules; implement the approved change against the migration plan |
| **Infrastructure Engineer** | Assesses infrastructure, environment, deployment, and operational impact; owns infrastructure portions of the migration plan; confirms production readiness |
| **Security Engineer** | Reviews the change for security and data-exposure implications; required reviewer when the change touches authentication, secrets, data boundaries, or external trust surfaces |
| **Reviewer** | Reviews the implementation against the approved proposal and the architecture; confirms the code matches the decided structure, not a drifted version of it |
| **Technical Writer** | Updates the architecture documentation and decision memory; ensures the change is findable and the superseded state is marked |
| **Product Manager** | Notified when an architecture change affects feature scope, timeline, or user-visible behavior; provides product context when a trade-off has product consequences |
| **Release Manager** | Coordinates delivery when the change ships as part of a release; aware of any migration sequencing or rollback implications |

---

## What Counts as an Architecture Change

Not every technical decision is an architecture change. Applying this procedure to every choice would slow the company to a halt; applying it to none would let structure drift silently. This section draws the line.

**A change is an architecture change when it does one or more of the following:**

- **Alters a system or module boundary** — what owns what, how components are decomposed, where a responsibility lives. Moving a responsibility from one module to another, splitting or merging a module, or introducing a new top-level component is structural.
- **Changes a storage, runtime, or queue model** — adopting or replacing a database, a persistence pattern, a job/queue mechanism, a caching layer, or the way work is scheduled and executed. (For example, the decision that the runtime event queue is a database-backed table polled by a worker — see [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md) — was an architecture change.)
- **Establishes or changes a cross-cutting pattern** — how the system *as a convention* handles persistence, eventing, retries, authentication, authorization, error handling, observability, or guardrails. Changing the convention everyone follows is structural even if the first implementation is small.
- **Adopts a dependency at a structural level** — taking on a framework, runtime, or service that other modules will be built to depend on and that would be costly to remove. (Selecting one logging library over another is local; adopting a workflow-orchestration framework that owns scheduling is structural.)
- **Changes a contract or data model that multiple modules depend on** — a shared schema, a domain-model object's shape, an internal API that several consumers rely on.
- **Changes a provider-independence or replaceability commitment** — what the company commits to versus what it deliberately keeps swappable (the execution-adapter boundary, the memory-retrieval boundary, and similar seams).

**A change is *not* an architecture change — and does not require this SOP — when it is:**

- A local implementation choice inside a single module that no other module depends on
- A refactor that preserves existing boundaries, contracts, and patterns
- A dependency upgrade within an already-adopted dependency (a version bump, not a new structural dependency)
- A configuration or tuning change that does not alter structure
- A feature built entirely within the existing architecture using existing patterns

**When it is unclear** whether a change is structural, treat it as an architecture change and write the proposal. The cost of an unnecessary proposal is an hour of writing. The cost of a structural change made silently is a boundary that erodes, a pattern applied two different ways, and a decision no future employee can find or defend. When the engineer and Tech Lead disagree on whether a change is structural, the Tech Lead decides; when the Tech Lead and CTO disagree, the CTO decides.

The authoritative definition of scope — in and out — lives in [Architecture Decision Framework §2](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md#2-scope). This SOP applies the same boundary; where they appear to differ, the framework governs.

---

## Preconditions

Before this procedure begins:

- [ ] The need for a structural change has been identified and recorded (in a work item, a debt item, or a planning note)
- [ ] The change has been confirmed to meet the definition of an architecture change above
- [ ] A Tech Lead is assigned to own the procedure
- [ ] The author of the proposal (Tech Lead or a sponsored engineer) is identified and available

---

## Procedure

### Phase 1: Proposal

**Owner:** Tech Lead (author or sponsor)  
**Input:** Identified structural need; the [Architecture Decision Framework](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md)  
**Output:** A complete, written Architecture Change Proposal  

**Steps:**

1. The **author** (the Tech Lead, or an engineer the Tech Lead sponsors) writes the Architecture Change Proposal using the [canonical format](#architecture-change-proposal-format) below. The proposal is a written document, not a conversation. A proposal that exists only as a discussion in a meeting or a thread has not been written.

2. The author applies the [Architecture Decision Framework](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md) to reason about the change: the decision criteria, the priority order, the required questions, and the risk scoring. The proposal records the *output* of that reasoning, not a preference.

3. The proposal **must** include explicit reasoning and at least two genuine alternatives. A conclusion without alternatives is a default, not a decision. For each alternative considered, the proposal states what it was and the specific trade-off that disqualified it. "We chose X" without "we rejected Y because Z" is an incomplete proposal and is returned by the Tech Lead before it proceeds.

4. The **Tech Lead** reviews the proposal for completeness before it moves to review: the problem is stated, the proposed structure is concrete, the alternatives are real and reasoned, the impact on existing modules is identified, and the migration approach is described. The Tech Lead does not advance an incomplete proposal to risk review.

**Gate 1:** A complete Architecture Change Proposal exists in writing, with explicit reasoning and at least two reasoned alternatives. The Tech Lead confirms completeness.

---

### Phase 2: Risk and Security Review

**Owner:** Tech Lead (coordination)  
**Input:** Complete Architecture Change Proposal  
**Output:** Identified risks with mitigations; security clearance where required; infrastructure impact assessed  

**Steps:**

1. The **Tech Lead** routes the proposal for review to the participants whose domains the change touches. At minimum, every architecture change receives an engineering impact review; the Security Engineer and Infrastructure Engineer are required reviewers when the triggers below are met.

2. **Engineering review.** The engineers who own the affected modules assess the proposal for impact on their areas: which existing contracts change, which modules must be touched, what breaks if the change is made, and whether the migration approach is realistic. Impact that the author did not anticipate is surfaced here, not discovered mid-implementation.

3. **Security review (required when triggered).** The **Security Engineer** reviews the change when it touches authentication, authorization, secrets, credential storage, data boundaries, external trust surfaces, or guardrails. The Security Engineer applies the [Security Decision Framework](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md). A change that meets a security trigger cannot proceed to approval without Security Engineer clearance, and any Blocking security finding must be resolved or explicitly accepted by the CTO before approval.

4. **Infrastructure review (required when triggered).** The **Infrastructure Engineer** reviews the change when it affects deployment, environment, runtime topology, storage provisioning, scaling, or operational cost. The Infrastructure Engineer assesses operability and owns the infrastructure portions of the migration plan.

5. The **Tech Lead** performs risk scoring per the [Risk Analysis Decision Framework](../decision-frameworks/RISK_ANALYSIS_DECISION_FRAMEWORK.md) and the framework's risk model, and records each material risk with a mitigation or an explicit acceptance. A risk that is named without a mitigation or an accepted-by decision is an open risk that blocks approval.

6. The author incorporates review feedback into the proposal. Material changes to the proposed structure that emerge from review are written into the proposal — the document stays the single source of truth.

**Gate 2:** All required reviews are complete. Security clearance is obtained where triggered. Infrastructure impact is assessed where triggered. Every material risk has a mitigation or a documented acceptance.

---

### Phase 3: Approval

**Owner:** CTO (when an approval trigger is met); Tech Lead (when the change is within Tech Lead authority)  
**Input:** Reviewed proposal with risks and clearances  
**Output:** An approved (or rejected) architecture decision  

**Steps:**

1. The **Tech Lead** determines the required approval authority using the [approval triggers](#approval-chain-and-authority) below. The triggers are not discretionary — if a change meets a trigger, CTO approval is required regardless of the Tech Lead's confidence.

2. **When the change is within Tech Lead authority** (a technical-approach choice that does not cross an approval trigger), the Tech Lead approves the proposal, records the decision, and the procedure advances to implementation.

3. **When the change meets an approval trigger**, the Tech Lead routes the proposal to the **CTO**. The CTO reviews the reasoning, the alternatives, the risk assessment, and the clearances. The CTO may:
   - **Approve as written** — the decision is recorded and advances to implementation
   - **Return with required changes** — to scope, structure, or risk mitigation, returning the proposal to Phase 1 or Phase 2 as appropriate
   - **Reject** — with a written reason that becomes part of the decision record, so the rejection and its rationale are remembered

4. **Escalation to the CEO.** When the change has strategic, cost, or product implications beyond engineering — a major provider commitment, a change that affects the product direction, a cost increase of organizational significance — the CTO escalates to the **CEO** for the strategic call. (ADR-001, the foundational runtime and memory decision, was approved by the CEO for exactly this reason.) Engineering still owns the technical judgment; the CEO owns the strategic acceptance.

5. The approval — who approved, on what date, on what reasoning — is recorded as a Decision in [Decision Memory](../memory/DECISION_MEMORY.md). Approval is never verbal-only; it is written and traceable.

**Gate 3:** The change is approved by the required authority, in writing, with the decision recorded. Or it is rejected with a documented reason.

---

### Phase 4: Implementation Handoff and Planning

**Owner:** Tech Lead  
**Input:** Approved Architecture Change Proposal  
**Output:** A decomposed migration plan with assignments, sequencing, and a rollback path  

**Steps:**

1. The **Tech Lead** decomposes the approved change into implementation tasks using the Task Decomposition Doctrine (see [SOP-001: New Feature](./NEW_FEATURE.md), Phase 2). Each task is one deliverable, has a clear Definition of Done, and maps to the proposal.

2. The Tech Lead produces a **migration plan** that sequences the change so the system remains operable throughout. Architecture changes are rarely a single atomic switch; the plan states the order of operations, what is built alongside the old structure, when consumers cut over, and when the old structure is removed.

3. The plan includes a **rollback path**. Every architecture change states how it is reversed or contained if it proves wrong in implementation — a feature flag, a compatibility layer, a staged cutover, or a documented revert sequence. A change with no rollback path is escalated to the CTO before implementation begins (see [SOP-006: Rollback](./ROLLBACK.md) for production rollback mechanics).

4. The **Infrastructure Engineer** confirms that any infrastructure prerequisites are sequenced ahead of the engineering work that depends on them.

5. The Tech Lead assigns tasks to engineers and confirms the migration plan against the approved proposal — the implementation must build the structure that was approved, not a convenient approximation of it.

**Gate 4:** A decomposed, sequenced migration plan exists with assignments and a rollback path. Infrastructure prerequisites are ordered correctly.

---

### Phase 5: Implementation and Review

**Owner:** Tech Lead (coordination); assigned engineers (execution); Reviewer (review)  
**Input:** Migration plan; approved proposal  
**Output:** The change implemented and reviewed against the approved architecture  

**Steps:**

1. **Engineers** implement the migration plan. They build to the approved proposal. When implementation reveals that the approved structure does not work as designed, the engineer does not silently improvise a different architecture — they raise it to the Tech Lead, and a material divergence returns to Phase 1 as a revision to the proposal.

2. The **Tech Lead** monitors progress against the migration plan and escalates risk early — when a step exceeds estimate, when a blocker appears, or when the change is proving larger than approved.

3. Code is reviewed per [SOP-003: Code Review](./CODE_REVIEW.md), with an additional architecture check: the **Reviewer** confirms that the implementation matches the approved structure and does not drift from it. The Reviewer reads the implementation against the proposal, not only against general code-quality standards. A correct implementation of the wrong (un-approved) architecture is a Blocking finding.

4. The **Security Engineer** re-reviews the implementation when the change carried a security trigger, confirming the implemented structure preserves the security properties the proposal claimed.

5. The change is validated and released through the normal delivery path — QA per [SOP-004: QA Validation](./QA_VALIDATION.md) and release per [SOP-005: Release](./RELEASE.md). Architecture changes follow the same delivery gates as any other change; they are not exempt from QA or release readiness because they are "internal."

**Gate 5:** The change is implemented to the approved proposal, reviewed against the approved architecture, and delivered through the standard QA and release gates.

---

### Phase 6: Documentation and Architecture Memory

**Owner:** Technical Writer (documentation); Tech Lead and CTO (decision record)  
**Input:** Implemented and delivered architecture change  
**Output:** Updated architecture documentation; a durable decision record; an ADR for foundational changes  

**Steps:**

1. The **Technical Writer** updates the architecture documentation affected by the change — the [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md), the [Domain Model](../architecture/DOMAIN_MODEL.md), the [Company Runtime](../architecture/COMPANY_RUNTIME.md), or whichever documents describe the structure that changed. Documentation that describes the *old* structure is updated, not left to contradict the system.

2. The superseded state is marked, not deleted. When a pattern, boundary, or model is replaced, the documentation states what it was, what replaced it, and when — so a reader who encounters old code can understand the transition.

3. A **Decision Record** is written into [Decision Memory](../memory/DECISION_MEMORY.md) capturing the choice, the reasoning, the rejected alternatives, the accepted risks, the owner, the approval path, and the conditions under which it should be revisited. This is the lasting architecture memory the change is required to produce.

4. For **foundational** architecture changes — those that affect every module or set a long-lived direction — the **CTO** authors (or commissions) an [Architecture Decision Record (ADR)](../adr/ADR-001-execution-runtime-and-memory-retrieval.md) in `docs/adr/`. The ADR is the canonical, citable record of a foundational decision; the Decision Memory entry links to it. Not every architecture change warrants an ADR; every foundational one does. The CTO decides which changes are foundational.

5. The **Tech Lead** confirms that the documentation and the decision record are written and findable before closing the procedure. The change is not done while the memory is unwritten.

**Gate 6:** Architecture documentation is updated and the superseded state is marked. A Decision Record exists in Decision Memory. An ADR exists for foundational changes. The Tech Lead has confirmed the memory is written and findable.

---

## Decision Gates Summary

| Gate | Condition | Owner of Gate |
|---|---|---|
| Gate 1 | Complete proposal with explicit reasoning and ≥2 reasoned alternatives | Tech Lead |
| Gate 2 | Risk, security, and infrastructure reviews complete; every risk mitigated or accepted | Tech Lead |
| Gate 3 | Approved by the required authority (Tech Lead or CTO), in writing, recorded | CTO / Tech Lead |
| Gate 4 | Sequenced migration plan with assignments and a rollback path | Tech Lead |
| Gate 5 | Implemented to the approved proposal; reviewed against the architecture; delivered | Reviewer |
| Gate 6 | Documentation updated; Decision Record written; ADR for foundational changes | Technical Writer / Tech Lead |

---

## Architecture Change Proposal Format

Every architecture change is proposed in writing using this format. The proposal is the artifact that carries the change through every gate and becomes the basis of the decision record.

| Section | Content |
|---|---|
| **Title** | A specific, one-line description of the structural change |
| **Author and Tech Lead** | Who wrote the proposal and who owns the procedure |
| **Problem statement** | The structural problem or need. What does the current architecture not support, and what does that cost? |
| **Proposed change** | The new structure, concretely. What boundary, model, pattern, or dependency changes, and to what |
| **Reasoning** | Why this change is the right one, derived from the [Architecture Decision Framework](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md) criteria and priority order |
| **Alternatives considered** | At least two genuine alternatives. For each: what it was, and the specific trade-off that disqualified it |
| **Impact** | Which modules, contracts, and patterns are affected; what breaks; who must change |
| **Risks and mitigations** | Each material risk, scored, with a mitigation or a documented acceptance and an accepted-by owner |
| **Security and infrastructure assessment** | Whether security and infrastructure triggers are met, and the result of those reviews |
| **Migration approach** | How the change is sequenced so the system stays operable, including the rollback path |
| **Approval authority** | Whether this is a Tech Lead decision or requires CTO (and possibly CEO) approval, per the triggers below |
| **Reversal conditions** | Under what future conditions this decision should be revisited |

A proposal missing the reasoning, the alternatives, or the migration approach is incomplete and does not pass Gate 1. The proposal's depth scales with the change: a foundational change warrants a thorough document; a smaller structural change warrants a proportionate one. The required sections are never skipped, but their length is proportionate to the stakes.

---

## Approval Chain and Authority

Most technical-approach choices are the Tech Lead's to make. Choices that change the architecture beyond its current bounds are the CTO's to approve. This table draws that line so that neither over-escalation nor silent over-reach happens. It mirrors [Architecture Decision Framework §8–9](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md#8-authority--tech-lead-decides-vs-cto-approves).

| Change characteristic | Approval authority |
|---|---|
| Technical approach within existing boundaries and patterns | **Tech Lead decides** |
| New or changed module boundary | **CTO approves** |
| New storage, runtime, or queue model | **CTO approves** |
| New cross-cutting pattern adopted as a convention | **CTO approves** |
| Structural adoption of a new dependency that other modules will depend on | **CTO approves** |
| Change to a contract or data model that multiple modules depend on | **CTO approves** |
| Change to a provider-independence or replaceability commitment | **CTO approves** |
| A Blocking security finding accepted rather than resolved | **CTO approves** (the acceptance) |
| A change with no viable rollback path | **CTO approves** before implementation |
| Strategic, major-cost, or product-direction implications | **CTO escalates to CEO** for the strategic call |

When a change sits ambiguously between Tech Lead and CTO authority, it is routed to the CTO. The cost of an unnecessary CTO review is minutes; the cost of an un-approved structural change is a decision no one owns. The CTO may delegate a class of decisions back to the Tech Lead explicitly, in writing — but the default for any approval trigger is CTO approval.

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| A proposal meets a CTO approval trigger | CTO | At Gate 3, before any decision is recorded |
| Strategic, cost, or product-direction implications | CEO | When the CTO determines the change exceeds engineering authority |
| A Blocking security finding the team wants to accept rather than fix | CTO | Before any acceptance decision |
| A change has no viable rollback path | CTO | Before implementation begins |
| Implementation reveals the approved structure does not work | CTO (via Tech Lead) | As soon as a material divergence from the approved proposal is identified |
| Two participants disagree on whether a change is structural | Tech Lead, then CTO | On disagreement |
| An architecture change shipped without this procedure is discovered | CTO | Immediately on discovery — for retroactive review and recording |
| A scope or cost increase emerges mid-implementation beyond what was approved | CTO | As soon as the increase is known |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Architecture Change Proposal | Tech Lead / author | Phase 1 |
| Risk assessment with mitigations | Tech Lead | Phase 2 |
| Security review record (when triggered) | Security Engineer | Phase 2 |
| Infrastructure impact assessment (when triggered) | Infrastructure Engineer | Phase 2 |
| Recorded approval decision | CTO / Tech Lead | Phase 3 |
| Migration plan with rollback path | Tech Lead | Phase 4 |
| Implementation (code change) | Assigned engineers | Phase 5 |
| Architecture review confirmation | Reviewer | Phase 5 |
| Updated architecture documentation | Technical Writer | Phase 6 |
| Decision Record (architecture memory) | Tech Lead / CTO | Phase 6 |
| Architecture Decision Record (ADR), for foundational changes | CTO | Phase 6 |

---

## Definition of Done

An architecture change is done when all of the following are true:

- [ ] The change was confirmed to meet the definition of an architecture change before this procedure was applied
- [ ] A written Architecture Change Proposal exists with explicit reasoning and at least two reasoned alternatives
- [ ] Risk, security (where triggered), and infrastructure (where triggered) reviews are complete
- [ ] Every material risk has a mitigation or a documented acceptance with an accepted-by owner
- [ ] The change was approved by the required authority, in writing, with the decision recorded
- [ ] A migration plan with a rollback path was produced before implementation
- [ ] The implementation matches the approved proposal and was reviewed against the architecture
- [ ] The change was delivered through the standard QA and release gates
- [ ] Architecture documentation is updated and the superseded state is marked
- [ ] A Decision Record exists in Decision Memory capturing reasoning, alternatives, accepted risks, owner, approval path, and reversal conditions
- [ ] An ADR was written for foundational changes
- [ ] The Tech Lead has confirmed the architecture memory is written and findable

---

## Memory Updates

After each architecture change is completed, the following memory records are updated:

| Record | Content | Owner |
|---|---|---|
| Decision Record | The choice, reasoning, rejected alternatives, accepted risks, owner, approval path, reversal conditions | Tech Lead / CTO |
| Architecture Decision Record (ADR) | The canonical record of a foundational decision | CTO |
| Architecture documentation | Updated structure; superseded state marked with what replaced it and when | Technical Writer |
| [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md) | The current structural state of the affected repository | Tech Lead |
| [Company Memory](../memory/COMPANY_MEMORY.md) | New conventions or patterns the change established as company-wide standards | Tech Lead |
| Security pattern library | Any security pattern introduced or changed by the change | Security Engineer (when applicable) |

Architecture memory is the durable output this procedure exists to produce. A change whose code shipped but whose memory was never written is not complete — it has created a structure no future employee can find the reasoning for. See [Decision Memory](../memory/DECISION_MEMORY.md) for the record structure and write rules.

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Proposal completeness | 100% — every architecture change has a written proposal with reasoning and ≥2 alternatives before approval | Decision records |
| Approval compliance | 100% — every change meeting an approval trigger has recorded CTO (or CEO) approval | Decision records |
| Architecture memory rate | 100% — every completed change has a Decision Record; every foundational change has an ADR | Memory audit |
| Documentation currency | 100% — architecture docs updated within one sprint of the change shipping | Documentation audit |
| Rollback-path coverage | 100% — every approved change had a documented rollback path before implementation | Migration plans |
| Silent structural change rate | Zero — no architecture change reaches production without this procedure | Retrospective review |
| Decision reversal rate | Tracked — architecture decisions reversed within 90 days, with reason | Decision records |

---

## Failure Modes

### Structural change made through a feature or fix path
An engineer needs a structural change to ship a feature and makes it inline — a new module boundary, a new storage pattern, a structural dependency — without writing a proposal or seeking approval. The feature ships. The new structure is now in the codebase with no proposal, no recorded reasoning, and no owner. Caught when: a later engineer encounters the structure, cannot find why it exists, and either works around it or reverses it without knowing it was deliberate.

**Response:** When a feature or fix reveals a need for a structural change, the change is split out and run through this SOP. The feature waits on the architecture decision or is scoped to avoid the structural change until it is approved. A structural change discovered to have shipped without this procedure is escalated to the CTO for retroactive review and recording — the record is written even after the fact, and the gap is treated as a process failure.

### Proposal without real alternatives
The author writes a proposal that names the chosen approach and lists two "alternatives" that were never seriously considered — strawmen rejected in a sentence. The proposal satisfies the format but not its purpose. The decision is a default dressed as a deliberation. Caught when: a reviewer or the CTO asks why an alternative was rejected and the answer reveals it was never evaluated.

**Response:** Alternatives are genuine options with real trade-offs, evaluated through the [Architecture Decision Framework](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md). A proposal whose alternatives are strawmen is returned at Gate 1. The test is simple: could the company have chosen a listed alternative? If not, it is not an alternative — it is decoration.

### Approval trigger ignored because the Tech Lead is confident
A change clearly meets a CTO approval trigger — a new storage model, a structural dependency — but the Tech Lead is confident it is right and approves it themselves to keep moving. The CTO learns of the change after it shipped. Caught when: the decision record shows a structural change with Tech-Lead-only approval, or the CTO encounters a structure they never approved.

**Response:** The approval triggers are not discretionary and are not waived by confidence. A change that meets a trigger requires CTO approval regardless of how certain the Tech Lead is. The Tech Lead's authority is precisely bounded by the triggers; confidence does not expand it. If the Tech Lead believes a trigger is miscalibrated, that is a conversation with the CTO to change the trigger — not a reason to bypass it on a given change.

### Architecture change shipped without updating documentation
The change is implemented, reviewed, and released. The architecture documentation still describes the old structure. New engineers read the docs, build to the old model, and reintroduce the boundary the change removed. Caught when: documentation and code contradict each other, or a new employee implements against documentation that no longer reflects reality.

**Response:** Documentation update is Phase 6 and a Definition-of-Done item. The change is not complete while the docs describe a structure that no longer exists. The Technical Writer updates the affected documents and marks the superseded state; the Tech Lead confirms it before closing the procedure.

### Decision record never written
The change ships and the team moves on. No Decision Record is written. Six months later, an engineer questions the structure, cannot find why it was chosen, and proposes reversing it — re-litigating a trade-off the company already settled, with none of the original context. Caught when: a decision is re-debated from scratch, or a deliberate decision is reversed without anyone knowing it was deliberate.

**Response:** The Decision Record is the lasting architecture memory this procedure exists to produce. It is a Definition-of-Done item and a Phase 6 gate. The Tech Lead does not close the procedure until the record — reasoning, alternatives, accepted risks, owner, approval path, reversal conditions — is written into [Decision Memory](../memory/DECISION_MEMORY.md) and is findable.

### Migration with no rollback path
A large structural change is implemented as a single cutover with no way back. Mid-migration, the new structure proves wrong under real load. There is no rollback, so the team must fix forward under pressure, often making the architecture worse to stabilize it. Caught when: a migration fails and the only options are bad ones.

**Response:** Every architecture change states its rollback path in Phase 4 before implementation. A change with no viable rollback is escalated to the CTO, who decides whether the risk is acceptable and records that acceptance. Large changes are sequenced so the system stays operable throughout — built alongside the old structure, cut over in stages — rather than switched atomically with no return.

---

## Anti-Patterns

**"It's just a refactor."** A change that moves a responsibility across a module boundary, replaces a storage or runtime model, or changes a shared contract is not a refactor — it is an architecture change, even when it is dressed as cleanup. A refactor preserves boundaries, contracts, and patterns. The moment a change alters one of those, this SOP applies. Calling a structural change a refactor to avoid the procedure is the most common way architecture drifts silently.

**The proposal written to justify a decision already implemented.** A proposal written after the code is built is a description of what was done, not a decision about what should be done. It cannot function as a gate because there is nothing left to gate. Proposals are written before implementation, and the alternatives are evaluated when they are still real choices.

**Over-escalating every technical choice to the CTO.** The mirror image of bypassing approval is routing every local implementation choice to the CTO for safety. This is also a failure — it floods the decision authority, slows the company, and erodes the Tech Lead's ownership of technical approach. The triggers exist precisely so the line is drawn once and applied consistently. Within the boundaries and patterns the architecture already establishes, the Tech Lead decides.

**Treating the decision record as paperwork.** The Decision Record and ADR are not bureaucratic artifacts produced to satisfy a checklist. They are how the company keeps the reasoning behind its most expensive decisions, so it does not re-litigate settled trade-offs or reverse deliberate ones blindly. A company that does not write its architecture memory makes the same structural mistakes repeatedly and cannot tell a deliberate decision from an accident. Writing the record is engineering work, not overhead.

**Letting implementation quietly redesign the approved architecture.** When the approved structure proves awkward in code, the temptation is to adjust it on the fly and ship something different from what was approved. The result is a system whose architecture no one actually decided. A material divergence from the approved proposal returns to Phase 1 as a revision — the proposal and the system stay in agreement, and the decision record reflects what was actually built.
