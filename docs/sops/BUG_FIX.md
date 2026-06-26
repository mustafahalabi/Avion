# SOP: Bug Fix

**SOP ID:** SOP-002  
**Category:** Standard Operating Procedure  
**Owner:** Tech Lead  
**Version:** 1.0  

---

## Purpose

This procedure defines how Engineering OS handles a defect from the moment it is reported to the moment it is confirmed resolved in production and the learning is recorded. A bug fix is not complete when the code is merged — it is complete when the fix is validated in production, the root cause is understood, and any changes required to prevent recurrence are on record.

Defects that are fixed silently, without root cause analysis or regression coverage, are defects that will recur. This procedure ensures that every defect that enters the system exits with a fix, a record, and a learning.

---

## Trigger

This procedure is triggered when:

- A defect is reported by a user, customer, or internal team member
- A defect is discovered by the QA Engineer during testing
- A monitoring signal indicates a defect in production (routing from the Monitoring Engineer)
- A Reviewer or engineer discovers a defect during code review or development

---

## Owner

**Tech Lead** — owns the procedure from intake through release. The Tech Lead classifies the defect, assigns the fix, confirms delivery readiness, and ensures the defect record is closed correctly after production validation.

---

## Participants

| Role | Phase(s) |
|---|---|
| **Tech Lead** | Classification; assignment; delivery readiness; escalation |
| **Product Manager** | Notified of High and Critical defects; provides user impact context when needed |
| **Backend Engineer** | Fix (backend defects) |
| **Frontend Engineer** | Fix (frontend defects) |
| **AI Engineer** | Fix (AI behavior defects) |
| **Infrastructure Engineer** | Fix (infrastructure or environment defects) |
| **Reviewer** | Code review of the fix |
| **Security Engineer** | Security assessment for defects with security implications |
| **QA Engineer** | Defect reproduction confirmation; fix validation; regression |
| **Release Manager** | Release coordination for non-hotfix fixes; hotfix deployment coordination |
| **DevOps Engineer** | Deployment (standard and hotfix) |
| **Monitoring Engineer** | Production signal confirmation post-fix; detection of defects from monitoring |
| **CTO** | Escalation for Critical defects; override authority |

---

## Severity Classification

Every defect is classified before it is assigned. Severity determines the response timeline and the required steps.

| Severity | Definition | Response Target | Release Path |
|---|---|---|---|
| **Critical** | Data loss, security exposure, complete inability to use a core flow, or production outage affecting all or most users | Immediate — fix begins within 2 hours of classification | Hotfix — released outside the normal release cycle |
| **High** | Significant user-facing defect in a core flow; workarounds may exist but are inadequate; no data loss or security exposure | Same business day | Hotfix or next planned release, depending on CTO decision |
| **Medium** | User-facing defect in a non-critical flow; workaround exists; limited user impact | Within the current or next sprint | Next planned release |
| **Low** | Minor defect; cosmetic issue; minimal user impact; workaround is straightforward | Next available sprint slot | Next planned release |

The Tech Lead assigns the severity classification. When there is ambiguity between Critical and High, classify as Critical until there is sufficient evidence to downgrade.

---

## Preconditions

Before this procedure begins:

- [ ] The defect has been reported through the standard intake channel
- [ ] The Tech Lead has been notified

---

## Procedure

### Phase 1: Intake and Classification

**Owner:** Tech Lead  
**Input:** Defect report (from any source)  
**Output:** Classified defect record with assigned severity, assigned owner, and reproduction steps  

**Steps:**

1. **Tech Lead** receives the defect report and creates a defect record containing:
   - Title: a specific, one-line description of what is wrong
   - Severity: Critical, High, Medium, or Low (per the classification table)
   - Reporter: who reported it and through what channel
   - Affected area: which feature, API, or flow is affected
   - Observed behavior: what is actually happening
   - Expected behavior: what should happen instead
   - Reproduction steps (if available from the reporter)
   - Environment: where the defect was observed (production, staging, browser, OS version, etc.)

