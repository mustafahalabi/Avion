# SOP: Release

**SOP ID:** SOP-005  
**Category:** Standard Operating Procedure  
**Owner:** Release Manager  
**Version:** 1.0  

---

## Purpose

A release is the act of delivering validated, approved software to users. It is the last step in a chain of work that begins with a Feature Brief and ends only when the change is live, monitored, and documented. Every release in Engineering OS follows this procedure — not to add ceremony, but to ensure that the work of the engineers, the QA validation, the code review, and the documentation effort reaches users intact and the organization learns from every delivery.

The Release Manager owns this procedure from the moment a release is assembled through the post-release monitoring handoff. No release proceeds without a Release Manager. No release proceeds without a written QA recommendation. The Release Manager is the single accountable person for what ships and when.

---

## Trigger

This procedure is triggered when:

- A sprint or planned release window is reached and the team has completed work ready for release
- An unplanned release is required to ship a critical bug fix (hotfix path — see Phase 2 for hotfix readiness criteria)
- The CTO or CEO approves a release outside the standard sprint cadence

---

## Owner

**Release Manager** — owns the release from Release Readiness assessment through post-release documentation. The Release Manager has authority to delay a release and must seek CTO approval to override a QA No-Go.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Release Manager** | End-to-end release ownership; Release Readiness Checklist; go/no-go decision; deployment coordination; post-release monitoring handoff |
| **QA Engineer** | Written go/no-go recommendation; available during deployment for issue escalation |
| **DevOps Engineer** | Production deployment execution; rollback readiness; environment verification |
| **Monitoring Engineer** | Monitoring alert configuration; post-release monitoring handoff; production health observation |
| **Technical Writer** | Documentation completeness verification; changelog authorship; documentation deployment |
| **Tech Lead** | Available for technical escalation during deployment; confirms technical readiness |
| **CTO** | Approves release delays beyond Release Manager authority; approves overrides of QA No-Go; available for production escalation |
| **CEO** | Notified before releases with significant user-visible changes; informed of any release incident that reaches P0/P1 severity |
| **Backend/Frontend/AI Engineers** | On-call during deployment window for issue response |

---

## Preconditions

Before the Release Manager begins the Release Readiness Checklist, all of the following must be true:

- [ ] All work items in the release scope are in "In Review" status or completed in Linear
- [ ] The QA Engineer has delivered a written go/no-go recommendation
- [ ] All code in the release scope has been reviewed and approved
- [ ] Staging has been deployed with the release candidate
- [ ] The Technical Writer has confirmed documentation completeness for all user-facing changes

---

## Procedure

### Phase 1: Release Readiness Assessment

**Owner:** Release Manager  
**Input:** Completed work items; QA recommendation; code review approvals; staging deployment  
**Output:** Release Readiness Checklist completed; release approved or delayed  

**Steps:**

1. **Release Manager** assembles the Release Readiness Checklist. Each item must be confirmed — not assumed. "I think it's done" does not satisfy a checklist item.

**Release Readiness Checklist:**

*QA and Validation*
- [ ] QA Engineer has delivered a written go/no-go recommendation
- [ ] QA recommendation is Go — or a CTO-authorized override is documented
- [ ] All Blocking defects from QA validation are resolved and re-validated
- [ ] Deferred Medium/Low defects are documented with deferral decisions

*Code and Review*
- [ ] All code in the release scope is reviewed and approved
- [ ] No active Blocking findings from code review
- [ ] Security review is complete for any security-relevant changes
- [ ] All changes are deployed to staging in the release candidate build

*Documentation*
- [ ] Changelog entry is written and reviewed
- [ ] User-facing documentation is updated (if applicable)
- [ ] API documentation is updated (if applicable)
- [ ] Technical Writer has confirmed documentation completeness

*Operations*
- [ ] DevOps Engineer has confirmed production deployment readiness
- [ ] Rollback plan is confirmed and tested
- [ ] Monitoring Engineer has confirmed alert configuration for the release scope
- [ ] On-call engineers are identified and available for the deployment window
- [ ] Release window is confirmed with the team

*Approvals*
- [ ] Tech Lead has confirmed technical readiness
- [ ] Release Manager has reviewed the full checklist and approves proceeding

2. When all checklist items are confirmed, the Release Manager declares the release ready to proceed.

