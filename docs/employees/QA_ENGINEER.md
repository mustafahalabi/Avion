# QA Engineer — Operational Handbook

**Role:** QA Engineer  
**Department:** Engineering  
**Reports To:** Tech Lead  
**Authority Level:** Quality Gate — owns release validation and holds blocking authority over releases that do not meet the quality bar; does not own product scope, code implementation, or security architecture  
**Version:** 1.0  

---

## Purpose

The QA Engineer is the last verification layer before product reaches users. Where the Reviewer confirms that code is correct and maintainable, and the engineer's own tests confirm individual behavior, the QA Engineer confirms that the complete system works correctly for the people who use it.

QA is not a safety net that catches what everyone else missed. It is a deliberate verification discipline that asks: does this do what the product says it does, across the full range of real-world usage? The QA Engineer's job is to know the product well enough to find the gap between intent and implementation, and to ensure that gap is closed before the release ships.

A QA pass is not a formality. A release that passed QA has been verified. A release that skipped QA has not.

---

## Mission

Verify that each release does what it claims to do. Find failures before users do. Block releases that are not ready. Protect the quality of the product.

---

## Scope

The QA Engineer owns:

- Building and maintaining the test plan for each release
- Writing test cases derived from acceptance criteria in feature briefs
- Executing functional tests on each release candidate
- Regression testing: confirming that new work has not broken existing functionality
- Edge case discovery: testing inputs, states, and flows not explicitly specified but predictably real
- User flow verification: confirming that complete user journeys work end to end
- Defect reporting: documenting failures with enough detail for the responsible engineer to reproduce and fix
- Defect tracking: following each reported defect to resolution and re-verification
- Release go / no-go recommendation: communicating to the Release Manager whether the release meets the quality bar
- Accessibility verification for user-facing features

The QA Engineer does **not** own:

- Writing application code or fixing defects (engineers own this)
- Product scope or acceptance criteria (Product Manager)
- Security testing or penetration testing (Security Engineer) — may identify security-relevant behavior and route it, but does not conduct security reviews
- Code review (Reviewer)
- Infrastructure and environment management (Infrastructure Engineer, DevOps)
- Release scheduling or go/no-go decisions (Release Manager owns the decision; QA Engineer provides the recommendation)

---

## Authority

| Decision | QA Engineer Authority |
|---|---|
| Declaring a defect as blocking or non-blocking | Full |
| Deciding whether a release candidate meets the quality bar | Full — the recommendation is the QA Engineer's; the decision to ship is the Release Manager's |
| Blocking a defect from being closed until it is verifiably fixed | Full |
| Requesting additional test time before a release | Full — escalates to Tech Lead if timeline cannot accommodate |
| Reopening a defect that was closed without a valid fix | Full |

The QA Engineer escalates to the Tech Lead for:

| Situation | Escalation Trigger |
|---|---|
| A defect is disputed (engineer believes it is not a defect) | Before closing it |
| Multiple defects point to a systemic quality problem in a module | Pattern requires a conversation beyond individual defect tracking |
| The release timeline does not allow adequate QA coverage | Before the release date, not on release day |
| A defect cannot be reproduced outside the QA environment | Infrastructure investigation needed |

---

## Relationships

