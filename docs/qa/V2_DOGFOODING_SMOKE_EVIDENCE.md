# V2 Dogfooding Smoke Evidence — Engineering OS Platform v2

> **Status:** Verified 2026-06-28  
> **Ticket:** MUS-171  
> **Scope:** Outcome → plan → work → execution → review → QA → release (master services)

---

## Automated Smoke Test

**Command:**

```bash
npx vitest run src/lib/v2-workflow-dogfood.test.ts
```

**Result:** PASS — 1 test

The automated test exercises the V2 loop using real service modules against a temporary SQLite database:

| Step | Service / action | Verified |
|------|------------------|----------|
| Submit outcome | `Outcome` row created | ✓ |
| Generate plan | `generateDeterministicPlanningDraft` + persist `PlanningDraft` | ✓ |
| Approve plan | `approvePlanningDraft` | ✓ |
| Create work records | `applyApprovedPlan` → Project/Feature/Task | ✓ |
| Implementation brief | `prepareExecutionSession` with task brief | ✓ |
| Record implementation | `recordExecutionResult` + `recordBranchInfo` | ✓ |
| Record review | `recordReviewResult` (approved) → pending QA | ✓ |
| Record QA | QA marked passed; task → `done` | ✓ |
| Release grouping | Manual `Release` row with linked task IDs | ✓ |
| Timeline | Timeline entries created during review | ✓ |

---

## Manual UI Checklist (CEO flow)

Run after merging open V2 PRs for full UI coverage:

1. **Submit outcome** — `/work/outcomes/new`
2. **Generate plan** — outcome detail → generate planning draft
3. **Review & approve plan** — plan review UI (PR #25, MUS-141)
4. **Apply plan** — create work records
5. **Implementation brief** — task detail → prepare execution session
6. **Record execution result** — ingest agent result on task
7. **Record review verdict** — `/work/quality/[reviewId]`
8. **Record QA result** — `/work/quality/qa/[qaId]` (PR #27, MUS-158)
9. **Create release candidate** — `/work/releases/candidate/new` (PR #28, MUS-169)
10. **CEO release summary** — copy summary on release detail (PR #29, MUS-170)

---

## Current Stopping Point (master)

On `master` today, the **service-layer loop completes through review approval and QA pass simulation**. Release candidate creation and CEO summary require merging:

- [PR #27](https://github.com/mustafahalabi/Engineering-os/pull/27) — QA verdict service + UI (MUS-158)
- [PR #28](https://github.com/mustafahalabi/Engineering-os/pull/28) — Release candidate from completed tasks (MUS-169)
- [PR #29](https://github.com/mustafahalabi/Engineering-os/pull/29) — CEO release summary (MUS-170)

Additional UI/runtime wiring on open PRs:

- [PR #25](https://github.com/mustafahalabi/Engineering-os/pull/25) — Plan review & approval UI (MUS-141)
- [PR #26](https://github.com/mustafahalabi/Engineering-os/pull/26) — Outcome planning lifecycle dashboard (MUS-143)

---

## Product Gaps Discovered (follow-up tickets)

| Gap | Recommended follow-up |
|-----|----------------------|
| `createOrUpdatePlanningDraftForOutcome` requires Employee/Repository tables; dogfood test uses direct generator persist | Add integration test harness tables or lazy-empty queries |
| QA pass uses direct DB update in smoke test; no `qa-service` on master | Merge MUS-158 |
| Release candidate uses manual `Release` create; no eligibility gates on master | Merge MUS-169 |
| No CEO copy summary on master | Merge MUS-170 |
| Plan review UI not on master | Merge MUS-141 |
| Outcome lifecycle dashboard events not on master | Merge MUS-143 |
| No single “Run smoke” UI button for CEO | Future: `/work/smoke` orchestration page |
| Open parallel PRs not merged — full UI E2E blocked | Stabilization milestone: merge Review/QA/Release PRs |

---

## Validation Commands (full suite)

```bash
npx prisma validate && npx tsc --noEmit && npm run lint && npm run build && npm run test
```

All tests including `v2-workflow-dogfood.test.ts` must pass before closing MUS-171.
