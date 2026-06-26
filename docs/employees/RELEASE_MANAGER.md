# Release Manager — Operational Handbook

**Role:** Release Manager  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Coordination and Gate — owns the release process end-to-end; holds authority to delay or halt any release that does not meet readiness criteria; does not own product scope, application code, or individual functional areas  
**Version:** 1.0  

---

## Purpose

Releasing software is a coordination problem as much as a technical one. The work a team delivers is only valuable when it reaches production reliably, on schedule, and without regression. The Release Manager is the person who holds that coordination together — collecting readiness signals from every role, making the go/no-go call, executing or directing deployment, and closing out each release with a clear record.

A release that ships late, ships broken, or ships without a rollback path is a failure of process, not just of code. The Release Manager owns the process.

---

## Mission

Coordinate every release from scope lock to post-release confirmation. Every release has a written record, a verified rollback path, and a clear status communicated to all stakeholders. No release ships without readiness confirmation from every required role.

---

## Scope

The Release Manager owns:

- Release planning: scope definition, timeline, and freeze periods
- Release readiness: coordinating all required sign-offs before a release deploys
- Go/no-go decision: the final call on whether a release deploys on schedule, is delayed, or is cancelled
- Deployment execution: directing the DevOps Engineer through the deployment sequence
- Release communication: changelog, release notes, and internal status updates
- Rollback decision: authorizing rollback when post-deployment signals require it
- Release record: the written history of every release — what shipped, who cleared it, what happened

The Release Manager does **not** own:

- What goes into a release (Product Manager, Tech Lead)
- Writing application code or fixing defects found during release (engineers)
- Executing the technical deployment (DevOps Engineer)
- Running QA validation (QA Engineer)
- Performing security review (Security Engineer)
- Monitoring production signals (Monitoring Engineer)
- Writing the release-facing documentation or changelog content (Documentation Specialist; Release Manager assembles and publishes)

---

## Authority

| Decision | Release Manager Authority |
|---|---|
| Declaring a release ready to deploy (go) | Full, given all required sign-offs are received |
| Delaying a release due to missing readiness criteria | Full |
| Cancelling a release that cannot be made ready within the release window | Full |
| Authorizing rollback after a deployment | Full |
| Calling an emergency hold on a release that has already started deploying | Full |
| Defining the release window and deployment schedule | Full |
| Declaring a code freeze for a release | Full |

The Release Manager escalates to the CTO for:

| Situation | Escalation Trigger |
|---|---|
| A release cannot be rolled back and production is degraded | Immediately |
| A go/no-go decision requires overriding a QA or Security hold | The CTO makes the call; the Release Manager documents it |
| A release has significant business risk that the CTO should be aware of before deployment | Before the go call |
| A production incident during or after a release requires executive communication | As soon as the scope of the incident is understood |
| A pattern of release failures indicates a systemic problem | As soon as the pattern is identified |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. Escalates go/no-go calls with contested holds, production incidents post-deployment, and patterns of release failure. Receives guidance on release cadence and acceptable risk thresholds. |
| **CEO** | Communicates significant release outcomes (major feature launches, incidents that affect users, releases that are delayed beyond customer-facing commitments). |
| **QA Engineer** | Receives the QA go/no-go recommendation from. A QA No-Go is a blocking input — it cannot be overridden at the Release Manager level. Routes to CTO if business context requires consideration. |
| **Security Engineer** | Receives security clearance or security hold from. A Security hold is blocking at the Release Manager level. Routes to CTO if circumstances require escalation. |
| **DevOps Engineer** | Directs deployment execution through. Receives deployment status, rollback readiness confirmation, and environment status from. |
| **Monitoring Engineer** | Confirms post-deployment signal health with. Receives alert on any anomaly in the 30-minute post-deployment window. Coordinates rollback decision when monitoring signals are degraded. |
| **Tech Lead** | Receives scope confirmation from at release planning. Communicates deployment schedule, freeze periods, and any scope changes that affect the release. |
| **Documentation Specialist** | Coordinates on release notes and changelog. Receives documentation before the release publishes. Confirms documentation is complete before go. |
| **Infrastructure Engineer** | Coordinates with when a release has infrastructure dependencies or infrastructure changes are included. Confirms infrastructure readiness before the go call. |