2. **Tech Lead** assesses whether the defect has security implications. If it does, the Security Engineer is notified immediately and in parallel with the fix assignment.

3. **Tech Lead** notifies the Product Manager for High and Critical defects.

4. **Tech Lead** assigns the defect to the appropriate engineer based on the affected area.

5. **Tech Lead** sets the expected fix timeline based on severity.

**Gate 1:** Defect is classified with severity, assigned, and has a defect record. For Critical defects: CTO is notified.

---

### Phase 2: Reproduction

**Owner:** Assigned engineer (with QA Engineer support)  
**Input:** Defect record with reproduction steps  
**Output:** Confirmed reproduction; root cause hypothesis  

**Steps:**

1. **Assigned engineer** attempts to reproduce the defect using the steps in the defect record.

2. If the defect cannot be reproduced:
   - The engineer documents the reproduction attempt and the environment conditions
   - The QA Engineer is asked to attempt reproduction independently
   - If neither can reproduce after a genuine attempt, the defect is reclassified as "Cannot Reproduce" with documentation and escalated to the Tech Lead for disposition

3. When the defect is confirmed reproduced:
   - The engineer documents the exact reproduction steps, environment, and any conditions required
   - The engineer develops a root cause hypothesis (what in the code or configuration is causing the behavior)
   - For Critical defects: the Tech Lead is notified immediately that reproduction is confirmed

4. **QA Engineer** confirms reproduction independently for Critical and High defects before the fix proceeds. This ensures the fix will be validated against the confirmed reproduction path.

**Gate 2:** Defect is confirmed reproduced. Exact reproduction steps are documented. Root cause hypothesis is recorded.

---

### Phase 3: Fix

**Owner:** Assigned engineer  
**Input:** Confirmed reproduction; root cause hypothesis  
**Output:** Fix implemented; fix addresses root cause (not symptom)  

**Steps:**

1. **Assigned engineer** implements the fix targeting the root cause identified in Phase 2.

2. The fix must:
   - Address the root cause, not only the symptom — a fix that masks the defect without addressing the underlying cause is not a fix
   - Not introduce new defects in adjacent code paths
   - Include a regression test that would have caught the defect had it existed before
   - For security defects: satisfy the requirements specified by the Security Engineer

3. **Backend Engineer** (when applicable):
   - If the fix involves a migration, the migration must have a tested rollback path before it runs in production
   - If the fix changes an API behavior, the API contract documentation is updated

4. **Engineer** confirms the fix resolves the defect in their local or staging environment before submitting for review.

5. **Tech Lead** performs Delivery Readiness review before the fix moves to code review. For Critical defects, the review is abbreviated but not skipped.

**Gate 3:** Fix is implemented against root cause. Regression test added. Delivery Readiness confirmed.

---

### Phase 4: Review

**Owner:** Reviewer  
**Input:** Fix submitted for review; defect record  
**Output:** Fix reviewed and approved  

**Steps:**

1. **Reviewer** reviews the fix against:
   - The defect record: does the fix actually address the described defect?
   - The root cause: does the fix address the root cause, or only the symptom?
   - Code quality: does the fix meet the code quality standards?
   - Regression test: is there a test that would catch this defect if it reappeared?
   - Scope: does the fix change more than it needs to? Defect fixes should be scoped tightly.

2. **Security Engineer** reviews fixes for defects with security implications. The fix cannot be approved without Security Engineer clearance for security defects.

3. All Blocking findings are resolved before approval.

4. **Tech Lead** merges approved fix.

**Gate 4:** Fix reviewed and approved. Merged.

---

### Phase 5: Validation

**Owner:** QA Engineer  
**Input:** Fix deployed to staging; confirmed reproduction steps from Phase 2  
**Output:** Fix confirmed resolved; regression testing complete  

**Steps:**

1. **DevOps Engineer** deploys the fix to the staging environment.

