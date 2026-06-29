# SOP: Speed and Performance Improvement

**SOP ID:** SOP-008  
**Category:** Standard Operating Procedure  
**Owner:** Tech Lead  
**Version:** 1.0  

---

## Purpose

This procedure defines how Engineering OS makes the product faster and more efficient without breaking it. A speed improvement is a deliberate change to reduce latency, increase throughput, shrink resource consumption, or lower operating cost — measured, reviewed, validated, and released with the same discipline as any other change.

Performance work is uniquely prone to two failure modes. The first is changing code in pursuit of speed without ever measuring whether it got faster — optimizing on intuition. The second is making something faster while quietly making something else wrong — trading correctness, readability, or a different metric for a number that looks better in isolation. This procedure exists to prevent both. Every speed improvement in Engineering OS begins with a measured baseline and ends with a measured comparison against that baseline, on the same workload, with the rollback path understood before the change ships.

A performance change that cannot show a before-and-after measurement is not a performance improvement. It is an unvalidated edit that happens to be motivated by a feeling about speed.

---

## Trigger

This procedure is triggered when:

- A monitoring signal indicates a latency, throughput, error-rate-under-load, or resource regression in production (routed from the Monitoring Engineer)
- A user, customer, or internal team reports that a flow is slow or unresponsive
- A planned performance objective is approved (e.g., reduce p95 latency on a core flow, reduce bundle size, reduce build or cold-start time, reduce cost-per-request)
- The CTO or Tech Lead identifies a performance risk during architecture or capacity review
- A repository intelligence or change-intelligence analysis surfaces a degradation between two snapshots

A speed improvement is **not** a bug fix. If the system is producing incorrect results, that is a defect — follow [SOP-002: Bug Fix](./BUG_FIX.md). If the system is producing correct results too slowly or too expensively, this is the procedure. When a slow path is also incorrect, the Tech Lead splits the work: correctness through SOP-002 first, performance through this SOP second.

---

## Owner

**Tech Lead** — owns the procedure from intake through the post-release monitoring window. The Tech Lead defines the target metric and the workload, confirms the baseline is valid before any change is made, confirms the post-change measurement before release, and ensures the improvement is recorded in memory. The Tech Lead has authority to reject a performance change that lacks a baseline or a post-change comparison.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Tech Lead** | Owns the procedure end to end; defines target metric and workload; confirms baseline and post-change measurement; assignment; escalation |
| **Frontend Engineer** | Diagnosis and implementation for client-side performance (Core Web Vitals, bundle size, render cost, hydration) |
| **Backend Engineer** | Diagnosis and implementation for server-side performance (query cost, N+1 access, caching, serialization, algorithmic cost) |
| **Infrastructure Engineer** | Diagnosis and implementation for platform performance (cold start, scaling, connection pooling, runtime/region selection, cost) |
| **Reviewer** | Code review of the change, including readability and correctness cost of the optimization |
| **QA Engineer** | Validates that behavior is unchanged by the optimization; runs the regression scope; confirms no correctness regression accompanies the speed gain |
| **Monitoring Engineer** | Confirms the baseline against production signals; configures and watches the post-release performance signals; confirms the gain holds in production |
| **Release Manager** | Release coordination; incorporates the performance evidence into release readiness |
| **CTO** | Approves changes that trade architecture, cost, or risk for speed; escalation receiver; override authority on contested trade-offs |
| **Product Manager** | Confirms the user-facing performance target and acceptable trade-offs when a flow's behavior or scope is affected |

---

## Measurement Requirements

Measurement is the spine of this procedure. The following requirements are non-negotiable and gate the workflow at Phase 2 and Phase 6.

### Every speed improvement defines, before any change:

