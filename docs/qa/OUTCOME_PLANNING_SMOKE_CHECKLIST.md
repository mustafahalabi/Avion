# Outcome Planning Smoke QA Checklist

Manual smoke checklist for the first Outcome Planning Engine vertical slice in Engineering OS V2.

## Preconditions

- Local app running with a company and CEO user signed in.
- At least one repository connected (optional but recommended for repository-aware plans).

## Flow

### 1. Submit outcome

- [ ] Submit an outcome from `/work/outcomes/new` or a runtime request from `/inbox`.
- [ ] Confirm the outcome detail page shows status `proposed` or `planned`.
- [ ] Confirm a planning lifecycle entry appears for `outcome submitted`.

### 2. Generate plan

- [ ] Click **Generate plan** on the outcome detail page (or submit a runtime request that auto-generates a plan).
- [ ] Confirm a planning draft appears with status `draft`.
- [ ] Confirm copy states execution has **not** started and no work records exist yet.
- [ ] Confirm dashboard **Plans Awaiting Review** lists the outcome/plan.
- [ ] Confirm timeline/dashboard shows `plan generated`.

### 3. Review plan

- [ ] Open the outcome from the dashboard planning section.
- [ ] Confirm scope, projects, features, tasks, risks, and review/QA/release sections are visible when present in the draft.
- [ ] Confirm the UI does **not** claim Claude, Codex, GitHub, review automation, or QA automation is running.

### 4. Reject path (optional branch)

- [ ] Reject the plan with a reason.
- [ ] Confirm outcome status becomes `rejected`.
- [ ] Confirm no projects, features, or tasks were created.
- [ ] Confirm timeline shows `plan rejected`.

### 5. Approve and apply path

- [ ] Generate a fresh plan (or use another outcome).
- [ ] Approve the plan.
- [ ] Confirm dashboard **Recently Approved Plans** lists the plan.
- [ ] Apply the approved plan to create work records.
- [ ] Confirm projects/features/tasks appear under Work.
- [ ] Confirm generated project page shows trace banner back to the originating outcome/plan.
- [ ] Confirm timeline shows `work created`.

## Regression checks

- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm --filter @avion/web test`

## Known limitations (expected)

- Plan review UI on `/work/plans/{id}` may ship in a separate PR; outcome detail remains the fallback review surface until merged.
- External AI planning, Linear/GitHub automation, and autonomous agent execution are **not** part of this slice.
