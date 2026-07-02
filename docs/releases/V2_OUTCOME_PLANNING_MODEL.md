# Engineering OS V2 — Outcome Planning Data Model

## Design Decision

MUS-139 adds first-class `Outcome` and `PlanningDraft` models instead of extending `RuntimeRequest`.

`RuntimeRequest` remains the intake and communication artifact. `Outcome` is the durable business-value unit from the Operations Engine specification: it preserves CEO intent and explains why work exists. `PlanningDraft` is the pre-work approval artifact: it can hold generated scope, risks, assignments, review, QA, and release strategy before any `Project`, `Feature`, `Task`, `Review`, `QAResult`, or `Release` rows are created.

This avoids overloading request status with planning semantics and keeps the future approval/apply flow explicit.

## Lifecycle

Outcome lifecycle:

```text
proposed -> analyzing -> needs_clarification -> planned -> awaiting_approval -> approved
approved -> in_delivery -> validating -> releasing -> released -> completed -> archived
```

Alternative terminal states:

```text
cancelled | rejected | deferred | failed | superseded
```

Planning draft lifecycle:

```text
draft -> reviewing -> approved -> applied
draft -> reviewing -> rejected
draft -> failed
approved -> failed
```

Rules:

- A CEO intake creates a `RuntimeRequest` and a `proposed` `Outcome`.
- A plan can be represented as `PlanningDraft` while no real work exists.
- `draft`, `reviewing`, `rejected`, and `failed` plans must not create work.
- `approved` means the plan has authority to be applied, not that work already exists.
- `applied` means the approved plan has created real work records.
- `approvedAt`, `approvedById`, `appliedAt`, and `appliedById` record the approval/apply boundary.
- Generated work records must use deterministic `planItemId` values and the unique `(planningDraftId, planItemId)` keys for idempotent application.
- `generationError` records plan generation failures.
- `applicationError` records failures while applying an approved plan.

## Models

`Outcome` is company-scoped and optionally linked one-to-one to `RuntimeRequest`. It stores raw CEO request text, brief/business context, success criteria, constraints, priority, owner role, status, and failure/completion metadata.

`PlanningDraft` is company-scoped and belongs to one `Outcome`. It stores versioned plan data as JSON strings (in PostgreSQL text columns; a carry-over from the SQLite era — see V2-I-003 in the V2 backlog):

- `scope`
- `nonScope`
- `assumptions`
- `risks`
- `dependencies`
- `recommendedAssignments`
- `generatedProjects`
- `generatedFeatures`
- `generatedTasks`
- `reviewPlan`
- `qaPlan`
- `releasePlan`

Actual work records now include optional traceability links:

- `Project.companyId`, `Project.outcomeId`, `Project.planningDraftId`, `Project.planItemId`
- `Feature.companyId`, `Feature.outcomeId`, `Feature.planningDraftId`, `Feature.planItemId`
- `Task.companyId`, `Task.outcomeId`, `Task.planningDraftId`, `Task.planItemId`
- `Review.companyId`, `Review.outcomeId`, `Review.planningDraftId`, `Review.planItemId`
- `QAResult.companyId`, `QAResult.outcomeId`, `QAResult.planningDraftId`, `QAResult.planItemId`
- `Release.companyId`, `Release.outcomeId`, `Release.planningDraftId`, `Release.planItemId`

## Ownership Model

Company ownership is explicit on `Outcome`, `PlanningDraft`, `Project`, `Feature`, `Task`, `Review`, `QAResult`, and `Release`.

The database enforces company ownership for trace links with composite foreign keys. Work rows reference outcomes and planning drafts through `(companyId, outcomeId)` and `(companyId, planningDraftId)`, so a row cannot point at an outcome or plan from another company. `PlanningDraft` also references `Outcome` through `(companyId, outcomeId)`, and `Outcome` references `RuntimeRequest` through `(companyId, runtimeRequestId)`.

