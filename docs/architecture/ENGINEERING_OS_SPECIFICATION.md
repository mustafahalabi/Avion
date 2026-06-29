# Engineering OS Specification — v1.0

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-29  

This is the single canonical specification for Engineering OS. It does not replace the architecture documents — it **binds** them. Each of the architecture documents is authoritative for one model or behavior (the Domain Model owns objects, the State Machines own lifecycles, the Event Model owns events, and so on). This document references those documents instead of duplicating them, and adds the *connective tissue* the project did not previously have a single home for: how the canonical models relate, the end-to-end **planning contract**, the numbered **invariants** every implementation must uphold, and the **permission and autonomy gates** that govern automated work.

This document is the artifact that closes the **Engineering OS Specification v1.0** milestone. Per the project's hard rules, no real-AI behavior may ship before the company, repository, and decision models are specified; this specification is what unlocks that gate. Where this document disagrees with any older document, the owning architecture document for that topic wins on detail, and this document wins on cross-cutting invariants. Changes that contradict an approved invariant here require CTO sign-off and a recorded Decision Record (see [Domain Model](./DOMAIN_MODEL.md)).

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Canonical Models](#2-canonical-models)
3. [The Company Model](#3-the-company-model)
4. [The Employee Model](#4-the-employee-model)
5. [The Work Model](#5-the-work-model)
6. [The Memory Model](#6-the-memory-model)
7. [The Runtime Model](#7-the-runtime-model)
8. [The Repository Model](#8-the-repository-model)
9. [The Planning Contract](#9-the-planning-contract)
10. [The Planning Provider Model](#10-the-planning-provider-model)
11. [The Quality Gate](#11-the-quality-gate)
12. [Permissions and Autonomy Gates](#12-permissions-and-autonomy-gates)
13. [Execution Guardrails](#13-execution-guardrails)
14. [Events, State Machines, and Memory](#14-events-state-machines-and-memory)
15. [Invariants](#15-invariants)
16. [Conformance and Testability](#16-conformance-and-testability)
17. [Glossary](#17-glossary)

---

## 1. Purpose and Scope

Engineering OS is a **virtual software company**: a CEO communicates an *outcome*, and the company plans, builds, reviews, QAs, and releases the software. This specification defines the canonical models that make that possible and the invariants that keep it truthful and safe.

**In scope.** The company / employee / work / memory / runtime / repository models; the outcome → plan → work pipeline; the planning provider model (deterministic baseline ↔ optional AI provider) and its quality gate; the permission and autonomy gate model; the execution guardrails; and the invariants that bind these together.

**Out of scope (delegated).** Object field-by-field definitions ([Domain Model](./DOMAIN_MODEL.md)), per-entity lifecycle transitions ([State Machines](./STATE_MACHINES.md)), event payloads and fan-out ([Event Model](./EVENT_MODEL.md)), memory layers and learning ([Memory Engine Architecture](./MEMORY_ENGINE_ARCHITECTURE.md)), the awareness layer ([Company Intelligence](./COMPANY_INTELLIGENCE.md)), runtime behavior ([Company Runtime](./COMPANY_RUNTIME.md)), and external connections ([Integration Architecture](./INTEGRATION_ARCHITECTURE.md)). This document references those; it does not restate them.

This specification is **implementation-neutral** about infrastructure (no framework, storage engine, or vendor is prescribed) but **specific** about behavior and invariants.

---

## 2. Canonical Models

Engineering OS is defined by six canonical models. Each has exactly one owning architecture document, which is authoritative for its detail. This specification owns only the relationships *between* them and the invariants that span them.

| # | Model | What it answers | Owning document |
|---|---|---|---|
| 1 | **Company** | What organization exists, who reports to whom, what its culture and autonomy are | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md) |
| 2 | **Employee** | Who does the work, what they own, how they are invoked, what they remember | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md) |
| 3 | **Work** | Outcomes, plans, projects, features, tasks, reviews, QA, releases and their lifecycles | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [STATE_MACHINES.md](./STATE_MACHINES.md) |
| 4 | **Memory** | What the company knows, who owns each layer, how learning feeds it | [MEMORY_ENGINE_ARCHITECTURE.md](./MEMORY_ENGINE_ARCHITECTURE.md) |
| 5 | **Runtime** | What the company is doing right now; how events drive employees | [COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md), [EVENT_MODEL.md](./EVENT_MODEL.md) |
| 6 | **Repository** | What a connected codebase contains and how it changes | [REPOSITORY_ANALYSIS_SNAPSHOTS.md](./REPOSITORY_ANALYSIS_SNAPSHOTS.md), [REPOSITORY_SNAPSHOT_COMPARISON.md](./REPOSITORY_SNAPSHOT_COMPARISON.md), [REPOSITORY_IMPACT_ANALYSIS.md](./REPOSITORY_IMPACT_ANALYSIS.md) |

Three cross-cutting systems operate over these models: **Company Intelligence** (the awareness layer; [COMPANY_INTELLIGENCE.md](./COMPANY_INTELLIGENCE.md)), **Integrations** (replaceable plumbing to external systems; [INTEGRATION_ARCHITECTURE.md](./INTEGRATION_ARCHITECTURE.md)), and the **GitHub Workflow Foundation** (safe, traceable agent Git; [GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md)).

---

## 3. The Company Model

A **Company** is the top-level tenant boundary. Every object — employee, outcome, plan, task, repository, memory, event — belongs to exactly one company and is only ever read or written within that company's scope. The company carries its organizational structure (departments, roles, reporting lines), its **culture**, and its **autonomy level** (see §12), which together shape how the runtime behaves.

The company is the unit of **ownership isolation**: there is no cross-company read or write path. See [Domain Model](./DOMAIN_MODEL.md) for the field-level definition and [Company Runtime](./COMPANY_RUNTIME.md) §37 for runtime ownership boundaries.

---

## 4. The Employee Model

An **Employee** is a long-lived organizational role with an identity, a mission, responsibilities, authority, memory, and a definition of done — not a prompt and not a temporary session. Employees are **invoked**, not listening: when work reaches a state where the next employee must act, the runtime emits an event, a dispatcher claims it, and the employee's context is assembled and the employee is invoked to produce a structured output (see [Company Runtime](./COMPANY_RUNTIME.md) §1, §36).

Every unit of work has **one owner** (the organizational principle of single accountability). Assignment recommendations flow from the plan (see §9) and are reconciled against the company's actual employee pool. See [Domain Model](./DOMAIN_MODEL.md) for the Employee object.

---

## 5. The Work Model

Work descends through a fixed hierarchy:

```
Outcome  →  PlanningDraft  →  Project  →  Feature  →  Task
                                              │
                                Review · QAResult · Release
```

- **Outcome** — the CEO's requested result. The single entry point for new work.
- **PlanningDraft** — a reviewable, not-yet-applied plan generated from the outcome (see §9). It contains *generated* projects, features, and tasks that are **not** real work records until approval.
- **Project / Feature / Task** — real work records, created **only** by applying an approved draft.
- **Review / QAResult / Release** — quality and delivery records gating a task toward `done` and shipped software.

Each entity's states, transitions, owners, terminal states, and **forbidden** transitions are defined in [STATE_MACHINES.md](./STATE_MACHINES.md). The binding rule across all of them: **no task reaches `done` without a recorded approved Review and passing QA** (Invariant I-7). This document does not restate the transitions; it requires conformance to them.

---

## 6. The Memory Model

The company remembers across layers — employee, team, company, repository, feature, and conversation memory — each with an owner and a retention rule. Memory is created from events and from learning inputs (reviews, QA findings, incidents, retrospectives), and is retrieved to assemble employee context before invocation. The full model, including validation and learning, is owned by [MEMORY_ENGINE_ARCHITECTURE.md](./MEMORY_ENGINE_ARCHITECTURE.md).

The specification-level requirement: memory is **company-scoped** (Invariant I-1), conversation memory **expires**, and durable memory is updated only through recorded events (see §14 and [EVENT_MODEL.md](./EVENT_MODEL.md)).

---

## 7. The Runtime Model

The **Runtime** is the living operational state — what the company is doing right now — and is distinct from the event log, which records what has happened. The runtime tracks active work, active employees, and **pending CEO decisions**. It advances by reacting to events rather than holding persistent agent connections ([COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md) §1–§3).

The runtime is realized by three cooperating processes (see also the Project Knowledge Base "How to run"):

- **Execution worker** — claims queued sessions, checks out the repository, runs the agent step, applies guardrails (§13), commits, pushes the session branch, and opens a PR.
- **Continuous driver** — schedules work per company: it prepares execution for the next task and advances review → QA → done according to the autonomy level (§12), with no manual clicks.
- **Execution adapter** — the provider-independent interface for the one truly autonomous, real-AI step (the Claude Code adapter is the production implementation).

---

## 8. The Repository Model

A connected **Repository** is understood through deterministic, read-only analysis: source-tree shape, package manager and manifests, frameworks and routing, database/persistence, and API surface. Analyses are captured as durable **snapshots** ([REPOSITORY_ANALYSIS_SNAPSHOTS.md](./REPOSITORY_ANALYSIS_SNAPSHOTS.md)), compared deterministically between two points in time ([REPOSITORY_SNAPSHOT_COMPARISON.md](./REPOSITORY_SNAPSHOT_COMPARISON.md)), and classified by area and risk with recommended actions ([REPOSITORY_IMPACT_ANALYSIS.md](./REPOSITORY_IMPACT_ANALYSIS.md)).

Repository facts are evidence-bearing: detection records **evidence paths and confidence**, never overstated certainty (Invariant I-9). Repository context is consumed by planning (`PlanningRepositoryContext`, §9) to keep generated tasks concrete and grounded; when repository metadata is missing, planning records the gap rather than guessing.

---

## 9. The Planning Contract

Planning is the bridge from a CEO outcome to reviewable, applicable work. It has a **single, provider-independent contract**, defined in code by `src/lib/planning-generator.ts` and the `PlanningAdapter` interface (`src/lib/planning/planning-adapter.ts`). Every planning provider — deterministic or AI — MUST conform to it exactly so the downstream quality gate, CEO/autonomy review gate, and idempotent application path are identical regardless of source.

### 9.1 Input → Output

```
OutcomePlanningInput  ──(PlanningAdapter.generate)──▶  PlanningGenerationResult
```

**`OutcomePlanningInput`** (company-scoped) carries: `companyId`, `outcomeId`, `title`, `rawRequest`, `brief`, `businessValue`, `successCriteria[]`, `constraints[]`, `employees[]` (`PlanningEmployeeContext`), and `repositories[]` (`PlanningRepositoryContext`).

**`PlanningGenerationResult`** is a discriminated union:

- `PlanningGenerationSuccess` — `{ status: "success"; draft: DeterministicPlanningDraft }`
- `PlanningGenerationFailure` — `{ status: "failed"; reason; openCeoQuestions[] }`

A **failure is a first-class outcome**, not an error to swallow: when an outcome is empty, too short, vague (e.g. "make it better"), or outside supported scope, `validateOutcomeForPlanning` returns a structured failure with `openCeoQuestions` that the CEO answers before planning continues. No draft is fabricated for an unplannable outcome (Invariant I-3).

### 9.2 The draft payload

A `DeterministicPlanningDraft` (the canonical draft shape regardless of provider) carries: `generatorVersion`, `title`, `summary`, `status`, `scope[]` / `nonScope[]`, `assumptions[]`, `risks[]`, `dependencies[]`, `recommendedAssignments[]`, `generatedProjects[]`, `generatedFeatures[]`, `generatedTasks[]`, a `reviewPlan`, a `qaPlan`, a `releasePlan`, `openCeoQuestions[]`, `acceptanceCriteria[]`, and `estimatedExecutionOrder[]`.

The generated projects/features/tasks are **drafts inside the PlanningDraft**, addressed by `planItemId` (e.g. `project:…`, `feature:…`, `task:…`). They are explicitly **not** Project/Feature/Task records and must not be treated as such until apply (Invariant I-2). The draft's own non-scope encodes this: it states that no Project, Feature, Task, Review, QAResult, or Release records are created until approval, and that the plan must not be represented as AI output when it is deterministic.

### 9.3 Draft → work (apply)

On CEO approval, the draft is **applied idempotently** into real Project/Feature/Task records with full traceability back to the source Outcome and PlanningDraft. Re-applying the same approved draft must not create duplicates. The apply path and its idempotency are owned by the planning application service and the [State Machines](./STATE_MACHINES.md); this document requires that **no real work record is ever created without an approved draft** (Invariant I-2) and that application is idempotent (Invariant I-6).

---

## 10. The Planning Provider Model

Planning generation is the **one** step where a real LLM may eventually participate. It is isolated behind the `PlanningAdapter` interface so the rest of the pipeline never knows or cares which provider produced a draft.

### 10.1 Providers and selection

Two providers exist (`PlanningProviderId`): `"deterministic"` and `"ai"`.

- **Deterministic baseline** (`DeterministicPlanningAdapter`, `provider = "deterministic"`) — wraps the templated `generateDeterministicPlanningDraft`. It performs **no network/LLM I/O**, is fully synchronous under the hood, and is **always available**. It is both the default provider and the fallback for the AI provider.
- **AI provider** (`provider = "ai-claude"`) — produces a draft using a real LLM. It is wired only when the AI cluster exists, and **wraps the deterministic adapter as its fallback**, so AI planning can never produce a worse result than the baseline.

Selection is by `resolvePlanningAdapter`, which reads an explicit override first, then the `EOS_PLANNING_PROVIDER` environment variable, then defaults to `"deterministic"`. The AI adapter is returned **only** when `EOS_PLANNING_PROVIDER=ai` (or an explicit override) is set. Until a company or operator opts in, default behavior is unchanged (Invariant I-4, I-5).

### 10.2 The AI-free generator boundary (hard rule)

`src/lib/planning-generator.ts` is the deterministic core and MUST remain free of any AI-provider references. There is a conformance test asserting the file contains no `Claude`, `OpenAI`, `generateText`, `streamText`, or `fetch(` references. Therefore **all** AI-provider wiring, the `"ai-claude"` provider string, the AI generator-version constant, and any LLM client live in the planning provider/adapter modules — never in `planning-generator.ts` (Invariant I-8).

### 10.3 The non-negotiable pipeline

```
outcome
  └─ resolvePlanningAdapter()  ──▶  PlanningAdapter.generate(input)
                                        │
                                        ▼
                              PlanningGenerationResult
                                        │  (success)
                                        ▼
                       validatePlanningDraftQuality(draft)   ← quality gate (§11)
                                        │  (zero issues)
                                        ▼
                              grounding / scope check
                                        │  (passes)
                                        ▼
                      reviewable PlanningDraft  →  CEO / autonomy review (§12)
                                        │  (approved)
                                        ▼
                         idempotent apply → real work records
```

AI output is **not privileged**: a draft from the AI provider enters this pipeline at exactly the same point as a deterministic draft and must clear exactly the same gates. AI output that fails the quality gate or grounding check **never** becomes a reviewable draft; the deterministic baseline is used instead (Invariant I-4, I-5).

---

## 11. The Quality Gate

Before any draft — deterministic or AI — can become reviewable, it MUST pass `validatePlanningDraftQuality(draft)`, which returns a list of `PlanningDraftQualityIssue`. **An empty list means pass; any issue means the draft is rejected.**

The gate enforces, at minimum, that a draft has:

- at least one generated project, each project with milestones, and each milestone with acceptance criteria;
- at least one generated feature, each with acceptance criteria and an owner role;
- at least one generated task, each with a sufficiently long description (for implementation agents), at least two acceptance criteria, a recommended role, definition-of-done guidance, and required context;
- a non-empty set of risks, dependencies, assumptions, and open CEO questions;
- a review plan with checkpoints, a QA plan with required checks, and a release plan with readiness criteria.

**Grounding** complements the quality gate: a draft's claims must be consistent with the provided `OutcomePlanningInput` (the outcome, constraints, employee pool, and repository context). A draft that invents capabilities or repository facts not supported by its input is not grounded and is rejected. The quality gate and grounding together are what make AI output safe to surface (Invariant I-4).

---

## 12. Permissions and Autonomy Gates

Automated work is governed by the company's **autonomy level**, normalized to one of five values (`normalizeAutonomyLevel`, safest-default `manual`): **manual → suggest → assist → delegate → autonomous**. There is a **single source of truth** for what each level permits — the `AUTONOMY_POLICY_MATRIX` in `src/lib/autonomy-policy.ts` — used identically by the manual UI and the continuous driver (Invariant I-11).

Each automatable action (`AutonomyAction`) — `create_session`, `run_agent`, `push`, `open_pr`, `auto_merge`, `auto_review`, `auto_qa` — maps, per level, to one disposition (`AutonomyDisposition`):

- **`allow`** — may proceed immediately, no checkpoint.
- **`requires_approval`** — permitted, but a CEO approval **checkpoint** must clear first.
- **`deny`** — never permitted at this level.

| Action | manual | suggest | assist | delegate | autonomous |
|---|---|---|---|---|---|
| `create_session` | approval | allow | allow | allow | allow |
| `run_agent` | approval | approval | approval | allow | allow |
| `push` | approval | approval | allow | allow | allow |
| `open_pr` | approval | approval | allow | allow | allow |
| `auto_merge` | deny | deny | approval | approval | allow |
| `auto_review` | approval | approval | approval | allow | allow |
| `auto_qa` | approval | approval | approval | allow | allow |

When an action's disposition is `requires_approval`, the flow **pauses** and creates an `ApprovalCheckpoint` (`createApprovalCheckpoint` / `evaluateAutonomyCheckpoint`): a `decision` notification fires, the Inbox surfaces a "Needs your approval" item with **Approve / Reject**, and approving (`approveCheckpoint`) resumes the flow through the real services while rejecting (`rejectCheckpoint`) stops it. This is the same code path whether the pause originated from the manual UI or the driver.

**Verified behavior.** At `assist`, the loop opens a real PR and then **pauses for CEO review** (`auto_review` requires approval). At `autonomous`, the same code with the same guardrails opens a PR and **auto-advances review → QA → done** with no human checkpoint. The only difference between the two runs is the autonomy level — never the safety machinery (§13). Autonomy can relax *approval* gates; it can never relax *guardrails* (Invariant I-10).

---

## 13. Execution Guardrails

Guardrails are **always on**, independent of the agent's permission mode and independent of the autonomy level. They are enforced **before** any push (`runAllGuardrails`, `checkFileGuardrails`, `checkBranchGuardrail`, `checkCommandGuardrail` in `src/lib/repository-guardrails.ts`). A blocked run **fails the session** and records the offending paths/commands in the execution audit trail (Invariant I-12).

- **Protected paths** (`PROTECTED_FILE_PATTERNS`) — never written: `.env*`, key/cert files (`*.key`, `*.pem`, `*.p12`, `*.pfx`), `prisma/migrations/**`, `.github/workflows/**`, lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), and secret/credential directories.
- **Protected branches** (`PROTECTED_BRANCHES`) — never targeted directly: `master`, `main`, `release/*`, `hotfix/*`. Implementation work happens on session branches and reaches protected branches only through PR + the autonomy-gated merge action.
- **Dangerous commands** — unconditionally blocked: `rm -rf` (recursive force delete), `git push --force` / `--force-with-lease`, `git reset --hard`, `DROP TABLE`, and unbounded `DELETE FROM`.

Every command, file touch, guardrail block, and final outcome is recorded in a per-session **execution audit trail** for CEO inspection.

---

## 14. Events, State Machines, and Memory

The runtime is event-driven. A significant happening — outcome submitted, plan approved, task assigned, review requested, QA passed, release completed, decision recorded — is an **event** ([EVENT_MODEL.md](./EVENT_MODEL.md)). Events are the only sanctioned way to fan out to the **timeline**, **notifications**, **reporting**, and durable **memory** ([MEMORY_ENGINE_ARCHITECTURE.md](./MEMORY_ENGINE_ARCHITECTURE.md)).

Every state change a work item undergoes must be a legal transition in [STATE_MACHINES.md](./STATE_MACHINES.md): no skipped states, no forbidden transitions, and terminal states stay terminal. Result ingestion after an agent run moves a task to `in-review` with commit/PR metadata and a timeline entry; from there the autonomy level (§12) decides whether review → QA → done advances automatically or pauses for approval. Company Intelligence ([COMPANY_INTELLIGENCE.md](./COMPANY_INTELLIGENCE.md)) reads this same event/runtime state to detect stuck work and waiting approvals and to recommend the CEO's next action.

---

## 15. Invariants

These are the binding, testable rules of Engineering OS. They are numbered for reference and are intended to be enforced by automated tests (§16). Each cites the section that defines it.

- **I-1 — Company isolation.** Every object is company-scoped; there is no cross-company read or write path. *(§3, §6)*
- **I-2 — No work without an approved draft.** No real Project, Feature, Task, Review, QAResult, or Release record is created except by applying an approved `PlanningDraft`. Generated plan items inside a draft are not work records. *(§5, §9.3)*
- **I-3 — Unplannable outcomes fail honestly.** An empty, too-short, vague, or out-of-scope outcome yields a `PlanningGenerationFailure` with `openCeoQuestions`; no draft is fabricated. *(§9.1)*
- **I-4 — AI never bypasses the quality gate or grounding.** An AI-produced draft must pass `validatePlanningDraftQuality` (zero issues) **and** the grounding check before it can become reviewable; failing either, the deterministic baseline is used. *(§10.3, §11)*
- **I-5 — Deterministic is always the fallback.** The deterministic adapter is always available, performs no LLM I/O, and is the fallback for the AI adapter, so AI planning can never produce a worse result than the baseline. *(§10.1)*
- **I-6 — Apply is idempotent and traceable.** Applying the same approved draft more than once never creates duplicate work records, and every applied record traces back to its source Outcome and PlanningDraft. *(§9.3)*
- **I-7 — No `done` without approved review and passing QA.** A task cannot reach `done` without a recorded approved Review and passing QA. *(§5, §14)*
- **I-8 — The generator core is AI-free.** `src/lib/planning-generator.ts` contains no `Claude`/`OpenAI`/`generateText`/`streamText`/`fetch(` references; all AI wiring, the `"ai-claude"` string, and the AI version constant live only in the provider/adapter modules. *(§10.2)*
- **I-9 — Repository facts are evidenced.** Repository detection records evidence paths and confidence rather than overstating certainty; missing metadata is recorded as a gap, not guessed. *(§8)*
- **I-10 — Autonomy relaxes approvals, never guardrails.** A higher autonomy level may remove *approval checkpoints* but can never disable an execution guardrail. *(§12, §13)*
- **I-11 — One autonomy source of truth.** Manual UI and the continuous driver evaluate the same `AUTONOMY_POLICY_MATRIX`; there is no second, divergent policy. *(§12)*
- **I-12 — Guardrails enforced before push.** Protected-path, protected-branch, and dangerous-command guardrails run before any push, independent of the agent's permission mode; a violation fails the session and is recorded in the audit trail. *(§13)*
- **I-13 — Events are the only fan-out path.** Timeline, notifications, reporting, and durable memory are updated only via recorded events; state changes follow legal State Machine transitions. *(§14)*
- **I-14 — Single ownership.** Every unit of work has exactly one accountable owner. *(§4)*
- **I-15 — Spec gates real AI.** No real-AI behavior ships before the company, repository, and decision models are specified by this document. *(§1)*

---

## 16. Conformance and Testability

Each invariant in §15 maps to enforcement that already exists or is required of any new implementation:

| Invariant | How it is (or must be) verified |
|---|---|
| I-2, I-3, I-6 | Planning generation and apply suites (`planning-generator.test.ts`, planning application integration suites) |
| I-4, I-5 | Provider-resolution + quality-gate tests over `validatePlanningDraftQuality` and `resolvePlanningAdapter` |
| I-7 | Acceptance-gate / review + QA state-machine tests |
| I-8 | The standing source-scan test asserting `planning-generator.ts` has no AI references |
| I-10, I-11 | `autonomy-policy.test.ts` over the matrix; driver/manual parity tests |
| I-12 | `repository-guardrails.test.ts` and `worker-audit-log.test.ts` |
| I-13 | Event-model / timeline / notification tests |

The total suite size is reported by `npm run test:count`; the full pipeline (and the verified-live loop) is exercised end-to-end via `npm run dogfood:local` and the real live run in `scripts/DOGFOOD.md`. Any change that would violate an invariant must either be rejected or accompanied by a CTO-approved Decision Record amending this specification.

---

## 17. Glossary

- **Outcome** — the CEO's requested result; the single entry point for new work.
- **PlanningDraft** — a reviewable, not-yet-applied plan; contains generated (non-record) plan items.
- **Generated plan item** — a `project:` / `feature:` / `task:` entry inside a draft, addressed by `planItemId`; not a work record.
- **Apply** — the idempotent step that turns an approved draft into real Project/Feature/Task records.
- **PlanningAdapter** — the provider-independent generation contract (`generate(input) → PlanningGenerationResult`).
- **Quality gate** — `validatePlanningDraftQuality`; zero issues required for a draft to become reviewable.
- **Grounding** — the check that a draft's claims are supported by its `OutcomePlanningInput`.
- **Autonomy level** — one of manual / suggest / assist / delegate / autonomous; governs approval gates.
- **Approval checkpoint** — a CEO Approve/Reject gate created when an action `requires_approval`.
- **Guardrail** — an always-on, pre-push safety rule on paths, branches, and commands.
- **Runtime** — the live operational state of the company (distinct from the event log).

---

*This specification binds the architecture documents into one canonical contract. It is the gate that unlocks real-AI planning: until an AI provider's output can be shown to satisfy the Planning Contract (§9), the Quality Gate (§11), and every invariant in §15, the deterministic baseline remains the only path to a reviewable plan.*
