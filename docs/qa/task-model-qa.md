# Task Model and Planning QA Evidence — MUS-133

> **Status:** Verified 2026-06-27  
> **Scope:** Project task visibility, assignee validation, cross-company authorization, planning/dependency V1 scope

---

## 1. Direct Project Tasks — Canonical Aggregation

**Problem:** All four surfaces previously only counted `project.features[].tasks`, silently dropping direct project tasks (tasks with `featureId = null`, `projectId = set`).

**Fix applied to:**

| Surface | File | Change |
|---|---|---|
| `/work` stats + project cards | `src/app/(app)/work/page.tsx` | Added `tasks` to project include; aggregation now `[...featureTasks, ...project.tasks]` |
| `/work/projects` progress bars | `src/app/(app)/work/projects/page.tsx` | Same — added `tasks` to project include |
| `/dashboard` task stats | `src/app/(app)/dashboard/page.tsx` | Same — `allTasks` now includes direct project tasks |
| Task detail breadcrumb | `src/app/(app)/work/tasks/[id]/page.tsx` | Added `project` relation to task query; breadcrumb prefers `feature.project ?? task.project` |

**Verification:**
- A task created via `createTask` with no `featureId` gets `projectId` set.
- That task now appears in:
  - Project detail page (already correct — uses `project.tasks` where `featureId = null`)
  - `/work` summary stats and project progress bar ✓
  - `/work/projects` progress bar ✓
  - `/dashboard` task stats ✓
  - Task detail breadcrumb links back to the project ✓

**Status: FIXED ✓**

---

## 2. Assignee Cross-Company Injection — Rejected

**Problem:** `createTask` previously wrote `assigneeId` directly without checking if the employee belongs to the current company. An attacker with a valid session could assign tasks to employees from other companies.

**Fix:** `src/app/actions/work.ts` — after validating project and feature ownership:
```ts
if (parsed.data.assigneeId) {
  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.assigneeId, companyId: company.id },
    select: { id: true },
  });
  if (!employee) return { message: "Assignee not found in this company." };
}
```

**Cross-company scenarios handled:**
- Submitting a `projectId` from another company → rejected (project ownership check)
- Submitting a `featureId` from another project → rejected (feature ownership check)
- Submitting an `assigneeId` from another company → rejected (new employee company check)
- Submitting a `taskId` for status update → `updateTaskStatus` uses `updateMany` with `{ id, companyId }` — cross-company no-op

**Status: FIXED ✓**

---

## 3. Global/Orphan Tasks — V1 Behavior

**Decision:** In V1, `Task.projectId` is optional. Tasks can exist without a project (orphan/global tasks). These are company-scoped via `companyId`.

**Behavior:**
- `createTask` requires a `projectId` as a URL parameter (function signature), so all tasks created through the standard UI have a project.
- Direct database inserts could create orphan tasks, but no UI surface creates them without a project.
- Orphan tasks (no projectId, no featureId) appear only in the `/work` Active Tasks list (fetched via `company.tasks`).

**V1 enforcement:** The current `createTask` server action always receives `projectId` — orphan creation via the UI is not possible. This is documented in `docs/v1-scope.md`.

**Status: DOCUMENTED ✓**

---

## 4. Task Dependencies — V1 Deferral

**Decision:** Task-to-task dependencies (blocks/blocked-by) are not implemented in V1.

**Documented in:** `docs/v1-scope.md` — "Dependency model would require a `TaskDependency` join table. Deferred to V2."

**UI truth:** No dependency input, dependency graph, or blocking indicator is rendered in the task UI.

**Status: FORMALLY DEFERRED ✓**

---

## 5. Planning Output/Goals — V1 Scope

**V1 behavior:**
- `Sprint.goal` field exists in the schema for sprint-level goals.
- No sprint planning UI is implemented.
- No planning output or generated plan entity exists.

**Documented in:** `docs/v1-scope.md` — "Sprint planning output and auto-scheduling deferred to V2."

**Status: FORMALLY DEFERRED ✓**

---

## 6. Progress Calculations — Correctness

**Before fix:**
- A project with 3 direct tasks and 0 feature tasks showed 0/0 progress.

**After fix:**
- Same project shows 0/3 progress (or correct done/total based on status).

**Formula:** `done = tasks.filter(t => t.status === "done").length` where `tasks = [...featureTasks, ...directTasks]`.

**Status: FIXED ✓**

---

## Build and Lint

```
npm run lint  → 0 errors ✓
npm run test  → tsc --noEmit → 0 type errors ✓
```