1. **A target metric.** A single primary metric the change is intended to improve, stated with a number and a unit. "Make checkout faster" is not a target metric. "Reduce checkout submit p95 latency from its current baseline to under 400 ms" is a target metric.
2. **A workload.** The exact, repeatable conditions under which the metric is measured: the endpoint or flow, the input size and shape, the data state, the concurrency level, the environment, and the region. A measurement that cannot be reproduced on the same workload cannot be compared.
3. **A guardrail set.** The metrics that must **not** get worse as a side effect — correctness, error rate, a secondary latency percentile, memory, cost-per-request, or bundle size. A speed win that silently regresses a guardrail metric is not a win.

### Baseline measurement (required)

Before any code is changed, the assigned engineer records the **baseline**: the current value of the target metric and every guardrail metric, on the defined workload, captured at least three times to establish that the measurement is stable and not noise. The baseline is recorded in the improvement record with the date, environment, and workload. The Monitoring Engineer confirms the baseline against production signals for production-observed problems so the team is not optimizing a workload that does not reflect reality.

### Post-change measurement (required)

After the change is implemented, the same engineer records the **post-change measurement**: the value of the target metric and every guardrail metric, on the **same workload**, captured the same number of times. The post-change measurement is compared directly against the baseline. The comparison — baseline value, post-change value, delta, and percentage change for the target metric and each guardrail metric — is the central artifact of this SOP. No speed improvement reaches review readiness without it.

### Performance metric catalog

Target and guardrail metrics are drawn from, but not limited to:

| Layer | Representative metrics |
|---|---|
| **Backend / API** | p50 / p95 / p99 request latency; throughput (req/s); database query time and query count per request; serialization time; error rate under load |
| **Frontend** | Largest Contentful Paint (LCP); Interaction to Next Paint (INP); Cumulative Layout Shift (CLS); Time to First Byte (TTFB); JavaScript bundle size; hydration and render cost |
| **Infrastructure** | Cold-start time; memory footprint; CPU utilization; connection-pool saturation; autoscaling responsiveness; cost-per-request |
| **Build / tooling** | Build time; type-check time; test-suite wall-clock time |

The Tech Lead selects the primary target and the guardrails for each improvement from this catalog. A latency improvement that doubles memory is not automatically acceptable — the guardrail set is what makes that trade-off visible and decidable.

---

## Preconditions

Before this procedure begins:

- [ ] The performance problem or objective is recorded with a stated target metric and workload
- [ ] The Tech Lead is assigned and has confirmed the problem is a performance problem, not a correctness defect
- [ ] For production-observed problems, the Monitoring Engineer has supplied the relevant production signals

---

## Procedure

### Phase 1: Intake and Problem Definition

**Owner:** Tech Lead  
**Input:** Performance report, objective, or monitoring signal  
**Output:** Improvement record with target metric, workload, guardrail set, and assigned owner  

**Steps:**

1. **Tech Lead** creates the improvement record containing:
   - Title: a specific, one-line description of what is slow or inefficient and where
   - Source: how the problem was identified (monitoring, user report, planned objective, capacity review)
   - Target metric: the single primary metric, with current value (if known) and target value, including unit
   - Workload: endpoint/flow, input shape, data state, concurrency, environment, region
   - Guardrail set: the metrics that must not regress
   - User impact: who experiences the slowness and in what flow
   - Affected layer: frontend, backend, infrastructure, or a combination

2. **Tech Lead** assigns the improvement to the engineer who owns the affected layer. Cross-layer problems (e.g., a slow page caused by both a slow query and a large bundle) are decomposed into layer-specific tasks per the Task Decomposition Doctrine.

3. **Tech Lead** notifies the **Product Manager** when the target or an acceptable trade-off touches user-facing behavior or scope, and notifies the **CTO** when the likely fix involves an architectural or cost trade-off.

**Gate 1:** Improvement record exists with a target metric, a defined workload, and a guardrail set. Owner assigned.

---

### Phase 2: Baseline Measurement

**Owner:** Assigned engineer (with Monitoring Engineer support)  
**Input:** Improvement record with target metric and workload  
**Output:** Recorded, stable baseline for the target and guardrail metrics  

**Steps:**

1. **Assigned engineer** measures the target metric and every guardrail metric on the defined workload, **before changing any code**.

