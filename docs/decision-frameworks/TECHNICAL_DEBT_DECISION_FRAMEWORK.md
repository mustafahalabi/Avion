# Technical Debt Decision Framework

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

---

This framework defines how Engineering OS identifies, evaluates, accepts, reduces, documents, and escalates technical debt. It exists to make debt decisions **repeatable, traceable, and honest** — never improvised. When an engineer is tempted to cut a corner, when a reviewer finds a shortcut, or when the CTO weighs a strategic trade-off, this is the document that governs the choice.

Technical debt is not a failure. Deliberate, well-reasoned debt is a legitimate engineering tool. The failure is *undocumented, unowned, or unbounded* debt. This framework draws the line between the two and assigns accountability for staying on the right side of it.

This document is implementation-neutral. It defines decision behavior, not code patterns, languages, or specific refactoring techniques. It complements — and is subordinate to — the [Company Playbook](../company/COMPANY_PLAYBOOK.md), which establishes the company's core beliefs ("Long-term quality beats short-term speed," "Every action should reduce future work"). Where this framework and the Playbook conflict, the Playbook wins.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [What Technical Debt Is](#3-what-technical-debt-is)
4. [Debt Categories](#4-debt-categories)
5. [Severity Model](#5-severity-model)
6. [Decision Criteria](#6-decision-criteria)
7. [Acceptance Rules](#7-acceptance-rules)
8. [Reduction Rules](#8-reduction-rules)
9. [Escalation Rules](#9-escalation-rules)
10. [Roles and Participation](#10-roles-and-participation)
11. [Output Format — The Debt Record](#11-output-format--the-debt-record)
12. [Worked Examples](#12-worked-examples)
13. [Anti-Patterns](#13-anti-patterns)
14. [Memory and Learning](#14-memory-and-learning)
15. [Related Documents](#15-related-documents)

---

## 1. Purpose

Software organizations make trade-offs between speed and durability continuously. Most of those trade-offs are invisible — a slightly awkward abstraction, a test skipped under deadline, a workaround for a third-party limitation. Left uncounted, these accumulate into systems that are slow to change, fragile to operate, and frightening to extend.

This framework gives Engineering OS a single, shared method for deciding:

- When taking on debt is acceptable and when it is reckless.
- Who has the authority to accept debt, and at what severity.
- What must be recorded so that future employees inherit context, not mystery.
- How accepted debt is tracked, prioritized, and eventually paid down.
- When a debt decision exceeds an employee's authority and must escalate.

The goal is that **any employee, encountering a piece of debt, can reconstruct why it exists, who owns it, what it costs, and what the plan is to remove it.** Debt that cannot pass that test is, by definition, dangerous debt.

---

## 2. Scope

**In scope.** Any deliberate or discovered deviation from the standard of quality the company holds for its repositories, including:

- Code-level shortcuts (duplication, missing abstraction, premature abstraction, dead code left in place).
- Skipped or thin test coverage relative to the work's acceptance criteria.
- Architectural compromises (a coupling that should not exist, a boundary that was crossed).
- Documentation gaps that leave future engineers unable to understand a change.
- Dependency and platform debt (outdated libraries, pinned-but-vulnerable versions, deprecated APIs).
- Operational debt (missing monitoring, fragile deployment steps, unhandled failure modes).
- Security debt (a known-but-deferred hardening item, classified per the severity model below).

**Out of scope.**

- Defects (functional bugs). A bug is incorrect behavior; debt is correct-but-costly structure. Bugs flow through [SOP: Bug Fix](../sops/BUG_FIX.md), not this framework. A bug may *create* follow-on debt, and that debt is recorded here.
- Feature scope decisions. Whether to build a capability is a Product decision, not a debt decision.
- Incident response. Production incidents follow incident procedures; the remediation debt they leave behind is recorded here.

When in doubt about whether something is a defect or debt, classify it as a defect first (because defects gate releases) and record any residual structural cost as debt.

---

## 3. What Technical Debt Is

Engineering OS uses one operating definition:

> **Technical debt is a deliberate or discovered gap between the current state of the code and the standard of quality the company holds, where closing the gap has a cost and leaving it open has a compounding cost.**

Two properties follow from this definition and govern everything below:

1. **Debt has a principal and interest.** The *principal* is the effort to fix it. The *interest* is the ongoing tax it imposes — slower changes, higher defect rates, more onboarding friction, increased operational risk. Debt is dangerous precisely when its interest compounds faster than the team can pay it down.
2. **Debt is only acceptable when it is a conscious trade-off.** Accidental debt that nobody noticed is not a decision — it is a quality escape, and it is caught in [Code Review](../sops/CODE_REVIEW.md) or QA. Acceptable debt is debt the company chose to take on with eyes open and a plan to remove.

This maps directly to the Domain Model: every accepted debt item is recorded as a [Decision](../architecture/DOMAIN_MODEL.md#decision) of type `risk_acceptance` and produces a [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record) and a [Risk](../architecture/DOMAIN_MODEL.md#risk) entry. The framework does not invent new storage — it constrains how those existing objects are used.

---

## 4. Debt Categories

Every debt item is classified into exactly one **primary category**. The category determines which employee owns the evaluation and which standards apply.

| Category | Description | Primary Evaluator |
|---|---|---|
| **Architectural** | Structural compromises: improper coupling, violated boundaries, a pattern that contradicts the repository's intended architecture, premature or missing abstraction at module scale. | CTO (with Tech Lead) |
| **Code Quality** | Local shortcuts: duplication, complex functions left un-refactored, naming inconsistency, dead code, missing error handling at non-critical paths. | Reviewer (with Tech Lead) |
| **Test** | Coverage gaps relative to acceptance criteria: skipped tests, missing edge-case coverage, absent integration tests for a new seam. | QA Engineer (with Reviewer) |
| **Documentation** | Knowledge gaps: an undocumented decision, a missing runbook, an architecture change not reflected in the docs. | Technical Writer (with Tech Lead) |
| **Dependency / Platform** | Outdated, deprecated, or risky third-party dependencies; framework versions behind support; deprecated platform APIs in active use. | Infrastructure Engineer (with CTO) |
| **Operational** | Fragile deployment steps, missing monitoring or alerting, unhandled operational failure modes, manual steps that should be automated. | DevOps Engineer (with Release Manager) |
| **Security** | Deferred hardening, known-but-accepted weaknesses, missing validation on a non-exploited path. | Security Engineer (mandatory) |

A single debt item may touch several categories; it is filed under the one that carries the highest cost, and the secondary categories are noted in the Debt Record. **Security debt is never a secondary classification** — if a security dimension exists, the Security Engineer evaluates it directly and the item carries the higher of the two severities.

---

## 5. Severity Model

Severity expresses the **interest rate** of the debt — how fast its cost compounds and how much blast radius it carries. It is independent of the principal (the cost to fix). A trivial-to-fix item can be high severity if leaving it in place is dangerous.

| Severity | Meaning | Compounding Behavior | Examples |
|---|---|---|---|
| **S1 — Critical** | Actively endangers correctness, security, or the ability to operate. Must not be silently accepted. | Compounds rapidly; risk of incident or breach is real and near-term. | An unpatched dependency with a known exploit; a data path with no validation; an architecture decision blocking an in-flight release. |
| **S2 — High** | Materially slows the team or raises defect risk in an area under active change. | Compounds steadily; pain is felt every sprint that touches the area. | Missing integration tests around a frequently modified seam; a coupling that forces multi-module changes for routine work. |
| **S3 — Moderate** | Real cost, but localized and not in a hot path of change. | Compounds slowly; tolerable if tracked. | Duplication in a stable module; a thin docstring on an internal helper; a slightly awkward abstraction nobody currently fights. |
| **S4 — Low** | Cosmetic or convenience-level; minimal interest. | Effectively flat; cleaned up opportunistically. | Inconsistent naming in a rarely touched file; a TODO that documents a nicety, not a risk. |

**Severity is assigned by the primary evaluator and confirmed at review.** Disagreements about severity escalate one level up the [Reporting Structure](../organization/REPORTING_STRUCTURE.md) (Reviewer → Tech Lead → CTO). When two evaluators disagree by more than one level, the higher severity holds until the CTO rules.

Severity drives authority. Who may *accept* a piece of debt depends entirely on its severity (see [Acceptance Rules](#7-acceptance-rules)).

---

## 6. Decision Criteria

When debt is proposed (deliberately, to ship faster) or discovered (in review, QA, or analysis), the evaluating employee answers the following criteria **in order**. The first criterion that produces a "stop" answer ends the evaluation in favor of fixing now, not deferring.

1. **Correctness and safety.** Does leaving this debt risk incorrect behavior, data loss, or a security exposure? If yes → it is S1; it is not eligible for routine acceptance and follows [Escalation Rules](#9-escalation-rules).
2. **Reversibility.** How hard is this to undo later? Debt that gets *cheaper* to fix later (or stays flat) is far safer to accept than debt that gets *more expensive* the longer it sits. One-way doors require higher authority than two-way doors.
3. **Blast radius.** How much of the system does this touch, and how many future changes will route through it? Localized debt in a stable area is low-interest; debt in a hot path or a shared boundary is high-interest.
4. **Rate of change.** Is this area under active development? Debt in code that changes weekly compounds far faster than identical debt in code that has not changed in a year.
5. **Cost of fixing now vs. later.** What is the principal today, and how does it trend? Quantify in rough effort terms, not false precision.
6. **Value unlocked by deferring.** What concrete, time-bound value does accepting the debt buy — a committed release date, an unblocking of dependent work, a learning experiment? "We were in a hurry" is not a value; "this unblocks the X release committed for date Y" is.

The output of this evaluation is a recommendation following the company's standard communication structure — **Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action** (per the [Company Playbook](../company/COMPANY_PLAYBOOK.md)) — feeding the decision priority order: User Value → Engineering Quality → Maintainability → Performance → Delivery Speed → Complexity.

**The default is to fix, not defer.** Debt is accepted only when the evaluation produces an affirmative, value-backed case for deferral *and* the acceptance rules below are satisfied. Silence is never acceptance.

---

## 7. Acceptance Rules

Accepting debt means the company consciously chooses to ship with a known quality gap and a recorded plan to close it. Acceptance is a privilege bounded by severity.

### 7.1 Authority by severity

| Severity | Who may accept | Required record |
|---|---|---|
| **S1 — Critical** | **CTO only**, and for security-classified items, with Security Engineer concurrence. CEO is notified. | Full Debt Record + Decision Record (`risk_acceptance`) + Risk entry + CEO notification |
| **S2 — High** | **Tech Lead**, with CTO informed within the sprint. | Full Debt Record + Decision Record + Risk entry |
| **S3 — Moderate** | **Tech Lead** or **Reviewer** (Reviewer may accept at review time). | Debt Record + Risk entry |
| **S4 — Low** | **Reviewer**, or the assigned Engineer with Reviewer sign-off at review. | Debt Record (lightweight) |

No employee may accept debt above their authority level. An Engineer who believes a shortcut is warranted **proposes** it; they do not unilaterally accept it. The Reviewer is the lowest authority that can *accept* anything, and only at S3/S4.

### 7.2 Mandatory conditions for any acceptance

Accepted debt is only valid when **all** of the following are true. Any one missing means the debt is not accepted — it is an undocumented quality escape.

- [ ] The debt is recorded in a **Debt Record** in the [output format](#11-output-format--the-debt-record).
- [ ] The record names an **owner** — a single accountable employee, never "the team."
- [ ] The record states the **severity** and the **category**, with evaluator agreement.
- [ ] The record states the **trigger condition or by-when** for repayment (an event, a date, or an explicit "carry indefinitely, re-review each quarter").
- [ ] The record states the **interest** — the concrete ongoing cost of leaving it open.
- [ ] A corresponding **Risk** entry exists and a **Decision Record** of type `risk_acceptance` is written for S2 and above.
- [ ] For any security dimension, the **Security Engineer has signed off** on the severity and the acceptance.

### 7.3 What may never be accepted as routine debt

The following are never eligible for routine acceptance. They block the work until resolved or escalate to the CTO for an explicit, documented exception:

- Anything that causes a QA **No-Go** to be bypassed without CTO authorization (see [SOP: Release](../sops/RELEASE.md)).
- Known security vulnerabilities that are exploitable on a reachable path.
- Debt that removes the ability to roll back or recover.
- Debt that violates a hard invariant in the [Domain Model](../architecture/DOMAIN_MODEL.md) (e.g., shipping a Task to `done` without a recorded approved review and passing QA).

---

## 8. Reduction Rules

Accepted debt that is never repaid is just decay on a schedule. Reduction is a standing responsibility, not an occasional cleanup event.

### 8.1 The debt ledger

All open Debt Records form the company's **debt ledger**, owned by the Tech Lead operationally and the CTO strategically. The ledger is reviewed at a fixed cadence:

- **Every sprint planning** — the Tech Lead surfaces S1 and S2 items and slots repayment work into the sprint. S1 debt is repaid in the current or next sprint, without exception.
- **Every release readiness pass** — the Release Manager confirms no S1 debt is shipping unacknowledged (cross-checked against the [Release](../sops/RELEASE.md) checklist).
- **Quarterly** — the CTO reviews the whole ledger for trends: is total debt growing, are owners stale, are any "carry indefinitely" items now hot?

### 8.2 Repayment priority

Repayment is prioritized by **interest, not principal**. The company pays down the debt that costs the most to carry, not the debt that is easiest to fix. The priority order is:

1. S1 — always next.
2. S2 in areas under active change (highest realized interest).
3. S2 in stable areas.
4. S3 touched by current work — repaid opportunistically, in the same change ("leave the repository cleaner than you found it," per the Playbook).
5. S4 — opportunistic only; never displaces feature or higher-severity work.

### 8.3 The "touch it, fix it" rule

When any work touches a file or module carrying recorded S2/S3 debt, the assigned Engineer evaluates whether the debt can be repaid as part of that change. If repayment is small and in-scope, it is done and the Debt Record is closed. If it is too large to absorb, the Engineer notes that the debt was encountered and confirms its severity is still accurate. This keeps the ledger honest and pays down debt exactly where the team is already paying its interest.

### 8.4 Closing a Debt Record

A Debt Record is closed only when the debt is actually gone — not when the work that created it ships. Closure requires:

- The remediation is reviewed and (where applicable) QA-validated like any other change.
- The associated Risk entry is moved to `mitigated`.
- The Decision Record is annotated as resolved, with a pointer to the closing change.
- A Memory Record captures the lesson, if one exists (see [Memory and Learning](#14-memory-and-learning)).

---

## 9. Escalation Rules

Escalation moves a debt decision to higher authority. It is required — not optional — in the situations below. Escalation follows the [Reporting Structure](../organization/REPORTING_STRUCTURE.md) and the [Company Playbook](../company/COMPANY_PLAYBOOK.md) escalation rules.

| Situation | Escalate To | Trigger |
|---|---|---|
| Debt is classified S1 (Critical) | CTO | Immediately on classification |
| Security dimension at any severity | Security Engineer, then CTO if S1/S2 | On discovery |
| Evaluators disagree on severity by more than one level | Tech Lead, then CTO | When disagreement cannot be resolved by the higher-severity-holds rule |
| Accepting the debt requires bypassing a QA No-Go | CTO | Before any acceptance — this is never an autonomous decision |
| Debt changes the intended architecture of a repository | CTO | Before acceptance — architecture is CTO-owned |
| A "carry indefinitely" item has become hot (rate of change or blast radius rose) | Tech Lead, then CTO if now S1/S2 | At the quarterly review or whenever noticed |
| Debt repayment is repeatedly deferred across three or more sprints | CTO | At the third deferral |
| Debt has business or delivery-date consequences the CEO must weigh | CTO → CEO | When the trade-off affects a committed outcome |

The CEO is involved only when a debt trade-off affects a committed business outcome or a P0/P1-class risk — consistent with the principle that **the CEO owns outcomes and the company owns execution**. The company never asks the CEO to adjudicate internal engineering trade-offs that the CTO is empowered to decide.

---

## 10. Roles and Participation

Technical debt is a shared responsibility, but accountability is never shared. Each role has a distinct part.

| Role | Participation |
|---|---|
| **CTO** | Owns this framework and the strategic debt ledger. Sole authority to accept S1 debt. Owns architectural debt. Reviews the ledger quarterly for trends. Adjudicates severity disputes and one-way-door decisions. Notifies the CEO when debt affects committed outcomes. |
| **Tech Lead** | Owns the operational ledger. Accepts S2/S3 debt. Surfaces debt every sprint planning and schedules repayment. Confirms severity at review. Ensures every accepted item has a single named owner and a repayment trigger. |
| **Reviewer** | First line of detection. Distinguishes accidental quality escapes (request changes) from candidate deliberate debt (record and route). May accept S3/S4 at review. Enforces that no debt ships unrecorded. (See [Reviewer handbook](../employees/REVIEWER.md).) |
| **Engineering** (Frontend, Backend, AI, Infrastructure) | Proposes debt when a shortcut is warranted; never accepts it unilaterally. Applies the "touch it, fix it" rule. Repays scheduled debt. Records the debt honestly rather than hiding it. |
| **QA Engineer** | Owns test-category debt. Distinguishes a deferred test (debt) from a missing gate (a No-Go). Ensures coverage gaps are recorded, not silently shipped. |
| **Security Engineer** | Mandatory evaluator for any security dimension. Sets severity for security debt and signs off on (or blocks) its acceptance. |
| **Technical Writer** | Owns documentation-category debt. Ensures accepted-debt decisions become discoverable Knowledge/Memory records. |
| **DevOps / Release Manager** | Own operational debt. The Release Manager confirms no S1 debt ships unacknowledged at release readiness. |
| **Product Manager** | Represents the cost of deferral in product terms. Helps weigh delivery-speed value against engineering quality when debt is proposed to hit a date. Does not accept engineering debt — that authority is engineering's. |

The [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) is the authoritative source for ownership boundaries; this table is its projection onto debt decisions.

---

## 11. Output Format — The Debt Record

Every accepted or tracked debt item produces a **Debt Record**. The record is the repeatable, traceable output of this framework. It is stored as a [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record) (for S2+) and surfaced as a [Risk](../architecture/DOMAIN_MODEL.md#risk) in the ledger. The format is intentionally implementation-neutral — it specifies what must be captured, not where bytes live.

```
DEBT RECORD

ID:               <stable identifier>
Title:            <one line: what the debt is>
Category:         <Architectural | Code Quality | Test | Documentation |
                   Dependency/Platform | Operational | Security>
Secondary:        <any secondary categories, or "none">
Severity:         <S1 | S2 | S3 | S4>  (interest, not principal)
Status:           <proposed | accepted | scheduled | mitigated | closed>

Owner:            <single accountable employee — never "the team">
Accepted by:      <employee who exercised acceptance authority>
Security sign-off: <Security Engineer, if any security dimension; else "n/a">

WHAT — the gap:
  <the specific deviation from the quality standard>

WHY — the trade-off:
  <the concrete, time-bound value that justified deferral>

INTEREST — the ongoing cost:
  <what leaving this open costs each sprint / in risk terms>

PRINCIPAL — cost to fix:
  <rough effort estimate and whether it trends up, flat, or down>

REPAYMENT TRIGGER:
  <event, date, or "carry indefinitely — re-review quarterly">

BLAST RADIUS / RATE OF CHANGE:
  <how much it touches; how often that area changes>

ALTERNATIVES CONSIDERED:
  <options weighed and why rejected>

LINKS:
  Decision Record:  <id>     Risk:  <id>
  Originating work: <task/project/incident id>
  Closing change:   <id, once closed>

CREATED: <date / employee>     LAST REVIEWED: <date / employee>
```

A record missing any of **Owner, Severity, Interest, or Repayment Trigger** is incomplete and does not constitute accepted debt. An incomplete record is treated as an unaddressed quality escape and is returned to the proposing employee.

---

## 12. Worked Examples

These examples illustrate the decision logic. They are illustrative, not exhaustive.

### 12.1 Acceptable debt (deliberate, bounded, documented)

> During work on a committed release, the Backend Engineer finds that fully generalizing a new data-mapping layer would take two extra days. A narrower, single-purpose implementation ships the committed feature on time and is straightforward to generalize later.

- **Category:** Architectural (secondary: Code Quality). **Severity:** S3 — localized, two-way door, the area is not currently hot.
- **Criteria:** Correctness fine; reversible; small blast radius; moderate rate of change; principal is flat (generalizing later costs about the same); deferral unblocks a committed release.
- **Decision:** Tech Lead accepts. Debt Record written with repayment trigger "when a second consumer of the mapping layer appears." Risk entry created.
- **Why acceptable:** Conscious, value-backed, owned, recorded, with a concrete trigger. This is debt working as a tool.

### 12.2 Dangerous debt (must not be silently accepted)

> Under deadline pressure, an Engineer disables an integration test that is failing intermittently and ships, intending to "look at it later." No record is created.

- **Category:** Test (the failing test guards a payment path → Security/Correctness dimension). **Severity:** S1.
- **Criteria:** Fails the very first criterion — correctness and safety are at risk on a reachable path.
- **Decision:** Not eligible for routine acceptance. The Reviewer rejects the change; the item escalates to the CTO and Security Engineer. The test is fixed or the failure is understood before shipping; if a genuine deferral is warranted it requires CTO + Security sign-off and a full Debt Record.
- **Why dangerous:** Undocumented, unowned, on a critical path, and it masks a possible defect. Even with a perfect record, S1 on a payment path is not routinely acceptable.

### 12.3 The honest "carry indefinitely" item

> A legacy module uses an older internal pattern. Replacing it has real cost and no current pain — the module has not changed in a year.

- **Category:** Code Quality. **Severity:** S4 (flat interest).
- **Decision:** Reviewer records it as "carry indefinitely — re-review quarterly." It is repaid only if the module becomes hot. The quarterly CTO ledger review will re-rate it if its rate of change rises.
- **Why this is correct:** The framework explicitly allows indefinite carry — *as long as it is recorded, owned, and re-reviewed*. Untracked tolerance is decay; tracked tolerance is a decision.

---

## 13. Anti-Patterns

**Debt as a synonym for "messy code I dislike."** Debt is a deviation from the company's quality standard with a cost, not a matter of taste. Aesthetic preferences are resolved in review, not logged as debt.

**Silent acceptance.** Shipping a shortcut without a record is not accepting debt — it is creating an untracked quality escape. The Reviewer's job is to ensure nothing in this category passes unrecorded.

**"The team" as owner.** Debt owned by everyone is owned by no one. Every record names exactly one accountable employee, consistent with the company's "one owner" principle.

**Severity inflation under deadline.** Down-rating a piece of debt so a lower authority can accept it is a violation. Severity is set on interest and confirmed by a second evaluator; the higher rating holds in a dispute.

**The permanent "later."** A repayment trigger of "later" is no trigger. Triggers are events, dates, or an explicit, re-reviewed "carry indefinitely." Debt deferred across three sprints escalates to the CTO automatically.

**Treating debt repayment as optional cleanup.** Repayment is scheduled work with priority by interest, surfaced every sprint. It is not what happens "if there's time" — there is never time unless it is planned.

**Letting debt bypass the gates.** No debt decision overrides a QA No-Go, a security block, or a Domain Model invariant without explicit, documented CTO authority. The gates exist precisely for the moments when speed is most tempting.

**Confusing debt with defects.** A defect is wrong behavior and follows [Bug Fix](../sops/BUG_FIX.md); debt is costly-but-correct structure. Misfiling a defect as "debt to handle later" ships a known bug — the worst version of both.

---

## 14. Memory and Learning

Per the [Company Playbook](../company/COMPANY_PLAYBOOK.md), every meaningful decision becomes memory. Debt decisions are no exception.

- When debt is **accepted**, the Decision Record and Risk entry enter [Company Memory](../architecture/DOMAIN_MODEL.md#memory). Future employees working in the same area find the context before they re-derive it or re-break it.
- When debt is **repaid**, a Memory Record of type `lesson_learned` is written if the episode carries a transferable lesson — e.g., a category of shortcut that consistently costs more than it saves, or a pattern worth standardizing so the debt is never re-incurred.
- The CTO's quarterly ledger review feeds the company's **Technical Debt** health metric (one of the dimensions in [Company Health](../company/COMPANY_PLAYBOOK.md)). The trend — is debt growing or shrinking, is it being repaid by interest or ignored — is reported as part of company health, not buried in engineering.

The organization should make fewer debt mistakes over time. A debt category that recurs is a signal to fix the underlying process or standard, not just the instance.

---

## 15. Related Documents

- [Company Playbook](../company/COMPANY_PLAYBOOK.md) — the company's core beliefs on quality, ownership, escalation, and memory. Governs this framework where they overlap.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — definitions for [Decision](../architecture/DOMAIN_MODEL.md#decision), [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record), [Risk](../architecture/DOMAIN_MODEL.md#risk), and [Memory](../architecture/DOMAIN_MODEL.md#memory) that this framework reuses.
- [SOP: Code Review](../sops/CODE_REVIEW.md) — where most debt is detected and where the accidental-vs-deliberate distinction is enforced.
- [SOP: QA Validation](../sops/QA_VALIDATION.md) — the gate that test-category debt must never bypass.
- [SOP: Release](../sops/RELEASE.md) — the release-readiness checks that confirm no S1 debt ships unacknowledged.
- [SOP: Bug Fix](../sops/BUG_FIX.md) — the path for defects, which are explicitly out of scope here.
- [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) and [Reporting Structure](../organization/REPORTING_STRUCTURE.md) — authoritative ownership and escalation paths.
- [Reviewer handbook](../employees/REVIEWER.md), [Tech Lead handbook](../employees/TECH_LEAD.md), [Security Engineer handbook](../employees/SECURITY_ENGINEER.md) — role-level detail for the primary participants.
