# Repository Intelligence Slice 2 Dogfood Review

Issues: MUS-196 (Epic: Repository Change Intelligence), MUS-199 (Dogfood Review)
Date: 2026-06-28
Repository: Engineering OS
Decision: APPROVED — Release Manager completion

## Executive Summary

Repository Intelligence Slice 2 now has a working persisted snapshot flow for the core repository change intelligence path.

The current implementation can analyze a real repository path, persist completed or failed `RepositoryAnalysisSnapshot` records, compare the latest two snapshots for the same repository/company, and generate deterministic impact analysis with evidence, affected areas, affected roles, QA focus, release risks, recommendations, confidence, and limitations.

The slice is ready for review as a repository intelligence foundation. It should not be treated as a complete Virtual Engineering Team V1 launch gate yet because snapshot history is still limited to the latest comparison, remote clone/fetch integration is not implemented, and no semantic code review is claimed.

## Current Product Flow

The repaired flow is:

1. `analyzeRepository` accepts a repository id and local repository path.
2. `createRepositoryAnalysisSnapshot` verifies the repository belongs to the current company.
3. `analyzeRepositoryPath` analyzes the real filesystem path.
4. A `RepositoryAnalysisSnapshot` is stored with analyzer output, safe file fingerprints, ignored paths, status, and failure details when relevant.
5. Repository summary metadata is updated after successful analysis.
6. `compareLatestRepositorySnapshots` loads the latest two snapshots and calls `compareSnapshots`.
7. `analyzeLatestRepositorySnapshotImpact` calls the latest-two comparison and feeds the result to `analyzeRepositoryImpact`.

## Dogfood Evidence

Added `src/lib/repository-snapshot-dogfood.test.ts` to verify the persisted flow with a temporary SQLite database and a temporary copy of the real Engineering OS repository.

The dogfood test:

- Creates an isolated company, workspace, repository, and snapshot database.
- Copies the current Engineering OS repository into a temporary fixture, excluding `.git`, `.next`, `node_modules`, and the local dev database.
- Creates a baseline persisted snapshot from the real copied repository.
- Adds a real App Router page to the copied repository.
- Creates a second persisted snapshot from the changed copied repository.
- Confirms two snapshots are stored.
- Confirms latest-two comparison detects the added route.
- Confirms comparison evidence identifies `src/app/dogfood-impact/page.tsx`.
- Confirms impact analysis returns medium routing impact.
- Confirms affected roles include QA Engineer and Release Manager.
- Confirms recommended action asks QA to smoke-test the new page.
- Confirms the CEO-readable summary reports `Overall impact: MEDIUM`.

Focused dogfood command:

| Command | Result |
|---|---|
| `npx vitest run src/lib/repository-snapshot-dogfood.test.ts` | Passed: 1 test |

## Requirements Check

Can Engineering OS store comparable snapshots?

- Yes. `RepositoryAnalysisSnapshot` exists in Prisma, is related to `Repository` and `Company`, and stores analyzer output, status, errors, ignored paths, and safe file fingerprints.

Can Engineering OS compare the latest two snapshots?

- Yes. `compareLatestRepositoryAnalysisSnapshots` loads the newest two snapshots for a repository/company and compares them oldest-to-newest.

Can Engineering OS explain what changed?

- Yes for supported deterministic changes: routes, API routes, server actions, Prisma model names, scripts, dependencies by package name, tests, risks, important files, file category counts, and same-path safe text content hash changes.

Can Engineering OS explain why it matters?

- Yes. Impact analysis produces impact level, reasons, affected areas, QA focus areas, release risks, recommendations, confidence, and limitations.

Can Engineering OS identify who should care?

- Yes. Impact analysis maps changes to roles such as QA Engineer, Release Manager, Backend Engineer, Security Engineer, DevOps, CTO, and Engineering Manager.

Can Engineering OS suggest what should happen next?

- Yes. Recommended actions are deterministic and evidence-backed.

Is the output CEO-readable?

- Yes for the current slice. The summary is concise, for example: `Overall impact: MEDIUM. 1 impact item(s) identified across: routing.`

## Strengths

- No external AI APIs are used.
- Snapshot creation is company-scoped.
- Failed analyses are persisted truthfully as failed snapshots.
- Ignored and secret-like files are excluded from analyzer output and fingerprints.
- Safe file fingerprints allow same-path content-only changes to be detected without storing file contents.
- Comparison and impact analysis remain deterministic.
- Evidence is explicit and traceable to changed paths or changed repository metadata.
- The dogfood test proves the service path against a real copied repository, not only hand-built in-memory snapshots.

## Remaining Risks

- Repository detail UI exposes latest snapshot count, latest comparison, and latest impact analysis; a full historical snapshot timeline is not implemented.
- The server action accepts a local path; remote clone/fetch and provider-backed repository sync remain out of scope.
- Content hashes intentionally skip ignored, secret-like, large, and binary files.
- Prisma field-level changes are not semantically interpreted beyond model-name changes and `schema.prisma` content changes.
- Dependency version changes are not semantically interpreted beyond package manifest content changes.
- Route path reporting currently reflects analyzer route identifiers, which are source paths for App Router pages.
- `next build` may emit a Turbopack tracing warning because the server action path can reach filesystem analyzer code.
- The local `prisma/dev.db` may be out of sync if migrations have not been applied; tests use an isolated database to avoid relying on local dev database state.

## Recommendation

APPROVED for release.

Repository Intelligence Slice 2 satisfies the MUS-196 epic acceptance criteria and MUS-199 dogfood review. Snapshot persistence, latest-two comparison, impact analysis, repository detail UI, planner integration, and dogfood evidence are validated on `master` with 541 tests passing (including `repository-snapshot-dogfood.test.ts`).
