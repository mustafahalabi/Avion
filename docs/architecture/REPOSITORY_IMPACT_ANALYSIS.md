# Repository Impact Analysis

## Purpose

Answers the question: **What does this change affect, how risky is it, who should care, and what should happen next?**

This service consumes the output of the repository snapshot comparison (MUS-198) and produces a deterministic, typed impact analysis. It classifies changes by area, assigns risk levels, identifies which roles should act, and generates specific, evidence-backed recommendations.

No AI, no external calls, no database access, no filesystem reads. Same input always produces the same output.

---

## Input Model

```typescript
ComparisonOutcome  // from repository-snapshot-comparison.ts
  = SnapshotComparisonResult | SnapshotComparisonError
```

The analyzer consumes all fields from `SnapshotComparisonResult`:

| Field | Used for |
|---|---|
| `prismaModelChanges` | Database impact classification |
| `apiRouteChanges` | API and auth route impact |
| `serverActionChanges` | Server action and auth impact |
| `routeChanges` | Page routing and auth/admin path impact |
| `dependencyChanges` | Dependency and auth library impact |
| `scriptChanges` | Build tooling and CI pipeline impact |
| `testChanges` | QA coverage impact |
| `riskChanges` | Risk delta impact |
| `addedFiles` / `removedFiles` / `changedFiles` | Important file impact, including auth/middleware, package manifest, config, deployment, and layout files |
| `fileSummary.categoryChanges` | Documentation-only detection |
| `limitations` | Passed through to output; drives confidence |
| `hasChanges` | Short-circuits to `none` impact if false |

---

## Output Model

```typescript
ImpactAnalysisResult {
  repositoryId: string
  oldSnapshotId: string
  newSnapshotId: string
  analyzedAt: string                  // caller-injected ISO timestamp
  overallImpactLevel: ImpactLevel     // none | low | medium | high | critical
  affectedAreas: string[]             // sorted unique area labels
  impactItems: ImpactItem[]           // sorted by descending impact level
  affectedRoles: string[]             // sorted unique role names
  qaFocusAreas: string[]              // areas with high/critical items or QA role
  releaseRisks: string[]              // high + critical item descriptions
  recommendedActions: RecommendedAction[]  // sorted by priority then area
  blockingConcerns: string[]          // critical-only items + action
  confidence: ConfidenceLevel         // high | medium | low
  evidence: string[]                  // sorted union of all item evidence
  summary: string
  limitations: string[]               // passed through from comparison
}
```

```typescript
ImpactItem {
  title: string
  description: string
  area: string
  impactLevel: ImpactLevel
  affectedRoles: string[]
  evidence: string[]         // at least one entry always present
  recommendedAction: string
  reason: string
}
```

```typescript
RecommendedAction {
  action: string
  area: string
  priority: ActionPriority   // blocking | high | medium | low
  assignedRoles: string[]
  evidence: string[]         // at least one entry always present
}
```

On error input, the analyzer returns `ImpactAnalysisError`:

```typescript
ImpactAnalysisError {
  error: true
  reason: string
  repositoryId: string | null
  oldSnapshotId: string | null
  newSnapshotId: string | null
  analyzedAt: string
}
```

---

## Classification Rules

### Auth / Security (critical)

Triggers when any of the following is detected:

- API routes added/removed matching auth path patterns (`/auth/`, `/login`, `/logout`, `/signin`, `/signup`, `/sign-in`, `/sign-up`, `sign-in`, `sign-up`, Clerk catch-all segments such as `[[...sign-in]]` and `[[...sign-up]]`, `/register`, `/oauth/`, `/sso/`, `/callback`, `/token/`, `/session/`)
- Server actions added/removed with auth-sensitive path patterns (`/actions/auth/`, `login`, `logout`, `signin`, `signup`, `sign-in`, `sign-up`, `register`, `password`, `credential`, `session`)
- Admin routes added/removed matching admin path patterns (`/admin/`, `/superadmin`)
- Auth library dependencies changed (next-auth, @auth/core, @clerk/nextjs, lucia, better-auth, passport, jsonwebtoken, bcrypt, bcryptjs, argon2, iron-session, etc.)
- Auth/middleware config files added/removed as important files (`middleware.ts`, `proxy.ts`, `auth.ts`, `auth.config.*`)
- New security-category risk findings

