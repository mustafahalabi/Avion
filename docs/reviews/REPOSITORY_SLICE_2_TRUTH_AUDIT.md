# Repository Slice 2 Truth Audit

Date: 2026-06-28
Issue: MUS-199
Branch: `master`
State classification: D. Work exists partially and must be completed.
Ready for review: Yes

## Branch And Git State

Initial audit commands:

| Command | Result |
|---|---|
| `git branch --show-current` | `master` |
| `git status --short` | clean |
| `git log --oneline --decorate -20` | `b8d31a1 (HEAD -> master, origin/master, origin/HEAD) MUS-199: Update Repository Impact Analysis Documentation and Enhance Functionality`; `cce033d MUS-127: Introduce Repository Impact Analysis Tool`; `fdf0574 MUS-126: Implement Outcome and Planning Draft Models`; then V1 history through `MUS-109` |
| `git branch --all` | `master`, `release/v1`, `remotes/origin/HEAD -> origin/master`, `remotes/origin/master`, `remotes/origin/release/v1` |
| `git tag --list` | `v1.0.0` |
| `gitiff --stat` | failed: `gitiff` command not found |
| `git diff --stat` | empty before repair |
| `git diff --name-only` | empty before repair |

Conclusion: the reviewer was not on the wrong local branch. `master` was clean and aligned with `origin/master`. The missing Slice 2 foundation was not untracked local work.

## Expected Files

Initial state:

| Path | Initial State |
|---|---|
| `src/lib/repository-snapshot-service.ts` | Missing |
| `src/lib/repository-snapshot-comparison.ts` | Exists |
| `src/lib/repository-impact-analysis.ts` | Exists |
| `src/lib/repository-analyzer.ts` | Exists |
| `docs/architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md` | Missing |
| `docs/architecture/REPOSITORY_SNAPSHOT_COMPARISON.md` | Missing |
| `docs/architecture/REPOSITORY_IMPACT_ANALYSIS.md` | Exists |

Post-repair state:

| Path | Current State |
|---|---|
| `src/lib/repository-snapshot-service.ts` | Exists |
| `src/lib/repository-snapshot-comparison.ts` | Exists |
| `src/lib/repository-impact-analysis.ts` | Exists |
| `src/lib/repository-analyzer.ts` | Exists |
| `docs/architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md` | Exists |
| `docs/architecture/REPOSITORY_SNAPSHOT_COMPARISON.md` | Exists |
| `docs/architecture/REPOSITORY_IMPACT_ANALYSIS.md` | Exists |

## Expected Models And Action Wiring

Initial state:

- `RepositoryAnalysisSnapshot` model: missing
- Snapshot relation from `Repository`: missing
- Snapshot creation in `src/app/actions/repository.ts`: missing
- Latest-two snapshot comparison action/service path: missing
- Latest impact analysis action/service path: missing

Post-repair state:

- `RepositoryAnalysisSnapshot` model: present in `prisma/schema.prisma`
- `Repository.analysisSnapshots`: present
- `Company.repositoryAnalysisSnapshots`: present
- Migration: `prisma/migrations/20260628043600_repository_analysis_snapshots/migration.sql`
- Snapshot creation service: `createRepositoryAnalysisSnapshot`
- Latest-two comparison service: `compareLatestRepositoryAnalysisSnapshots`
- Latest impact service: `analyzeLatestRepositoryImpact`
- Callable server actions:
  - `analyzeRepository`
  - `compareLatestRepositorySnapshots`
  - `analyzeLatestRepositorySnapshotImpact`

## Truth Determination

Classification: D. Work exists partially and must be completed.

Evidence:

- The pure snapshot comparison and impact analysis files existed.
- The analyzer existed.
- The durable snapshot model, migration, snapshot creation service, application action path, and snapshot architecture docs were missing.
- The branch was clean, so the missing foundation was not simply uncommitted local work.

## Repairs Performed

1. Added `RepositoryAnalysisSnapshot` Prisma model and migration.
2. Added repository/company relations for snapshots.
3. Added `src/lib/repository-snapshot-service.ts`.
4. Added snapshot creation on repository analysis success and failure.
5. Added latest-two snapshot comparison service.
6. Added latest repository impact analysis service.
7. Added callable server actions in `src/app/actions/repository.ts`.
8. Added safe file fingerprints to the analyzer.
9. Updated snapshot comparison to detect same-path content-hash changes.
10. Updated impact analysis to produce evidence and role guidance for content-only safe text changes.
11. Added tests for same-path different-content-hash detection and impact output.
12. Added architecture docs for snapshots and snapshot comparison.
13. Updated impact-analysis docs for content-hash behavior.

## Content-Hash Strategy

The analyzer now emits `fileFingerprints` for safe scanned text files.

Rules:

- Store `contentHash`, path, extension, size, and category.
- Do not store file contents.
- Do not hash ignored directories or ignored files.
- Do not hash `.env`, key, certificate, or other secret-like ignored files.
- Do not hash files above the analyzer read limit.
- Do not hash binary files.
- Use deterministic SHA-256 over safe file bytes.

Comparison behavior:

- If a normalized path exists in both snapshots and the hash differs, the path is returned in `changedFiles`.
- `changedFiles` now contributes to `hasChanges`, file evidence, and impact analysis.

## End-To-End Service Path

The repaired service/action path is:

1. `analyzeRepository` server action accepts `repositoryId` and `localPath`.
2. `createRepositoryAnalysisSnapshot` validates repository ownership through company/workspace.
3. Analyzer runs against the local path.
4. A `completed` or `failed` `RepositoryAnalysisSnapshot` is stored.
5. Repository summary metadata is updated on success; failure status and notes are stored on failure.
6. `compareLatestRepositorySnapshots` server action calls `compareLatestRepositoryAnalysisSnapshots`.
7. The service loads the latest two snapshots for the same repository/company and compares them oldest-to-newest.
8. `analyzeLatestRepositorySnapshotImpact` server action calls `analyzeLatestRepositoryImpact`.
9. The impact output is returned for UI, planner, or release workflow consumption.

UI gap:

- No dedicated UI was added. This is intentional for this repair. The service/action path exists and can be surfaced later without starting Company Intelligence or Virtual Engineering Team V1.

## Validation Results

| Command | Result |
|---|---|
| `npx prisma validate` | Passed |
| `npx prisma format --check` | Passed |
| `npx prisma generate` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed with one Turbopack tracing warning |
| `npm run test` | Passed: 3 test files, 77 tests |

Build warning:

`next build` reports a Turbopack NFT tracing warning because the server action path can reach filesystem-based repository analysis code. The build completes successfully. This should be monitored before exposing repository analysis broadly from UI.

## Remaining Risks

- No dedicated UI for snapshot history, latest comparison, or impact analysis yet.
- The action path accepts a local path; clone/fetch of remote repositories remains out of scope.
- Content hashes intentionally skip ignored, secret-like, large, and binary files.
- Prisma field-level changes are still not semantically interpreted; they are detected as `schema.prisma` content changes and model name additions/removals.
- Dependency version changes remain limited unless `package.json` content hash changes are interpreted by a future dependency-diff layer.
- `next build` passes but emits a Turbopack tracing warning for the filesystem analyzer path.

## Final Recommendation

Ready for review of Repository Intelligence Slice 2 foundation repairs.

Do not start Virtual Engineering Team V1 yet. Do not start Company Intelligence yet. The repaired foundation should be reviewed first, especially the server-action boundary for local repository paths and the build tracing warning.