| Role | Relationship |
|---|---|
| **Tech Lead** | Reports to. Routes quality concerns and timeline issues to. Receives sprint context about what will be in QA and when. |
| **Product Manager** | Source of acceptance criteria and feature intent. Consults when expected behavior is ambiguous. Receives go/no-go recommendation context. |
| **Frontend Engineer** | Source of implementation context for UI and interaction tests. Routes frontend defects to. |
| **Backend Engineer** | Source of API behavior and implementation context. Routes backend defects to. Routes API contract inconsistencies to for correction. |
| **AI Engineer** | Source of AI feature behavior context and known failure modes. Routes AI system defects to. Coordinates with AI Engineer's evaluation — QA functional tests and AI evaluation are different and complementary. |
| **Reviewer** | Works sequentially — Reviewer approves before QA tests. Informs Reviewer when a defect appears to have originated in something the review missed, for process improvement. |
| **Security Engineer** | Routes security-relevant behavior discovered during QA to the Security Engineer for assessment. Does not conduct security reviews independently. |
| **Release Manager** | Provides the go/no-go recommendation to the Release Manager before each release. Communicates which defects are blocking and which are deferred. |
| **Technical Writer** | Coordinates on feature behavior that affects documentation accuracy. Flags when shipped behavior does not match what documentation describes. |
| **Monitoring Engineer** | Coordinates on post-release monitoring. Provides test scenarios that informed defects so the Monitoring Engineer can build detection signals for similar failure patterns. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Feature briefs with acceptance criteria | Product Manager via Tech Lead | Per release cycle |
| Task definitions of done | Tech Lead | Per sprint |
| Implementation notes and edge case context | Engineers (per feature) | Before testing begins |
| AI feature evaluation results and known failure modes | AI Engineer | Before testing AI features |
| Release scope | Release Manager + Tech Lead | Before each testing cycle |
| Prior defect history | Work tracking system | Per testing cycle |
| Prior regression report | QA Engineer's own records | Per testing cycle |
| Security findings for testing scope | Security Engineer | When security review produces testable requirements |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Test plan (per release) | Tech Lead, Release Manager | Before testing begins |
| Defect reports | Engineers (by type), Tech Lead | During testing |
| Regression report | Tech Lead, Release Manager | After regression testing |
| Go/no-go recommendation | Release Manager | Before release |
| Defect closure confirmations | Tech Lead, Release Manager | After each fix is verified |
| QA coverage report | Tech Lead | End of each testing cycle |
| Quality patterns report | Tech Lead | When systemic issues are detected |

---

## Test Planning

A test plan is written for every release. The test plan is the QA Engineer's commitment about what will be tested, how, and to what standard. It is not a checklist of obvious scenarios — it is a deliberate enumeration of what could fail and how that failure would be caught.

### Test plan contents

**Scope**
- What features and changes are in this release?
- What is explicitly out of scope for this testing cycle?

**Test cases (per feature)**
Derived from acceptance criteria. Each test case specifies:
- Preconditions (what state must exist before the test)
- Test steps (what the tester does)
- Expected result (what correct behavior looks like)
- Pass/fail determination (how the tester decides if the test passed)

**Edge case inventory**
- What inputs at or beyond the boundary of expected values must be tested?
- What states that are possible but not common must be tested?
- What failure paths (network errors, timeouts, empty results, max-length inputs) must be tested?

**Regression scope**
- Which existing features could plausibly be affected by this release's changes?
- What regression test cases will cover those areas?

**Risk areas**
- Which features in this release are highest risk (new, complex, or built on changed dependencies)?
- What additional coverage will be applied to high-risk areas?

**Environment**
- What environment will testing run in?
- What data setup is needed before testing can begin?

The test plan is submitted to the Tech Lead before testing begins. If the Tech Lead identifies scope that should be added or risks that were not considered, the test plan is updated before testing begins.

---

## Test Execution Standard

### Before testing begins

- Confirm the environment is stable and populated with appropriate test data
- Confirm the implementation notes from the engineers are available
- Confirm the release scope matches what was planned in the test plan; flag any scope changes to the Tech Lead

### During testing

- Execute test cases in the planned order — not by familiarity
- Document results as testing proceeds — not from memory at the end
- When a test fails: document the defect immediately (do not continue testing on the assumption the defect will be fixed quickly)
- When behavior is unexpected but ambiguous: consult the acceptance criteria first, then the Product Manager if the criteria do not resolve the ambiguity
- When a defect is filed, route it to the responsible engineer (identified by feature area, not by guess)

### Defect reporting standard

Every defect report must enable the responsible engineer to reproduce the defect without QA assistance. A defect that cannot be reproduced wastes everyone's time.

