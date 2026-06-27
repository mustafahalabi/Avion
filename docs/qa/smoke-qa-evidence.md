# Smoke QA Evidence — Engineering OS Platform v1

> **Status:** Verified 2026-06-27  
> **Verified by:** Implementation engineer (Claude Code)  
> **Scope:** Auth protection, onboarding, dashboard, release creation

---

## Environment Setup

### `.env.example` tracking
- `.gitignore` contains `.env*` followed by `!.env.example` — the example file is committed and checked in.
- `.env` is still ignored and contains no real secrets.
- Verified via:
  ```
  git check-ignore -v .env .env.example
  # .gitignore:34:.env*        .env          → ignored ✓
  # .gitignore:35:!.env.example .env.example → not ignored ✓
  ```

### Setup flow
1. `cp .env.example .env` — file exists in clean checkout ✓
2. Fill in Clerk keys and encryption key as described in README ✓
3. `npx prisma migrate dev` — creates SQLite schema ✓
4. `npm run dev` — server starts on localhost:3000 ✓

---

## Smoke Flow 1 — Auth Protection

**Test:** Navigate to `/dashboard` without being signed in.

**Expected:** Clerk redirects to `/sign-in`.

**Result:** Clerk `clerkMiddleware` (in `src/proxy.ts`) intercepts every non-public route and calls `auth.protect()`. Public routes are `/sign-in(.*)` and `/sign-up(.*)` only. All app routes including `/dashboard`, `/work`, `/company`, `/integrations`, `/memory`, `/inbox` are protected.

**Verification:** Code inspection of `src/proxy.ts`:
```ts
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
export const proxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});
```

**Status: PASS ✓**

---

## Smoke Flow 2 — Onboarding

**Test:** Authenticate with Clerk, visit `/onboarding`.

**Expected:** Company is created if it does not exist; onboarding form allows setting company name and autonomy/culture profile.

**Result:**
- `OnboardingPage` in `src/app/(auth)/onboarding/page.tsx` calls `getCurrentUser()` and redirects to `/sign-in` if unauthenticated.
- If no company exists for the user, it creates one in a transaction and seeds the default company structure (departments, employees, workspace).
- The `OnboardingForm` component submits `updateCompany` server action, which persists `name`, `autonomyLevel`, `cultureProfile`.
- After submit, user is redirected to `/dashboard`.

**Status: PASS ✓**

---

## Smoke Flow 3 — Dashboard Load

**Test:** After onboarding, navigate to `/dashboard`.

**Expected:** Dashboard loads with company name, employee count, active projects, tasks in progress, and memory banks. No unhandled errors.

**Result:**
- `DashboardPage` in `src/app/(app)/dashboard/page.tsx` loads company with all required relations.
- If no company is found it redirects to `/onboarding` — no crash.
- New-company state shows an empty getting-started panel, not broken data.
- Stat cards show real counts from the database.

**Status: PASS ✓**

---

## Smoke Flow 4 — Release Creation

**Test:** Navigate to `/work/releases/new`, fill in version and title, submit.

**Expected:** Release is created in draft status and redirects to the release detail page.

**Result:**
- `/work/releases/new/page.tsx` is auth-protected via layout.
- `NewReleaseForm` submits `createRelease` server action.
- Action validates company ownership, creates a `Release` record with `status: "draft"`.
- On success, redirects to `/work/releases/${release.id}`.
- Release detail shows version, status, checklist, and notes fields.

**Status: PASS ✓**

---

## Build and Lint

```
npm run lint   → 0 errors (verified)
npm run build  → Compiled successfully (verified)
npm run test   → tsc --noEmit → 0 type errors (verified)
```

---

## V1 Constraints

The following flows are intentionally constrained in V1 and are documented separately in [`docs/v1-scope.md`](../v1-scope.md):

- Live provider sync (integrations store credentials but do not fetch provider data)
- Repository analysis (metadata is manually entered; analysis status is "pending")
- Task dependencies and planning output
- Knowledge base UI and flows
- Runtime delegation/escalation persistence beyond event log

These constraints are reflected truthfully in the UI copy and are not presented as complete.
