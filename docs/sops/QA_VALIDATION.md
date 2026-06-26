# SOP: QA Validation

**SOP ID:** SOP-004  
**Category:** Standard Operating Procedure  
**Owner:** QA Engineer  
**Version:** 1.0  

---

## Purpose

QA validation is the process by which Engineering OS confirms that completed work behaves correctly before it reaches users. It is distinct from code review: code review verifies how the code is written; QA validation verifies what the code does. A change that passes code review has met a quality standard for its construction. A change that passes QA validation has met a quality standard for its behavior.

QA validation produces the go/no-go recommendation that gates each release. That recommendation is written, on record, and cannot be bypassed at the Release Manager level without CTO involvement. This procedure defines how the QA Engineer arrives at that recommendation.

---

## Trigger

This procedure is triggered when:

- Code for a new feature or set of features has been reviewed, approved, and deployed to the staging environment
- A bug fix has been implemented, reviewed, approved, and deployed to staging
- A release candidate is being assembled and QA validation is required before the Release Manager can issue a go/no-go

---

## Separation from Code Review

QA validation and code review are distinct activities performed by distinct roles at distinct points in the delivery process.

| | Code Review (SOP-003) | QA Validation (this SOP) |
|---|---|---|
| **Performed by** | Reviewer | QA Engineer |
| **Occurs after** | Delivery Readiness confirmation by Tech Lead | Code review approval and staging deployment |
| **Validates** | How code is written: correctness, test coverage, quality, security | How code behaves: functionality, edge cases, regression, acceptance criteria |
| **Primary input** | The code change | The running system in staging |
| **Output** | Approve / Request Changes / Escalate | Go / No-Go recommendation |

Both are required. Neither substitutes for the other.

---

## Owner

**QA Engineer** — owns the validation process from Test Plan creation through the written go/no-go recommendation. The QA Engineer has authority to issue a No-Go regardless of timeline pressure.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **QA Engineer** | Test Plan; validation execution; defect reporting; go/no-go recommendation |
| **Tech Lead** | Routes defects to the appropriate engineer; confirms staging deployment is ready for validation |
| **Engineers (Backend, Frontend, AI, etc.)** | Fix defects found during validation; re-deploy to staging for re-validation |
| **Product Manager** | Available to clarify acceptance criteria when behavior is ambiguous; reviews go/no-go recommendation for user impact context |
| **Security Engineer** | Reviews security-relevant defects found during validation; may perform targeted security testing on flagged features |
| **Release Manager** | Receives the written go/no-go recommendation; incorporates it into the Release Readiness Checklist |
| **DevOps Engineer** | Deploys to staging on request; re-deploys when fixes are ready for re-validation |

---

## Preconditions

Before QA validation begins:

- [ ] All code for the validation scope has been reviewed, approved, and merged
- [ ] The merged code has been deployed to the staging environment by the DevOps Engineer
- [ ] The staging environment is confirmed as representative of production for this validation cycle
- [ ] The Feature Brief and acceptance criteria are available to the QA Engineer
- [ ] The QA Engineer has confirmed that the staging environment is accessible and functional

---

## Procedure

### Phase 1: Test Plan Creation

**Owner:** QA Engineer  
**Input:** Feature Brief; acceptance criteria; scope of changes in the release  
**Output:** Written Test Plan approved for execution  

**Steps:**

1. **QA Engineer** reviews the Feature Brief and all acceptance criteria for the features or bug fixes in scope.