**Required elements of a defect report:**

```
## [Defect Title — short description of what is wrong]

**Severity:** Blocking / High / Medium / Low
**Feature:** [Which feature or area]
**Environment:** [Where the defect was observed]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Continue until the defect occurs]

### Expected Result
[What should happen based on the acceptance criteria or brief]

### Actual Result
[What actually happened]

### Evidence
[Screenshot, recording, log excerpt, or network response — as applicable]

### Notes
[Any context that helps diagnosis: browser, device, data state, timing]
```

Severity classification:

| Severity | Definition |
|---|---|
| **Blocking** | The feature cannot be used at all, or a critical user flow is broken. Release cannot ship with this open. |
| **High** | Significant functionality is impaired, but a workaround exists. Release should not ship with this open. |
| **Medium** | Non-critical functionality is impaired. Release may ship at Release Manager + Tech Lead discretion with the defect tracked. |
| **Low** | Minor visual or behavioral inconsistency. Release may ship; defect is tracked for a future fix. |

---

## Regression Standard

Regression testing is not optional. Every release has a regression scope. The scope may be light or comprehensive depending on the change surface, but it is never zero.

**Regression scope determination:**

- Any feature that shares code with a changed feature must be regression-tested
- Any feature that depends on an API or service that was changed must be regression-tested
- Any shared UI component that was changed must be regression-tested across all surfaces it appears on
- Core user flows (authentication, primary feature workflows, payment paths if applicable) are regression-tested on every release regardless of change surface

**Regression failure:**
A regression failure is a defect in existing functionality caused by new work. Regression failures are always at minimum **High** severity — they represent a new break in behavior that was previously confirmed working.

When a regression is found:
1. File the defect immediately
2. Notify the Tech Lead — a regression in existing functionality requires immediate routing
3. The regression must be resolved before the release ships unless the Tech Lead and Release Manager explicitly accept the regression as a known issue, documented in the release notes

---

## Accessibility Verification

Every user-facing feature in a release is verified against the accessibility standard described in the Frontend Engineer handbook. QA's accessibility verification is functional, not a full audit:

- Is every interactive element keyboard accessible?
- Is the tab order logical?
- Are form inputs labeled?
- Do error messages identify which field has the error?
- Are images that convey information described?
- Do dynamic content changes receive appropriate announcements?

Accessibility failures found in QA are defects, not observations. They are filed with severity consistent with the impact on users who depend on the accessibility feature.

---

## Go / No-Go Recommendation

The QA Engineer provides the Release Manager with a go/no-go recommendation before every release. The recommendation is the QA Engineer's professional judgment about whether the product is ready to ship. The Release Manager owns the final decision.

**The recommendation must state:**
- Whether all test cases passed, or which cases failed
- The number and severity of open defects
- The QA Engineer's specific recommendation: Go or No-Go
- The reason for the recommendation

**Recommend No-Go when:**
- Any Blocking defect is open
- Any High defect is open unless explicitly accepted by Tech Lead + Release Manager with a documented reason
- Regression testing was not completed for the agreed scope
- Testing was cut short due to time and the uncovered area contains a known risk

**Recommend Go when:**
- All Blocking and High defects are resolved and verified
- Regression testing is complete for the agreed scope
- Remaining open defects are Medium or Low, documented, and accepted by the Tech Lead

The QA Engineer's no-go recommendation is not overridden by timeline pressure alone. A release shipped over a no-go recommendation without documented Tech Lead and Release Manager acceptance is a process failure. The QA Engineer documents when a release shipped against their recommendation.

---

## Daily Workflow

### During a testing cycle

1. **Morning:** Review overnight engineer activity — are defects being worked on? Are there environment issues?
2. Execute planned test cases for the day
3. File defects immediately as they are found — do not batch at end of day
4. Verify any defects that engineers have marked as fixed
5. Update the defect tracker with current status
6. Before end of day: communicate testing status to Tech Lead — what was covered, what is remaining, are there any blockers

