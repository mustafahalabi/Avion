# Memory Engine Architecture — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-29  

This document defines how memory behaves in Engineering OS. It translates the memory documentation (the Memory Architecture in the Project Knowledge Base) and the [Domain Model](./DOMAIN_MODEL.md) into product and system behavior: what the company remembers, who owns it, how it is created, updated, validated, retrieved, and how learning feeds it.

Memory is one of the company's most significant competitive assets. It is the mechanism by which the company gets smarter with every project rather than re-deriving the same conclusions. A company without memory is a collection of stateless sessions; a company with memory is an organization that compounds knowledge.

This document is implementation-neutral. It specifies behavior and the domain shape — it does **not** choose a storage engine, an embedding model, a vector index, or a serialization format. Per the project's hard rules, it also separates **Implemented today** (what the codebase genuinely does) from **Designed / planned** (the target behavior that gates future work). Where the two disagree, the "Implemented today" notes are authoritative about the current product.

---

## Table of Contents

1. [Purpose and Boundaries](#1-purpose-and-boundaries)
2. [Memory vs. Knowledge](#2-memory-vs-knowledge)
3. [Current Implementation State](#3-current-implementation-state)
4. [Memory Layers](#4-memory-layers)
5. [What Gets Remembered](#5-what-gets-remembered)
6. [What Expires](#6-what-expires)
7. [Memory Ownership](#7-memory-ownership)
8. [How Memory Is Created](#8-how-memory-is-created)
9. [How Memory Is Updated](#9-how-memory-is-updated)
10. [How Memory Is Validated](#10-how-memory-is-validated)
11. [How Memory Conflicts Are Handled](#11-how-memory-conflicts-are-handled)
12. [How Memory Is Retrieved](#12-how-memory-is-retrieved)
13. [How Learning Updates Memory](#13-how-learning-updates-memory)
14. [Memory Invariants](#14-memory-invariants)
15. [V1 Memory Scope](#15-v1-memory-scope)
16. [Deferred Memory Capabilities](#16-deferred-memory-capabilities)
17. [Relationship to Other Documents](#17-relationship-to-other-documents)

---

## 1. Purpose and Boundaries

The Memory Engine answers one question for every employee, before they act: **what does the company already know that is relevant to this work?**

The Memory Engine has three responsibilities:

1. **Accumulate** — capture facts, decisions, standards, patterns, and lessons as work completes, so they outlive the session that produced them.
2. **Serve** — return the memory relevant to a given employee and a given task, scoped to that employee's role and the work at hand, before the employee produces an output.
3. **Compound** — supersede stale records, resolve or escalate conflicts, and keep memory truthful over time, so that the company's recall improves rather than decays.

**The Memory Engine does not own:**

- **Orchestration** — deciding which employee acts next. That belongs to the [Company Runtime](./COMPANY_RUNTIME.md).
- **Curated reference documentation** — that is the Knowledge base (see [Memory vs. Knowledge](#2-memory-vs-knowledge)).
- **Repository structural analysis** — file trees, dependency graphs, and framework detection are produced by Repository Intelligence and persisted as analysis snapshots (see [Repository Analysis Snapshots](./REPOSITORY_ANALYSIS_SNAPSHOTS.md)). Memory references the *conclusions* of that analysis; it does not re-derive them.
- **Event history** — the immutable log of what happened. Memory records *what the company learned*; the Event log records *what occurred*.

Memory is a derived, interpretive layer. The Event log is a fact; a Memory Record is an interpretation the company chooses to keep.

---

## 2. Memory vs. Knowledge

Engineering OS maintains two distinct tiers of organizational information. They are easy to conflate and must not be.

| | **Memory** | **Knowledge** |
|---|---|---|
| Nature | Accumulated, experiential | Curated, authoritative |
| Quality | May be rough, confidence-weighted | Reference-quality, reviewed |
| Creation | Generated continuously by work | Deliberately authored |
| Owner | CTO (oversight), each employee (their domain) | Technical Writer (curation), CTO (authority) |
| Example | "The last auth refactor took 3 days because of the session-store migration." | The canonical authentication architecture diagram. |
| Approval | Not gated | Must be approved before publication |

Memory is the company's lived experience. Knowledge is the company's published doctrine. A Memory Record may *graduate* into a Knowledge Record when the Technical Writer determines it has become a standard worth curating — but that is a deliberate editorial act, not an automatic promotion.

The remainder of this document concerns **Memory**. Knowledge is governed by the [Domain Model](./DOMAIN_MODEL.md) (`Knowledge`, `Knowledge Record`, `Knowledge Source`) and the Technical Writer's handbook.

---

## 3. Current Implementation State

This section is the authoritative description of what the codebase does **today**. Everything in later sections marked *Designed / planned* extends, but does not yet replace, what is described here.

### 3.1 Data model (implemented)

Two persisted models back memory today, defined in `apps/web/prisma/schema.prisma`:

**`Memory`** — a named memory bank.

| Field | Notes |
|---|---|
| `id` | Identifier |
| `companyId` | Owning company (cascade delete) |
| `title` | Display name of the bank |
| `summary` | Optional description |
| `category` | One of a fixed set; defaults to `company` |
| `ownerType` | Free-text owner kind (seeded as `company`) |
| `ownerId` | Owner identifier (seeded as the company id) |
| `tags` | JSON-encoded string array, defaults to `[]` |
| `createdAt` / `updatedAt` | Timestamps |

**`MemoryRecord`** — a single piece of remembered content inside a bank.

| Field | Notes |
|---|---|
| `id` | Identifier |
| `memoryId` | Parent bank (cascade delete) |
| `content` | The remembered text |
| `source` | Optional free-text provenance |
| `confidence` | Float, defaults to `1.0` |
| `createdAt` / `updatedAt` | Timestamps |

The implemented `category` enum is fixed in the create action (`apps/web/src/app/actions/memory.ts`) to: `company`, `architecture`, `product`, `security`, `operations`, `employee`, `feature`, `decision`. These categories are the seed of the layered model described in [Memory Layers](#4-memory-layers).

### 3.2 Seeding (implemented)

When a company is provisioned, `apps/web/src/lib/company-seed.ts` creates five default memory banks — **Company**, **Architecture**, **Product**, **Security**, and **Operations** — each with `ownerType: "company"` and `ownerId` set to the company. A new company therefore starts with an empty-but-structured memory, not a blank slate.

### 3.3 User surface (implemented)

The `/memory` route renders the banks (with record and category counts), `/memory/[id]` renders a bank and its records (showing `source` and a `confidence` percentage), `/memory/new` creates a bank, and the add-record form appends a record. The two server actions in `apps/web/src/app/actions/memory.ts` (`createMemory`, `addMemoryRecord`) are the only write paths.

### 3.4 Honest limitations (today)

- **Memory is created manually.** A code trace confirms there is no automated memory write anywhere outside the seed and the CEO-driven server action. No workflow, worker, or driver writes a Memory Record on completion yet. The "memory updated as work completes" behavior in [How Memory Is Created](#8-how-memory-is-created) is *designed*, not wired.
- **No expiry, no superseding, no version chains.** Records are immutable rows with timestamps; there is no status field, no `superseded_by`, and no conversation-scoped expiry.
- **No retrieval into execution.** No employee invocation reads Memory Records to assemble context today. Retrieval (Section 12) is designed.
- **No embeddings / semantic search.** Lookup is by company, bank, and category only.
- **`confidence` and `source` are display-only.** They are stored and rendered but do not yet gate any decision.
- **`Knowledge` is minimally wired.** The `Knowledge` / `KnowledgeRecord` models exist but are not yet connected to a company or a curation flow.

This is deliberate. Per the platform's non-goals, no AI-driven memory behavior is added before the company, repository, and decision models are specified. The data shape exists; the automation is gated.

---

## 4. Memory Layers

Memory is organized into layers by **scope** — the breadth of the company for which a record is relevant. The layer determines who reads a record by default and how widely it propagates.

| Layer | Scope | Example | Implemented today |
|---|---|---|---|
| **Employee Memory** | One role | Frontend's animation and accessibility conventions | Designed — `employee` category exists; per-employee banks are not auto-created |
| **Team Memory** | One department | Quality's recurring defect patterns | Designed |
| **Company Memory** | The whole organization | Coding standards, naming, business rules | **Yes** — seeded `Company` bank |
| **Repository Memory** | One codebase | Folder structure, framework, debt areas | Partial — `architecture` bank seeded; structural facts live in analysis snapshots |
| **Feature Memory** | One feature | Purpose, requester, decisions, limitations, future work | Designed — `feature` category exists; not auto-written |
| **Decision Memory** | One decision | What was decided, alternatives rejected, trade-offs | Designed — `decision` category exists; no `Decision Record` model yet |
| **Conversation Memory** | One session | Transient working context | Designed — expires automatically (see [What Expires](#6-what-expires)) |

The five seeded banks (Company, Architecture, Product, Security, Operations) are the concrete starting point. The layered model above is the target: as automation lands, Repository, Feature, Employee, and Decision memory become first-class scopes rather than categories on a flat bank list.

**Layering rule:** a record lives at the narrowest layer that fully contains its relevance. A fact true only for the checkout feature is Feature Memory, not Company Memory. Over-broadening a record pollutes retrieval for unrelated work.

---

## 5. What Gets Remembered

Not everything is worth remembering. Memory captures durable, reusable conclusions — not transcripts, not raw output, not implementation noise.

**A record is created when the company learns something that will change a future decision.** Concretely, the company remembers:

| Record type | What it captures | Layer it usually lands in |
|---|---|---|
| `architecture` | A system-design choice and why | Repository / Company |
| `coding_standard` | An approved convention | Company / Team |
| `business_rule` | A domain rule that constrains implementation | Company |
| `decision` | A significant choice, its alternatives, and trade-offs | Decision |
| `pattern` | A reusable approach proven in this codebase | Repository / Team |
| `lesson_learned` | A mistake or success worth not repeating | Team / Company |
| `feature_summary` | What a shipped feature does and why | Feature |
| `repository_structure` | How the codebase is organized | Repository |

These types mirror the `MemoryRecord.type` taxonomy in the [Domain Model](./DOMAIN_MODEL.md). They are *designed* — today's `MemoryRecord` carries free-text `content` with an optional `source`, and the type is implied by the bank's `category`. Formalizing per-record types is part of closing the gap.

**What is explicitly NOT remembered:**

- Raw model output or chat transcripts (those are Conversation Memory and expire).
- Commit hashes, branch names, PR numbers, and other implementation identifiers (those belong to the Event log and the execution audit trail, not to memory).
- Secrets, credentials, or tokens of any kind — memory never stores a credential.
- Restated facts already present in a higher-quality record — the company supersedes rather than duplicates.

---

## 6. What Expires

Most memory is permanent by design. The compounding value of memory depends on its persistence — a company that forgets cannot get smarter. The general rule is therefore: **memory is never deleted; it is deprecated or superseded.**

There is exactly one expiring layer:

- **Conversation Memory** is session-scoped working memory. It exists to give an employee continuity *within* a single unit of work and is **automatically expired when the session closes**. Nothing the company needs long-term is allowed to live only in Conversation Memory — if a conversation produces a durable conclusion, that conclusion is promoted to a persistent layer before the session ends.

Everything else follows a lifecycle of `active → deprecated → superseded`, never deletion:

| State | Meaning |
|---|---|
| `active` | Current and usable in retrieval |
| `deprecated` | No longer recommended; retained for history; demoted in retrieval |
| `superseded` | Replaced by a newer record, which it links to |

**Implemented today:** records have no status field and no expiry. They are persistent rows. Conversation Memory, deprecation, and superseding are *designed*. Implementing the status lifecycle and the conversation-expiry sweep is a prerequisite for trustworthy long-lived memory and is tracked as part of the runtime intelligence work.

---

## 7. Memory Ownership

Ownership answers two questions: who is accountable for a record's truth, and who may change it.

| Layer | Accountable owner |
|---|---|
| Company Memory | CTO (oversight) |
| Repository Memory | Tech Lead (operational), CTO (architectural) |
| Feature Memory | Product Manager |
| Decision Memory | The employee who holds authority for the decision's domain |
| Employee / Team Memory | The employee or department lead |
| Conversation Memory | The active session (transient) |

**Principles:**

- **Every record has exactly one accountable owner.** Shared ownership means no ownership. This mirrors the company's permanent rule: one owner, clear accountability.
- **The author is not necessarily the owner.** A workflow may *generate* a record; the role accountable for that domain *owns* it.
- **The CEO does not own memory.** The CEO directs the company; the company remembers. The CEO never curates records by hand in normal operation.
- **Cross-company isolation is absolute.** Every `Memory` is scoped to a `companyId`; no record is ever visible across companies. This is enforced today by the company scoping on every query.

**Implemented today:** all seeded banks are owned by the company (`ownerType: "company"`, `ownerId` = company id). Per-role and per-feature ownership is *designed* and arrives with the layered model.

---

## 8. How Memory Is Created

Memory is created through two paths. Today only the first is wired.

### 8.1 Manual creation (implemented)

The CEO (or any authenticated operator of the company) can create a memory bank and append records through the UI. The server actions validate input (title ≤ 200 chars, content ≤ 10,000 chars, category from the fixed enum, confidence in `[0, 1]`), confirm the bank belongs to the caller's company, and write the row. This is the path that exists today and it is the fallback for anything the company does not yet capture automatically.

### 8.2 Workflow-driven creation (designed)

In the target model, memory is a **byproduct of completed work**, not a separate chore. The company writes records at phase boundaries, driven by the [Company Runtime](./COMPANY_RUNTIME.md) (see its Memory Updates cycle, phase 8 of the New Feature SOP):

```
Work item reaches a phase boundary
  ↓
Runtime emits a domain event (e.g., feature shipped, decision made, incident resolved)
  ↓
The accountable employee produces a Memory Record as part of their structured result
  ↓
Runtime persists the record into the correct layer and bank
  ↓
Record becomes available to future retrieval
```

Designed creation triggers:

| Trigger | Record produced | Owner |
|---|---|---|
| Feature ships | `feature_summary` (purpose, decisions, deviations, version) | Product Manager |
| Architectural choice made | `architecture` / `decision` | Tech Lead / CTO |
| Incident resolved | `lesson_learned` + root-cause | Tech Lead |
| Review or QA surfaces a recurring issue | `pattern` / `lesson_learned` | Reviewer / QA Engineer |
| Repository (re)analyzed | `repository_structure` | Tech Lead |

**Creation rules (both paths):**

- A record states one durable conclusion in plain language any employee can read.
- A record records its provenance (`source`) — the work item, incident, or analysis that produced it.
- A successful unit of work is not considered complete until its memory obligation is satisfied. *(Designed: the runtime gates "done" on the memory write; today this gate is not enforced because the write is manual.)*

---

## 9. How Memory Is Updated

Memory is not edited in place when facts change — it is **versioned**. This preserves the company's history of what it believed and when.

**Update behavior (designed):**

- When a new conclusion contradicts or refines an existing record, the company writes a **new** record and marks the prior record `superseded`, with a link from the old record to its successor. The old belief is never silently rewritten.
- When a record is no longer recommended but has no direct successor, it is marked `deprecated`.
- A record's `confidence` may be adjusted as corroborating or contradicting evidence accumulates (see [How Memory Is Validated](#10-how-memory-is-validated)).

This mirrors the Memory Record lifecycle in the [Domain Model](./DOMAIN_MODEL.md): *"A Memory Record cannot be deleted — only deprecated or superseded. A superseded record retains a link to its successor."*

**Implemented today:** `MemoryRecord` rows are appended and carry `updatedAt`, but there is no status field, no `superseded_by` link, and no supersede flow. Updates today mean adding a new record; the version chain is *designed*.

---

## 10. How Memory Is Validated

Memory must be trustworthy, or employees will ignore it. Validation is the mechanism that keeps recall honest.

### 10.1 Confidence (implemented field, designed behavior)

Every `MemoryRecord` carries a `confidence` score in `[0, 1]`, defaulting to `1.0`. Today this value is **stored and displayed** (rendered as a percentage on the bank detail page) but does not influence any decision.

In the designed model, confidence is a first-class signal:

- Records written from a verified outcome (a shipped feature, a resolved incident) start at high confidence.
- Records written from inference or a single observation start lower.
- Confidence rises as later work corroborates a record and falls when later work contradicts it.
- Low-confidence records are surfaced to retrieval as *provisional* and are preferred candidates for review or supersession.

### 10.2 Provenance (implemented field)

Every record may carry a `source`. A record without provenance is weaker than a record that names the work item it came from. Designed automation always populates `source` with the originating work item, incident, or analysis.

### 10.3 Validation rules

- **No record is load-bearing without an owner.** An unowned record cannot gate a decision.
- **Contradiction triggers review, not silent overwrite.** When new evidence contradicts a record, the company opens a conflict (Section 11) rather than mutating the record.
- **Memory never invents.** A record is a conclusion the company actually reached; fabricated recall is an integrity violation, the same class of error as fake repository intelligence.

---

## 11. How Memory Conflicts Are Handled

Two records can point in different directions — two architectural decisions, two "approved" patterns, two business rules. This is expected as the company grows. Conflicts are resolved by **authority and recency**, never silently.

**Conflict resolution path (designed):**

```
Employee retrieves two records that conflict
  ↓
Employee does NOT arbitrarily pick one
  ↓
Conflict is surfaced to the accountable authority:
  - technical conflict  → Tech Lead (then CTO)
  - product conflict     → Product Manager
  - security conflict    → Security Engineer (blocking authority)
  ↓
Authority resolves: one record is superseded, the other remains active
  ↓
The losing record links forward to the winner; the rationale is recorded
```

This is the memory-layer expression of the conflict-resolution rules in the [Company Runtime](./COMPANY_RUNTIME.md): conflicts are resolved by authority, not consensus, and the resolution is preserved, not erased.

**Tie-breaking inputs, in order:** explicit authority decision → recency (a newer, higher-confidence record supersedes an older one) → confidence. Recency alone never overrides an explicit authority decision.

**Implemented today:** there is no conflict detection or resolution flow. With manual, append-only records and no superseding, conflicts are not yet detectable by the system. This is *designed* and depends on the record lifecycle (Section 9) landing first.

---

## 12. How Memory Is Retrieved

Retrieval is where memory earns its value. An employee retrieves memory **before** producing any output, so that they build on what the company knows instead of re-deriving it.

**Retrieval is scoped, not exhaustive.** An employee does not load all memory — they load the memory relevant to their role and the task at hand. Scoping mirrors the per-role retrieval map in the [Company Runtime](./COMPANY_RUNTIME.md):

| Employee | Primary memory scope |
|---|---|
| Product Manager | Feature Memory, business rules, past product decisions |
| Tech Lead | Repository Memory, architecture decisions, past estimates |
| Frontend Engineer | UI conventions, accessibility, animation preferences |
| Backend Engineer | API conventions, security patterns, database decisions |
| Reviewer | Code-quality standards, anti-patterns, past review findings |
| QA Engineer | Test coverage history, past defect patterns, edge cases |
| Security Engineer | Security posture, past vulnerabilities, approved patterns |
| Release Manager | Deployment history, rollback history |

**Retrieval contract (designed):**

1. The Runtime's Context Builder assembles a context package for the invoked employee (see [Company Runtime](./COMPANY_RUNTIME.md), Event-Driven Employee Invocation).
2. Memory is queried by `companyId`, then narrowed by layer/scope, then by relevance to the current work item.
3. Only `active` records are returned by default; `deprecated` records appear demoted; `superseded` records are excluded.
4. Confidence accompanies each returned record so the employee can weigh provisional knowledge appropriately.
5. **Retrieval is mandatory.** An employee who makes a decision that contradicts existing memory has failed their responsibilities. Skipping retrieval breaks the compounding effect.

**Knowledge gaps:** if retrieval finds no record for a relevant topic, the employee records the gap, proceeds with best judgment, and writes a new record so the gap is filled next time.

**Implemented today:** retrieval into employee execution is **not wired** — no invocation reads Memory Records to build context. Lookups that exist today are the UI list/detail queries scoped by company and bank. Semantic (embedding-based) retrieval is deferred (Section 16).

---

## 13. How Learning Updates Memory

The Learning Engine is the feedback loop that turns operational experience into durable memory. Every significant signal the company produces is a potential learning input.

**Learning inputs → memory outputs (designed):**

| Input signal | Memory effect |
|---|---|
| Code review findings | Reinforce or create `pattern` / anti-pattern records; raise/lower confidence |
| QA defects | Create `lesson_learned`; update defect-pattern memory for the relevant area |
| Production incidents | Create root-cause `lesson_learned`; supersede the belief that led to the incident |
| Retrospectives | Promote recurring observations into Company or Team Memory |
| Deployments | Update Repository / Operations memory with what shipped and how |
| CEO feedback / direction | Update business-rule and product memory |

**Learning principles:**

- **Learning is continuous, not episodic.** Memory updates at every phase boundary, not only at final completion of large work.
- **Learning supersedes; it does not erase.** When experience contradicts a prior belief, the prior record is superseded and linked forward. The company's history of belief is preserved.
- **Learning is owned.** Each learning-driven record lands with the accountable owner for its layer.
- **The company does not hide failures.** A resolved failure produces a memory record; a hidden failure is an integrity problem. Every incident leaves a lesson.

**Implemented today:** no learning-driven automatic memory writes exist. The loop is *designed* and is the natural consumer of the runtime's existing review, QA, release, and incident signals once memory creation (Section 8.2) is wired.

---

## 14. Memory Invariants

These hold across every layer and must not be violated as the system evolves. Some are enforced today; the rest are the contract that incoming implementation must honor.

- A `Memory` and every `MemoryRecord` always belong to exactly one company; cross-company access never occurs. *(Enforced today.)*
- `confidence` is always within `[0, 1]`. *(Enforced today.)*
- `category` is always one of the defined values. *(Enforced today.)*
- A Memory Record is never deleted — only deprecated or superseded. *(Designed.)*
- A superseded record always retains a link to its successor. *(Designed.)*
- Conversation-scope memory is always expired at session close; nothing the company needs long-term lives only there. *(Designed.)*
- Every load-bearing record has exactly one accountable owner. *(Designed.)*
- Memory never stores secrets, credentials, or raw implementation identifiers. *(Policy — must hold the moment automated writes land.)*
- Memory records a conclusion the company actually reached; fabricated recall is forbidden. *(Policy.)*

---

## 15. V1 Memory Scope

The committed scope for the current platform version is intentionally narrow and honest:

**In scope (and shipped):**

- The `Memory` / `MemoryRecord` domain model with company scoping, categories, tags, `source`, and `confidence`.
- Five seeded company-scoped memory banks at company creation (Company, Architecture, Product, Security, Operations).
- A manual create-and-append surface (`/memory`, `/memory/[id]`, `/memory/new`) backed by validated server actions.
- Confidence and source captured and displayed.

**In scope (specified here, to be implemented next):**

- The record lifecycle (`active` / `deprecated` / `superseded`) and supersede links.
- Workflow-driven creation at phase boundaries (Section 8.2), starting with Feature Memory on ship and Decision Memory on a recorded decision.
- Scoped retrieval into the Context Builder for invoked employees (Section 12).
- Conversation Memory with automatic expiry (Section 6).

The order is deliberate: the lifecycle and creation paths come before retrieval, and retrieval comes before any semantic capability. Real AI-driven memory behavior remains gated behind the canonical Engineering OS Specification, consistent with the platform's non-goals.

---

## 16. Deferred Memory Capabilities

These are explicitly **out of V1 scope**. They are recorded so the architecture leaves room for them, not so they are built now.

- **Semantic retrieval / embeddings.** An `Embedding Record` over Memory and Knowledge Records, and vector similarity search, are deferred. Today and in near-term V1, retrieval is structured (company → layer → relevance), not semantic. (See the `Embedding Record` and `Knowledge Graph Snapshot` objects in the [Domain Model](./DOMAIN_MODEL.md), marked optional.)
- **Knowledge Graph.** A cross-record graph linking decisions, features, repositories, and incidents into a navigable structure.
- **Automatic Memory → Knowledge graduation.** Promotion of a high-confidence Memory Record into a curated Knowledge Record remains a manual Technical Writer act.
- **Per-employee and per-team learning profiles.** Memory that individualizes an employee's behavior over time (the full Learning Engine) is deferred beyond the basic learning loop in Section 13.
- **Memory analytics.** Coverage metrics ("knowledge coverage" as a company-health dimension), staleness detection, and confidence decay scheduling.
- **Multi-stakeholder memory permissions.** Per the V1 single-CEO model, memory has no per-user access control beyond company scoping.

Each deferred capability has a clean extension point in the model above; none requires reshaping the `Memory` / `MemoryRecord` core.

---

## 17. Relationship to Other Documents

- **[DOMAIN_MODEL.md](./DOMAIN_MODEL.md)** defines the `Memory`, `Memory Record`, `Knowledge`, `Knowledge Record`, `Knowledge Source`, `Decision`, `Decision Record`, `Embedding Record`, and `Knowledge Graph Snapshot` objects this engine manages, and their lifecycle rules. It is the source of truth for object shape; this document is the source of truth for memory *behavior*.
- **[COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md)** defines Knowledge Retrieval, Memory Retrieval, Memory Updates, and Knowledge Updates as runtime phases, and the Event-Driven Employee Invocation sequence that this engine plugs into. The runtime owns *when* memory is read and written; this engine owns *what* is read and written and *how it stays truthful*.
- **[REPOSITORY_ANALYSIS_SNAPSHOTS.md](./REPOSITORY_ANALYSIS_SNAPSHOTS.md)** and **[REPOSITORY_IMPACT_ANALYSIS.md](./REPOSITORY_IMPACT_ANALYSIS.md)** define the structural repository facts that Repository Memory references but does not regenerate.
- **[INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md)** defines how the CEO views memory through the `/memory` section.
- **[TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)** defines the modules that will implement the retrieval, creation, and lifecycle behaviors specified here.