2. **QA Engineer** creates the Test Plan. The Test Plan includes:

   **Scope statement**
   - What is being validated (features, bug fixes, areas of change)
   - What is explicitly out of scope for this validation cycle

   **Test cases — new features**
   For each acceptance criterion:
   - Preconditions: what must be true before the test begins
   - Steps: the exact sequence of actions to execute
   - Expected result: what the system should do
   - Pass/fail criteria: the specific observable outcome that constitutes a pass

   **Test cases — bug fixes**
   For each bug fix in scope:
   - The reproduction steps from the defect record
   - The expected behavior after the fix
   - The pass criterion: defect no longer occurs

   **Edge case inventory**
   - Boundary conditions (minimum and maximum values, empty states, maximum capacity)
   - Error states and failure conditions
   - Concurrent usage patterns where applicable
   - Inputs that are valid but unusual
   - Inputs that are invalid and must be handled gracefully

   **Regression scope**
   - Shared code paths that may have been affected by any change in scope
   - APIs or services that the changed components depend on or that depend on them
   - Core user flows that must always function regardless of what changed
   - Any area identified by the Tech Lead as higher-risk for this release

   **Risk areas**
   - Areas the QA Engineer identifies as having higher defect probability (complex changes, areas with recent defect history, new integrations)

   **Environment and data requirements**
   - What configuration, data state, or user accounts are required for validation

3. **QA Engineer** reviews the Test Plan with the Tech Lead to confirm scope accuracy and identify any missing risk areas.

4. For releases with security-relevant changes, the **Security Engineer** reviews the Test Plan to identify whether targeted security testing should be added.

**Gate 1:** Test Plan is complete and reviewed. QA Engineer has confirmed staging is ready.

---

### Phase 2: Validation Execution

**Owner:** QA Engineer  
**Input:** Approved Test Plan; staging environment  
**Output:** Executed test cases with pass/fail results; defect reports for all failures  

**Steps:**

1. **QA Engineer** executes each test case in the Test Plan in sequence. For each test case:
   - Records the actual result
   - Records pass or fail against the pass criterion
   - Documents the environment state and any conditions present when the test ran

2. When a test case fails:
   - **QA Engineer** documents a defect report immediately (does not continue executing test cases that depend on the failing behavior without noting the dependency)
   - The defect report includes: title (specific, one-line), severity, reproduction steps (exact), expected behavior, actual behavior, environment details, and any relevant evidence

3. **QA Engineer** executes the edge case inventory, the regression scope, and any targeted security testing specified in the Test Plan.

4. **QA Engineer** does not modify the Test Plan during execution without notifying the Tech Lead. If new test cases are needed because the execution reveals an area not covered by the plan, they are added with the Tech Lead's awareness and noted as additions.

**Gate 2:** All test cases are executed and results are recorded. All failures have defect reports.

---

### Phase 3: Defect Resolution and Re-Validation

**Owner:** QA Engineer (re-validation); Tech Lead (routing); Engineers (fixes)  
**Input:** Defect reports  
**Output:** All Blocking defects resolved and re-validated  

**Steps:**

1. **QA Engineer** routes all defect reports to the Tech Lead immediately — not batched at the end of execution.

2. **Tech Lead** classifies each defect and assigns it to the appropriate engineer for resolution. Defect severity follows the classification defined in SOP-002 (Bug Fix):
   - **Blocking** — must be resolved before release
   - **High** — must be resolved before release or explicitly accepted by CTO
   - **Medium** — should be resolved; may be deferred with PM and CTO awareness
   - **Low** — may be deferred to a follow-up release

3. **Engineers** fix Blocking and High defects. **DevOps Engineer** re-deploys to staging.

4. **QA Engineer** re-validates each resolved defect using the original reproduction steps from the defect report — not a modified test that avoids the original failure condition.

5. When re-validation confirms the defect is resolved, the QA Engineer marks it resolved in the defect record.

6. When re-validation reveals the defect is not resolved or has introduced a regression, the QA Engineer re-files the finding and the cycle continues.

7. Medium and Low defects that are deferred are documented in the defect record with: the deferral decision, who made it, and the planned resolution sprint or release.

**Gate 3:** All Blocking defects are resolved and re-validated. Medium and Low deferred defects are documented with deferral decisions.

---

### Phase 4: Go/No-Go Recommendation