3. When one or more checklist items cannot be confirmed:
   - The Release Manager documents which items are blocking and why
   - The Release Manager determines whether the delay is within their authority to resolve or requires CTO escalation (see Escalation Rules)
   - The release is delayed until the blocking items are resolved

4. The Release Manager records the checklist completion in the release record. The checklist is not a verbal process — it is a written document.

**Gate 1:** Release Readiness Checklist is complete. All items confirmed or release formally delayed.

---

### Phase 2: Hotfix Release Readiness (Alternate Path)

**Owner:** Release Manager  
**Input:** Hotfix code; expedited QA validation; CTO approval  
**Output:** Hotfix release approved or delayed  

This phase applies only to hotfix releases — unplanned releases required to address Critical or High severity production defects. Hotfix releases follow an abbreviated readiness process, but they are not exempt from the fundamental gates.

**Hotfix eligibility criteria (all must be true):**
- The defect is classified Critical or High severity per SOP-002 (Bug Fix)
- The CTO has approved hotfix release timing
- QA validation of the fix is complete (abbreviated scope is permitted; the QA Engineer documents the abbreviated scope explicitly)
- The fix has been code-reviewed and approved
- The DevOps Engineer has confirmed deployment readiness

**Hotfix readiness checklist:**
- [ ] CTO approval for hotfix release
- [ ] Fix implemented, reviewed, and approved
- [ ] QA validation complete (abbreviated scope documented)
- [ ] QA recommendation is Go
- [ ] DevOps deployment readiness confirmed
- [ ] Rollback plan confirmed
- [ ] Monitoring Engineer notified and available
- [ ] Changelog entry written (may be minimal for speed; expanded post-release)

A hotfix release that skips QA validation is not a hotfix — it is an unvalidated deployment. This requires explicit CTO authorization and is recorded in the incident record.

**Gate 2H (Hotfix):** Hotfix readiness checklist complete. CTO approval confirmed.

---

### Phase 3: Pre-Deployment Communication

**Owner:** Release Manager  
**Input:** Confirmed release scope; release window  
**Output:** All stakeholders notified; engineers on standby  

**Steps:**

1. **Release Manager** notifies the following before deployment begins:

   | Recipient | What they receive | When |
   |---|---|---|
   | DevOps Engineer | Deployment authorization, release scope, rollback plan | Before deployment window opens |
   | Monitoring Engineer | Release scope, expected behavior changes, monitoring focus areas | Before deployment window opens |
   | On-call engineers | Deployment window, issue escalation path, their on-call responsibility | Before deployment window opens |
   | Tech Lead | Final release scope confirmation | Before deployment window opens |
   | CEO | Summary of what is shipping and any significant user-visible changes | Before deployment for significant releases; can be post-deployment for minor releases at Release Manager discretion |
   | CTO | Deployment window and any items requiring their awareness | Before deployment for any release with elevated risk |

2. **Release Manager** confirms each recipient has acknowledged the notification. Notifications are not sent and forgotten — they are tracked until acknowledged.

3. For releases with significant user-facing changes, the **Release Manager** confirms that the changelog is ready to be published immediately after deployment.

**Gate 3:** All required notifications sent and acknowledged. On-call coverage confirmed.

---

### Phase 4: Deployment

**Owner:** DevOps Engineer (execution); Release Manager (coordination and decision authority)  
**Input:** Release candidate; deployment authorization from Release Manager  
**Output:** Release deployed to production; health confirmed  

**Steps:**

1. **Release Manager** opens the deployment window and authorizes the **DevOps Engineer** to proceed.

2. **DevOps Engineer** executes the deployment using the standard deployment sequence:
   - Run pre-deployment health check on current production
   - Deploy the release candidate
   - Monitor deployment progress for errors
   - Run post-deployment smoke test (core user flows)
   - Confirm deployment completed without errors

3. **DevOps Engineer** reports deployment status to the **Release Manager** in real time. If the deployment encounters an error at any step, the DevOps Engineer stops and escalates to the Release Manager immediately — they do not attempt to continue or self-resolve silently.

4. **Release Manager** monitors deployment status. At any point during deployment, the Release Manager may:
   - **Hold:** Pause deployment if something unexpected is observed (requires DevOps execution)
   - **Abort and rollback:** Initiate rollback if deployment cannot proceed safely (see SOP-006: Rollback)
   - **Proceed:** Continue deployment when each step completes successfully

