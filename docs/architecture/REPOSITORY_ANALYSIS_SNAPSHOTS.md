# Repository Analysis Snapshots

## Purpose

Repository analysis snapshots are durable point-in-time records of what Engineering OS detected in a repository. They allow later analyses to compare repository evolution instead of overwriting the latest repository metadata.

## Data Model

`RepositoryAnalysisSnapshot` is stored in Prisma and belongs to both a `Repository` and a `Company`.

Captured fields:

- analyzer version
- status and error
- local path used for analysis
- file tree summary
- important files
- routes and API routes
- server action modules
- Prisma model names
- dependency and script names
- test files
- safe file fingerprints
- risk findings
- ignored path policy
- human-readable analysis summary

Most structured fields are stored as JSON strings to match the existing repository metadata pattern and the comparison input shape.

## Snapshot Creation

`createRepositoryAnalysisSnapshot` in `apps/web/src/lib/repository-snapshot-service.ts` is the application service for snapshot creation.

Success path:

1. Validate the repository belongs to the company.
2. Mark the repository `analysisStatus` as `analyzing`.
3. Run `analyzeRepositoryPath(localPath)`.
4. Persist a `completed` snapshot.
5. Update repository summary metadata and mark the repository `complete`.

Failure path:

1. Validate the repository belongs to the company.
2. Mark the repository `analysisStatus` as `analyzing`.
3. Run the analyzer.
4. Persist a `failed` snapshot with the analyzer error.
5. Mark the repository `failed`.

## Content Fingerprints

The analyzer records `contentHash` metadata for safe scanned text files only.

Rules:

- full file contents are never stored
- ignored files and directories are not hashed
- secret-like files such as `.env`, private keys, and certificates are not hashed
- files larger than the analyzer read limit are not hashed
- binary files are skipped
- hashes are deterministic SHA-256 values over safe file bytes

The snapshot stores the resulting `fileFingerprints` array. Snapshot comparison uses this to detect same-path content-only changes.

## Application Path

Callable server actions in `apps/web/src/app/actions/repository.ts` expose the service path:

- `analyzeRepository`
- `compareLatestRepositorySnapshots`
- `analyzeLatestRepositorySnapshotImpact`

`apps/web/src/lib/repository-change-intelligence.ts` exposes the read-only latest change intelligence path for UI and planning code. It loads the latest two snapshots for a repository/company, runs deterministic comparison and impact analysis, and returns snapshot summary, comparison, and impact output without importing the filesystem analyzer.

Current product surfaces:

- Repository detail pages show snapshot count, latest snapshot state, latest comparison summary, impact level, affected areas, evidence, release risks, and recommended actions.
- Repository detail pages include a local-path analysis form for creating a new snapshot from an accessible server-side repository path.
- Planning draft generation includes recent repository change context in generated plan summaries and project descriptions when at least two comparable snapshots exist.

Known UI limits:

- There is no historical snapshot timeline beyond the latest two snapshots.
- There is no remote clone/fetch flow.
- There is no commit or pull request metadata linkage yet.