**Owner:** QA Engineer  
**Input:** Completed validation; defect resolution status  
**Output:** Written go/no-go recommendation delivered to the Release Manager  

**Steps:**

1. **QA Engineer** reviews the full validation record:
   - All test cases executed and results recorded
   - All Blocking defects resolved and re-validated
   - Deferred defects documented with decisions
   - Regression scope confirmed as passing

2. **QA Engineer** writes the go/no-go recommendation. The recommendation is always written — not communicated verbally. It contains:

   **Go recommendation:**
   - Confirmation that all test cases passed (or a specific list of exceptions and why they are acceptable)
   - Confirmation that all Blocking defects are resolved
   - Summary of any Medium or Low defects deferred, with defect IDs
   - Any risks or observations the Release Manager should be aware of

   **No-Go recommendation:**
   - The specific Blocking defects that remain unresolved (by defect ID and title)
   - The risk if the release proceeds: what users would encounter
   - What is required to change the recommendation to Go
   - The QA Engineer's estimate of how long resolution and re-validation would take

3. **QA Engineer** delivers the recommendation to the Release Manager.

4. The Release Manager may not proceed without a written QA recommendation. The Release Manager cannot override a No-Go at their own authority level — override requires CTO decision, and when it occurs, it is documented in the release record alongside the QA recommendation.

5. When a release proceeds against a QA No-Go recommendation:
   - The CTO documents the override decision and the accepted risk
   - The QA Engineer's No-Go recommendation remains on record unchanged
   - The release record notes that the release shipped against QA's recommendation

**Gate 4:** Written go/no-go recommendation is delivered to the Release Manager.

---

## Validation Scope by Work Type

### New feature validation

For each new feature, validation must cover:
- Every acceptance criterion from the Feature Brief
- The happy path: the standard user journey through the feature
- All edge cases in the edge case inventory
- Error and failure states: what happens when the feature encounters invalid input, a failed dependency, or a user action outside the intended path
- The feature's behavior at boundaries: first use, empty state, maximum load
- Integration with features the new feature touches: the new feature does not break adjacent behavior

### Bug fix validation

For each bug fix, validation must cover:
- The original reproduction steps from the defect record: the defect no longer occurs
- The regression test the engineer added: it passes
- The behavior adjacent to the fix: the fix does not introduce new failures in related code paths
- Any other instances of the same pattern identified during root cause analysis

### Regression validation

Regression validation covers areas that did not change in this release but could have been affected by changes that did. Regression scope is defined in the Test Plan but always includes:
- Core user flows: authentication, account management, and the primary product flows
- Shared components: components used across multiple features that any change could affect
- APIs that changed: the API's existing contract is still satisfied for existing callers
- Database migrations: the migration completed correctly and existing data is unaffected

Regression validation failure is always classified as Blocking severity. A regression is never deferred.

### Edge case validation

Edge case validation confirms that the system handles unusual but valid inputs correctly and invalid inputs gracefully. Edge cases are identified by the QA Engineer based on:
- Boundary values (minimum, maximum, empty, null)
- Concurrent or rapid sequential operations
- Inputs that are technically valid but unusual in practice
- States the system can reach through valid but non-obvious sequences of actions
- Inputs in unexpected formats, encodings, or sizes

---

## Release Readiness Evidence

The following constitute the release readiness evidence produced by QA validation:

| Evidence | Form | Owner |
|---|---|---|
| Test Plan | Written document, reviewed by Tech Lead | QA Engineer |
| Test execution record | Executed test cases with pass/fail results | QA Engineer |
| Defect reports | Written, one per defect, with severity and status | QA Engineer |
| Defect resolution confirmations | Re-validation results per resolved defect | QA Engineer |
| Deferral decisions | Written, per deferred defect, with CTO/PM awareness | Tech Lead / Product Manager |
| Go/No-Go recommendation | Written, delivered to Release Manager | QA Engineer |