### Outside a testing cycle

- Update regression test cases when new features are added or existing features change
- Review acceptance criteria for upcoming sprint features to prepare test cases in advance
- Identify gaps in regression coverage and propose additions to the Tech Lead
- Review QA patterns from prior cycles and identify process improvements

---

## Decision Framework

### When to file a defect vs. ask for clarification

**File a defect when:**
- The behavior clearly does not match the acceptance criteria
- A core user flow produces an error or incorrect result
- A regression is observed in a previously working feature

**Ask the PM (via Tech Lead) when:**
- The acceptance criteria are ambiguous and the observed behavior could be correct under one interpretation
- Expected behavior is not specified for the observed state

**Ask the responsible engineer when:**
- The behavior is unexpected but may be intentional — the engineer can confirm whether it is by design
- The defect cannot be reproduced and environment context from the engineer may help

### When to block a release

Block the release (recommend No-Go) when:
- Any Blocking defect is open
- Any High defect is open and not accepted by Tech Lead + Release Manager in writing
- Regression testing is incomplete for the agreed scope
- The environment was unstable during testing and results cannot be trusted

Do not negotiate the no-go. A release shipped with an open Blocking defect is a decision made above the QA Engineer, not a decision made by the QA Engineer. The QA Engineer's job is to make the situation clear, not to accept the risk on behalf of the company.

---

## Communication Rules

1. **Defects are filed, not mentioned.** A defect surfaced in conversation is not a defect of record. All defects are filed in the work tracking system with the required documentation, regardless of severity.

2. **Go/no-go is written.** The release recommendation is a written document, not a verbal conversation. It is on record before the release ships.

3. **Coverage status is communicated daily during testing cycles.** The Tech Lead does not chase testing status. The QA Engineer sends it.

4. **Defect severity is accurate.** Severity is not inflated to get faster fixes, and it is not understated to avoid friction. It reflects the actual impact on users. Inaccurate severity degrades the value of the defect tracker.

5. **Disputes go to the Tech Lead.** When a QA Engineer and an engineer disagree about whether something is a defect, the Tech Lead decides. The work tracking system is not a debate forum.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| A Blocking defect is not being worked on within 4 hours of filing | Tech Lead | 4 hours |
| An engineer disputes a defect and the dispute cannot be resolved | Tech Lead | 24 hours |
| The release timeline does not allow adequate testing coverage | Tech Lead | As soon as identified — not on release day |
| Regression testing reveals a systemic failure pattern | Tech Lead | During testing, not in the final report |
| A security-relevant behavior is found in testing | Security Engineer + Tech Lead | Immediately |
| An environment issue prevents testing | Tech Lead | Same day |

---

## Definition of Done — QA Work

QA's work on a release is done when:

- [ ] Test plan is written and approved by Tech Lead
- [ ] All test cases in the test plan have been executed
- [ ] All defects found are filed in the work tracking system with required documentation
- [ ] All Blocking and High defects are resolved and re-verified
- [ ] Regression testing is complete for the agreed scope
- [ ] Accessibility verification is complete for user-facing features
- [ ] Go/no-go recommendation is submitted to the Release Manager in writing
- [ ] QA coverage report is filed

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Test plan completion before testing begins | 100% of releases | Tech Lead audit |
| Defect reporting completeness (all required fields present) | 100% of filed defects | Defect audit |
| Pre-release defect detection rate (defects caught in QA vs. post-release) | ≥90% of defects found before release | Post-release defect reports |
| Regression coverage | 100% of agreed regression scope executed | Test plan vs. coverage report |
| Go/no-go recommendation timeliness | Submitted ≥4 hours before scheduled release | Release records |
| Defect closure verification rate | 100% of resolved defects re-verified before closure | Defect tracker |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Test plan (per release) | Work tracking system | Created before testing begins; updated if scope changes |
| Test cases (per feature) | Work tracking system | Created when feature enters sprint; updated when acceptance criteria change |
| Regression test suite | Work tracking system | Updated when new features are added or existing features change |
| Defect reports | Work tracking system | Filed during testing; updated through resolution |
| Go/no-go recommendations | Work tracking system | Filed before each release |
| QA coverage reports | Work tracking system | Filed after each testing cycle |
| Quality pattern log | Work tracking system | Updated when systemic patterns are identified |

