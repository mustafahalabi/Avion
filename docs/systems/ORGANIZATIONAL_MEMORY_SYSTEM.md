# Organizational Memory System

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

This document defines how Engineering OS stores meaningful company knowledge and makes it available to employees. It is the canonical specification for the Memory System — what memory is, what it is not, the layers it is organized into, who owns its quality, and the rules that govern when it is written, read, updated, and retired.

Memory is one of the company's most significant assets. It is the mechanism by which the organization becomes smarter over time: every project, review, incident, and decision leaves a durable record that future work references rather than re-deriving. A company without memory repeats its mistakes and re-litigates settled questions. A company with disciplined memory compounds.

This document describes organizational behavior, not storage technology. Where it names concrete fields or screens, those are the current implementation surface (see [Section 12](#12-implementation-status)); the rules themselves are storage-agnostic and survive any change of database, embedding engine, or retrieval method.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Memory vs. Knowledge](#3-memory-vs-knowledge)
4. [Memory Layers](#4-memory-layers)
5. [The Record Model](#5-the-record-model)
6. [Ownership](#6-ownership)
7. [Write Rules](#7-write-rules)
8. [Read Rules](#8-read-rules)
9. [Update and Supersession Rules](#9-update-and-supersession-rules)
10. [Conflict Handling](#10-conflict-handling)
11. [Retention Rules](#11-retention-rules)
12. [Implementation Status](#12-implementation-status)
13. [Failure Modes](#13-failure-modes)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

The Memory System exists to give the virtual company a persistent, shared, and trustworthy understanding of itself. It answers a single question for any employee about to do work: **what does this company already know that should inform what I am about to do?**

Memory serves four purposes:

1. **Prevent re-derivation.** When the company has already decided how authentication works in this codebase, no employee re-derives it. The decision is read, not reinvented.
2. **Preserve accountability.** Every significant decision leaves a record of what was decided, by whom, and why. A decision that is not recorded did not happen from the company's perspective.
3. **Enable compounding.** Each completed feature, resolved incident, and accepted review adds to what the company knows. The organization's competence is the accumulation of its memory.
4. **Maintain continuity across sessions.** Employees are invoked, not always-on (see [COMPANY_RUNTIME.md §36](../architecture/COMPANY_RUNTIME.md#36-event-driven-employee-invocation)). Memory is what makes an employee invoked today behave consistently with the same employee invoked last month.

Memory is **not** a document dump, a chat log, or an audit trail. The [Event log](../architecture/DOMAIN_MODEL.md) records what happened; the [Timeline](../architecture/COMPANY_RUNTIME.md#24-timeline-updates) records significant events for the CEO; **Memory records what the company has learned and should act on.** The distinction is intent: memory is written to be read again and to change future behavior.

---

## 2. Scope

This document governs all organizational memory: the layered record system employees write to and read from when reasoning about work.

**In scope:**

- The six memory layers (Employee, Team, Company, Repository, Feature, Conversation).
- The lifecycle of a memory record: creation, reference, update, supersession, deprecation, expiry.
- Who owns memory quality and who is permitted to write to each layer.
- The rules that govern reads (retrieval), writes, updates, conflicts, and retention.

**Out of scope:**

- **Knowledge** — the curated, authoritative tier maintained by the Technical Writer. Memory and Knowledge are distinct tiers ([Section 3](#3-memory-vs-knowledge)); Knowledge curation is governed by the [New Feature SOP §Knowledge Updates](../sops/NEW_FEATURE.md) and [COMPANY_RUNTIME.md §23](../architecture/COMPANY_RUNTIME.md#23-knowledge-updates).
- **The Timeline** — the immutable, CEO-facing record of significant events. The Timeline is a presentation surface, not a memory layer.
- **Storage technology** — which database, index, or embedding engine backs memory. Those are implementation choices and are intentionally absent from the normative rules.
- **Repository analysis internals** — how the codebase is parsed into Repository Memory is owned by [REPOSITORY_ANALYSIS_SNAPSHOTS.md](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md). This document covers only how that output is stored and consumed as memory.

---

## 3. Memory vs. Knowledge

Engineering OS maintains two tiers of organizational information. They are deliberately separated by **quality and intent**, not by topic.

| Dimension | Memory | Knowledge |
|---|---|---|
| Quality | Accumulated, may be rough | Curated, reference-quality |
| Creation | Continuous, as a byproduct of work | Deliberate, authored |
| Review | Not required before write | Required before publish |
| Owner | Each employee (their domain) | Technical Writer (curation), CTO (authority) |
| Examples | "We chose optimistic UI updates for the cart and accepted the rollback complexity." | The official, approved cart architecture document. |
| Mutability | Superseded by newer records | Versioned; prior versions deprecated |

The relationship is directional: **Memory feeds Knowledge.** When a pattern recorded informally in memory proves durable and important, the Technical Writer promotes it into a curated Knowledge record. Knowledge never silently overwrites memory, and memory is never treated as authoritative documentation. An employee retrieving information consults both: Knowledge for the company's official position, Memory for the experiential context behind it.

This document specifies Memory. Knowledge is referenced where the two interact but is governed elsewhere.

---

## 4. Memory Layers

Memory is organized into six layers by **scope** — the breadth of the company to which a record applies. Scope determines who writes the record, who reads it, and how long it lives.

| Layer | Scope | Owner | Lifetime | Examples |
|---|---|---|---|---|
| **Employee Memory** | One employee's role | The employee | Persistent | A Frontend Engineer's accessibility conventions; a Reviewer's known anti-patterns |
| **Team Memory** | One department | Department lead | Persistent | Engineering's branching conventions; QA's regression scope checklist |
| **Company Memory** | The whole organization | CTO (oversight) | Persistent | Coding standards, naming conventions, business rules, the deployment model |
| **Repository Memory** | One codebase | Tech Lead | Persistent, refreshed on analysis | Folder structure, frameworks, dependency versions, known technical-debt areas |
| **Feature Memory** | One shipped feature | Product Manager | Persistent | What a feature does, the problem it solves, decisions made, acceptance criteria as shipped |
| **Conversation Memory** | One working session | The active session | Expires at session close | Transient context the company is holding while resolving a single request |

### 4.1 Employee Memory

Role-specific experiential knowledge. Every employee accumulates the conventions, preferences, and lessons relevant to their specialty. The Backend Engineer remembers API conventions and approved security patterns; the Frontend Engineer remembers UI conventions and animation preferences. Employee Memory is what makes a role behave consistently across invocations. It is read first when that employee is invoked and is the narrowest layer an employee is responsible for maintaining.

### 4.2 Team Memory

Department-shared knowledge. When a lesson applies to everyone in a department rather than a single role, it belongs to Team Memory. Team Memory prevents two engineers in the same department from independently learning — or independently forgetting — the same thing.

### 4.3 Company Memory

Organization-wide knowledge that every employee may read and that constrains every decision. Coding standards, architectural direction, naming conventions, business rules, and the deployment model live here. Company Memory has the highest bar for writes (see [Section 7](#7-write-rules)) because it binds the entire organization. The CTO owns its quality.

### 4.4 Repository Memory

Codebase-specific knowledge: the structure, frameworks, conventions, dependencies, and technical-debt areas of a connected repository. Repository Memory is the company's onboarding knowledge for a codebase, applied to every request that touches it. It is **referenced, not regenerated** — the company reads what it already knows and only re-analyzes on explicit triggers: initial connection, a CEO request, or a Tech Lead determination that the memory is stale (see [COMPANY_RUNTIME.md §6](../architecture/COMPANY_RUNTIME.md#6-repository-understanding)). The Tech Lead owns it.

### 4.5 Feature Memory

Per-feature knowledge written when a feature ships. Each record captures what the feature does, the problem it solves, the acceptance criteria as actually shipped (noting deviations from the original brief), the release version, and the key decisions made during development. Feature Memory is the reason the company can answer "have we built something like this before?" The Product Manager owns it, and a feature is **not Done until its Feature Memory record is written** (see [Section 7.2](#72-mandatory-write-events)).

### 4.6 Conversation Memory

Session-scoped working memory. While the company resolves a single request, it holds transient context — the current goal, clarifications received, intermediate reasoning. Conversation Memory is the only layer that expires automatically. It is never promoted directly to a durable layer; durable facts discovered during a conversation are written as explicit records to the appropriate persistent layer before the session closes.

---

## 5. The Record Model

A memory **bank** is a named container scoped to a layer and category; it holds many **records**. A record is a single discrete fact, decision, standard, pattern, or lesson.

A record carries, at minimum:

- **Content** — the fact itself, written in plain language understandable by any employee, not only its author.
- **Category / scope** — which layer and subject area the record belongs to.
- **Source** — where the record came from (the task, review, incident, or decision that produced it).
- **Confidence** — how certain the company is of this record, expressed as a relevance/certainty indicator. Low-confidence records are still recorded; they are simply weighted accordingly on read.
- **Status** — `active`, `deprecated`, or `superseded`. Records are never deleted (see [Section 11](#11-retention-rules)).
- **Supersession link** — when a record replaces an older one, it points back to its predecessor, preserving the chain.

Records are written to be re-read. A record that only its author can interpret has failed its purpose.

### 5.1 Record Types

Within the layers, records fall into recognizable types. These types are how employees know which records are relevant to their work:

| Type | Typical Layer | Owner |
|---|---|---|
| `architecture` | Company / Repository | CTO / Tech Lead |
| `coding_standard` | Company / Team | Tech Lead |
| `business_rule` | Company | Product Manager |
| `decision` | Any | The deciding employee |
| `pattern` | Company / Team / Employee | Domain employee |
| `lesson_learned` | Any | Employee who learned it |
| `feature_summary` | Feature | Product Manager |
| `repository_structure` | Repository | Tech Lead |

### 5.2 Decision Memory

Decision records deserve specific attention because they are the most accountability-critical. A **Decision Memory** record captures a significant choice the company made: what was decided, who decided it, the reasoning, the alternatives considered and rejected, and any objection raised by a dissenting employee.

Decision records are produced by the company's decision framework (see [COMPANY_RUNTIME.md §15](../architecture/COMPANY_RUNTIME.md#15-decision-making)). Every decision that exceeds a routine implementation choice becomes a record. The losing side of a conflict documents its objection in the same record; objections are preserved, never erased (see [Section 10](#10-conflict-handling)). Decision Memory is what allows a future employee to understand not just what the company does, but why it chose to.

---

## 6. Ownership

Memory has two kinds of ownership, and they must not be confused.

**Record ownership** — every record is owned by the employee or workflow that created it. The owner is accountable for its accuracy and for superseding it when it becomes wrong.

**Layer quality ownership** — each layer has a single accountable owner for the overall health of that layer ([Section 4](#4-memory-layers) table). The layer owner is responsible for ensuring the layer is not contradictory, stale, or polluted with low-value records.

**The CTO owns memory quality for the company as a whole.** This is oversight, not authorship: the CTO does not write most records, but is accountable for the discipline of the system — that mandatory writes happen, that conflicts are resolved, that Company Memory remains coherent. The CTO is the final authority on what Company-scope memory is correct when two records disagree.

| Layer | Quality Owner | Final Authority on Conflict |
|---|---|---|
| Employee | The employee | Department lead |
| Team | Department lead | CTO |
| Company | CTO | CTO |
| Repository | Tech Lead | CTO |
| Feature | Product Manager | CTO |
| Conversation | The session | n/a (expires) |

No employee owns memory quality for a layer outside their domain. A Reviewer does not curate Repository Memory; the Tech Lead does.

---

## 7. Write Rules

Memory is written deliberately and traceably. The system never writes a record it cannot attribute and never writes silently when a write is mandatory.

### 7.1 General write rules

1. **Every record is attributed.** A record without a known creator (employee or workflow) is not written.
2. **Every record cites its source** where one exists — the task, review, incident, decision, or analysis that produced it.
3. **Records are written in plain language.** They must be understandable by any employee, not only the author.
4. **Writes never bypass ownership.** Only the layer owner or an employee acting within their domain writes to a layer (see [Section 6](#6-ownership)).
5. **A write that should happen is not optional.** Mandatory-write events (below) gate the completion of the work that triggers them.

### 7.2 Mandatory write events

A memory write is required — not encouraged — at these points. The associated work item is not complete until the write is confirmed:

| Event | Layer written | Owner | Gating rule |
|---|---|---|---|
| A feature ships | Feature Memory | Product Manager | Feature is not `Done` until the Feature Memory record exists ([COMPANY_RUNTIME.md §22](../architecture/COMPANY_RUNTIME.md#22-memory-updates)) |
| A significant architectural decision is made | Company / Repository (`decision`) | Tech Lead / CTO | Decision is not settled until recorded ([COMPANY_RUNTIME.md §15](../architecture/COMPANY_RUNTIME.md#15-decision-making)) |
| A production incident is resolved | Company (`lesson_learned`) | Tech Lead | Incident is not closed until the root cause and lesson are recorded |
| A repository is connected or re-analyzed | Repository Memory | Tech Lead | Repository cannot enter Active status without populated memory ([DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)) |
| A new security pattern is approved | Company / Security (`pattern`) | Security Engineer | Pattern is not approved until recorded |
| A knowledge gap is discovered during retrieval | Appropriate layer (`decision`/`lesson_learned`) | The employee who hit the gap | The employee records the decision they made so the gap is filled ([COMPANY_RUNTIME.md §13](../architecture/COMPANY_RUNTIME.md#13-knowledge-retrieval)) |

### 7.3 When NOT to write

Memory is valuable only if it is signal. The following are **not** written to memory:

- Routine implementation choices within approved architecture.
- Transient session state (that is Conversation Memory and expires).
- Restatements of records that already exist — update or supersede the existing record instead of duplicating it.
- Information that belongs in Knowledge (curated documentation) rather than Memory.
- Anything the company should already know — duplicating Company Memory into Employee Memory pollutes both.

---

## 8. Read Rules

Reading memory is called **retrieval**. Retrieval is mandatory before significant work and is scoped, not exhaustive.

### 8.1 When retrieval is required

Before an employee produces an output, they retrieve relevant memory. Retrieval is **not optional**: an employee who makes a decision that contradicts existing memory has failed their responsibilities, because the retrieval step is what makes the company smarter over time (see [COMPANY_RUNTIME.md §13](../architecture/COMPANY_RUNTIME.md#13-knowledge-retrieval)). Required retrieval points include:

- Before the Product Manager drafts a Feature Brief — to know what has been built and decided.
- Before the Tech Lead plans tasks — to know the repository architecture and existing patterns.
- Before an engineer implements — to know the coding standards, approved patterns, and API contracts.
- Before the Reviewer reviews — to know the company's quality standards and architectural intent.
- Before the QA Engineer tests — to know acceptance-criteria history and past defect patterns.
- Before the Release Manager releases — to know deployment and rollback history.

### 8.2 Scoped retrieval

Employees retrieve memory **relevant to the current context**, not all memory. Each role has a primary read scope (see [COMPANY_RUNTIME.md §14](../architecture/COMPANY_RUNTIME.md#14-memory-retrieval) for the full per-role table). For example, the Tech Lead reads Repository Memory and architecture decisions first; the QA Engineer reads test-coverage history and past defect patterns first.

### 8.3 Read precedence

When multiple layers carry relevant records, the employee reads them in precedence order:

1. **Knowledge** (curated, authoritative) — the company's official position, if one exists.
2. **Company Memory** — organization-wide standards and rules.
3. **Repository / Feature Memory** — context specific to the codebase or feature at hand.
4. **Team Memory** — department conventions.
5. **Employee Memory** — the employee's own role conventions.

Higher-precedence records constrain lower ones. An Employee Memory preference never overrides a Company Memory standard. Where records of equal precedence disagree, the conflict is escalated, not silently resolved ([Section 10](#10-conflict-handling)).

### 8.4 Confidence on read

Records carry a confidence indicator. On retrieval, low-confidence records are surfaced but flagged; an employee relying on a low-confidence record records the decision they made so the record's confidence can be revised as evidence accumulates.

---

## 9. Update and Supersession Rules

Memory changes over time. The system distinguishes three operations, and **none of them deletes information.**

1. **Append** — add a new record. The default operation. Most learning is additive.
2. **Supersede** — replace an out-of-date record with a corrected one. The new record links back to the old; the old record's status becomes `superseded`. The chain is preserved so the company can see how its understanding evolved.
3. **Deprecate** — mark a record no longer relevant without a direct replacement (e.g., a pattern for a framework the company no longer uses). Status becomes `deprecated`. The record remains readable but is excluded from default retrieval.

### 9.1 Supersession rules

- A record that is found to be wrong is **superseded, not contradicted.** The company never holds two active records that directly disagree (see [Section 10](#10-conflict-handling)).
- The superseding record states what changed and why, and cites the source that prompted the change.
- Supersession is performed by the record's owner or the layer owner. An employee outside the domain who believes a record is wrong raises it to the layer owner rather than superseding it directly.

### 9.2 Update boundaries during long-running work

Memory records are written at each **phase boundary** of long-running work, not only at final completion (see [COMPANY_RUNTIME.md §29](../architecture/COMPANY_RUNTIME.md#29-long-running-work)). This ensures that if work spans sessions, the durable record of what was learned is never lost to an interrupted session.

---

## 10. Conflict Handling

Conflicts in memory are expected and are resolved by **authority, not consensus.**

A conflict exists when two active records of equal precedence make incompatible claims, or when an employee's intended output contradicts an existing record.

**Resolution rules:**

1. **Conflicts are surfaced, never silently resolved.** An employee who retrieves two conflicting records does not pick one arbitrarily. They escalate (see below).
2. **Technical conflicts** (two architectural or repository records disagree) are escalated to the Tech Lead; if unresolved, to the CTO.
3. **Product conflicts** (two business-rule or feature records disagree) are escalated to the Product Manager; if unresolved, to the CTO.
4. **The CTO is the final authority** on Company-scope memory conflicts.
5. The resolution **supersedes** the losing record and records the reasoning. The losing record is not deleted; its objection or prior claim is preserved in the chain.
6. **A request that contradicts memory is surfaced before work begins.** If a CEO request conflicts with something the company has recorded as out of scope or infeasible, the company surfaces the conflict at intake rather than silently overriding memory (see [COMPANY_RUNTIME.md §4](../architecture/COMPANY_RUNTIME.md#4-request-intake)).

The principle: the company may change its mind, but it does so on the record and by the right authority. It never holds two contradictory truths at once.

---

## 11. Retention Rules

Memory is durable by default. Retention is governed by layer.

| Layer | Retention | Deletion permitted? |
|---|---|---|
| Employee, Team, Company, Repository, Feature | Persistent for the life of the company | No — only deprecate or supersede |
| Conversation | Expires automatically at session close | Yes — expiry is the mechanism |

**Core retention invariants:**

1. **Persistent records are never deleted.** They are deprecated or superseded. The history of what the company believed, and when, is itself organizational knowledge.
2. **Superseded and deprecated records remain readable.** They are excluded from default retrieval but available when an employee needs to understand how the company's understanding evolved.
3. **Conversation Memory is the only layer that expires.** Anything in a conversation that must persist is written to a durable layer before the session closes; otherwise it is lost by design.
4. **Cancelled or abandoned work still leaves memory.** When significant work is cancelled, a record explains what was built, what was decided, and why it was cancelled, so future work in that area benefits (see [COMPANY_RUNTIME.md §32](../architecture/COMPANY_RUNTIME.md#32-cancellation)).

---

## 12. Implementation Status

This section separates what the platform implements **today** from what is **designed but not yet built**, per the project's hard rule against describing capability that does not exist.

### 12.1 Implemented today

- **Memory banks and records persist.** A `Memory` bank carries `companyId`, `title`, `summary`, `category`, `ownerType`/`ownerId`, and `tags`. A `MemoryRecord` carries `content`, `source`, and a `confidence` value (0–1). Every company owns its memory banks; records belong to a bank.
- **Eight categories are recognized:** `company`, `architecture`, `product`, `security`, `operations`, `employee`, `feature`, and `decision`. These map onto the layers and types described above.
- **Seeded baseline.** A new company is seeded with five company-scoped memory banks — Company, Architecture, Product, Security, and Operations — each owned at the company level (`ownerType: "company"`).
- **CEO-facing surface.** The **Memory** section of the app lists every bank with its record count and category, and a detail view shows each record's content, source, confidence, and date. The CEO can create a bank and add records.
- **Confidence and source are first-class** on every record and are displayed on read.

### 12.2 Designed / planned (not yet built)

- **Automatic, workflow-driven writes.** Today, memory records are created **manually** through the Memory UI; the mandatory-write events in [Section 7.2](#72-mandatory-write-events) are specified behavior but are not yet emitted automatically by the runtime when a feature ships or a decision is made. Closing this gap — having the runtime write Feature, Decision, and Repository memory as a byproduct of work — is the central planned evolution of the system.
- **Mandatory retrieval before employee output.** The read rules in [Section 8](#8-read-rules) describe how invoked employees should consult memory. Real-AI employees that retrieve and respect memory are gated behind **Engineering OS Specification v1.0** and are not yet implemented.
- **Supersession chains and status.** The `active` / `superseded` / `deprecated` status model and the supersession link ([Section 9](#9-update-and-supersession-rules)) are specified in the [Domain Model](../architecture/DOMAIN_MODEL.md) but not yet enforced by the current schema, which appends and edits records without an explicit status field.
- **Employee, Team, and Conversation layers as distinct stores.** Today the implemented surface is primarily Company-scoped banks plus an `employee`/`feature`/`decision` category. The full six-layer separation with scoped retrieval is the designed target.
- **Knowledge tier.** The `Knowledge` / `KnowledgeRecord` models exist in the schema but have no dedicated UI or curation workflow yet; Knowledge remains a designed tier.

No part of this section should be read as claiming automation that does not exist. Where behavior is aspirational it is labeled designed/planned.

---

## 13. Failure Modes

The most damaging memory failures are silent. Each below names the failure, its consequence, and the system's response.

### Memory is read but not respected
An employee retrieves a relevant record and then makes a decision that contradicts it — re-deriving a settled question or violating a standard.
**Response:** Retrieval that respects memory is a responsibility, not a courtesy. An output that contradicts an active record without superseding it is rejected at review. The employee either follows the record or supersedes it on the record with reasoning.

### Mandatory write is skipped
A feature ships without a Feature Memory record, or a decision is made without a Decision record. The knowledge is lost and the next employee re-derives or re-litigates it.
**Response:** Mandatory-write events gate completion ([Section 7.2](#72-mandatory-write-events)). A feature is not `Done` until its memory is written. The gate is enforced by the workflow, not left to the author's discretion.

### Silent contradiction
Two active records make incompatible claims and both remain live, so different employees act on different "truths."
**Response:** The company never holds two contradictory active records. A discovered contradiction is escalated and resolved by superseding the losing record ([Section 10](#10-conflict-handling)). The unresolved-conflict state is itself a defect.

### Memory pollution
Low-value records — restatements, transient details, routine choices — accumulate until signal is buried in noise and retrieval returns junk.
**Response:** The write-NOT rules ([Section 7.3](#73-when-not-to-write)) keep noise out at the source. Layer owners ([Section 6](#6-ownership)) are accountable for pruning by deprecation. A record is written only if it will change future behavior.

### Stale Repository Memory
Repository Memory drifts from the actual codebase after significant change, and the company plans against a repository it no longer understands.
**Response:** Repository Memory is refreshed on explicit triggers, and the Tech Lead surfaces staleness to the CEO before planning proceeds against it ([COMPANY_RUNTIME.md §6](../architecture/COMPANY_RUNTIME.md#6-repository-understanding)). The company does not plan against memory it knows is stale.

### Author-only records
A record is written in shorthand only its author understands, so no other employee can use it.
**Response:** Plain-language is a write rule ([Section 7.1](#71-general-write-rules)). A record that only its author can interpret has not been written for the company and is rewritten or superseded.

### Conversation memory leaks into permanence
Transient session context is written to a durable layer, permanently polluting persistent memory with throwaway reasoning.
**Response:** Conversation Memory expires by design ([Section 11](#11-retention-rules)). Only explicitly promoted facts — rewritten as proper records to the right layer — survive a session.

---

## 14. Relationship to Other Documents

- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md)** — defines the Memory, Memory Record, Knowledge, and Knowledge Record objects, their fields, and their invariants. This document specifies the *behavior* those objects support.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — defines when memory is retrieved (§13–14), updated (§22), and written through the workflow lifecycle. This document is the standing specification those runtime sections execute against.
- **[NEW_FEATURE.md](../sops/NEW_FEATURE.md)** — the SOP whose final phase makes the Feature Memory write a completion gate.
- **[RELEASE.md](../sops/RELEASE.md)** — the SOP whose memory-update step records the release outcome.
- **[REPOSITORY_ANALYSIS_SNAPSHOTS.md](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md)** — owns how a codebase is analyzed into the content that becomes Repository Memory.
- **[COMPANY_OPERATING_SYSTEM.md](../company/COMPANY_OPERATING_SYSTEM.md)** and **[RESPONSIBILITY_MATRIX.md](../organization/RESPONSIBILITY_MATRIX.md)** — define the roles and ownership boundaries this document references for memory ownership.