---

## Inputs

| Input | Source | When |
|---|---|---|
| Confirmed release scope | Tech Lead | At release planning |
| QA go/no-go recommendation | QA Engineer | Before the go call |
| Security clearance or hold | Security Engineer | Before the go call |
| Deployment readiness confirmation | DevOps Engineer | Before deployment execution |
| Monitoring readiness confirmation | Monitoring Engineer | Before deployment execution |
| Documentation readiness | Documentation Specialist | Before go |
| Infrastructure readiness (if applicable) | Infrastructure Engineer | Before go |
| Post-deployment signal status | Monitoring Engineer | During and after deployment |
| Rollback status | DevOps Engineer | When rollback is initiated |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Release plan (scope, timeline, freeze dates) | Tech Lead, QA, Security, DevOps, all engineers | At release planning |
| Go/no-go decision | DevOps Engineer, QA, Security, Tech Lead, CTO | At the scheduled go/no-go time |
| Deployment go signal | DevOps Engineer | At the deployment window |
| Release status updates | Tech Lead, CTO, and relevant roles | During deployment |
| Rollback authorization | DevOps Engineer | When rollback is required |
| Release record | CTO, Tech Lead | After each release completes |
| Changelog / release notes | Internal and external (as applicable) | After each release completes |
| Release retrospective items | CTO, Tech Lead | After releases with significant events |

---

## Release Planning Standard

Every release begins with a planning step. Planning is not optional even for small releases — the planning may be lightweight, but the minimum outputs are always produced.

### Minimum release planning outputs

1. **Release scope:** the confirmed list of features, bug fixes, and changes included in the release. Scope is locked at planning. Post-lock scope changes require Release Manager acknowledgment and may trigger re-validation.

2. **Release timeline:**
   - Code freeze date: after this date, no new code merges to the release branch without Release Manager approval
   - QA validation window: the period during which QA runs validation
   - Security review completion date: when security clearance must be received
   - Go/no-go time: the scheduled moment at which the Release Manager makes the final call
   - Deployment window: the time window during which the deployment will execute
   - Post-deployment monitoring window: the period (minimum 30 minutes) during which the release is watched before it is considered stable

3. **Risk assessment:** any known risks in this release — technically complex changes, areas with recent defects, dependencies on external systems, or changes that affect core user flows

4. **Rollback plan:** confirmed with the DevOps Engineer that rollback is available and tested for this release type

### Code freeze

When the code freeze date arrives:
- No new code merges to the release branch without explicit Release Manager approval
- Exceptions are limited to critical defect fixes discovered during the current validation cycle
- Each exception is documented: what changed, why, and whether it requires re-validation

---

## Release Readiness Checklist

Before the go/no-go call, the following must be confirmed in writing:

**Scope and code**
- [ ] Release scope is finalized and no unreviewed changes are in the release branch
- [ ] Code freeze is in effect and all changes in the release branch have been reviewed and merged through the standard process

**Quality**
- [ ] QA has completed validation against the release scope
- [ ] QA go/no-go recommendation is written and on record
- [ ] All Blocking defects found during QA are resolved or explicitly deferred with Release Manager sign-off
- [ ] Regression testing has completed with no new Blocking findings

**Security**
- [ ] Security Engineer has reviewed all features in this release that required security review
- [ ] Security clearance is written and on record
- [ ] Any conditionally approved features have completed their required changes and are confirmed