Project and feature ownership is required. The migration backfills `Project.companyId` from its workspace and `Feature.companyId` from its project before making both columns non-nullable. `Project.workspaceId`, `Feature.projectId`, `Task.projectId`, `Task.featureId`, and `Task.assigneeId` use company-scoped composite relations where the related model has a company owner.

The relational schema does not enforce polymorphic `entityType`/`entityId` ownership on `Review` and `QAResult` (a polymorphic reference cannot be a foreign key), and `Release.taskIds` remains a JSON array until the deferred `ReleaseTask` join table work. Current server actions validate linked task ownership before creating or mutating those rows, and `assertWorkEntityBelongsToCompany()` exists as the shared helper for future generated-work code.

## Idempotency Model

An approved planning draft can be applied safely by treating `PlanningDraft.id` plus a deterministic `planItemId` as the source identity for every generated work row. `Project`, `Feature`, `Task`, `Review`, `QAResult`, and `Release` each have a unique `(planningDraftId, planItemId)` constraint.

Future apply logic must generate stable item IDs from the plan payload, call `buildGeneratedWorkTraceData()`, and upsert generated rows by the corresponding compound unique key. If the same approved plan is applied twice, the second pass resolves the same source keys instead of inserting duplicate projects, features, tasks, reviews, QA records, or releases.

`PlanningDraft.appliedAt` and `PlanningDraft.appliedById` record that an apply pass completed, but idempotency does not depend on that flag alone. The row-level unique source keys are the model-level protection against duplicate work.

## Deterministic Planning Generator

MUS-140 adds the first deterministic planning generator. It runs after CEO intake creates or finds an `Outcome`, and it stores an approval-ready `PlanningDraft` version `1`.

The generator deliberately does not call Claude, OpenAI, or any external AI API. It uses deterministic templates, keyword matching, attached repository metadata, existing company employees and roles, and the Operations Engine planning invariants.

Successful generation stores:

- Project name and description.
- Milestones nested inside `generatedProjects`.
- Generated feature instructions.
- Generated task instructions with deterministic `planItemId` values.
- Role and employee assignment recommendations.
- Dependencies, risks, assumptions, CEO questions, acceptance criteria, and estimated execution order.
- Review, QA, and release plans.

Generation failure stores a `failed` `PlanningDraft` with `generationError` and focused CEO questions. Empty, too-short, ambiguous, and unsupported outcomes fail before any work generation instructions are produced.

Runtime and timeline events record:

- `outcome.submitted`
- `plan.generated`
- `plan.approved`
- `plan.rejected`
- `work.created`
- `plan.failed`

These events describe planning and work creation boundaries only; they must not imply autonomous agent execution, review automation, or QA automation has started.

## Dashboard and Traceability (MUS-143)

The CEO dashboard surfaces:

- **Plans Awaiting Review** for `draft` and `reviewing` planning drafts.
- **Recently Approved Plans** for approved drafts awaiting apply.
- **Outcome Planning Activity** from `TimelineEntry` records.

Generated work (`Project`, `Feature`, `Task`) includes optional `outcomeId` and `planningDraftId` trace fields. Project detail pages show a trace banner linking back to the originating outcome when those fields are present.

Manual QA coverage lives in `docs/qa/OUTCOME_PLANNING_SMOKE_CHECKLIST.md`.

## Rejected Plan Invariant

Rejected and failed drafts must never create work. The database can enforce company-scoped references, but it cannot express a conditional foreign key that only allows `PlanningDraft.status IN ('approved', 'applied')`.

Server-side apply code must call `assertPlanningDraftCanCreateWork()` before creating traced work. The helper rejects `rejected`, `failed`, unapproved, and never-approved drafts. Combined with the lifecycle timestamps, this keeps rejected plans as historical planning artifacts only.

## Deferred Work

MUS-140 does not call external AI planning providers. Linear/GitHub automation and autonomous execution providers remain out of scope for the planning slice. Dedicated plan review pages may ship in adjacent tickets once merged to `master`.
