# SOP: Rollback

**SOP ID:** SOP-006  
**Category:** Standard Operating Procedure  
**Owner:** Release Manager  
**Version:** 1.0  

---

## Purpose

A rollback is the deliberate reversal of a production deployment. It is the fastest path from a broken production state to a known-good state. The goal of a rollback is not to fix the problem — it is to remove the harm while the problem is being diagnosed and fixed.

Engineering OS treats rollback as a normal operational capability, not a failure or an emergency measure of last resort. A rollback that prevents users from experiencing a broken product is the correct decision. Hesitating to rollback because it feels like admitting failure is a failure of a different kind.

This procedure defines when rollback is required, who decides, who executes, and what happens after the system is restored. It also defines when rollback is not the right response and a forward-fix is appropriate instead.

---

## Trigger

This procedure is triggered when:

- The Monitoring Engineer identifies production anomalies following a deployment that are classified P0 or P1
- The Release Manager or CTO determines that a deployed release must be reversed during or after the deployment window
- A security vulnerability introduced by a deployment is identified and requires immediate reversal
- QA or any engineer identifies critical defect behavior in production that was not caught before deployment
- The Release Manager initiates rollback as part of an aborted deployment in SOP-005 (Release)

---

## Owner

**Release Manager** — owns the rollback decision and the rollback communication. The Release Manager authorizes rollback and coordinates the response.

**DevOps Engineer** — owns rollback execution. Once the Release Manager authorizes rollback, the DevOps Engineer executes it without waiting for further approval.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Release Manager** | Rollback decision authority; communication to stakeholders; post-rollback coordination |
| **DevOps Engineer** | Rollback execution; production environment restoration; health confirmation |
| **Monitoring Engineer** | Production health observation; classification of anomalies that trigger rollback; post-rollback health confirmation |
| **QA Engineer** | Post-rollback validation; confirms the prior-version behavior is restored |
| **Security Engineer** | Involved when the rollback trigger is a security issue; advises on whether rollback is sufficient |
| **Tech Lead** | Technical assessment of rollback vs. forward-fix; post-rollback root cause coordination |
| **CTO** | Notified for all P0/P1 rollbacks; authorizes decisions that exceed Release Manager authority; receives post-rollback review |
| **CEO** | Notified for P0 rollbacks and any rollback affecting significant user experience |

---

## Rollback Decision Framework

Before initiating rollback, the Release Manager assesses the situation against the rollback decision criteria. This assessment happens fast — the goal is a decision in minutes, not a committee discussion.

### When to rollback immediately (no further assessment needed)

These conditions require rollback without deliberation:

| Condition | Rationale |
|---|---|
| P0 production anomaly traced to the current deployment | Service is down or critically impaired for users; every minute matters |
| Security vulnerability introduced by the deployment | A known security hole in production cannot wait for a forward fix to be written, reviewed, and deployed |
| Data integrity issue introduced by the deployment | Data corruption risk escalates with time; stopping further writes to corrupted paths is urgent |
| Deployment itself did not complete successfully and the system is in a partially deployed state | A half-deployed system is an undefined state; rollback restores a known-good baseline |

### When to assess rollback vs. forward-fix

These conditions require the Release Manager to make a judgment call, with Tech Lead and CTO input available:

| Condition | Consider Rollback If | Consider Forward-Fix If |
|---|---|---|
| P1 anomaly traced to the deployment | Impact is broad, growing, or unclear | Impact is narrow, stable, and the fix is known and fast |
| Defect in a new feature (not core flows) | The defect affects many users or cannot be isolated | The defect can be mitigated (feature flag, graceful degradation) without rollback |
| High severity defect found post-deployment | The fix requires significant code changes and review time | The fix is small, low-risk, and can be reviewed and deployed within the hour |
| Performance degradation introduced by deployment | Degradation is user-visible and worsening | Degradation is minor and a targeted fix is in progress |

**Default position: when uncertain, rollback.** A rollback that turns out to have been unnecessary is recoverable. A decision to hold and forward-fix that turns out to have been wrong extends user harm. The asymmetry favors rollback.

### When rollback is not appropriate

| Condition | Reason |
|---|---|
| The deployment included a database migration that cannot be safely reversed | Rollback of application code without rollback of the migration may leave the system in an inconsistent state. Assess with Tech Lead and CTO before proceeding. A forward-fix or migration-specific rollback plan is required. |
| The deployment activated a feature that users have already interacted with in ways that cannot be reversed | Rolling back the feature may produce a worse user experience than the defect. Assess the scope of interaction and the nature of the defect. |
| The anomaly is not traced to the current deployment | Rolling back a working deployment does not address the root cause. Confirm the causal link before initiating rollback. |

