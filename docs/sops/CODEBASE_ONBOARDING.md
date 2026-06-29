# SOP: Codebase Onboarding

**SOP ID:** SOP-007  
**Category:** Standard Operating Procedure  
**Owner:** Tech Lead (operational) · CTO (accountable)  
**Version:** 1.0  
**Status:** Approved  
**Last Updated:** 2026-06-29  

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Trigger](#2-trigger)
3. [Owner](#3-owner)
4. [Participants](#4-participants)
5. [Preconditions](#5-preconditions)
6. [Minimum Understanding Standard](#6-minimum-understanding-standard)
7. [Discovery Workflow](#7-discovery-workflow)
8. [Architecture Notes](#8-architecture-notes)
9. [Dependency Notes](#9-dependency-notes)
10. [Risks and Unknowns](#10-risks-and-unknowns)
11. [Ownership Mapping](#11-ownership-mapping)
12. [Output Artifacts](#12-output-artifacts)
13. [Decision Gates Summary](#13-decision-gates-summary)
14. [Escalation Rules](#14-escalation-rules)
15. [Definition of Done](#15-definition-of-done)
16. [Memory Updates](#16-memory-updates)
17. [KPIs](#17-kpis)
18. [Failure Modes](#18-failure-modes)
19. [Anti-Patterns](#19-anti-patterns)
20. [Relationship to Other Documents](#20-relationship-to-other-documents)

---

## 1. Purpose

This procedure defines how Engineering OS studies a codebase **before** it performs work on it. Codebase onboarding is the discipline that produces a trustworthy, current model of a Repository — its structure, stack, data layer, operational commands, risks, and ownership — and records that model as durable [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md) the company can plan and build against.

Every engineer, reviewer, and execution agent must be able to answer one question before touching code: **what is true about this codebase right now, and what must I respect while changing it?** A company that re-derives repository facts on every task is slow and error-prone. A company that onboards a codebase once, records what it learned, and refreshes that record when the code moves, plans accurately and fails fast on bad environments instead of mid-flight.

This SOP is the front of the delivery chain. It runs once when a Repository is first connected, and it runs again whenever the codebase has drifted far enough that the recorded knowledge can no longer be trusted. The [New Feature](./NEW_FEATURE.md) and [Bug Fix](./BUG_FIX.md) procedures assume this procedure has already produced current Repository Knowledge; they do not re-derive it.

Onboarding is not optional warm-up. Work that begins on a codebase the company has not onboarded is work performed blind. Deviation from this procedure is not a shortcut — it is a failure of process that must be documented and reviewed.

---

## 2. Trigger

This procedure is triggered when one of the following occurs:

- A new Repository is connected to a Company and has not yet been onboarded.
- An existing Repository's recorded knowledge is stale: the last analysis snapshot is older than the staleness threshold, or a significant change has been detected that invalidates prior facts (see [Repository Analysis Snapshots](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md)).
- A CEO outcome is submitted that targets a Repository whose Repository Knowledge is missing required facts for planning.
- The Tech Lead or CTO determines that planning or execution failures trace back to an incomplete or inaccurate model of the codebase.
- A previously failed onboarding (missing manifest, unknown package manager, checkout failure) is being retried after the blocking condition is resolved.

---

## 3. Owner

**Tech Lead** — owns the procedure end-to-end operationally: ensuring discovery runs, that each required fact is captured or explicitly marked unknown, that risks are recorded, and that ownership is mapped before any work is briefed against the Repository.

**CTO** — accountable authority for Repository Knowledge per the [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md) ownership rules. The CTO ratifies architecture findings, approves the risk posture, and authorizes work to begin on a Repository onboarded with open high-severity risks.

No Repository proceeds to a Feature Brief or an execution session without a Tech Lead who can describe what the codebase is. If the Tech Lead cannot answer the minimum-understanding questions in §6, the Repository is not onboarded.

---

## 4. Participants

| Role | Responsibility in this SOP |
|---|---|
| **CTO** | Accountable owner of Repository Knowledge; ratifies architecture model; approves risk posture; authorizes work on a Repository with open high-severity risks |
| **Tech Lead** | Operational owner; drives discovery; confirms the minimum-understanding standard; maps ownership; signs off that the Repository is ready for work |
| **Backend Engineer** | Reviews data layer, ORM, schema, migrations, and API surface for correctness; flags tenant-ownership and migration risks |
| **Frontend Engineer** | Reviews route/page/layout surface, rendering model, and client/server boundaries for public-facing repositories |
| **Infrastructure Engineer** | Reviews runtime, build, and environment requirements; confirms how the repository is provisioned and deployed |
| **DevOps Engineer** | Confirms checkout, validation commands (typecheck/lint/build/test), and CI/pipeline configuration; verifies the repository can be built and validated reproducibly |
| **Security Engineer** | Reviews secret references, credential handling, protected paths, and dependency vulnerability signals (engaged when the security review trigger conditions are met) |
| **QA Engineer** | Confirms test presence, test commands, and coverage signals; identifies validation gaps that constrain future Definition of Done |
| **Technical Writer** | Records the onboarding summary into Repository Knowledge; ensures the model is written, indexed, and findable |

Not every participant is required for every Repository. The Tech Lead engages specialists by what the discovery reveals — a backend-only service does not require a Frontend Engineer; a repository with no detected secrets and no security-relevant surface does not require a Security Engineer review beyond the standard scan. The Tech Lead documents which participants were engaged and why.

---

## 5. Preconditions

Before this procedure begins, all of the following must be true:

- [ ] The Repository is connected to the Company through a first-class integration with valid, in-scope credentials (see the integration authentication surface).
- [ ] The Repository can be checked out to a working path the analyzer can read.
- [ ] The Tech Lead is assigned and available to own the onboarding.
- [ ] No work (Feature Brief, task decomposition, execution session) has been briefed against the Repository that depends on knowledge this procedure produces.

If the Repository cannot be checked out, onboarding does not proceed — the checkout failure is recorded as a blocking risk and escalated per §14. A Repository that cannot be read cannot be understood.

---

## 6. Minimum Understanding Standard

This is the bar. A Repository is **not onboarded** until the company can answer every question below from recorded facts — not from assumption, and not from an agent re-deriving them at execution time. These map directly to the "What Must Be Known Before Work Starts" rules in [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md).

| # | Question | Recorded as |
|---|---|---|
| 1 | What is the primary language and framework, and which router/rendering style? | Stack facts |
| 2 | What package manager governs dependencies, and is the manifest present and parseable? | Stack facts; risk if absent |
| 3 | What is the top-level structure — the directories and the files that matter most? | Structure facts |
| 4 | What is the data layer — ORM, schema location, migrations, detected models? | Data-layer facts |
| 5 | What is the public/API surface — pages, layouts, route handlers, server actions, middleware, entry points? | Surface facts |
| 6 | What commands prove the work — typecheck, lint, build, test — and do they exist? | Operations facts; risk if absent |
| 7 | What paths must never be touched (secrets, lockfiles, migrations, CI workflows)? | Protected-path policy |
| 8 | What risks and unknowns exist, with severity and evidence? | Risk findings |
| 9 | Who owns this Repository and which specialists must review changes to which areas? | Ownership map |

A fact that is genuinely not determinable is recorded as **unknown**, not guessed. An explicit unknown is a managed risk; an invented fact is a latent failure. Inventing repository capability — fake intelligence, fake commands, fake structure — is a hard project rule violation and is never done here.

The minimum-understanding standard is binary per Repository: either all nine answers exist (each as a fact or an explicit unknown with a recorded risk) or the Repository is not ready for work.

---

## 7. Discovery Workflow

### Phase 1: Acquire and Analyze

**Owner:** Tech Lead (coordination); DevOps Engineer (checkout/environment)  
**Input:** Connected Repository; valid credentials  
**Output:** A completed analysis snapshot, or a recorded failure with the blocking reason  

**Steps:**

1. **DevOps Engineer** checks out the Repository to a working path the analyzer can read. If checkout fails, the failure is recorded and the procedure halts at this phase (escalate per §14).
2. **Tech Lead** runs repository analysis against the checked-out path. The analyzer ingests the file tree, detects the package manager and dependencies, detects the framework/router/route/API surface, detects the database/ORM/schema, identifies test files, and records risk findings.
3. The analysis is persisted as a durable **analysis snapshot** belonging to the Repository and Company — never as an overwrite of prior metadata. Snapshots are point-in-time records that allow later comparison rather than destruction of history (see [Repository Analysis Snapshots](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md)).
4. On success, the snapshot is marked `completed` and the Repository summary metadata is updated. On failure, a `failed` snapshot is persisted with the analyzer error and the Repository is marked `failed`.

**Gate 1:** A `completed` analysis snapshot exists for the Repository, or a `failed` snapshot is recorded with a blocking reason that has been escalated.

---

### Phase 2: Verify the Model

**Owner:** Tech Lead  
**Input:** Completed analysis snapshot  
**Output:** Verified architecture, dependency, and data-layer notes  

**Steps:**

1. **Tech Lead** reviews the analyzer output against the minimum-understanding standard (§6) and confirms each of the nine answers is present as a fact or an explicit unknown.
2. **Backend Engineer** (when a data layer or API surface exists) verifies the detected ORM, schema paths, migrations, and models, and confirms tenant-ownership assumptions (§9, §10).
3. **Frontend Engineer** (for public-facing repositories) verifies the detected route/page/layout surface and the client/server boundary.
4. **Infrastructure Engineer** confirms the runtime, build requirements, and how the repository is provisioned.
5. **Tech Lead** records architecture notes (§8), dependency notes (§9), and reconciles any discrepancy between what the analyzer detected and what the specialists observe. A discrepancy is itself recorded — either the model is corrected or the divergence is logged as an unknown.

**Gate 2:** Architecture, dependency, and data-layer notes are verified by the relevant specialists. Discrepancies are resolved or recorded as unknowns.

---

### Phase 3: Validate the Environment

**Owner:** DevOps Engineer (execution); QA Engineer (validation signals)  
**Input:** Verified model  
**Output:** Confirmed validation commands and protected-path policy  

**Steps:**

1. **DevOps Engineer** confirms the validation commands the company will rely on to prove work — typecheck, lint, build, test. A command that does not exist is recorded as an absent-command risk, not assumed.
2. **QA Engineer** confirms test presence and coverage signals and identifies validation gaps that will constrain the Definition of Done for future work in this Repository (see [QA Validation](./QA_VALIDATION.md)).
3. **Tech Lead** confirms the protected-path policy for the Repository: paths that must never be modified or pushed — secrets and `.env*`, lockfiles, `prisma/migrations/**`, `.github/workflows/**`, and any repository-specific sensitive paths. This policy becomes a guardrail for every future execution session and is enforced independent of any agent's permission mode.

**Gate 3:** Validation commands are confirmed (or absences recorded as risks). The protected-path policy is recorded.

---

### Phase 4: Assess Security Surface

**Owner:** Security Engineer (when engaged); Tech Lead (triage)  
**Input:** Verified model; dependency notes  
**Output:** Security risk findings; secret-reference inventory  

**Steps:**

1. **Tech Lead** triages whether the Repository meets the security review trigger conditions (handles credentials, exposes a public surface, processes untrusted input, or carries known-vulnerable dependencies).
2. **Security Engineer** (when triggered) reviews secret references, credential handling, protected paths, and dependency vulnerability signals, and records findings per the [Security Decision Framework](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md).
3. Findings are classified by severity and recorded as risks (§10). A high-severity security finding blocks work until resolved or until the CTO authorizes proceeding with a documented mitigation.

**Gate 4:** Security surface is assessed (or explicitly determined out of trigger scope). High-severity findings are recorded and routed.

---

### Phase 5: Map Ownership and Record Knowledge

**Owner:** Tech Lead (ownership); Technical Writer (recording)  
**Input:** Verified model; risks; security findings  
**Output:** Ownership map; Repository Knowledge written and indexed  

**Steps:**

1. **Tech Lead** produces the ownership map (§11): the responsible role for the Repository overall and the specialist reviewers required for each sensitive area (data layer, security surface, infrastructure, public surface).
2. **Technical Writer** records the onboarding summary into [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md): structure, stack, surface, data layer, operations, risks, and ownership — derived only from recorded facts, never guessed. The record is indexed and findable.
3. **Tech Lead** signs off that the Repository meets the minimum-understanding standard and is ready for work, or marks it not-ready with the specific blocking items.
4. **CTO** ratifies the model and approves the risk posture. For a Repository with open high-severity risks, the CTO explicitly authorizes (or withholds) the start of work.

**Gate 5:** Repository Knowledge is written and indexed. Ownership is mapped. The Tech Lead has signed off and the CTO has ratified the model and risk posture.

---

## 8. Architecture Notes

Architecture notes are the company's structural model of the codebase. They are recorded as facts with evidence, and they answer questions 1–5 of the minimum-understanding standard. Required content:

| Note | Content |
|---|---|
| Language and framework | Primary language; framework and version; router/rendering style |
| Structure | Top-level directories; file categories; the files that matter most (entry points, config, schema) |
| Surface | Pages, layouts, API route handlers, server-action modules, middleware, entry points |
| Data layer | ORM technology; schema path(s); migration directory; detected models; seed files |
| Boundaries | Client/server split; module boundaries; where business logic concentrates |
| Build and runtime | How the repository builds; the runtime it targets; environment requirements |

Architecture notes describe what is **structurally** true. The platform captures structural and manifest-level facts; it does not execute or semantically interpret business logic at runtime. Where deeper behavior is asserted, it is attributed to a specialist's manual review, not to the analyzer.

---

## 9. Dependency Notes

Dependency notes record what the codebase depends on and how those dependencies are governed. Required content:

| Note | Content |
|---|---|
| Package manager | The detected package manager; whether the manifest and lockfile are present and parseable |
| Runtime dependencies | Production dependencies of note; framework and data-layer libraries |
| Dev dependencies | Tooling: typecheck, lint, test, build chains |
| Validation commands | The concrete commands that prove the work (typecheck/lint/build/test); whether each exists |
| External services | Detected integrations and external service dependencies (auth, hosting, providers) |
| Vulnerability signals | Known-vulnerable dependency signals routed to the Security Engineer |

A missing manifest, an unknown package manager, or absent validation commands are recorded as risks the moment they are detected (§10) — never quietly assumed. A dependency the company cannot name is a dependency it cannot reason about during planning or impact analysis.

---

## 10. Risks and Unknowns

Identifying risks and unknowns is a primary deliverable of onboarding, not a side effect. Every onboarding produces a risk register; an onboarding that finds no risks has almost certainly not looked hard enough.

Risks are classified by severity, with evidence and a mitigation, following the [Risk Analysis Decision Framework](../decision-frameworks/RISK_ANALYSIS_DECISION_FRAMEWORK.md):

| Severity | Meaning | Effect on work |
|---|---|---|
| **High** | Could cause data loss, security exposure, or unsafe automated change | Blocks work until resolved or CTO-authorized with a documented mitigation |
| **Medium** | Materially raises the chance of incorrect or unsafe change | Work proceeds only with the mitigation recorded and assigned |
| **Low** | Notable but does not threaten correctness or safety | Documented; addressed opportunistically |

Common onboarding risk categories: missing or unparseable manifest; unknown package manager; absent tests or validation commands; absent or undocumented migrations; tenant-ownership ambiguity in the data layer; secret references in tracked files; known-vulnerable dependencies; structural sprawl with no clear entry point; checkout or build failure.

**Unknowns are first-class.** Anything the company cannot determine is recorded as an explicit unknown with the question it leaves open. An explicit unknown is a managed risk that planning can route around; a silent gap is an ambush. The rule is absolute: record the unknown, never invent the fact.

---

## 11. Ownership Mapping

Onboarding establishes accountability for the Repository before any change is made to it. The ownership map records:

| Mapping | Content |
|---|---|
| Repository owner | The role accountable for this Repository's health (default: Tech Lead, operational; CTO, accountable) |
| Data-layer reviewer | The role that must review schema, migration, and model changes (Backend Engineer) |
| Security reviewer | The role that must review security-relevant changes (Security Engineer), and the trigger conditions |
| Infrastructure reviewer | The role that must review runtime/build/deploy changes (Infrastructure Engineer) |
| Public-surface reviewer | The role that must review route/page/UI changes for public repositories (Frontend Engineer) |
| Validation owner | The role accountable for the Repository's test and validation signals (QA Engineer) |

The ownership map follows the company's permanent organizational rule of **one owner, clear accountability**. It feeds directly into the participant routing of [New Feature](./NEW_FEATURE.md), [Bug Fix](./BUG_FIX.md), and [Code Review](./CODE_REVIEW.md): when a change touches a sensitive area, the mapped reviewer is required, not optional.

---

## 12. Output Artifacts

The following artifacts are produced and retained as outputs of this procedure:

| Artifact | Owner | Created In |
|---|---|---|
| Repository analysis snapshot | Tech Lead | Phase 1 |
| Architecture notes | Tech Lead | Phase 2 |
| Dependency notes | Tech Lead | Phase 2 |
| Validation-command and protected-path policy | DevOps Engineer / Tech Lead | Phase 3 |
| Security findings and secret-reference inventory | Security Engineer | Phase 4 |
| Risk register (with severities, evidence, mitigations, unknowns) | Tech Lead | Phases 1–4 |
| Ownership map | Tech Lead | Phase 5 |
| Repository Knowledge record | Technical Writer | Phase 5 |
| Onboarding sign-off and CTO ratification | Tech Lead / CTO | Phase 5 |

The durable, authoritative output is the **Repository Knowledge record**. The snapshot is its evidentiary baseline and the source for change/impact analysis on the next onboarding (see [Repository Impact Analysis](../architecture/REPOSITORY_IMPACT_ANALYSIS.md)).

---

## 13. Decision Gates Summary

| Gate | Condition | Owner of Gate |
|---|---|---|
| Gate 1 | A `completed` analysis snapshot exists (or a `failed` snapshot is recorded and escalated) | Tech Lead |
| Gate 2 | Architecture, dependency, and data-layer notes verified; discrepancies resolved or recorded | Tech Lead |
| Gate 3 | Validation commands confirmed; protected-path policy recorded | DevOps Engineer |
| Gate 4 | Security surface assessed; high-severity findings recorded and routed | Security Engineer / Tech Lead |
| Gate 5 | Repository Knowledge written and indexed; ownership mapped; sign-off and CTO ratification complete | CTO |

A gate that cannot be passed stops onboarding. The Repository does not advance to work with an open gate; the blocking condition is recorded and escalated (§14).

---

## 14. Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| Repository cannot be checked out or analyzed | CTO, DevOps Engineer | Checkout/analysis failure recorded |
| High-severity risk found and work is requested anyway | CTO | Before any work is briefed against the Repository |
| Missing manifest, unknown package manager, or absent validation commands | Tech Lead → CTO | When the gap blocks accurate planning |
| Tenant-ownership ambiguity or destructive-migration risk in the data layer | Backend Engineer → CTO | When detected |
| Secret references found in tracked files | Security Engineer → CTO | Immediately on discovery |
| Specialist review contradicts the analyzer model and cannot be reconciled | Tech Lead → CTO | When the discrepancy affects safety or planning |
| Onboarding is being skipped to start work faster | CTO | The moment skipping is proposed |

Escalations are recorded in the onboarding record. A Repository onboarded with an open high-severity risk proceeds to work **only** on documented CTO authorization with a recorded mitigation — never on informal agreement that the risk is acceptable.

---

## 15. Definition of Done

Codebase onboarding is done when all of the following are true:

- [ ] A `completed` analysis snapshot exists for the Repository.
- [ ] Every question in the Minimum Understanding Standard (§6) is answered as a recorded fact or an explicit unknown.
- [ ] Architecture notes and dependency notes are recorded and verified by the relevant specialists.
- [ ] Validation commands are confirmed (or their absence recorded as a risk).
- [ ] The protected-path policy is recorded for the Repository.
- [ ] Security surface is assessed (or explicitly determined out of trigger scope); high-severity findings are recorded and routed.
- [ ] A risk register exists with severities, evidence, mitigations, and explicit unknowns.
- [ ] The ownership map is recorded.
- [ ] Repository Knowledge is written, indexed, and findable.
- [ ] The Tech Lead has signed off and the CTO has ratified the model and risk posture.
- [ ] No fact in the record was guessed; every unknown is recorded as an unknown.

A Repository that does not meet this Definition of Done is not ready for a Feature Brief, task decomposition, or an execution session.

---

## 16. Memory Updates

After each onboarding, the following memory records are written or refreshed:

| Record | Content | Owner |
|---|---|---|
| Repository Knowledge | Structure, stack, surface, data layer, operations, risks, ownership | Technical Writer |
| Repository analysis snapshot | Point-in-time analyzer output retained for comparison | Tech Lead |
| Risk register | Risks and unknowns with severity, evidence, mitigation | Tech Lead |
| Ownership map | Repository owner and area reviewers | Tech Lead |
| Decision records (when applicable) | Architectural facts the company will rely on; rationale for a risk acceptance | CTO / Tech Lead |

Repository Knowledge is governed by the same write-once-trust-forever discipline as the rest of organizational memory, narrowed to a single Repository. A subsequent onboarding does not overwrite history — it adds a new snapshot and updates the record, so the company can reason about how the codebase changed (see [Repository Impact Analysis](../architecture/REPOSITORY_IMPACT_ANALYSIS.md)).

---

## 17. KPIs

| KPI | Target | Measured By |
|---|---|---|
| Onboarding completion before work | 100% — no work is briefed against a Repository that has not met the Definition of Done | Onboarding records |
| Minimum-understanding coverage | 100% — every required fact is recorded or marked explicitly unknown | Repository Knowledge audit |
| Guessed-fact rate | Zero — no recorded fact was invented | Repository Knowledge audit |
| Risk capture | Every onboarding produces a risk register; unknowns are explicit | Onboarding records |
| Knowledge freshness | Repository Knowledge re-onboarded before it crosses the staleness threshold | Snapshot timestamps |
| Plan-time surprises | Decreasing — planning failures traceable to missing repository facts trend to zero | Planning records |
| Execution-time guardrail blocks from undiscovered protected paths | Zero — protected-path policy is complete at onboarding | Execution audit trail |

---

## 18. Failure Modes

### Work begins on a codebase that was never onboarded
A CEO outcome arrives, the team is eager to move, and planning starts against a Repository with no recorded knowledge. The planner decomposes work it cannot verify; the execution agent re-derives structure at runtime and runs commands that may not exist. Caught when: a plan references files or commands that are not in the codebase, or an execution session fails on a missing validation command.

**Response:** Onboarding is the front of the chain. No Feature Brief, task decomposition, or execution session is briefed against a Repository that has not met the Definition of Done. The trigger conditions (§2) exist precisely so this is never a judgment call.

### Facts are guessed instead of recorded as unknown
The analyzer cannot determine the test command, so someone assumes the conventional default and records it as fact. Later an execution session runs a command that does not exist and fails. Caught when: a recorded "fact" turns out to be false during execution.

**Response:** A fact that is not determinable is recorded as an explicit unknown, never guessed. Inventing repository capability is a hard project-rule violation. An explicit unknown is a managed risk; an invented fact is a latent failure that surfaces at the worst time.

### Risks discovered but not recorded
Discovery surfaces a tenant-ownership ambiguity or a destructive-migration path, but it is mentioned verbally and never written into the risk register. The next engineer or agent has no way to know. Caught when: an incident traces back to a risk that someone "knew about" but never recorded.

**Response:** Identifying risks and unknowns is a primary deliverable, not a side conversation. Every risk is recorded with severity, evidence, and mitigation. A risk that is not written does not exist as far as the company's future behavior is concerned.

### Stale knowledge trusted as current
A Repository was onboarded months ago. The codebase has since changed substantially, but planning still reads the old model. Plans reference a structure that no longer exists. Caught when: impact analysis between the old snapshot and reality shows large unexplained drift, or plans fail against the current code.

**Response:** Repository Knowledge has a staleness threshold and a re-onboarding trigger (§2). When the code drifts far enough, the Repository is re-onboarded — a new snapshot is taken, the record is refreshed, and the change is reasoned about explicitly. Trust in recorded knowledge is conditional on freshness.

### Protected-path policy incomplete at onboarding
A repository-specific sensitive path is not added to the protected-path policy during onboarding. An execution session later modifies it before the guardrail catches a generic pattern. Caught when: a guardrail block or, worse, a near-miss involves a path that should have been protected from the start.

**Response:** The protected-path policy is a required Phase 3 output and a Definition-of-Done item. Onboarding is where the company learns what must never be touched in this specific Repository; that policy then enforces on every future session independent of any agent's permission mode.

---

## 19. Anti-Patterns

**"We'll figure out the codebase as we build."** Discovery is not something that happens incidentally during implementation. A company that learns the structure of a codebase by breaking it is slow, error-prone, and dangerous near data and migrations. Onboarding front-loads understanding so that work is briefed against facts, not assembled against surprises.

**Treating the analysis snapshot as the deliverable.** The snapshot is evidence; the deliverable is verified, recorded Repository Knowledge with a risk register and an ownership map. An onboarding that produces a snapshot nobody reviewed, with risks nobody recorded and ownership nobody mapped, has produced a file, not understanding.

**Recording optimism instead of facts.** "It's a standard Next.js app, the commands are probably the usual ones" is not a fact — it is a hope. Every entry in Repository Knowledge is a detected fact or an explicit unknown. Confidence is not evidence.

**Skipping specialist verification because the analyzer "looked right."** The analyzer captures structural and manifest-level facts; it does not interpret business logic, tenant ownership, or runtime behavior. The Backend Engineer verifying the data layer and the Security Engineer reviewing secret handling exist because the analyzer's view is structural and incomplete. Their review is part of the procedure, not a courtesy.

**Onboarding once and never refreshing.** A codebase is a moving target. Repository Knowledge that is written once and trusted forever, regardless of how far the code has moved, becomes a fiction the company plans against. Freshness is a property of trustworthy knowledge, and re-onboarding is the mechanism that maintains it.

---

## 20. Relationship to Other Documents

| Document | Relationship |
|---|---|
| [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md) | The authoritative model this procedure produces and refreshes; defines the required facts and the write/validate rules |
| [Repository Analysis Snapshots](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md) | The point-in-time evidence captured in Phase 1 and retained for comparison |
| [Repository Impact Analysis](../architecture/REPOSITORY_IMPACT_ANALYSIS.md) | How re-onboarding reasons about change between snapshots |
| [New Feature SOP](./NEW_FEATURE.md) | Consumes onboarded Repository Knowledge; assumes this procedure has run |
| [Bug Fix SOP](./BUG_FIX.md) | Consumes the architecture and ownership model produced here |
| [Code Review SOP](./CODE_REVIEW.md) | Routes changes to the area reviewers identified in the ownership map |
| [QA Validation SOP](./QA_VALIDATION.md) | Builds on the validation-command and test-coverage signals recorded in Phase 3 |
| [Risk Analysis Decision Framework](../decision-frameworks/RISK_ANALYSIS_DECISION_FRAMEWORK.md) | Governs how onboarding risks are classified and acted on |
| [Security Decision Framework](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md) | Governs the Phase 4 security assessment |

This SOP is the entry point of the delivery chain. It produces the understanding every downstream procedure assumes — and refuses to let work begin on a codebase the company cannot yet describe.