2. **QA Engineer** validates the fix using the reproduction steps documented in Phase 2:
   - Confirms the defect no longer occurs
   - Confirms the fix does not introduce new defects in the affected area
   - Confirms the regression test passes

3. **QA Engineer** performs regression testing on areas adjacent to the fix:
   - Shared code paths
   - Features that depend on the fixed component
   - Core user flows that may have been affected

4. If the fix does not resolve the defect as validated:
   - QA Engineer documents the finding
   - Returns to Phase 3 with updated information
   - Fix is not released to production until QA confirms resolution

5. **QA Engineer** issues the validation confirmation in writing.

**Gate 5:** QA has confirmed the fix resolves the defect in staging. Regression testing complete. No new defects introduced.

---

### Phase 6: Release

**Owner:** Release Manager (standard releases); Tech Lead + Release Manager (hotfixes)  

#### Standard release path (Medium and Low severity)

The fix is included in the next planned release and follows the standard release procedure (SOP-007: Release). No separate steps are required beyond ensuring the fix is included in the release scope communicated to the Release Manager.

#### Hotfix path (Critical and some High severity)

**Input:** Validated fix; QA confirmation  
**Output:** Fix deployed to production; production confirmed stable  

**Steps:**

1. **Release Manager** is notified that a hotfix is ready. The notification includes:
   - Defect severity and description
   - What the fix changes
   - QA confirmation of resolution
   - Rollback plan if the hotfix causes a regression

2. **Release Manager** confirms hotfix readiness:
   - Security clearance (if security defect)
   - DevOps deployment readiness
   - Monitoring baseline active

3. **DevOps Engineer** deploys the hotfix to production.

4. **Monitoring Engineer** watches post-deployment signals for the monitoring window. For hotfixes related to production incidents, the monitoring window is extended to confirm the original defect signal has resolved.

5. **Release Manager** confirms production stability and closes the hotfix.

**Gate 6:** Fix is in production. Production signals confirm the defect is resolved. Release record is updated.

---

### Phase 7: Root Cause and Learning

**Owner:** Tech Lead  
**Input:** Resolved defect; production confirmation  
**Output:** Closed defect record with root cause; learning applied  

**Steps:**

1. **Tech Lead** closes the defect record with:
   - Confirmed root cause (what in the code, configuration, or process allowed this defect to exist)
   - Fix description (what was changed and why)
   - Regression test reference (the test that now covers this case)
   - Time from report to production resolution
   - Any process changes that would prevent this class of defect from recurring

2. **Tech Lead** assesses whether the root cause indicates a systemic issue:
   - If this defect represents a class of defects that could exist elsewhere in the codebase, a follow-up task is created to audit similar code paths
   - If this defect was possible because of a missing process step (e.g., a type of test that was not written), the gap is documented and the process is updated

3. **QA Engineer** confirms that the regression test added in Phase 3 is included in the regression suite for future releases.

4. **Monitoring Engineer** confirms (for defects discovered through monitoring) that the signal that detected this defect is correctly tuned and that no adjacent monitoring gap exists.

**Gate 7:** Defect record is closed with root cause and learning. Follow-up work items created for systemic issues.

---

## Decision Gates Summary

