# Monitoring Engineer — Operational Handbook

**Role:** Monitoring Engineer  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Observability and Signal — owns the application-level monitoring layer, alert quality, and the conversion of production signals into actionable findings; holds authority to create follow-up work when production health declines; does not own infrastructure provisioning, incident remediation, or product scope  
**Version:** 1.0  

---

## Purpose

A software system that cannot be observed cannot be trusted. The Monitoring Engineer exists so that the company always knows the state of its production systems — not from guesses, not from user reports, but from instrumented, verified signals that are defined before a feature ships and watched continuously after.

Monitoring is not a passive activity. When a signal degrades, the Monitoring Engineer acts: classifying the finding, escalating when the threshold is crossed, and creating the work item that ensures the finding becomes a fix. Production health is not an abstract concern — it is a measurable state, and the Monitoring Engineer is the person who measures it and drives it to resolution.

---

## Mission

Maintain complete operational visibility into production systems. Every anomaly is detected, classified, and handed off to the right owner. Every significant finding becomes documented company knowledge. The system never silently degrades.

---

## Scope

The Monitoring Engineer owns:

- Defining and maintaining the application-level monitoring layer: which signals are instrumented, what thresholds trigger alerts, and what baseline behavior looks like
- Alert quality: alerts fire when they should, do not fire when they should not, and are actionable when they do fire
- Uptime tracking: service availability is measured continuously and reported on the defined cadence
- Latency tracking: response time distributions (p50, p95, p99) are tracked per service and per endpoint category
- Error rate tracking: error rates are tracked with enough context to distinguish categories of error
- Production health reporting: regular summaries of production health are produced and distributed to the relevant roles
- Post-deployment monitoring: active observation during and after each deployment, with signals correlated against the deployment event
- Incident detection and handoff: when a production incident threshold is crossed, the Monitoring Engineer detects it, classifies it, notifies the right parties, and creates the follow-up work item
- Operational findings → company knowledge: significant production findings are documented; patterns are surfaced as systemic issues

The Monitoring Engineer does **not** own:

- Infrastructure provisioning or infrastructure-level observability (Infrastructure Engineer owns the platform; the Monitoring Engineer instruments the application layer on top of it)
- Remediating production incidents (Infrastructure Engineer for infrastructure; DevOps Engineer for deployment-related issues; engineers for application code)
- Resolving application defects discovered through monitoring (Tech Lead routes to the appropriate engineer)
- Security signal analysis (Security Engineer; the Monitoring Engineer surfaces anomalous patterns but does not own security assessment)
- Release decisions (Release Manager; the Monitoring Engineer provides post-deployment signals)

---

## Authority

| Decision | Monitoring Engineer Authority |
|---|---|
| Declaring a production incident (escalating a degraded signal to an active incident) | Full |
| Creating a work item from a monitoring finding | Full |
| Requiring an alert threshold to be adjusted before a feature is deployed | Full |
| Requesting that an application emit additional instrumentation | Full |
| Recommending rollback to the Release Manager based on post-deployment signals | Full recommendation authority; rollback authorization belongs to the Release Manager |
| Marking a previously open incident as resolved | Full, when signals have returned to baseline |

The Monitoring Engineer escalates to the CTO for:

| Situation | Escalation Trigger |
|---|---|
| A P0 or P1 incident is active and the responsible owner has not acknowledged within the response time window | Immediately |
| Production signals indicate a systemic pattern of degradation that cannot be attributed to a single cause | When the pattern is identified |
| A monitoring gap is discovered that left the company unable to detect a class of failure | When identified |
| A security-relevant anomaly is detected in production signals | Immediately, in parallel with the Security Engineer |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. Escalates active P0/P1 incidents with unacknowledged ownership, systemic degradation patterns, and monitoring coverage gaps. Receives guidance on what production health standards the company is held to. |
| **Infrastructure Engineer** | Coordinates with on the observability platform. Infrastructure Engineer owns and provisions the monitoring infrastructure; Monitoring Engineer defines what signals the application layer must emit and how alerting is configured on top of that infrastructure. |
| **DevOps Engineer** | Coordinates with on deployment observability. Confirms that deployment events are marked in the monitoring system. Provides post-deployment signal health during and after each deployment. Communicates rollback recommendations when signals degrade post-deployment. |
| **Release Manager** | Provides post-deployment monitoring status. Reports signal health at defined checkpoints during the deployment window. Escalates when signals indicate rollback should be considered. |
| **Security Engineer** | Routes security-relevant signal anomalies to. The Monitoring Engineer identifies the pattern; the Security Engineer performs the assessment. |
| **Tech Lead** | Routes monitoring findings that require engineering action to. Creates work items from significant findings and assigns them through the Tech Lead. Communicates systemic patterns that may indicate architectural issues. |
| **QA Engineer** | Provides production signal context for defects found in QA that have a monitoring-observable equivalent. Confirms that defects discovered through monitoring have corresponding QA coverage added. |
| **Backend Engineer** | Requests instrumentation additions from when monitoring coverage is insufficient. Provides guidance on what to instrument and how. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Production signals (metrics, logs, traces) | Instrumented application and infrastructure | Continuous |
| Deployment event notifications | DevOps Engineer | Per deployment |
| New feature scope (for monitoring requirements) | Tech Lead | Per feature/sprint |
| Alert threshold change requests | Engineers, Tech Lead | As needed |
| Security signal referrals | Security Engineer | As needed |
| Infrastructure change notifications | Infrastructure Engineer | Per infrastructure change |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Active incident declaration | CTO, Tech Lead, DevOps, Release Manager | When incident threshold is crossed |
| Post-deployment signal status | Release Manager, DevOps Engineer | At 5-minute and 30-minute marks after deployment |
| Production health report | CTO, Tech Lead | Weekly; after significant incidents |
| Work items from monitoring findings | Tech Lead | When a finding requires engineering action |
| Incident record | CTO, Tech Lead | After each incident closes |
| Monitoring coverage gap report | CTO, Tech Lead | When a gap is identified |
| Rollback recommendation | Release Manager | When post-deployment signals exceed rollback threshold |
| Alert quality report | CTO, Tech Lead | On request; after a period with significant false positives or misses |

---

## Signal Standards

### Required signals

Every production service must have the following signals defined and active before it is considered production-ready:

**Availability**
- Uptime: is the service responding to health checks?
- Dependency availability: are the services this service depends on reachable?

**Latency**
- p50, p95, p99 response time per service endpoint category
- Alert threshold: p99 exceeds the defined ceiling for the service

**Error rate**
- Total error rate (all 5xx responses as a percentage of total requests)
- Error rate by category (authentication errors, validation errors, system errors) where volume warrants
- Alert threshold: error rate exceeds the defined baseline by a factor agreed at launch

**Resource utilization** (in coordination with the Infrastructure Engineer)
- Memory and CPU utilization trends
- Alert threshold: sustained high utilization that indicates a resource leak or capacity constraint

**Business-critical paths** (defined per feature, in coordination with the Tech Lead)
- For each user-facing flow identified as business-critical: a signal that confirms the flow is completing successfully
- Alert threshold: completion rate drops below the defined floor

### Signal definition process

Monitoring requirements for a feature are defined before the feature ships, not after. The Monitoring Engineer reviews the feature scope at the start of development and specifies:

1. What signals the feature must emit
2. What the expected baseline looks like
3. What thresholds trigger an alert
4. What a Monitoring Engineer looking at the alert should check first

These requirements are communicated to the relevant engineer (typically Backend or Frontend Engineer) at the start of the sprint, not at PR review.

---

## Alert Quality Standard

An alert that fires correctly is only half of what makes alerting valuable. An alert that fires when there is no issue, or fails to fire when there is, erodes the team's ability to respond effectively.

### Properties of a good alert

**Specific:** The alert fires for a single, identifiable condition — not a broad "something is wrong." An alert that can be caused by 15 different things is too broad to act on.

**Actionable:** When the alert fires, the on-call engineer knows what to check first. Alerts without documented runbooks are not complete.

**Accurate:** The alert fires when the condition is real. False positives are tracked and eliminated. A false positive rate above 10% for any alert is a signal quality problem that must be addressed.

**Timely:** The alert fires in time for a meaningful response. An alert that fires 30 minutes after a user-impacting condition has been active is not operationally useful.

**Non-duplicative:** A single condition does not fire multiple alerts. Alert storms — where one failure cascades into 20 notifications — mask the root cause and slow response.

### Alert maintenance

Alerts are living configurations. They become stale when the system changes, when thresholds drift from reality, or when the team starts ignoring them. The Monitoring Engineer reviews all active alerts after:

- Any significant architectural change
- Any production incident where the alert fired late, failed to fire, or fired for the wrong reason
- Any period where the false positive rate is elevated

An alert that is consistently ignored is either inaccurate or undocumented. Both conditions must be corrected.

---

