# Repository Intelligence Slice 2 Dogfood Review

Issue: MUS-199
Date: 2026-06-28
Repository: Engineering OS
Decision: NOT READY

## Executive Summary

Repository Intelligence Slice 2 has a strong deterministic core for comparing repository snapshots and producing role-oriented impact analysis. The impact output can explain many simulated structural changes, assign useful risk levels, identify affected roles, suggest QA focus, and surface release risks.

The full dogfood flow is not ready for Virtual Engineering Team V1 because the persisted snapshot workflow does not exist in the application. The Prisma schema has `Repository`, but no `RepositoryAnalysisSnapshot` model. The UI and server actions only create manually entered repository metadata with `analysisStatus: "pending"`. There is no end-to-end path that analyzes a repository, creates snapshots, persists two snapshots, compares the latest two persisted snapshots, and presents the impact analysis to users.

## Validation Steps

1. Read the current Next.js docs from `node_modules/next/dist/docs/` for App Router pages and Server Actions before reviewing app code.
2. Inspected repository intelligence implementation:
   - `src/lib/repository-analyzer.ts`
   - `src/lib/repository-snapshot-comparison.ts`
   - `src/lib/repository-impact-analysis.ts`
   - `src/app/actions/repository.ts`
   - `src/app/(app)/work/repositories/page.tsx`
   - `src/app/(app)/work/repositories/[id]/page.tsx`
   - `prisma/schema.prisma`
3. Ran the repository analyzer against the real Engineering OS repository.
4. Built in-memory snapshot payloads from the real analyzer output because persisted snapshots are not available.
5. Compared snapshots with `compareSnapshots`.
6. Generated impact analysis with `analyzeRepositoryImpact`.
7. Validated required scenarios using real analyzer output plus safe simulated snapshot deltas.
8. Checked ignored-path handling in analyzer output.
9. Checked determinism by re-running analyzer, comparison, and impact analysis with identical inputs and fixed timestamps.
10. Identified the current safe real repository change: existing uncommitted edits in repository impact analysis files. These are content-only edits to existing files and are not detectable by the current snapshot comparison because snapshots store path lists, not content hashes.

## Baseline Analyzer Output

The analyzer completed successfully against the real repository.

Summary:

- Analyzer version: `1`
- Total files: `222`
- Total directories: `72`
- Primary language: `TypeScript`
- Tech stack: `Clerk`, `Next.js (App Router)`, `Prisma`, `Tailwind CSS`, `Vitest`, `Zod`
- Routes detected: `39`
- API routes detected: `0`
- Server action modules detected: `11`
- Prisma models detected: `34`
- Test files detected:
  - `src/lib/planning-generator.test.ts`
  - `src/lib/repository-impact-analysis.test.ts`
- Important files detected:
  - `next.config.ts`
  - `package.json`
  - `prisma/schema.prisma`
  - `src/app/(app)/layout.tsx`
  - `src/app/layout.tsx`
  - `src/proxy.ts`
  - `tsconfig.json`

Analyzer risk findings:

- Medium testing risk: `2 test files vs 147 source files`
- Low database risk: no Prisma seed file found

Ignored-path check:

- No `node_modules`, `.git`, `.env`, or `.env.local` paths appeared in important files, test files, or route evidence.
- `.env.example` is explicitly ignored by the analyzer. That is conservative for secrets safety, but it also means example environment documentation is invisible to repository intelligence.

## Snapshot Persistence Check

Failed.

Findings:

- `prisma/schema.prisma` does not define `RepositoryAnalysisSnapshot`.
- Generated Prisma client contains `Repository`, but no snapshot model.
- `src/app/actions/repository.ts` only creates a `Repository` with `analysisStatus: "pending"`.
- Repository list/detail pages display stored metadata and status, not generated repository intelligence.
- There is no discovered server action, route, job, or service that persists analyzer results as snapshots.

Result: steps 1, 3, 4, 6, and 7 can be exercised only as pure in-memory functions, not as the full product flow requested by MUS-199.

## Test Scenarios

### 1. No-change comparison

Output:

- Comparison: `No structural changes detected between the two snapshots.`
- Impact: `none`
- Affected areas: none
- Roles: none
- QA focus: none
- Release risks: none

Assessment: Pass for pure function behavior.

### 2. Route change

Simulated added route: `/work/repositories/[id]/impact`

Output:

- Impact: `medium`
- Affected area: `routing`
- Roles: `QA Engineer`, `Release Manager`
- QA focus: `routing`
- Recommendation: smoke-test new pages and verify navigation/access control
- Evidence: `Route added: /work/repositories/[id]/impact (page)`

Assessment: Useful and appropriately scoped.

### 3. API or server action change

Simulated added server action: `src/app/actions/repository-impact.ts`

Output:

- Impact: `high`
- Affected area: `serverActions`
- Roles: `Backend Engineer`, `QA Engineer`
- QA focus: `serverActions`
- Release risk: server action module added
- Recommendation: verify tests and authorization
- Evidence: `Server action added: src/app/actions/repository-impact.ts`

Assessment: Useful. It correctly treats server actions as high-risk because Next.js Server Functions are directly reachable by POST and require authorization checks.

### 4. Prisma/database-related change

Simulated added model: `RepositoryAnalysisSnapshot`

Output:

- Impact: `high`
- Affected area: `database`
- Roles: `Backend Engineer`, `CTO`, `QA Engineer`, `Release Manager`
- QA focus: `database`
- Release risk: Prisma model added
- Recommendation: verify migrations and regression-test affected model flows
- Evidence: `Prisma model added: RepositoryAnalysisSnapshot`

Assessment: Useful. Field-level schema changes remain invisible by design.

### 5. Config/build tooling change

Simulated build script change: `next build` to `next build --debug`

Output:

- Impact: `high`
- Affected area: `build`
- Roles: `Backend Engineer`, `DevOps`, `Release Manager`
- QA focus: `build`
- Release risk: build/dev script changed
- Recommendation: verify local and CI build stability
- Evidence: `Script changed: build (oldValue: next build, newValue: next build --debug)`

Assessment: Useful.

### 6. Test file change

Simulated added test file: `src/lib/repository-impact-analysis.dogfood.test.ts`

Output:

- Impact: `low`
- Affected area: `tests`
- Role: `QA Engineer`
- QA focus: `tests`
- Release risks: none
- Recommendation: verify the test passes and is included in CI
- Evidence: `Test file added: src/lib/repository-impact-analysis.dogfood.test.ts`

Assessment: Useful.

### 7. Auth-sensitive path change

Simulated added route: `/login/mfa`

Output:

- Impact: `critical`
- Affected area: `auth`
- Roles: `Backend Engineer`, `CTO`, `QA Engineer`, `Security Engineer`
- QA focus: `auth`
- Release risk: security-sensitive page route changed
- Recommendation: Security Engineer must verify authentication and authorization guards
- Evidence: `Auth/admin route added: /login/mfa (page)`

Assessment: Strong. This is one of the most trustworthy outputs.

### 8. Documentation-only change

Simulated one added doc-category file.

Output:

- Impact: `low`
- Affected area: `documentation`
- Roles: none
- QA focus: none
- Release risks: none
- Recommendations: none
- Evidence: `File category change: doc (old: 57, new: 58, delta: 1)`

Assessment: Useful, but path-level evidence is missing for normal doc additions unless the file is important.

### 9. Partial/malformed comparison input

Input contained an added API route but omitted most comparison sections.

Output:

- Impact: `high`
- Affected area: `api`
- Roles: `Backend Engineer`, `QA Engineer`, `Release Manager`
- QA focus: `api`
- Release risk: API route added
- Recommendation: add regression coverage and confirm authorization
- Evidence: `API route added: src/app/api/health/route.ts`
- Limitation: missing fields were normalized with safe empty defaults and impact may be understated

Assessment: Pass. Defensive behavior is good and transparent.

### 10. Failed snapshot handling

Input: old snapshot status `failed`, error `Clone failed`.

Output:

- Comparison error: `Old snapshot (snap-001) has failed status: Clone failed.`
- Impact error: `Cannot analyze impact: comparison failed`

Assessment: Pass for pure function behavior.

## Required Questions

Can Engineering OS explain what changed?

- Partially. It explains structural changes in routes, server actions, Prisma model names, scripts, dependencies, tests, risks, and important file path presence. It cannot explain content-only edits to existing files.

Can Engineering OS explain why it matters?

- Yes for supported structural changes. Impact levels, reasons, release risks, and QA focus areas are understandable.

Can Engineering OS identify who should care?

- Yes in the pure impact layer. Roles are deterministic and generally appropriate.

Can Engineering OS suggest what should happen next?

- Yes. Recommendations are evidence-backed and practical for QA, Backend, Security, DevOps, Release Manager, and CTO workflows.