When rollback is not appropriate and the situation is P0/P1, escalate to CTO immediately for an alternate response path.

---

## Procedure

### Phase 1: Detection and Decision

**Owner:** Monitoring Engineer (detection); Release Manager (decision)  
**Input:** Production anomaly; deployment status  
**Output:** Rollback authorized or hold decision made with rationale  

**Steps:**

1. **Monitoring Engineer** identifies a production anomaly and classifies it per the severity model in the Monitoring Engineer handbook:
   - P0: Complete service outage or critical data integrity issue
   - P1: Severe degradation of core flows or significant user-facing failure

2. **Monitoring Engineer** confirms or establishes the causal link to the current deployment:
   - When did the anomaly begin relative to the deployment?
   - Are the affected services or flows those that were changed in the deployment?
   - Is the anomaly consistent with the nature of the changes deployed?

3. **Monitoring Engineer** notifies the **Release Manager** immediately with:
   - Severity classification
   - What is observed (specific metrics, error rates, affected flows)
   - Whether the anomaly is traced to the current deployment
   - Whether the anomaly is worsening, stable, or improving

4. **Release Manager** makes the rollback decision within 5 minutes of notification for P0/P1 conditions:
   - Apply the Rollback Decision Framework above
   - Consult the Tech Lead if uncertain about forward-fix feasibility
   - Escalate to CTO for decisions that exceed Release Manager authority (database migrations, data integrity, non-obvious causal link)

5. **Release Manager** communicates the decision:
   - To rollback: authorizes the DevOps Engineer to begin immediately
   - To hold and forward-fix: documents the decision, the rationale, and the fix timeline; keeps the Monitoring Engineer and CTO informed

6. **Release Manager** notifies:
   - CTO: immediately for P0/P1 rollback decisions
   - CEO: immediately for P0 rollback; within 15 minutes for P1 rollback with significant user impact

**Gate 1:** Rollback decision is made and communicated. For rollback: DevOps Engineer is authorized to execute. For hold: decision, rationale, and fix timeline are documented.

---

### Phase 2: Rollback Execution

**Owner:** DevOps Engineer  
**Input:** Release Manager authorization; rollback target (prior known-good version)  
**Output:** Prior version deployed; production restored to known-good state  

**Steps:**

1. **DevOps Engineer** confirms the rollback target: the specific prior version of the application that was running before the current deployment. This is not a guess — the deployment record contains the prior version reference.

2. **DevOps Engineer** executes the rollback. The execution sequence is environment-specific but must cover:
   - Redeploy the prior known-good application version
   - Confirm the prior version is active in production
   - Run post-rollback smoke tests (core user flows)
   - Confirm no further deployment anomalies were introduced by the rollback itself

3. **DevOps Engineer** reports rollback status to the **Release Manager** continuously during execution. If the rollback encounters an error:
   - DevOps Engineer stops and escalates to Release Manager and Tech Lead immediately
   - Does not attempt to self-resolve without visibility
   - CTO is notified if the rollback itself cannot complete successfully

4. **Monitoring Engineer** observes production health throughout rollback execution, watching for:
   - The anomaly clearing as the prior version comes online
   - New anomalies introduced by the rollback
   - Health signal returning toward the pre-deployment baseline

5. When rollback completes and smoke tests pass:
   - **DevOps Engineer** declares rollback execution complete
   - **Monitoring Engineer** confirms initial health signal restoration
   - **Release Manager** is notified that production is restored

**Gate 2:** Prior version deployed. Post-rollback smoke tests passed. Monitoring Engineer confirms health signal improving or restored.

---

### Phase 3: Post-Rollback Validation

**Owner:** QA Engineer  
**Input:** Rolled-back production environment  
**Output:** Confirmation that prior-version behavior is restored  

**Steps:**

1. **QA Engineer** performs targeted validation of the core user flows affected by the original deployment issue. The scope of validation is:
   - The flows that were impaired by the anomaly that triggered rollback
   - The core product flows that must always function
   - Any flows that the rollback execution itself could have affected

2. **QA Engineer** confirms that the behavior matches the known-good prior-version behavior — not just that the anomaly is gone, but that the system behaves as it did before the deployment.

3. **QA Engineer** delivers a written post-rollback validation result to the Release Manager:
   - Pass: prior-version behavior is confirmed restored
   - Fail with specific observations: the rollback resolved the original anomaly but introduced a different issue, or the rollback itself did not fully restore expected behavior