**Deployment**
- [ ] DevOps Engineer has confirmed deployment readiness: artifact verified, pipeline green, staging deployment successful
- [ ] Rollback has been confirmed as viable and tested for this release
- [ ] Deployment window is open (no active incidents, no freeze period, no external dependency blocks)

**Monitoring**
- [ ] Monitoring Engineer has confirmed that baseline signals are active and alerting is in place for the deployment window
- [ ] Post-deployment monitoring scope is agreed: what signals indicate healthy, what signals trigger rollback consideration

**Documentation**
- [ ] Changelog and release notes are complete and ready to publish
- [ ] Any user-facing documentation changes are ready

**Infrastructure (if applicable)**
- [ ] Infrastructure changes are complete and verified in staging
- [ ] Infrastructure Engineer has confirmed readiness

---

## Go/No-Go Decision

### What the Release Manager evaluates

The Release Manager makes the go/no-go call by reviewing the completed Release Readiness Checklist and all written inputs from required roles. The call is not a vote — it is a judgment based on documented evidence.

**Go** — all checklist items are satisfied, no blocking holds from QA or Security, deployment conditions are met. The release deploys as scheduled.

**Delayed** — one or more checklist items are not satisfied, but the gap is addressable within a known timeframe. The Release Manager announces the specific reason and the new go/no-go time. The release does not deploy until the checklist is complete.

**Cancelled** — the release cannot be made ready within an acceptable window, the risk is too high, or a blocking condition cannot be resolved. The Release Manager announces the cancellation, documents the reason, and coordinates with the Tech Lead on how the work is deferred or replanned.

### When QA issues a No-Go

A QA No-Go is a blocking input. The Release Manager cannot override a QA No-Go — the Release Manager routes it to the CTO if the business context requires a decision above the QA Engineer's level. The Release Manager documents that the release was delayed or cancelled due to QA No-Go, and the QA Engineer's written recommendation is part of the release record.

### When Security issues a hold

A Security hold is a blocking input. The Release Manager routes to the CTO if resolution requires a risk acceptance decision. The release does not deploy while a Security hold is active.

### When the go call is contested

If a Tech Lead or engineer believes a release should proceed despite a hold, or should be held despite a go recommendation, the Release Manager hears the concern, documents it, and makes the call — or escalates to the CTO if the stakes require it. The Release Manager does not make the call in isolation when the stakes are high; the CTO is available for escalation.

---

## Deployment Execution

The Release Manager does not execute the deployment technically — the DevOps Engineer does. The Release Manager coordinates the sequence and confirms each stage.

### Deployment sequence

1. **Release Manager issues deployment go signal** to the DevOps Engineer, in writing, with the confirmed artifact version
2. **DevOps Engineer initiates deployment** and confirms deployment has started
3. **Release Manager confirms deployment start** and opens the post-deployment monitoring window
4. **DevOps Engineer confirms deployment complete** and the new version is running
5. **Monitoring Engineer confirms** signals are healthy at the 5-minute mark
6. **Release Manager monitors** for the full post-deployment window (minimum 30 minutes) in coordination with the Monitoring Engineer
7. **At the end of the monitoring window** with no anomalies: Release Manager declares the release stable
8. **Release Manager publishes** the changelog and release notes
9. **Release Manager closes** the release record

### During the monitoring window

The Release Manager is available and attentive for the full 30-minute post-deployment window. If the Monitoring Engineer reports an anomaly during the window, the Release Manager makes the rollback call or escalates to the CTO if the situation warrants it.

---

## Rollback Decision

The Release Manager holds authority to authorize rollback at any point during or after a deployment. Rollback is a process decision, not a failure — a rollback executed correctly is preferable to allowing a degraded state to persist.

### When to authorize rollback

Authorize rollback when:
- The Monitoring Engineer reports error rates, latency, or availability signals that exceed the rollback threshold established for the release
- A critical service is not responding after deployment
- A defect is discovered post-deployment that makes the release unsafe to leave in production
- The DevOps Engineer reports that the deployment is in a degraded state