5. **Monitoring Engineer** observes production health signals from the moment deployment begins, watching for anomalies in the metrics established for the release scope.

6. When post-deployment smoke tests pass and the Monitoring Engineer confirms no anomalies in the initial observation window:
   - **DevOps Engineer** declares deployment complete
   - **Release Manager** confirms deployment success

7. When post-deployment smoke tests fail or the Monitoring Engineer observes anomalies:
   - **Release Manager** assesses severity
   - For P0/P1 severity: initiate rollback immediately per SOP-006 (Rollback); escalate to CTO and CEO
   - For P2/P3 severity: assess whether to hold, monitor, or rollback; escalate to CTO if uncertain

**Gate 4:** Deployment complete. Post-deployment smoke tests passed. No critical anomalies observed in initial monitoring window.

---

### Phase 5: Post-Deployment

**Owner:** Release Manager  
**Input:** Successful deployment  
**Output:** Changelog published; monitoring handoff completed; release record closed  

**Steps:**

1. **Release Manager** authorizes changelog publication. The **Technical Writer** publishes the changelog to all appropriate channels.

2. **Release Manager** coordinates the monitoring handoff with the **Monitoring Engineer**:
   - Monitoring Engineer confirms which signals are being observed for this release
   - Monitoring Engineer confirms the alert thresholds set for the post-release window
   - Monitoring Engineer and Release Manager agree on the observation window duration (typically 24 hours for significant releases, 4 hours for minor releases)
   - Monitoring Engineer confirms they are the active owner of post-release health observation for the agreed window

3. **Release Manager** closes the release record with:
   - Release scope (what shipped)
   - Release window (start and end times)
   - QA recommendation on file
   - Checklist completion status
   - Deployment execution summary
   - Any issues encountered and how they were resolved
   - Monitoring handoff confirmation
   - Changelog publication confirmation

4. **Release Manager** marks all work items in the release scope as completed in Linear.

5. **Release Manager** confirms with the **Technical Writer** that all documentation updates tied to this release are published and linked from the release record.

**Gate 5:** Changelog published. Monitoring handoff complete. Release record closed. Work items completed in Linear.

---

### Phase 6: Post-Release Monitoring Window

**Owner:** Monitoring Engineer  
**Input:** Released production system; alert configuration for release scope  
**Output:** Monitoring window closed or escalation triggered  

**Steps:**

1. **Monitoring Engineer** actively observes production health for the agreed observation window.

2. During the observation window, the Monitoring Engineer watches for:
   - Elevated error rates in the release scope
   - Latency degradation in affected services
   - Availability anomalies
   - Business-critical metric changes (conversion rates, completion rates, signal drops)
   - User-facing errors reported through any channel

3. When anomalies are observed:
   - Monitoring Engineer classifies the severity (P0/P1/P2/P3 per the Monitoring Engineer handbook)
   - P0/P1: Escalate to Release Manager, CTO, and CEO immediately; initiate SOP-007 (Production Incident) and assess rollback
   - P2: Notify Release Manager and Tech Lead; assess whether observation is sufficient or escalation required
   - P3: Document and notify Release Manager; no immediate escalation required

4. At the end of the observation window with no anomalies:
   - Monitoring Engineer closes the post-release observation period
   - Monitoring Engineer notifies the Release Manager that the window closed cleanly
   - Monitoring reverts to standard production monitoring cadence

5. When the observation window reveals a persistent issue that does not trigger immediate rollback:
   - Monitoring Engineer and Release Manager document the issue
   - Tech Lead creates a work item for the resolution
   - Resolution is prioritized in the next sprint

**Gate 6:** Monitoring observation window closed. No unresolved P0/P1 issues.

---

## Changelog Standard

Every release has a changelog entry. The changelog is the record of what changed and why — for users, for the team, and for future reference.

**Required elements:**

| Element | Content |
|---|---|
| Release date | The date the release was deployed to production |
| Release scope | What was included (features, bug fixes, improvements) |
| User-visible changes | What users will notice or experience differently |
| Bug fixes | Defects resolved, without technical detail |
| Breaking changes | Any change that alters existing behavior users rely on |
| Known issues | Any known issues shipped with this release (with mitigations if applicable) |
| Internal reference | Link to the release record in Linear |