2. The engineer captures the measurement at least three times to confirm stability. If the measurements vary widely, the workload is not yet controlled — the engineer stabilizes the workload (fixed data, fixed concurrency, warm vs. cold state defined) before proceeding. A noisy baseline cannot support a credible comparison.

3. **Monitoring Engineer** confirms, for production-observed problems, that the baseline workload reflects real production conditions (representative input sizes, realistic concurrency, real data distribution). Optimizing a synthetic workload that does not match production is a common way to "improve" a metric users never experience.

4. The engineer records the baseline in the improvement record: each metric's value, the unit, the date, the environment, and the exact workload.

**Gate 2:** A stable baseline for the target metric and all guardrail metrics is recorded against a reproducible workload. **No code has changed yet.**

---

### Phase 3: Diagnosis and Hypothesis

**Owner:** Assigned engineer  
**Input:** Confirmed baseline  
**Output:** Identified bottleneck and a hypothesis for the change  

**Steps:**

1. **Assigned engineer** profiles or instruments the workload to locate the actual bottleneck — the specific query, render, allocation, network round-trip, or algorithm responsible for the cost. The bottleneck is identified from evidence, not assumed.

2. The engineer forms a hypothesis: a specific change expected to move the target metric, and the predicted effect on each guardrail metric. The hypothesis names the mechanism (e.g., "the endpoint issues one query per row; batching into a single query removes N round-trips").

3. The engineer assesses the trade-offs the change introduces — added complexity, cache invalidation risk, increased memory, new infrastructure cost, reduced readability. Trade-offs that affect architecture or cost are raised to the **CTO** before implementation; trade-offs that affect user-facing behavior are raised to the **Product Manager**.

**Gate 3:** The bottleneck is identified from evidence. A hypothesis with a named mechanism and predicted guardrail impact is recorded. Architectural or cost trade-offs are surfaced.

---

### Phase 4: Implementation

**Owner:** Assigned engineer  
**Input:** Confirmed bottleneck and hypothesis  
**Output:** Implemented change scoped to the bottleneck  

**Steps:**

1. **Assigned engineer** implements the change, scoped tightly to the identified bottleneck. A performance change should not bundle unrelated refactors — a scoped change makes the measurement attributable and the rollback clean.

2. The change preserves observable behavior. An optimization that changes results, ordering, or error handling has changed the contract and must be treated as a behavior change, validated as such, and called out to the Reviewer and QA Engineer.

3. **Frontend Engineer** (when applicable): preserves the accessibility and rendering contract; confirms no layout shift or interaction regression is introduced by the optimization.

4. **Backend Engineer** (when applicable): if the change introduces or relies on caching, defines the invalidation rule; if it changes a query or migration, ensures the migration has a tested rollback path before it runs in production.

5. **Infrastructure Engineer** (when applicable): if the change alters runtime, region, scaling, or pooling configuration, documents the prior configuration so it can be restored, and confirms the change is reversible.

6. **Tech Lead** performs Delivery Readiness review before the change moves to review. Code does not move to review until the engineer has captured a provisional post-change measurement showing the target metric moved as hypothesized.

**Gate 4:** Change is implemented, scoped to the bottleneck, behavior-preserving (or behavior change explicitly flagged), and a provisional post-change measurement exists. Delivery Readiness confirmed.

---

### Phase 5: Review

**Owner:** Reviewer  
**Input:** Change submitted for review; improvement record with baseline and provisional measurement  
**Output:** Reviewed and approved change  

**Steps:**

1. **Reviewer** reviews the change using the standards in [SOP-003: Code Review](./CODE_REVIEW.md), with these performance-specific checks:
   - Does the change include a baseline and a post-change measurement on the same workload?
   - Is the gain attributable to this change, or could it be measurement noise or an unrelated factor?
   - What did the optimization cost in readability, complexity, or maintainability — and is that cost justified by the measured gain?
   - If the change adds caching, is the invalidation rule correct and complete?
   - Does the change preserve behavior, or does it alter results, ordering, or error handling?