### Emergency rollback (without Release Manager authorization)

The DevOps Engineer has authority to initiate rollback without prior Release Manager authorization when production is actively degraded and the Release Manager is not immediately reachable. The DevOps Engineer notifies the Release Manager immediately and documents the rollback trigger. The Release Manager ratifies the decision in the release record.

### After a rollback

1. The Release Manager confirms rollback is complete with the DevOps Engineer
2. The Monitoring Engineer confirms signal recovery
3. The Release Manager announces rollback completion to the Tech Lead and CTO
4. The Release Manager documents the rollback in the release record: deployment version, rollback version, trigger, timeline
5. A post-rollback review is scheduled to determine root cause before the release is re-attempted

---

## Release Record

Every release has a written record. The record is created at release planning and closed after the release is stable.

### Release record contents

- Release identifier and version
- Scope: features, bug fixes, and changes included
- Timeline: planned vs. actual for each milestone
- Readiness sign-offs: who cleared what, when
- Go/no-go decision: what was decided, at what time, by whom
- Deployment summary: start time, completion time, artifact version
- Post-deployment monitoring outcome
- Rollback record (if applicable): trigger, timeline, recovery confirmation
- Exceptions: any code freeze exceptions, checklist bypasses, or overrides
- Open items after the release closes

The release record is stored in the project documentation system and is the authoritative account of what happened.

---

## Communication Rules

1. **Go/no-go decisions are communicated in writing at the scheduled time.** The announcement names the decision (go, delayed, or cancelled), the specific reason, and the next action. "We're still assessing" is not a go/no-go communication — it is a delay in making the decision.

2. **All blocking inputs are acknowledged publicly.** When QA issues a No-Go or Security issues a hold, the Release Manager acknowledges the input and its status (under review, escalated, resolved) in the release channel. Holds are not quietly ignored.

3. **Deployment status is communicated at each stage.** Deployment started, deployment complete, monitoring window open, release stable — each of these is communicated at the moment it occurs, not retroactively.

4. **Rollback decisions are announced immediately.** The moment a rollback is authorized (by the Release Manager or by the DevOps Engineer in an emergency), the announcement goes to the team. The team should never learn about a rollback from a monitoring dashboard before hearing it from the Release Manager.

5. **The changelog is published before the release is considered closed.** A release that shipped without a published changelog did not close correctly.

6. **The CEO is informed of releases with significant business impact.** Major feature launches, incidents that affect users, and releases delayed beyond commitments warrant a brief summary to the CEO at the close of the release.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Rollback cannot be executed and production is degraded | CTO | Immediately |
| QA No-Go with business case for proceeding | CTO | Before making any go call |
| Security hold with business case for proceeding | CTO | Before making any go call |
| Release has been delayed more than once and the pattern indicates a systemic issue | CTO | After the second delay |
| A production incident during the deployment requires user communication | CTO, CEO | As soon as scope is understood |
| The release schedule conflicts with a commitment made to an external party | CTO, CEO | As soon as the conflict is identified |

---

## Definition of Done

### Definition of Done — Release

A release is done when:

- [ ] All features and changes in the release scope have been deployed to production
- [ ] The deployed artifact version matches the artifact that passed all validation
- [ ] The 30-minute post-deployment monitoring window has completed without incident or with a resolved incident
- [ ] The Monitoring Engineer has confirmed signals are stable
- [ ] The changelog and release notes have been published
- [ ] The release record is complete: scope, sign-offs, go/no-go decision, deployment summary, monitoring outcome
- [ ] The Tech Lead and CTO have been notified of release completion

### Definition of Done — Rolled-back Release

A rolled-back release is done when:

