# Employee and Company QA Evidence — MUS-136

> **Status:** Verified 2026-06-27  
> **Scope:** Onboarding/company creation, company overview, employee directory, employee detail, department pages, settings updates, operational fields V1 scope

---

## 1. Onboarding / Company Creation

**Flow:** Authenticated user visits `/onboarding`. Company does not yet exist.

**Expected:** Company is created in a transaction with default settings and seeded structure (departments, employees, workspace). Form shows company name and settings controls. On submit, redirects to `/dashboard`.

**Code evidence:**
- `src/app/(auth)/onboarding/page.tsx` — creates company in `prisma.$transaction` if missing, calls `seedCompanyStructure` to provision departments, employees, workspace.
- `src/app/(auth)/onboarding/actions.ts` — `updateCompany` validates ownership (`company.ownerId === user.id`), persists name, autonomyLevel, cultureProfile.
- On success: `redirect("/dashboard")`.

**Status: PASS ✓**

---

## 2. Company Overview

**Flow:** Navigate to `/company`.

**Expected:** Shows company name, stats (employee count, department count, active/planning projects), department list, and recent activity. No crash on empty state.

**Code evidence:**
- `src/app/(app)/company/page.tsx` — loads company with departments, employees, workspaces. Shows real counts.
- If no company, redirects to `/onboarding`.

**Status: PASS ✓**

---

## 3. Employee Directory — Relational Manager Links

**Problem:** The directory previously showed `emp.reportsTo` as a plain string even when a relational `manager` record existed.

**Fix:** `src/app/(app)/company/employees/page.tsx` — query now includes `manager: { select: { id: true, name: true } }`. Display logic:
1. If `emp.manager` exists → render `<Link href="/company/employees/[manager.id]">{manager.name}</Link>`
2. Else if `emp.reportsTo` string exists → render plain text fallback
3. Else → render nothing

**Status: FIXED ✓**

---

## 4. Employee Detail Page

**Flow:** Navigate to `/company/employees/[id]`.

**Expected:** Shows name, status badge, title/role, manager link (relational), department, responsibilities, bio, workload badge, teammates.

**Code evidence:** `src/app/(app)/company/employees/[id]/page.tsx`:
- Loads `manager: { select: { id: true, name: true } }` relation.
- Manager block: if `emp.manager` → linked `<Link href="/company/employees/[id]">`. Falls back to `emp.reportsTo` string.
- Responsibilities and bio fields rendered when populated.
- Workload badge rendered for non-normal workload.
- Colleagues section links to teammate detail pages.

**Status: PASS ✓**

---

## 5. Department Pages

**Problem:** Department page used `emp.title` for both avatar letter and display name (bug — `name` is the correct field). Employees were not linked to their detail pages.

**Fix:** `src/app/(app)/company/departments/[slug]/page.tsx`:
- Avatar now uses `emp.name[0]`
- Display name now shows `emp.name`
- Role/title shown as subtitle: `emp.role?.name ?? emp.title ?? "—"`
- Each employee card is now a `<Link href="/company/employees/[id]">` — navigates to employee detail

**Status: FIXED ✓**

---

## 6. Settings Updates

**Flow:** Navigate to `/settings`. Update company name, autonomy level, or culture profile. Submit.

**Expected:** Settings persist to database. Page reflects updated values on reload.

**Code evidence:**
- `src/app/(app)/settings/settings-form.tsx` — form submits to `updateCompany` action.
- Action validates company ownership before updating.
- `revalidatePath` called on success.

**Status: PASS ✓**

---

## 7. Employee Operational Fields — V1 Scope

The following fields from the MUS-108 epic are deferred to V2:

| Field | V1 Status |
|---|---|
| `name` | ✅ Implemented — displayed in directory, detail, department pages |
| `title` | ✅ Implemented — shown as subtitle fallback |
| `mission` | ✅ Implemented — shown on detail page when populated |
| `bio` | ✅ Implemented — shown on detail page when populated |
| `responsibilities` | ✅ Implemented — shown on detail page when populated |
| `workload` | ✅ Implemented — badge shown for non-normal workload |
| `status` | ✅ Implemented — badge on directory and detail |
| `managerId` / `manager` | ✅ Implemented — relational link in directory and detail |
| `reportsTo` (string fallback) | ✅ Implemented — fallback when no manager relation |
| `authority` | ⏳ Deferred V2 — not in schema |
| `confidence` | ⏳ Deferred V2 — not in schema |
| `activitySummary` | ⏳ Deferred V2 — not in schema |
| Employee memory references | ⏳ Deferred V2 — memory is company-scoped in V1 |

**UI truth:** No UI implies absent fields exist. The detail page only renders sections that have data.

**Documented in:** `docs/v1-scope.md`

**Status: TRUTHFULLY SCOPED ✓**

---

## 8. Reporting Navigation — Relational Integrity

**Directory:** Manager links use `managerId` → `manager.id` → `/company/employees/[id]` path. No orphan links.

**Detail page:** Manager link uses the same relational chain. Falls back to `reportsTo` string if no manager record.

**Department page:** All employee rows link to `/company/employees/[id]`.

**Status: RELATIONAL WHERE DATA EXISTS ✓**

---

## Build and Lint

```
npm run lint  → 0 errors ✓
npm run test  → tsc --noEmit → 0 type errors ✓
```