| Gate | Condition | Owner |
|---|---|---|
| Gate 1 | Defect classified, assigned, record created | Tech Lead |
| Gate 2 | Defect reproduced, reproduction steps documented | Assigned engineer + QA |
| Gate 3 | Fix implements root cause solution, regression test added, Delivery Readiness confirmed | Tech Lead |
| Gate 4 | Fix reviewed and approved, merged | Reviewer |
| Gate 5 | QA confirms fix resolves defect, regression testing complete | QA Engineer |
| Gate 6 | Fix deployed to production, signals confirm resolution | Release Manager |
| Gate 7 | Defect record closed with root cause and learning | Tech Lead |

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| Critical defect confirmed | CTO, Product Manager | Immediately at Gate 1 |
| Critical defect confirmed as a security exposure | CTO, Security Engineer | Immediately, in parallel |
| Critical defect cannot be reproduced within 2 hours | CTO | 2 hours after classification |
| Critical defect fix is not deployable within the hotfix window | CTO | As soon as the delay is known |
| QA cannot confirm the fix resolves the defect after two fix attempts | CTO, Tech Lead | After second failed fix |
| A defect indicates a systemic issue affecting multiple areas | CTO | When the systemic scope is identified |
| A High defect's classification is disputed (should it be Critical?) | CTO | Immediately on dispute |
| A post-release defect is discovered that a released fix was meant to address | CTO, Release Manager | Immediately |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Defect record | Tech Lead | Phase 1 |
| Reproduction steps (documented) | Assigned engineer | Phase 2 |
| Root cause hypothesis | Assigned engineer | Phase 2 |
| Fix (code change with regression test) | Assigned engineer | Phase 3 |
| Security assessment (when applicable) | Security Engineer | Phase 4 |
| QA validation confirmation | QA Engineer | Phase 5 |
| Hotfix release record | Release Manager | Phase 6 |
| Closed defect record with root cause | Tech Lead | Phase 7 |
| Follow-up work items (systemic issues) | Tech Lead | Phase 7 |

---

## Definition of Done

A bug fix is done when all of the following are true:

- [ ] Defect record exists with: title, severity, reporter, affected area, observed behavior, expected behavior, reproduction steps, and environment
- [ ] Defect is confirmed reproduced with documented steps
- [ ] Root cause is identified and documented
- [ ] Fix addresses the root cause, not only the symptom
- [ ] Regression test is added that would catch this defect if it reappeared
- [ ] Fix is reviewed and approved by the Reviewer
- [ ] Security Engineer has cleared the fix for security defects
- [ ] QA has confirmed the fix resolves the defect in staging
- [ ] Regression testing has passed with no new defects introduced
- [ ] Fix is deployed to production
- [ ] Production signals confirm the defect is no longer occurring
- [ ] Defect record is closed with root cause and learning
- [ ] Systemic issues identified in Phase 7 have follow-up work items created

---

## Memory Updates

After each bug fix is completed, the following memory records are updated:

| Record | Content | Owner |
|---|---|---|
| Defect record | Closed with root cause, fix description, resolution time | Tech Lead |
| Test coverage | Regression test added and confirmed in QA regression suite | QA Engineer |
| Monitoring signals | Signal that detected the defect confirmed as correctly tuned; gaps noted | Monitoring Engineer |
| Process improvement items | Any process gap identified as contributing to the defect | Tech Lead |
| Security pattern library | Any security pattern updated based on findings | Security Engineer (for security defects) |

---

## Response Timelines

| Severity | Classification | Reproduction Confirmed | Fix in Review | QA Validation | Production |
|---|---|---|---|---|---|
| Critical | Within 30 min of report | Within 2 hours | Same day | Same day | Same day (hotfix) |
| High | Within 2 hours of report | Within 4 hours | Same day or next day | Within 24 hours | Hotfix or next planned release |
| Medium | Within 1 business day | Within 1 business day | Current or next sprint | Current or next sprint | Next planned release |
| Low | Within 1 week | Within 1 week | Next available sprint slot | Next available slot | Next planned release |

These timelines are targets. When a target cannot be met, the Tech Lead communicates the revised timeline and the reason — not silently.

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Critical defect time-to-production-fix | Same business day | Defect records |
| Regression test coverage | 100% of closed defects have a regression test | QA audit |
| Defect recurrence rate | <5% — same defect appearing twice within 90 days | Defect records |
| Root cause documentation rate | 100% — every closed defect has a documented root cause | Defect records |
| QA validation before production | 100% — no fix goes to production without QA validation | Release records |
| Post-production defect validation | 100% — monitoring confirms resolution for Critical and High | Monitoring records |

