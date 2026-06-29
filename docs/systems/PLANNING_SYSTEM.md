# Planning System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** Product Manager  
**Last Updated:** 2026-06-29  

The Planning System defines how a CEO outcome becomes a scoped, reviewable plan — projects, milestones, features, acceptance criteria, risks, dependencies, and execution-ready tasks — before any implementation work exists. It is the bridge between intake (a CEO stating what they want) and execution (the company building it).

This document describes company behavior and the system that implements it. Where it describes software that exists today, it is grounded in the codebase and labeled **Implemented today**. Where it describes behavior the organization intends but has not yet built, it is labeled **Designed / planned**. The distinction is load-bearing: Engineering OS does not fabricate planning intelligence, and the planner is deliberately deterministic until the canonical specification gates real-AI planning.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Core Concepts](#3-core-concepts)
4. [Planning Before Implementation](#4-planning-before-implementation)
5. [Planning Lifecycle](#5-planning-lifecycle)
6. [Inputs](#6-inputs)
7. [Outputs — The Plan Artifact](#7-outputs--the-plan-artifact)
8. [Plan Item Anatomy](#8-plan-item-anatomy)
9. [What Makes a Plan Ready for Execution](#9-what-makes-a-plan-ready-for-execution)
10. [Ownership and Participants](#10-ownership-and-participants)
11. [Decision Points](#11-decision-points)
12. [Artifacts and Persistence](#12-artifacts-and-persistence)
13. [Timeline and Memory Updates](#13-timeline-and-memory-updates)
14. [Failure Modes](#14-failure-modes)
15. [Implemented Today vs. Designed / Planned](#15-implemented-today-vs-designed--planned)
16. [Relationship to Other Documents](#16-relationship-to-other-documents)

---

## 1. Purpose

The Planning System exists to answer one question with a reviewable artifact: **"If the company pursued this outcome, exactly what work would it do, in what order, owned by whom, and how would we know it is done?"**

It produces that answer *before* the company creates a single unit of real work. Planning is the deliberate gap between a CEO's intent and the company's commitment of effort. That gap is where scope is bounded, risk is surfaced, dependencies are made explicit, acceptance criteria are written, and the CEO gets a chance to approve, redirect, or reject — all at zero implementation cost.

The Planning System has three responsibilities:

1. **Translate intent into structure.** Take a free-text CEO outcome and produce a structured plan with projects, milestones, features, tasks, risks, dependencies, and acceptance criteria.
2. **Preserve a hard boundary.** Generated plan content lives in a draft and never masquerades as committed work. No `Project`, `Feature`, or `Task` record is created until the CEO approves and the plan is applied.
3. **Make the plan reviewable and traceable.** Every generated item is durable, inspectable, and linked back to the originating outcome and draft, so approval, rejection, and application are auditable.

---

## 2. Scope

**In scope:**

- Capturing a CEO outcome as a durable record.
- Generating a deterministic, reviewable planning draft from that outcome plus available company and repository context.
- Validating that an outcome is specific enough to plan, and that a generated plan meets execution-readiness thresholds.
- The plan review, approval, rejection, and application lifecycle.
- Recommending roles and (where staffed) specific employees for generated work.
- Recording planning lifecycle events on the company timeline.

**Out of scope (owned elsewhere):**

- Implementation, code review, QA validation, and release — these begin only after a plan is applied and are owned by the execution and quality systems. See [Company Runtime](../architecture/COMPANY_RUNTIME.md), [New Feature SOP](../sops/NEW_FEATURE.md), [Code Review SOP](../sops/CODE_REVIEW.md), [QA Validation SOP](../sops/QA_VALIDATION.md), and [Release SOP](../sops/RELEASE.md).
- Repository analysis itself. The Planning System *consumes* repository intelligence as input; it does not produce it. See the repository analysis architecture docs.
- The objects' downstream lifecycle. The [Domain Model](../architecture/DOMAIN_MODEL.md) defines what a `Project`, `Feature`, and `Task` are and how they behave after creation.

---

## 3. Core Concepts

| Concept | Definition |
|---|---|
| **Outcome** | A durable record of what the CEO wants. Free-text title plus a longer raw request, an optional repository scope, and a priority. It carries no generated work until a draft is produced. |
| **Planning Draft** | The reviewable plan generated from an outcome. Holds scope, non-scope, assumptions, risks, dependencies, recommended assignments, generated projects/features/tasks, and the review/QA/release plans — all as draft content, never as live work. |
| **Generated work** | The projects, features, and tasks *described inside* a draft. These are plain data until application. They are not `Project`/`Feature`/`Task` rows. |
| **Plan item ID** | A deterministic, stable identifier for each generated item (e.g. `project:repository-intelligence`, `task:detect-package-manager`). It is the key that makes application idempotent and traceable. |
| **Work trace** | The set of columns (`companyId`, `outcomeId`, `planningDraftId`, `planItemId`) written onto every created work record so it can be traced back to the exact plan item that produced it. |
| **Template** | A deterministic blueprint selected by keyword match against the outcome (repository-intelligence, security, performance, documentation, or a general-engineering fallback). The template decides the project shape, features, tasks, and role mix. |
| **Generator version** | A version tag stamped on every draft (currently `deterministic-v2`) so the planning approach that produced a draft is always known. |

---

## 4. Planning Before Implementation

Planning before implementation is the central discipline of this system. The company never starts building from a free-text request. It first produces a plan, and the plan must clear a quality bar and (per autonomy level) a CEO approval gate before any real work record can exist.

This is enforced structurally, not by convention:

- **Generation creates no work.** Producing a draft writes exactly one `PlanningDraft` row and timeline events. It does not create `Project`, `Feature`, `Task`, `Review`, `QAResult`, or `Release` records. Every draft explicitly carries this in its non-scope.
- **Application is gated on approval.** Work records are created only by the apply step, and the apply step refuses to run unless the draft is `approved` (or already `applied`) with an approval timestamp on record. A rejected or failed draft can never create work.
- **The boundary is visible to the CEO.** Timeline summaries for generation say plainly: *"Planning draft generated … No work records were created."*

This is why planning is currently **deterministic and templated rather than AI-driven**. Real-AI planning is intentionally deferred until the company, repository, and decision models are formally specified. Generating fake plan intelligence would violate a hard project rule, so the system produces honest, reproducible structure instead.

---

## 5. Planning Lifecycle

A plan moves through a small, explicit set of states. Two records track it in parallel: the **Outcome** (the CEO-facing intent) and the **Planning Draft** (the plan itself).

**Planning draft statuses (Implemented today):** `draft` → `reviewing` → `approved` → `applied`, with terminal branches `rejected` and `failed`.

**Outcome statuses relevant to planning:** `proposed` → `planned` → `approved` → `in_delivery`, with `needs_clarification` when generation fails.

```
CEO submits outcome
  ↓  (Outcome: proposed)
Generate planning draft
  ↓
  ├── success → PlanningDraft: draft        Outcome: planned
  └── failure → PlanningDraft: failed        Outcome: needs_clarification
                (open CEO questions recorded; no work)
  ↓  (CEO reviews the draft)
Approve ──────────────► PlanningDraft: approved   Outcome: approved
  │
Reject  ──────────────► PlanningDraft: rejected   Outcome: rejected
                        (no work records created)
  ↓  (apply approved plan)
Apply ────────────────► PlanningDraft: applied    Outcome: in_delivery
                        (Project / Feature / Task records created)
```

**Lifecycle rules:**

- **Generation is idempotent per outcome.** A draft is keyed by `(companyId, outcomeId, version)`. Re-triggering generation for an outcome that already has a non-failed draft returns the existing draft rather than producing a duplicate.
- **Approve, reject, and apply are all idempotent.** Approving an already-approved draft, rejecting an already-rejected draft, or applying an already-applied draft returns the current state without error or duplication.
- **Status transitions are guarded.** An approved draft cannot be rejected; a rejected or failed draft cannot be approved; only an approved (or applied) draft can create work.
- **Failure is a first-class outcome, not an error.** When an outcome is too vague to plan, the system records a `failed` draft with focused CEO questions and moves the outcome to `needs_clarification`. This is the system working as intended.

---

## 6. Inputs

Generation assembles its inputs from company-scoped context. The CEO supplies only the outcome; everything else the system gathers on its behalf.

| Input | Source | Role in planning |
|---|---|---|
| **Outcome title and raw request** | CEO intake (outcome form or a runtime request) | The intent being planned; drives validation and template selection. |
| **Brief / business value** | Outcome record (optional) | Enriches the generated project description. |
| **Success criteria and constraints** | Outcome record (optional, JSON) | Seed acceptance criteria and CEO questions. |
| **Active employees** | Company employees (role, title, responsibilities) | The assignment pool for role and owner recommendations. |
| **Connected repositories** | Company workspaces' repositories | Stack, frameworks, dependencies, important files, analysis status, and latest change-intelligence summary — used to keep generated tasks concrete and to flag context gaps. |

Repository context is referenced, not regenerated. When repository metadata is missing, the planner does not guess — it records the gap as an assumption, a dependency, and an open CEO question, and raises the severity of the "incomplete context" risk.

---

## 7. Outputs — The Plan Artifact

A successful generation produces a single planning draft containing the full plan. Its structure (Implemented today):

| Section | Contents |
|---|---|
| **Title & summary** | Project name plus a one-paragraph summary stating the outcome, feature/task counts, and repository context. |
| **Scope / non-scope** | What the plan will and will not do. Non-scope always reasserts the no-work-before-approval boundary. |
| **Assumptions** | Explicit planning assumptions, including repository freshness or absence. |
| **Risks** | Severity-rated risks with mitigation and an owner role (e.g. premature work creation, incomplete context, overconfident detection). |
| **Dependencies** | Typed dependencies (product, technical, repository, data, security, release, approval) with what they block and a required-before order. A CEO-approval dependency is always present. |
| **Recommended assignments** | Per-role groupings of tasks, resolved to a specific employee where one is staffed, otherwise left as a role recommendation. |
| **Generated projects** | One project with nested milestones and acceptance criteria. |
| **Generated features** | Features under the project, each with description, owner role, dependencies, risks, acceptance criteria, QA expectations, and release relevance. |
| **Generated tasks** | Execution-ready tasks under features, each with description, recommended role, dependencies, acceptance criteria, definition of done, required context, review requirements, QA impact, execution order, and an estimate. |
| **Review / QA / release plans** | The quality and delivery strategy: required reviewers and checkpoints, QA checks and evidence, release readiness criteria, rollout steps, and a rollback plan. |
| **Open CEO questions** | Focused questions the CEO should answer before or during approval (deadline, exclusions, repository source of truth, priorities). |
| **Acceptance criteria** | Project-level criteria that define what "done" means for the whole plan. |
| **Estimated execution order** | The deterministic ordering of generated tasks. |

A failed generation produces a `failed` draft carrying the failure reason and the open CEO questions, and nothing else.

---

## 8. Plan Item Anatomy

Generated work is a strict hierarchy: **Project → Feature → Task**, with milestones grouping features inside the project.

- **Project.** One per plan. Named from the CEO's wording (or a template noun), owned by the Product Manager role by default, and carrying the milestones and top-level acceptance criteria.
- **Milestone.** A meaningful delivery boundary with its own deliverables and acceptance criteria (e.g. "Repository discovery model complete"). Milestones express *order of value*, not a task list.
- **Feature.** A coherent body of work under a milestone, with its own owner role, dependencies on prior features, risks, acceptance criteria, and QA expectations.
- **Task.** The execution-ready unit. Each task is sized with an estimate and carries everything an implementer needs: a concrete description, at least two acceptance criteria, a definition of done, the required context (source outcome/draft IDs, repository metadata, ownership and idempotency invariants), explicit review requirements, and a QA impact statement. When a repository is attached, tasks are enriched with detected stack context, specific files to inspect, and repository validation commands.

Every item carries a stable `planItemId`. On application, that ID becomes the work record's trace key, so re-applying a plan updates the same records instead of duplicating them, and any created `Project`/`Feature`/`Task` can always be traced back to the plan item — and the outcome — that produced it.

---

## 9. What Makes a Plan Ready for Execution

A plan is **ready for execution** when two independent conditions hold: it passes the deterministic quality bar, and the CEO (or the autonomy policy on the CEO's behalf) has approved it.

### 9.1 Quality bar (Implemented today)

Generation validates the outcome up front and the draft against execution-readiness thresholds. A plan is not considered execution-ready unless all of the following hold:

| Requirement | Threshold |
|---|---|
| At least one generated project | required |
| Every project has milestones, and every milestone has acceptance criteria | required |
| At least one generated feature, each with acceptance criteria and an owner role | required |
| At least one generated task | required |
| Each task description is substantive | ≥ 48 characters |
| Each task has acceptance criteria | ≥ 2 criteria |
| Each task has a recommended role, a definition of done, and required context | required |
| Risks, dependencies, and assumptions are present | each non-empty |
| Open CEO questions are present | non-empty |
| Review plan has checkpoints; QA plan has required checks; release plan has readiness criteria | each non-empty |

These thresholds exist so that an implementer — human or agent — receives enough context to start without re-deriving scope, and so that QA can trace every test back to an explicit acceptance criterion.

### 9.2 Outcome admissibility (Implemented today)

Before any structure is generated, the outcome must be plannable. Generation fails fast (and asks the CEO focused questions) when the outcome is empty, too short, vague (e.g. "make it better", "fix it"), or outside the supported software/product/infrastructure/documentation scope.

### 9.3 Approval gate

Quality alone does not authorize execution. The plan must be approved before it is applied. Per the [Company Runtime](../architecture/COMPANY_RUNTIME.md) autonomy model, approval is an explicit CEO action at lower autonomy levels and is delegated at higher ones — but the gate itself is never skipped. Application is structurally blocked until approval is recorded.

---

## 10. Ownership and Participants

The Planning System is owned by the **Product Manager** role: planning is product work, and the generated project defaults to Product Manager ownership. Other roles participate at defined points. (Today, role participation is expressed in the *content* of the plan — owner roles, recommended reviewers, QA owners — and is realized as live collaboration once work is applied and execution begins.)

| Role | Participation in planning |
|---|---|
| **Product Manager** | Owns the outcome and the plan. Owns the generated project, the scope/non-scope boundary, acceptance criteria, and the "incomplete context" risk. Owns clarification when an outcome cannot be planned. |
| **CTO** | Confirms feasibility and owns the approval of the technical direction at higher autonomy levels. Final authority for risk acceptance and scope conflicts (see [Company Runtime](../architecture/COMPANY_RUNTIME.md) §15–16). |
| **Tech Lead** | Owns the technical design and implementation-path milestones, task decomposition, dependency sequencing, and the "premature work creation" risk. Recommended as a required reviewer of generated work. |
| **QA Engineer** | Owns the QA plan: required checks, evidence, and the quality/release-readiness milestone. Validates against acceptance criteria, not against what was built. |
| **Reviewer** | Owns the review plan checkpoints and verifies that every generated item traces to its outcome and draft and that the draft-only boundary is intact. |
| **Technical Writer** | Owns documentation features and release communication in plans that produce user-facing or knowledge-facing change; confirms documentation readiness as a release gate. |

The CEO's only required interaction with this system is submitting the outcome and acting on the approval gate. The CEO does not write tasks, choose owners, or sequence work.

---

## 11. Decision Points

| Decision | When | Who decides | Effect |
|---|---|---|---|
| **Is this outcome plannable?** | At generation | The validator | A plannable outcome yields a draft; an unplannable one yields a `failed` draft with CEO questions. |
| **Which template applies?** | At generation | Keyword match on the outcome | Selects the project shape, features, tasks, and role mix. Falls back to general-engineering. |
| **Is there enough repository context?** | At generation | The generator, from attached repositories | Missing context becomes an assumption, a dependency, an open question, and a raised risk severity — never a guess. |
| **Approve or reject the plan?** | At review | CEO (or autonomy policy) | Approve unlocks application; reject closes the plan with no work created. |
| **Apply the approved plan?** | After approval | CEO action / driver | Creates or idempotently updates `Project`/`Feature`/`Task` records and moves the outcome to `in_delivery`. |

---

## 12. Artifacts and Persistence

| Artifact | Persisted as | Notes |
|---|---|---|
| **Outcome** | `Outcome` record | Company-scoped; optionally linked to a runtime request and a repository. |
| **Planning Draft** | `PlanningDraft` record | Holds all plan sections as JSON fields plus lifecycle timestamps and actor IDs for approval, rejection, and application. Unique per `(companyId, outcomeId, version)`. |
| **Applied work** | `Project`, `Feature`, `Task` records | Each carries the work trace (`outcomeId`, `planningDraftId`, `planItemId`) and is created inside a single transaction. |
| **Lifecycle events** | `TimelineEntry` (and `RuntimeEvent` for runtime-originated outcomes) | One per significant planning transition. |

Application is transactional and idempotent: it maps each generated item to a real record by `(planningDraftId, planItemId)`, creating it if absent and updating it if present, then marks the draft `applied`. Tasks inherit a priority derived from their estimate and are assigned to the recommended employee when one is resolved. A draft with malformed work JSON fails application rather than creating partial work.

---

## 13. Timeline and Memory Updates

The Planning System records its lifecycle on the company timeline so the CEO and the company always have a truthful history of how an outcome was planned.

| Event | Emitted when |
|---|---|
| `outcome.submitted` | The CEO submits an outcome. Summary notes that planning has not started. |
| `plan.generated` | A draft is generated. Summary states no work records were created. |
| `plan.failed` | Generation fails. Summary carries the reason and open CEO questions. |
| `plan.approved` | The CEO approves a draft. |
| `plan.rejected` | The CEO rejects a draft. Summary states no work records were created. |
| `work.created` | An approved plan is applied. Summary reports the counts of projects, features, and tasks created. |

These events feed the dashboard's pending-plan and recently-approved views and the unified planning timeline. **Designed / planned:** richer feature-memory and decision-record capture at plan time (per [Company Runtime](../architecture/COMPANY_RUNTIME.md) §22–23) will accrue as the memory system matures; today, durable timeline entries are the system of record for planning history.

---

## 14. Failure Modes

**Vague outcome silently planned.** A request like "make it better" is too ambiguous to plan, but the system produces a confident-looking plan anyway. The CEO approves it and the company builds the wrong thing.

*Guard:* The validator rejects empty, too-short, vague, and out-of-scope outcomes before any structure is generated, and records focused CEO questions instead. There is no path from an unplannable outcome to a draft that looks ready.

**Generated work mistaken for committed work.** A draft's projects, features, and tasks are read as live work, and the company behaves as though execution has started.

*Guard:* Generated items are draft content, not work records. Generation creates no `Project`/`Feature`/`Task` rows, timeline summaries say so explicitly, and application is structurally blocked until approval is recorded.

**Duplicate work on re-application.** A plan is applied twice and the company ends up with duplicate projects and tasks.

*Guard:* Application is idempotent. Records are matched by `(planningDraftId, planItemId)` and updated in place; re-applying reports updated counts, not new duplicates.

**Cross-company leakage.** A draft or work record from one company is applied into another.

*Guard:* Every query is company-scoped, the work trace asserts company ownership on polymorphic links, and unique constraints bind drafts and work to their company and outcome.

**Planning against an unknown repository.** A plan assumes codebase facts that are not actually known.

*Guard:* Missing repository metadata is recorded as an assumption, a dependency, and an open CEO question, and the incomplete-context risk is raised — the planner never invents repository facts.

**Fabricated planning intelligence.** The system claims AI-driven planning it does not perform.

*Guard:* The planner is deterministic and version-stamped (`deterministic-v2`). Drafts state plainly that they are not AI output, and real-AI planning is gated behind the canonical specification.

---

## 15. Implemented Today vs. Designed / Planned

**Implemented today**

- CEO outcome capture (with optional repository scope and priority) and the `outcome.submitted` event.
- Deterministic, version-stamped plan generation with outcome validation, template selection, and repository-aware task enrichment.
- The full plan artifact: scope/non-scope, assumptions, risks, dependencies, recommended assignments, generated projects/milestones/features/tasks, review/QA/release plans, open CEO questions, and acceptance criteria.
- Draft quality validation against execution-readiness thresholds.
- The review → approve / reject → apply lifecycle, all idempotent and company-scoped, with transactional, traceable work creation.
- Planning timeline (and runtime) events and dashboard surfacing of pending and recently approved plans.

Key implementing modules: `src/lib/planning-generator.ts`, `src/lib/planning-draft-service.ts`, `src/lib/plan-application-service.ts`, `src/lib/outcome-planning.ts`, `src/lib/outcome-planning-lifecycle.ts`, `src/lib/planning-review-service.ts`, `src/app/actions/outcomes.ts`, and `src/app/actions/planning.ts`. The `Outcome` and `PlanningDraft` models live in `prisma/schema.prisma`.

**Designed / planned**

- **Real-AI planning.** Generation is deliberately deterministic until the canonical Engineering OS Specification v1.0 defines the company, repository, and decision models that gate real-AI behavior.
- **Plan versioning and revision.** The draft schema carries a `version` field; today only the initial version is generated. Iterative re-planning and plan diffing are designed for later.
- **Goal / Initiative framing.** The richer goal-and-initiative organizing layer described in [Company Runtime](../architecture/COMPANY_RUNTIME.md) §9 is part of the vision; today the implemented hierarchy is Outcome → Plan → Project → Feature → Task.
- **Plan-time memory and decision records.** Automatic feature-memory and decision-record capture at planning time is designed; today durable timeline entries are the system of record.

---

## 16. Relationship to Other Documents

- **[Company Runtime](../architecture/COMPANY_RUNTIME.md)** defines intake, clarification, autonomy gates, and how planning fits the overall work lifecycle. The Planning System implements the planning phase of that runtime.
- **[Domain Model](../architecture/DOMAIN_MODEL.md)** defines the `Outcome`, `Project`, `Feature`, and `Task` objects this system produces and their downstream lifecycle rules.
- **[New Feature SOP](../sops/NEW_FEATURE.md)** is the procedure that takes over once a plan is applied and execution begins.
- **[Code Review SOP](../sops/CODE_REVIEW.md)**, **[QA Validation SOP](../sops/QA_VALIDATION.md)**, and **[Release SOP](../sops/RELEASE.md)** realize the review, QA, and release plans that the Planning System drafts.
- **Employee handbooks** — [Product Manager](../employees/PRODUCT_MANAGER.md), [Tech Lead](../employees/TECH_LEAD.md), [QA Engineer](../employees/QA_ENGINEER.md), [Reviewer](../employees/REVIEWER.md), and [Technical Writer](../employees/TECHNICAL_WRITER.md) — define the responsibilities the planning roles carry.