2. **Reviewer** classifies findings as Blocking, Non-blocking, or Question. A missing baseline-to-post-change comparison is a Blocking finding — the change cannot be approved without it.

3. **CTO** reviews changes that trade architecture, cost, or operational risk for speed, when flagged by the Tech Lead or Reviewer.

4. **Engineer** resolves all Blocking findings. **Reviewer** re-reviews and approves. **Tech Lead** merges.

**Gate 5:** Change reviewed and approved. Baseline-to-post-change comparison is present. All Blocking findings resolved. Merged.

---

### Phase 6: Post-Change Measurement and Validation

**Owner:** QA Engineer (behavior); assigned engineer + Monitoring Engineer (measurement)  
**Input:** Merged change deployed to staging; baseline from Phase 2  
**Output:** Confirmed measured improvement with no guardrail or behavior regression  

**Steps:**

1. **DevOps Engineer** deploys the change to staging.

2. **Assigned engineer** records the formal post-change measurement on the **same workload** used for the baseline, captured the same number of times. The engineer produces the comparison: baseline value, post-change value, delta, and percentage change for the target metric and **every** guardrail metric.

3. The improvement is confirmed only when:
   - The target metric improved by a meaningful, reproducible margin (not within measurement noise), and
   - No guardrail metric regressed beyond its accepted threshold.

   If the target metric did not move, or a guardrail metric regressed, the change returns to Phase 3 with the new evidence, or is abandoned and reverted. A change that does not move the target metric is not merged into a release as a "performance improvement."

4. **QA Engineer** validates that behavior is unchanged, following [SOP-004: QA Validation](./QA_VALIDATION.md). The QA scope includes:
   - The flow affected by the optimization behaves identically to before (same outputs, ordering, and error handling)
   - The regression scope: shared code paths, dependent APIs, and core flows that the optimized component touches
   - For cached changes: stale-data and invalidation scenarios
   - A behavior regression discovered here is classified Blocking — a speed gain never ships with a correctness regression

5. **Monitoring Engineer** confirms the staging measurement is consistent with what is expected to hold in production and identifies the production signals that will verify the gain after release.

**Gate 6:** Post-change measurement on the same workload shows a meaningful, reproducible improvement in the target metric. No guardrail metric regressed beyond threshold. QA confirms behavior is unchanged. Regression scope passed.

---

### Phase 7: Release

**Owner:** Release Manager  
**Input:** Validated improvement with measured comparison; QA confirmation  
**Output:** Change deployed to production; production performance confirmed  

**Steps:**

1. The change follows [SOP-005: Release](./RELEASE.md). The performance evidence — baseline, post-change measurement, comparison, and guardrail results — is attached to the release record as part of release readiness.

2. **Release Manager** confirms the **rollback plan** specific to this change is documented and ready (see Rollback Considerations). Performance changes are released with a rollback path because a gain in staging can become a regression under production load.

3. **DevOps Engineer** deploys to production.

4. **Monitoring Engineer** watches the production performance signals identified in Phase 6 for the post-release window, confirming the gain holds under real load and that no guardrail metric (error rate, secondary latency, cost) regressed in production.

5. **Release Manager** declares the release stable when production signals confirm the improvement and no regression, or authorizes rollback if signals require it.

**Gate 7:** Change is in production. Production signals confirm the target metric improved and no guardrail regressed. Release record includes the performance evidence and rollback plan.

---

### Phase 8: Monitoring and Learning

**Owner:** Tech Lead (with Monitoring Engineer)  
**Input:** Released change; production confirmation  
**Output:** Closed improvement record; learning and guardrail captured  

**Steps:**

1. **Monitoring Engineer** confirms (or adds) a standing alert on the target metric so a future regression of the same flow is detected automatically rather than re-reported by a user.

2. **Tech Lead** closes the improvement record with: the baseline, the post-change measurement, the production-confirmed result, the trade-offs accepted, and the mechanism of the improvement.