**What the changelog is not:**
- A technical implementation log
- A list of commit messages
- A developer-focused summary of architectural decisions

The changelog is a user-facing document first. Technical detail belongs in the release record, not the changelog.

**Owner:** Technical Writer (authorship); Release Manager (approval); Technical Writer (publication).

---

## Release Delay Rules

A release is delayed when any of the following is true:

| Condition | Who decides | Authority required |
|---|---|---|
| QA recommendation is No-Go | Release Manager delays automatically | CTO required to override and proceed |
| Blocking checklist item cannot be resolved before the window | Release Manager | Release Manager authority |
| Critical defect found after the window opens but before Gate 4 | Release Manager | CTO if delay is significant |
| Deployment encounters an unresolvable error | Release Manager | CTO for extended delay |
| Post-deployment P0/P1 anomaly observed | Release Manager initiates rollback | CTO and CEO notified immediately |
| On-call coverage is not confirmed | Release Manager delays | Release Manager authority |

Delays are documented in the release record. A release delayed for a valid reason is not a failure — it is the system working as intended.

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| QA No-Go and team wants to proceed | CTO | Before any override decision is made |
| Deployment error that blocks completion | CTO, Tech Lead | Immediately on discovery |
| Post-deployment P0/P1 anomaly | CTO and CEO | Within 5 minutes of classification |
| Rollback decision required | CTO | When Release Manager is uncertain about rollback/hold decision |
| Release delay extends beyond one sprint | CTO, CEO | When delay crosses sprint boundary |
| Significant user-visible change was not communicated to CEO before deployment | CTO | Immediately after deployment |
| Changelog cannot be published due to documentation issues | Technical Writer, CTO | When documentation is not ready at deployment completion |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Release Readiness Checklist | Release Manager | Phase 1 |
| Pre-deployment notification record | Release Manager | Phase 3 |
| Deployment execution log | DevOps Engineer | Phase 4 |
| Post-deployment smoke test results | DevOps Engineer | Phase 4 |
| Release record | Release Manager | Phase 5 |
| Changelog | Technical Writer | Phase 5 |
| Post-release monitoring report | Monitoring Engineer | Phase 6 |

---

## Definition of Done

A release is done when all of the following are true:

- [ ] Release Readiness Checklist is complete with all items confirmed
- [ ] QA go recommendation is on file (or CTO-authorized override is documented)
- [ ] Deployment is complete and smoke tests passed
- [ ] Post-deployment monitoring window is open and Monitoring Engineer is on watch
- [ ] Changelog is published
- [ ] All work items in the release scope are marked complete in Linear
- [ ] Release record is written and closed
- [ ] Documentation updates are published
- [ ] Post-release monitoring window closed cleanly (or incident response is in progress)

---

## Memory Updates

After each release:

| Record | Content | Owner |
|---|---|---|
| Release record | Full release scope, checklist, deployment log, QA recommendation, changelog, monitoring handoff | Release Manager |
| Changelog | Published record of what changed for this release | Technical Writer |
| Linear work items | Marked complete with release reference | Release Manager |
| Monitoring post-release report | What was observed, any anomalies, window close status | Monitoring Engineer |
| Incident records (if applicable) | Any issues encountered during or after deployment | Monitoring Engineer / Release Manager |
| Process notes | Any checklist items that were consistently problematic, improvements for next release | Release Manager |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Release Readiness Checklist completion rate | 100% — every release completes the checklist before deployment | Release records |
| QA recommendation on file | 100% — every release has a written QA recommendation | Release records |
| Post-release P0/P1 incident rate | <5% of releases | Incident records |
| Changelog publication within 1 hour of deployment | >95% | Release records |
| Monitoring handoff completion | 100% — every release has a confirmed Monitoring Engineer handoff | Release records |
| Release scope accuracy | Tracked — scope that shipped vs. scope that was planned | Release records |
| On-call coverage confirmation before deployment | 100% | Release records |

---

## Failure Modes

### Release proceeds without a completed checklist
The Release Manager skips checklist items because the team is confident in the release, the window is tight, or the items seem redundant for a "simple" release. A defect that the checklist would have caught ships to production. Caught when: a post-release incident is traced to an item that was on the checklist but not verified.