### Database / Prisma (critical for removal, high for addition)

- Prisma model added → `high` (migration + compatibility review required)
- Prisma model removed → `critical` (potential data loss; release block warranted)

### API Routes (high, or critical if auth-related)

- Non-auth API route added or removed → `high`
- Auth-related API route added or removed → `critical`

### Server Actions (high, or critical if auth-related)

- Non-auth server action added or removed → `high`
- Auth-related server action added or removed → `critical`

### Routing / Pages (medium, or critical if auth/admin)

- Regular page route added or removed → `medium`
- Route type changed → `medium`
- Auth/admin page route added or removed → `critical`

### Dependencies (critical for auth libs, medium for prod, low for dev)

- Auth library dependency changed → `critical`
- Production dependency added or removed → `medium`
- Dev dependency added or removed → `low`

### Build / Scripts (high for build/dev changes or CI script removal, medium for CI script changes)

- `build` or `dev` script changed → `high`
- `test`, `lint`, `typecheck` script changed → `medium`
- Any CI script removed → `high`

### Important Files (deterministic file impact)

Important files always produce evidence-backed impact items when added, removed, or present in `changedFiles`:

- Package manifest (`package.json`) → `high` dependencies impact with build/release and supply-chain review
- TypeScript config (`tsconfig.json`, `tsconfig.*.json`) → `medium` build impact
- Next.js config (`next.config.*`) → `high` build impact and release risk
- Lint config (`eslint.config.*`, `.eslintrc*`) → `medium` build impact
- Test config (`vitest.config.*`, `jest.config.*`, `playwright.config.*`, `cypress.config.*`) → `medium` tests impact
- Build/deployment config (`.github/workflows/*.yml`, `Dockerfile`, `vercel.json`, `netlify.toml`, `docker-compose.yml`, `turbo.json`) → `high` deployment impact and release risk
- App Router layouts (`app/**/layout.*`, `src/app/**/layout.*`) → `high` routing impact and release risk
- Middleware/proxy/auth config (`middleware.*`, `proxy.*`, `auth.ts`, `auth.config.*`) → `critical` auth/security impact

### Tests (high for removal, low for addition)

- Test files removed → `high` (coverage gap; release block until reviewed)
- Test files added → `low`

### Risks (critical for security risks, high for high-severity, medium for others)

- New `security` category risk → `critical`
- New high-severity non-security risk → `high`
- New medium/low severity risk → `medium`
- Resolved risks → `low` (positive signal, verify genuineness)

### Documentation (low)

Detected when: only `doc` category changes in `fileSummary.categoryChanges`, no functional areas affected, no added/removed important files.

---

## Impact Levels

| Level | Meaning |
|---|---|
| `none` | No changes detected |
| `low` | Documentation-only changes, test additions, resolved risks, dev deps |
| `medium` | Route changes, config changes, new prod dependencies, low/medium risks |
| `high` | API route changes, server action changes, Prisma model additions, test removals, build script changes |
| `critical` | Auth/security changes, Prisma model removals, database data-loss risk, security risks |

The `overallImpactLevel` is the maximum level across all impact items.

---

## Affected Roles

| Role | When involved |
|---|---|
| CTO | Critical impact items, database removals, high-severity architectural risks |
| Backend Engineer | API routes, server actions, database, dependencies, scripts |
| Security Engineer | Auth changes, auth dependencies, security risk findings |
| QA Engineer | API routes, server actions, test changes, routing, risk findings |
| Engineering Manager | Test removals (coverage gap review) |
| DevOps | Dependency changes, build/CI script changes |
| Release Manager | API route removals, database changes, build script changes |