3. **Tech Lead** assesses whether the bottleneck represents a class of inefficiency that exists elsewhere (e.g., the same N+1 pattern in other endpoints). If so, a follow-up task is created to audit similar paths.

4. The optimization pattern and its measured effect are recorded in memory so the company does not re-derive it and does not accidentally revert it in a later refactor.

**Gate 8:** Improvement record closed with measured before-and-after and production confirmation. Standing alert in place. Systemic follow-ups created.

---

## Validation

Validation of a speed improvement has two independent halves, and both must pass:

1. **Measurement validation** — the target metric improved by a meaningful, reproducible margin on the same workload, and no guardrail metric regressed beyond its accepted threshold. This is owned by the assigned engineer and confirmed by the Monitoring Engineer.
2. **Behavior validation** — the optimization did not change what the system does. Owned by the QA Engineer per [SOP-004: QA Validation](./QA_VALIDATION.md). A regression introduced by an optimization is always Blocking and is never deferred.

A change that improves the metric but changes behavior fails validation. A change that preserves behavior but does not move the metric fails validation. Only a change that does both passes. The two halves are not interchangeable and neither substitutes for the other.

---

## Rollback Considerations

Every speed improvement is released with a rollback path, because performance behaves differently under production load than in staging, and an optimization can interact badly with real data, real concurrency, or real cache state.

| Change type | Primary rollback consideration |
|---|---|
| **Code optimization** | The change is scoped tightly so the commit or PR can be reverted cleanly without unwinding unrelated work |
| **Caching introduced** | Rollback must address cache state — a revert that leaves a poisoned or stale cache is not a clean rollback; the invalidation/flush step is part of the plan |
| **Query or schema change** | Any migration has a tested rollback path before it runs in production (consistent with [SOP-002: Bug Fix](./BUG_FIX.md)) |
| **Infrastructure/config change** | The prior configuration (runtime, region, pool size, scaling rule) is recorded so it can be restored exactly |
| **Algorithmic change** | If the new algorithm changes results under edge inputs, the rollback restores the prior, behavior-validated path |

When a production signal shows the change regressed latency, error rate, cost, or correctness under load, the Release Manager initiates rollback per [SOP-006: Rollback](./ROLLBACK.md). A performance change that cannot be rolled back cleanly should not be released until it can be.

---

## Decision Gates Summary

| Gate | Condition | Owner |
|---|---|---|
| Gate 1 | Improvement record with target metric, workload, and guardrails; owner assigned | Tech Lead |
| Gate 2 | Stable baseline recorded on a reproducible workload; no code changed yet | Assigned engineer |
| Gate 3 | Bottleneck identified from evidence; hypothesis with named mechanism; trade-offs surfaced | Assigned engineer |
| Gate 4 | Change implemented and scoped; behavior preserved or flagged; provisional measurement; Delivery Readiness | Tech Lead |
| Gate 5 | Reviewed and approved; baseline-to-post-change comparison present; merged | Reviewer |
| Gate 6 | Measured improvement on same workload; no guardrail regression; behavior unchanged | QA Engineer + engineer |
| Gate 7 | Production signals confirm gain and no regression; rollback plan on file | Release Manager |
| Gate 8 | Improvement record closed with before/after; standing alert; systemic follow-ups | Tech Lead |

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| The optimization requires an architectural or cost trade-off | CTO | Before implementation, at Phase 3 |
| The target metric does not move after two implementation attempts | CTO, Tech Lead | After the second failed attempt |
| A guardrail metric regresses and the trade-off is contested | CTO | When the trade-off cannot be resolved by the Tech Lead |
| The optimization changes user-facing behavior or scope | Product Manager, then CTO | As soon as the behavior change is identified |
| A baseline cannot be made stable (workload is irreducibly noisy) | Tech Lead, Monitoring Engineer | When repeated measurement fails to stabilize |
| Production signals show the released change regressed under load | Release Manager, CTO | Immediately; assess rollback per SOP-006 |
| The performance problem is actually a correctness defect | Tech Lead | Immediately — re-route to SOP-002 |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Improvement record (target metric, workload, guardrails) | Tech Lead | Phase 1 |
| Baseline measurement | Assigned engineer | Phase 2 |
| Bottleneck diagnosis and hypothesis | Assigned engineer | Phase 3 |
| Change (scoped code/config change) | Assigned engineer | Phase 4 |
| Code review record | Reviewer | Phase 5 |
| Post-change measurement and comparison | Assigned engineer | Phase 6 |
| Behavior validation record | QA Engineer | Phase 6 |
| Rollback plan | Release Manager / assigned engineer | Phase 7 |
| Release record with performance evidence | Release Manager | Phase 7 |
| Closed improvement record with production-confirmed result | Tech Lead | Phase 8 |

