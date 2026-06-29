# Performance Decision Framework

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

This framework defines how Engineering OS reasons about performance: speed, responsiveness, latency, bundle weight, resource usage, infrastructure efficiency, and user-perceived performance. It is the company's repeatable procedure for deciding whether a change helps or harms performance, whether a performance cost is acceptable, and who must approve it.

Performance is not a single number and it is not the property of one role. It is a property of the whole system as the user experiences it. This framework exists so that every employee evaluates performance the same way — with the same evidence, the same trade-off model, and the same approval triggers — rather than each engineer optimizing for the metric they personally care about.

This document describes company behavior and the records that behavior produces. It is intentionally tool-neutral: it specifies *what* must be measured and *how* the decision is made, not which profiler, load tester, or monitoring product produces the numbers. Tools change; this framework does not.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [The Four Performance Dimensions](#3-the-four-performance-dimensions)
4. [Decision Criteria](#4-decision-criteria)
5. [Measurement Rules](#5-measurement-rules)
6. [The Trade-off Model](#6-the-trade-off-model)
7. [The Decision Procedure](#7-the-decision-procedure)
8. [Approval Triggers](#8-approval-triggers)
9. [Roles and Participation](#9-roles-and-participation)
10. [Performance Budgets](#10-performance-budgets)
11. [Worked Examples](#11-worked-examples)
12. [Anti-patterns](#12-anti-patterns)
13. [Output Format — The Performance Decision Record](#13-output-format--the-performance-decision-record)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

Every meaningful change to a repository moves performance in some direction. Most of those moves are invisible until they compound into a slow page, an expensive bill, or a timeout under load. The purpose of this framework is to make performance a deliberate, evidenced decision rather than an accident discovered in production.

This framework answers four questions for any change:

1. **Did performance change, and by how much?** — established by measurement, not intuition.
2. **Does the change cross a threshold the company cares about?** — established by budgets and criteria.
3. **Is the trade-off worth it?** — established by the trade-off model.
4. **Who must approve it?** — established by the approval triggers.

When followed, this framework guarantees that no change ships with an unmeasured, unexplained, or unapproved performance regression, and that performance *wins* are recognized and recorded rather than lost.

---

## 2. Scope

**In scope.** Any change that can plausibly affect:

- **Speed and responsiveness** — how quickly the system reacts to a user action or request.
- **Latency** — end-to-end time for an operation, including network, compute, and I/O.
- **Throughput** — how much work the system completes per unit of time under load.
- **Bundle weight** — the bytes a client must download, parse, and execute before it is usable.
- **Resource usage** — CPU, memory, disk, and network consumed to do a unit of work.
- **Infrastructure efficiency** — the cost and capacity required to serve the workload.
- **User-perceived performance** — how fast the system *feels*, independent of raw numbers.

**Out of scope.** This framework does not decide *what* to build (that is product scope), *whether code is correct* (that is review and QA), or *whether the architecture is sound* (the Architecture Decision Framework owns that). It does not duplicate the Risk Analysis Decision Framework: a realized performance risk that reaches production becomes an [Incident](../architecture/DOMAIN_MODEL.md#incident), handled by the incident path. Performance interacts with all of these, and this framework defers to them on their own questions.

This framework applies at every [autonomy level](../architecture/DOMAIN_MODEL.md#company). At lower autonomy it produces recommendations the CEO approves; at higher autonomy it gates the company's own automated decisions. The logic is identical — only who presses the button changes.

---

## 3. The Four Performance Dimensions

Performance is evaluated along four dimensions. They are kept separate because they have different owners, different measurements, and different failure modes. A change is never judged "fast" or "slow" overall — it is judged per dimension, and the dimensions are reconciled at the end.

| Dimension | What it measures | Primary owner | Typical metrics |
|---|---|---|---|
| **Frontend** | What the client downloads, parses, renders, and reacts to | Frontend Engineer | Bundle weight (transferred + parsed bytes), main-thread work, render and interaction timing, layout stability |
| **Backend** | What a request costs in compute and I/O on the server | Backend Engineer | Request latency (median and tail), query count and duration, allocation and CPU per request, throughput under load |
| **Infrastructure** | What the workload costs in capacity and money | Infrastructure Engineer | Resource utilization, cost per request or per tenant, autoscaling behavior, saturation headroom |
| **Perceived** | How fast the system *feels* to the user, regardless of raw numbers | Frontend Engineer (with Product Manager) | Time to first meaningful response, perceived responsiveness of interactions, optimistic-update behavior, progressive disclosure |

**Why perceived performance is its own dimension.** Two changes with identical backend latency can feel completely different. A spinner that appears instantly and a skeleton that previews layout both hide the same wait, but the user perceives them differently. Perceived performance is a real, decision-relevant dimension and is never collapsed into the raw numbers. A change that worsens a raw metric but improves perceived performance is a legitimate, recordable decision — and the reverse is a trap.

A single change can move multiple dimensions in opposite directions. Server-side rendering may improve perceived performance and worsen backend latency. Aggressive caching may improve frontend and backend numbers and worsen infrastructure cost or correctness. The framework requires that **each affected dimension be measured and reasoned about independently before they are reconciled.**

---

## 4. Decision Criteria

A performance change is evaluated against these criteria, in priority order. Higher criteria dominate lower ones; the framework only descends when the higher criteria are satisfied or neutral.

1. **User value.** Does the change make the experience meaningfully better or worse for a real user, in a real scenario, on a realistic device and network? A regression no user can perceive is weighted differently from one that degrades a hot path.
2. **Correctness and safety.** Performance is never bought with correctness, data integrity, or security. A faster path that can return wrong or stale results is rejected outright; it is not a trade-off, it is a defect.
3. **Headroom under load.** Does the change preserve the system's ability to absorb growth and spikes? A change that is fast at current volume but eliminates headroom is a regression even if today's numbers improve.
4. **Maintainability.** Is the optimization understandable and durable, or is it a fragile trick that the next engineer will break? Per the [Company Playbook](../company/COMPANY_PLAYBOOK.md), readable code beats clever code — including clever-fast code.
5. **Cost.** What does the change do to infrastructure cost per unit of work? Efficiency that lowers cost is a win to be recorded; a speedup that multiplies cost is a trade-off requiring justification.
6. **Delivery speed.** Only when the above are satisfied does the cost of *doing* the optimization now (versus deferring it) enter the decision.

These criteria mirror the company's general decision-making order (User Value → Engineering Quality → Maintainability → Performance → Delivery Speed → Complexity). Within performance work they are specialized but never reordered.

---

## 5. Measurement Rules

Performance decisions are made from evidence, never from intuition. The following rules are mandatory.

### 5.1 Baseline before, measurement after

**Every performance decision requires a baseline measurement of the current behavior and a post-change measurement of the new behavior.** A claim of "faster" or "slower" without both numbers is not admissible and is treated as an unmeasured regression by default. The baseline is captured *before* the change is implemented, or recovered from existing monitoring, so that the comparison is honest.

### 5.2 Measure what the user experiences

Each affected dimension from [Section 3](#3-the-four-performance-dimensions) is measured on its own terms. Backend latency is measured at realistic concurrency, not single-request; frontend cost is measured on a realistic device and network profile, not the engineer's workstation; infrastructure cost is measured per unit of work, not as an absolute that hides growth.

### 5.3 Report distributions, not single numbers

Performance is a distribution. A median can improve while the tail collapses. Every measurement reports at least a central tendency (median) and a tail (the slow end — for example the 95th or 99th percentile). A change is judged on **both**; a tail regression is a regression even when the median improves.

### 5.4 Same conditions on both sides

The baseline and the post-change measurement must be taken under comparable conditions — comparable input size, comparable load, comparable environment, comparable data shape. A comparison across different conditions proves nothing and is rejected.

### 5.5 Tool-neutrality

This framework names metrics, not products. The company may use any profiler, load generator, bundle analyzer, or monitoring system, provided it can produce a baseline, a post-change number, and a distribution under comparable conditions. No decision in this framework depends on a specific tool, vendor, or measurement harness. When a measurement is reported, the *method* is recorded so it can be reproduced; the *tool* is an implementation detail.

### 5.6 Significance over noise

A measured difference must exceed the natural run-to-run variance of the measurement before it counts as a change. Repeat the measurement enough times to distinguish a real movement from noise. A "regression" inside the noise band is recorded as *no measured change*, not as a regression — and likewise for claimed improvements.

---

## 6. The Trade-off Model

Most performance decisions are trade-offs: a gain in one dimension paid for in another, or a gain in performance paid for in complexity, cost, or delivery time. The trade-off model makes those exchanges explicit.

A trade-off is characterized by four values:

- **Benefit** — the size and reach of the improvement (how much, on which dimension, for how many users, in which scenario).
- **Cost** — what is spent to get it (added latency elsewhere, added bytes, added infrastructure cost, added complexity, added delivery time).
- **Reach** — whether the affected path is hot (every request / every page load) or cold (rare, administrative, one-time).
- **Reversibility** — whether the change can be cheaply undone if it proves wrong, or whether it commits the company to a direction.

The model resolves to one of four dispositions:

| Disposition | Condition | Action |
|---|---|---|
| **Clear win** | Improves one or more dimensions, harms none beyond noise, no meaningful cost increase | Proceed; record the win |
| **Justified trade-off** | A meaningful gain on a hot path, paid for with an acceptable, bounded cost on a colder path or a lower-priority dimension | Proceed if within budget; record the reasoning and the rejected alternatives |
| **Deferred** | The gain is real but small, the cost is uncertain, or the path is cold | Record as a future improvement; do not spend effort now |
| **Rejected** | Cost exceeds budget, harms a higher-priority criterion, trades correctness/safety for speed, or removes headroom | Do not proceed; record why so the company does not re-litigate it |

The trade-off is always evaluated against the [performance budgets](#10-performance-budgets) and the [decision criteria](#4-decision-criteria). The model never overrides correctness or safety: a trade-off that buys speed with correctness has no valid disposition other than **Rejected**.

---

## 7. The Decision Procedure

This is the repeatable logic. Every performance decision follows these steps in order, and the steps produce the [Performance Decision Record](#13-output-format--the-performance-decision-record).

1. **Classify the change.** Identify which of the four dimensions the change can plausibly affect, and whether the affected path is hot or cold. If no dimension is plausibly affected and no budget is near its limit, record "no performance impact expected" and stop.
2. **Establish the baseline.** Measure current behavior on each affected dimension under realistic conditions, capturing median and tail. If a baseline cannot be established, that is itself a blocker — escalate to capture observability before proceeding.
3. **Implement and measure.** Measure the new behavior under the *same* conditions as the baseline. Record the delta per dimension, with the method used.
4. **Test for significance.** For each dimension, decide whether the delta exceeds measurement noise. Discard movements inside the noise band.
5. **Check the budgets.** Compare each post-change number against its [budget](#10-performance-budgets). Record which budgets are passed, which are consumed, and which are exceeded.
6. **Apply the trade-off model.** For any change that improves one dimension and harms another, or that spends complexity/cost for speed, resolve the disposition per [Section 6](#6-the-trade-off-model).
7. **Reconcile across dimensions.** Combine the per-dimension dispositions into a single recommendation. A regression on any dimension that exceeds budget makes the whole change a regression unless an explicit, recorded trade-off justifies it.
8. **Determine the approval requirement.** Apply the [approval triggers](#8-approval-triggers). If a trigger fires, route for approval before the change advances.
9. **Record the decision.** Produce the Performance Decision Record, including baseline, post-change numbers, disposition, rejected alternatives, and approver. Store it so future work can reference it (see [Memory](../architecture/DOMAIN_MODEL.md#memory)).

The procedure is identical regardless of who runs it — an engineer during implementation, the Reviewer during review, the QA Engineer during validation, or the company's automated driver at high autonomy. The same inputs always produce the same disposition.

---

## 8. Approval Triggers

Most performance decisions are made and recorded within the owning role's authority. An approval is required — routed through the [Approval System](../systems/APPROVAL_SYSTEM.md) and surfaced to the appropriate approver — only when one of the following triggers fires:

- **A budget is exceeded.** Any post-change number that crosses a defined [performance budget](#10-performance-budgets) requires approval to proceed.
- **A measured regression on a hot path.** A significant regression (beyond noise) on a path served on every request or every page load.
- **A tail regression.** A significant degradation at the tail (the slow percentiles) even when the median improves.
- **A correctness or safety trade-off.** Any proposal to buy speed by relaxing correctness, consistency, or security. This routes to the CTO and the Security Engineer and is rejected unless explicitly authorized — see the Security Decision Framework.
- **A material cost increase.** A change that meaningfully raises infrastructure cost per unit of work.
- **Loss of headroom.** A change that improves current numbers but removes the system's capacity to absorb growth or spikes.
- **Architecture-level optimization.** A performance change that alters architecture (introducing a cache layer, a queue, a denormalization, a new data store) is also an architecture decision and follows the Architecture Decision Framework in addition to this one.

Who approves depends on the trigger and the company's [autonomy level](../architecture/DOMAIN_MODEL.md#company-settings):

| Trigger | Approver |
|---|---|
| Budget exceeded on a single dimension | Owning role's lead (Tech Lead) |
| Hot-path or tail regression | Tech Lead, with CTO awareness |
| Cost increase or loss of headroom | Infrastructure Engineer recommends; CTO approves |
| Correctness/safety trade-off | CTO + Security Engineer; CEO informed |
| Architecture-level change | CTO |

At **manual** and **suggest** autonomy, every triggered decision is presented to the CEO as a recommendation in the standard communication format. At **assist**, sub-threshold decisions proceed and triggered ones pause for approval. At **delegate** and **autonomous**, the company applies the same triggers automatically and only pauses when a trigger requires human authority (correctness/safety, or budget overruns above the configured threshold). The triggers do not change with autonomy — only the identity of the approver does.

---

## 9. Roles and Participation

Performance is owned by no single role and contributed to by many. This section defines who does what. It refines, and does not replace, the responsibilities in each employee's handbook.

| Role | Responsibility in this framework |
|---|---|
| **[Frontend Engineer](../employees/FRONTEND_ENGINEER.md)** | Owns the frontend and perceived dimensions. Captures bundle weight, render and interaction timing, and layout stability. Designs for perceived speed (optimistic updates, progressive disclosure). Produces baselines on realistic device/network profiles. |
| **[Backend Engineer](../employees/BACKEND_ENGINEER.md)** | Owns the backend dimension. Measures request latency (median and tail), query behavior, and throughput under realistic concurrency. Prevents N+1 patterns and unbounded work on hot paths. |
| **[Infrastructure Engineer](../employees/INFRASTRUCTURE_ENGINEER.md)** | Owns the infrastructure dimension. Measures resource utilization, cost per unit of work, saturation headroom, and autoscaling behavior. Flags cost and capacity trade-offs the others cannot see. |
| **[QA Engineer](../employees/QA_ENGINEER.md)** | Validates that performance acceptance criteria are met before a change advances. Reproduces baselines and post-change numbers independently. A performance budget breach is a QA finding; an unmet performance acceptance criterion blocks the go recommendation. |
| **[Monitoring Engineer](../employees/MONITORING_ENGINEER.md)** | Owns the production truth. Provides the real-world baseline from live signals, watches for post-release regressions, and raises an [Incident](../architecture/DOMAIN_MODEL.md#incident) when a shipped change degrades production performance. Closes the loop between decision and reality. |
| **[CTO](../employees/TECH_LEAD.md)** | Owns this framework and arbitrates cross-dimension trade-offs that exceed a single role's authority. Approves architecture-level and correctness/safety performance trade-offs. Owns the performance budgets. |
| **[Reviewer](../employees/REVIEWER.md)** | Confirms during review that the Performance Decision Record exists for any change touching a hot path, and that its baseline/post-change evidence is present and credible. A missing or unmeasured performance claim is a blocking finding. |
| **Product Manager** | Sets the user-facing performance expectations (which paths are hot, what "fast enough" means for this product) that the perceived dimension and the budgets are anchored to. |
| **CEO** | Receives performance trade-offs that require business judgment (notably cost-versus-speed and correctness/safety) and approves or redirects. Never asked to evaluate raw numbers — only the trade-off the company has already framed. |

Collaboration follows the company norm: engineers measure and recommend, the Reviewer and QA verify, Monitoring confirms in production, and only genuine trade-offs reach the CTO or CEO. The CEO is protected from implementation detail and sees only the framed decision.

---

## 10. Performance Budgets

A performance budget is a pre-agreed limit on a metric for a given path. Budgets turn "is this fast enough?" from a per-engineer opinion into a company standard. They make the [decision procedure](#7-the-decision-procedure) objective: a change either fits the budget or it does not.

Budgets are defined per dimension and per path class. Hot paths (served on every request or every page load) carry tighter budgets than cold paths (rare or administrative). The CTO owns the budgets; the Product Manager anchors them to user expectations; the owning role proposes the specific numbers for its repository.

Representative budget categories (the specific numbers are set per repository, not in this framework):

| Dimension | Budgeted metric | Path sensitivity |
|---|---|---|
| Frontend | Transferred + parsed bytes for the initial load; main-thread work; interaction-to-response time | Hot: strict; cold: relaxed |
| Backend | Median and tail request latency; queries per request; work per request | Hot: strict; cold: relaxed |
| Infrastructure | Cost per request or per tenant; utilization headroom under peak | Always budgeted |
| Perceived | Time to first meaningful response; perceptible delay on common interactions | Hot paths only |

Rules for budgets:

- A budget is **consumed**, not just passed or failed. A change that stays under budget but eats most of the remaining headroom is recorded as consuming the budget, so the next change knows how little room is left.
- **Exceeding a budget is an approval trigger** ([Section 8](#8-approval-triggers)), not an automatic rejection — but the burden of justification is on the change.
- Budgets are versioned. When the company raises or lowers a budget, that is itself a [Decision](../architecture/DOMAIN_MODEL.md#decision) with a recorded rationale, owned by the CTO.
- A company running the **performance_first** [culture profile](../architecture/DOMAIN_MODEL.md#company-settings) sets tighter budgets and lowers the threshold at which approval triggers fire. The framework is the same; the dials differ.

---

## 11. Worked Examples

These examples show the procedure producing different dispositions from the same logic.

### 11.1 Clear win — image optimization

A page ships unoptimized images. Baseline: large transferred bytes on initial load, slow first meaningful render on a mid-tier device profile. The Frontend Engineer serves correctly sized, modern-format images. Post-change: transferred bytes fall well under budget, first meaningful render improves beyond noise, no other dimension moves. **Disposition: clear win.** No approval trigger fires. The win is recorded so the same optimization is reused elsewhere.

### 11.2 Justified trade-off — server-side rendering a hot page

A frequently visited page renders entirely on the client and *feels* slow because content appears late. The team moves rendering to the server. Baseline and post-change show: perceived performance improves substantially (content appears immediately); backend latency per request rises by a small, bounded amount; infrastructure cost per request rises modestly but stays within budget. The path is hot, so the backend regression is an approval trigger. The Tech Lead reviews: the perceived gain on a hot path outweighs a bounded backend cost within budget. **Disposition: justified trade-off.** Recorded with the rejected alternative (client-side caching, which would not have fixed first paint).

### 11.3 Rejected — caching that risks correctness

To cut backend latency, an engineer proposes caching a user-specific response without a correct invalidation path, accepting that users might occasionally see stale data. Baseline and post-change show a real latency win. But the change trades **correctness** for speed — a higher-priority criterion. **Disposition: rejected**, routed to the CTO and Security Engineer per the trigger, and recorded so it is not re-proposed without a correct invalidation design.

### 11.4 Deferred — micro-optimization on a cold path

An engineer notices an administrative export endpoint allocates more than necessary. The path is cold (run rarely, by few users), the gain is small, and the cost to implement is non-trivial. **Disposition: deferred.** Recorded as a future improvement rather than spending effort now — per the company belief that every action should reduce future work, not chase invisible wins.

---

## 12. Anti-patterns

The following are explicitly disallowed. Each is a known way performance decisions go wrong.

- **Optimizing without a baseline.** "It feels faster" is not a measurement. No baseline, no decision.
- **Optimizing the cold path.** Spending effort where no user feels it, while hot paths stay slow. Effort follows reach.
- **Median worship.** Reporting an improved median while the tail collapses. The slow experience is the one users remember.
- **Workstation benchmarking.** Measuring frontend cost on a fast developer machine and fast network, then shipping to users on slow devices and slow networks.
- **Single-request backend measurement.** Measuring server latency with one request and declaring it fast, when the regression only appears under concurrency.
- **Premature optimization.** Adding caches, pools, and complexity before any measurement shows a need — buying maintainability debt for a speed nobody requested.
- **Buying speed with correctness or security.** Always rejected; never a trade-off.
- **Hidden cost.** Improving latency by quietly multiplying infrastructure cost, with no one accountable for the bill.
- **Tool-locked claims.** Asserting a result that only one specific tool can produce and no one can reproduce. Method must be recorded and reproducible.
- **Unrecorded regressions.** Letting a small, "acceptable" regression ship without a record, so the next small regression stacks on it until the path is slow and no single change is to blame.

---

## 13. Output Format — The Performance Decision Record

Every performance decision produces a record. It is stored as a [Decision Record](../architecture/DOMAIN_MODEL.md#decision-record) (type `performance`) and, when it constrains future work, promoted into [Company Memory](../architecture/DOMAIN_MODEL.md#memory) so future engineers reference it instead of re-deriving it. The record follows the company's structured communication format and contains:

```
Performance Decision Record

Change:           <what changed, and the path(s) affected>
Path class:       <hot | cold> — <why>
Dimensions:       <which of frontend / backend / infrastructure / perceived>

Baseline:
  <dimension>:    median <x>, tail <y>, conditions <...>, method <...>
Post-change:
  <dimension>:    median <x>, tail <y>, conditions <...>, method <...>
Delta:            <per-dimension change; note any movements inside noise>

Budgets:          <passed | consumed | exceeded>, per dimension

Recommendation:   <proceed | proceed-with-trade-off | defer | reject>
Reasoning:        <why, against the decision criteria>
Risks:            <what could still go wrong; headroom consumed>
Alternatives:     <what else was considered and why it was rejected>
Confidence:       <low | medium | high>
Trade-off:        <benefit vs cost vs reach vs reversibility, if applicable>

Approval:         <required? which trigger fired? approver + decision>
Next action:      <merge | escalate | revise | monitor in production>
```

The record is mandatory for any change touching a hot path or crossing a budget, and recommended for any deliberate optimization. A clear win still produces a short record so the optimization can be reused. The [Reviewer](../employees/REVIEWER.md) confirms the record's presence and credibility during review; the [Monitoring Engineer](../employees/MONITORING_ENGINEER.md) confirms in production whether the predicted numbers held.

---

## 14. Relationship to Other Documents

This framework is one of the company's decision frameworks and is governed by the broader decision machinery:

- **[Decision System](../systems/DECISION_SYSTEM.md)** — defines how every decision (including performance decisions) is recorded, approved, communicated, and remembered. This framework is the performance-specific specialization of that system.
- **[Company Playbook](../company/COMPANY_PLAYBOOK.md)** — the company's decision-making priority order and engineering principles that this framework inherits.
- **[Domain Model](../architecture/DOMAIN_MODEL.md)** — defines the objects this framework reads and writes: Decision, Decision Record, Memory, Incident, Company Settings (autonomy, culture).
- **[Approval System](../systems/APPROVAL_SYSTEM.md)** — the path triggered performance decisions take to reach an approver.
- **Architecture Decision Framework** *(sibling, same directory)* — owns performance changes that alter architecture; this framework defers to it on architectural structure.
- **Risk Analysis Decision Framework** *(sibling, same directory)* — owns performance *risk* before it is realized; a realized risk becomes an Incident.
- **Security Decision Framework** *(sibling, same directory)* — governs any proposal to trade correctness or security for speed.
- **Employee handbooks** — [Frontend](../employees/FRONTEND_ENGINEER.md), [Backend](../employees/BACKEND_ENGINEER.md), [Infrastructure](../employees/INFRASTRUCTURE_ENGINEER.md), [QA](../employees/QA_ENGINEER.md), and [Monitoring](../employees/MONITORING_ENGINEER.md) Engineers define each role's day-to-day responsibilities that this framework coordinates.

Where this framework and an employee handbook disagree on how a performance decision is made, this framework wins. Where this framework and the Decision System disagree on how a decision is recorded or approved, the Decision System wins.