## Incident Classification

When a production signal crosses a threshold, the Monitoring Engineer classifies the finding before escalating.

| Severity | Definition | Response Time | Examples |
|---|---|---|---|
| **P0 — Critical** | Complete or near-complete service outage; core user flows are not functional; significant user data exposure | Immediate — begin response within 5 minutes | Service returning 5xx for >50% of requests, authentication completely unavailable, data loss detected |
| **P1 — High** | Significant degradation of a core user flow; not a complete outage but materially impacting users | Within 15 minutes | p99 latency exceeding 5x baseline for sustained period, error rate >10% on a core path, a key feature is non-functional for a subset of users |
| **P2 — Medium** | Partial degradation; users are affected but core flows are functional; workarounds exist | Within 2 hours | p99 latency exceeding 2x baseline but below 5x, elevated error rate in a non-critical path, a non-core feature is unavailable |
| **P3 — Low** | Minor degradation; users are not directly impacted or impact is minimal | Within 24 hours | Metric trending toward a threshold, log noise increase without functional impact, a monitoring signal is missing |

### Incident declaration

When the Monitoring Engineer classifies a finding as P0 or P1, the incident is declared immediately. "Watching to see if it resolves" is not a valid response to P0 or P1 — active incidents are declared, owners are notified, and response begins.

Incident declaration communicates:
- Severity level (P0/P1/P2/P3)
- What signal crossed what threshold
- What the current observed state is
- Who has been notified and who is the incident owner

---

## Monitoring Findings → Company Knowledge

A monitoring finding that is resolved without documentation is an opportunity lost. The Monitoring Engineer owns the conversion of significant findings into company knowledge.

### When a finding creates a work item

A finding creates a work item when:

- A P0 or P1 incident has occurred (always)
- A P2 finding has occurred more than once within 30 days (indicates a pattern)
- A monitoring signal was absent during an incident that it should have detected (coverage gap)
- An alert fired that was not actionable (alert quality issue)
- A trend is developing that will cross a threshold within a foreseeable window

Work items from monitoring findings are created by the Monitoring Engineer and routed to the Tech Lead for prioritization and assignment. The work item includes:

- What signal was observed and when
- The impact: what users or flows were affected
- The severity classification
- The suspected root cause (if determinable from signal data)
- What monitoring change, code change, or operational change is required

### Incident record

Every P0 and P1 incident has a written record closed after the incident resolves. The Monitoring Engineer is responsible for creating the record; the Tech Lead and relevant engineers contribute root cause and remediation details.

**Incident record contents:**
- Incident identifier and severity
- Timeline: when the signal degraded, when it was detected, when it was declared, when the owner acknowledged, when it was resolved
- Signal data: what was observed, at what level
- Impact: which users or flows were affected, for how long
- Root cause: what caused the degradation (as understood after investigation)
- Remediation: what was done to resolve it
- Follow-up work: work items created to prevent recurrence
- Detection assessment: did monitoring catch this as fast as it should have? If not, what gap existed?

---

## Daily Workflow

### Continuous

- Active monitoring dashboard is reviewed at the start of each working day
- Any open P2 or P3 findings from the prior period are reviewed for status
- Alert configurations are reviewed when a change is deployed to any monitored service

### Per deployment

**Before deployment:**
- Confirm baseline signals are captured (pre-deployment snapshot)
- Confirm deployment event will be marked in the monitoring system
- Confirm alerting is active during the deployment window

**During and after deployment:**
- Watch deployment-correlated signals during the execution
- Report signal status to the Release Manager at the 5-minute mark
- Report signal status at the close of the 30-minute monitoring window
- If signals degrade past the agreed rollback threshold: communicate rollback recommendation to the Release Manager immediately

### Per sprint

- Review the incoming sprint scope for features that require new monitoring requirements
- Communicate monitoring requirements to the relevant engineers at sprint start
- Confirm that monitoring for features delivered in the previous sprint has been validated in production

### Weekly

- Produce the weekly production health report: uptime, p99 latency trend, error rate trend, incidents in the period, open follow-up work
- Review all active alerts for accuracy and coverage after significant changes in the week

---

## Decision Framework

### When to declare an incident vs. continue watching

**Declare an incident when:**
- The threshold defined for that signal type has been crossed
- A P0 or P1 signal is observed regardless of whether a threshold was pre-defined
- A pattern has emerged that indicates a threshold will be crossed imminently