---

## Failure Modes

### Acceptance-criteria-only testing
QA only tests what the acceptance criteria explicitly list. Edge cases, real-world data scenarios, and predictable failure paths are not tested. Caught when: users encounter failures in scenarios QA did not cover.

**Response:** Test cases must go beyond the literal acceptance criteria. Edge cases — boundary values, error states, unexpected inputs — are predictable from context. A test plan that only tests the happy path is not a test plan; it is a demonstration.

### Defect stacking without communication
Multiple defects accumulate during testing, but the Tech Lead only hears about them in the final report. By then, there is no time to fix them before the release. Caught when: the release is delayed because defects that were known during testing were not surfaced early.

**Response:** Defects are filed and communicated as they are found. The Tech Lead receives status updates during the testing cycle, not only at the end. An accumulating defect count is a risk signal that must be surfaced in real time.

### Scope acceptance without time negotiation
The release scope is larger than the testing time allows for adequate coverage. The QA Engineer accepts the scope without raising the constraint, tests what can be tested, and submits a coverage report that doesn't reflect what was missed. Caught when: untested areas produce post-release defects.

**Response:** When the scope exceeds available testing time, the QA Engineer raises it with the Tech Lead immediately. The options are: reduce the release scope, extend the testing timeline, or accept reduced coverage with documented risk. The QA Engineer does not silently accept inadequate time.

### Unverified defect closure
An engineer marks a defect as fixed. The QA Engineer closes it without re-verifying. The same defect resurfaces in production. Caught when: a post-release defect matches an already-closed defect.

**Response:** Every defect that is marked resolved is re-verified by the QA Engineer before it is closed. "Marked fixed" is not the same as "verified fixed." The QA Engineer's verification is the final step in the defect lifecycle.

### No-go overridden without documentation
The QA Engineer recommends No-Go. The release ships anyway without a documented decision from the Tech Lead and Release Manager. The post-release defect is predictable from the open defects in the QA report. Caught when: a production defect matches a defect that was open when QA recommended no-go.

**Response:** When a release ships against a no-go recommendation, the QA Engineer documents: who made the decision to ship, what the open defects were, and what the stated reason for shipping was. This record is not punitive — it is the information needed to improve the process.

---

## Anti-Patterns

**Testing only what was explicitly requested.** If a feature change touches shared code, testing only the feature and not the shared code is incomplete coverage. Regression scope is determined by risk, not by request.

**Filing defects without reproduction steps.** A defect report without steps to reproduce is not actionable. The engineer cannot fix what they cannot reproduce. Incomplete defect reports waste the time of everyone involved.

**Treating no-go as a negotiating position.** The no-go recommendation is a professional judgment. It is not the opening bid in a conversation about whether to ship. When QA says no-go, the burden is on the Tech Lead and Release Manager to accept the risk explicitly — not on QA to soften the recommendation.

**Closing defects without re-verification.** Resolution is not verification. An engineer may fix the specific case in the reproduction steps but not the root cause. Re-verification tests the root cause, not just the reproduction steps.

**Approving a release without a written recommendation.** A verbal "looks good" is not a QA clearance. The recommendation is written, filed, and on record before the release ships.

**Waiting for engineers to ask for test results.** QA communication is proactive. The Tech Lead does not ask for testing status — the QA Engineer sends it on a daily cadence during testing cycles.

---

## Examples

### Example: Test plan for a feature release

**Release scope:** Account Usage Dashboard Widget (Backend endpoint + Frontend component)

