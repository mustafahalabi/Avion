# Decision Memory

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

Decision Memory is the layer of the Engineering OS memory system that preserves the company's significant choices. It holds the decisions that shape future work — architectural directions, scope calls, risk acceptances, technology selections, process changes — together with the reasoning behind them, the alternatives that were rejected, the risks that were accepted, who owned the decision, the path by which it was approved, and when it should be revisited.

A Decision Record is not a log entry. It is the durable answer to a question a future employee will inevitably ask: *"Why is it done this way, and what did we already consider?"* Without Decision Memory, the company silently re-litigates settled trade-offs, or worse, reverses a deliberate one without knowing it existed.

This document defines what belongs in Decision Memory, how a Decision Record is structured, who owns it, how it is written and kept accurate, how it relates to the runtime **Decision System** (the approval flow) and to **architecture decision records (ADRs)**, and how it differs from the other memory layers. It is the operational contract for the `decision`-category memory bank and the decision records inside it.

This document is implementation-aware. Where behavior is already built into the platform, it is marked **Implemented today**. Where behavior is specified by the [Domain Model](../architecture/DOMAIN_MODEL.md) and [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) but not yet built, it is marked **Designed / planned**. [Section 13](#13-implemented-today-vs-designed--planned) consolidates the split so no reader mistakes intent for capability.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope — What Decisions Must Be Remembered](#2-scope--what-decisions-must-be-remembered)
3. [Relationship to the Other Memory Layers](#3-relationship-to-the-other-memory-layers)
4. [Relationship to the Decision System and Architecture Decision Records](#4-relationship-to-the-decision-system-and-architecture-decision-records)
5. [Ownership](#5-ownership)
6. [Decision Record Structure](#6-decision-record-structure)
7. [Data Model](#7-data-model)
8. [Write Rules](#8-write-rules)
9. [Update Rules — Supersession and Reversal](#9-update-rules--supersession-and-reversal)
10. [Validation](#10-validation)
11. [Conflict Resolution](#11-conflict-resolution)
12. [Retention](#12-retention)
13. [Implemented Today vs. Designed / Planned](#13-implemented-today-vs-designed--planned)
14. [Examples](#14-examples)
15. [Anti-Patterns](#15-anti-patterns)
16. [Definition of Done](#16-definition-of-done)
17. [Cross-References](#17-cross-references)

---

## 1. Purpose

Decision Memory exists so that the company's deliberate choices outlive the moment and the person who made them. A Decision is a non-trivial choice that constrains future options, represents a trade-off, or sets a direction — distinct from a routine implementation choice that affects only the work in front of you. Every such choice should leave a record.

Concretely, Decision Memory:

- **Preserves rationale over time.** It captures *why* a choice was made, not only *what* was chosen, so a future employee can tell a deliberate trade-off from an accident.
- **Records what was rejected.** The alternatives that were considered and dismissed — and the reason each was dismissed — are as valuable as the option chosen. They stop the company from re-evaluating a path it already ruled out.
- **Names accountability.** Every Decision has exactly one owner. The record makes that ownership explicit and durable.
- **Makes risk acceptance visible.** When the company knowingly accepts a risk, the record states the risk and the rationale, so the acceptance is a documented choice rather than an invisible assumption.
- **Enables informed reversal.** A decision can be revisited, but only safely if the original context, constraints, and trade-offs are on record. Decision Memory makes reversal a deliberate, traceable act.

Decision Memory is **not** a meeting log, an approval audit trail, or a changelog. It is a curated set of discrete, reusable records of *significant* choices that employees consult before making a decision in the same domain.

---

## 2. Scope — What Decisions Must Be Remembered

A choice belongs in Decision Memory when it is **significant** (it constrains or directs future work), **deliberate** (a real alternative existed), and **likely to be questioned later**. The [Domain Model — Decision](../architecture/DOMAIN_MODEL.md#decision) enumerates the qualifying types.

### Belongs in Decision Memory

| Decision type | Examples |
|---|---|
| Architecture | Choosing a module boundary, a data-ownership rule, a persistence strategy, a runtime model |
| Scope | Cutting a feature from a release, deferring a capability, splitting one feature into two |
| Security | Accepting a threat for now, requiring a control, choosing an auth model |
| Risk acceptance | Knowingly shipping a shortcut, deferring a defect, accepting a known limitation |
| Technology selection | Choosing a framework, a provider, a library over its competitors |
| Process | Changing how the company reviews, releases, or plans work |

The test: *if a new employee reversed this choice next month without knowing the context, would the company be worse off?* If yes, the decision must be remembered.

### Does NOT belong in Decision Memory

- **Routine implementation choices** — naming a variable, ordering parameters, a one-line refactor. These have no lasting consequence and do not constrain future work.
- **A hardened standard** → once a decision has solidified into a company-wide rule that employees simply follow, the *rule* lives in [Company Memory](./COMPANY_MEMORY.md); Decision Memory keeps the originating Decision Record it points back to.
- **Codebase-specific structure** → [Repository Memory](./REPOSITORY_KNOWLEDGE.md) (e.g., "this module depends on that one").
- **Single-feature context** → Feature Memory (the acceptance criteria or limitations of one feature), unless the feature embodies a company-significant decision.
- **The runtime approval event itself** → the act of the CEO approving a feature brief or a gate is a Decision-System event (see [Section 4](#4-relationship-to-the-decision-system-and-architecture-decision-records)) and a [Timeline](../architecture/DOMAIN_MODEL.md#timeline-entry) entry; the *durable choice* it represents is what becomes a Decision Record.
- **Raw artifacts** → the Artifact / Document stores. Decision Memory holds the distilled record, not the design doc that led to it.

> Rule of thumb: if you would want to attach the word *"because"* to a choice and have a future employee read it, it is a Decision. If the choice has no meaningful *because*, it is not.

---

## 3. Relationship to the Other Memory Layers

Engineering OS organizes memory into cumulative layers (defined in the [Domain Model — Memory](../architecture/DOMAIN_MODEL.md#memory)). Decision Memory is the layer dedicated to *choices and their rationale*. It interacts with the other layers as follows.

| Layer | Owns | Relationship to Decision Memory |
|---|---|---|
| **[Company Memory](./COMPANY_MEMORY.md)** | Organization-wide standards, rules, and lessons | Company Memory encodes the **standing rule** a decision produced; the Decision Record remains the authoritative record of the **choice**. Company Memory *references* a hardened decision; it does not replace it. |
| **[Employee Memory](./EMPLOYEE_MEMORY.md)** | Role-specific knowledge held by one employee | A recurring choice an employee makes within their domain may rise to a company Decision when it affects others. The Decision Record is the destination, not the source. |
| **Team / Department Memory** | Knowledge shared within one department | A departmental decision that constrains other departments becomes a company Decision Record. |
| **[Repository Memory](./REPOSITORY_KNOWLEDGE.md)** | Structure, architecture, and history of one codebase | Repository-scoped architectural choices are recorded as Decisions and cited from Repository Memory. Decision Memory holds the *why*; Repository Memory holds the *what is there now*. |
| **Feature Memory** | Purpose, decisions, and limitations of one feature | Feature-level technical decisions are recorded here when they have consequences beyond the feature; routine feature choices stay in Feature Memory. |
| **Conversation Memory** | Session-scoped working context | Never promoted automatically. A conversation may *surface* a decision worth keeping, but a person or workflow must deliberately write the Decision Record. |

**Direction of flow:** decisions are made within the work (planning, review, QA, release, incidents) and written into Decision Memory deliberately. Once a decision hardens into a rule everyone follows, the rule is *promoted* into Company Memory **with a citation back to the Decision Record** — the record is never discarded. Knowledge does not leak downward: a Decision Record does not silently overwrite a repository- or feature-specific fact.

**Decision vs. Knowledge.** A Decision Record is *accumulated working memory* of a choice. The [Knowledge Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#411-knowledge-boundary) is the *curated, authoritative* tier maintained by the Technical Writer. A decision with lasting reference value (a canonical architecture direction, for example) may be promoted into a published Knowledge Record; Knowledge is reviewed and approved, Decision Memory is not.

This document owns the **decision** scope. It does not restate the generic memory rules that [Company Memory](./COMPANY_MEMORY.md) owns (one-fact-per-record discipline, the `source`/`confidence` mechanics, promotion); it specializes them for decisions.

---

## 4. Relationship to the Decision System and Architecture Decision Records

Two adjacent concepts are easy to conflate with Decision Memory. They are related but distinct.

### 4.1 The Decision System (the runtime approval flow)

The **Decision System** is the runtime mechanism by which the company surfaces choices that require the CEO. It is about *making and routing* a decision in the moment; Decision Memory is about *remembering* it afterward.

**Implemented today**, the Decision System manifests as:

- The `decision`-typed notification — when a request reaches `awaiting_approval`, the runtime emits a "Decision needed" notification to the CEO (`apps/web/src/app/actions/runtime.ts`, `type: "decision"` in `apps/web/src/lib/notify.ts`).
- The **approval-checkpoint queue** — at sub-threshold autonomy the gate-advancement service halts a task at a review or QA gate, and `apps/web/src/lib/approval-checkpoints.ts` reads those paused `Review` / `QAResult` rows as the CEO's "needs your decision" queue, resuming the flow through the real review/QA services on approve (or sending it back on reject). Autonomy levels determine which gates require a decision (see the [Technical Architecture — Autonomy Level Enforcement](../architecture/TECHNICAL_ARCHITECTURE.md#autonomy-level-enforcement)).

These are **decision *points*** — moments where the company pauses for a human choice. When such a point resolves a *significant* choice (not a routine approve-and-continue), it should leave a **Decision Record** in Decision Memory. The notification and checkpoint are the act; the record is the memory. The act is also a [Timeline](../architecture/DOMAIN_MODEL.md#timeline-entry) entry and, where approval is required, a [Notification](../architecture/DOMAIN_MODEL.md#notification); none of those is a substitute for the durable Decision Record.

The **approval path** captured in a Decision Record (see [Section 6](#6-decision-record-structure)) is precisely the trace of how a choice moved through the Decision System: who proposed it, who held authority, and who approved it.

### 4.2 Architecture decision records (ADRs)

An **architecture decision record (ADR)** is the well-known industry practice of writing one short document per architecturally significant decision. In Engineering OS, an ADR is simply a Decision Record whose `type` is `architecture` — the same structure defined in [Section 6](#6-decision-record-structure), surfaced through Decision Memory rather than as a separate file convention.

- The **Decision** and **Decision Record** objects in the [Domain Model](../architecture/DOMAIN_MODEL.md#decision-record) generalize the ADR idea to every significant decision type (scope, security, risk, technology, process), not architecture alone.
- Architecturally significant decisions are owned by the **CTO** and, when they set lasting direction, may be promoted into a curated Knowledge Record of type `architecture` (see the [Knowledge Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#411-knowledge-boundary)).
- Per the [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md), any future architecture proposal that contradicts an approved architecture document **requires CTO approval and a recorded Decision Record**. That recorded Decision Record lives in Decision Memory.

In short: the Decision System decides, Decision Memory remembers, and an ADR is the architecture-typed shape of what Decision Memory remembers.

---

## 5. Ownership

| Concern | Owner |
|---|---|
| Decision Memory as a whole (integrity, conflicts, structure) | **CTO** |
| Each individual Decision Record's content | The **decision maker** — the employee who holds authority for the decision's domain |
| Curation and promotion to Knowledge | **Technical Writer** |
| CEO oversight | The CEO approves decisions that require approval, and may browse and annotate, but does not curate |

Per the [Domain Model — Decision](../architecture/DOMAIN_MODEL.md#decision), **every Decision has exactly one decision maker**, and that owner depends on the domain: the **CTO** for architecture and security, the **Product Manager** for scope, the **Tech Lead** for technical execution choices, the **Release Manager** for release decisions, and the relevant authority for everything else. The CTO owns the *accuracy* of the layer: resolving contradictions, ensuring records are written at the right scope, and confirming that significant choices are not made silently.

A decision that requires approval (per the current autonomy level) is owned by its decision maker but is not final until the **approval path** is satisfied — that path is part of the record, not separate from it.

---

## 6. Decision Record Structure

A Decision Record is the permanent written form of a Decision. The fields below are the **canonical structure** every Decision Record should carry, drawn from the [Domain Model — Decision Record](../architecture/DOMAIN_MODEL.md#decision-record). [Section 7](#7-data-model) explains how this structure maps onto what ships today.

| Field | Required | Meaning |
|---|---|---|
| **Title** | Yes | A short, specific name for the choice (e.g., "Use deterministic planning until models are specified"). |
| **Type** | Yes | One of `architecture` / `scope` / `security` / `risk_acceptance` / `process` / technology selection. |
| **What was decided** | Yes | The choice itself, stated unambiguously. |
| **Why (reasoning)** | Yes | The reasoning that led to the choice — the constraints, goals, and context that made it the right call. |
| **Alternatives rejected** | Yes | Each option considered and **the reason it was dismissed**. A record with no alternatives is incomplete. |
| **Risks accepted** | When applicable | The risks the company knowingly takes on by choosing this, and why they are acceptable. |
| **Trade-offs accepted** | When applicable | What is being given up in exchange for what is gained. |
| **Decision owner** | Yes | The single employee accountable for the decision (the decision maker). |
| **Approval path** | When approval is required | Who proposed it, who held authority, and who approved it — the trace through the Decision System. |
| **Status** | Yes | `proposed` / `approved` / `implemented` / `superseded` / `reversed`. |
| **Future considerations** | Recommended | What a future decision maker should know, and **when this decision should be revisited** (the review note). |
| **Supersedes / superseded by** | When applicable | A link to the prior decision this replaces, or the successor that replaced it. |

**The two non-negotiable fields are *reasoning* and *alternatives rejected*.** A record that states a choice without explaining why, or without naming what was rejected, is not a Decision Record — it is an assertion. The acceptance criteria for this layer require both.

---

## 7. Data Model

**Implemented today.** Engineering OS does **not** yet have a first-class `Decision` or `DecisionRecord` table. Decisions are stored as memory records inside a memory bank whose `category` is `decision`. The `decision` category is one of the eight valid categories enforced in the memory action layer (`VALID_CATEGORIES` in `apps/web/src/app/actions/memory.ts`), alongside `company`, `architecture`, `product`, `security`, `operations`, `employee`, and `feature`.

A Decision Record therefore ships today as a `MemoryRecord` row inside a `decision`-category `Memory` bank:

**`Memory` (the decision bank)**

| Field | Type | Notes |
|---|---|---|
| `id` | string (cuid) | Primary key |
| `companyId` | string | Scopes the bank to one company |
| `title` | string | Display name (e.g., "Decision Memory" or a domain-specific decision bank) |
| `category` | string | `decision` for this layer |
| `ownerType` / `ownerId` | string? | Identifies the owning scope |
| `createdAt` / `updatedAt` | datetime | Timestamps |

**`MemoryRecord` (one decision)**

| Field | Type | Notes |
|---|---|---|
| `id` | string (cuid) | Primary key |
| `memoryId` | string | Parent decision bank |
| `content` | string | The decision, written to the [structure in Section 6](#6-decision-record-structure) (1–10,000 chars, enforced in the action layer) |
| `source` | string? | The work item that produced the decision — task, review, incident, or the prior decision it supersedes (≤ 500 chars) |
| `confidence` | float, default `1.0` | How firmly the decision stands; lower it toward `0` when the decision is superseded or reversed |
| `createdAt` / `updatedAt` | datetime | Timestamps |

**Created on demand (Implemented today).** Unlike the five banks seeded at company creation (`company`, `architecture`, `product`, `security`, `operations` — see `apps/web/src/lib/company-seed.ts`), a `decision` bank is **not** seeded. It is created on demand through `/memory/new` (choosing the `decision` category) the first time the company records a decision. Records are added through the `addMemoryRecord` server action (`apps/web/src/app/actions/memory.ts`). Every read and write is scoped to the authenticated CEO's company.

> The structured per-field semantics in the Domain Model — discrete `type`, `status` (`proposed` / `approved` / `implemented` / `superseded` / `reversed`), an explicit `approval_path`, and a `supersedes` link — are **Designed / planned**. Until they ship, the full [Decision Record structure](#6-decision-record-structure) is encoded **inside the record's `content`** as labeled sections, with `source` carrying provenance and `confidence` carrying the standing of the decision. Write decisions with that in mind; see [Section 13](#13-implemented-today-vs-designed--planned).

---

## 8. Write Rules

Writing a Decision Record is a deliberate act performed when a significant choice is made.

1. **Record every significant decision.** If a choice constrains future work, accepts a risk, or sets a direction, it gets a record. A significant decision left unrecorded is a decision the company will accidentally reverse.
2. **One decision per record.** Each record captures a single choice. Do not bundle several unrelated decisions into one record — it cannot be superseded or cited cleanly.
3. **Reasoning is mandatory.** State *why*. A decision without reasoning invites a future employee to undo it without understanding the cost.
4. **Alternatives are mandatory.** Name the options you considered and rejected, and why. The rejected paths are the most expensive knowledge to recover later.
5. **Name the owner.** Record the single decision maker accountable for the choice. "The team decided" is not an owner.
6. **Capture the approval path when approval was required.** If the decision moved through the Decision System (a `decision` notification or an approval checkpoint), record who proposed, who held authority, and who approved.
7. **State accepted risks and trade-offs explicitly.** If the company is knowingly taking on a risk or giving something up, write it down. Silent risk acceptance is the most dangerous kind.
8. **Add a review note.** Where relevant, record *when* the decision should be revisited (a date, a milestone, or a triggering condition). Decisions made under temporary constraints should say so.
9. **Set `source` honestly.** Cite the task, review, incident, or prior decision that produced this one. Source is how the CTO audits and how supersession is traced.
10. **Set `confidence` deliberately.** Use `1.0` for a firm, approved decision. Lower confidence signals a provisional decision still being validated.
11. **Choose the right bank.** Architecture decisions may live in an architecture-oriented decision bank; cross-cutting decisions in the company decision bank. Do not scatter decisions arbitrarily.

**Who may write (Designed).** In the running company, decision records are produced by the responsible employees and by workflows after significant events — planning, code review, QA, release, bug-fix, and rollback flows each conclude by updating memory (see the [SOPs](../sops/)). **Implemented today**, decision records are written manually by the CEO through the memory surface; automatic workflow-driven decision writes are **Designed / planned**.

---

## 9. Update Rules — Supersession and Reversal

A Decision Record is a historical fact: it records that a choice *was made*, under a particular context. Therefore it is **never edited into a different decision**.

1. **Decisions are superseded, not rewritten.** When a decision changes, write a **new** Decision Record that states the new choice, cites the prior decision in `source`, and explains what changed and why. The original record stays.
2. **A reversal is a decision.** Reversing a prior decision is itself a significant decision — record it as such, with its own reasoning and alternatives, and link the decision it reverses. The [Domain Model](../architecture/DOMAIN_MODEL.md#decision) requires that a decision which supersedes another *reference* the superseded decision.
3. **Correct, don't distort.** Fixing a typo or clarifying wording in a record is fine. Changing the *meaning* of the decision is a supersession, not an edit.
4. **Supersession mechanism today (Implemented today).** Because the shipped schema has no `status` or `supersededBy` field, supersession is expressed by adding the new record (with a `source` that cites the record it replaces) and driving the old record's `confidence` toward `0`. When the `status` lifecycle ships, migrate to explicit `superseded` / `reversed` statuses with a version link.
5. **Authority is required to change a decision.** Only the owning authority (or a higher one) may supersede a decision — the CTO for architecture and security, the Product Manager for scope, and so on. A decision is not quietly overridden by whoever touches the work last.
6. **In-flight work finishes under the prior decision.** Per the [Domain Model — Company](../architecture/DOMAIN_MODEL.md#company), configuration changes take effect at workflow phase boundaries. A superseding decision applies to new work; in-progress work continues under the prior decision unless the change is a safety fix.

---

## 10. Validation

**Implemented today** (enforced in `apps/web/src/app/actions/memory.ts`):

- A decision bank `title` is required, trimmed, and ≤ 200 characters; its `category` must be `decision` (one of the eight valid categories).
- A record `content` is required, trimmed, and between 1 and 10,000 characters.
- A record `source` is optional and ≤ 500 characters.
- A record `confidence` is coerced to a number and clamped to `0.0`–`1.0`; it defaults to `1.0`.
- Every write resolves the company from the authenticated user and is rejected if it cannot be scoped to a company; a record write is rejected unless its parent bank belongs to the caller's company.

**Editorial validation (house rules):**

- The record states exactly one decision and is understandable without external context.
- **Reasoning is present** — the record explains *why*.
- **At least one rejected alternative is present**, with the reason it was rejected.
- The **decision owner** is named.
- The **approval path** is recorded when the decision required approval.
- Accepted **risks and trade-offs** are stated when applicable.
- `source` cites the originating work item (or the decision this one supersedes).
- `confidence` reflects how firmly the decision stands.

---

## 11. Conflict Resolution

Two decision records can contradict each other — a later decision quietly opposes an earlier one without referencing it, or two domains decide incompatible things. Contradictions in Decision Memory are corrosive: employees act on opposing choices and the company's direction becomes incoherent.

**Principles:**

1. **Never silently allow contradictions.** Consistent with the [Technical Architecture — Memory Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#410-memory-boundary), conflicting records are surfaced to the CTO, not quietly tolerated.
2. **The owning authority adjudicates.** The CTO resolves architecture and security conflicts; the Product Manager resolves scope conflicts. The adjudicator decides which decision stands and supersedes the other.
3. **A newer decision does not silently win.** A later decision overrides an earlier one only when it *explicitly* supersedes it with reasoning. An unreferenced contradiction is a conflict to escalate, not an implicit override.
4. **Resolution produces a record.** The outcome is itself a decision: the winning record is reaffirmed (confidence restored to `1.0`), the losing record is superseded, and the rationale is captured so the conflict is not re-litigated.

**Implemented today**, conflict detection is manual — the CEO and CTO spot contradictions while browsing `/memory`. Automatic conflict detection and a `memory.record_deprecated` event flow are **Designed / planned** per the Memory Boundary.

---

## 12. Retention

**Implemented today.** There is no delete path in the memory action layer — neither banks nor records expose a delete operation, so decision records persist for the life of the company. The only removal is **cascade on company deletion** (`onDelete: Cascade` in the schema): deleting a `Company` cascades to its `Memory` banks and their `MemoryRecord` rows.

**Designed / planned.** The [Domain Model](../architecture/DOMAIN_MODEL.md#decision) is explicit: **decisions are never deleted.** A superseded or reversed decision is retained with a link to its successor. The history of a decision — including the choices the company later changed its mind about — is part of the company's value, because it preserves the context a future reversal would need.

**Practical retention guidance until then:** to "retire" a decision today, supersede it (write the corrected decision, cite the old one in `source`) and drive the obsolete record's `confidence` to `0` rather than attempting to remove it.

---

## 13. Implemented Today vs. Designed / Planned

| Capability | Status |
|---|---|
| `decision` is a valid memory category | **Implemented today** |
| Decision records stored as `MemoryRecord` rows in a `decision` bank, company-scoped | **Implemented today** |
| `content`, `source`, `confidence` per record; full structure encoded in `content` | **Implemented today** |
| Decision bank created on demand via `/memory/new` (not seeded) | **Implemented today** |
| Add-record server action with Zod validation | **Implemented today** |
| Runtime Decision System: `decision` notifications + approval-checkpoint queue | **Implemented today** |
| Cascade deletion on company deletion | **Implemented today** |
| First-class `Decision` / `DecisionRecord` objects with discrete fields | Designed / planned |
| Per-decision `type` and `status` (`proposed`/`approved`/`implemented`/`superseded`/`reversed`) | Designed / planned |
| Explicit `approval_path` and `supersedes` version link | Designed / planned |
| Automatic workflow-driven decision writes (SOP completion) | Designed / planned |
| Automatic conflict detection + `memory.*` events | Designed / planned |
| Promotion to curated Knowledge Records (ADRs as published knowledge) | Designed / planned |

When in doubt, build and write against **Implemented today**; treat **Designed / planned** as the target the schema and process should evolve toward. Do not describe planned behavior as if it ships today, and do not invent fields or automation that are not in the schema.

---

## 14. Examples

**Good — an architecture decision / ADR (decision bank, confidence 1.0):**
> **Decision:** Plan generation stays deterministic/templated until the company, repository, and decision models are specified. **Why:** The v2 charter forbids adding AI behavior before the underlying models exist; templated generation avoids fake intelligence. **Alternatives rejected:** (a) LLM-driven planning now — rejected because it would fabricate repository intelligence the spec does not yet define; (b) no planner — rejected because the outcome→plan→work loop needs a reviewable plan today. **Risk accepted:** Plans are less adaptive until real-AI planning ships; acceptable because plans are CEO-reviewed before they apply. **Owner:** CTO. **Approval path:** Proposed by Tech Lead, approved by CTO. **Revisit when:** Engineering OS Specification v1.0 is approved. **Source:** Platform v2 charter.

**Good — a risk-acceptance decision (decision bank, confidence 1.0):**
> **Decision:** Pre-push guardrails are enforced independently of the agent's `claude -p` permission mode. **Why:** An agent can be instructed to ignore guidance, but the gate cannot be talked out of a block. **Alternatives rejected:** Relying on the permission mode alone — rejected because it is bypassable by prompt. **Risk accepted:** A correct change may be blocked by an over-broad protected-path rule; acceptable because a false block is safer than an unsafe push. **Owner:** CTO. **Source:** MUS-213 safety work.

**Good — a scope decision (decision bank, confidence 0.7, provisional):**
> **Decision:** Ship the first slice of Product Alerts (approval alerts only) and defer broader app-wide notices. **Why:** Approval alerts unblock the autonomy-gated checkpoint flow; broader notices are not on the critical path. **Alternatives rejected:** Building all notice types at once — rejected as scope creep ahead of the CEO Control Center. **Owner:** Product Manager. **Approval path:** Proposed by Product Manager, approved by CEO. **Revisit when:** CEO Control Center work begins. **Source:** MUS-216.

**Why these are good:** each captures one decision, states the reasoning, names the rejected alternatives, identifies the owner and (where relevant) the approval path, makes any accepted risk explicit, and notes when to revisit.

---

## 15. Anti-Patterns

- **The verdict with no reasoning.** "We chose Postgres." A choice with no *why* is an assertion no future employee can trust or safely reverse.
- **The decision with no alternatives.** Recording the chosen path but not what was rejected, so the company re-evaluates the same dead ends later.
- **The orphan owner.** "The team decided." Every decision has exactly one accountable owner; "the team" is no one.
- **The silent reversal.** Changing a decision in place, or writing a contradicting decision that never references the one it overturns.
- **The hidden risk.** Accepting a risk without recording it, so the acceptance becomes an invisible assumption that surprises the company later.
- **The approval-trail dump.** Logging every routine approval as a Decision Record. Decision Memory holds *significant* choices, not the audit trail of the Decision System.
- **The bundle.** Packing several unrelated decisions into one record so none can be cited or superseded cleanly.
- **The wrong layer.** Writing a routine implementation choice as a Decision, or burying a company-wide rule in a decision record instead of promoting the rule to [Company Memory](./COMPANY_MEMORY.md) with a citation back.
- **The contradiction left standing.** Noticing two decisions disagree and moving on. Conflicts must be escalated to the owning authority.

---

## 16. Definition of Done

A Decision Memory write is **done** when:

- [ ] The choice is genuinely significant; routine implementation choices have not been recorded as decisions.
- [ ] The record states exactly one decision and is understandable on its own.
- [ ] The **reasoning** (*why*) is present.
- [ ] At least one **rejected alternative** is present, with the reason it was rejected.
- [ ] The **decision owner** is named (a single accountable employee).
- [ ] The **approval path** is recorded when the decision required approval.
- [ ] Any **accepted risks and trade-offs** are stated explicitly.
- [ ] A **review note** is present when the decision was made under temporary or revisitable conditions.
- [ ] `source` cites the originating work item (or the decision this one supersedes), and `confidence` reflects how firmly the decision stands.
- [ ] It does not contradict an existing decision; if it does, the conflict was resolved (one decision superseded) rather than left standing.
- [ ] If it supersedes an older decision, the old record is marked down (confidence toward `0`) and the new record cites it — until the `status` lifecycle ships, this is the supersession mechanism.

The Decision Memory **layer** is healthy when every significant choice the company has made can be found, understood, and traced to its owner and rationale — and when no two decisions in active use contradict each other.

---

## 17. Cross-References

- [Domain Model — Decision](../architecture/DOMAIN_MODEL.md#decision) and [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record) — the authoritative object definitions, fields, and invariants.
- [Domain Model — Memory](../architecture/DOMAIN_MODEL.md#memory) and [Memory Record](../architecture/DOMAIN_MODEL.md#memory-record) — the memory-layer model decisions are stored within today.
- [Technical Architecture — Memory Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#410-memory-boundary) — write/read interface, conflict handling, and retrieval.
- [Technical Architecture — Knowledge Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#411-knowledge-boundary) — promotion of durable decisions into curated Knowledge Records (ADRs as published knowledge).
- [Technical Architecture — Autonomy Level Enforcement](../architecture/TECHNICAL_ARCHITECTURE.md#autonomy-level-enforcement) — how the Decision System decides which choices require CEO approval.
- [Company Memory](./COMPANY_MEMORY.md) — the layer that encodes the standing rules hardened decisions produce.
- [Employee Memory](./EMPLOYEE_MEMORY.md) and [Repository Knowledge](./REPOSITORY_KNOWLEDGE.md) — sibling memory layers; decisions are cited from them, not duplicated into them.
- [SOPs](../sops/) — the workflows whose completion records decisions back into memory.

Companion memory-layer documents (same milestone): Company Memory, Employee Memory, and Repository Knowledge. This document owns the decision layer; those documents own their respective scopes and should not duplicate the rules defined here.