**Continue watching when:**
- The signal is elevated but below threshold, has not been sustained for more than 2 minutes, and is showing signs of natural recovery
- A deployment just completed and the signal change is within the expected post-deployment variance window (first 60 seconds)

The Monitoring Engineer does not let ambiguity prevent incident declaration. Declaring a P1 that resolves in 5 minutes is not an error — it is correct behavior. Failing to declare a P1 that persists for 30 minutes is a monitoring failure.

### When to recommend rollback

Recommend rollback to the Release Manager when:
- Error rate has crossed the rollback threshold defined for the release
- p99 latency has crossed the rollback threshold defined for the release
- A core user flow completion rate has dropped below its floor
- A dependency error rate indicates that a deployment-introduced change is causing cascade failures

The rollback recommendation is a specific, written communication: what signal is at what level, compared to what threshold. It is not a general "things look bad."

### When to create a work item vs. resolve without follow-up

Create a work item when any of the following is true:
- The finding was P0 or P1
- A P2 finding has recurred
- The finding revealed a monitoring gap
- The alert that fired was not actionable or was a false positive

Resolve without a work item only when: the signal degraded for a known, transient reason (a test, a scheduled task, a known third-party event), the baseline has recovered, and no investigation suggests a recurrence risk.

---

## Communication Rules

1. **Incident declarations are communicated immediately and specifically.** "The payment endpoint error rate is at 14%, threshold is 5%, declared P1 at [time]" — not "something seems off with payments." Severity, signal, threshold, and declaration time are always included.

2. **Post-deployment reports are sent at the agreed checkpoints.** The 5-minute and 30-minute reports go to the Release Manager and DevOps Engineer whether things are good or bad. A missing report is a communication failure.

3. **Rollback recommendations are written and specific.** "p99 latency is at 4.8 seconds on the API gateway, pre-deployment baseline was 320ms, agreed rollback threshold is 2 seconds. Recommending rollback." Not: "latency is bad, you should roll back."

4. **Work items from monitoring findings are created before the end of the day.** A finding that happened today and does not have a work item by end of day is a finding that may be forgotten. The Monitoring Engineer does not rely on verbal agreements to follow up.

5. **The weekly health report is sent on schedule, not when convenient.** Production health reporting is a commitment. When an engineer asks "how did last week look?" the answer is already written.

6. **Monitoring gaps are disclosed when discovered.** If production has been running without a monitoring signal that it should have, that gap is reported to the CTO and Tech Lead — not quietly fixed without acknowledgment.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| P0 incident active | CTO, Tech Lead | Immediately upon declaration |
| P1 incident with no owner acknowledgment within 15 minutes | CTO | 15 minutes post-declaration |
| P0/P1 incident with no resolution path after 1 hour | CTO | 1 hour post-declaration |
| Security-relevant anomaly detected in signals | Security Engineer, CTO | Immediately |
| Systemic degradation pattern with no single root cause | CTO, Tech Lead | When pattern is identified |
| A monitoring gap is discovered | CTO | When identified |
| A rollback recommendation is not acted on by the Release Manager | CTO | Within 5 minutes of recommendation |

---

## Definition of Done

### Definition of Done — Monitoring Coverage for a Feature

Monitoring coverage for a feature is complete when:

- [ ] All required signals for the feature are defined and documented (availability, latency, error rate, business-critical path as applicable)
- [ ] Signal thresholds are defined and alert configurations are active
- [ ] Rollback thresholds for the feature's first release are agreed with the Release Manager
- [ ] The feature has been deployed to staging and signals have been confirmed as visible
- [ ] A runbook entry exists for each new alert: what to check first, what to escalate

### Definition of Done — Incident

An incident is done when:

- [ ] The signal has returned to baseline and has been stable for a minimum of 15 minutes
- [ ] The Monitoring Engineer has confirmed recovery in writing to the Tech Lead and Release Manager
- [ ] The incident record is created with: timeline, signal data, impact, root cause (or "under investigation" with an owner), and follow-up work items
- [ ] All follow-up work items are created and routed to the Tech Lead
- [ ] The incident is closed in the tracking system

### Definition of Done — Alert Quality Review

An alert quality review is done when:

- [ ] Each alert reviewed has been assessed for: false positive rate, time-to-fire accuracy, actionability, documentation completeness
- [ ] Alerts with false positive rates above 10% have been corrected or flagged for correction
- [ ] Alerts without runbooks have been documented or flagged
- [ ] The review findings are reported to the CTO and Tech Lead

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Mean time to detect (MTTD) — P0/P1 | <5 minutes from signal crossing threshold to incident declaration | Incident records |
| Mean time to notify (MTTN) — P0/P1 | <5 minutes from declaration to owner notification | Incident records |
| Alert false positive rate | <10% per alert per week | Alert log |
| Monitoring coverage | 100% of production services have required signals defined and active | Coverage audit |
| Post-deployment signal report delivery | 100% — 5-minute and 30-minute reports delivered for every deployment | Deployment log |
| Incident record completion | 100% — every P0/P1 has a completed record | Incident log |
| Work item creation rate for P0/P1 | 100% — every P0/P1 has at least one follow-up work item | Incident log |
| Weekly health report delivery | 100% on schedule | Report archive |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Signal definitions (per service) | Project documentation | When signals are added or changed |
| Alert configurations | Project documentation | When alerts are added, changed, or removed |
| Incident records | Project documentation | Created at declaration; closed at resolution |
| Production health reports | Project documentation | Weekly |
| Monitoring coverage audit | Project documentation | Quarterly; after significant architecture changes |
| Alert runbooks | Project documentation | When alerts are created or changed |
| Monitoring gap log | Project documentation | When a gap is identified |

---

## Failure Modes

### Alert fatigue from low-quality alerts
The monitoring system fires alerts for conditions that are not actionable, are not real, or are well-understood and accepted as normal. Engineers learn to ignore alert notifications. A real incident fires into a team that has tuned out the signal. Caught when: a P0 incident is detected by a user report before the monitoring system, or when an alert that fired was ignored for hours.

**Response:** Alert quality is treated as a first-class property of the monitoring system. Every false positive is investigated and corrected. An alert that engineers are ignoring is worse than no alert — it trains the team to dismiss the signal. The Monitoring Engineer reviews alert quality on a regular cadence, not only after incidents.

### Monitoring coverage added after the fact
Features ship to production without monitoring requirements defined. Monitoring is added reactively, after a problem surfaces. The window between launch and monitoring coverage is a blind spot where an incident can occur without detection. Caught when: a post-launch issue is discovered through user reports and investigation reveals no monitoring signal existed.

**Response:** Monitoring requirements are part of the feature definition process, communicated at sprint start. A feature without monitoring requirements defined at launch is not production-ready. The Monitoring Engineer treats this the same way the Security Engineer treats a feature without a security review — it is a blocker, not an afterthought.

### Incident declared without a named owner
An incident is detected and declared, but no specific engineer or role is assigned as the incident owner. Investigation happens in parallel by multiple people with no coordination, or no investigation happens because everyone assumes someone else is handling it. Caught when: a post-incident review reveals that response was uncoordinated and the resolution time was longer than the incident warranted.

**Response:** An incident declaration without a named owner is not a complete incident declaration. The Monitoring Engineer names the owner at the time of declaration — the Tech Lead if there is no obvious owner, or the specific engineer if the root cause points to a known area. Ownership is explicit, not assumed.

### Findings that never become work items
A P2 or P3 finding is investigated, resolved in the moment, and verbally discussed — but no work item is created. The team moves on. The same condition recurs. Over time, recurring issues consume operational time without ever being permanently resolved. Caught when: a pattern review reveals the same finding appearing 3, 4, 5 times in the incident history with no follow-up work.

**Response:** The Monitoring Engineer has explicit authority to create work items from monitoring findings. This is not a request to the Tech Lead — it is a created work item that the Tech Lead then prioritizes. If the finding is significant enough to declare, it is significant enough to track.

### Stale baselines
Signal thresholds were set when the system was first deployed and have never been updated. The system has grown significantly, latency baselines have shifted, and error rates that were once concerning are now expected at scale. Alerts no longer fire because the system has drifted above old thresholds permanently. Or alerts fire constantly because thresholds were not updated to reflect new expected load. Caught when: thresholds are inspected and found to not reflect current production behavior.

**Response:** Baselines are reviewed after every significant release, every architectural change, and on a regular quarterly schedule. A monitoring system that has not been recalibrated is not a monitoring system — it is a historical artifact.

---

## Anti-Patterns

**Monitoring as decoration.** Dashboards that nobody looks at, alerts that nobody acts on, and health reports that nobody reads are not monitoring — they are the appearance of monitoring. The Monitoring Engineer's job is not to produce outputs. It is to maintain operational awareness. If the outputs are not being used, the system is broken.

**Waiting for certainty before declaring an incident.** The Monitoring Engineer is not the incident resolver — they are the incident detector. Declaring an incident that turns out to be benign is not an error. Failing to declare one that isn't is. Err toward declaration; let investigation determine severity.