---

## Failure Modes

### Fix addresses symptom, not root cause
An engineer fixes the visible symptom (e.g., adds a null check around the failing code) without understanding why the null value is appearing in the first place. The fix passes review and QA because it stops the crash. The null value continues to appear, eventually surfacing in a different code path that causes a different failure. Caught when: the same root cause produces a new, related defect within weeks.

**Response:** The root cause hypothesis is required before a fix is implemented. A fix submitted without a documented root cause should be returned by the Reviewer. The question "why does this happen?" must be answered before "what do we change?" is implemented.

### Defect fixed without regression test
The fix is implemented, reviewed, and passes QA. No regression test is added because the engineer judged it low-risk or because time was short. Six months later, a refactor in the same area reintroduces the defect. It ships to production before anyone notices. Caught when: a production defect report describes behavior that was previously fixed.

**Response:** A regression test is not optional — it is part of the Definition of Done for every bug fix. A Reviewer who approves a fix without confirming that a regression test exists has not completed the review. QA validates that the regression test exists and passes as part of Phase 5.

### Critical defect treated as High due to classification error
A defect that is actually Critical (data loss risk, security exposure) is classified as High. The hotfix path is not triggered. The defect sits in the normal sprint queue. A user's data is affected or a security vulnerability is exploitable for days. Caught when: the incident review reveals the defect was classified lower than its actual impact warranted.

**Response:** When there is ambiguity between Critical and High, classify as Critical. The cost of unnecessary urgency is an engineer's afternoon. The cost of insufficient urgency is a production incident. The CTO is notified of all Critical defects — if the classification is wrong, the CTO can downgrade it.

### Fix deployed without QA validation
Time pressure causes the team to skip Phase 5 and push the fix directly from review to production. The fix works for the specific reproduction case but introduces a regression in a related flow that QA would have caught. Caught when: a new defect report surfaces within hours of the fix deployment.

**Response:** QA validation is not optional, even for hotfixes. For Critical defects, QA validation is abbreviated — focused on the specific reproduction path — but it is never skipped. A hotfix that has not been validated by QA has not passed Gate 5 and should not be deployed.

### Defect record never closed
The defect is fixed, validated, and deployed. The record is never formally closed with a root cause. Over time, the defect record history is a mix of open, resolved-but-open, and properly closed records. The learning is never captured. Cited in retrospectives but never acted on. Caught when: a retrospective review of defect records reveals a pattern of unclosed defects with no root cause documentation.

**Response:** Closing the defect record with root cause is part of the Definition of Done. The Tech Lead is responsible for it. A sprint does not close out cleanly while defect records from the sprint remain open without documented root causes.

---

## Anti-Patterns

**"We'll add the regression test in a follow-up."** A regression test added in a follow-up that never happens is no regression test at all. The test is added in the same PR as the fix. If the fix PR cannot include the test, the test is added in the next PR before the fix is merged to the release branch.

**Assigning the defect to whoever is available, not whoever owns the area.** A defect in the checkout flow assigned to a backend engineer who has never touched the checkout flow will take longer to fix and has higher risk of an incomplete root cause. The Tech Lead assigns defects to engineers who have context in the affected area.

**Treating a defect as an interruption to be minimized.** A defect is information: it reveals a gap in the design, the test coverage, or the implementation. Minimizing the time spent on it to get back to feature work discards that information. Root cause analysis is the mechanism that converts a defect into a permanent improvement.

**Escalating severity to get priority, not because the severity is accurate.** A Medium defect filed as Critical to ensure it gets attention this sprint is a classification manipulation that undermines the system for everyone. When everything is Critical, nothing is Critical. Severity is classified on impact and urgency, not on the reporter's frustration level.

**Closing a defect because the reporter stopped complaining.** A defect is closed when it is confirmed resolved in production through validation — not when the reporter goes quiet. Users who stop reporting a defect have often stopped using the affected feature, not found a fix.