Is the output too noisy?

- Mostly no. The output is concise. The partial-input limitation string can become very long and noisy.

Is the output missing important context?

- Yes. It lacks persisted snapshot history, actual changed file paths for ordinary source/docs edits, content diffs, commit metadata, PR context, and field-level Prisma changes.

Would a CTO trust this?

- Not yet for full repository evolution. A CTO could trust the classification rules for supported changes, but not the product flow because snapshots are not persisted and content-only changes are invisible.

Would QA trust this?

- Partially. QA focus areas are good for supported structural changes, but QA would not trust it as a complete regression signal without file content change detection and persisted history.

Would a Release Manager trust this?

- Partially. Release risks are useful for build, auth, API, server action, and database structural changes. Release readiness cannot rely on it until failed snapshot state and latest-two-snapshot retrieval exist in the product.

Would an Engineering Manager use this to plan work?

- Partially. The role mapping and recommendations are useful, but missing persistence, work item integration, and content-level change evidence limit planning value.

## Strengths

- Pure functions are deterministic with injected timestamps.
- Impact classifications are clear and role-oriented.
- Auth-sensitive paths are escalated appropriately.
- Server action changes are treated as high-risk.
- Recommendations include evidence.
- Failed comparison inputs become explicit impact errors.
- Partial comparison inputs are normalized instead of crashing.
- Ignored directories and secret-like files are excluded from analyzer output.

## Weaknesses

- No persisted `RepositoryAnalysisSnapshot` model or snapshot creation flow.
- Existing file content changes are not detected because snapshots store path lists rather than hashes or content summaries.
- Dependency version changes are not detected.
- Prisma field-level changes are not detected.
- Documentation-only additions are detected only as category deltas, not as concrete changed paths unless important-file lists change.
- Partial-input limitations can be too verbose for executive users.
- The analyzer ignores `.env.example`, reducing secret exposure risk but hiding environment documentation.

## Bugs Found

1. Full snapshot flow cannot run end to end because there is no snapshot persistence model or creation path.
2. The current safe real repository change in the worktree is content-only edits to existing impact-analysis files; the comparison layer would not detect it.
3. `RepositoryAnalysisSnapshot` is referenced conceptually in comments/types, but not implemented in Prisma.
4. Repository UI can show `analysisStatus === "complete"`, but no discovered flow sets that status from actual analysis.

## UX Gaps

- No user-facing action to analyze a repository.
- No snapshot history view.
- No latest-two-snapshots comparison view.
- No impact analysis view on repository detail pages.
- No clear failed snapshot recovery path.
- No executive summary view tuned for CTO/CEO review.

## Architecture Gaps

- Missing snapshot persistence schema.
- Missing snapshot writer service.
- Missing latest-two-snapshot query.
- Missing application-level orchestration from repository analysis to comparison to impact analysis.
- Missing content hash or content summary layer.
- Missing commit/PR metadata linkage.
- Missing durable ignored-path audit trail in persisted snapshots.

## Accepted Limitations

These limitations are acceptable for a slice if they are visible in the product:

- No AI-based semantic code review.
- Pattern-based auth detection.
- Dependency names compared without package advisory checks.
- Role names are generic and not yet mapped to actual employees.
- No Company Intelligence integration.

These limitations are not acceptable for the final VET V1 gate:

- No persisted snapshots.
- No end-to-end product flow.
- No detection of content-only changes to existing files.

## Validation Commands

Command results are recorded after running the required validation suite.

| Command | Result |
|---|---|
| `npx prisma validate` | Passed |
| `npx prisma format --check` | Passed |
| `npx prisma generate` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run test` | Passed: 2 test files, 75 tests |

## Recommendation

NOT READY.

Do not start Virtual Engineering Team V1 on top of Repository Intelligence Slice 2 yet. The pure impact analysis layer is promising, but MUS-199 requires validating the full flow, and the full flow is not implemented. The next work should be limited to repository intelligence infrastructure: persisted snapshots, snapshot creation, latest-two comparison retrieval, and a product-facing impact analysis view. Company Intelligence and Virtual Engineering Team V1 should remain blocked until that exists.

## True Blockers

1. No persisted `RepositoryAnalysisSnapshot` model or snapshot creation flow exists.
2. No end-to-end application path exists to analyze a repository, store two snapshots, compare the latest two, and surface impact analysis.
3. Content-only changes to existing files are invisible, which prevents trustworthy repository evolution review for real code changes.