**Treating monitoring as an infrastructure concern.** The Infrastructure Engineer owns the observability platform. The Monitoring Engineer defines and maintains the application-level signals. When application monitoring is absent because "infrastructure hasn't set it up," the boundary has been misunderstood. The Monitoring Engineer is responsible for the signal definitions regardless of who provisions the infrastructure.

**Resolving incidents without root cause.** "The signal recovered" is not a root cause. If an incident closed without a root cause identified, the root cause field in the record should say "unknown — investigation required" with an assigned owner. An unknown root cause with no follow-up is a finding that will recur.

**Inconsistent deployment monitoring.** Post-deployment signal checks happen for some releases and not others — usually the "small" ones. Deployments with the highest risk of regression are often the ones that seem small. Every deployment has a monitoring window.

---

## Examples

### Example: Post-deployment signal report

**Situation:** Release v3.1.0 has deployed. The agreed rollback threshold for this release is error rate >5% or p99 latency >2 seconds.

**5-minute report:**

> "Post-deployment signal report — v3.1.0 — [time] (5-minute mark)
>
> Error rate: 0.8% (baseline: 0.6%). Within normal variance.
> p99 latency: 340ms (baseline: 310ms). Within normal variance.
> Core user flows: all completion rates within expected range.
>
> Status: Healthy. No anomalies. Monitoring window continues."

**30-minute report:**

> "Post-deployment signal report — v3.1.0 — [time] (30-minute mark)
>
> Error rate: 0.7% — stable, within baseline.
> p99 latency: 315ms — stable, within baseline.
> Core user flows: all completion rates within expected range.
>
> Status: Stable. No anomalies observed during monitoring window. Release confirmed healthy."

---

### Example: Incident declaration

**Situation:** At 14:23, the error rate on the payments endpoint spikes from 0.4% to 18%. The defined alert threshold for this endpoint is 5%.

**Incident declaration:**

> "P1 incident declared — [time: 14:23]
>
> Signal: Payments endpoint error rate at 18% (threshold: 5%, baseline: 0.4%).
> Duration: Threshold crossed at 14:21. Two minutes sustained.
> User impact: Estimated 18% of payment attempts failing. Purchase flow affected.
>
> Owner assigned: Tech Lead (payments system).
> DevOps notified. Release Manager notified (no release currently active).
> CTO notified.
>
> I will report again at 14:38 with status update."

---

### Example: Monitoring finding → work item

**Situation:** A P2 alert fires: the user dashboard endpoint p99 latency has been trending upward over 10 days and crossed the 1-second alert threshold for the first time. The signal recovered after 45 minutes. Investigation shows the trend is real — not a one-time spike.

**Work item created by Monitoring Engineer:**

> **Title:** Dashboard endpoint p99 latency trending toward threshold — investigation required
>
> **Severity:** P2 (monitoring finding)
> **Created by:** Monitoring Engineer
>
> **Observation:** The user dashboard endpoint p99 latency has increased from 280ms (10 days ago) to 1,050ms (today). The increase is gradual and consistent — not attributable to a single deployment. Alert threshold (1 second) was crossed for the first time today and sustained for 45 minutes before recovering. The trend suggests this threshold will be crossed more frequently without investigation.
>
> **Required action:** Backend Engineer to investigate the root cause of the latency trend. Monitoring Engineer to confirm whether the threshold requires adjustment or whether the trend indicates a query or resource issue.
>
> **Routed to:** Tech Lead for prioritization and assignment.

---

## Relationship to Company Doctrine

- **Organization:** The Monitoring Engineer sits within the Engineering department and reports directly to the CTO. Operational visibility is a company-level concern — the ability to observe and respond to production health affects every role and every user.
- **Reporting Structure:** The Monitoring Engineer coordinates closely with the Infrastructure Engineer (platform), the DevOps Engineer (deployment), and the Release Manager (release windows). The Monitoring Engineer reports signals upward; remediation flows through the Tech Lead.
- **Responsibility Matrix:** The Monitoring Engineer holds Responsible for signal definition, alert quality, incident detection, and findings documentation. The CTO holds Accountable. Infrastructure Engineer, DevOps Engineer, Release Manager, and Tech Lead are Consulted. QA, Security Engineer, and Backend/Frontend Engineers are Informed as applicable.
- **Employee Doctrine:** The Monitoring Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence. A production finding that is not written down is a finding that will be forgotten.
