# Repository Snapshot Comparison

## Purpose

Repository snapshot comparison answers: what changed between two persisted repository analysis snapshots?

The pure comparison function is `compareSnapshots` in `apps/web/src/lib/repository-snapshot-comparison.ts`.

## Inputs

The comparison consumes two `RepositoryAnalysisSnapshot`-shaped payloads and a caller-injected `comparedAt` timestamp.

JSON fields are parsed defensively. Malformed JSON falls back to empty values so comparison returns a deterministic result instead of throwing.

## Compared Areas

The comparison detects:

- important files added and removed
- safe text files changed by content hash
- routes added, removed, or type-changed
- API routes added or removed
- server action modules added or removed
- Prisma model names added or removed
- dependencies and dev dependencies added or removed
- script additions, removals, and value changes
- test files added or removed
- risk findings added or resolved
- file count and category deltas

## Content-Only Change Detection

Snapshots include `fileFingerprints` for safe text files. When the same normalized path exists in both snapshots but `contentHash` differs, comparison reports that path in `changedFiles`.

This fixes the previous blind spot where existing-file content changes were invisible.

## Failure Handling

Comparison returns an error result when:

- either snapshot is missing an id
- either snapshot has `failed` status
- snapshots belong to different repositories

Analyzer version mismatches do not fail comparison, but they are included in limitations.

## Determinism

The comparison function has no database access, filesystem reads, AI calls, random IDs, or internal clock calls. The same inputs and timestamp produce the same output.

## Service Path

`compareLatestRepositoryAnalysisSnapshots` in `apps/web/src/lib/repository-snapshot-service.ts` loads the latest two snapshots for a repository/company, compares them oldest-to-newest, and returns the pure comparison result.