All evidence is retained in the project documentation system. The Release Manager references the go/no-go recommendation in the Release Readiness Checklist; the supporting evidence is available for audit.

---

## Decision Gates Summary

| Gate | Condition | Owner |
|---|---|---|
| Gate 1 | Test Plan complete, reviewed, staging confirmed ready | QA Engineer |
| Gate 2 | All test cases executed, all failures have defect reports | QA Engineer |
| Gate 3 | All Blocking defects resolved and re-validated; deferrals documented | QA Engineer, Tech Lead |
| Gate 4 | Written go/no-go recommendation delivered to Release Manager | QA Engineer |

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| A Blocking defect cannot be fixed within the release window | Release Manager, CTO | As soon as the timeline risk is identified |
| A defect's severity classification is disputed | Tech Lead, then CTO | When Tech Lead and QA Engineer cannot agree |
| A staging environment issue prevents validation from completing | Tech Lead, DevOps | Immediately on discovery |
| A No-Go recommendation is under pressure to be overridden | CTO | Before any override decision |
| Security-relevant behavior is found during validation that was not flagged in code review | Security Engineer | Immediately on discovery |
| Regression testing reveals a defect in a core flow not related to the current release | Tech Lead | Immediately — separate work item created |
| The Test Plan cannot be completed in the available window | Release Manager, Tech Lead | As soon as the timeline risk is identified |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Test Plan | QA Engineer | Phase 1 |
| Test execution record | QA Engineer | Phase 2 |
| Defect reports (per defect) | QA Engineer | Phase 2 |
| Re-validation records (per resolved defect) | QA Engineer | Phase 3 |
| Deferral decisions (per deferred defect) | Tech Lead / Product Manager | Phase 3 |
| Go/No-Go recommendation | QA Engineer | Phase 4 |

---

## Definition of Done

QA validation is done when all of the following are true:

- [ ] Test Plan is written and reviewed by the Tech Lead
- [ ] All test cases in the Test Plan are executed and results recorded
- [ ] All Blocking defects have defect reports
- [ ] All Blocking defects are resolved and re-validated as resolved
- [ ] All Medium and Low deferred defects have written deferral decisions
- [ ] Regression scope validation is complete with no new Blocking findings
- [ ] Edge case inventory is validated
- [ ] A written go/no-go recommendation is delivered to the Release Manager

---

## Memory Updates

After each QA validation cycle:

| Record | Content | Owner |
|---|---|---|
| QA validation record (per release) | Test Plan, execution results, defect reports, recommendation | QA Engineer |
| Defect records | Updated with validation status (resolved, re-validated, deferred) | QA Engineer |
| Regression suite | Any new test cases added to the regression inventory for future cycles | QA Engineer |
| Deferral log | Medium and Low defects deferred, with planned resolution | Tech Lead |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Test Plan completion before execution | 100% — Test Plan written and reviewed before any execution begins | QA records |
| Go/No-Go recommendation in writing | 100% — every release has a written recommendation | Release records |
| Blocking defect escape rate | 0% — no Blocking defects reach production | Incident records |
| Regression detection rate | Tracked — regressions caught in staging vs. production | QA and incident records |
| Defect report completeness | 100% — every defect has a report with severity, reproduction steps, and expected behavior | Defect records |
| Re-validation before resolution close | 100% — no defect is marked resolved without QA re-validation | Defect records |

---

## Failure Modes

### Test Plan written after execution begins
The QA Engineer begins testing before the Test Plan is complete, trusting memory and intuition. Some areas are covered thoroughly; others are skipped because they were not written down. The coverage is inconsistent and not reproducible. A defect in a non-obvious edge case goes undetected. Caught when: a post-release defect traces to an area that should have been in the Test Plan.

**Response:** The Test Plan is completed and reviewed before any test execution begins. Gate 1 is the explicit checkpoint. An engineer who asks "can we start testing while you finish the plan?" is asking QA to proceed without a reproducible scope, which defeats the purpose of the Test Plan.