---

## Documentation

Speed improvements are documented at three levels:

- **Improvement record** — the authoritative before-and-after: target metric, workload, baseline, post-change measurement, guardrail results, trade-offs accepted, and production confirmation. Owned by the Tech Lead.
- **Changelog / release notes** — when the improvement is user-perceptible (a flow is noticeably faster), the Technical Writer includes a user-facing note per the Changelog Standard in [SOP-005: Release](./RELEASE.md). The note describes the experience ("checkout is now faster"), not the implementation.
- **Decision and pattern record** — when the optimization establishes a reusable pattern or accepts a non-obvious trade-off, the Tech Lead records the decision so the pattern is reused and not unknowingly reverted in a future refactor.

Documentation that omits the workload is incomplete: a measured gain without the workload it was measured on cannot be reproduced or trusted later.

---

## Definition of Done

A speed improvement is done when all of the following are true:

- [ ] An improvement record exists with a target metric (value and unit), a defined workload, and a guardrail set
- [ ] A stable baseline for the target metric and all guardrail metrics was recorded **before** any code changed
- [ ] The bottleneck was identified from evidence and a hypothesis with a named mechanism was recorded
- [ ] The change is scoped to the bottleneck and preserves behavior (or the behavior change was explicitly flagged and validated)
- [ ] The change was reviewed and approved, with the baseline-to-post-change comparison present
- [ ] A post-change measurement on the **same workload** shows a meaningful, reproducible improvement in the target metric
- [ ] No guardrail metric regressed beyond its accepted threshold
- [ ] QA confirmed behavior is unchanged and the regression scope passed
- [ ] The change is in production and production signals confirm the gain holds with no guardrail regression
- [ ] A rollback plan specific to the change was on file before release
- [ ] A standing alert on the target metric is in place
- [ ] The improvement record is closed with the production-confirmed before-and-after; systemic follow-ups created

---

## Memory Updates

After each speed improvement:

| Record | Content | Owner |
|---|---|---|
| Improvement record | Target metric, workload, baseline, post-change measurement, production result, trade-offs | Tech Lead |
| Performance baselines library | The new confirmed baseline for the affected flow, so future regressions are measured against it | Monitoring Engineer |
| Monitoring signals | Standing alert on the target metric; tuning notes | Monitoring Engineer |
| Optimization pattern library | The mechanism used and its measured effect, for reuse and to prevent accidental reversion | Tech Lead |
| Decision records | Any accepted trade-off (e.g., latency for memory, speed for complexity) and its rationale | Tech Lead |
| Process improvement items | Any systemic inefficiency class identified for follow-up audit | Tech Lead |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Baseline-before-change rate | 100% — no performance change ships without a baseline recorded before code changed | Improvement records |
| Post-change measurement rate | 100% — every change has a same-workload before/after comparison | Improvement records |
| Guardrail regression rate | 0% — no speed change ships with an unaccepted guardrail regression | Release / monitoring records |
| Behavior regression from optimization | 0% — no correctness regression introduced by a performance change reaches production | Incident records |
| Production-confirmed gain rate | Tracked, improving — share of improvements whose gain held in production | Monitoring records |
| Standing alert coverage | 100% — every optimized flow has an alert guarding against re-regression | Monitoring records |

