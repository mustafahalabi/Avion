# Employee Memory

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

This document specifies **Employee Memory** — the narrowest, most role-specific layer of the company's memory system. It defines what an individual employee role remembers independently of the rest of the organization, who owns those records, and the rules that govern when role memory is written, read, updated, retired, and resolved when it conflicts.

Employee Memory is one of the six memory layers defined in the canonical [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md). That document owns the system as a whole — the layer model, the record model, and the cross-layer rules. **This document does not restate it.** It narrows the focus to the Employee layer and its specific obligations: what belongs to a single role, what does not, and how that role's accumulated memory changes the way it works over time.

This is organizational behavior, not storage technology. Where it names a concrete field or screen, that reflects the current implementation surface (see [Section 11](#11-implementation-status)); the rules themselves are storage-agnostic and survive any change of database, index, or retrieval engine.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Employee Memory vs. Company Memory vs. Conversation Context](#3-employee-memory-vs-company-memory-vs-conversation-context)
4. [Memory Ownership by Role](#4-memory-ownership-by-role)
5. [Write Rules](#5-write-rules)
6. [Read Rules](#6-read-rules)
7. [Update and Supersession Rules](#7-update-and-supersession-rules)
8. [Validation](#8-validation)
9. [Retention Rules](#9-retention-rules)
10. [Conflict Handling](#10-conflict-handling)
11. [Implementation Status](#11-implementation-status)
12. [Examples](#12-examples)
13. [Anti-Patterns](#13-anti-patterns)
14. [Definition of Done](#14-definition-of-done)
15. [Relationship to Other Documents](#15-relationship-to-other-documents)

---

## 1. Purpose

Employee Memory exists to make a role behave **consistently across invocations**. Employees in Engineering OS are invoked, not always-on (see [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)). A role invoked today and the same role invoked next month are different runtime instances of the same employee. Employee Memory is what makes them behave like one continuous professional rather than two strangers who happen to share a job title.

It answers a focused question for one role: **what have I, in this role, already learned that should shape how I do this kind of work?**

Employee Memory serves three purposes specific to the layer:

1. **Continuity of craft.** A Frontend Engineer who established an accessibility convention does not re-decide it on the next task. A Reviewer who has seen a recurring anti-pattern recognizes it on sight rather than rediscovering it.
2. **Specialization that compounds.** Each role's competence grows independently within its domain. The depth of a role is the accumulation of its own memory — the conventions, preferences, and lessons that no other role needs but this one relies on constantly.
3. **Lightweight, fast-to-read context.** Because it is the narrowest layer, Employee Memory is the cheapest to retrieve and the first thing a role reads when invoked. It primes the role before broader, more expensive layers are consulted.

Employee Memory is **not** a personal scratchpad, a chat log, or a place to store things the whole company should know. It is the durable, role-scoped portion of organizational memory.

---

## 2. Scope

This document governs the **Employee layer only**.

**In scope:**

- What a single employee role records as its own role-specific memory: conventions, preferences, repeated review findings, domain idioms, and role-specific lessons learned.
- How Employee Memory is written, read, updated, validated, retained, and conflict-resolved within the boundaries of one role.
- The boundary between Employee Memory and the layers above it (Team, Company) and beside it (Conversation context).

**Out of scope:**

- **The memory system as a whole** — the six-layer model, the full record model, read precedence across all layers, and the global write/retention invariants are owned by the [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md). This document inherits those rules and only narrows them.
- **Team, Company, Repository, Feature, and Conversation layers** as primary subjects. They appear here only to mark the Employee layer's boundaries.
- **Knowledge** — the curated, authoritative tier maintained by the Technical Writer. Employee Memory is rough and experiential; Knowledge is reviewed and official.
- **Storage technology** — which database or index backs role memory. Those are implementation choices, intentionally absent from the normative rules.

---

## 3. Employee Memory vs. Company Memory vs. Conversation Context

The single most common memory error is putting a record in the wrong layer. These three layers are the ones a working employee confuses most often, so the distinction is stated explicitly.

| Dimension | Employee Memory | Company Memory | Conversation Context |
|---|---|---|---|
| **Scope** | One role | The whole organization | One working session |
| **Owner** | The employee in that role | CTO (oversight) | The active session |
| **Audience** | Primarily this role | Every employee | Only the current request |
| **Binding power** | Advises this role's choices | Constrains every role's choices | Binds nothing beyond the session |
| **Lifetime** | Persistent | Persistent | Expires at session close |
| **Example** | "I prefer composition over inheritance for shared UI." | "All UI must meet the company accessibility standard." | "For this request, the CEO clarified the button should be a link." |

Three rules follow from this table, and they are the heart of why the layers exist:

1. **A standard that binds every role is Company Memory, never Employee Memory.** If a Frontend Engineer's "preference" actually applies to all engineers, it does not belong to the Frontend role — it belongs to the company (or, when department-wide, to Team Memory). Recording an organization-wide rule as a single role's preference fragments the standard and lets other roles ignore it. When a role's accumulated preference matures into something the whole company should follow, it is **promoted upward**, not left in the role layer.

2. **Company Memory outranks Employee Memory on read.** A role's own preference never overrides an organization-wide standard. The retrieval precedence is defined globally ([Organizational Memory System §8.3](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#83-read-precedence)); within it, Employee Memory sits at the bottom — it is consulted, but a Company-scope record always wins.

3. **Conversation context never becomes Employee Memory by default.** Transient session reasoning expires by design. A durable lesson discovered during a conversation is **rewritten** as a proper Employee Memory record — attributed, sourced, and in plain language — before the session closes. Letting raw conversation context leak into a role's persistent memory is a defect ([Section 13](#13-anti-patterns)).

The principle: **scope is determined by who must obey the record, not by who happened to learn it.** A lesson learned by the Frontend Engineer that everyone must follow is Company Memory; a lesson only the Frontend Engineer needs is Employee Memory; a fact true only for the request in hand is Conversation context.

---

## 4. Memory Ownership by Role

Every role owns the Employee Memory for its own domain and no other. A Reviewer does not curate the Backend Engineer's API conventions; a Frontend Engineer does not record release history. The table below defines the **primary content** each role is responsible for accumulating in its own layer. It is grounded in the per-role Memory Ownership sections of the employee handbooks (e.g., [Reviewer](../employees/REVIEWER.md), [Frontend Engineer](../employees/FRONTEND_ENGINEER.md), [Tech Lead](../employees/TECH_LEAD.md)).

| Role | Owns in Employee Memory | Typical update trigger |
|---|---|---|
| **CTO** | Personal heuristics for architecture and technology evaluation that inform — but are distinct from — Company-scope Architecture Memory | After a significant evaluation or decision |
| **Tech Lead** | Decomposition heuristics, estimation calibration, recurring planning pitfalls for this codebase | After a sprint where an estimate or breakdown missed |
| **Product Manager** | Brief-writing conventions, recurring acceptance-criteria gaps, stakeholder-clarification patterns | After a brief that required rework |
| **Frontend Engineer** | UI conventions, accessibility conventions, animation/interaction preferences, known client-side regression patterns | Every PR with a non-obvious choice; every design gap resolved |
| **Backend Engineer** | API design conventions, data-modeling idioms, approved security patterns applied in practice | After a non-obvious implementation or a corrected contract |
| **AI Engineer** | Prompt and evaluation conventions, model-selection heuristics, known failure modes of providers used | After an evaluation or a provider behavior surprise |
| **Infrastructure / DevOps Engineer** | Deployment idioms, environment quirks, recurring operational footguns | After an incident or a deployment surprise |
| **Reviewer** | Recurring quality anti-patterns seen across PRs, review-process lessons after a missed defect | When a pattern is seen across ≥2 PRs; after a false approval |
| **QA Engineer** | Past defect patterns, brittle test areas, acceptance-criteria edge cases that recur | After a release where a defect class repeated |
| **Security Engineer** | Approved-pattern application notes, recurring vulnerability classes in this codebase | Per security review with a reusable finding |
| **Release Manager** | Release-window heuristics, rollback lessons, recurring readiness-checklist gaps | After a release or rollback |
| **Technical Writer** | Documentation conventions and style decisions specific to authoring (distinct from the Knowledge they curate) | After a documentation review |

Two ownership rules apply:

- **Record ownership.** Every Employee Memory record is owned by the role that created it. That role is accountable for the record's accuracy and for superseding it when it becomes wrong.
- **Layer quality ownership.** Each role is the quality owner of its own Employee Memory layer — responsible for keeping it free of contradiction, staleness, and low-value noise. The **department lead is the final authority** when a role's own records conflict, and the **CTO owns memory quality for the company as a whole** ([Organizational Memory System §6](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#6-ownership)).

No role writes to another role's Employee Memory. Cross-role lessons are escalated to Team or Company Memory, where the appropriate owner records them.

---

## 5. Write Rules

Employee Memory inherits the general write rules of the [Organizational Memory System §7](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#7-write-rules). The rules below are the Employee-layer specifics.

### 5.1 What to write

A role writes an Employee Memory record when it learns something that is:

1. **Role-specific** — it will inform this role's future work and is not the concern of every role.
2. **Durable** — it is expected to apply beyond the current task or session.
3. **Re-usable** — a future invocation of this role will act differently because the record exists.

Every record is **attributed** to the role that created it, **cites its source** (the task, review, incident, or decision that produced it), and is written in **plain language** any employee could read — not shorthand only its author understands.

### 5.2 What NOT to write

Employee Memory is valuable only as signal. A role does **not** write:

- **Anything the whole company should know.** Organization-wide standards are Company Memory; department-wide ones are Team Memory. Duplicating them into a role's layer fragments the standard and pollutes both layers.
- **Transient session state.** That is Conversation context and expires by design ([Section 3](#3-employee-memory-vs-company-memory-vs-conversation-context)).
- **Routine choices within approved patterns.** A standard implementation made the standard way teaches nothing.
- **Restatements of an existing record.** Update or supersede the existing record instead of creating a near-duplicate.
- **Curated documentation.** Reference-quality material belongs in the Knowledge tier, authored by the Technical Writer.

### 5.3 Promotion on write

When a role is about to write a record and realizes the lesson actually binds more than its own role, it does not file it as Employee Memory. It **promotes** the record to the correct layer — Team Memory if department-wide, Company Memory if organization-wide — where that layer's owner records it. Promotion is a write-time judgment, and getting it wrong is the most common cause of misfiled memory.

---

## 6. Read Rules

### 6.1 When a role reads its own memory

A role retrieves its Employee Memory **first**, before producing any output, because it is the narrowest and cheapest layer and primes the role for the work. Retrieval is not optional: a role that makes a choice contradicting its own active record without superseding it has failed its responsibilities ([Organizational Memory System §8.1](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#81-when-retrieval-is-required)).

### 6.2 Scoped, then broadened

A role reads **its own** Employee Memory plus the broader layers relevant to the task — it does not read other roles' Employee Memory. Reading is scoped to the current context, not exhaustive. After its own layer, the role consults Team, Repository/Feature, Company, and Knowledge as the task requires, respecting the global read precedence.

### 6.3 Precedence: Employee Memory is advisory, not authoritative

Within the global precedence order, Employee Memory sits at the bottom:

> Knowledge → Company Memory → Repository / Feature Memory → Team Memory → **Employee Memory**

A role's own preference is **constrained by everything above it**. If a Frontend Engineer's Employee Memory says "prefer optimistic UI updates" but Company Memory records a standard requiring confirmed writes for financial actions, the Company standard wins and the role follows it. Where the role believes its own record is now better than the higher record, it raises the conflict ([Section 10](#10-conflict-handling)); it does not silently follow its own preference over a binding standard.

### 6.4 Confidence on read

Each record carries a confidence indicator. Low-confidence Employee Memory records are surfaced but flagged. A role relying on a low-confidence record records the outcome of the decision it made, so the record's confidence can be revised as evidence accumulates.

---

## 7. Update and Supersession Rules

Employee Memory changes over time, and — like all persistent memory — **none of its update operations delete information** ([Organizational Memory System §9](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#9-update-and-supersession-rules)).

1. **Append** — add a new record. The default. Most role learning is additive.
2. **Supersede** — replace an out-of-date record with a corrected one. The new record links back to the old, and the old record's status becomes `superseded`. The chain is preserved so the role can see how its own understanding evolved.
3. **Deprecate** — mark a record no longer relevant without a direct replacement (e.g., a convention for a framework the role no longer uses). Status becomes `deprecated`; the record remains readable but is excluded from default retrieval.

Employee-layer specifics:

- **A role supersedes only its own records.** A role that believes another role's Employee Memory is wrong does not edit it — it raises it to that role or to the department lead.
- **The superseding record states what changed and why**, and cites the source that prompted the change (the new task, review, or incident).
- **A role never holds two active records that directly contradict each other.** When it discovers it does, it supersedes the losing one rather than leaving both live.

---

## 8. Validation

A record is admitted to Employee Memory only if it passes a small set of validation checks. Validation keeps the layer trustworthy; an unvalidated layer becomes noise that future invocations cannot rely on.

| Check | Requirement |
|---|---|
| **Attribution** | The creating role is known. A record with no owner is rejected. |
| **Source** | The record cites the task, review, incident, or decision that produced it, where one exists. |
| **Plain language** | The content is understandable by any employee, not only its author. Shorthand-only records are rewritten. |
| **Correct layer** | The record is genuinely role-scoped — not a Company/Team standard misfiled, not transient session context ([Section 5.2](#52-what-not-to-write)). |
| **Non-duplication** | No active record already states the same thing. Duplicates are merged into an update or supersession. |
| **Confidence set** | The record carries a confidence value so it can be weighted on read. |

A record that fails any check is not silently admitted. It is corrected and re-submitted, promoted to the correct layer, or discarded.

---

## 9. Retention Rules

Employee Memory is **persistent for the life of the company**. It follows the same retention invariants as the other durable layers ([Organizational Memory System §11](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#11-retention-rules)):

1. **Records are never deleted** — only `deprecated` or `superseded`. The history of what a role believed, and when, is itself useful: it shows how the role's craft matured.
2. **Superseded and deprecated records remain readable** — excluded from default retrieval, but available when a role needs to understand how a convention evolved.
3. **Employee Memory does not expire.** Unlike Conversation context, a role's accumulated memory persists across every invocation. This persistence is precisely what gives the role continuity.
4. **A retired role's memory is retained.** If a role is retired or restructured, its Employee Memory is preserved and reassigned to the successor role or escalated to Team/Company Memory; it is not discarded.

---

## 10. Conflict Handling

Conflicts in Employee Memory are resolved by **authority, not consensus** ([Organizational Memory System §10](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md#10-conflict-handling)). A conflict exists when two active records of equal scope make incompatible claims, or when a role's intended output contradicts one of its own active records.

Employee-layer resolution:

1. **Conflicts are surfaced, never silently resolved.** A role that holds two contradictory records does not pick one arbitrarily.
2. **Within-role conflicts** are resolved by the role's **department lead** as final authority — the lead determines which record stands; the losing record is superseded with reasoning, not deleted.
3. **A role record that contradicts a higher layer** (Team or Company) is **not a peer conflict** — the higher layer wins on precedence ([Section 6.3](#63-precedence-employee-memory-is-advisory-not-authoritative)). If the role believes the higher record is now wrong, it escalates to that layer's owner; it never overrides a binding standard with its own preference.
4. **The losing side is preserved.** When a conflict is resolved, the superseded record and the reasoning remain in the chain. The role may change its mind, but it does so on the record and by the right authority.

The principle, applied to the role layer: a single role never acts on two contradictory truths at once, and it never elevates its own preference above a standard that binds the company.

---

## 11. Implementation Status

Per the project's hard rule against describing capability that does not exist, this section separates what the platform implements **today** from what is **designed but not yet built**.

### 11.1 Implemented today

- **Role-scoped memory is representable.** A `Memory` bank carries `companyId`, `title`, `summary`, `category`, and `ownerType` / `ownerId`, so a bank can be owned at the `employee` level by setting `ownerType: "employee"` and `ownerId` to the employee. Records (`MemoryRecord`) carry `content`, an optional `source`, and a `confidence` value (0–1).
- **`employee` is a recognized category.** The Memory surface accepts eight categories — `company`, `architecture`, `product`, `security`, `operations`, `employee`, `feature`, and `decision` — which map onto the layers and types in this document.
- **Confidence and source are first-class** on every record and are displayed on read.
- **CEO-facing surface.** The **Memory** section of the app lists every bank with its record count and category, and a detail view shows each record's content, source, confidence, and date. Banks and records can be created manually.

### 11.2 Designed / planned (not yet built)

- **Seeded Employee banks.** A new company is currently seeded with five **company-scoped** banks (Company, Architecture, Product, Security, Operations) and no per-employee banks. Provisioning a default Employee Memory bank per role at company creation is designed, not yet built.
- **Automatic, workflow-driven role writes.** Today, records are created **manually** through the Memory UI. Having the runtime append Employee Memory as a byproduct of a role completing work (a Reviewer recording a recurring anti-pattern, a Frontend Engineer recording a resolved design gap) is specified behavior, not yet emitted automatically.
- **Mandatory retrieval before role output.** The read rules in [Section 6](#6-read-rules) describe how an invoked role should consult its own memory first. Real-AI employees that retrieve and respect memory are gated behind **Engineering OS Specification v1.0** and are not yet implemented.
- **Supersession status and chains.** The `active` / `superseded` / `deprecated` status model and the supersession link ([Section 7](#7-update-and-supersession-rules)) are specified in the [Domain Model](../architecture/DOMAIN_MODEL.md) but not yet enforced by the current schema, which appends and edits records without an explicit status field.
- **Scoped per-role retrieval store.** The full separation of Employee Memory as a distinct, role-scoped retrieval path is the designed target; today the implemented surface is primarily company-scoped banks plus the `employee` category.

No part of this section should be read as claiming automation that does not exist.

---

## 12. Examples

Concrete records, written the way they should appear. Each is role-scoped, attributed, sourced, and plain-language.

**Frontend Engineer**

> *Convention.* For shared UI primitives, favor composition (slots/children) over prop-driven configuration; configuration-heavy components became hard to extend. Source: cart-refactor task. Confidence: high.

> *Lesson learned.* Loading skeletons must match the final layout's dimensions, or the page shifts on load. A QA finding caught this twice. Source: checkout QA cycle. Confidence: high.

**Reviewer**

> *Recurring anti-pattern.* Optional chaining used to silence a real null case rather than handle it — seen across three PRs from different authors. Flag it as blocking, not a style note. Source: review log, sprint 7. Confidence: high.

**Tech Lead**

> *Estimation calibration.* Tasks touching the auth middleware consistently run ~1.5× the initial estimate because of the cross-cutting test surface. Pad accordingly. Source: sprint 5–8 retrospective. Confidence: medium.

**QA Engineer**

> *Defect pattern.* Date handling regresses around timezone boundaries after any change to the scheduling module; always include a DST-boundary case. Source: release 1.4 defect report. Confidence: high.

**Counter-example — does NOT belong in Employee Memory.**

> "All interfaces must meet the company accessibility standard."

This binds **every** engineering role, so it is **Company Memory**, not the Frontend Engineer's preference. Filing it under one role lets other roles ignore it. It is promoted upward ([Section 5.3](#53-promotion-on-write)).

---

## 13. Anti-Patterns

**Misfiling a company standard as a role preference.** Recording a rule that binds everyone as a single role's "preference." It fragments the standard and lets other roles ignore it. The test is *who must obey this?* — if it is more than one role, it is not Employee Memory.

**Leaking conversation context into permanence.** Writing raw, transient session reasoning into a role's persistent memory. Conversation context expires by design; only an explicitly rewritten, durable lesson survives ([Section 3](#3-employee-memory-vs-company-memory-vs-conversation-context)).

**Author-only shorthand.** Writing a record only its author can interpret. A record that the next invocation of the role cannot read has not been written for the company and is rewritten ([Section 8](#8-validation)).

**Preference over standard.** A role following its own Employee Memory in defiance of a higher-layer standard. Employee Memory is advisory and sits at the bottom of read precedence; it never overrides Company Memory ([Section 6.3](#63-precedence-employee-memory-is-advisory-not-authoritative)).

**Memory pollution.** Recording routine choices, restatements, and trivia until signal is buried in noise. A record is written only if a future invocation will act differently because it exists ([Section 5.2](#52-what-not-to-write)).

**Silent contradiction within a role.** Holding two active records that disagree and acting on whichever surfaces first. The role supersedes the losing record on the record, by the right authority ([Section 10](#10-conflict-handling)).

**Editing another role's memory.** Correcting a record outside one's own domain directly instead of escalating it to that role or the department lead. No role writes to another role's Employee Memory ([Section 4](#4-memory-ownership-by-role)).

---

## 14. Definition of Done

An Employee Memory record is **done** when:

1. It is **attributed** to the creating role and **cites its source**.
2. It is written in **plain language** any employee can read.
3. It is in the **correct layer** — genuinely role-scoped, not a misfiled Company/Team standard or transient session context.
4. It does **not duplicate** an existing active record; a near-duplicate is merged via update or supersession instead.
5. It carries a **confidence** value so it can be weighted on read.
6. If it replaces an older record, the older record is **superseded** (linked and marked), not deleted.

A role's Employee Memory **layer** is healthy when:

1. It contains **no two active records that contradict each other**.
2. It is **free of company- or team-scope records** that belong in a higher layer.
3. Stale or framework-obsolete records are **deprecated**, not left to mislead retrieval.
4. Every record present would **change a future invocation's behavior** — the layer is signal, not log.

---

## 15. Relationship to Other Documents

- **[Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md)** — the canonical specification of the whole memory system: the six layers, the record model, global write/read/retention/conflict rules. This document narrows that specification to the Employee layer and inherits its rules.
- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)** — defines the `Memory`, `Memory Record`, and `Employee` objects, their fields, and their invariants. This document specifies the *behavior* of the Employee-scoped portion of those objects.
- **[TECHNICAL_ARCHITECTURE.md](../architecture/TECHNICAL_ARCHITECTURE.md)** — defines the Memory and Employee module boundaries and how the Context Builder retrieves role-scoped memory for an invocation.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — defines when memory is retrieved and written through the workflow lifecycle, and the event-driven invocation model that makes role continuity necessary.
- **[EMPLOYEE_TEMPLATE.md](../company/EMPLOYEE_TEMPLATE.md)** and the **[employee handbooks](../employees/)** — each role's own Memory Ownership section is the per-role ground truth for what that role records; [Section 4](#4-memory-ownership-by-role) consolidates them.
- **[RESPONSIBILITY_MATRIX.md](../organization/RESPONSIBILITY_MATRIX.md)** — defines the role and ownership boundaries this document references for memory ownership and conflict authority.