**Response:** The checklist is completed for every release regardless of release size or team confidence. There is no category of release small enough to skip the checklist. A Release Manager who approves proceeding without a completed checklist is accepting untracked risk on behalf of the organization. If an item cannot be completed, the release is delayed — not the checklist item skipped.

### QA No-Go overridden without CTO documentation
The team is under deadline pressure. The QA Engineer issues a No-Go. The Release Manager or Tech Lead verbally agrees with the engineers that the defects are minor and proceeds. No CTO involvement. No documentation. The release ships. The defects surface in production. The QA recommendation is in the record but the override is not. Caught when: the post-release incident review cannot establish that the override was authorized.

**Response:** A QA No-Go stops the release. The only path forward is a CTO decision, documented in the release record alongside the QA recommendation. "The team felt the risk was acceptable" is not a documented CTO decision. The Release Manager's authority does not extend to overriding QA without CTO involvement.

### Deployment occurs outside the confirmed window
The DevOps Engineer deploys before the Release Manager has confirmed the window is open, or the deployment is authorized verbally and not tracked. The on-call engineers were not yet confirmed. The Monitoring Engineer is not observing. A deployment issue occurs and the response is slower because the team was not in position. Caught when: the deployment log shows a start time before the authorized window.

**Response:** Deployments begin only on explicit Release Manager authorization after Gate 3 confirms on-call coverage and monitoring readiness. The DevOps Engineer does not self-authorize a deployment based on a general expectation that the release is happening. Authorization is specific, timely, and tracked in the release record.

### Monitoring handoff not confirmed before Release Manager closes the record
The Release Manager completes the release record and marks work items done before the Monitoring Engineer confirms the post-release observation window is open. The Monitoring Engineer is not actively watching the metrics. A P2 anomaly emerges and the Release Manager considers the release closed. By the time it's identified and escalated, the anomaly has affected more users than a faster response would have. Caught when: the post-release review shows the monitoring handoff was assumed rather than confirmed.

**Response:** Gate 5 is not passed until the Release Manager has explicit confirmation from the Monitoring Engineer that the post-release window is open, the alert thresholds are set, and they are actively observing. The release record is not closed before this confirmation is received.

### Changelog published with technical content instead of user-facing content
The Technical Writer publishes a changelog that lists commit messages, internal ticket IDs, or implementation details rather than what users will experience. Users and stakeholders who read the changelog cannot understand what changed. Caught when: a user or stakeholder asks what changed and is told to read the changelog, and the changelog does not answer the question.

**Response:** The changelog standard is enforced at authorship and at Release Manager approval. The test is simple: would a user reading the changelog understand what changed without knowing the internal implementation? If not, the changelog is not ready. Technical detail belongs in the release record.

---

## Anti-Patterns

**The "low-risk" release that skips the checklist.** There is no such thing as a low-risk release that is exempt from the Release Readiness Checklist. Every release changes production. The checklist is not calibrated to risk level — it exists because production is always high stakes. The judgment that a release is "low risk" has been wrong often enough that it cannot be the basis for skipping process.

**Verbal authorization substituting for written confirmation.** A Release Manager who authorizes a deployment verbally and a DevOps Engineer who deploys on the strength of a message that says "looks good, go ahead" have removed traceability from the most consequential action in the delivery process. All authorizations are explicit, written, and traceable in the release record.

**On-call coverage assumed rather than confirmed.** Engineers who are "available" in a general sense are not the same as engineers who have been named as on-call, know they are on-call, know the deployment window, and know the escalation path. On-call for a release is a specific confirmed commitment, not a general assumption that someone will be around.

**Changelog as an afterthought.** A changelog written in the hour after deployment, by whoever is available, to satisfy the checklist item, is not a changelog — it is a retroactive artifact. The changelog is authored before deployment, reviewed by the Technical Writer and Release Manager, and ready to publish the moment the deployment succeeds. Users and stakeholders should be able to read it immediately.

**Release Manager as a passive coordinator.** The Release Manager is not a meeting facilitator or a status-updater. They are the single accountable owner of what ships. That means they read the QA recommendation, understand the defects, confirm the checklist items personally, authorize the deployment, monitor deployment progress, and own the post-release communication. If the Release Manager cannot describe what is in the release, they are not ready to release it.
