# Prioritization Decision Framework

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

This framework defines how Engineering OS decides **what to work on next**. It exists to make prioritization **repeatable, traceable, and defensible** — never improvised, never the product of whoever asked most recently or most loudly. When the CEO requests an outcome, when the Product Manager assembles a sprint, when two committed efforts collide for the same engineer, or when an urgent ask threatens to displace planned work, this is the document that governs the ranking.

Prioritization is not a popularity contest and it is not first-in-first-out. It is the disciplined act of ranking work by the value it creates against the cost and risk of creating it, in service of the Company's current strategy. A good prioritization decision can be reconstructed by any employee months later: what was ranked, why it ranked where it did, what it displaced, and who decided.

This document is implementation-neutral. It defines decision behavior — not an issue tracker's fields, not a sprint tool's columns, not a scoring plugin. It complements — and is subordinate to — the [Company Playbook](../company/COMPANY_PLAYBOOK.md), which establishes the company's decision priority order (User Value → Engineering Quality → Maintainability → Performance → Delivery Speed → Complexity) and the principle that **the CEO owns outcomes and the company owns execution**. Where this framework and the Playbook conflict, the Playbook wins.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Prioritization Principles](#3-prioritization-principles)
4. [Prioritization Criteria](#4-prioritization-criteria)
5. [The Scoring Model](#5-the-scoring-model)
6. [Priority Tiers](#6-priority-tiers)
7. [Trade-off and Tie-Break Rules](#7-trade-off-and-tie-break-rules)
8. [Conflict Resolution](#8-conflict-resolution)
9. [Escalation Triggers](#9-escalation-triggers)
10. [Roles and Participation](#10-roles-and-participation)
11. [Output Format — The Priority Record](#11-output-format--the-priority-record)
12. [Worked Examples](#12-worked-examples)
13. [Anti-Patterns](#13-anti-patterns)
14. [Memory and Learning](#14-memory-and-learning)
15. [Related Documents](#15-related-documents)

---

## 1. Purpose

A software organization always has more work it could do than capacity to do it. The quality of the organization is determined less by how fast it executes and more by **whether it executes the right things in the right order**. Misprioritization is silent and expensive: the team ships, velocity looks healthy, and yet the most valuable, most strategic, or most time-sensitive work keeps slipping behind whatever felt urgent that week.

This framework gives Engineering OS a single, shared method for deciding:

- How any unit of work — an Initiative, Goal, Epic, Feature, Task, bug fix, or piece of debt repayment — is ranked against every other.
- Which criteria matter, how they are weighed, and how they combine into a comparable score.
- How conflicting priorities are resolved when two efforts cannot both be first.
- When a prioritization decision exceeds an employee's authority and must escalate — in particular, when it must reach the CEO.
- What must be recorded so that a ranking is auditable and so that future planning learns from past calls.

The goal is that **any employee, looking at the ranked backlog, can reconstruct why each item sits where it does, what value it carries, what it costs, and who is accountable for the ranking.** A priority that cannot pass that test is a guess wearing the costume of a decision.

Critically, this framework keeps the CEO focused on **outcome-level decisions**. The CEO sets direction and adjudicates genuine business trade-offs; the company performs the ranking, the scoring, and the sequencing. The CEO is never asked to rank tasks, order a sprint, or break ties between engineering efforts — that is execution, and execution belongs to the company.

---

## 2. Scope

**In scope.** The ranking and sequencing of any unit of work the Company can choose to do or defer, including:

- **Strategic work** — [Initiatives](../architecture/DOMAIN_MODEL.md#initiative) and [Goals](../architecture/DOMAIN_MODEL.md#goal) competing for the Company's strategic attention.
- **Product work** — [Epics](../architecture/DOMAIN_MODEL.md#epic) and [Features](../architecture/DOMAIN_MODEL.md#feature) competing for a place in the roadmap and sprint.
- **Engineering work** — [Tasks](../architecture/DOMAIN_MODEL.md#task) competing for an engineer's day within a sprint.
- **Corrective work** — bug fixes (via [SOP: Bug Fix](../sops/BUG_FIX.md)) and technical-debt repayment (via the [Technical Debt Decision Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md)) competing with feature work for capacity.
- **Reactive work** — incident follow-ups, security remediations, and unplanned requests that arrive after a sprint is committed.

**Out of scope.**

- **Whether a capability should exist at all.** That is a product-definition decision (does this belong in the product?), not a ranking decision (where does it sit relative to other accepted work?). It is owned by the Product Manager and the CEO through Initiative and Goal definition.
- **How work is implemented.** Sequencing two Tasks is prioritization; choosing the architecture to implement them is governed by the [Architecture Decision Framework](./ARCHITECTURE_DECISION_FRAMEWORK.md).
- **Whether to accept a quality shortcut.** That is a [Technical Debt](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md) decision. Prioritization decides *when* recorded debt is repaid; it does not decide whether the debt is acceptable.
- **Release gating.** A QA No-Go or security block stops a release regardless of how the work was prioritized. Prioritization never overrides a gate (see [SOP: Release](../sops/RELEASE.md)).

When in doubt about whether something is a definition decision or a prioritization decision, resolve the definition first (is this in the product?) and only then rank it (where does it go?).

---

## 3. Prioritization Principles

Five principles govern every ranking. They are derived from the [Company Playbook](../company/COMPANY_PLAYBOOK.md) and are not negotiable per decision.

1. **Value over volume.** The Company optimizes for value delivered, not items completed. Closing many low-value items is not progress. The ranking always favors the work that moves a [Goal's](../architecture/DOMAIN_MODEL.md#goal) success metric, not the work that is merely easy to finish.

2. **Cost and risk are first-class, not afterthoughts.** A high-value item that is enormously expensive or dangerous may rank below a moderate-value item that is cheap and safe. Value is divided by cost; it is never considered alone.

3. **Strategy is the tie-breaker, not the afterthought.** When value and cost are close, the work that advances the Company's current Initiatives wins. Prioritization that ignores strategy produces a busy company drifting nowhere.

4. **The default order is the ranked order.** Work is executed top-down off the ranked backlog. Jumping the queue is an explicit, recorded exception with an owner — never a silent reshuffle. "Someone asked" is not a reason to reorder.

5. **The CEO owns outcomes; the company owns sequencing.** The CEO is consulted on genuine business trade-offs (which committed outcome wins when two collide). The CEO is never asked to order tasks, break engineering ties, or maintain the backlog. The company protects the CEO from execution-level prioritization.

---

## 4. Prioritization Criteria

Every unit of work is evaluated against **seven criteria**, grouped into two families: **value criteria** (what we gain) and **cost criteria** (what it takes and what could go wrong). Each criterion is scored on a 1–5 scale by the responsible employee, with a one-line justification per score. Scores are coarse on purpose — prioritization rewards good relative judgment, not false precision.

### 4.1 Value criteria

| Criterion | Question it answers | 1 (low) | 5 (high) |
|---|---|---|---|
| **User Value** | How much does this improve the experience of the people who use the software? | Internal nicety; no user notices | Removes a top user pain or unlocks a frequently-requested capability |
| **Business Impact** | How much does this move a measurable business or [Goal](../architecture/DOMAIN_MODEL.md#goal) metric? | No measurable effect | Directly moves a committed Goal's success metric |
| **Urgency** | How time-sensitive is the value — does it decay if delayed? | Value is stable; fine to do anytime | Value is lost or a hard deadline is missed if not done now |
| **Strategic Fit** | How well does this advance the Company's current [Initiatives](../architecture/DOMAIN_MODEL.md#initiative)? | Unrelated to any active Initiative | Core to the highest-priority active Initiative |

### 4.2 Cost criteria

| Criterion | Question it answers | 1 (low cost / low risk) | 5 (high cost / high risk) |
|---|---|---|---|
| **Engineering Cost** | How much effort, across all roles, does this take to deliver to the Definition of Done? | A few hours, one engineer | Multi-sprint, multiple roles, significant coordination |
| **Risk** | How likely is this to go wrong, and how bad if it does? | Well-understood, reversible, contained | Novel, one-way door, broad blast radius, or security-sensitive |
| **Dependencies** | How blocked is this by, or how blocking is it of, other work? | Self-contained; nothing waits on it | Blocked by unfinished work, or many efforts wait on it |

**Dependencies are dual-natured.** A high dependency score because the item is *blocked* lowers its near-term priority (it cannot start). A high score because the item *blocks others* raises its priority (it unblocks value downstream). The Priority Record (Section 11) records which direction applies; the scoring model in Section 5 treats the two cases explicitly.

**Security is never silently low.** Any item with a security dimension has its Risk score set by the [Security Engineer](../employees/SECURITY_ENGINEER.md), not by the proposing employee, consistent with the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md). Security-driven urgency can promote an item to P0 regardless of its other scores (see [Priority Tiers](#6-priority-tiers)).

---

## 5. The Scoring Model

The scoring model converts the seven criteria into one comparable **Priority Score**. It is deliberately simple, transparent, and reproducible — two employees scoring the same item with the same evidence should land within one tier of each other.

### 5.1 The formula

```
VALUE   = (2 × User Value) + (2 × Business Impact) + Strategic Fit + Urgency
COST    = Engineering Cost + Risk

PRIORITY SCORE = VALUE / COST          (higher = do sooner)
```

- **VALUE** weights User Value and Business Impact double, because the Playbook's decision priority order places User Value first and the Company exists to deliver outcomes. Strategic Fit and Urgency act as amplifiers, not headline drivers.
- **COST** combines Engineering Cost and Risk. Dividing value by cost means the Company naturally prefers cheap, safe value and is appropriately skeptical of expensive, risky value — a small, well-understood win can outrank a large, dangerous one.
- **Dependencies** are *not* in the arithmetic. They are a **gate and a sequencer**, applied after the score:
  - If the item is **blocked** by unfinished work, it is not schedulable now regardless of score. It waits, and its blocker inherits at least its priority (you cannot want the dependent more than its prerequisite).
  - If the item **blocks** other high-value work, it is promoted to sit immediately ahead of what it unblocks.

### 5.2 Why a ratio, not a sum

A pure sum of all criteria would let a sprawling, risky effort outrank a tight, high-value one simply by being "big." The ratio keeps the Company honest: value must be earned per unit of cost. This mirrors the Playbook's belief that **every action should reduce future work** and that **long-term quality beats short-term speed** — cheap, safe, high-value work compounds; expensive, risky work must justify itself.

### 5.3 Worked scoring example

> A Feature that lets users export their data. Frequently requested (User Value 5), moves an activation Goal modestly (Business Impact 3), no deadline (Urgency 2), squarely inside the active "User Trust" Initiative (Strategic Fit 5). It is a few days of backend work (Engineering Cost 3), low risk (Risk 2), and self-contained (Dependencies 1, neither blocked nor blocking).

```
VALUE = (2×5) + (2×3) + 5 + 2  = 23
COST  = 3 + 2                   = 5
PRIORITY SCORE = 23 / 5         = 4.6   → high; ranks in the upper band (see tiers)
```

The score is never the whole decision — it is the starting point that makes the conversation concrete. A scored ranking turns "I feel this is important" into "this is 4.6 against that 2.1, and here is why."

---

## 6. Priority Tiers

The continuous Priority Score is mapped to four discrete **tiers** for communication and scheduling. Tiers — not raw scores — are what appear on the backlog and in CEO summaries, because they carry an agreed meaning about *when* work happens.

| Tier | Meaning | Typical score band | Scheduling behavior |
|---|---|---|---|
| **P0 — Critical / Now** | Must be done immediately; displaces committed work. | Any score, when promoted by a P0 trigger | Pulled into the current sprint at once; may interrupt in-flight work |
| **P1 — High / Next** | The most valuable schedulable work; front of the queue. | ≈ 4.0 and above | Scheduled into the current or next sprint |
| **P2 — Medium / Soon** | Real value; scheduled once P1 work is committed. | ≈ 2.0 – 4.0 | Scheduled when capacity allows; the default home of most work |
| **P3 — Low / Later** | Worth doing eventually; carried and re-reviewed. | below ≈ 2.0 | Backlog; revisited at planning, never blocks higher tiers |

**P0 is special.** P0 is not "a very high score." It is a categorical promotion triggered by one of a small set of conditions, independent of the arithmetic:

- A **P0 or P1 [Incident](../architecture/DOMAIN_MODEL.md#incident)** or its immediate remediation.
- An **exploitable security vulnerability on a reachable path** (per the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md)).
- A **production-blocking defect** or a regression that breaks the Definition of Done of already-shipped work.
- A **hard external deadline** the CEO has explicitly committed to, where missing it has business consequences.

P0 promotions are always recorded with the triggering condition and an owner. Inflating an ordinary item to P0 to jump the queue is an anti-pattern (Section 13) and is caught at review.

The score band boundaries are guidance, not law. The responsible employee may place an item one tier off its band with a recorded one-line justification; placement more than one tier off its band requires the same justification plus confirmation from the tier above (Reviewer/Tech Lead → CTO), exactly as severity disputes are handled in the [Technical Debt Decision Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md).

---

## 7. Trade-off and Tie-Break Rules

Scores collide. Two items frequently land in the same tier, sometimes with near-identical Priority Scores. The following rules resolve ties **in order** — the first rule that separates the items decides, and no later rule is consulted.

1. **Apply the Playbook decision priority order.** When two items are close, prefer the one that ranks higher on the company's standing order: **User Value → Engineering Quality → Maintainability → Performance → Delivery Speed → Complexity** (from the [Company Playbook](../company/COMPANY_PLAYBOOK.md)). The item that delivers more user value, or protects engineering quality more, wins.

2. **Unblock before you build.** If one item is a dependency of other high-value work, it wins — finishing it converts multiple downstream items from blocked to schedulable. Sequencing for flow beats sequencing for individual score.

3. **Strategic fit breaks remaining ties.** Prefer the item that advances the highest-priority active [Initiative](../architecture/DOMAIN_MODEL.md#initiative). A company that keeps its strategic threads moving outperforms one that scatters effort across equally-scored but unrelated work.

4. **Prefer the smaller, safer item.** When still tied, do the cheaper, lower-risk item first. It frees capacity sooner, returns value sooner, and reduces the cost of being wrong — consistent with **every action should reduce future work**.

5. **Prefer the older commitment.** If two items remain indistinguishable, the one the Company committed to earlier wins. Reliability means honoring commitments in the order they were made.

**The interrupt rule.** When new work arrives mid-sprint, it does **not** automatically displace committed work. It is scored like everything else. Only a P0 trigger justifies interrupting an in-flight Task; any lower tier joins the queue and is scheduled at the next planning boundary. This protects the Company from the most common prioritization failure: letting whatever is newest feel like whatever is most important.

**The capacity rule.** Prioritization ranks; it does not invent capacity. When the ranked P0/P1 work exceeds a sprint's capacity, the cut line is drawn at capacity and what falls below it is explicitly deferred and recorded — never silently dropped, never silently absorbed by overcommitting the team.

---

## 8. Conflict Resolution

Disagreements about priority are normal and healthy; unresolved or unrecorded disagreements are not. Engineering OS resolves priority conflicts through authority and evidence, never through volume or persistence.

**The mechanism is the score, not the argument.** When two employees disagree on where an item belongs, they do not debate adjectives — they compare scores. Each names the criteria scores they assigned and the one-line evidence behind each. In almost every case the disagreement localizes to one or two criteria (usually Business Impact or Risk), and the conversation becomes "is this a 3 or a 4 on impact, and why," which is resolvable with evidence.

**Authority resolves what evidence cannot.** When evidence does not settle it, the disagreement escalates by domain along the [Reporting Structure](../organization/REPORTING_STRUCTURE.md):

| Disagreement is about… | Resolved by |
|---|---|
| User Value, Business Impact, Strategic Fit, scope value | **Product Manager** |
| Engineering Cost, technical Risk, dependency reality | **Tech Lead**, then **CTO** |
| Security Risk at any level | **Security Engineer**, then **CTO** |
| Which committed business outcome wins when two collide | **CEO** (the only prioritization decision routed to the CEO) |

**The higher concern holds pending resolution.** Exactly as with technical-debt severity, while a priority disagreement is open the more conservative placement holds — a security or correctness concern keeps the item ranked up, not down, until the authority rules. The Company never ships a deprioritization of a safety concern by default.

**Conflicting CEO requests.** When the CEO asks for two things that cannot both be first, the company does not silently choose — nor does it ask the CEO to micromanage the sequence. The Product Manager presents a single [Recommendation](../architecture/DOMAIN_MODEL.md#recommendation) in the standard structure (Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action), showing the scored trade-off and a proposed order, and asks the CEO only to confirm the **outcome-level** call: which result matters more right now. The CEO decides the outcome; the company sequences the work.

---

## 9. Escalation Triggers

Escalation moves a prioritization decision to higher authority. It is required — not optional — in the situations below. Escalation follows the [Reporting Structure](../organization/REPORTING_STRUCTURE.md) and the [Company Playbook](../company/COMPANY_PLAYBOOK.md) escalation rules.

| Situation | Escalate to | Trigger |
|---|---|---|
| Two committed business outcomes collide and cannot both be first | Product Manager → **CEO** | When the trade-off affects results the CEO committed to |
| A P0 promotion is proposed | **CTO** (and Security Engineer if security-driven) | Before the promotion takes effect — P0 is never a unilateral call below the Tech Lead |
| Reprioritization would break a commitment already communicated to the CEO | **CEO** | Before the committed work is displaced |
| Engineering Cost or Risk is disputed by more than one tier | **CTO** | When Tech Lead and the proposer cannot reconcile with evidence |
| Security-driven priority at any level | **Security Engineer**, then **CTO** if it reaches P0/P1 | On identification |
| Prioritization would require bypassing a QA No-Go or security block to "hit priority" | **CTO** | Always — a gate is never traded away for priority |
| A strategic shift would reorder Initiatives | Product Manager → **CEO** | Before the roadmap is re-sequenced — strategy is CEO-owned |
| The same high-value item is deprioritized across three or more planning cycles | **CTO** and **Product Manager** | At the third deferral — chronic deferral is a signal, not a default |

The CEO is involved **only** for outcome-level trade-offs: which committed result wins, whether a strategic direction changes, or a P0/P1-class business risk. The company never asks the CEO to rank tasks, order a sprint, or adjudicate engineering-internal sequencing the Tech Lead and Product Manager are empowered to decide. This is the operational expression of **the CEO owns outcomes; the company owns execution**.

---

## 10. Roles and Participation

Prioritization is a shared input but a single accountability. Each role contributes a distinct part; the Product Manager owns the resulting ranking.

| Role | Participation |
|---|---|
| **CEO (User)** | Owns outcomes and strategic direction. Approves Initiatives and Goals, which set the strategic weights every score inherits. Adjudicates only outcome-level trade-offs and explicit deadline commitments. Receives the ranked backlog as a tiered summary — never a raw score sheet — and is never asked to order individual work. |
| **Product Manager** | **Owns this framework and the ranked backlog.** Scores and owns the value criteria (User Value, Business Impact, Urgency, Strategic Fit). Maintains tiering, presents trade-offs to the CEO as structured Recommendations, and is accountable that the backlog reflects strategy. Represents the cost of deferral in product terms. |
| **CTO** | Owns strategic engineering judgment in prioritization. Final authority on disputed Engineering Cost and Risk and on P0 promotions. Ensures the ranking does not mortgage architectural health for short-term delivery speed, and that no priority trades away a gate. |
| **Tech Lead** | Owns the engineering-cost reality. Scores Engineering Cost, technical Risk, and Dependencies; sequences Tasks within a sprint off the ranked Features; surfaces capacity limits and draws the cut line honestly. Translates the Product Manager's ranking into an executable sprint without re-ranking by preference. |
| **Department owners** (Quality, Operations, Growth leads) | Supply the cost, risk, and value signals their domain owns: QA supplies test-risk and gate constraints, Operations supplies release/operational risk and deadline realities, Growth supplies business-impact and user-value evidence. They inform scores; they do not unilaterally reorder the cross-company backlog. |
| **Security Engineer** | Mandatory scorer of the Risk criterion wherever a security dimension exists. Can promote an item to P0 on an exploitable, reachable vulnerability. |
| **Reviewer** | Checks, at review time, that work being done matches its recorded priority — that nothing high-tier was quietly skipped and nothing was quietly elevated to jump the queue. |
| **QA Engineer** | Owns the gate that priority can never bypass: a No-Go stops the work regardless of how it was ranked (see [SOP: QA Validation](../sops/QA_VALIDATION.md)). |

The [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) is the authoritative source for ownership boundaries; this table is its projection onto prioritization decisions. The [Product Manager handbook](../employees/PRODUCT_MANAGER.md) and [Tech Lead handbook](../employees/TECH_LEAD.md) carry the role-level detail.

---

## 11. Output Format — The Priority Record

Every non-trivial prioritization decision produces a **Priority Record** — the repeatable, traceable output of this framework. For routine sprint ordering, the record is the scored, tiered backlog itself. For any decision that promotes to P0, displaces committed work, or overrides a score band, a standalone Priority Record is written and, when it constitutes a lasting trade-off, stored as a [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record) of type `process` or `scope`.

The format is implementation-neutral — it specifies what must be captured, not where it lives.

```
PRIORITY RECORD

ID:               <stable identifier>
Item:             <what is being prioritized — Initiative/Goal/Epic/Feature/Task/fix/debt>
Item ref:         <link to the Initiative/Goal/Feature/Task/Incident>
Decided by:       <accountable employee — usually the Product Manager>
Date:             <date>

SCORES (1–5, each with a one-line justification):
  User Value:        <n> — <why>
  Business Impact:   <n> — <why>
  Urgency:           <n> — <why>
  Strategic Fit:     <n> — <which Initiative, how central>
  Engineering Cost:  <n> — <effort across roles>
  Risk:              <n> — <what could go wrong; security scorer if applicable>
  Dependencies:      <n> — <blocked-by | blocks; which items>

COMPUTED:
  VALUE = (2×UV)+(2×BI)+SF+U = <n>
  COST  = EC + Risk          = <n>
  PRIORITY SCORE = VALUE/COST = <n>
  TIER  = <P0 | P1 | P2 | P3>     (with P0 trigger, if promoted)

PLACEMENT:
  Ranks: <ahead of X / behind Y>
  Displaces: <what committed work this pushes out, or "none">
  Deferred below the cut line: <what this displaces off the sprint, or "n/a">

RATIONALE:
  <the trade-off in plain language — what this beats and why,
   following Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action
   when presented to the CEO>

LINKS:
  Decision Record: <id, if a lasting trade-off>
  Related Risk:    <id, if a risk drove the ranking>
  Originating req: <CEO request / Goal / Incident id>

CREATED: <date / employee>     LAST REVIEWED: <date / employee>
```

A record missing any of **the seven scores, the resulting tier, or an accountable owner** is incomplete and does not constitute a defensible prioritization. An incomplete record is treated as an unranked item and returned to the responsible employee.

---

## 12. Worked Examples

These examples illustrate the decision logic. They are illustrative, not exhaustive.

### 12.1 The cheap win beats the expensive headline

> Two Features compete for the next sprint. Feature A is a flashy redesign of a settings page (User Value 3, Business Impact 2, Urgency 1, Strategic Fit 2; Engineering Cost 5, Risk 3). Feature B fixes a confusing error message that is a top support complaint (User Value 4, Business Impact 3, Urgency 2, Strategic Fit 3; Engineering Cost 1, Risk 1).

```
A: VALUE = (2×3)+(2×2)+2+1 = 13;  COST = 5+3 = 8;  SCORE = 1.6  → P3
B: VALUE = (2×4)+(2×3)+3+2 = 19;  COST = 1+1 = 2;  SCORE = 9.5  → P1
```

- **Decision:** Feature B is scheduled first; Feature A drops to "Later." The redesign *feels* bigger, but B delivers more user value at a fraction of the cost and risk.
- **Why correct:** The ratio rewards cheap, safe value. The Company ships a real improvement this sprint and revisits the redesign when its value or strategic fit rises.

### 12.2 Unblock before you build

> A high-value Feature (Score 4.2, P1) depends on a shared data-access seam that does not yet exist. The seam itself scores modestly on its own (Score 2.4, P2) — it delivers no direct user value.

- **Decision:** The seam is promoted to sit immediately ahead of the Feature it unblocks. It inherits the dependent's priority because the dependent cannot start without it.
- **Why correct:** Tie-break rule 2 (unblock before you build). Sequencing for flow converts the blocked P1 into schedulable work; scoring the seam in isolation would have wrongly buried it.

### 12.3 The CEO trade-off, kept at outcome level

> The CEO asks for both a marketing launch page (hard external date) and a billing reliability fix in the same week, and capacity allows only one to be first.

- **Decision:** The Product Manager scores both, sees the launch page carries a committed deadline (Urgency 5) while the billing fix carries real but non-deadline risk, and presents a single structured Recommendation: "Recommend the launch page first to hit the committed date; the billing fix follows immediately after, mitigated by monitoring in the interim. Confidence: high." The CEO confirms the outcome-level call.
- **Why correct:** Two committed outcomes collided — a genuine CEO decision per Section 9. But the CEO was asked only which *outcome* wins, not how to order the tasks. The company did the scoring and the sequencing.

### 12.4 The interrupt that should not have been

> Mid-sprint, a stakeholder requests a "quick" dashboard tweak and frames it as urgent. An engineer is tempted to drop their committed Task and do it.

- **Decision:** The tweak is scored, not slotted. It lands P2 (real but minor value, no deadline, no P0 trigger). It joins the queue for the next planning boundary; the engineer continues the committed Task.
- **Why correct:** The interrupt rule. Newest is not most important. Only a P0 trigger justifies displacing in-flight work, and "someone called it urgent" is not a P0 trigger.

---

## 13. Anti-Patterns

**HiPPO prioritization.** Ranking by the Highest-Paid Person's Opinion — or the loudest, or the most recent requester. Priority is set by scored value against cost, not by who asked. The CEO sets outcomes; the company sets the order.

**Everything is P0.** When every item is "critical," nothing is. P0 is a categorical promotion with a defined trigger and an owner, not a synonym for "I want this soon." Inflating tier to jump the queue is caught at review.

**Score theater.** Producing numbers to justify a conclusion already reached. The scores must precede the ranking and be backed by one-line evidence per criterion; a score with no justification is a guess in a costume.

**Prioritizing by effort alone.** Doing the easy things because they are easy ("quick wins" with no value) or avoiding the hard things because they are hard. Effort is one denominator term, not the decision. Cheap *and valueless* is still low priority.

**Silent reshuffling.** Reordering the backlog without a record. Every queue jump, P0 promotion, and committed-work displacement is recorded with an owner. An unrecorded reorder is indistinguishable from chaos.

**Ignoring dependencies until they bite.** Scheduling a Feature whose prerequisite is unbuilt, then discovering it cannot start. Dependencies are a gate applied before scheduling, not a surprise discovered mid-sprint.

**Trading a gate for priority.** Skipping a QA No-Go or a security block because the work is "high priority." Priority never overrides a gate; a high-priority item that fails QA is a high-priority item that is not done.

**Overcommitting instead of cutting.** Pretending the team has capacity for all the P1 work by silently overloading the sprint. Prioritization draws an honest cut line at capacity and records what falls below it. Reliability means committing to what can actually be delivered.

**Strategy drift.** A backlog that, item by item, looks reasonable but in aggregate advances no Initiative. Strategic Fit is a scored criterion and a tie-breaker precisely to keep the sum of the work pointed somewhere.

---

## 14. Memory and Learning

Per the [Company Playbook](../company/COMPANY_PLAYBOOK.md), every meaningful decision becomes memory. Prioritization decisions are no exception.

- When a ranking constitutes a **lasting trade-off** — a P0 promotion, a displaced commitment, a strategic re-sequencing — the Priority Record and any associated [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record) enter [Company Memory](../architecture/DOMAIN_MODEL.md#memory). Future planning finds the precedent before re-litigating it.
- After delivery, the Product Manager compares **predicted value to realized value**. When a high-scored item under-delivered, or a low-scored item proved unexpectedly valuable, a [Memory Record](../architecture/DOMAIN_MODEL.md#memory-record) of type `lesson_learned` is written. Systematic miscalibration — consistently over-scoring a category of work — is a signal to adjust how that category is scored, not to re-argue the instance.
- Prioritization quality feeds the Company's **Velocity** and **Developer Satisfaction** health dimensions (see [Company Health](../company/COMPANY_PLAYBOOK.md)). A backlog that churns — items repeatedly reprioritized without shipping — is reported as a health signal, because thrash is as expensive as idleness.

The organization should make better prioritization calls over time. A repeated misranking is a prompt to fix the scoring inputs or the strategy weights, not just to reorder one backlog.

---

## 15. Related Documents

- [Company Playbook](../company/COMPANY_PLAYBOOK.md) — the decision priority order, the structured communication format, and the "CEO owns outcomes" principle that govern this framework where they overlap.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — definitions for [Initiative](../architecture/DOMAIN_MODEL.md#initiative), [Goal](../architecture/DOMAIN_MODEL.md#goal), [Epic](../architecture/DOMAIN_MODEL.md#epic), [Feature](../architecture/DOMAIN_MODEL.md#feature), [Task](../architecture/DOMAIN_MODEL.md#task), [Sprint](../architecture/DOMAIN_MODEL.md#sprint), [Recommendation](../architecture/DOMAIN_MODEL.md#recommendation), and [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record) that this framework ranks and reuses.
- [Architecture Decision Framework](./ARCHITECTURE_DECISION_FRAMEWORK.md) — governs *how* prioritized work is built; prioritization governs *when*.
- [Technical Debt Decision Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md) — decides whether debt is acceptable; prioritization decides when recorded debt is repaid against feature work.
- [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md) and [Performance Decision Framework](./PERFORMANCE_DECISION_FRAMEWORK.md) — supply the Risk and value signals that drive scores in their domains.
- [SOP: New Feature](../sops/NEW_FEATURE.md) — the workflow that prioritized Features flow through.
- [SOP: Bug Fix](../sops/BUG_FIX.md) — the path for defects, which are scored and ranked alongside feature work.
- [SOP: QA Validation](../sops/QA_VALIDATION.md) and [SOP: Release](../sops/RELEASE.md) — the gates that priority must never bypass.
- [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) and [Reporting Structure](../organization/REPORTING_STRUCTURE.md) — authoritative ownership and escalation paths.
- [Product Manager handbook](../employees/PRODUCT_MANAGER.md), [Tech Lead handbook](../employees/TECH_LEAD.md), [Security Engineer handbook](../employees/SECURITY_ENGINEER.md) — role-level detail for the primary participants.
- [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) and [MVP Roadmap](../product/MVP_ROADMAP.md) — the strategic context that sets the Initiative weights every score inherits.