4. When post-rollback validation fails:
   - **QA Engineer** escalates to Release Manager, Tech Lead, and CTO immediately
   - The system is in an unexpected state; further action is required
   - This is treated as a P0 production incident per SOP-007 (Production Incident) regardless of whether the original anomaly is resolved

5. When post-rollback validation passes:
   - **Release Manager** receives confirmation and proceeds to stakeholder communication

**Gate 3:** QA post-rollback validation complete. Prior-version behavior confirmed.

---

### Phase 4: Stakeholder Communication

**Owner:** Release Manager  
**Input:** Rollback confirmed; post-rollback validation passed  
**Output:** All stakeholders informed; changelog and release record updated  

**Steps:**

1. **Release Manager** communicates the outcome to all stakeholders who were notified at deployment:
   - What happened: the deployed release was rolled back
   - Current state: production is restored to the prior version
   - What users experienced: honest description of impact and duration
   - Next steps: how and when the issue will be resolved and re-released

2. **Release Manager** updates the release record:
   - Rollback decision: who made it, when, and based on what observations
   - Rollback execution: when it started, when it completed
   - Post-rollback validation result
   - Stakeholder notification log

3. **Technical Writer** updates the changelog to reflect that the release was rolled back:
   - The rolled-back items are removed from the "released" state in the changelog
   - A note is added that the release was reversed and will be re-released after the issue is resolved

4. **Release Manager** confirms that the rolled-back work items in Linear are returned to an appropriate pre-release status, not marked complete.

5. For rollbacks triggered by a security issue: the **Security Engineer** advises on any additional communication required (disclosure, user notification, regulatory notification) before Release Manager and CTO determine the communication approach.

**Gate 4:** All stakeholders informed. Release record updated with rollback details. Changelog updated. Linear work items returned to pre-release status.

---

### Phase 5: Root Cause and Re-Release Planning

**Owner:** Tech Lead  
**Input:** Rollback complete; production stable  
**Output:** Root cause identified; re-release plan documented  

**Steps:**

1. **Tech Lead** leads the root cause analysis. The root cause analysis answers:
   - What specifically caused the production anomaly?
   - Where did the prevention chain fail: code, review, QA validation, or monitoring?
   - Was the defect introduced in this release, or was it a pre-existing condition that the release exposed?
   - What would have prevented this rollback?

2. **Tech Lead** produces a written root cause summary within 48 hours of the rollback. The summary is not a post-mortem — it is the technical foundation for the fix and for improving the prevention chain.

3. **Tech Lead** creates work items for:
   - The fix for the specific defect that caused the rollback
   - Any process improvements identified in the root cause analysis
   - Any test coverage gaps that allowed the defect to pass QA validation

4. **Release Manager** and **Tech Lead** determine the re-release timeline:
   - What work is required before the rolled-back items can be re-released?
   - What additional QA validation or review is required for the re-release?
   - Is a separate hotfix release needed for anything that was in the rollback scope and is now missing from production?

5. **Release Manager** communicates the re-release plan to the CTO and, where the rolled-back items had visible user impact, to the CEO.

**Gate 5:** Root cause analysis written. Re-release work items created. Re-release plan communicated.

---

### Phase 6: Post-Rollback Review

**Owner:** Release Manager  
**Input:** Root cause analysis; rollback record  
**Output:** Process improvements documented; review findings shared with team  

**Steps:**

1. **Release Manager** conducts a post-rollback review within one week. Participants: Release Manager, Tech Lead, QA Engineer, DevOps Engineer, Monitoring Engineer, and any engineer whose work was in the rollback scope.

2. The review examines:
   - **Detection:** How was the anomaly detected? How quickly? What would have detected it faster?
   - **Decision:** How quickly was the rollback decision made? Was the decision framework applied correctly? Were there delays? Why?
   - **Execution:** How quickly did the rollback execute? Were there obstacles? What would make the next rollback faster?
   - **Prevention:** What in the process allowed the defect to reach production? What change would prevent recurrence?
   - **Communication:** Was communication timely and accurate? Who needed to know earlier?

3. **Release Manager** writes the post-rollback review findings and circulates them to all participants and to the CTO.

4. Any process improvement identified in the review that affects a standing SOP is escalated to the document owner for update. Findings that identify recurring patterns across multiple rollbacks are escalated to the CTO for systemic response.

5. The post-rollback review findings are retained in the organizational knowledge system, linked from the rollback record, so that future rollback reviews can reference patterns.

**Gate 6:** Post-rollback review conducted. Findings written. Process improvements documented and routed to owners.

