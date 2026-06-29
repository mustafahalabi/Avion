# Company Memory

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

Company Memory is the shared, organization-wide layer of the Engineering OS memory system. It holds the knowledge that belongs to the company as a whole rather than to any single employee, repository, or feature: standards, architecture knowledge, business rules, documentation practices, technical-debt records, naming conventions, and lessons learned. Every employee reads from it; designated employees write to it after significant events.

This document defines what belongs in Company Memory, who owns it, how it is written and read, how it stays accurate, and how it relates to the other memory layers. It is the operational contract for the `company`-category memory bank and the company-wide records inside it.

This document is implementation-aware. Where behavior is already built into the platform, it is marked **Implemented today**. Where behavior is specified by the [Domain Model](../architecture/DOMAIN_MODEL.md) and [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) but not yet built, it is marked **Designed / planned**. Section 12 consolidates the split so no reader mistakes intent for capability.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope — What Belongs in Company Memory](#2-scope--what-belongs-in-company-memory)
3. [Relationship to the Other Memory Layers](#3-relationship-to-the-other-memory-layers)
4. [Ownership](#4-ownership)
5. [Data Model](#5-data-model)
6. [Write Rules](#6-write-rules)
7. [Read Rules](#7-read-rules)
8. [Update Rules](#8-update-rules)
9. [Validation](#9-validation)
10. [Retention](#10-retention)
11. [Conflict Resolution](#11-conflict-resolution)
12. [Implemented Today vs. Designed / Planned](#12-implemented-today-vs-designed--planned)
13. [Examples](#13-examples)
14. [Anti-Patterns](#14-anti-patterns)
15. [Definition of Done](#15-definition-of-done)
16. [Cross-References](#16-cross-references)

---

## 1. Purpose

Company Memory exists so that the organization does not re-derive the same conclusion twice. When an employee makes a decision, discovers a constraint, or establishes a standard that applies beyond their immediate task, that knowledge becomes a company asset — available to every other employee, on every future task, without anyone having to remember to repeat it.

Concretely, Company Memory:

- **Encodes how this company works** — the conventions, standards, and rules that make output consistent regardless of which employee produced it.
- **Preserves rationale** — not just *what* was decided, but *why*, so future work does not silently reverse a deliberate trade-off.
- **Reduces coordination cost** — an employee consults memory instead of asking another employee or the CEO to re-explain settled context.
- **Compounds over time** — the more the company works, the more it knows. Memory is one of the company's most significant durable assets (see the [Domain Model — Memory](../architecture/DOMAIN_MODEL.md#memory)).

Company Memory is **not** a document store, a wiki, or a dumping ground for raw output. It is a curated set of discrete, reusable facts that employees actively consult when making decisions.

---

## 2. Scope — What Belongs in Company Memory

A record belongs in Company Memory when it is **true across the company**, **stable enough to be reused**, and **not owned by a narrower layer**.

### Belongs in Company Memory

| Category | Examples |
|---|---|
| Company standards | Coding standards, review expectations, commit/PR conventions, error-handling norms |
| Architecture knowledge | System-wide design principles, module-boundary rules, cross-cutting patterns |
| Business rules | Domain invariants that hold regardless of repository (e.g., "a Release never proceeds without a QA go recommendation") |
| Documentation practices | Where docs live, the house front-matter block, the doc lifecycle (`draft → in_review → published`) |
| Naming conventions | Casing rules, file/route naming, terminology the company has standardized on |
| Technical debt | Known shortcuts, their rationale, and the conditions under which they should be repaid |
| Lessons learned | Post-incident takeaways, retrospective conclusions, "do not do this again" rules with reasoning |

### Does NOT belong in Company Memory

- **Role-specific preferences** → Employee Memory (e.g., the Frontend Engineer's animation conventions).
- **Codebase-specific structure** → Repository Memory (e.g., "auth lives in `src/lib/clerk`").
- **Single-feature context** → Feature Memory (e.g., the acceptance criteria for one feature).
- **The act and rationale of one significant choice** → Decision Memory (a Decision Record). Company Memory may *reference* a decision once it has hardened into a standard, but the decision itself is owned by the decision layer.
- **Transient working context** → Conversation Memory (session-scoped; expires).
- **Raw artifacts** → the Artifact / Document stores. Memory holds the distilled fact, not the file.

> Rule of thumb: if a fact is only true inside one repository, one feature, or one employee's head, it does not belong in Company Memory. If it is true for the whole company and you would want a brand-new employee to know it on day one, it does.

---

## 3. Relationship to the Other Memory Layers

Engineering OS organizes memory into cumulative layers. Company Memory is the **organization-wide** layer that sits between role/team knowledge and the broad knowledge system. The layers are defined in the [Domain Model — Memory](../architecture/DOMAIN_MODEL.md#memory); their interaction with Company Memory is summarized here.

| Layer | Owns | Relationship to Company Memory |
|---|---|---|
| **Employee Memory** | Role-specific knowledge held by one employee | A pattern that proves valuable across roles is **promoted** into Company Memory. Company Memory is the destination, not the source. |
| **Team / Department Memory** | Knowledge shared within one department | Department knowledge that becomes a company-wide expectation is promoted into Company Memory. |
| **Repository Memory** | Structure, architecture, and history of one codebase | Company Memory holds rules that apply to *all* repositories; Repository Memory specializes them per codebase. Company Memory never duplicates per-repo structure. |
| **Feature Memory** | Purpose, decisions, and limitations of one feature | A recurring feature-level lesson generalizes upward into a Company Memory lesson-learned record. |
| **Decision Memory** | Individual Decision Records (what/why/alternatives) | Company Memory references hardened decisions and encodes the **standing rule** they produced. The Decision Record remains the authoritative record of the choice. |
| **Conversation Memory** | Session-scoped working context | Never promoted automatically. A conversation may *surface* a fact worth keeping, but a person or workflow must deliberately write it into Company Memory. |

**Direction of flow:** narrow layers feed Company Memory through deliberate **promotion**, and Company Memory feeds every employee as **decision context**. Knowledge does not leak downward — Company Memory does not silently overwrite a repository- or feature-specific fact.

**Memory vs. Knowledge:** Company Memory is the *accumulated, working* tier. The [Knowledge Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#411-knowledge-boundary) is the *curated, authoritative* tier maintained by the Technical Writer. A Company Memory record that has proven durable and reference-worthy may be promoted into a published Knowledge Record; Knowledge is reviewed and approved, Memory is not.

---

## 4. Ownership

| Concern | Owner |
|---|---|
| Company Memory as a whole (integrity, conflicts, structure) | **CTO** |
| Curation and promotion to Knowledge | **Technical Writer** |
| Individual record content | The employee (or workflow) that wrote the record |
| CEO oversight | The CEO may browse and annotate, but does not curate |

The CTO owns the **accuracy** of Company Memory: resolving contradictions, retiring stale rules, and ensuring records are written at the right scope. Individual records are owned by their authors, but no employee may unilaterally change a company-wide standard recorded in memory without going through the appropriate decision path (see [Update Rules](#8-update-rules)).

Ownership of the surrounding layers is defined in the Domain Model: the [Memory](../architecture/DOMAIN_MODEL.md#memory) object is owned by the CTO with each employee owning their domain records.

---

## 5. Data Model

**Implemented today.** Company Memory is stored as a `Memory` bank whose `category` is `company`, containing many `MemoryRecord` rows. The shape that ships today (`prisma/schema.prisma`) is:

**`Memory` (the bank)**

| Field | Type | Notes |
|---|---|---|
| `id` | string (cuid) | Primary key |
| `companyId` | string | Scopes the bank to one company |
| `title` | string | Display name (e.g., "Company Memory") |
| `summary` | string? | One-line description |
| `category` | string, default `company` | One of: `company`, `architecture`, `product`, `security`, `operations`, `employee`, `feature`, `decision` |
| `ownerType` / `ownerId` | string? | Set to `company` / the company id for seeded banks |
| `tags` | string, default `"[]"` | JSON-encoded tag array |
| `createdAt` / `updatedAt` | datetime | Timestamps |

**`MemoryRecord` (the fact)**

| Field | Type | Notes |
|---|---|---|
| `id` | string (cuid) | Primary key |
| `memoryId` | string | Parent bank |
| `content` | string | The fact itself (1–10,000 chars, enforced in the action layer) |
| `source` | string? | Where the fact came from (≤ 500 chars) |
| `confidence` | float, default `1.0` | 0.0–1.0; how strongly the company holds this fact |
| `createdAt` / `updatedAt` | datetime | Timestamps |

**Seeded banks (Implemented today).** At company creation, `src/lib/company-seed.ts` provisions five memory banks: **Company Memory** (`company`), **Architecture Memory** (`architecture`), **Product Memory** (`product`), **Security Memory** (`security`), and **Operations Memory** (`operations`). The `employee`, `feature`, and `decision` categories are valid but created on demand rather than seeded.

**Surfaces (Implemented today).** The memory module is reachable at `/memory` (bank list with counts of banks, records, and categories), `/memory/[id]` (a bank's records, each showing content, source, and confidence as a percentage), and `/memory/new` (create a bank). Records are added through the `addMemoryRecord` server action (`src/app/actions/memory.ts`). Every read and write is scoped to the authenticated CEO's company.

> The richer record semantics in the Domain Model — per-record `type`, `scope`, `status` (`active` / `deprecated` / `superseded`), and version chains — are **Designed / planned**. The shipped schema models distinctness through `category` (on the bank) plus `source` and `confidence` (on the record). Write records with that in mind; see [Section 12](#12-implemented-today-vs-designed--planned).

---

## 6. Write Rules

A write to Company Memory is the act of recording a reusable, company-wide fact. It is deliberate, not incidental.

1. **Write only company-true facts.** If the fact is narrower than the company, write it to the correct layer instead (see [Section 2](#2-scope--what-belongs-in-company-memory)).
2. **One fact per record.** Each `MemoryRecord` captures a single standard, rule, or lesson. Do not pack a paragraph of unrelated facts into one record — it makes the record unsearchable and impossible to supersede cleanly.
3. **Write the rule, not the event.** "We hit a rate limit once" is an event. "All outbound provider calls must back off exponentially and cap at 5 retries" is a company rule. Memory holds the rule.
4. **Always capture rationale for standards and lessons.** A record that says *what* without *why* invites a future employee to reverse it. Include the reasoning, or link the Decision Record that holds it.
5. **Set `source` honestly.** Record where the fact came from — the task, incident, review, or decision that produced it. Source is how the CTO audits and how conflicts are later adjudicated.
6. **Set `confidence` deliberately.** Use `1.0` for established standards. Lower confidence (e.g., `0.6`) for an emerging pattern that has worked once or twice but is not yet a mandate. Confidence communicates how much weight downstream readers should give the record.
7. **Choose the right bank.** Write architecture rules to the Architecture bank, security rules to the Security bank, and genuinely cross-cutting organizational facts to the Company bank. Do not default everything to the Company bank.
8. **Promote, don't copy.** When promoting a fact from Employee, Repository, or Feature memory, restate it at company scope and cite its origin in `source`. Do not paste the narrower record verbatim.

**Who may write (Designed).** In the running company, memory writes are produced by employees and workflows after significant events — the New Feature, Code Review, QA, Release, Bug Fix, and Rollback SOPs each conclude by updating memory (see the [SOPs](../sops/)). **Implemented today**, writes are performed manually by the CEO through the memory surface; automatic workflow-driven writes are **Designed / planned**.

---

## 7. Read Rules

1. **Consult before deriving.** Before making a decision in a domain, an employee checks Company Memory for an existing standard, rule, or lesson. If a relevant record exists, the employee follows it rather than re-deriving a conclusion.
2. **Read by scope, then refine.** Read the company-wide layer for organization rules; consult the narrower layers (repository, feature) for specialized context. The narrowest applicable record wins when it does not contradict a company rule.
3. **Respect confidence.** A `1.0` record is a standard to follow. A low-confidence record is a signal, not a mandate — weigh it, and prefer to raise its confidence (or supersede it) once it proves out.
4. **Reads are non-destructive.** Reading never mutates a record. Acting on a record may *produce* a new record (a lesson, a confirmation), but the read itself changes nothing.
5. **Company-wide read access.** Every employee may read Company Memory. There are no per-record read restrictions within a company; the security boundary is the company itself — all queries are company-scoped.

**Retrieval (Designed).** The [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md#410-memory-boundary) specifies that execution engines do not query memory directly — the Context Builder assembles a scoped Context Package and supplies relevant records to a run. Semantic ranking (pgvector) is a V1.5+ capability. **Implemented today**, memory is read through company-scoped Prisma queries that back the `/memory` surfaces.

---

## 8. Update Rules

Company Memory records facts that are meant to last, so updates are governed, not casual.

1. **Standards change through decisions, not edits.** Changing a company-wide standard (a coding rule, an architecture principle) requires the owning authority — typically the CTO, or the Product Manager for product rules — and should be backed by a Decision Record. A standard is not quietly rewritten by whoever touches it last.
2. **Correct, don't distort.** Fixing a typo or clarifying wording is fine. Changing the *meaning* of a record is a supersession, not an edit (see below).
3. **Supersession over mutation (Designed).** The Domain Model specifies that a record is never edited into a different fact — a new record supersedes the old, and the old links forward to its successor (`status: superseded`). **Implemented today** the schema has no `status` or `supersededBy` field, so supersession is expressed by adding the new record (with a `source` that cites the record it replaces) and lowering the old record's `confidence` toward `0`. When the version-chain fields ship, migrate to explicit supersession.
4. **Update `updatedAt` semantics.** The `Memory` bank's `updatedAt` reflects activity; it is not a substitute for per-record history.
5. **Promotion is an update path.** When a narrower-layer fact becomes company-wide, the "update" to Company Memory is a *new* company-scoped record citing the origin — not an in-place mutation of the narrower record.

Autonomy gating: per the [Domain Model — Company](../architecture/DOMAIN_MODEL.md#company), changes to company configuration take effect at workflow phase boundaries. Standard changes that affect in-flight work should follow the same discipline — record the new standard, but let in-progress work finish under the prior rule unless the change is a safety fix.

---

## 9. Validation

**Implemented today** (enforced in `src/app/actions/memory.ts`):

- A bank `title` is required, trimmed, and ≤ 200 characters.
- A bank `summary` is optional and ≤ 2,000 characters.
- A bank `category` must be one of the eight valid categories; it defaults to `company`.
- A record `content` is required, trimmed, and between 1 and 10,000 characters.
- A record `source` is optional and ≤ 500 characters.
- A record `confidence` is coerced to a number and clamped to the `0.0`–`1.0` range; it defaults to `1.0`.
- Every write resolves the company from the authenticated user; a write with no resolvable company is rejected. A record write is rejected unless its parent bank belongs to the caller's company.

**Editorial validation (house rules):**

- A record states exactly one fact and is understandable without external context.
- A standard or lesson record includes its rationale or links the Decision Record that holds it.
- `source` is populated for any non-obvious fact.
- `confidence` reflects reality — `1.0` is reserved for established standards.
- The record is in the correct bank for its category.

---

## 10. Retention

**Implemented today.** There is no delete path in the memory action layer — neither banks nor records expose a delete operation. Records therefore persist for the life of the company. The only removal is **cascade on company deletion**: deleting a `Company` cascades to its `Memory` banks, which cascade to their `MemoryRecord` rows (`onDelete: Cascade` in the schema). This is consistent with the durability intent below.

**Designed / planned.** The [Domain Model — Memory Record](../architecture/DOMAIN_MODEL.md#memory-record) specifies that memory is **never deleted** — records are deprecated or superseded, never removed — and that conversation-scope records expire automatically after a session closes. Company-scope records have **no expiry**: they are the organization's long-term knowledge and are retained indefinitely. When the `status` lifecycle ships, retirement of a fact will be expressed as deprecation (the record stays, marked inactive), not deletion.

**Practical retention guidance until then:** to "retire" a Company Memory fact today, supersede it (write the corrected record, cite the old one in `source`) and drive the obsolete record's `confidence` to `0` rather than attempting to remove it. The history of the fact is part of the company's value.

---

## 11. Conflict Resolution

Two records can contradict each other — two employees write opposing rules, or a promoted fact collides with an existing standard. Contradictions in Company Memory are corrosive: employees act on the wrong rule and the company's output becomes inconsistent.

**Principles:**

1. **Never silently allow contradictions.** The [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md#410-memory-boundary) is explicit: conflicting records are surfaced to the CTO, not quietly tolerated.
2. **The CTO adjudicates.** Conflicts in company-wide standards are resolved by the CTO (or the owning authority for product/security domains), who decides which record stands and supersedes the other.
3. **Specific beats general — within the same scope.** When two company records conflict, the more specific, better-sourced, higher-confidence record generally wins. Across scopes, a narrower-layer record specializes a company rule rather than contradicting it; if it truly contradicts a company standard, that is a conflict to escalate, not a silent override.
4. **Resolution produces a record.** The outcome of a conflict is itself a fact: the winning record is reaffirmed (confidence restored to `1.0`), the losing record is superseded, and the rationale is captured in `source` so the conflict is not re-litigated.

**Implemented today**, conflict detection is manual — the CEO and CTO spot contradictions while browsing `/memory`. Automatic conflict detection and a `memory.record_deprecated` event flow are **Designed / planned** per the Memory Boundary.

---

## 12. Implemented Today vs. Designed / Planned

| Capability | Status |
|---|---|
| `Memory` bank + `MemoryRecord` rows, company-scoped | **Implemented today** |
| Eight categories; five banks seeded at company creation | **Implemented today** |
| `/memory`, `/memory/[id]`, `/memory/new` surfaces | **Implemented today** |
| Create bank / add record server actions with Zod validation | **Implemented today** |
| `content`, `source`, `confidence` per record | **Implemented today** |
| Cascade deletion on company deletion | **Implemented today** |
| Per-record `type` and `scope` fields | Designed / planned |
| `status` (`active` / `deprecated` / `superseded`) + version chain | Designed / planned |
| Conversation-scope auto-expiry | Designed / planned |
| Automatic workflow-driven writes (SOP phase-8 memory updates) | Designed / planned |
| Context Builder retrieval + semantic ranking (pgvector, V1.5+) | Designed / planned |
| Automatic conflict detection + `memory.*` events | Designed / planned |
| Promotion to curated Knowledge Records | Designed / planned |

When in doubt, build and write against **Implemented today**; treat **Designed / planned** as the target the schema and process should evolve toward. Do not describe planned behavior as if it ships today, and do not invent fields or automation that are not in the schema.

---

## 13. Examples

**Good — a coding standard (Company bank, confidence 1.0):**
> All server actions resolve the company from the authenticated user and reject writes that cannot be scoped to a company. Rationale: company is the security boundary; an unscoped write is a tenancy leak. Source: code-review finding, MUS task on memory actions.

**Good — a documentation practice (Company bank, confidence 1.0):**
> Every doc under `/docs` opens with the house front-matter block (Title, Status, Version, Owner, Last Updated), a horizontal rule, a Table of Contents, then numbered sections. Source: Domain Model and Technical Architecture house style.

**Good — a lesson learned (Operations bank, confidence 0.8):**
> Guardrails must never depend on the agent's `claude -p` permission mode; the pre-push gate enforces protected paths independently. Rationale: an agent can be told to ignore instructions, but the gate cannot be talked out of a block. Source: MUS-213 safety work.

**Good — an emerging pattern (Architecture bank, confidence 0.6):**
> Prefer deterministic/templated generation over AI until the underlying model is specified. Rationale: avoids fake intelligence; aligns with the v2 non-goal of adding AI before the models exist. Source: Platform v2 charter.

**Why these are good:** each is one fact, company-true, sourced, and carries a confidence that matches how settled it is.

---

## 14. Anti-Patterns

- **The diary.** Logging events ("deployed today", "fixed a bug") instead of reusable rules. Memory holds rules, not a timeline — that is what the [Timeline](../architecture/DOMAIN_MODEL.md#timeline-entry) is for.
- **The junk drawer.** Defaulting every record to the Company bank regardless of category, making the bank unsearchable.
- **The orphan fact.** A record with no `source` and no rationale that no future employee can trust or supersede.
- **The wrong scope.** Writing a single repository's folder layout or one feature's acceptance criteria into Company Memory. That belongs to Repository or Feature memory.
- **Confidence inflation.** Marking every record `1.0`, erasing the signal that distinguishes a mandate from a hunch.
- **The silent reversal.** Editing a standard's meaning in place instead of superseding it, so the change has no rationale and no history.
- **The duplicate.** Copying a record from a narrower layer verbatim instead of promoting it at company scope with a citation.
- **The contradiction left standing.** Noticing two records disagree and moving on. Conflicts must be escalated to the CTO.

---

## 15. Definition of Done

A Company Memory write is **done** when:

- [ ] The fact is genuinely company-wide; narrower facts have been routed to the correct layer.
- [ ] The record states exactly one fact and is understandable on its own.
- [ ] Standards and lessons include rationale, or link the Decision Record that holds it.
- [ ] `source` is populated and honest.
- [ ] `confidence` reflects how settled the fact is (`1.0` only for established standards).
- [ ] The record is in the correct bank for its category.
- [ ] It does not contradict an existing record; if it does, the conflict was resolved (one record superseded) rather than left standing.
- [ ] If it supersedes an older fact, the old record is marked down (confidence toward `0`) and the new record cites it — until the `status` lifecycle ships, this is the supersession mechanism.

The Company Memory **layer** is healthy when every employee can be trusted to act on it without asking the CEO to re-explain settled context, and when no two records in active use contradict each other.

---

## 16. Cross-References

- [Domain Model — Memory](../architecture/DOMAIN_MODEL.md#memory) and [Memory Record](../architecture/DOMAIN_MODEL.md#memory-record) — the authoritative object definitions and the memory-layer model.
- [Domain Model — Knowledge](../architecture/DOMAIN_MODEL.md#knowledge) — the curated tier Company Memory promotes into.
- [Technical Architecture — Memory Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#410-memory-boundary) — write/read interface, three-layer model, retrieval, and conflict handling.
- [Technical Architecture — Knowledge Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#411-knowledge-boundary) — Memory-to-Knowledge promotion.
- [Company Runtime](../architecture/COMPANY_RUNTIME.md) — how memory is consulted and updated while the company runs.
- [SOPs](../sops/) — the workflows whose completion writes lessons and decisions back into memory.

Companion memory-layer documents (same milestone): Employee Memory, Repository Memory, Feature Memory, and Decision Memory. This document owns the company-wide layer; those documents own their respective scopes and should not duplicate the rules defined here.