---

## Evidence Requirements

Every impact item and recommended action must cite at least one evidence string derived directly from the comparison result. Evidence forms used:

- `Prisma model added: ModelName`
- `Prisma model removed: ModelName`
- `API route added: path`
- `API route removed: path`
- `Auth API route added: path`
- `Auth server action added: path`
- `Route added: path (type)`
- `Auth/admin route added: path (type)`
- `Dependency added: package`
- `Auth dependency added: package`
- `Dev dependency added: package`
- `Script changed: name (oldValue: ..., newValue: ...)`
- `Script removed: name (was: ...)`
- `Test file removed: path`
- `Test file added: path`
- `New risk (severity/category): description`
- `Resolved risk (severity/category): description`
- `Auth/config file added: path`
- `Auth/config file changed: path`
- `Package manifest changed: path`
- `TypeScript config changed: path`
- `Next.js config changed: path`
- `Lint config changed: path`
- `Test config changed: path`
- `Build/deployment config changed: path`
- `App layout changed: path`
- `File category change: doc (old: N, new: M, delta: D)`

Items with no evidence are excluded from `recommendedActions`.

---

## Confidence

| Level | Condition |
|---|---|
| `high` | No version mismatch; ≤6 limitations |
| `medium` | Analyzer version mismatch between snapshots, or >6 limitations |
| `low` | (Reserved for future use) |

---

## Determinism Rules

- Same input → same output, always.
- No `Date.now()` inside pure logic. Caller must inject `analyzedAt`.
- No random IDs.
- Arrays are sorted: impact items by descending level then area; roles alphabetically; evidence alphabetically; recommended actions by priority then area.
- Input is never mutated.

---

## Failure Handling

| Input | Behavior |
|---|---|
| `SnapshotComparisonError` | Returns `ImpactAnalysisError` with original reason |
| `hasChanges: false` | Returns `none` impact, empty items |
| Documentation-only changes | Returns `low` impact via fast path |
| Missing comparison fields | Defaults top-level and nested change groups, arrays, `fileSummary.categoryChanges`, affected areas, evidence, and limitations to empty values (safe fallback). Appends a limitation noting which partial fields were normalized, because impact may be understated for areas without comparison data. |
| Version mismatch in comparison | Passed through to limitations; confidence set to `medium` |

---

## Limitations

The following limitations are inherited from the snapshot comparison layer:

- Dependency **version** changes are not detectable — only package names are compared.
- Prisma model **field-level** changes are not detectable — only model names are compared.
- **File content** changes are not detectable — snapshots store path lists, not hashes.
- Individual non-important file changes are not tracked.
- Route evidence strings are excluded from change detection.

Additional impact analysis limitations:

- Auth path detection is pattern-based. Paths that do not follow naming conventions may be misclassified.
- Auth library detection covers known packages only. Custom auth implementations are not detected.
- Documentation-only detection requires all changes to be in the `doc` category with no functional changes. Mixed changes are classified functionally.
- Partial comparison inputs are accepted defensively. Missing nested sections are treated as empty and reported in `limitations`, so the analyzer stays available but may understate impact for omitted sections.

---

## Future: Company Intelligence Integration

When Company Intelligence is implemented, the impact analysis output will be used to:

1. **Notify affected roles** — trigger notifications to specific employees based on `affectedRoles` and their actual job assignments.
2. **Auto-create work items** — convert `recommendedActions` into work records for the appropriate team members.
3. **Flag blocking concerns** — surface `blockingConcerns` on the release dashboard and flag the responsible Release Manager.
4. **Track QA focus** — populate QA Engineer work queues with `qaFocusAreas` for each release cycle.
5. **Compute team risk exposure** — aggregate `releaseRisks` across repositories for CTO-level dashboards.

The `analyzeRepositoryImpact` function is intentionally kept pure and role-agnostic so that Company Intelligence can map roles to real employees at the point of consumption.