---

## Rollback Time Standards

Engineering OS targets the following time standards for rollback:

| Stage | Target | Rationale |
|---|---|---|
| Anomaly detection to Release Manager notification | < 5 minutes | Monitoring Engineer must notify without waiting to be "sure" |
| Release Manager notification to rollback decision | < 5 minutes (P0/P1) | P0/P1 anomalies require a fast decision, not a perfect one |
| Rollback authorization to rollback execution start | < 2 minutes | DevOps Engineer should be ready and execute immediately on authorization |
| Rollback execution start to prior version live | < 15 minutes | Deployment infrastructure must support this; longer means production remains impaired |
| Root cause analysis delivery | < 48 hours | Analysis must be timely to support learning and re-release planning |
| Post-rollback review | < 7 days | Findings are most useful when the event is recent |

These are targets, not guarantees. When a rollback takes longer than these targets, the time standard breach is noted in the post-rollback review and the root cause is identified.

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| Rollback decision involves a database migration | CTO, Tech Lead | Before rollback execution begins |
| Rollback execution fails or cannot complete | CTO, Tech Lead | Immediately on discovery |
| Post-rollback validation fails | CTO, Tech Lead | Immediately on QA finding |
| Security issue triggered rollback | Security Engineer, CTO | At rollback decision; additional communication path may apply |
| P0 rollback | CTO, CEO | At rollback decision |
| P1 rollback with significant user impact | CTO, CEO | At rollback decision |
| Root cause analysis cannot identify a clear cause | CTO | Within 48 hours; additional investigation required |
| Post-rollback review identifies systemic process failure | CTO | At review findings delivery |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Rollback decision record | Release Manager | Phase 1 |
| Rollback execution log | DevOps Engineer | Phase 2 |
| Post-rollback smoke test results | DevOps Engineer | Phase 2 |
| Post-rollback validation result | QA Engineer | Phase 3 |
| Stakeholder communication log | Release Manager | Phase 4 |
| Updated release record | Release Manager | Phase 4 |
| Updated changelog | Technical Writer | Phase 4 |
| Root cause analysis | Tech Lead | Phase 5 |
| Re-release plan | Release Manager, Tech Lead | Phase 5 |
| Post-rollback review findings | Release Manager | Phase 6 |

---

## Definition of Done

A rollback is done when all of the following are true:

- [ ] Prior version is deployed and confirmed active in production
- [ ] Post-rollback smoke tests passed
- [ ] Monitoring Engineer confirms health signal restored
- [ ] QA Engineer post-rollback validation passed
- [ ] All stakeholders are notified
- [ ] Release record updated with rollback details
- [ ] Changelog updated to reflect rollback
- [ ] Linear work items returned to pre-release status
- [ ] Root cause analysis written within 48 hours
- [ ] Re-release plan documented and communicated
- [ ] Post-rollback review conducted within 7 days
- [ ] Process improvement work items created

---

## Memory Updates

After each rollback:

| Record | Content | Owner |
|---|---|---|
| Rollback record | Full rollback timeline, decision, execution, validation, communication | Release Manager |
| Root cause analysis | Technical cause, prevention chain failure, fix scope | Tech Lead |
| Post-rollback review | Detection speed, decision speed, execution speed, process findings, improvements | Release Manager |
| Defect records | The specific defect that triggered the rollback, linked to root cause analysis | QA Engineer |
| Process improvement work items | Changes to SOPs, test coverage, monitoring, review standards identified in the review | Tech Lead / Release Manager |
| Rollback pattern log | Running record of rollback causes across releases — used to identify systemic patterns | Release Manager |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Time from anomaly detection to rollback decision | < 10 minutes (P0/P1) | Rollback records |
| Time from rollback authorization to prior version live | < 15 minutes | Rollback execution logs |
| Root cause analysis delivery within 48 hours | 100% | Rollback records |
| Post-rollback review conducted within 7 days | 100% | Review records |
| Post-rollback process improvements routed to SOP owners | 100% of reviews that identify improvements | Review findings |
| Rollback frequency per release | Tracked; threshold for systemic review is >10% of releases | Release and rollback records |
| Re-release success rate | Tracked — rolled-back items that release successfully on re-release without a second rollback | Release records |

---

## Failure Modes

### Rollback delayed because no one wants to call it
A P1 anomaly is observed. The team is confident the issue will clear on its own, or that a fast forward-fix is imminent. The Release Manager, Tech Lead, and engineers discuss options while the anomaly continues affecting users. The forward-fix takes longer than expected. The rollback decision, when finally made, could have been made 30 minutes earlier. Caught when: the post-rollback review shows that the rollback decision was delayed relative to the anomaly onset without a documented rationale.