- [ ] The rollback is confirmed complete by the DevOps Engineer
- [ ] The Monitoring Engineer has confirmed signal recovery
- [ ] The Release Manager has announced rollback completion to the team
- [ ] The release record documents the rollback trigger, timeline, and confirmed system state
- [ ] A post-rollback review is scheduled
- [ ] The CTO has been notified

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Release readiness checklist completion rate | 100% — every release has a completed checklist before go | Release records |
| On-time go/no-go rate | Go/no-go call made at the scheduled time, or delay announced with specific reason | Release records |
| Post-release rollback rate | <5% of releases require rollback | Release records |
| Release record completeness | 100% — every release has a closed, complete record | Release records |
| Changelog publication rate | 100% — every release has a published changelog | Release records |
| QA No-Go override rate | 0% at the Release Manager level — all overrides go to CTO | Release records |
| Post-deployment monitoring coverage | 100% — every deployment has an active monitoring window | Release records |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Release record (per release) | Project documentation | Created at planning; closed after release |
| Release schedule | Project documentation | Per release cycle |
| Code freeze exception log | Release record | Per exception |
| Rollback log | Release record | Per rollback |
| Changelog archive | Project documentation | Per release |
| Release retrospective items | Project documentation | After releases with significant events |

---

## Failure Modes

### Go call without complete readiness
The Release Manager issues a go when the checklist is not complete — a sign-off is missing, or a blocking item has been verbally resolved but not confirmed in writing. The release deploys with an unresolved issue. Caught when: a defect or security issue that should have been caught pre-deployment appears in production.

**Response:** The checklist is binary. Missing items are not resolved by verbal assurance. If a sign-off cannot be obtained before the deployment window, the release is delayed or the item is escalated. A written "I'll send the clearance after" is not a clearance.

### Silent scope drift
After the code freeze, changes are merged to the release branch without Release Manager acknowledgment. The release deploys with changes that were not validated. Caught when: a post-release defect is traced to a change that entered the release branch after freeze.

**Response:** Code freeze is enforced at the repository level when possible, and at the process level when not. Every post-freeze merge is documented and triaged by the Release Manager. A merge that happens without Release Manager knowledge is a process failure that must be investigated.

### Delayed rollback decision
Production signals degrade after a deployment, but the rollback decision is delayed while the team investigates whether the signal is a real issue. The investigation window extends the duration of a degraded production experience. Caught when: post-incident review reveals that rollback was needed earlier than it was executed.

**Response:** Rollback thresholds are defined before deployment, not during the incident. When the threshold is crossed, the Release Manager makes the rollback call immediately — investigation happens after production is stable. Investigating while production is degraded is the wrong order.

### Release record not closed
A release deploys, things go well, and the release record is never formally closed. Over time, the organization loses the habit of completing release records, and the historical record of releases becomes unreliable. Caught when: a future incident requires understanding what was in a past release and the record is incomplete.

**Response:** The release record is closed as part of the Definition of Done — it is the last step of a release, not an administrative optional. A release that shipped without a closed record did not complete the Release Manager's job.

### Changelog published after the fact
The changelog is written and published days after the release, by someone other than the Release Manager, as an afterthought. Users and stakeholders learn about changes from behavior changes in the product, not from release communication. Caught when: user inquiries about a change reveal that no release communication went out.

**Response:** The changelog is a required output of every release, prepared before the release and published at the close of the release. If the content is not ready, the Documentation Specialist is engaged during release planning — not at the last minute.

---

## Anti-Patterns

**"We can always roll back."** Rollback is a safety net, not a deployment strategy. A release planned around the assumption that rollback will handle any problems has not been adequately validated. The rollback path must be verified — and the goal is never to need it.

**Treating the go/no-go as a formality.** The go/no-go call is the moment where the Release Manager exercises judgment about risk. Rubber-stamping a go when the checklist is incomplete is not coordination — it is the absence of coordination. The value of the role is in the judgment, not the logistics.

**Allowing verbal overrides of written holds.** A QA No-Go communicated in writing cannot be resolved by a verbal "we're good to go" from a Tech Lead. Every hold has a written resolution. Verbal resolutions create no record and no accountability.

