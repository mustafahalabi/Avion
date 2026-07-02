# Connected Knowledge

**Status:** Approved
**Version:** 1.0
**Owner:** CTO

**Last Updated:** 2026-06-29

This document defines **Connected Knowledge** — the relationships that turn the company's individual records into a navigable graph. Engineering OS does not just store outcomes, plans, features, tasks, repositories, reviews, QA results, releases, employees, and memory; it connects them, so that any record can answer *where it came from*, *what it depends on*, *who owns it*, *what it produced*, and *what it affects*. Connected Knowledge is the layer that makes those answers reliable.

This is a document about **relationships, not storage technology**. It names concrete fields and services where they exist today (see [§10 Implementation Status](#10-implementation-status)), but the rules it defines — what may connect to what, who owns an edge, when an edge is created, and how an edge is validated — survive any change of database, ORM, or index. Where a connection is designed but not yet built, that is stated plainly and kept separate from what exists. Inventing connections the platform does not actually maintain is a hard project rule and is never done here.

This document is a peer of the memory-layer documents — [Company Memory](./COMPANY_MEMORY.md), [Employee Memory](./EMPLOYEE_MEMORY.md), and [Repository Knowledge](./REPOSITORY_KNOWLEDGE.md). Those own the *contents* of each memory scope. This one owns the *edges between* records of every kind. It does not restate the node definitions; for those, see the [Domain Model](../architecture/DOMAIN_MODEL.md).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Entity Types (Nodes)](#3-entity-types-nodes)
4. [Relationship Types (Edges)](#4-relationship-types-edges)
5. [Edge Mechanics — How Connections Are Made](#5-edge-mechanics--how-connections-are-made)
6. [Ownership](#6-ownership)
7. [Update Rules](#7-update-rules)
8. [Validation Rules](#8-validation-rules)
9. [How Employees Navigate Connected Knowledge](#9-how-employees-navigate-connected-knowledge)
10. [Implementation Status](#10-implementation-status)
11. [How Connected Knowledge Improves the Company](#11-how-connected-knowledge-improves-the-company)
12. [Examples](#12-examples)
13. [Anti-Patterns](#13-anti-patterns)
14. [Definition of Done](#14-definition-of-done)
15. [Relationship to Other Documents](#15-relationship-to-other-documents)

---

## 1. Purpose

A record in isolation is a fact. A record connected to its neighbors is *understanding*. Connected Knowledge exists so the company can reason across records instead of treating each one as an island:

1. **Trace intent to delivery.** Every Task should be answerable: *which Feature, which Project, which Outcome, and which line of which approved Plan produced you?* Without that chain, the company cannot explain why work exists, and approval cannot be applied safely.
2. **Route the right specialist.** When a codebase changes, the company should know which employee roles the change touches. That is an edge from a repository change to a set of roles, not a guess.
3. **Verify before advancing.** A Task cannot reach `done` unless a Review and a QA result are *connected to it* and both are satisfied. The gate reads edges; it does not trust a status field alone.
4. **Preserve provenance.** When the company learns something, the record points back at the work that produced it. Knowledge with no edge to its origin cannot be trusted or superseded.
5. **Compound over time.** The more the company works, the denser and more useful the graph becomes. Connected Knowledge is what lets a future task inherit the context of every related task that came before it.

Connected Knowledge is **not** a separate database, a graph engine, or a second copy of the data. It is the disciplined set of relationships maintained *within* the existing relational records, plus the rules that keep those relationships honest.

---

## 2. Scope

**In scope.** The edges between the company's first-class records:

- The **traceability spine** from an Outcome through its versioned Plan to the Projects, Features, and Tasks the plan generated.
- **Containment** hierarchies (Company → Workspace → Repository; Project → Feature → Task → Subtask; Project → Sprint / Milestone).
- **Assignment** edges (Task → Employee; Execution Session → Employee/role).
- **Execution** edges (Execution Session → Task, Project, Repository, and the resulting commit / pull request).
- **Quality** edges (Review and QA Result → the work they evaluate; Change Request → Review; Release → the work it ships).
- **Change and impact** edges (Repository → its analysis snapshots; a snapshot diff → the roles and areas it affects).
- **Observability** edges (Timeline Entry, Event, and Notification → the entity they describe).
- **Knowledge provenance** edges (a Memory Record → the work item that produced it).

**Out of scope.** The internal definition of each node (owned by the [Domain Model](../architecture/DOMAIN_MODEL.md)); the *contents* of each memory scope (owned by the [memory-layer documents](#15-relationship-to-other-documents)); physical storage, indexing, and retrieval engines; and any semantic/vector similarity layer, which is a planned capability of the Memory module, not a maintained edge (see the [Technical Architecture — Memory Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#410-memory-boundary)).

---

## 3. Entity Types (Nodes)

The graph connects the following node types. Each is owned by exactly one module (see the [Technical Architecture — Data Ownership Rules](../architecture/TECHNICAL_ARCHITECTURE.md#6-data-ownership-rules)). The right-hand column states how solidly the node participates in the graph **today**.

| Node type | What it represents | Graph participation today |
|---|---|---|
| **Company / Workspace** | The tenant namespace and its engineering surface | Root of the graph; every other node is scoped to it |
| **Repository** | A connected codebase | Connected: snapshots, execution sessions, outcomes |
| **Repository Analysis Snapshot** | One point-in-time analysis of a codebase | Connected: append-only history under a Repository |
| **Outcome** | A CEO-requested result | Connected: the head of the traceability spine |
| **Plan (Planning Draft)** | A versioned, reviewable plan for an Outcome | Connected: the bridge from intent to work |
| **Project / Feature / Task / Subtask** | The work hierarchy | Connected: containment + traceability + assignment |
| **Sprint / Milestone** | Execution and delivery markers | Connected: contained by a Project |
| **Employee** | A specialist role | Connected: assignee of Tasks and Execution Sessions |
| **Execution Session** | One implementation attempt by an agent | Connected: links task, project, repo, employee, plan, PR |
| **Review / QA Result / Change Request / Release** | Quality and delivery records | Connected: attach to work via reference edges |
| **Memory Record** | A discrete reusable fact | Soft-connected: carries a `source` provenance pointer |
| **Timeline Entry / Event / Notification** | The narrative and alert layer | Soft-connected: reference an entity by type + id |
| **API routes / dependencies / risks** | Facts *inside* a repository analysis | Embedded attributes of a snapshot — **not** first-class nodes today |
| **Decision** | A significant, lasting choice | **Designed** — represented today only as a `decision`-category Memory Record |
| **Incident** | A production problem | **Designed** as a connected node — the current `Incident` record is standalone (no edges) |

> Honesty rule: the ticket scope names *APIs, dependencies, decisions, incidents, and risks* as things the company connects. Today, **APIs, dependencies, and risks are captured as attributes inside a Repository Analysis Snapshot**, not as independently linkable nodes; **decisions live as Memory Records**, not a dedicated Decision node; and **Incidents are standalone records with no relationships**. Their first-class connection is the designed target, documented in [§10](#10-implementation-status). This document describes the edges that genuinely exist and clearly marks the rest.

---

## 4. Relationship Types (Edges)

Edges fall into nine families. Each family has a direction, a cardinality, and a meaning. The platform service that creates the edge is named so the edge is auditable.

### 4.1 Containment (`contains` / `belongs to`)
The structural backbone. A Workspace contains Repositories; a Project contains Features, Sprints, and Milestones; a Feature contains Tasks; a Task contains Subtasks. Containment edges are **hard** (enforced foreign keys) and cascade on deletion of the parent. They answer *where does this live?*

### 4.2 Provenance / traceability (`generated from` / `traces to`)
The most important edge in the company. An **Outcome** spawns one or more **Planning Drafts** (versioned, one approved version at a time). Approving a plan **generates** Projects, Features, and Tasks, each of which records *both* its originating `planningDraftId` **and** the `planItemId` of the exact plan line it came from. This edge answers *why does this work exist, and what did the CEO actually approve?* It is what makes plan application idempotent (see [§5](#5-edge-mechanics--how-connections-are-made)).

### 4.3 Assignment / ownership (`assigned to`)
A Task points at the Employee responsible for it; an Execution Session points at the employee or recommended role performing it. Assignment edges answer *who owns this?* — the one-owner principle made concrete.

### 4.4 Execution / delivery (`implements` / `produced`)
An **Execution Session** is the richest connector in the graph: it links a **Task**, its **Project**, the target **Repository**, the assigned **Employee**, and the originating **Planning Draft**, and on completion it records the **commit SHA**, **pull request URL/number**, and the **list of changed files**. This edge answers *what was actually done, where, and by which agent?* and bridges internal records to the external Git world.

### 4.5 Quality / verification (`reviews` / `validates` / `ships`)
A **Review** and a **QA Result** attach to the work they evaluate (today, a Task) and also carry the `outcomeId` / `planningDraftId` / `planItemId` provenance. A **Change Request** belongs to a Review. A **Release** connects to the Outcome and plan it delivers and lists the Task IDs it ships. These edges answer *has this been verified, and what shipped?* The gate logic refuses to advance a Task to `done` unless the verification edges exist and are satisfied.

### 4.6 Change / impact (`supersedes` / `affects`)
Each **Repository Analysis Snapshot** is an append-only successor to the previous one. Comparing the two most recent snapshots yields a change set; impact analysis maps that change set to **affected areas** (files, routes, models, dependencies) and **affected roles** (e.g., Backend Engineer, QA Engineer, Security Engineer). This edge answers *what moved, and who needs to care?*

### 4.7 Knowledge provenance (`derived from`)
A **Memory Record** carries a `source` string that names the task, review, incident, or decision that produced the fact. This is a soft edge (a human-readable pointer, not a foreign key), but it is the discipline that lets the company audit and supersede memory. See [Company Memory §6](./COMPANY_MEMORY.md#6-write-rules).

### 4.8 Observability / narrative (`describes`)
**Timeline Entries**, **Events**, and **Notifications** reference the entity they are about by an `entityType` + `entityId` pair (and, for notifications, an `actionUrl`). These edges answer *what happened to this record, and when?* They are deliberately soft and polymorphic so that any node type can have a narrative without the narrative layer depending on every module.

### 4.9 Integration / external (`connects to`)
**Provider Connections** link a Company (or user) to an external provider (GitHub, Linear, Vercel); Execution Session PR/commit fields link an internal session to an external pull request. These edges answer *where does this record touch the outside world?*

| Edge family | Direction & cardinality | Created by |
|---|---|---|
| Containment | parent 1 → N children | the owning module on create |
| Traceability | Outcome 1 → N Plans 1 → N work items | plan application service |
| Assignment | work item N → 1 Employee | task / execution services |
| Execution | Session 1 → 1 Task (+ repo, PR) | execution session service |
| Quality | Review/QA N → 1 work item | review / QA services |
| Change/impact | Snapshot N → prior; change → N roles | snapshot + impact services |
| Provenance | Memory Record N → 1 source (soft) | the writing employee/workflow |
| Observability | entry N → 1 entity (soft) | timeline / event / notify services |
| Integration | Company 1 → N connections | provider connection service |

---

## 5. Edge Mechanics — How Connections Are Made

Engineering OS maintains three distinct kinds of edge. Knowing which kind an edge is determines how it is validated and how much it can be trusted.

**Hard edges (enforced relations).** Most structural and traceability edges are foreign keys, and almost all of them are **composite and company-scoped** — they reference a record by `(companyId, id)`, not by `id` alone. This makes a cross-company edge *structurally impossible*: a Task can only point at a Project in the same company. Hard edges carry referential integrity and explicit deletion behavior — containment edges `Cascade` (deleting a Project removes its Features and Tasks), while traceability edges `Restrict` (an Outcome or Plan cannot be deleted out from under the work that traces to it).

**Idempotent traceability edges.** When an approved plan is applied, each generated record is **upserted** on the unique pair `(planningDraftId, planItemId)`. Re-applying the same plan does not create duplicates — it re-resolves the same edges. This is the mechanism that lets approval be safely retried and lets the company guarantee a one-to-one mapping between a plan line and the record it produced.

**Soft edges (polymorphic references).** The cross-cutting layers — Reviews, QA Results, Timeline Entries, Events, Notifications — reference their subject by an `entityType` + `entityId` string pair rather than a foreign key. This keeps those modules decoupled from every node type, but it means **the database does not guarantee the target exists**. Soft edges are validated in the service layer and at read time (for example, the approval-checkpoint logic joins a Review's `entityId` back to its Task in code, and skips any reference it cannot resolve). A soft edge that resolves to nothing is a *dangling* edge and is a defect (see [§8](#8-validation-rules)).

**Derived edges (computed at read time).** Some relationships are not stored at all but computed when needed — for example, "which Tasks are blocking this Outcome's completion" or "which roles a snapshot diff affects." Derived edges are always recomputed from the hard records; they are never cached as if they were authoritative.

---

## 6. Ownership

| Concern | Owner |
|---|---|
| Integrity of the connected graph as a whole | **CTO** |
| Each edge family | The module that owns the edge's source record (see the [Data Ownership Rules](../architecture/TECHNICAL_ARCHITECTURE.md#6-data-ownership-rules)) |
| Traceability edges (Outcome → Plan → work) | Planning module (plan application service) |
| Execution / delivery edges | Execution module (execution session service) |
| Quality edges | Review and QA modules |
| Soft narrative edges | Timeline / Notification modules |
| Repairing dangling or cross-scope edges | The owning module, escalated to the CTO when systemic |

The principle mirrors the architecture's first rule — **modules own their data**, and therefore they own the edges that originate from their data. No module reaches into another module's records to forge an edge; it creates the edge from its own side through the owning module's interface. The CTO owns the *health* of the overall graph: no orphaned work, no dangling references in active use, no cross-company leakage.

---

## 7. Update Rules

1. **An edge is created by the service that owns its source, at the moment the relationship becomes true.** A Task gains its Feature/Project/Outcome/plan edges when the plan is applied — not retroactively stitched together later.
2. **Traceability edges are written once and are idempotent.** Re-applying a plan re-resolves the same `(planningDraftId, planItemId)` pairs; it never forks a second record for the same plan line.
3. **History is append-only.** A new Repository Analysis Snapshot is added; prior snapshots are never edited or deleted, because the change/impact edge depends on the old snapshot remaining intact. Timeline Entries and Events are likewise append-only.
4. **Both endpoints of a soft edge are set together.** Writing an `entityId` without its `entityType` (or vice versa) is forbidden — a half-specified polymorphic reference cannot be resolved.
5. **Provenance is captured at write time.** A Memory Record's `source` is set when the fact is written, naming the work that produced it. Back-filling provenance later is unreliable and discouraged.
6. **Deletions respect the edge's intent.** Containment deletes cascade; traceability deletes are restricted. A service must not work around a `Restrict` by deleting children first to orphan a parent.
7. **Re-pointing is a deliberate act.** Moving a Task to a different Feature, or re-assigning it to a different Employee, updates the edge through the owning service; it is never done by editing raw IDs in a way that skips validation.

---

## 8. Validation Rules

Connected Knowledge is only valuable if its edges are trustworthy. The following are enforced today or are house rules where enforcement is in the service layer.

**Integrity**
- Every hard edge references an existing record; the database rejects an FK that points nowhere.
- Every company-scoped edge resolves within a single company. Cross-company edges are structurally impossible because the composite keys include `companyId`.
- Traceability edges are unique on `(planningDraftId, planItemId)` — no two records claim the same plan line.

**Soft-edge hygiene**
- A soft edge (`entityType` + `entityId`) must have both halves set, and the target must resolve at read time. Code that consumes soft edges (gates, approval checkpoints) **skips and does not act on** any reference it cannot resolve, rather than failing the whole operation or fabricating a target.
- A soft edge in *active use* that no longer resolves is a dangling reference and is a defect to repair, not to ignore.

**Truthfulness**
- An edge is recorded only when the relationship genuinely exists. A Task with no completed Execution Session does not get a fabricated commit/PR edge; absent delivery is represented as absent, never as a plausible-looking link.
- Repository impact edges (`affected roles`, `affected areas`) are derived from an actual snapshot diff — never asserted without the underlying change.

**Verification gating**
- The work gates read the *edges*, not just a status flag: a Task advances out of review only when a Review record connected to it is approved, and reaches `done` only when a QA Result connected to it has passed. The connection is the evidence.

---

## 9. How Employees Navigate Connected Knowledge

An employee (and the execution agent acting for a role) traverses the graph rather than asking the CEO to re-explain context. The standard traversals:

- **From a Task, walk *up* the traceability spine** — Task → Feature → Project → Outcome, and Task → `planItemId` → the exact plan line — to learn *why* the work exists and *what was approved*. This is how an agent confirms scope before writing code.
- **From a Task, walk *sideways* to the Repository** — Task → Project/Outcome → Repository → latest Analysis Snapshot — to learn the stack, the files to read first, the validation commands, and the protected paths it must respect. (See [Repository Knowledge §6](./REPOSITORY_KNOWLEDGE.md#6-what-must-be-known-before-work-starts).)
- **From a Task, walk *down* to execution** — Task → Execution Session → commit / PR / changed files — to see what was actually delivered and to review or QA against the real diff.
- **From a Task, walk to its verification** — Task → Review and Task → QA Result — to know whether it has cleared its gates, and Review → Change Request to see what was asked for.
- **From a repository change, walk to the people** — Snapshot diff → impact analysis → affected roles — to route the right specialists (Backend, QA, Security, Release) before the next wave of work.
- **From any record, walk its narrative** — entity → Timeline Entries — to read the chronological story of what happened to it.
- **From a fact, walk to its origin** — Memory Record → `source` — to judge how much to trust it and whether it is safe to supersede.

The Context Builder (designed; see the [Technical Architecture — Context Builder](../architecture/TECHNICAL_ARCHITECTURE.md#420-context-builder)) is the intended automation of these traversals: it assembles a scoped Context Package by walking exactly these edges so that an execution engine never has to query the graph itself. Today, the same traversals are performed by the platform's services (task-context generation, gate advancement, change intelligence) using company-scoped queries.

---

## 10. Implementation Status

Separated per the project's hard rule: describe only what genuinely exists today.

**Implemented today**
- **Company-scoped composite-key edges** across the work hierarchy — Project, Feature, Task, Review, QA Result, Release, and Execution Session all reference their neighbors by `(companyId, id)`, making cross-company edges impossible (`apps/web/prisma/schema.prisma`).
- **The full traceability spine** Outcome → Planning Draft → Project / Feature / Task, with each generated record carrying `planningDraftId` + `planItemId`, applied **idempotently** via upsert on `(planningDraftId, planItemId)` (`apps/web/src/lib/plan-application-service.ts`).
- **Execution/delivery edges** — `ExecutionSession` links task, project, repository, employee, and planning draft, and records `commitSha`, `prUrl`, `prNumber`, and `filesChanged` (`apps/web/src/lib/execution-session-service.ts`).
- **Quality edges** — `Review` and `QAResult` attach to work via `entityType`/`entityId` plus `outcomeId`/`planningDraftId`/`planItemId`; `ChangeRequest` belongs to a `Review`; gates read these edges before advancing (`apps/web/src/lib/gate-advancement-service.ts`, `apps/web/src/lib/approval-checkpoints.ts`).
- **Change/impact edges** — append-only `RepositoryAnalysisSnapshot` history, snapshot comparison, and impact analysis mapping a diff to `affectedAreas` and `affectedRoles` (`apps/web/src/lib/repository-change-intelligence.ts`, `apps/web/src/lib/repository-impact-analysis.ts`).
- **Soft observability edges** — `TimelineEntry`, `Event`, and `Notification` reference an entity by `entityType` + `entityId` (and `actionUrl` for notifications).
- **Provenance pointer** — `MemoryRecord.source` records where a fact came from.
- **Provider connection edges** — `ProviderConnection` links a company/user to GitHub, Linear, or Vercel.

**Designed / planned (not built)**
- **First-class Decision and Incident nodes with edges.** Decisions exist today only as `decision`-category Memory Records; the `Incident` model is standalone with no `companyId` and no relationships. Connecting incidents to releases, root-cause analyses, and follow-up tasks (per the [Domain Model — Incident](../architecture/DOMAIN_MODEL.md#incident)) is designed, not built.
- **APIs, dependencies, and risks as linkable nodes.** Today these are attributes embedded inside a snapshot, not records other entities can point at.
- **Task-to-task dependency edges.** The Domain Model defines `depends_on`; the shipped `Task` model has no dependency field. Plan-level dependencies are captured as a JSON list on the Planning Draft, not as enforced edges.
- **Referential integrity for soft edges.** Polymorphic references are validated in code, not by the database; a formal resolution/repair pass is designed.
- **Standalone `Event` / `Knowledge` graph integration.** `Event` and `Knowledge` currently lack a `companyId` relation and so are not yet first-class participants in the company-scoped graph.
- **Semantic/derived edges over memory.** The pgvector ranking layer (V1.5+) that would let employees find *related* records by similarity is planned, per the Memory Boundary.

When in doubt, build and reason against **Implemented today**; treat **Designed / planned** as the target the schema should evolve toward. Never describe a planned edge as if it ships today.

---

## 11. How Connected Knowledge Improves the Company

Connected Knowledge is not documentation for its own sake — each edge pays off in a specific workflow.

**Planning.** Because every generated work item traces to a plan line (`planItemId`) and a plan version, approval can be **applied idempotently** and re-run without duplication, and the CEO can see exactly which approved intent produced which Project, Feature, and Task. Planning also reads the Repository edges to decompose work against the codebase that actually exists rather than an imagined one.

**Review.** A Review is connected to the precise work it evaluates and, through the execution edge, to the real commit and changed files. The reviewer evaluates the actual diff, and the gate will not approve while a connected Change Request is unresolved — the connection *is* the enforcement.

**QA.** A QA Result is bound to its Task, and the company guarantees that no Task reaches `done` without a connected, passing QA Result. The verification edge is read at the gate, so a green status that lacks the underlying edge cannot slip through.

**Future work.** The graph compounds. A new Task inherits the context of related Tasks via the shared Feature/Project/Outcome; a repository change routes to the right roles via the impact edge; and a Memory Record's provenance edge lets a future employee trust, or safely supersede, an accumulated fact instead of re-deriving it. Over time, the company answers "why" and "what changed because of this" by traversal, not by archaeology.

---

## 12. Examples

**Example A — A task traced end to end.** The CEO submits an Outcome ("add billing"). An approved Planning Draft generates a Task whose `planItemId` points at plan line `t-3` and whose `planningDraftId` points at draft `v2`. An Execution Session links that Task to the Repository, runs the agent, and records commit `a1b2c3` and PR #41 with three changed files. A Review (connected to the Task) is approved; a QA Result (connected to the Task) passes; the Task advances to `done`. Every hop — intent → plan line → work → delivery → verification → completion — is a real edge.

**Example B — Idempotent re-application.** The same plan is applied twice (a retry after a transient error). Because each record upserts on `(planningDraftId, planItemId)`, no duplicate Projects, Features, or Tasks appear; the second run re-resolves the identical edges.

**Example C — Change routed to roles.** A new Repository Analysis Snapshot shows a Prisma model changed. Impact analysis emits `affectedAreas: [database, files]` and `affectedRoles: [Backend Engineer, QA Engineer, Release Manager]`. The Tech Lead routes regression work to exactly those roles — an edge from a code change to the people who must care.

**Example D — A soft edge that does not resolve.** A Notification references `entityType: task`, `entityId: <deleted>`. The consuming code cannot resolve the target, so it skips the item rather than crashing or inventing a task. The dangling reference is logged as a defect to repair — the system never fabricates the missing node.

**Example E — Provenance on a fact.** A Company Memory Record states a guardrail rule with `source: "MUS-213 safety work"`. A future employee reading the rule can walk the provenance pointer to understand where it came from before relying on or revising it.

---

## 13. Anti-Patterns

- **The orphan.** A Task with no Feature/Project/Outcome edge — work that exists but cannot explain why. Every work item must trace to an approved plan line.
- **The fabricated edge.** Asserting a commit, PR, review, or impact that did not happen. Absent delivery is represented as absent, never as a plausible link.
- **The dangling reference.** A soft `entityType`/`entityId` pointing at a record that no longer exists, left in active use. Resolve it or repair it; do not act on it.
- **The cross-scope leak.** Trying to connect records across companies. The composite keys forbid it on hard edges; never reintroduce it through a soft edge.
- **The duplicate spine.** Applying a plan in a way that forks a second record for the same plan line instead of upserting on `(planningDraftId, planItemId)`.
- **Mutated history.** Editing or deleting a prior Analysis Snapshot, Timeline Entry, or Event. History is append-only; it is what makes change and narrative edges trustworthy.
- **The half-edge.** Writing one half of a polymorphic reference (id without type). An unresolvable edge is worse than no edge.
- **Treating designed nodes as connected.** Wiring logic that assumes Incidents or Decisions are first-class graph nodes today. They are not — they are standalone or memory-backed until the designed work lands.
- **Provenance-free facts.** A Memory Record with no `source`, severing the edge to its origin and making it untrustworthy.

---

## 14. Definition of Done

Connected Knowledge for a body of work is "done" when:

- [ ] Every work item **traces** to its Outcome, Plan version, and plan line (`planningDraftId` + `planItemId`); there are no orphan Projects, Features, or Tasks.
- [ ] All traceability edges are **idempotent** — re-applying the plan produces no duplicates.
- [ ] Every hard edge resolves to an existing, **same-company** record; no cross-company edge exists.
- [ ] Delivered work carries its **execution edge** (session → task → repo, with commit/PR/changed-files) when, and only when, delivery actually occurred.
- [ ] Verification edges are present and read by the gate: a Task at `done` has a connected approved **Review** and a connected passing **QA Result**.
- [ ] Soft edges have **both endpoints set** and **resolve**; any dangling reference is repaired.
- [ ] Repository **impact edges** are derived from a real snapshot diff, with affected areas and roles recorded.
- [ ] Every Memory Record produced carries a **provenance** `source`.
- [ ] Designed-but-unbuilt connections (Incident/Decision nodes, task dependencies) are **not** assumed by any logic as if they ship today.

---

## 15. Relationship to Other Documents

- [Domain Model](../architecture/DOMAIN_MODEL.md) — the authoritative definition of every node this document connects, including the cardinality reference.
- [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) — module boundaries, the [Data Ownership Rules](../architecture/TECHNICAL_ARCHITECTURE.md#6-data-ownership-rules) that decide who owns each edge, the [Memory Boundary](../architecture/TECHNICAL_ARCHITECTURE.md#410-memory-boundary), and the [Context Builder](../architecture/TECHNICAL_ARCHITECTURE.md#420-context-builder) that traverses these edges.
- [Company Memory](./COMPANY_MEMORY.md), [Employee Memory](./EMPLOYEE_MEMORY.md), [Repository Knowledge](./REPOSITORY_KNOWLEDGE.md) — the memory-layer peers that own the *contents* of each scope; this document owns the *edges between* scopes and should not duplicate their rules.
- [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md) and [Knowledge Library System](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md) — the canonical memory and knowledge systems whose records this graph connects.
- [Repository Analysis Snapshots](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md), [Repository Snapshot Comparison](../architecture/REPOSITORY_SNAPSHOT_COMPARISON.md), [Repository Impact Analysis](../architecture/REPOSITORY_IMPACT_ANALYSIS.md) — the mechanics of the change/impact edges.
- [GitHub Workflow Foundation](../architecture/GITHUB_WORKFLOW_FOUNDATION.md) — the execution path that produces the delivery edges (commit, PR, changed files) and the guardrails restated on every task.
