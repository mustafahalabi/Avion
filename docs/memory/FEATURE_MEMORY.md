# Feature Memory

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

This document is the canonical specification for **Feature Memory** — the per-feature layer of the company's [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md). It defines what every completed feature must remember, who owns that memory, when it is written and updated, and the rules that keep it trustworthy.

Feature Memory exists to answer one question for any employee about to touch a feature: **why does this feature exist, who asked for it, what decisions shaped it, and what do we already know about its limits?** It is the record that links *product rationale* (the problem, the requester, the intent) to the *technical decisions* (the architecture, the trade-offs, the deviations) made while building it. Without it, the company re-derives context every sprint, re-litigates settled scope calls, and cannot onboard a new engineer onto an existing feature.

This document describes organizational behavior, not storage technology. Where it names concrete fields or screens, those are the current implementation surface (see [Section 11](#11-implementation-status)); the rules themselves are storage-agnostic and survive any change of database, embedding engine, or retrieval method. This document does **not** redefine the broader memory model — layers, the record model, read rules, and retention are owned by [ORGANIZATIONAL_MEMORY_SYSTEM.md](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md). It specializes that model for the Feature layer.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Ownership](#3-ownership)
4. [Required Feature Facts](#4-required-feature-facts)
5. [Lifecycle](#5-lifecycle)
6. [Creation During the New Feature SOP](#6-creation-during-the-new-feature-sop)
7. [Update Rules — Fixes and Improvements](#7-update-rules--fixes-and-improvements)
8. [Validation Rules](#8-validation-rules)
9. [Conflict Handling](#9-conflict-handling)
10. [Examples](#10-examples)
11. [Implementation Status](#11-implementation-status)
12. [Anti-Patterns](#12-anti-patterns)
13. [Definition of Done](#13-definition-of-done)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

Feature Memory serves four purposes:

1. **Preserve intent.** A feature's code says *what* it does; Feature Memory says *why* it exists and *who* needed it. Intent is the first thing lost when the people who built a feature move on.
2. **Link rationale to implementation.** It is the single place where the product reason for a feature is connected to the technical decisions that delivered it — so a future change can be evaluated against the original goal, not just the current code.
3. **Make features answerable.** It lets any employee answer "have we built something like this before?", "why does it work this way?", and "what did we decide *not* to do?" without reading the diff or interviewing the original team.
4. **Carry forward limitations and future work.** Known limitations, deferred scope, and follow-up ideas are recorded so the next person does not rediscover them as bugs or re-propose them as new ideas.

Feature Memory is not documentation for end users, and it is not the feature's code comments. It is the company's durable institutional understanding of a shipped capability. Per the [Domain Model](../architecture/DOMAIN_MODEL.md#feature), **a Feature is not `Done` until its Feature Memory record is created.**

---

## 2. Scope

### 2.1 In scope

- One Feature Memory record set per **shipped Feature** (the [Feature](../architecture/DOMAIN_MODEL.md#feature) object — a deliverable product capability).
- The product rationale: problem solved, requester, business intent, acceptance criteria *as shipped*.
- The technical decisions that shaped the feature, and pointers to their authoritative [Decision Records](../systems/DECISION_SYSTEM.md).
- Known limitations, deliberate out-of-scope choices, and recorded future-work ideas.
- Ownership history: who built it, who owns it now, and material handoffs.

### 2.2 Out of scope

- **The full memory model** — layers, the generic record schema, read/retrieval rules, and global retention live in [ORGANIZATIONAL_MEMORY_SYSTEM.md](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md). This document does not restate them.
- **Curated, user-facing reference material** — that is the Knowledge tier, governed by [KNOWLEDGE_LIBRARY_SYSTEM.md](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md). Feature Memory is generated continuously and may be rough; Knowledge is authored and reviewed.
- **The authoritative record of a decision** — Feature Memory *references* decisions; the canonical record lives in the [Decision System](../systems/DECISION_SYSTEM.md). Feature Memory captures the decision's effect on the feature, not the full deliberation.
- **Repository-wide architecture** — codebase structure and patterns are Repository Memory, not Feature Memory.
- **Storage choices** — table layout, indexing, embedding strategy, and file format are implementation details and are intentionally absent from the rules below.

### 2.3 Granularity

The unit of Feature Memory is the **Feature**, not the Task, the pull request, or the release. A feature delivered across multiple tasks, PRs, or even multiple releases still has exactly one Feature Memory identity; later releases append to it rather than create a new one (see [Section 5](#5-lifecycle)).

---

## 3. Ownership

| Concern | Owner |
|---|---|
| Feature Memory content and completeness | **Product Manager** |
| Architectural/technical decision capture referenced by it | Tech Lead |
| Quality oversight of the memory layer as a whole | CTO |
| Indexing / findability of attached documentation | Technical Writer |

The **Product Manager owns Feature Memory** because the Product Manager owns the feature's intent and acceptance criteria ([Domain Model — Feature](../architecture/DOMAIN_MODEL.md#feature)). The Tech Lead is accountable for ensuring the *technical decisions* the Product Manager links to are themselves recorded as proper [Decision Records](../systems/DECISION_SYSTEM.md). This split is deliberate: it forces the rationale-to-implementation link this document exists to preserve — neither role can complete the record alone.

Ownership is durable. When a feature changes hands, the new owner is recorded in the ownership history (see [Section 4](#4-required-feature-facts)); the record itself is never re-authored under a new owner without preserving the prior history.

---

## 4. Required Feature Facts

Every completed feature must remember the following. Facts marked **Required** must be present before the feature is `Done`; facts marked **Conditional** are required only when applicable.

| Fact | Requirement | What it captures |
|---|---|---|
| **Feature identity** | Required | Title and a stable reference to the [Feature](../architecture/DOMAIN_MODEL.md#feature) object. |
| **Problem solved** | Required | The user/business problem this feature addresses — the *why*, in product terms. |
| **Requester** | Required | Who asked for it (the CEO, a goal, an initiative). Links intent to its origin. |
| **Business intent / success metric** | Required | What outcome the feature was meant to produce. |
| **Acceptance criteria as shipped** | Required | The criteria that were actually satisfied, **noting any deviation** from the original [Feature Brief](../sops/NEW_FEATURE.md). |
| **Release version** | Required | The release in which the feature shipped. Anchors the feature in time. |
| **Key decisions** | Required | The technical/scope decisions that shaped the feature, each pointing to its [Decision Record](../systems/DECISION_SYSTEM.md). This is the rationale-to-implementation link. |
| **Known limitations** | Required (may be "none, as of \<release\>") | What the feature deliberately does not do or does not handle well. |
| **Out-of-scope / deferred work** | Conditional | Scope explicitly cut, and why. |
| **Future improvements** | Conditional | Recorded ideas for later, so they are not rediscovered or re-proposed. |
| **Ownership history** | Required | Who built it; who owns it now; material handoffs with dates. |
| **Source work item** | Required | The Task/Project/Execution that produced the feature, for traceability. |
| **Confidence** | Required | How settled this knowledge is (see [Section 8](#8-validation-rules)). |

Two facts carry the document's core obligation:

- **Acceptance criteria as shipped** must record reality, not the brief. If the feature shipped with three of four originally planned criteria, the record says so and says why. This is what makes the memory trustworthy.
- **Key decisions** must *link* product rationale to technical choice. A decision entry that reads "used a queue" is incomplete; "chose async queue processing over synchronous calls to keep checkout under the 2s budget the CEO set — see Decision Record" is complete.

---

## 5. Lifecycle

Feature Memory has a deliberately simple lifecycle that mirrors the feature it describes.

```
Feature shipped
   ↓  (New Feature SOP, Phase 8 — Memory Update)
Feature Memory created  →  the feature becomes Done
   ↓
[ Fixes / Improvements ]  →  Feature Memory appended (never overwritten)
   ↓
Feature retired / replaced  →  record marked superseded, retained
```

**Created.** Feature Memory is written exactly once, when the feature first ships, during Phase 8 of the [New Feature SOP](../sops/NEW_FEATURE.md). Creation is a gate, not cleanup: the feature is not `Done` until the record exists.

**Appended.** As the feature is fixed or improved over its life, the existing record is *extended* — new decisions, new limitations resolved or discovered, new release versions. The record accumulates; it is not rewritten. The history of how a feature evolved is itself valuable memory.

**Superseded.** When a feature is replaced or retired, its Feature Memory is **not deleted**. Consistent with the memory model's retention rules ([ORGANIZATIONAL_MEMORY_SYSTEM.md §9](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md), [§11](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md)), it is marked superseded with a pointer to the successor feature, so the reasoning behind a now-removed capability remains discoverable. Memory is never destroyed; it is retired.

---

## 6. Creation During the New Feature SOP

Feature Memory is created in **Phase 8 (Memory Update)** of the [New Feature SOP](../sops/NEW_FEATURE.md). The SOP makes this an explicit, gated step rather than optional post-ship housekeeping.

The procedure, as defined by the SOP:

1. The **Product Manager** updates the Feature Memory with: what the feature does and the problem it solves; the acceptance criteria as shipped (noting deviations from the brief); the release version in which it shipped; and the key decisions made during development.
2. The **Tech Lead** ensures any architectural decisions made during development are recorded in the appropriate [Decision Record](../systems/DECISION_SYSTEM.md), so the "key decisions" the Product Manager links to are themselves authoritative.
3. The **Technical Writer** confirms that documentation written for the feature is indexed and findable.

**Gate 8** is satisfied only when Feature Memory is updated and architectural decisions are recorded. Until Gate 8 passes, the feature is not `Done`. This is the enforcement point for the [Definition of Done](#13-definition-of-done) in Section 13 and the corresponding invariant in the [Domain Model](../architecture/DOMAIN_MODEL.md#feature) and [COMPANY_RUNTIME.md §22](../architecture/COMPANY_RUNTIME.md).

> **Today this step is performed manually** through the Memory surface; the runtime does not yet emit it automatically. See [Section 11](#11-implementation-status). The *rule* — no Feature Memory, no `Done` — holds regardless of who performs the write.

---

## 7. Update Rules — Fixes and Improvements

Feature Memory is a living record. The rules below govern how it changes after the initial ship.

### 7.1 When a fix changes behavior

A bug fix that changes what the feature does, or resolves a previously recorded limitation, **must update** the Feature Memory. The [Bug Fix SOP](../sops/BUG_FIX.md) completion is not done until:

- the relevant **known limitation** is updated (resolved, or restated more precisely), and
- if the fix involved a non-trivial decision, a new entry is added to **key decisions** pointing at its Decision Record.

A fix that does not change observable behavior (e.g., an internal refactor with no functional effect) does not require a Feature Memory update, but *may* add a note if it changes a recorded technical decision.

### 7.2 When an improvement extends the feature

An improvement that adds capability to an existing feature **appends** to the same Feature Memory record set. Specifically it adds:

- the new behavior to **what the feature does**,
- the new/changed **acceptance criteria as shipped**,
- the new **release version**, and
- any new **key decisions** and **limitations**.

An improvement large enough to be planned as its own Feature gets its own Feature Memory and a cross-reference to the parent; the line is the same one the planning hierarchy already draws between a Feature and a follow-on Feature.

### 7.3 Append, never overwrite

Updates **extend** Feature Memory; they do not erase prior facts. If a fact becomes wrong (e.g., a stated limitation no longer applies), the new state is added and the prior state is marked superseded — never silently deleted. This preserves the evolution narrative and is consistent with the global supersession rule ([ORGANIZATIONAL_MEMORY_SYSTEM.md §9](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md)).

### 7.4 Who updates

The **Product Manager** remains the owner of the update. For fixes and improvements that originate in engineering, the **Tech Lead** is responsible for surfacing the decision and limitation changes to the Product Manager so the record stays accurate. The ownership history is updated whenever the feature's owning role changes.

---

## 8. Validation Rules

A Feature Memory record is valid only when it meets the following:

1. **Completeness.** All **Required** facts in [Section 4](#4-required-feature-facts) are present. A record missing the problem solved, the requester, the release version, or key decisions is incomplete and does not satisfy Gate 8.
2. **Rationale-to-implementation link.** At least one key decision must connect a *product reason* to a *technical choice*. A record that lists technical decisions with no product rationale, or product rationale with no technical decisions, fails this document's central purpose.
3. **Acceptance criteria reflect reality.** The recorded criteria are the ones actually shipped, with deviations from the brief noted. A record that simply copies the original brief unchanged is presumed unvalidated.
4. **Decisions are linked, not narrated.** Key decisions point to authoritative [Decision Records](../systems/DECISION_SYSTEM.md). Feature Memory summarizes a decision's effect; it does not become the system of record for the decision itself.
5. **Confidence is set honestly.** Each record carries a confidence value. Facts asserted from direct knowledge (the team that shipped it) are high-confidence; facts inferred after the fact are lower-confidence and labeled as such. Confidence is a first-class field on every record (see [Section 11](#11-implementation-status)).
6. **Sourced.** Each record names its source — the work item, release, or decision it came from — so a reader can verify it.
7. **One feature, one identity.** A single shipped feature has exactly one Feature Memory identity across all its releases ([Section 2.3](#23-granularity)).

---

## 9. Conflict Handling

Conflicts arise when two records assert incompatible facts about the same feature — for example, two recorded decisions that contradict, or a limitation that one update says is resolved and another says still exists.

- **Do not silently overwrite.** The conflicting facts are both preserved; the resolution is recorded as a new, higher-confidence entry that supersedes the stale one. This follows the global conflict rule in [ORGANIZATIONAL_MEMORY_SYSTEM.md §10](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md).
- **Escalate decision conflicts to the decision owner.** When two *decisions* conflict, the conflict is a decision-system concern, not a memory-system concern. It is surfaced to the role that owns the decision domain (CTO for architecture, Product Manager for scope) and resolved with a new Decision Record; Feature Memory then points at the resolution.
- **Product Manager adjudicates rationale conflicts.** When the *product rationale* recorded for a feature is internally inconsistent (two different stated problems), the Product Manager — the owner — reconciles it and records the corrected intent.
- **Trust the source of truth.** Where Feature Memory disagrees with the authoritative Decision Record, the Decision Record wins and the Feature Memory entry is corrected to match.

The goal is never a single tidy record; it is an honest, traceable history in which the current best understanding is clearly marked and the path to it is preserved.

---

## 10. Examples

The examples below illustrate **shape and quality**, not storage format.

### 10.1 A complete Feature Memory record (good)

> **Feature:** Subscription checkout
> **Problem solved:** Customers could not pay for recurring plans; revenue was one-time only. Requested by the CEO as part of the "Recurring Revenue" goal.
> **Business intent:** Enable monthly/annual subscriptions; success = first paid subscription within the release window.
> **Acceptance criteria as shipped:** Monthly and annual plans, card payment, and dunning email on failure — *deferred:* proration on mid-cycle plan change (cut from the brief to hit the release; see future improvements).
> **Release version:** v1.4.0.
> **Key decisions:**
> – Chose an async queue for payment confirmation over synchronous calls, to keep checkout under the CEO's 2s budget — *Decision Record: DR-031*.
> – Chose the existing billing provider over a new integration to avoid a second PCI scope — *Decision Record: DR-032*.
> **Known limitations:** No proration on plan changes; refunds are manual.
> **Future improvements:** Proration; self-serve refunds.
> **Ownership history:** Built by the Engineering team under Tech Lead; owned by the Product Manager.
> **Source:** Project "Subscriptions"; Execution exec-118.
> **Confidence:** High (recorded by the shipping team at release).

This record links *why* (recurring revenue, CEO request, 2s budget) to *how* (async queue, existing provider) and is honest about what shipped (proration deferred).

### 10.2 The same record, done badly (anti-example)

> **Feature:** Subscription checkout
> **Notes:** Added subscriptions. Used a queue. Works.

This fails [Section 8](#8-validation-rules) on completeness, rationale-to-implementation linkage, acceptance-criteria honesty, and sourcing. It records that something happened but preserves none of the knowledge the company will need in six months.

### 10.3 An update after a fix

> **Update (v1.4.2):** Resolved the "refunds are manual" limitation — refunds are now self-serve. New decision: refund authority capped at the original charge amount to prevent over-refund — *Decision Record: DR-040*. Prior limitation marked superseded.

---

## 11. Implementation Status

This section separates what the platform implements **today** from what is **designed but not yet built**, per the project's hard rule against describing capability that does not exist.

### 11.1 Implemented today

- **A Feature layer exists in the memory store.** A `Memory` bank carries `companyId`, `title`, `summary`, `category`, `ownerType`/`ownerId`, and `tags`; a `MemoryRecord` carries `content`, `source`, and a `confidence` value (0–1). Feature Memory is the `feature` **category** of this store — one of eight recognized categories (`company`, `architecture`, `product`, `security`, `operations`, `employee`, `feature`, `decision`).
- **Confidence and source are first-class** on every record and are displayed on read — directly supporting the validation rules in [Section 8](#8-validation-rules).
- **CEO-facing surface.** The **Memory** section of the app lists every bank with its record count and category, and a detail view shows each record's content, source, confidence, and date. A Product Manager (acting through the CEO's company) can create a Feature-category bank and append records to it.
- **The rule is enforced by procedure.** Feature Memory creation is Gate 8 of the [New Feature SOP](../sops/NEW_FEATURE.md); the SOP and the [Domain Model](../architecture/DOMAIN_MODEL.md#feature) both state that a feature is not `Done` without it.

### 11.2 Designed / planned (not yet built)

- **Automatic, workflow-driven writes.** Today, Feature Memory records are created and appended **manually** through the Memory UI. The runtime does not yet emit a Feature Memory write automatically when a feature ships or is fixed. Having the runtime write Feature Memory as a byproduct of work is the central planned evolution of the memory system.
- **Structured Feature facts as fields.** The required facts in [Section 4](#4-required-feature-facts) are recorded today as record *content* and *source* text, not as distinct typed fields. A structured Feature Memory schema (problem, requester, acceptance-as-shipped, linked decisions, limitations, ownership history) is designed but not yet enforced.
- **Supersession status and chains.** The append-never-overwrite and superseded-pointer rules ([Section 5](#5-lifecycle), [Section 7.3](#73-append-never-overwrite)) are specified; the current schema appends and edits records without an explicit `active`/`superseded` status field, so supersession is a discipline, not yet a constraint.
- **Enforced retrieval before related work.** Employees consulting Feature Memory before changing a feature is specified ([ORGANIZATIONAL_MEMORY_SYSTEM.md §8](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md)); real-AI employees that retrieve and respect memory are gated behind **Engineering OS Specification v1.0** and are not yet implemented.

No part of this section should be read as claiming automation that does not exist. Where behavior is aspirational it is labeled designed/planned.

---

## 12. Anti-Patterns

- **Treating the memory update as administrative overhead.** Feature Memory is not bureaucracy; it is how the company retains what it has built. A company that skips it makes the same decisions repeatedly and cannot onboard onto its own features. The update is engineering work, and the feature is not complete without it.
- **Copying the brief instead of recording reality.** Pasting the original Feature Brief as "acceptance criteria as shipped" hides every deviation that actually occurred. The record must describe what shipped, not what was planned.
- **Recording technical decisions with no product reason (or vice versa).** A list of technical choices with no rationale — or a problem statement with no implementation decisions — breaks the one link this document exists to preserve.
- **Letting Feature Memory become the decision system of record.** Narrating an entire decision inside Feature Memory duplicates and eventually contradicts the [Decision System](../systems/DECISION_SYSTEM.md). Summarize the decision's effect; link to the authoritative record.
- **Overwriting on update.** Editing a record in place to "keep it clean" destroys the evolution history. Append and supersede; never erase.
- **Deleting memory for retired features.** Removing a feature's memory when the feature is removed discards the reasoning a future team will need to understand why the capability existed. Mark superseded; retain.
- **One record per release instead of per feature.** Splitting a feature's knowledge across many records (one per ship) makes "what does this feature do today?" unanswerable. One feature, one memory identity.

---

## 13. Definition of Done

A feature's Feature Memory is **Done** when:

- [ ] A Feature Memory record set exists for the shipped feature (one identity per feature).
- [ ] All **Required** facts in [Section 4](#4-required-feature-facts) are present: problem solved, requester, business intent, acceptance criteria *as shipped* (with deviations noted), release version, key decisions, known limitations, ownership history, source, and confidence.
- [ ] At least one key decision links a **product rationale** to a **technical choice** and points to its [Decision Record](../systems/DECISION_SYSTEM.md).
- [ ] Architectural decisions made during development are recorded in their own Decision Records (Tech Lead).
- [ ] Documentation for the feature is indexed and findable (Technical Writer).
- [ ] Confidence and source are set on every record.
- [ ] **Gate 8** of the [New Feature SOP](../sops/NEW_FEATURE.md) has passed — without this, the feature itself is not `Done`.

For fixes and improvements, "Done" additionally requires that affected limitations and decisions have been **appended** (not overwritten) and the new release version recorded ([Section 7](#7-update-rules--fixes-and-improvements)).

---

## 14. Relationship to Other Documents

- **[ORGANIZATIONAL_MEMORY_SYSTEM.md](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md)** — the parent specification. Owns memory layers, the record model, read/retrieval rules, conflict and retention rules. Feature Memory is its Feature layer; this document specializes it and does not restate it.
- **[NEW_FEATURE.md](../sops/NEW_FEATURE.md)** — defines Phase 8 (Memory Update) and Gate 8, where Feature Memory is created.
- **[BUG_FIX.md](../sops/BUG_FIX.md)** — the path by which fixes update Feature Memory ([Section 7.1](#71-when-a-fix-changes-behavior)).
- **[DECISION_SYSTEM.md](../systems/DECISION_SYSTEM.md)** — the system of record for the decisions Feature Memory links to.
- **[KNOWLEDGE_LIBRARY_SYSTEM.md](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md)** — the curated tier; distinct from Feature Memory ([Section 2.2](#22-out-of-scope)).
- **[WORK_ITEM_SYSTEM.md](../systems/WORK_ITEM_SYSTEM.md)** — defines the Feature and Task objects Feature Memory describes and is sourced from.
- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#feature)** — defines the Feature object and the invariant that a feature is not `Done` until its Feature Memory record exists.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — describes how the runtime drives the memory-update step within the feature workflow.