### Acceptance criteria not tested because they are ambiguous
A test case cannot be written because the acceptance criterion does not specify the expected behavior clearly enough for a pass/fail determination. Rather than raising the ambiguity, the QA Engineer skips the criterion or writes a test that passes a liberal interpretation. The actual behavior is not validated. Caught when: the PM or a user observes that the feature does not behave as intended after release.

**Response:** Ambiguous acceptance criteria are raised to the Product Manager and Tech Lead before execution begins — not discovered during execution and silently accommodated. When a criterion cannot be written as a test case, it is not a valid criterion. The QA Engineer has authority to request clarification, and the test plan is not approved until criteria are testable.

### Defects batched and delivered at end of validation
The QA Engineer collects defects throughout the validation cycle but does not route them to the Tech Lead until execution is complete. Engineers cannot begin fixing defects until the batch is delivered. Resolution and re-validation happen in a compressed window at the end. Some defects are fixed under time pressure with less thoroughness. Caught when: a defect that was fixed in the last hour before release appears in production.

**Response:** Defects are routed to the Tech Lead as they are found — not batched. This allows engineers to begin working on fixes before validation is complete, creating a parallel track that avoids the compressed end-of-cycle pressure.

### Go recommendation issued without completed regression
The QA Engineer validates all new feature acceptance criteria and issues a Go, but the regression scope was not completed due to time pressure. A regression in a core flow ships to production. Caught when: a production defect in a core flow is traced to a code change that was in the validated release but was not regression-tested.

**Response:** Regression validation is not optional. A go recommendation issued without completed regression is a go recommendation without evidence. The release either waits for regression to complete, or the CTO explicitly accepts the risk of releasing without it — and that acceptance is in the release record.

### No-Go recommendation overridden without documentation
The QA Engineer issues a No-Go. The team is under deadline pressure. The Tech Lead verbally reassures everyone that the issue is minor. The Release Manager issues a Go. No documentation records that QA recommended No-Go. Later, the issue surfaces in production. The No-Go recommendation is not in the release record. Caught when: a post-release incident review cannot determine whether QA validated the release.

**Response:** The QA Engineer's written recommendation is part of the permanent release record regardless of the outcome. When an override occurs, the CTO's override decision is added to the record alongside the QA recommendation. Both remain visible. The override does not delete or replace the recommendation.

---

## Anti-Patterns

**Testing to confirm, not to find defects.** QA validation exists to find defects before users do. A test that is designed to pass — one that avoids known edge cases, tests only the happy path, and assumes the implementation is correct — is not validation. It is confirmation of what the engineer already believed. The QA Engineer's job is to try to break the thing, not to prove it works.

**Treating regression testing as optional for "small" releases.** The highest-risk changes are sometimes the smallest. A one-line change in a shared utility can break behavior across the entire product. Regression scope is defined by what could have been affected, not by the size of what changed.

**Skipping re-validation of resolved defects.** When an engineer fixes a defect and re-deploys, the QA Engineer validates the fix against the original reproduction steps — not a modified test that avoids the original condition. A defect that is "fixed" by making the original test path unreachable is not fixed; it is hidden.

**Using staging validation to substitute for production monitoring.** Staging can only simulate production. Some defects appear only under production load, with real data, or in interaction with production integrations that staging does not replicate. QA validation in staging is a necessary condition for release — not a sufficient one. Post-deployment monitoring (coordinated with the Monitoring Engineer) catches what staging cannot.

**Writing test cases after execution to document what was tested.** Test cases written to document what was already tested are not evidence of a pre-defined validation scope — they are a record of whatever the QA Engineer happened to check. A Test Plan written after the fact cannot be reviewed by the Tech Lead before execution, cannot be reproduced by a future QA Engineer, and does not constitute a systematic validation.