**Response:** The default position is rollback when uncertain. The Release Manager has the authority and the responsibility to make this call without consensus from the broader team. A rollback decision made 5 minutes after a P1 anomaly is confirmed is not premature — it is on time. Discussion about whether to rollback is appropriate for the 2 minutes between detection and decision, not for the 30 minutes between detection and mounting user impact.

### Rollback target not confirmed before execution
The DevOps Engineer initiates rollback to "the previous version" without confirming which specific version that is. The deployment record was not checked. The prior version that is deployed is not the known-good version — it may be two versions back, or a staging build, or the wrong service version. The rollback restores a state the team did not intend. Caught when: post-rollback behavior does not match the expected prior-version behavior and QA validation fails.

**Response:** The rollback target is confirmed from the deployment record before execution begins. "Previous version" is not a rollback target — a specific, named, confirmed version reference is the rollback target. This takes 60 seconds; skipping it risks deploying an unintended state.

### Post-rollback validation skipped to save time
The Release Manager receives the DevOps Engineer's confirmation that the rollback completed and the smoke tests passed. The team is relieved and moves to communication. The QA Engineer's post-rollback validation is not performed because "the smoke tests are enough" and "we're back on the previous version so we know it works." A secondary issue in the rollback is not detected. Caught when: a user reports unexpected behavior after the rollback that post-rollback validation would have caught.

**Response:** Gate 3 is not passed without QA validation. Smoke tests confirm that the deployment executed; QA validation confirms that the behavior is as expected. These are different checks. A prior version that was known-good before the deployment may have a context or environment interaction that the rollback reintroduces differently. QA validation is not optional.

### Root cause analysis not delivered within 48 hours
The rollback is complete, the team is relieved, and there is a sprint of work waiting. The root cause analysis is started but deprioritized as other work takes over. Forty-eight hours pass, then a week. The analysis is never finished. The re-release is planned without a confirmed root cause. The same defect ships in the re-release. Caught when: the re-release triggers another rollback for the same reason.

**Response:** The root cause analysis has a 48-hour deadline and a named owner (Tech Lead). The Release Manager tracks completion. A re-release is not planned until the root cause analysis is complete — the re-release plan depends on understanding what needs to be fixed. "We fixed the symptom" is not a root cause analysis.

### Post-rollback review not conducted
The rollback record is complete, the re-release was successful, and the team has moved on. The post-rollback review was scheduled but not prioritized. The findings that would have improved detection speed, rollback speed, or test coverage were never surfaced. The next rollback encounter takes just as long as this one. Caught when: the next rollback review notes that the same bottleneck occurred again.

**Response:** The post-rollback review is a mandatory step with a 7-day deadline. It is not a retrospective or a blame session — it is an operational learning that makes the next rollback faster and less likely. When a rollback review is skipped, the organization accepts that rollbacks will not improve. The Release Manager owns scheduling and completion; the CTO receives the findings.

---

## Anti-Patterns

**Treating rollback as a last resort.** A rollback is not an admission of failure — it is the designed response to a deployment that causes production harm. Teams that treat rollback as a last resort delay the decision while the harm continues, accumulate more user impact, and ultimately arrive at the same rollback. The deployment pipeline exists to make rollback fast and safe. Use it.

**Rollback without understanding the target.** Deploying "the previous version" without confirming what that version is, what database schema it expects, and whether it is compatible with the current production state is not a rollback — it is a second deployment of unknown quality. Rollbacks must be as deliberate as deployments.

**Forward-fixing a security vulnerability.** A security vulnerability in production is not a forward-fix candidate. It is a rollback trigger. The time required to write a patch, get it reviewed, validated, and deployed is time during which a known vulnerability is live. Rollback removes the vulnerability immediately; the patch follows as a new, clean release.

**Rollback with no post-mortem because it "resolved itself."** When the rolled-back version performs well, there is a temptation to close the record and move forward. Every rollback — including those where the re-release succeeds immediately — has a root cause and a process finding. "It resolved itself" means "we don't know why it happened, so we have no basis for preventing it next time." The review is not optional because the outcome was good.

**Skipping rollback because the fix is almost ready.** "The engineer is 30 minutes away from a fix" is not a reason to delay rollback when production is impaired. The fix estimate is an estimate. Users who are experiencing a broken product right now are not experiencing it approximately. When rollback is the right call, the fix timeline is irrelevant — rollback, then ship the fix as a new clean release.
