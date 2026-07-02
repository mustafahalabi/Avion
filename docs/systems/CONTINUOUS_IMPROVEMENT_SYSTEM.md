# Continuous Improvement System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

This document defines the Continuous Improvement System: how Engineering OS turns reviews, QA findings, incidents, deployments, and feedback into better future work. It is the behavioral specification for the company's learning loop — the mechanism by which the organization gets measurably smarter with every project rather than repeating the same mistakes.

Continuous improvement is the difference between a company that has done a thousand features and a company that has *learned* from a thousand features. A virtual software company that does not learn is a stateless tool wearing an org chart. This system is what makes the organization compound: each review finding, each QA defect, each incident, and each release leaves a durable signal that future work references and that, when a signal recurs, hardens into a company standard.

This document describes company behavior and the records that behavior produces. It does not prescribe a storage engine, an embedding model, a retraining process, or any implementation-specific persistence choice — those are deliberately treated as replaceable. Where a behavior is already enforced in the platform today, this document says so explicitly and separates it from behavior that is designed but not yet built (see [Section 12](#12-implementation-status)). Inventing capability the platform does not have would violate a hard project rule.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Improvement Sources](#3-improvement-sources)
4. [The Improvement Lifecycle](#4-the-improvement-lifecycle)
5. [From Repeated Pattern to Standard](#5-from-repeated-pattern-to-standard)
6. [Ownership](#6-ownership)
7. [Validation Rules](#7-validation-rules)
8. [Update Rules](#8-update-rules)
9. [Relationship to Memory and Knowledge](#9-relationship-to-memory-and-knowledge)
10. [Retrospectives and Review Cadence](#10-retrospectives-and-review-cadence)
11. [KPIs](#11-kpis)
12. [Implementation Status](#12-implementation-status)
13. [Failure Modes](#13-failure-modes)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

The Continuous Improvement System exists to answer one question for the company as a whole: **what has the company learned that should change how it works next time?**

It serves four purposes:

1. **Convert outcomes into learning.** Every review, QA cycle, incident, and release produces signals. Most are transient. A few are lessons. This system is how the company tells the difference and preserves the lessons.
2. **Stop repeated mistakes.** The first time a defect class appears it is a finding. The second time it is a pattern. The third time it is an organizational failure to learn. This system promotes recurring findings into standards that prevent the next occurrence.
3. **Harden good practice into default behavior.** When an approach proves itself across several features, it stops being a choice an engineer rediscovers each time and becomes the company's standard way of doing the thing.
4. **Make improvement durable, not personal.** A lesson that lives only in one employee's head is lost the moment that employee is not invoked. Improvement here is written into [Memory](ORGANIZATIONAL_MEMORY_SYSTEM.md) and, when authoritative, into the [Knowledge Library](KNOWLEDGE_LIBRARY_SYSTEM.md) so it changes future behavior regardless of who does the work.

Continuous improvement is **not** a periodic ceremony, a metrics dashboard, or a backlog of "tech debt" tickets. Those may be inputs or outputs, but the system itself is the disciplined flow from raw signal to durable company practice.

---

## 2. Scope

This document governs the company-wide learning loop: how signals from completed and failed work become insights, how recurring insights become standards, and who is accountable for each step.

**In scope:**

- The signal sources the company learns from (reviews, QA, incidents, deployments, audit trails, CEO feedback).
- The lifecycle of an improvement: signal → insight → pattern → standard → adoption.
- The rules that decide when a signal is worth recording, when an insight is real, and when a pattern is established enough to become a standard.
- Ownership of each stage and the validation a proposed standard must pass before it binds future work.
- How improvement records relate to Memory and Knowledge, and how standards feed back into [Planning](PLANNING_SYSTEM.md), [Review](REVIEW_SYSTEM.md), and [QA](../sops/QA_VALIDATION.md).

**Out of scope:**

- The mechanics of any individual review, QA validation, or release — owned by the [Review System](REVIEW_SYSTEM.md), [QA_VALIDATION.md](../sops/QA_VALIDATION.md), and [RELEASE.md](../sops/RELEASE.md).
- How memory records are stored, retrieved, and superseded — owned by [ORGANIZATIONAL_MEMORY_SYSTEM.md](ORGANIZATIONAL_MEMORY_SYSTEM.md).
- How authoritative knowledge is curated and published — owned by [KNOWLEDGE_LIBRARY_SYSTEM.md](KNOWLEDGE_LIBRARY_SYSTEM.md).
- Incident response procedure itself — owned by the runtime's recovery path ([COMPANY_RUNTIME.md §31](../architecture/COMPANY_RUNTIME.md#31-recovery-from-failure)) and [ROLLBACK.md](../sops/ROLLBACK.md). This system consumes the *lessons* an incident produces, not its handling.

This system never changes storage technology assumptions. Where it names a concrete record or field, that is the current implementation surface; the rules survive any change of database or retrieval method.

---

## 3. Improvement Sources

The company learns from a defined set of sources. Each produces signals of a characteristic kind, and each has an owner responsible for surfacing the lesson rather than letting it pass.

| Source | Signal it produces | What the company learns | Surfaced by |
|---|---|---|---|
| **Code Review** | Review findings classified `blocker` / `non_blocker` ([REVIEW_SYSTEM.md](REVIEW_SYSTEM.md)) | Recurring quality defects, anti-patterns, missing conventions | Reviewer |
| **QA Validation** | QA defects and check failures against acceptance criteria | Gaps between what is built and what was asked; recurring test blind spots | QA Engineer |
| **Production Incidents** | Incident records (severity, root cause) | Failure classes, missing guardrails, fragile areas of the system | Tech Lead / Monitoring Engineer |
| **Deployments / Releases** | Release outcomes, rollbacks, post-release monitoring | Release-readiness gaps, environment fragility, checklist items that were skipped and mattered | Release Manager |
| **Execution Audit Trail** | Guardrail blocks, denied commands, validation runs from the agent worker | Where autonomous execution hits its limits; recurring guardrail triggers | CTO |
| **Planning Outcomes** | Estimate-vs-actual deviations, scope splits, mid-flight blockers | Where planning is systematically wrong; features that are routinely under-scoped | Tech Lead / Product Manager |
| **CEO Feedback** | Direction, rejections at approval gates, restated outcomes | Where the company's interpretation of intent drifts from what the CEO wanted | Product Manager |

Three rules govern sources:

1. **Every source has an accountable surfacer.** A signal that no role is responsible for noticing is a signal the company will not learn from. The roles above are not optional observers — surfacing the lesson is part of their responsibility.
2. **A signal is only an input, not a conclusion.** A single review finding is not yet a lesson. The lifecycle in [Section 4](#4-the-improvement-lifecycle) is what turns a signal into something durable.
3. **No source is silent.** Verbal "we should do better next time" is not a signal in this system. A signal exists only when it is recorded against the work that produced it.

---

## 4. The Improvement Lifecycle

Every improvement moves through the same five stages. Most signals stop early — and that is correct. The discipline is in recognizing which signals are worth advancing.

```
Signal        a recorded observation from a source (a review finding, a defect, an incident)
  ↓  (is this worth remembering? — write rule)
Insight       a named lesson written as a Memory record: what happened, why, what to do differently
  ↓  (has this happened before? — recurrence check)
Pattern       an insight that has recurred across independent work items, with the instances linked
  ↓  (is this established and validated? — promotion gate)
Standard      a binding company practice published to the Knowledge Library
  ↓  (does future work follow it? — adoption check)
Adoption      the standard is referenced in planning, enforced in review, and checked in QA
```

**Stage definitions and exit criteria:**

- **Signal → Insight.** A signal becomes an insight only if it will change future behavior. A one-off typo caught in review is a signal that dies at this stage; a review finding that reveals the company keeps forgetting a security check is an insight worth writing. The test is the same write rule the Memory System applies: *record it only if a future employee would act differently for having read it.*
- **Insight → Pattern.** An insight becomes a pattern when the same lesson is observed in **two or more independent work items**. The instances are linked so the recurrence is visible and undeniable. A pattern is the company saying, in evidence, "this is not bad luck — this is how we systematically work, and it is costing us."
- **Pattern → Standard.** A pattern becomes a candidate standard once it is established and someone owns proposing the change. Promotion is gated ([Section 5](#5-from-repeated-pattern-to-standard) and [Section 7](#7-validation-rules)) — a pattern does not silently become binding.
- **Standard → Adoption.** A standard is not done when it is published. It is done when future work demonstrably follows it: planning references it, review enforces it, and QA checks for it. A standard that nothing enforces is documentation, not improvement.

**Lifecycle invariants:**

1. Improvement only ever moves forward through evidence. A pattern is not declared from a hunch; it is declared from linked instances.
2. Each stage has an owner ([Section 6](#6-ownership)); no stage advances itself.
3. Stages are durable records, not statuses in someone's memory. An insight that is not written did not happen.

---

## 5. From Repeated Pattern to Standard

This is the core mechanism of the system and the part most companies get wrong. A standard is expensive — it binds all future work — so promotion is deliberate.

**When a pattern is eligible for promotion.** A pattern is eligible to become a standard when **all** of the following hold:

- It has recurred across at least two independent work items, with the instances linked as evidence.
- The proposed change would prevent or reduce the recurrence, not merely describe it.
- The change is within the company's authority to make (it does not require a CEO product decision; if it does, it is escalated, not adopted unilaterally).
- The change is stated as actionable practice, not as a complaint. "We keep shipping N+1 queries" is a pattern; "Every list endpoint must be reviewed for N+1 access and covered by a query-count assertion" is a candidate standard.

**Promotion sequence.**

```
Pattern owner drafts a candidate standard
  ↓
Candidate routed to the authority for its domain (see Section 6 table)
  ↓
Authority validates the candidate against the validation rules (Section 7)
  ↓ (approved)
Technical Writer publishes the standard to the Knowledge Library
  ↓
Prior conflicting standard (if any) is superseded with a link to the new one
  ↓
Standard is wired into the surfaces that enforce it:
  - referenced in Planning so new work accounts for it
  - enforced in Review so violations are caught
  - checked in QA where it is testable
  ↓
Pattern record is marked promoted, linked to the published standard
```

**Types of standard a pattern can become:**

| Pattern domain | Becomes a standard in | Enforced at |
|---|---|---|
| Recurring code defect or anti-pattern | Coding standard / review checklist item | [Review](REVIEW_SYSTEM.md) |
| Recurring missed acceptance criterion | QA checklist template item | [QA_VALIDATION.md](../sops/QA_VALIDATION.md) |
| Recurring security gap | Security review rule / approved-pattern record | Review + [Decision System](DECISION_SYSTEM.md) |
| Recurring release/deploy failure | Release Readiness Checklist item | [RELEASE.md](../sops/RELEASE.md) |
| Recurring estimate or scope error | Planning heuristic | [Planning](PLANNING_SYSTEM.md) |
| Recurring guardrail trigger in execution | Guardrail policy or pre-flight check | Agent execution policy |

**The promotion bar is a feature, not friction.** Promoting too eagerly produces a thicket of standards no one can follow; promoting too reluctantly means the company keeps paying for the same mistake. The recurrence threshold and the validation gate exist to keep the standard set small, true, and respected.

---

## 6. Ownership

Continuous improvement is owned end-to-end by the **CTO** as the executive accountable for how the company works. Within that, each stage has a clear operational owner. One owner per stage; no shared accountability.

| Stage / artifact | Owner | Accountable for |
|---|---|---|
| Surfacing signals from each source | The source's surfacer ([Section 3](#3-improvement-sources)) | Recording the signal against the work that produced it |
| Writing insights from a domain | The domain owner (Tech Lead for engineering, Security Engineer for security, etc.) | Deciding a signal is worth a Memory record and writing it in plain language |
| Detecting patterns | Tech Lead (engineering) / domain owner | Linking recurring insights and declaring a pattern when the threshold is met |
| Proposing standards | Pattern owner | Drafting the candidate standard as actionable practice |
| Validating and approving standards | CTO (or Tech Lead by delegation for engineering standards) | Confirming the candidate meets the validation rules before it binds future work |
| Publishing standards | Technical Writer | Curating the standard into the Knowledge Library and superseding prior versions |
| Enforcing adoption | Reviewer / QA Engineer / Release Manager | Checking that work follows published standards in their gate |
| System health | CTO | The standard set staying small, true, current, and respected |

**Ownership rules:**

- The CEO is never an operational owner in this system. The CEO sees the *results* of improvement (better, faster, more reliable delivery) and is consulted only when a proposed standard would change product scope or accept business risk — at which point it is an escalation, not a unilateral standard ([COMPANY_RUNTIME.md §17](../architecture/COMPANY_RUNTIME.md#17-escalation-rules)).
- A standard with no enforcing owner is not adopted. Publication without an enforcement point is rejected at validation.
- Pruning is ownership too. The owner of a domain's standards is accountable for retiring standards that no longer apply, not only for adding new ones.

---

## 7. Validation Rules

Before a candidate standard becomes binding, it must pass validation. This is the gate that keeps the standard set trustworthy. A candidate that fails any rule is returned to its proposer, not published.

A candidate standard is valid only if:

1. **It is evidenced.** It links to at least two independent instances of the pattern it addresses. A standard proposed from a single occurrence is premature — it is an insight, not yet a pattern.
2. **It is actionable.** It states what to do (or not do), not merely what went wrong. A reviewer or QA engineer must be able to check compliance without interpretation.
3. **It is enforceable.** It names where it is enforced — a review checklist, a QA check, a release checklist item, a planning heuristic, or a guardrail. A standard nothing enforces is not validated.
4. **It does not contradict an active standard.** If it conflicts with an existing standard, the conflict is resolved by supersession ([Section 8](#8-update-rules)), not by leaving two contradictory standards live. The company never holds two binding standards that disagree.
5. **It is within company authority.** If adopting it requires a CEO product decision or accepts business risk, it is escalated for that decision first and only becomes a standard once that decision is recorded.
6. **It is scoped.** It states where it applies (a repository, a layer, a class of work). A standard that claims to apply everywhere usually applies nowhere.

**Validation is a judgment, not a rubber stamp.** The validating authority reads the evidence, confirms the standard would actually prevent the recurrence, and weighs the cost of binding all future work against the cost of the recurring problem. Approving a weak standard is as much a failure as rejecting a strong one.

---

## 8. Update Rules

Standards and insights are durable but not immutable. The company's understanding evolves, and the improvement record evolves with it under controlled rules.

1. **Insights are appended, never quietly rewritten.** A new insight that refines an old one links to it. The history of what the company learned, and when, is itself organizational knowledge.
2. **Standards are superseded, not deleted.** When a standard is replaced, the prior version is marked superseded with a link to its replacement and remains readable. Employees can always trace why a practice changed.
3. **Supersession requires the same validation as creation.** Replacing a standard is a promotion event and passes [Section 7](#7-validation-rules). A standard is not weakened or removed casually because it was inconvenient on one task.
4. **Retirement is explicit.** A standard that no longer applies (the technology changed, the risk no longer exists) is deprecated with a recorded reason, not silently dropped. A standard that simply stops being followed without being retired is a governance failure, not an update.
5. **Demotion is permitted.** If a "standard" proves to cause more friction than value, it can be retired or relaxed — but only through the same owned, recorded path that created it. The decision and its reasoning are recorded as a [Decision](DECISION_SYSTEM.md).
6. **Adoption is re-checked after an update.** When a standard changes, the surfaces that enforce it (review checklist, QA template, planning heuristic) are updated in the same change. A standard whose enforcement points lag behind its text will be unevenly applied.

---

## 9. Relationship to Memory and Knowledge

The Continuous Improvement System does not own a separate store. It is the *flow* that connects work outcomes to the company's two durable information tiers, and it must respect the boundary between them.

- **Memory ([ORGANIZATIONAL_MEMORY_SYSTEM.md](ORGANIZATIONAL_MEMORY_SYSTEM.md))** holds insights and patterns. Memory is where a lesson lives before it is authoritative: a Memory record with a `source` (the work item it came from) and a `confidence` value. Patterns are insights whose linked recurrence raises their weight. Improvement *writes* to Memory at the insight and pattern stages.
- **Knowledge ([KNOWLEDGE_LIBRARY_SYSTEM.md](KNOWLEDGE_LIBRARY_SYSTEM.md))** holds standards. A standard is, by definition, authoritative and curated — which is the Knowledge tier's job. Promotion from pattern to standard is exactly the act of moving a lesson from the rough, accumulating Memory tier into the deliberately authored Knowledge tier.

The boundary matters:

| | Memory | Knowledge |
|---|---|---|
| Improvement stage | Insight, Pattern | Standard |
| Trust level | Accumulated, may be rough | Curated, authoritative |
| Written by | The domain owner, as a byproduct of work | The Technical Writer, on approval |
| Effect on future work | Informs (retrieved and weighed) | Binds (enforced at gates) |

Improvement records reference the work that produced them so the chain from outcome to lesson to standard is always traceable. A standard in the Knowledge Library can be traced back through the pattern in Memory to the original review findings, defects, or incidents — the evidence is never severed from the conclusion.

---

## 10. Retrospectives and Review Cadence

Most improvement happens continuously, as a byproduct of normal work — a review finding written as an insight the moment it recurs. A small amount of improvement requires a deliberate look across many work items at once.

**Continuous (default).** The improvement loop runs at the grain of individual work items. Reviews, QA cycles, incidents, and releases each emit signals as they happen, and insights are written when a signal proves it will change future behavior. This is the primary mode and requires no ceremony.

**Periodic retrospective (deliberate).** At natural boundaries — a shipped milestone, a resolved incident, a closed release — the responsible owner looks across the body of work for patterns that are only visible in aggregate:

- After an **incident**, the Tech Lead leads a post-incident review whose output is a root-cause record, follow-up work items, and at least one insight or candidate standard. An incident with no recorded lesson is an incident the company is doomed to repeat ([COMPANY_RUNTIME.md §31](../architecture/COMPANY_RUNTIME.md#31-recovery-from-failure)).
- After a **release**, the Release Manager records process notes: which checklist items were consistently problematic and what should change next time ([RELEASE.md](../sops/RELEASE.md)).
- After a **milestone**, the Tech Lead and Product Manager review estimate-vs-actual deviations and scope splits to calibrate future planning.

Retrospectives are not status meetings. Their only legitimate output is durable: insights, patterns, candidate standards, or follow-up work. A retrospective that produces only discussion produced nothing.

---

## 11. KPIs

The Continuous Improvement System is measured on whether the company actually gets better, not on activity volume. Writing many insights is not the goal; preventing recurrence is.

| KPI | Target | Measured by |
|---|---|---|
| Recurrence rate of promoted patterns | Declining — a pattern that became a standard should stop recurring | Linked instances before vs. after the standard |
| Incidents with a recorded lesson | 100% — every incident produces at least one insight or candidate standard | Incident records linked to Memory |
| Standard adoption | High — published standards are referenced in planning and enforced at review/QA | Standards with at least one active enforcement point |
| Insight-to-noise ratio | Healthy — insights change future behavior; the record is not polluted with restatements | Periodic owner audit of Memory quality |
| Time from pattern to standard | Bounded — established patterns do not linger unpromoted while the cost recurs | Pattern record age at promotion |
| Standard set size | Stable and small — standards are added *and* retired, not only accumulated | Active standard count over time |
| Estimate calibration | Improving — planning heuristics reduce estimate-vs-actual deviation over time | Planning outcome records |

A rising count of standards with a flat or rising recurrence rate is the signature failure of this system: the company is writing rules but not learning. The KPIs are designed to catch exactly that.

---

## 12. Implementation Status

Per the project's hard rule against describing capability that does not exist, this section separates what the platform implements **today** from what is **designed but not yet built**. The improvement *flow* described above is the standing organizational specification; only some of it is automated today, and the bulk of automatic learning is deliberately gated behind real-AI work that has not begun.

### 12.1 Implemented today

The platform produces and persists the raw signals this system learns from, and enforces the quality gates that generate them:

- **Review findings are first-class and classified.** `recordReviewResult` (`apps/web/src/lib/review-service.ts`) stores review verdicts (`approved` / `changes_requested` / `blocked` / `needs_clarification`) and findings tagged `blocker` / `non_blocker`, and opens `ChangeRequest` records when changes are requested. These are the literal signals of the Review source.
- **QA results carry pass/fail evidence.** `recordQaResult` (`apps/web/src/lib/qa-service.ts`) stores QA verdicts and per-check results against acceptance criteria, and **blocks completion** when required checks did not pass — no task reaches `done` on an unverified claim. This is the QA source.
- **Gate advancement is truthful and recorded.** `gate-advancement-service.ts` advances tasks through review and QA strictly according to autonomy level, never bypassing a gate, and writes a `TimelineEntry` for each transition. The honest gate is what makes the signals trustworthy.
- **The execution audit trail captures guardrail signals.** `worker-audit-log.ts` records `command_blocked`, `guardrail_triggered`, `validation_run`, `pr_opened`, and related events for every autonomous run — the raw material of the Execution Audit source.
- **Incidents are modeled.** An `Incident` record (`severity`, `status`, `resolvedAt`) exists in the schema as the anchor for incident-derived lessons.
- **Memory records carry source and confidence.** `Memory` / `MemoryRecord` (`apps/web/src/app/actions/memory.ts`) persist insights with a `source` and a `confidence` value (0–1) across eight categories including `decision`, `security`, and `operations` — the destination for written insights and patterns.
- **Company intelligence surfaces what needs attention.** `next-action-recommendation.ts` reads workspace state (blocked tasks, failed executions, stuck requests, pending approvals) and recommends the CEO's next action — an early form of surfacing where the company is struggling.

### 12.2 Designed / planned (not yet built)

- **Automatic insight extraction.** Today, the platform *records* review findings, QA defects, and audit events, but it does not yet automatically distill them into Memory insights. The signal→insight step is specified behavior performed by employees; the runtime does not yet emit insight records as a byproduct of a closed review or resolved incident.
- **Pattern detection and recurrence linking.** Linking recurring insights across work items and declaring a pattern when the threshold is met is specified here but not yet computed by the platform.
- **Pattern-to-standard promotion and the Knowledge tier.** The `Knowledge` / `KnowledgeRecord` models exist in the schema but have no curation workflow or UI yet (see [KNOWLEDGE_LIBRARY_SYSTEM.md](KNOWLEDGE_LIBRARY_SYSTEM.md)). Automatic promotion of a validated pattern into a published, enforced standard is the central planned evolution of this system.
- **Standard enforcement wiring.** Feeding published standards back into planning, review checklists, and QA templates so they are enforced automatically is designed but not implemented. Real-AI employees that retrieve and respect standards are gated behind **Engineering OS Specification v1.0**.
- **KPI computation.** The KPIs in [Section 11](#11-kpis) are the measurement design; the platform does not yet compute recurrence rates or adoption automatically.
- **Incident lifecycle and post-incident review.** The `Incident` model exists, but the structured post-incident review that produces a root cause and a candidate standard is procedure, not automation, today.

No part of this section should be read as claiming automation that does not exist. Where behavior is aspirational it is labeled designed/planned.

---

## 13. Failure Modes

The most damaging improvement failures are quiet: the company keeps working and never notices it has stopped learning. Each below names the failure, its consequence, and the system's response.

### The lesson that lives only in conversation
A review finding or incident produces a clear lesson, discussed and understood — but never written. The next time the situation arises, the company re-derives the lesson from scratch.
**Response:** A signal exists only when recorded against the work that produced it ([Section 3](#3-improvement-sources)). A lesson that is not written did not happen. Surfacing the record is the surfacer's responsibility, not a courtesy.

### The pattern nobody promotes
The same finding recurs across three, four, five work items. Everyone notices. No one owns turning it into a standard, so it keeps costing the company.
**Response:** Pattern detection has an owner ([Section 6](#6-ownership)), and "time from pattern to standard" is a KPI ([Section 11](#11-kpis)). An established pattern that lingers unpromoted is a tracked failure, not an accepted cost.

### The standard nothing enforces
A standard is written and published, then ignored, because no gate checks for it. It becomes documentation that makes the company *feel* like it learned without changing behavior.
**Response:** Enforceability is a validation rule ([Section 7](#7-validation-rules)). A candidate that names no enforcement point is not published. Adoption — not publication — is the completion criterion ([Section 4](#4-the-improvement-lifecycle)).

### Premature standardization
A single occurrence is promoted straight to a binding standard. The company accumulates rules from anecdotes, the standard set bloats, and engineers stop respecting any of it.
**Response:** Promotion requires linked recurrence across independent work items ([Section 5](#5-from-repeated-pattern-to-standard), [Section 7](#7-validation-rules)). One occurrence is an insight, not a standard.

### Standard set rot
Standards are added but never retired. Years of accumulated rules, some contradictory, some obsolete, make the standard set impossible to follow.
**Response:** Retirement and supersession are owned, recorded acts ([Section 8](#8-update-rules)), and "standard set size" is a tracked KPI. Pruning is part of ownership, not an afterthought.

### Improvement theater
Retrospectives happen on cadence and produce discussion, slides, or good intentions — but no insights, patterns, or follow-up work.
**Response:** A retrospective's only legitimate output is durable ([Section 10](#10-retrospectives-and-review-cadence)). A review that produces no record produced nothing, and is treated as not having occurred.

### Metrics gaming
The company optimizes the count of insights or standards written, mistaking activity for learning.
**Response:** The KPIs measure recurrence reduction and adoption, not volume ([Section 11](#11-kpis)). A rising standard count with a flat recurrence rate is the explicit signature this system is designed to catch.

---

## 14. Relationship to Other Documents

- **[ORGANIZATIONAL_MEMORY_SYSTEM.md](ORGANIZATIONAL_MEMORY_SYSTEM.md)** — the durable store for insights and patterns. This system writes to Memory at the insight and pattern stages; Memory owns how those records are stored, retrieved, and superseded.
- **[KNOWLEDGE_LIBRARY_SYSTEM.md](KNOWLEDGE_LIBRARY_SYSTEM.md)** — the curated store for standards. Pattern-to-standard promotion is the act of moving a lesson from Memory into the Knowledge tier.
- **[REVIEW_SYSTEM.md](REVIEW_SYSTEM.md)** — a primary signal source and a primary enforcement surface for adopted standards.
- **[DECISION_SYSTEM.md](DECISION_SYSTEM.md)** — records the decision to adopt, supersede, or retire a standard; standard changes that accept risk are Decisions.
- **[PLANNING_SYSTEM.md](PLANNING_SYSTEM.md)** — consumes planning-outcome signals and standards that become planning heuristics.
- **[QA_VALIDATION.md](../sops/QA_VALIDATION.md)** and **[RELEASE.md](../sops/RELEASE.md)** — sources of QA and release signals, and surfaces where standards are enforced as checklist items.
- **[ROLLBACK.md](../sops/ROLLBACK.md)** and **[COMPANY_RUNTIME.md §31](../architecture/COMPANY_RUNTIME.md#31-recovery-from-failure)** — own incident handling; this system consumes the lessons an incident produces.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** — defines the runtime that emits the signals (reviews, QA, releases, incidents) this system learns from and that will, when built, write improvement records as a byproduct of work.
