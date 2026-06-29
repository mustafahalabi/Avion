# Risk Analysis Decision Framework

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

---

This document is the repeatable decision logic Engineering OS uses to identify, score, communicate, mitigate, accept, and monitor risk. It tells any employee who encounters an uncertainty — in planning, implementation, review, QA, or release — how to name it, how severe it is, who is allowed to decide what happens to it, and what must be true before the work proceeds. It exists so that risk is never an unspoken worry, never a matter of who happened to notice, and never a surprise that arrives as an incident.

Risk is not a failure. Every meaningful piece of work carries uncertainty, and surfacing it early is a sign of engineering maturity, not weakness. The failure mode this framework prevents is the *silent, unowned, unmeasured* risk — the one nobody wrote down, nobody owns, and nobody decided to accept. This document draws the line between a risk that is managed and a risk that is merely hoped away, and it assigns accountability for staying on the right side of that line.

The framework is implementation-neutral and provider-neutral. It does not assume a specific framework, cloud, language, or release process. It defines the questions that must be answered and the thresholds that determine the outcome — the answers are filled in by the work under analysis. This document defines *how to decide*. The [`Risk` object in the Domain Model](../architecture/DOMAIN_MODEL.md#risk) defines *what a recorded risk is*. The [Decision System](../systems/DECISION_SYSTEM.md) defines *how a risk-acceptance decision is recorded and remembered*. The [Approval System](../systems/APPROVAL_SYSTEM.md) defines *how the platform pauses for a human*. It is subordinate to the [Company Playbook](../company/COMPANY_PLAYBOOK.md); where they conflict, the Playbook wins.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Core Principles](#3-core-principles)
4. [The Decision Loop](#4-the-decision-loop)
5. [Risk Categories](#5-risk-categories)
6. [Required Questions per Category](#6-required-questions-per-category)
7. [Likelihood Model](#7-likelihood-model)
8. [Impact Model](#8-impact-model)
9. [Severity: The Risk Matrix](#9-severity-the-risk-matrix)
10. [Mitigation Model](#10-mitigation-model)
11. [Risk Lifecycle](#11-risk-lifecycle)
12. [Authority: Who Decides](#12-authority-who-decides)
13. [Escalation Triggers and Paths](#13-escalation-triggers-and-paths)
14. [Output Format: The Risk Record](#14-output-format-the-risk-record)
15. [Worked Examples](#15-worked-examples)
16. [Anti-Patterns](#16-anti-patterns)
17. [Relationship to Other Documents](#17-relationship-to-other-documents)

---

## 1. Purpose

Two engineers looking at the same uncertainty should reach the same conclusion about how serious it is and what to do next. That is the entire purpose of this framework: to make risk analysis **repeatable** rather than a function of mood, seniority, or deadline pressure. A risk evaluated by the Tech Lead on a quiet afternoon and the same risk evaluated by a Backend Engineer the night before a release should land in the same severity band and produce the same required next action.

The framework has four jobs:

1. **Identify.** Surface the uncertainty and place it in the right category so it is analyzed against the right questions.
2. **Score.** Rate its [likelihood](#7-likelihood-model) and its [impact](#8-impact-model), then combine them into a single [severity](#9-severity-the-risk-matrix) using a fixed matrix — not intuition.
3. **Decide.** Choose one mitigation response — Avoid, Reduce, Transfer, Accept, or Monitor — and route any acceptance to the authority entitled to make it.
4. **Record.** Produce a written [Risk Record](#14-output-format-the-risk-record), owned by one named employee, with a next action, so the company tracks the risk instead of forgetting it.

The non-negotiable rule of this framework: **every meaningful risk has a named owner and a next action.** A risk that is identified but not assigned, or assigned but given no next action, has not been managed — it has merely been observed on its way to becoming an incident.

---

## 2. Scope

**In scope.** Any uncertainty that could negatively affect the quality, timeline, security, or stability of company output. This spans the six [risk categories](#5-risk-categories): product, engineering, security, operational, schedule, and documentation risk. Risks are identified during planning (most cheaply), during implementation and review (most commonly), during QA (as defects suggest systemic weakness), and during and after release (as production signals appear). A risk in any of these phases is in scope.

**Out of scope.** Pure unknowns with no plausible negative consequence, ordinary task uncertainty already covered by an estimate, and reversible choices that carry no lasting cost. The dividing line is the same one the [Decision System](../systems/DECISION_SYSTEM.md#2-scope) draws: **consequence**. If an uncertainty, were it to resolve badly, would change what ships, when it ships, who can reach what data, or whether production stays healthy, it is in scope. When in doubt, treat it as in scope and run the [decision loop](#4-the-decision-loop) — the cost of recording a risk that never materializes is a few minutes; the cost of a missed one is measured in incidents.

This framework governs **risk analysis as a discipline**. It does not replace the domain-specific frameworks. Security risk is scored here but evaluated in depth by the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md); debt-shaped risk is cross-referenced to the [Technical Debt Decision Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md); architectural and performance risk reference the [Architecture](./ARCHITECTURE_DECISION_FRAMEWORK.md) and [Performance](./PERFORMANCE_DECISION_FRAMEWORK.md) frameworks respectively. Where a specialized framework defines a stricter rule for its domain, that rule wins inside its domain.

---

## 3. Core Principles

- **Name the risk; do not absorb it.** An uncertainty that is felt but never written down is the most dangerous kind. The first act of risk management is to give the risk a name, a category, and an owner.
- **Severity is derived, not asserted.** No one declares a risk "high" by feel. Severity comes from combining a likelihood rating and an impact rating in the [risk matrix](#9-severity-the-risk-matrix). The same inputs always produce the same severity.
- **Every meaningful risk has one owner.** Exactly one accountable employee is responsible for monitoring and mitigating each recorded risk. Shared ownership is no ownership.
- **Every meaningful risk has a next action.** "Identified" is not a resting state. A recorded risk always carries a defined next action — mitigate, monitor with a review date, or escalate for an acceptance decision.
- **Accepting risk is a decision with an owner.** Choosing to live with a risk is a legitimate, often correct choice — but it is a *decision*, made by someone with the authority to make it, and recorded as such. Silent acceptance is not acceptance; it is negligence.
- **Optimistic by default, honest about uncertainty.** Per the [Company Playbook](../company/COMPANY_PLAYBOOK.md), employees report confidence honestly. "Unknown" is an acceptable answer; false certainty is not. A risk under-rated to avoid an awkward conversation is a failure of honesty.
- **Provider-neutral and implementation-neutral.** Risks are described by the harm they threaten, not by the tool involved. Swapping a vendor or a library must not change the analysis.

---

## 4. The Decision Loop

Every risk analysis runs the same deterministic loop. The same inputs produce the same outcome.

1. **Identify the uncertainty.** State, in one plain sentence, what could go wrong and what it would affect. A risk that cannot be stated in a sentence is not yet understood well enough to analyze.
2. **Match a category.** Use the [Risk Categories](#5-risk-categories) table. A risk has exactly one *primary* category (the kind of harm it threatens) and may carry secondary categories.
3. **Answer the required questions.** For the matched category, answer every question in [Section 6](#6-required-questions-per-category). An unanswerable question is itself a finding — it usually means the risk is larger or vaguer than first thought.
4. **Rate likelihood.** Use the [Likelihood Model](#7-likelihood-model) to assign Low, Medium, or High.
5. **Rate impact.** Use the [Impact Model](#8-impact-model) to assign Low, Medium, High, or Critical — the worst credible consequence, not the average one.
6. **Derive severity.** Read the [risk matrix](#9-severity-the-risk-matrix) at the intersection of likelihood and impact. This is the risk's severity. It is not negotiable by opinion.
7. **Choose a mitigation response.** Apply the [Mitigation Model](#10-mitigation-model): Avoid, Reduce, Transfer, Accept, or Monitor.
8. **Route to the right authority.** Use [Section 12](#12-authority-who-decides) and [Section 13](#13-escalation-triggers-and-paths) to confirm the response — especially any *acceptance* — is decided at the correct level.
9. **Record.** Write the [Risk Record](#14-output-format-the-risk-record), assign one owner, set a next action, and store it with the work item.

The loop never terminates at "we'll keep an eye on it." It terminates at a recorded risk with a named owner, a derived severity, a chosen response, and a next action.

---

## 5. Risk Categories

Every in-scope risk has one primary category. The category determines the required questions and the kinds of harm the risk threatens. The acceptance ceiling is the **highest severity that may be accepted within the owning employee's authority** before the decision must escalate (see [Section 12](#12-authority-who-decides)).

| # | Category | What it covers | Typical owner | Acceptance ceiling |
|---|---|---|---|---|
| 1 | **Product** | The risk that the work solves the wrong problem, misreads user need, or misses its acceptance criteria or success metric. | Product Manager | Product Manager (Medium); CEO above |
| 2 | **Engineering** | The risk that the implementation is fragile, incorrect, hard to change, or accrues technical debt — including architectural and performance risk. | Tech Lead | Tech Lead (Medium); CTO above |
| 3 | **Security** | The risk of unauthorized access, data exposure, or abuse. Scored here; evaluated in depth via the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md). | Security Engineer | Security Engineer (Medium); CTO/CEO above |
| 4 | **Operational** | The risk that the change cannot be deployed, observed, or recovered safely — deployment, rollback, monitoring, capacity, and dependency-availability risk. | Release Manager / DevOps | Release Manager (Medium); CTO above |
| 5 | **Schedule** | The risk that committed work will not be delivered in the expected window — estimate uncertainty, dependency delay, scope creep. | Tech Lead (with Product Manager) | Tech Lead (Medium); CEO for committed dates |
| 6 | **Documentation** | The risk that future employees or users cannot understand, operate, or safely change the system because knowledge was not captured. | Technical Writer | Technical Writer (Low–Medium); CTO above |

A risk may touch several categories — a rushed migration is at once an engineering risk, a schedule risk, and an operational risk. Assign the **primary** category by the *worst* credible harm, record the secondary categories, and route acceptance to the authority of the most severe category involved.

---

## 6. Required Questions per Category

These questions are not optional. Each is answered with evidence from the work under analysis. An answer of "unknown" or "not checked" is a finding that must be resolved or itself recorded as a risk.

### 6.1 Product risk
- Does the work map to a stated user need and a defined acceptance criterion, or is the need assumed?
- Is there a measurable success metric, and a way to tell after release whether it was met?
- What happens to the user if this assumption is wrong — minor friction, or a broken core flow?
- Is scope clear, or is "what done means" still moving? Undefined scope is a product risk *and* a schedule risk.

### 6.2 Engineering risk
- Does the change fit the existing architecture and conventions, or does it introduce a boundary, coupling, or pattern the repository does not already have?
- Is the work covered by tests proportional to its blast radius, or is correctness resting on manual confidence?
- Does it create [technical debt](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md)? If so, is the debt deliberate, bounded, and recorded?
- Could it degrade performance or resource use under realistic load (see the [Performance Decision Framework](./PERFORMANCE_DECISION_FRAMEWORK.md))?
- How reversible is it? A change that is hard to undo carries more risk than one that is trivially revertible.

### 6.3 Security risk
- Does the change cross a trust boundary, touch authentication or authorization, handle secrets, or expose data? If so, the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md) governs and its severity is authoritative.
- Is any required security question unanswered? Unanswered security questions default to a Block, not a low rating.
- Does the change widen the attack surface for the value it delivers?

### 6.4 Operational risk
- Can the change be deployed without downtime, and rolled back cleanly if it misbehaves (see the [Rollback SOP](../sops/ROLLBACK.md))?
- Is there a way to observe whether it is healthy in production — logs, metrics, alerts?
- Does it depend on an external service, migration, or capacity assumption that could fail at deploy time or under load?
- Does it require a configuration, secret, or environment change that is easy to get wrong?

### 6.5 Schedule risk
- Is the estimate grounded in understood work, or does it contain a large unknown?
- Does delivery depend on another task, team, employee, or external party that could slip?
- Is the committed date a hard external commitment or an internal target? Hard commitments raise the impact of any slip.
- Is scope stable, or is it expanding faster than it is being delivered?

### 6.6 Documentation risk
- Will a future engineer be able to understand *why* this exists and *how* it works from what is being written down?
- Does an operational change (a new runbook step, a new failure mode) need documentation before it is safe to run unattended?
- Is knowledge living only in one employee's head, or is it captured in [Company Memory or Knowledge](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md)?
- Per the Playbook, *documentation is engineering* — is the task actually done, or merely coded?

---

## 7. Likelihood Model

Likelihood is the probability that the risk materializes within the relevant horizon (this release, this quarter, the life of the feature). It is rated on three levels, matching the `likelihood` field on the [`Risk` object](../architecture/DOMAIN_MODEL.md#risk).

| Likelihood | Definition | Indicators |
|---|---|---|
| **High** | More likely than not to occur if nothing changes. | A known weakness on a hot path; a dependency with a history of failing; an estimate built on a large unknown; an assumption already contradicted once. |
| **Medium** | Plausible under realistic conditions; not the default expectation but well within reach. | A condition that requires a particular but normal sequence of events; load that is reached at peak; a third party that is usually but not always reliable. |
| **Low** | Possible only under unusual or adversarial conditions. | Requires a rare combination of inputs; a contingency with no current trigger; a theoretical edge case. |

Rate likelihood on the **current** state of the work, before any new mitigation. Mitigation lowers likelihood — but you record the pre-mitigation rating so the matrix reflects the real risk, then track the residual after mitigation. When likelihood is genuinely unknown, rate it Medium and record the unknown as part of the next action — never round an unknown down to Low to make a number look better.

---

## 8. Impact Model

Impact is the worst credible consequence if the risk materializes, before mitigation. It is rated on four levels, matching the `impact` field on the [`Risk` object](../architecture/DOMAIN_MODEL.md#risk). Impact is assessed across whichever dimensions the risk threatens — user harm, data exposure, financial cost, delivery delay, and reputational or trust damage — and the level is set by the *worst* of them.

| Impact | Definition | Cross-category illustrations |
|---|---|---|
| **Critical** | Irreversible or company-level harm: exposure of user data, loss of data integrity, an unrecoverable production outage, or a missed hard external commitment with material consequence. | Security: unauthenticated access to user data. Operational: a release that cannot be rolled back and corrupts state. Schedule: missing a contractual launch. |
| **High** | Serious but recoverable harm: a broken core user flow, a production incident requiring active response, significant rework, or a multi-week delay to committed work. | Engineering: a design that must be substantially rebuilt. Operational: a P1 incident. Product: the core use case does not work for most users. |
| **Medium** | Contained harm: a degraded but usable experience, a non-core defect, a localized delay, or debt that slows a specific area. | Engineering: bounded technical debt on a non-critical path. Documentation: a missing runbook for a rare operation. Schedule: a few days' slip on internal work. |
| **Low** | Minor harm: cosmetic issues, easily worked-around friction, or theoretical concerns with negligible practical cost. | Documentation: an out-of-date comment. Product: a minor copy ambiguity. Engineering: a small, isolated inelegance. |

Impact is set to the **worst credible** outcome, not the most likely one. A flaw that *could* corrupt data is Critical impact even if corruption is unlikely — likelihood captures the "even if unlikely," and the [matrix](#9-severity-the-risk-matrix) combines the two. Never lower an impact rating because the likelihood feels small; that is what the likelihood axis is for.

---

## 9. Severity: The Risk Matrix

Severity is **derived**, never asserted. Read it at the intersection of the [likelihood](#7-likelihood-model) and [impact](#8-impact-model) ratings. This is the single source of severity consistency in the framework: any two employees who agree on likelihood and impact must agree on severity.

| Likelihood \ Impact | Low | Medium | High | Critical |
|---|---|---|---|---|
| **High** | Low | Medium | High | **Critical** |
| **Medium** | Low | Medium | High | High |
| **Low** | Low | Low | Medium | High |

Severity drives the **required response speed** and the **default authority** for any acceptance decision. These response windows align with the cadence used across the company's quality frameworks.

| Severity | Meaning | Required response | Default acceptance authority |
|---|---|---|---|
| **Critical** | A credible path to irreversible or company-level harm. | Address now; do not proceed with the work in this state. Mitigate, or escalate before the work advances. | CTO (CEO for user-data, external commitments, or compliance) |
| **High** | Serious, recoverable harm that is plausible. | Mitigate before release, or obtain a documented acceptance from the right authority before proceeding. | CTO (or category owner with CTO sign-off) |
| **Medium** | Contained harm worth tracking. | Mitigate within the work, or accept with a recorded owner and a review date. | Category owner (Tech Lead / Product Manager / Release Manager) |
| **Low** | Minor harm. | Note and monitor; address opportunistically within its window. | Identifying employee |

A Critical or High severity may not be silently downgraded by relabeling likelihood or impact to dodge an escalation. If the inputs are honest, the matrix output stands. Disagreement is resolved by re-examining the *inputs* with evidence, never by overriding the matrix.

---

## 10. Mitigation Model

Once severity is known, the owner chooses exactly one primary response. These are the classic risk responses, mapped to the [`Risk.status`](../architecture/DOMAIN_MODEL.md#risk) lifecycle so the choice is reflected in the recorded state.

| Response | When to use | What it does | Resulting status |
|---|---|---|---|
| **Avoid** | The risk is unacceptable and an alternative path removes it. | Change the approach so the risk no longer exists — choose a reversible design, drop the risky scope, or sequence the work differently. | `mitigated` (the original risk is eliminated) |
| **Reduce** | The risk is worth carrying but can be made smaller. | Lower its likelihood (add a guard, a test, a flag) or its impact (add a rollback path, reduce blast radius). Re-score after mitigation. | `monitoring` → `mitigated` when residual is acceptable |
| **Transfer** | Another party is better positioned to carry the risk. | Move responsibility — rely on a hardened external service, a provider's guarantee, or another team's owned boundary. Transfer never erases the risk; it relocates accountability, which is recorded. | `monitoring` |
| **Accept** | The cost of mitigation exceeds the risk, or no mitigation exists and the work must proceed. | Knowingly carry the residual risk. **Acceptance is a [decision](../systems/DECISION_SYSTEM.md) made at the [correct authority](#12-authority-who-decides), with a named accepting owner and a review date.** | `accepted` |
| **Monitor** | The risk cannot be acted on now but must be watched. | Define the signal that indicates the risk is materializing and the trigger that escalates it. A monitor with no defined signal is not a plan. | `monitoring` |

Rules for mitigation:

- **A High or Critical risk may not be silently Accepted.** Acceptance at those severities requires the authority in [Section 12](#12-authority-who-decides) and a recorded rationale. Default is to Avoid or Reduce below High before proceeding.
- **Reduce re-scores.** After a mitigation lowers likelihood or impact, re-run the matrix on the residual risk and record both the original and residual severity. The residual is what is tracked.
- **Every response yields a next action.** Avoid → the alternative is implemented and verified. Reduce → the mitigation ships and is confirmed. Transfer → the new owner is named. Accept → the acceptance is recorded with a review date. Monitor → the signal and trigger are defined.

---

## 11. Risk Lifecycle

A recorded risk moves through the states defined on the [`Risk` object](../architecture/DOMAIN_MODEL.md#risk). The lifecycle is how the company guarantees that no risk is forgotten between identification and resolution.

```
identified ──▶ monitoring ──▶ mitigated
     │             │
     │             └────────▶ accepted ──▶ (review) ──▶ mitigated | realized
     │
     └────────────────────────────────────▶ realized ──▶ Incident
```

- **identified** — newly named, scored, and owned. Always carries a next action. This is a transition state, never a resting one.
- **monitoring** — actively watched against a defined signal, or a mitigation is in progress. Requires a trigger that fires escalation.
- **mitigated** — likelihood or impact reduced to an acceptable residual, or the risk eliminated by Avoidance. The risk is closed but retained for memory.
- **accepted** — knowingly carried by a named authority, with a recorded rationale and a review date. Re-examined at the review date; it does not silently expire.
- **realized** — the risk has materialized. If it caused a production problem, it produces an [`Incident`](../architecture/DOMAIN_MODEL.md#incident) and links to it (`realized_incident_id`). A realized risk always feeds a lesson-learned memory record.

A risk record is **never deleted**; it is resolved to `mitigated`, `accepted`, or `realized` and retained. Every `realized` risk is reviewed in retrospect to ask whether the original likelihood or impact rating was wrong — that feedback improves future scoring (see the [Continuous Improvement System](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md)).

---

## 12. Authority: Who Decides

Risk authority follows the company's one-owner principle (see the [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md)). The authority that matters most is the authority to **accept** a residual risk — to choose to ship with it. Authority to *do the work* is never the same as authority to *accept the risk* of that work.

| Decision | Category Owner | CTO | CEO |
|---|---|---|---|
| Record and own a risk of any severity | **Owns** | Informed | — |
| Choose Avoid / Reduce / Transfer / Monitor | **Decides** | Informed for High+ | — |
| Accept a **Low** residual risk | **Decides** (recorded) | — | — |
| Accept a **Medium** residual risk | **Decides** (recorded) | Informed | — |
| Accept a **High** residual risk | Recommends with options | **Approves** | Informed |
| Accept a **Critical** residual risk | Recommends with options | **Approves** | **Approves** if user-data, external commitment, or compliance |
| Accept a security risk rated High+ | Security Engineer recommends | **Approves** | **Approves** for user-data exposure |
| Slip a **hard external commitment** (schedule) | Recommends | Recommends | **Decides** |
| Proceed past a release-blocking risk | Recommends | **Approves** (per [QA override](../sops/QA_VALIDATION.md)) | Informed |

The pattern is consistent with the rest of the company: a **category owner manages risk and may accept it up to Medium**; **only the CTO may authorize accepting a High or Critical residual risk**; and **only the CEO may own a risk decision that knowingly exposes user data, slips a hard external commitment, or trades a compliance obligation against the business.** An engineer under deadline cannot self-authorize shipping a known High risk — that is precisely the silent absorption this framework exists to prevent.

---

## 13. Escalation Triggers and Paths

A risk decision must leave the owner's desk and go up when any trigger below fires. These align with the gates in the [Approval System](../systems/APPROVAL_SYSTEM.md) and surface to the CEO through the [Notification System](../systems/NOTIFICATION_SYSTEM.md).

| Trigger | Escalate to | Within |
|---|---|---|
| A risk is rated **Critical** by the matrix | CTO (CEO if user-data / external commitment / compliance) | Immediately |
| A request to **accept** a High or Critical residual risk | CTO (CEO for user-data exposure) | Before any acceptance is recorded |
| A schedule risk threatens a **hard external commitment** | Product Manager → CEO | As soon as credible |
| A security risk rated High+ during analysis | Security Engineer → CTO | Same business day; see [Security Framework](./SECURITY_DECISION_FRAMEWORK.md) |
| A risk has **no viable mitigation** and the work is business-critical | CTO | Before the block becomes indefinite |
| A monitored risk's **trigger signal fires** (it is materializing) | The risk's owner → category authority | Immediately on signal |
| A risk **realizes** as a production problem | Per [Incident](../architecture/DOMAIN_MODEL.md#incident) severity (P0/P1 → CTO + CEO) | Per incident response |
| Multiple valid responses require an executive trade-off | CTO → CEO | Before the work proceeds |

**Release gate.** No release proceeds while a High or Critical risk in its scope is unresolved and unaccepted. The risk owner provides a written disposition — mitigated, or accepted by the right authority with rationale — to the Release Manager before each release, consistent with the [Release SOP](../sops/RELEASE.md). A held release is the system working as intended, not a failure.

**Realization path.** When a monitored risk's signal fires, the response is not analysis — it is action. The owner executes the predefined mitigation or rollback ([Rollback SOP](../sops/ROLLBACK.md)), then escalates per the table, then records the realization and a lesson learned. A risk that realizes without anyone having defined its trigger signal is a defect in the original risk analysis and is noted as such in the retrospective.

---

## 14. Output Format: The Risk Record

Every run of the [decision loop](#4-the-decision-loop) produces one Risk Record, stored with the work item (plan, task, project, or release) and reflected in the [`Risk` object](../architecture/DOMAIN_MODEL.md#risk). An acceptance of a Medium-or-higher risk additionally produces a [Decision Record](../systems/DECISION_SYSTEM.md#9-decision-record-format) of type `risk_acceptance`. The record is the durable, attributable artifact future employees reference.

```
RISK RECORD

Subject:            <plan / task / project / release / change under analysis>
Date / Analyst:     <date> / <employee>
Category:           <product | engineering | security | operational | schedule | documentation>
Secondary:          <any additional categories>

Risk statement:     <one sentence: what could go wrong and what it would affect>

Likelihood:         <Low | Medium | High>      (pre-mitigation)
Impact:             <Low | Medium | High | Critical>   (worst credible)
Severity (matrix):  <Low | Medium | High | Critical>

Response:           <Avoid | Reduce | Transfer | Accept | Monitor>
Mitigation:         <the concrete action, or "none — accepted">
Residual severity:  <severity after mitigation, if Reduced>
Monitor signal:     <the observable that indicates the risk is materializing — if Monitor>
Escalation trigger: <the condition that forces escalation>

Owner:              <one accountable employee>
Acceptance owner:   <who accepted residual risk, and at what authority — if Accept>
Review date:        <when an accepted or monitored risk is re-examined>
Next action:        <the single required next step — never empty>
Status:             <identified | monitoring | mitigated | accepted | realized>
```

Rules for the record:

- **One owner, always.** A record without exactly one named accountable owner is incomplete.
- **A next action, always.** "Next action" is never blank. If the next action is "monitor," the monitor signal and trigger are filled in.
- **Severity is the matrix output.** The severity line must equal the intersection of the recorded likelihood and impact. A mismatch is an error in the record.
- **Accepted risk names its authority.** "The team felt it was fine" is not an owner. A residual High or Critical risk names the CTO or CEO who accepted it and the rationale.
- **Written, not verbal.** A risk discussed and not recorded is not a managed risk.

---

## 15. Worked Examples

### Example 1 — Engineering risk, Reduce

A Backend Engineer must add a column to a large, frequently written table. The migration could lock the table and stall writes during deploy.

- **Category:** Engineering (secondary: Operational). **Likelihood:** Medium (large table, busy path). **Impact:** High (a stalled write path is a production incident). **Severity (matrix):** **High**.
- **Response:** Reduce. Use an online, backwards-compatible migration in two phases (add nullable column, backfill, then enforce) behind a flag, with a tested rollback. **Residual severity:** Low.
- **Owner:** Backend Engineer. **Next action:** ship phase one behind the flag; verify write latency unchanged before phase two. **Status:** monitoring → mitigated.

### Example 2 — Schedule risk, Escalate then CEO-decided

A feature committed to an external launch date depends on a third-party API whose access approval has not arrived. Two weeks remain.

- **Category:** Schedule (secondary: Operational). **Likelihood:** High (approval is outside our control and overdue). **Impact:** Critical (a missed hard external commitment). **Severity (matrix):** **Critical**.
- **Response:** Escalate. The Tech Lead and Product Manager present options to the CEO: (1) build against a stub and accept integration risk, (2) renegotiate the date, (3) descope the dependent capability.
- **Owner:** Product Manager holds the risk; **CEO decides** the commitment trade-off. **Next action:** decision meeting before any further build. **Status:** identified → (per decision).

### Example 3 — Documentation risk, Accept with review date

A new operational runbook step for a rare manual recovery is undocumented. The recovery is needed perhaps once a year and is currently understood by one engineer.

- **Category:** Documentation (secondary: Operational). **Likelihood:** Low (rarely invoked). **Impact:** Medium (a slow, error-prone recovery if the one engineer is unavailable). **Severity (matrix):** **Low**.
- **Response:** Accept, with a Monitor. The Tech Lead accepts (Low is within owner authority) and schedules the runbook for the next documentation cycle.
- **Owner:** Technical Writer. **Acceptance owner:** Tech Lead. **Review date:** next sprint. **Next action:** add the runbook task to the backlog with a review date. **Status:** accepted.

### Example 4 — Security risk, deferred to the Security Framework

A change adds a new public endpoint returning user-scoped data. During risk analysis the reviewer flags a possible authorization gap.

- **Category:** Security. The risk is *scored* here — **Impact:** Critical (potential cross-user data access), **Likelihood:** Medium → **Severity: High** — but it is *evaluated* under the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md), whose authorization questions are authoritative.
- **Response:** Block per the Security Framework until the authorization check is added and verified. No acceptance is available at the engineer's level.
- **Owner:** Security Engineer. **Next action:** route to security review; do not merge. **Status:** identified → mitigated on fix.

---

## 16. Anti-Patterns

- **The unwritten worry.** A risk felt in a planning meeting but never recorded is the single most dangerous outcome — it has no owner, no severity, and no next action. Name it or it owns you.
- **Asserting severity by feel.** "This feels low-risk" is not an analysis. Severity is the matrix output of an honest likelihood and an honest impact. Skipping the two ratings to jump to a comfortable label is the root of most under-rated risk.
- **Down-rating to dodge escalation.** Quietly calling a Critical impact "high" or a High likelihood "medium" to keep a decision at your own level is a failure of honesty and a violation of this framework. Inputs are challenged with evidence, not the output.
- **Acceptance without an owner.** "We decided to live with it" with no named accepting authority and no review date is not acceptance — it is abandonment. Accepted risk always names who accepted it and when it is revisited.
- **Risk without a next action.** A record that ends at "identified" has done half the job. Every meaningful risk carries a defined next step.
- **Monitor with no signal.** "We'll keep an eye on it" is not a monitor. A monitor names the observable signal and the trigger that escalates.
- **Confusing doing the work with accepting the risk.** An engineer building a feature does not thereby gain the authority to accept its High residual risk. The two authorities are separate by design.
- **Treating realization as bad luck.** When a risk materializes, the question is never only "how do we recover" but also "was our original rating wrong?" A realized risk that does not produce a lesson learned wastes the most expensive feedback the company gets.
- **One-time analysis.** Risk is re-evaluated as the work changes. A risk scored at planning and never revisited through implementation, review, and release is a stale risk.

---

## 17. Relationship to Other Documents

- [Domain Model — `Risk`](../architecture/DOMAIN_MODEL.md#risk) — defines the `Risk` object (likelihood, impact, status, owner) that a Risk Record instantiates, and the [`Incident`](../architecture/DOMAIN_MODEL.md#incident) a realized risk produces.
- [Decision System](../systems/DECISION_SYSTEM.md) — how a risk *acceptance* becomes a recorded, attributed, remembered Decision Record of type `risk_acceptance`.
- [Approval System](../systems/APPROVAL_SYSTEM.md) — how and when the platform pauses for an explicit human approval on a risk-acceptance gate.
- [Notification System](../systems/NOTIFICATION_SYSTEM.md) — how an escalated or realized risk reaches the CEO.
- [Company Playbook](../company/COMPANY_PLAYBOOK.md) — the principles this framework operationalizes: honesty over false certainty, one owner per decision, structured communication (Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action), and "every action should reduce future work."
- [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) — confirms one accountable owner per risk and the acceptance authorities used in [Section 12](#12-authority-who-decides).
- [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md) — authoritative for security risk evaluation; this framework scores it and defers the deep analysis.
- [Technical Debt](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md), [Architecture](./ARCHITECTURE_DECISION_FRAMEWORK.md), [Performance](./PERFORMANCE_DECISION_FRAMEWORK.md), and [Accessibility](./ACCESSIBILITY_DECISION_FRAMEWORK.md) frameworks — domain-specific decision logic that feeds engineering-, operational-, and product-category risks into this framework.
- [Planning System](../systems/PLANNING_SYSTEM.md) — where risks are identified earliest and most cheaply, during plan creation.
- [Release SOP](../sops/RELEASE.md) and [QA Validation SOP](../sops/QA_VALIDATION.md) — the release and QA gates that this framework's risk dispositions feed into.
- [Rollback SOP](../sops/ROLLBACK.md) — the containment path invoked when a risk realizes in production.
- [Continuous Improvement System](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md) — where realized risks and mis-rated scores feed back to improve future risk analysis.