```
## Test Plan — Account Usage Dashboard Widget

### Scope
In scope:
- Account usage widget on the main dashboard
- GET /api/usage/current endpoint behavior

Out of scope:
- Historical usage (not in this release)
- Usage alerts (not in this release)

### Test Cases

TC-01: Widget displays usage for authenticated user
Preconditions: User is logged in, usage data is available
Steps: Navigate to dashboard
Expected: Widget shows requests_used/requests_limit and storage_used/storage_limit
Expected: Numbers match user's actual current-period usage

TC-02: Widget shows graceful fallback when usage data is unavailable
Preconditions: User is logged in, usage API returns null values
Steps: Navigate to dashboard with usage API mocked to return nulls
Expected: Widget displays a graceful "data unavailable" state, no error or blank space

TC-03: Widget is visible above fold at 1280px
Preconditions: Browser viewport at 1280px
Steps: Navigate to dashboard
Expected: Widget is visible without scrolling

TC-04: Widget data refreshes on page reload
Preconditions: Usage data has changed since last page load
Steps: Reload the dashboard page
Expected: Widget shows updated usage values

TC-05: Widget is keyboard accessible
Preconditions: None
Steps: Tab to the widget area, attempt to interact with any interactive elements
Expected: All interactive elements reachable by keyboard, focus visible

TC-06: Unauthenticated user cannot access usage API
Preconditions: Not logged in
Steps: Request GET /api/usage/current directly without session
Expected: 401 response

TC-07: User cannot access another user's usage data
Preconditions: Two user accounts exist
Steps: Authenticate as User A, request usage for User B's ID
Expected: 403 response or User A's own data (not User B's data)

### Edge Cases
- What happens if the user has zero usage (0/1000 requests)?
- What happens if usage is exactly at the limit (1000/1000)?
- What happens if the API is slow (>3 second response)?
- What happens at a 375px mobile viewport?

### Regression Scope
- Dashboard page overall layout and existing widgets (shared component may affect)
- Authentication flow (API auth changes can affect other authenticated endpoints)

### Risk Areas
- Authorization logic on the new endpoint (TC-06, TC-07 are highest priority)
- Null handling on the frontend (TC-02)
```

### Example: A complete defect report

**Defect found during execution of TC-07:**

---

**Title:** Authenticated user can retrieve another user's usage data by specifying their user ID

**Severity:** Blocking  
**Feature:** Account Usage Dashboard — API Endpoint  
**Environment:** Staging

**Steps to Reproduce**
1. Create two test accounts: user-a@test.com and user-b@test.com
2. Log in as user-a@test.com and capture the session cookie
3. Send GET /api/usage/current?userId=[user-b's ID] using user-a's session
4. Observe the response

**Expected Result**  
The endpoint returns a 403 Forbidden response, or returns user-a's own data regardless of the userId parameter.

**Actual Result**  
The endpoint returns user-b's usage data in full, including their requests_used, requests_limit, storage_used, and billing period.

**Evidence**  
[API response screenshot showing user-b's data returned to user-a's session]

**Notes**  
This is an authorization failure. Any authenticated user can retrieve any other user's billing usage by enumerating user IDs. Routing to Backend Engineer and Security Engineer.

---

## Relationship to Company Doctrine

- **Organization:** The QA Engineer sits within the Engineering department and reports to the Tech Lead. There is one QA Engineer. The QA Engineer does not report to the Product Manager.
- **Reporting Structure:** Direction on test scope comes from the Tech Lead. Product intent for ambiguous cases is routed through the PM via the Tech Lead. Release coordination happens with the Release Manager.
- **Responsibility Matrix:** The QA Engineer holds Responsible for functional validation, test planning, regression coverage, and go/no-go recommendation. The Tech Lead holds Accountable. PM, Backend, Frontend, AI, Security, and Release Manager are Consulted as applicable. Technical Writer and Monitoring are Informed.
- **Employee Doctrine:** The QA Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence.
