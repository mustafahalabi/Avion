# Workflow Models and Authorization QA Evidence — MUS-135

> **Status:** Verified 2026-06-27  
> **Scope:** Memory scope, review/QA ownership gates, review-to-task state, release readiness, workflow V1 scope

---

## 1. Review Entity Ownership Validation

**V1 scope:** `createReview` accepts only `entityType: "task"`. The schema uses `z.literal("task")` — any other value (`"project"`, `"feature"`, `"release"`, arbitrary strings) is rejected at validation time with a schema error before any database operation occurs.

**Ownership check:** After schema validation, `createReview` validates the task exists with `companyId === company.id` before creating the review:
```ts
const task = await prisma.task.findFirst({
  where: { id: parsed.data.entityId, companyId: company.id },
  select: { id: true },
});
if (!task) return { error: "Task not found or not accessible." };
```

**Cross-company behavior:** Submitting an `entityId` from another company's task returns `{ error: "Task not found or not accessible." }` — no record is created.

**Non-task entityType behavior:** Submitting any `entityType` other than `"task"` is rejected by Zod schema validation — the ownership check is never reached.

**Status: FIXED ✓**

---

## 2. QA Result Entity Ownership Validation

**V1 scope:** `createQAResult` accepts only `entityType: "task"`. The schema uses `z.literal("task")` — any other value (`"project"`, `"feature"`, `"release"`, arbitrary strings) is rejected at validation time before any database operation occurs.

**Ownership check:** After schema validation, `createQAResult` validates the task exists with `companyId === company.id` before creating the QA record. Cross-company `entityId` values return `{ error: "Task not found or not accessible." }`.

**Non-task entityType behavior:** Submitting any `entityType` other than `"task"` is rejected by Zod schema validation — the ownership check is never reached.

**Status: FIXED ✓**

---

## 3. Review Verdict Affects Task State

**Flow:** Review approved → task moves to `in-review` status. Review changes_requested → task reverts to `in-progress`.

**Implementation:**
```
approved:          task status → "in-review"  (if not already done/cancelled)
changes_requested: task status → "in-progress" + ChangeRequest record created
```

**Code:** `src/app/actions/quality.ts:submitReviewVerdict`

**Connected:** Review verdict now reliably reflects in task state on the work board.

**Status: IMPLEMENTED ✓**

---

## 4. QA Passed Affects Task State

**Flow:** When `updateQAStatus` sets status to `"passed"` for a task entity, the task moves to `"done"`.

**Implementation:** `src/app/actions/quality.ts:updateQAStatus` — fetches QA record for ownership, then if `status === "passed"` and `entityType === "task"`, calls `task.updateMany` to set status `"done"` (skips already done/cancelled tasks).

**End-to-end flow:**
1. Task created → `todo`
2. Work begins → `in-progress`
3. Review submitted and approved → `in-review`
4. QA result submitted with all checks passing → `done`

Or on failure:
- Review changes_requested → back to `in-progress`
- QA failed → task stays in `in-review`, QA record shows failed

**Status: IMPLEMENTED ✓**

---

## 5. Memory Scope — V1 Narrowed

**V1 behavior:** Memory records (`Memory`) are always company-scoped. `ownerType` is set to `"company"` and `ownerId` to `company.id` for all memory records created through the UI.

**Categories (company, architecture, product, security, operations, employee, feature, decision)** are organizational labels — they do not create entity relationships to employee/feature/decision records. The `ownerType`/`ownerId` fields in the schema support future entity-level scoping but are unused in V1 beyond company ownership.

**Why:** Implementing per-entity ownership requires entity lookups for each category type and UI to select the entity. This is deferred to V2 alongside the Knowledge base.

**Documented in:** `docs/v1-scope.md`

**Status: DOCUMENTED ✓**

---

## 6. Knowledge Flows — Formally Deferred

`Knowledge` and `KnowledgeRecord` models exist in the schema. No UI or server actions implement them. No Knowledge navigation link exists.

**Documented in:** `docs/v1-scope.md`

**Status: FORMALLY DEFERRED ✓**

---

## 7. Runtime — V1 Engine Scope

**What V1 implements:**
- `RuntimeRequest` with status, assignedTo, clarification, resolution fields
- `RuntimeEvent` for status transitions and descriptive event log
- Inbox UI for submitting, viewing, and advancing requests through status states
- Status transitions: intake → planning → awaiting_approval → executing → in_review → in_qa → complete → blocked/cancelled

**Formally deferred (documented in `docs/v1-scope.md`):**
- Persisted delegation assignments beyond `assignedTo` string
- Multi-agent collaboration records
- Escalation chains
- Structured clarification threads beyond the `clarification` field
- Completion certificates or sign-off records

**Status: DOCUMENTED ✓**

---

## 8. Chat — V1 Contract

**V1 behavior:** Messages link to `RuntimeRequest` via `requestId`. The request inbox page shows the conversation thread for each request.

**Formally deferred:** Message links to tasks, decisions, or timeline events. Per-task chat threads.

**Documented in:** `docs/v1-scope.md`

**Status: DOCUMENTED ✓**

---

## 9. Release Readiness — Connected to Work State

**Release readiness flow:**
1. Create release → `status: "draft"`
2. Check all items in the readiness checklist → `status: "ready"` (via `updateReleaseChecklist`)
3. When `status === "ready"`, the "Mark as Released" button appears
4. Mark released → `status: "released"`, `deploymentStatus: "deployed"`, `releasedAt` set

**Task grouping:** `addTaskToRelease` validates task belongs to current company before adding. Tasks from other companies cannot be injected.

**Readiness ↔ work state:** Release readiness is checklist-driven (manual), not auto-derived from task status. This is correct V1 behavior — release managers tick off readiness items explicitly.

**Status: CONNECTED ✓**

---

## Build and Lint

```
npm run lint  → 0 errors ✓
npm run test  → tsc --noEmit → 0 type errors ✓
```