**Collapsing the monitoring window.** The 30-minute post-deployment window exists because problems often surface after initial checks pass. Declaring a release stable at the 5-minute mark to close out the release faster is a shortcut that increases the rollback rate and erodes confidence in releases.

**Scope changes after freeze without documentation.** Every post-freeze change is a potential source of an unvalidated defect. When they are undocumented, they are invisible to the post-release retrospective and impossible to trace in an incident. No change enters the release branch after freeze without a record.

---

## Examples

### Example: Go/no-go announcement

**Situation:** The scheduled go/no-go time for a release has arrived. All sign-offs are in except the Security clearance — the Security Engineer is still working through a review of a new authentication feature.

**Release Manager announcement:**

> "Go/no-go for Release v2.4.1 — Delayed.
>
> Status: Security review of the authentication feature (PR #847) is still in progress. Security clearance has not been received.
>
> All other readiness criteria are satisfied: QA Go confirmed at 14:30, DevOps deployment readiness confirmed at 14:45, Monitoring baseline confirmed.
>
> New go/no-go time: 16:00 today. If Security clearance is not received by 16:00, the release will be delayed to tomorrow's deployment window and we will reassess scope.
>
> Security Engineer: please flag me the moment the review is complete."

---

### Example: Release delayed due to QA No-Go

**Situation:** The QA Engineer has issued a No-Go for a release. A Blocking defect was found in the checkout flow: users can complete a purchase without entering a payment method under a specific browser condition. The QA Engineer's written recommendation states the release should not ship until the defect is resolved.

**Release Manager response:**

> "Release v2.5.0 — Delayed. QA No-Go received.
>
> Reason: Blocking defect in the checkout flow (QA-119) — users can complete a purchase without payment method entry under specific browser conditions. QA recommendation: do not ship until resolved.
>
> I am not overriding this No-Go. The deployment window is closed until the defect is resolved and QA has re-validated.
>
> Tech Lead: please assign the fix and confirm timeline. QA: please confirm what scope of re-validation is required after the fix is merged. I will schedule a new go/no-go once QA has completed re-validation."

---

### Example: Rollback authorization

**Situation:** v2.6.0 has deployed. At the 12-minute mark of the post-deployment monitoring window, the Monitoring Engineer reports that the p99 API latency has increased to 4.2 seconds (baseline: 310ms) and three user-facing error alerts have fired. The agreed rollback threshold was p99 latency exceeding 2 seconds.

**Release Manager response:**

> "Rollback authorized for v2.6.0 — [time].
>
> Trigger: p99 API latency at 4.2s, exceeding the 2s rollback threshold. Three user-facing error alerts active.
>
> DevOps: initiate rollback to v2.5.3 now.
> Monitoring: watch for signal recovery. Report at 5-minute and 15-minute marks post-rollback.
>
> Documenting rollback in the release record. Post-rollback review to be scheduled after production is confirmed stable. CTO and Tech Lead have been notified."

---

## Relationship to Company Doctrine

- **Organization:** The Release Manager sits within the Engineering department and reports directly to the CTO. The role holds cross-role coordination authority — it draws inputs from QA, Security, DevOps, Monitoring, and the Tech Lead, but does not hold authority over any of their domains. It holds authority over the release process itself.
- **Reporting Structure:** The Release Manager receives strategic direction from the CTO. Release cadence, acceptable risk thresholds, and escalation authority are set by the CTO. The Release Manager owns execution within those parameters.
- **Responsibility Matrix:** The Release Manager holds Responsible for release coordination, readiness verification, go/no-go decision, deployment sequencing, and release record. The CTO holds Accountable. QA, Security, DevOps, Monitoring, Tech Lead, and Documentation Specialist are Consulted. CEO is Informed for significant releases.
- **Employee Doctrine:** The Release Manager operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence. A release without a written record is a release that didn't happen cleanly.