---

## Failure Modes

### Optimizing without a baseline
An engineer is confident the new approach is faster, implements it, and ships it. No baseline was ever recorded. There is no way to prove the change helped — or to notice that it actually hurt under a workload the engineer did not consider. Caught when: someone later asks "how much faster did this make it?" and there is no answer.

**Response:** The baseline is recorded before any code changes — Gate 2 is the explicit checkpoint, and it occurs before Phase 4. A change submitted for review without a baseline-to-post-change comparison is returned by the Reviewer as a Blocking finding. "It feels faster" is not a measurement.

### Measuring on a workload that does not match production
The engineer measures against a tiny synthetic dataset and sees a large improvement. In production, with realistic data volume and concurrency, the change makes no difference — or makes things worse because it traded a cost that only appears at scale. Caught when: the staging gain does not reproduce in production monitoring.

**Response:** The Monitoring Engineer confirms the baseline workload reflects real production conditions for production-observed problems (Phase 2). The gain is confirmed against production signals after release (Phase 7). A workload that does not match production is not a valid measurement environment.

### Speed gain that quietly breaks behavior
An optimization changes result ordering, drops an edge case, or returns stale cached data. The latency number improves and the change ships. Users get faster wrong answers. Caught when: a correctness defect surfaces in a flow that was recently "optimized."

**Response:** Behavior validation (Phase 6, via SOP-004) is mandatory and independent of the measurement. A regression introduced by an optimization is Blocking and never deferred. A speed change preserves behavior or it is treated as a behavior change and validated as one.

### Improving the target while regressing a guardrail
Latency drops, but memory doubles, cost-per-request rises, or a secondary percentile (p99) gets worse. Because only the target metric was watched, the regression ships invisibly. Caught when: a cost or capacity alert fires weeks later and is traced back to the "improvement."

**Response:** The guardrail set is defined at Gate 1 and measured at every measurement step. A change that regresses a guardrail beyond its accepted threshold does not pass Gate 6. Accepting a guardrail trade-off is an explicit, documented CTO decision — not an unnoticed side effect.

### Premature optimization with no measured problem
An engineer rewrites a clear, correct piece of code into a complex, "fast" version with no evidence it was ever a bottleneck. The codebase gets harder to maintain and no user-perceptible metric improved. Caught when: review asks "what baseline showed this was slow?" and there is none.

**Response:** This procedure begins with a target metric and a measured baseline. Without a measured problem, there is no improvement to make. The Reviewer evaluates the readability and complexity cost of every optimization against its measured gain — an optimization that costs maintainability for no measured benefit is rejected.

---

## Anti-Patterns

**"It's obviously faster, we don't need to measure it."** Intuition about performance is unreliable; modern runtimes, caches, and query planners routinely defeat it. The before-and-after measurement is the deliverable, not a formality. If it cannot be measured, the improvement cannot be claimed.

**Bundling unrelated changes into a "performance" PR.** When an optimization PR also contains a refactor and a feature tweak, the measured gain is no longer attributable and the rollback is no longer clean. Performance changes are scoped to the bottleneck so the measurement means something and the revert is surgical.

**Treating the guardrails as optional.** The entire value of a guardrail set is that it makes trade-offs visible. Watching only the target metric is how a latency win becomes a cost or memory incident nobody connected back to the change. Every guardrail is measured at baseline and post-change.

**Optimizing the metric instead of the experience.** A change that improves a number users never feel — a percentile no real request hits, a synthetic benchmark, a flow nobody is on — spends engineering effort for no user benefit. The target metric is chosen because it reflects a real user or cost experience, confirmed with the Product Manager or Monitoring Engineer when in doubt.

**Shipping a performance change with no rollback path.** Performance behaves differently under production load, and a staging gain can become a production regression. A change that cannot be cleanly reverted — including its cache or configuration state — is not ready to release. The rollback plan is part of release readiness, not an afterthought.
