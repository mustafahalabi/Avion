# Repository Knowledge

**Status:** Approved
**Version:** 1.0
**Owner:** CTO (authority) · Tech Lead (operational)
**Last Updated:** 2026-06-29

This document defines **Repository Knowledge** — the durable, codebase-specific understanding the company holds about each Repository it manages. It specifies what repository knowledge is, how it differs from company-wide knowledge, who owns it, which facts must be captured, and the rules that govern when it is written, refreshed, validated, and used.

Repository Knowledge is the answer to a single question that every engineer, reviewer, and execution agent must be able to answer before touching code: **what is true about this codebase right now, and what must I respect while changing it?** A company that re-derives repository facts on every task is slow and error-prone. A company with disciplined repository knowledge plans accurately, fails fast on bad environments, and never surprises itself with a structure it should already have understood.

This document describes company behavior, not storage technology. Where it names concrete fields, services, or screens, those are the current implementation surface (see [§11 Implementation Status](#11-implementation-status)); the rules themselves are storage-agnostic and survive any change of database or analyzer. Where a behavior is designed but not yet built, that is stated explicitly and kept separate from what exists today — inventing capability is a hard project rule and is never done here.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Repository Knowledge vs. Company-Wide Knowledge](#3-repository-knowledge-vs-company-wide-knowledge)
4. [Ownership Rules](#4-ownership-rules)
5. [Required Facts to Capture](#5-required-facts-to-capture)
6. [What Must Be Known Before Work Starts](#6-what-must-be-known-before-work-starts)
7. [Update Rules](#7-update-rules)
8. [Validation Rules](#8-validation-rules)
9. [Examples](#9-examples)
10. [Anti-Patterns](#10-anti-patterns)
11. [Implementation Status](#11-implementation-status)
12. [Definition of Done](#12-definition-of-done)
13. [Relationship to Other Documents](#13-relationship-to-other-documents)

---

## 1. Purpose

Repository Knowledge exists to give the company a trustworthy, current model of every codebase it operates on. It serves four purposes:

1. **Plan accurately.** The Planning System cannot decompose a Feature into safe tasks without knowing the repository's structure, framework, database layer, and validation commands. Repository Knowledge is the substrate planning reads.
2. **Brief execution truthfully.** Every implementation task carries a repository context that tells the execution agent which branch to cut, which files to read first, which commands prove the work, and which paths it must never touch. That context is derived from Repository Knowledge — and only from facts that are actually recorded, never guessed.
3. **Detect change and impact.** When a codebase moves, the company compares what it knew before against what is true now and reasons about the blast radius. Repository Knowledge is the baseline against which change is measured.
4. **Fail fast.** A missing manifest, an unknown package manager, or absent tests are recorded as risks the moment they are detected, so unsafe work is blocked or flagged before an agent ever runs.

Repository Knowledge is the **repository-scoped layer** of the company's organizational memory. It is governed by the same write-once-trust-forever discipline as the rest of [Organizational Memory](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md), narrowed to a single Repository.

---

## 2. Scope

**In scope.** Everything the company knows about a specific connected Repository:

- Structure: file tree shape, top-level directories, file categories, and the files that matter most.
- Stack: primary language, frameworks (and their router style), tech stack, runtime and dev dependencies, package manager.
- Surface: pages, layouts, API route handlers, server-action modules, middleware, and entry points.
- Data layer: ORM technology, schema paths, migrations, seed files, detected models, and tenant-ownership risks.
- Operations: validation commands (typecheck/lint/build/test), test files, and test coverage signals.
- Health: risk findings (testing, documentation, security, dependencies, structure, database) with severity, evidence, and mitigation.
- History: time-ordered analysis snapshots that let the company compare versions and reason about change and impact.

**Out of scope.** Company-wide knowledge that is not specific to one codebase — coding standards, the org chart, decision frameworks, role handbooks. Those live in [Company Memory](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md) and the [Knowledge Library](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md). Also out of scope: deep semantic understanding of business logic, runtime behavior, and live production signals. The platform captures *structural* and *manifest-level* facts today; it does not execute or interpret the code it analyzes.

---

## 3. Repository Knowledge vs. Company-Wide Knowledge

The two are deliberately separated. Confusing them is the most common way memory becomes wrong.

| Dimension | Repository Knowledge | Company-Wide Knowledge |
|---|---|---|
| Subject | One specific Repository | The organization as a whole |
| Examples | "This repo is a pnpm/Turborepo monorepo; the Next.js app uses Prisma + PostgreSQL; `apps/web/prisma/schema.prisma` is the data spine; run `pnpm --filter @avion/web test` to validate." | "We follow one-owner accountability." "Reviews block on any Blocking finding." "Documentation is engineering." |
| Source | Deterministic analysis of the codebase (file tree, manifests, schema) | Authored handbooks, decisions, retrospectives, accumulated experience |
| Volatility | Changes whenever the codebase changes; refreshed by re-analysis | Changes slowly and deliberately; changed by authoring and approval |
| Owner | CTO (authority) · Tech Lead (operational) | CTO oversight; each employee owns their domain records |
| Lifetime | Tied to the Repository; archived when it is disconnected | Persists for the life of the company |
| Storage today | `Repository` record + `RepositoryAnalysisSnapshot` history | `Memory` / `MemoryRecord`, `Knowledge` / `KnowledgeRecord` |

**Hard separation rule.** A fact that is only true for one codebase must never be promoted to company-wide knowledge, and a company-wide standard must never be copied into a single repository's record as if the analyzer derived it. When a repository fact generalizes into a company standard (for example, "we standardize on pnpm"), it is *authored* into the Knowledge Library through the normal review lifecycle — it is not silently widened in place.

A Repository's knowledge corresponds to the **Repository Memory** layer named in the [Domain Model](../architecture/DOMAIN_MODEL.md) (a scoped subset of Company Memory) and the **Repository** module in the [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).

---

## 4. Ownership Rules

- **The CTO holds authority** over Repository Knowledge. The CTO owns the strategic correctness of what the company believes about a codebase and is notified when a Repository's integration errors or its credentials become invalid.
- **The Tech Lead operates it.** The Tech Lead is accountable for keeping a Repository's analysis current enough for the work in flight, for triaging recorded risks, and for confirming the architecture summary before a Repository becomes fully Active.
- **One Repository, one authoritative record.** Each Repository has exactly one `Repository` record holding its current materialized knowledge, plus an append-only history of `RepositoryAnalysisSnapshot` rows. Knowledge is never forked across two competing records for the same codebase.
- **The analyzer is the only writer of derived facts.** Structural and manifest facts (frameworks, routes, models, risks) are written by the deterministic analyzer, not typed in by hand. Human-authored context belongs in company-wide knowledge or in a task brief, clearly attributed — not blended into the analyzer's output as if it were detected.
- **Every record is company-scoped.** A `RepositoryAnalysisSnapshot` carries both `repositoryId` and `companyId`. No cross-company read of repository knowledge is possible, consistent with the company-namespace invariant in the Technical Architecture.

---

## 5. Required Facts to Capture

These are the facts a Repository's knowledge must contain for the company to plan and execute safely. All of the following are produced today by `analyzeRepositoryPath` in `apps/web/src/lib/repository-analyzer.ts` and persisted on the `Repository` record and/or its latest `RepositoryAnalysisSnapshot`.

**Identity and stack**
- Repository name and URL.
- Primary language (TypeScript vs. JavaScript, inferred from `typescript` / `@types/*`).
- Frameworks with a confidence level and evidence — including Next.js router style (App Router vs. Pages Router), React, Vue, Svelte, Express, Fastify.
- Tech stack: ORM (Prisma/Drizzle/TypeORM/Mongoose), auth (Clerk/NextAuth/Auth.js), styling (Tailwind), validation (Zod), test tooling (Vitest/Jest/Playwright/Cypress).
- Package manager, resolved by lockfile precedence (`bun` > `pnpm` > `yarn` > `npm`), with workspace globs when present.

**Structure**
- File-tree summary: total files, total directories, counts by category and by extension, and the top-level directory list.
- Important files: manifests, configs, the Prisma schema, and shallow App Router layouts — the files an agent should read first.
- A per-file fingerprint set (path + category + content hash) used as the basis for change detection.

**Surface**
- Pages, layouts, and API route handlers, with a best-effort mapping to public URL paths.
- Server-action modules (files carrying a top-level `"use server"` directive).
- Middleware / proxy entry points and a consolidated entry-point list.

**Data layer**
- ORM technology, schema paths, migration directories, and seed files.
- Detected models and their tenant-ownership fields (`companyId` / `tenantId` / `organizationId`), plus ownership risks where a company-scoped repo has unscoped models.

**Operations and health**
- Validation commands derived from `package.json` scripts, ordered for a task brief (typecheck → lint → build → test).
- Test files and a coarse coverage-ratio signal.
- Risk findings — each with `severity` (high/medium/low), `category`, a description, evidence, and a concrete mitigation.
- A human-readable `intelligenceSummary` / `analysisSummary` string capturing the headline facts.

**Integrity boundaries (always enforced during capture)**
- Secrets are never captured. The walker skips `.env*` files and secret-bearing extensions (`.pem`, `.key`, `.p12`, `.pfx`, `.cert`, `.crt`, `.der`, `.p8`, `.jks`), and skips generated/vendor directories (`node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, and similar).
- Analysis is read-only and bounded: at most `ANALYZER_MAX_FILES` (2000) files, depth `ANALYZER_MAX_DEPTH` (6), and at most 512 KB read per file. Binary files are not hashed.

---

## 6. What Must Be Known Before Work Starts

No implementation task should begin until the following are known and recorded. This is the company's pre-flight contract, materialized today by `generateRepositoryTaskContext` in `apps/web/src/lib/repository-task-context.ts`, which assembles a **truthful** context for each task — reporting only what is actually stored and emitting explicit warnings for anything missing.

A task is ready to execute when its repository context resolves:

1. **A target repository.** If no Repository is attached, the context emits a warning rather than guessing one.
2. **A base branch and a safe implementation branch.** The branch is supplied or derived deterministically from the task. If the intended branch is a protected branch, the context warns and requires explicit hotfix confirmation.
3. **Analysis state.** `hasAnalysis` must reflect a completed analysis. When analysis is `pending` or `failed`, the context surfaces it so planning can refuse or flag the work.
4. **Stack and relevant files.** The primary language, tech stack, and the short list of files to read first — so the agent orients before editing.
5. **Validation commands.** The ordered commands that prove the work; an empty list is itself a recorded warning.
6. **Constraints.** The non-negotiable safety rules the agent must observe (see [§8 Validation Rules](#8-validation-rules) and [Agent Safety](../architecture/GITHUB_WORKFLOW_FOUNDATION.md)).

**Principle: absence is a fact.** Missing repository knowledge is represented as `null`/empty plus a warning — never invented. A brief that quietly fabricates a framework or a test command is more dangerous than one that admits it does not know.

---

## 7. Update Rules

Repository Knowledge is only valuable while it is current. The following rules govern refresh.

- **Capture on connect.** When a Repository is connected, it is analyzed before it becomes fully Active; the architecture summary is reviewed by a human (the Tech Lead, surfaced to the CEO) before activation.
- **Snapshots are append-only.** Each analysis run creates a new `RepositoryAnalysisSnapshot` via `createRepositoryAnalysisSnapshot`. Prior snapshots are never edited or deleted — they are the historical baseline that makes change intelligence possible.
- **The `Repository` record reflects the latest good analysis.** Materialized fields (`frameworks`, `techStack`, `dependencies`, `importantFiles`, `analysisStatus`, `analysisNotes`) track the most recent successful run. A failed run records its `status` and `error` on the snapshot without silently overwriting known-good materialized facts.
- **Re-analyze when the codebase moves.** A new snapshot should be taken when meaningful change has landed. The company then compares the two most recent snapshots (`compareLatestRepositoryAnalysisSnapshots`) and reasons about impact (`analyzeLatestRepositoryImpact`), surfaced together through `getLatestRepositoryChangeIntelligence`.
- **Versioned analyzer.** Each snapshot records the `analyzerVersion` that produced it, so comparisons across analyzer upgrades remain interpretable.
- **No partial activation.** A Repository never enters Active state on a partially populated analysis; either the analysis completed or the gap is recorded and the Repository stays in a non-Active state.

---

## 8. Validation Rules

Repository Knowledge must be **truthful** and **safe**. These rules are enforced in code today.

**Truthfulness**
- Report only what is stored. Every field that is unknown is `null` or empty, accompanied by a warning where it affects work readiness. No field is ever back-filled with a plausible guess.
- Confidence is explicit. Frameworks carry a `confidence` of high/medium/low with the evidence that justified the call; routing and database "unknowns" are listed rather than hidden.
- Risks carry evidence and mitigation. A risk finding is never a bare label — it states what was observed and what to do about it.

**Safety (guardrails — always on)**

The execution path enforces guardrails independent of any agent's permission mode, via `apps/web/src/lib/repository-guardrails.ts`. A task's repository context restates these as constraints, and the worker blocks a run that violates them:

- **Protected paths are never written.** `.env*`, lockfiles, `prisma/migrations/**`, `.github/workflows/**`, and secret-bearing files are off-limits.
- **Protected branches are never pushed to.** A direct push to `master`/`main` (and the configured protected set) is refused; work happens on a derived implementation branch.
- **Dangerous commands are denied.** Force-pushes and other denied/destructive commands are blocked before they run.
- A blocked run fails the session with the offending paths/branch/command recorded in the execution audit trail.

**Coverage and environment**
- Absent tests or test runner, multiple competing lockfiles, an undeterminable package manager, a missing manifest, or a Prisma schema without migrations are each recorded as risks at capture time, so the company can refuse or flag work that depends on a broken environment.

---

## 9. Examples

**Example A — A well-understood repository (this codebase, as analyzed before the monorepo re-platform).** Analysis records: Next.js (App Router) at high confidence; tech stack including Prisma, Clerk, Tailwind, Vitest, Zod; the App Router pages and API route handlers; server-action modules; ~37 Prisma models with `companyId` ownership; derived validation commands in the repo's detected package-manager form (today, for this pnpm monorepo: `pnpm typecheck` → `pnpm lint` → `pnpm build` → `pnpm test`); a low test-coverage risk if the ratio dipped. A task brief built from this resolves with `hasAnalysis: true`, a concrete file-read list, and a full validation sequence.

**Example B — Repository attached but not yet analyzed.** `analysisStatus` is `pending`. The task context returns `hasAnalysis: false` and warns that analysis has not completed. Planning declines to start implementation and routes the Repository back through analysis first.

**Example C — No repository attached.** The task context returns null repository fields and a prominent warning: *"No repository is attached to this task. Confirm the target repository and base branch before starting implementation."* No framework, file, or command is guessed.

**Example D — Change landed.** A new snapshot is taken after a feature merges. Change intelligence compares it against the prior snapshot, reports which files and routes were added/changed/removed, and produces an impact assessment (level + recommended actions) the Tech Lead reviews before the next wave of work.

---

## 10. Anti-Patterns

- **Inventing facts.** Filling in a "likely" framework, test command, or file path the analyzer did not detect. Absence must be represented as absence.
- **Promoting a repo fact to a company standard in place.** Editing one Repository's record to assert an org-wide rule. Generalizations go through the Knowledge Library's authoring lifecycle.
- **Treating a stale snapshot as current.** Planning against analysis that predates significant code change. Re-analyze, then compare.
- **Mutating history.** Editing or deleting a prior `RepositoryAnalysisSnapshot`. History is append-only; it is what makes change and impact analysis trustworthy.
- **Capturing secrets.** Reading `.env*` or key material into knowledge. The analyzer is built to refuse this; no workflow should route around it.
- **Bypassing guardrails with a hand-written brief.** Authoring a task context that omits the protected-path/branch/command constraints. Constraints are non-negotiable and restated on every task.
- **Silent partial activation.** Marking a Repository Active when its analysis failed or is incomplete. The gap must be recorded and surfaced.

---

## 11. Implementation Status

Separated per the project's hard rule: describe only what genuinely exists today.

**Implemented today**
- Deterministic, read-only repository analysis: `apps/web/src/lib/repository-analyzer.ts` (`analyzeRepositoryPath`) — file-tree walk, package-manager and framework detection, route / API / server-action detection, Prisma model and database-layer detection, risk findings, validation-command derivation, and a human-readable summary. Secrets and generated outputs are excluded; analysis is bounded and never mutates the repository.
- Persistence: the `Repository` model and the append-only `RepositoryAnalysisSnapshot` model in `apps/web/prisma/schema.prisma`, written via `createRepositoryAnalysisSnapshot` (`apps/web/src/lib/repository-snapshot-service.ts`).
- Change and impact: snapshot comparison and impact analysis (`compareLatestRepositoryAnalysisSnapshots`, `analyzeLatestRepositoryImpact`, `analyzeRepositoryImpact`) surfaced through `getLatestRepositoryChangeIntelligence` (`apps/web/src/lib/repository-change-intelligence.ts`).
- Pre-work context: `generateRepositoryTaskContext` (`apps/web/src/lib/repository-task-context.ts`) builds the truthful, warning-bearing repository context for an implementation task.
- Safety: `apps/web/src/lib/repository-guardrails.ts` enforces protected paths, protected branches, and denied/dangerous commands on the execution path.
- A repository intelligence view (`apps/web/src/lib/repository-intelligence-service.ts`) and dashboard under the Repositories surface.

**Designed / planned (not built)**
- A dedicated, queryable **Repository Memory** store distinct from the analysis snapshot — today repository knowledge is materialized on the `Repository` record plus snapshot history; the generic `Memory` / `MemoryRecord` tables exist but are company-scoped, not the repository knowledge store.
- Semantic retrieval over repository knowledge (the pgvector layer described in the Technical Architecture is V1.5+).
- Repository Validation & Environment profiles (env-var inventory, secret references, real completion gates) — an open roadmap milestone, not yet implemented.
- Deeper, behavioral (non-structural) understanding of code, and live production/runtime signals.

---

## 12. Definition of Done

Repository Knowledge for a connected Repository is "done" — sufficient to plan and execute against — when all of the following hold:

- A **completed** analysis exists, with `analysisStatus` reflecting success and an `analyzerVersion` recorded on the snapshot.
- The required facts in [§5](#5-required-facts-to-capture) are populated: stack, structure, surface, data layer, operations, and health — with unknowns explicitly marked, not invented.
- Validation commands are present, or their absence is recorded as a risk.
- All detected risks are recorded with severity, evidence, and mitigation, and high-severity findings have been triaged by the Tech Lead.
- A human (Tech Lead, surfaced to the CEO) has reviewed the architecture summary before the Repository was activated.
- A task built against the Repository resolves a truthful context (`hasAnalysis: true`, file-read list, validation sequence, constraints) with no fabricated fields.
- Guardrail constraints (protected paths, branches, commands) are present on every task context derived from the Repository.
- The latest snapshot is current with the codebase; if meaningful change has landed, a fresh snapshot and a change/impact comparison exist.

---

## 13. Relationship to Other Documents

- [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md) — the parent memory model; Repository Knowledge is its repository-scoped layer.
- [Knowledge Library System](../systems/KNOWLEDGE_LIBRARY_SYSTEM.md) — where repository facts that generalize become authored, reviewed company knowledge.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — defines the Repository, Repository Memory, Memory Record, and Knowledge Record objects.
- [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) — the Repository, Memory, and Context Builder boundaries that produce and consume this knowledge.
- [Repository Analysis Snapshots](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md), [Repository Snapshot Comparison](../architecture/REPOSITORY_SNAPSHOT_COMPARISON.md), [Repository Impact Analysis](../architecture/REPOSITORY_IMPACT_ANALYSIS.md) — the mechanics of capture, comparison, and impact this document governs.
- [GitHub Workflow Foundation](../architecture/GITHUB_WORKFLOW_FOUNDATION.md) — the execution path and the guardrails restated as task constraints.
