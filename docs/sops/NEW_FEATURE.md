# SOP: New Feature

**SOP ID:** SOP-001  
**Category:** Standard Operating Procedure  
**Owner:** Product Manager  
**Version:** 1.0  

---

## Purpose

This procedure defines how Engineering OS takes a feature from a CEO objective to a shipped, documented, and recorded capability. It establishes who does what, in what order, what each handoff requires, and what completion means. Every feature that ships follows this procedure. Deviation from this procedure is not a shortcut — it is a failure of process that must be documented and reviewed.

---

## Trigger

This procedure is triggered when one of the following occurs:

- The CEO defines an objective that requires a new feature
- A planning session produces a prioritized feature that is approved for development
- A Product Manager proposes a feature and receives approval from the CEO or CTO to proceed

---

## Owner

**Product Manager** — owns the procedure end-to-end: ensuring that each phase completes correctly, that handoffs are clean, and that the feature does not stall without an identified owner for the current phase.

---

## Participants

| Role | Phase(s) |
|---|---|
| **CEO** | Objective definition; final approval for features requiring strategic alignment |
| **CTO** | Technical feasibility review; architecture decisions; escalation receiver |
| **Product Manager** | Feature Brief; scope management; acceptance criteria; release coordination |
| **Tech Lead** | Technical planning; task decomposition; assignment; delivery readiness |
| **Backend Engineer** | Implementation (backend) |
| **Frontend Engineer** | Implementation (frontend) |
| **AI Engineer** | Implementation (AI features) |
| **Infrastructure Engineer** | Infrastructure requirements; production readiness |
| **Reviewer** | Code review; approval to merge |
| **Security Engineer** | Security review (when required) |
| **QA Engineer** | Test plan; validation; go/no-go recommendation |
| **Release Manager** | Release readiness; deployment coordination; release record |
| **DevOps Engineer** | Deployment execution; pipeline |
| **Monitoring Engineer** | Monitoring requirements; post-deployment signal coverage |
| **Documentation Specialist** | Feature documentation; release notes |
| **Search Visibility Specialist** | Metadata and search visibility review (public-facing features) |

---

## Preconditions

Before this procedure begins, all of the following must be true:

- [ ] The feature has been approved for development (by CEO, CTO, or through the planning process)
- [ ] The Product Manager is assigned and available to own the Feature Brief
- [ ] The Tech Lead is assigned and available to own technical planning
- [ ] The sprint or development window for the feature has been identified

---

## Procedure

### Phase 1: Feature Definition

**Owner:** Product Manager  
**Input:** CEO objective or approved backlog item  
**Output:** Approved Feature Brief  

**Steps:**

1. **Product Manager** creates the Feature Brief using the canonical Feature Brief format. The brief must include:
   - Problem statement: what user problem this solves and for whom
   - Proposed solution: what the feature does at a functional level
   - Acceptance criteria: specific, testable, binary, and complete conditions that define when the feature is done
   - Out of scope: what this feature explicitly does not include
   - Success metrics: how the company will know the feature is working after release
   - Dependencies: known technical, product, or external dependencies

2. **Product Manager** routes the Feature Brief to the CTO for technical feasibility review.

3. **CTO** reviews the Feature Brief for technical feasibility. The CTO may:
   - Approve as written
   - Return with required changes to scope or acceptance criteria
   - Escalate to the CEO if the feature has strategic implications not captured in the brief

4. **Product Manager** incorporates any changes and obtains final approval.

5. **CEO** approves features that require CEO sign-off (as defined by company policy). Standard features are approved by the CTO.

**Gate 1:** Feature Brief is approved by CTO (and CEO where required) before Phase 2 begins.

---

### Phase 2: Technical Planning

**Owner:** Tech Lead  
**Input:** Approved Feature Brief  
**Output:** Decomposed task list with assignments, estimates, and dependencies  

**Steps:**

1. **Tech Lead** reviews the Feature Brief and identifies:
   - The technical approach
   - Required engineering roles (Backend, Frontend, AI, Infrastructure)
   - Infrastructure or environment changes required
   - Security review requirement (the Tech Lead flags the Security Engineer if the feature falls within the security review trigger conditions defined in the Security Engineer handbook)
   - Monitoring requirements (the Tech Lead coordinates with the Monitoring Engineer to define required signals before implementation begins)
   - Documentation requirements (the Tech Lead communicates to the Documentation Specialist what documentation is needed and when)
   - Search visibility requirements for public-facing features (the Tech Lead coordinates with the Search Visibility Specialist)

2. **Tech Lead** decomposes the feature into tasks using the Task Decomposition Doctrine:
   - One task = one deliverable
   - Fits within one working day
   - Has a clear Definition of Done
   - Dependencies are mapped
   - Maps to one or more acceptance criteria in the Feature Brief

3. **Tech Lead** assigns tasks to engineers.

4. **Tech Lead** communicates the sprint plan to the Product Manager and confirms that the acceptance criteria can be satisfied by the task list.

**Gate 2:** Task list is complete, assigned, and confirmed against the Feature Brief acceptance criteria before Phase 3 begins.

---

### Phase 3: Implementation

**Owner:** Tech Lead (coordination); assigned engineers (execution)  
**Input:** Assigned task list; Feature Brief  
**Output:** Implementation complete; all tasks meet their Definition of Done; code ready for review  

**Steps:**

1. **Engineers** implement their assigned tasks according to the Feature Brief acceptance criteria and the task Definition of Done.

2. **Backend Engineer** (when applicable):
   - Defines and publishes the API contract before the Frontend Engineer consumes it
   - Implements all security controls specified by the Security Engineer
   - Ensures every migration has a tested rollback path before running in production

3. **Frontend Engineer** (when applicable):
   - Implements the UI against the published API contract
   - Meets the accessibility standard and performance standard defined in the Frontend Engineer handbook
   - Does not contact the Product Manager directly — all scope questions route through the Tech Lead

4. **AI Engineer** (when applicable):
   - Does not ship AI behavior without completing the Evaluation Standard defined in the AI Engineer handbook
   - Has full authority to block the feature if evaluation is incomplete

5. **Infrastructure Engineer** (when applicable):
   - Completes all infrastructure changes required before the feature can be deployed
   - Follows the pre-change procedure defined in the Infrastructure Engineer handbook

6. **Tech Lead** monitors progress against the task list. When any task is at risk (estimate exceeded, blocker identified), the Tech Lead escalates immediately — not at the end of the sprint.

7. When all tasks are complete, the **Tech Lead** performs Delivery Readiness review using the 10-item checklist defined in the Tech Lead handbook. Code does not move to review until Delivery Readiness is confirmed.

**Gate 3:** Tech Lead has confirmed Delivery Readiness. All tasks meet their Definition of Done.

---

### Phase 4: Review

**Owner:** Reviewer  
**Input:** Code submitted for review; Feature Brief acceptance criteria  
**Output:** Reviewed and approved code; all blocking findings resolved  

**Steps:**

1. **Tech Lead** routes the code to the Reviewer.

2. **Reviewer** reviews the code using the review standards defined in the Reviewer handbook. All findings are classified:
   - **Blocking:** must be resolved before approval
   - **Non-blocking:** should be addressed but does not block
   - **Question:** clarification requested, does not block

3. **Security Engineer** reviews code with security-relevant patterns when flagged by the Tech Lead or Reviewer. The PR cannot be approved until the Security Engineer's review is complete and all Blocking security findings are resolved.

4. **Engineer** resolves all Blocking findings and responds to Non-blocking findings and Questions.

5. **Reviewer** re-reviews resolved findings and issues approval when all conditions are met.

6. **Tech Lead** merges approved code.

**Gate 4:** Code has been approved by the Reviewer (and Security Engineer where required). All Blocking findings are resolved. Code is merged.

---

### Phase 5: QA Validation

**Owner:** QA Engineer  
**Input:** Merged code deployed to staging; Feature Brief acceptance criteria; Test Plan  
**Output:** QA go/no-go recommendation; all Blocking defects resolved  

**Steps:**

1. **QA Engineer** creates a Test Plan that covers:
   - All acceptance criteria from the Feature Brief
   - Edge cases and boundary conditions
   - Regression scope (shared code, dependent APIs, and core flows that may have been affected)
   - Risk areas

2. **DevOps Engineer** deploys the merged code to the staging environment.

3. **QA Engineer** executes the Test Plan against the staging deployment.

4. **QA Engineer** documents all defects found with severity classification:
   - **Blocking:** prevents release
   - **High:** significant impact, must be addressed before release
   - **Medium:** notable, should be addressed before release
   - **Low:** minor, may be deferred

5. **Tech Lead** routes Blocking and High defects to the appropriate engineer for resolution.

6. **Engineers** fix and re-deploy. **QA Engineer** re-validates resolved defects.

7. **QA Engineer** issues the go/no-go recommendation in writing. The recommendation is on record and cannot be overridden at the Release Manager level without CTO involvement.

**Gate 5:** QA go recommendation is issued in writing. All Blocking defects are resolved.

---

### Phase 6: Documentation

**Owner:** Documentation Specialist  
**Input:** Approved feature as validated in staging; Feature Brief  
**Output:** Complete, reviewed feature documentation; release notes  

**Steps:**

1. **Documentation Specialist** drafts user-facing feature documentation (begun in parallel with Phase 3 — not started after QA completes).

2. **Documentation Specialist** routes documentation to the relevant engineer for technical accuracy review and to the Product Manager for framing review.

3. **Engineer** and **Product Manager** review and confirm accuracy.

4. **Documentation Specialist** drafts the release notes for this feature as part of the release changelog.

5. **Search Visibility Specialist** reviews metadata, canonical tags, and Open Graph markup for any new public-facing pages introduced by the feature. Required changes must be implemented before the feature ships.

6. **Documentation Specialist** confirms documentation readiness to the Release Manager in writing.

**Gate 6:** All feature documentation is complete and accuracy-reviewed. Release notes are ready. Search visibility review is approved (for public-facing features).

---

### Phase 7: Release

**Owner:** Release Manager  
**Input:** All Phase 1–6 gates satisfied; release readiness checklist complete  
**Output:** Feature deployed to production; release record created; changelog published  

**Steps:**

1. **Release Manager** confirms all pre-release requirements are met using the Release Readiness Checklist defined in the Release Manager handbook:
   - QA go recommendation received
   - Security clearance received (if applicable)
   - DevOps deployment readiness confirmed
   - Monitoring baseline confirmed
   - Documentation readiness confirmed
   - Rollback validated

2. **Release Manager** issues the go/no-go decision at the scheduled time.

3. **DevOps Engineer** executes the deployment to production.

4. **Monitoring Engineer** watches post-deployment signals for the 30-minute monitoring window and reports at 5-minute and 30-minute marks.

5. **Release Manager** declares the release stable after the monitoring window closes without incident, or authorizes rollback if signals require it.

6. **Documentation Specialist** publishes feature documentation and release notes.

7. **Release Manager** closes the release record.

**Gate 7:** Production deployment is stable. Release record is closed. Documentation is published.

---

### Phase 8: Memory Update

**Owner:** Product Manager  
**Input:** Completed feature; release record  
**Output:** Feature is recorded in company memory  

**Steps:**

1. **Product Manager** updates the Feature Memory with:
   - What the feature does and what problem it solves
   - The acceptance criteria as shipped (noting any deviations from the original brief)
   - The release version in which it shipped
   - Key decisions made during development

2. **Tech Lead** ensures that any architectural decisions made during development are recorded in the appropriate decision record.

3. **Documentation Specialist** confirms that all documentation written for the feature is indexed and findable.

**Gate 8:** Feature memory is updated. Architectural decisions are recorded.

---

## Decision Gates Summary

| Gate | Condition | Owner of Gate |
|---|---|---|
| Gate 1 | Feature Brief approved | CTO (CEO where required) |
| Gate 2 | Task list complete, assigned, and confirmed against AC | Tech Lead |
| Gate 3 | Delivery Readiness confirmed | Tech Lead |
| Gate 4 | Code reviewed and approved, all Blocking findings resolved | Reviewer |
| Gate 5 | QA go recommendation issued, all Blocking defects resolved | QA Engineer |
| Gate 6 | Documentation complete; search visibility approved | Documentation Specialist |
| Gate 7 | Production deployment stable; release record closed | Release Manager |
| Gate 8 | Feature memory updated | Product Manager |

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| Feature scope changes after Gate 1 | CTO, CEO (if strategic) | Any post-approval scope change |
| A Gate cannot be passed and the blocker has no clear resolution path | CTO | When blocker is identified |
| QA No-Go with business case for proceeding | CTO | Before any override decision |
| Security hold that may block the release | CTO | When hold is issued |
| A Blocking defect cannot be fixed within the release window | CTO, Release Manager | When the timeline risk is identified |
| Post-release regression that requires rollback | CTO | Immediately upon rollback authorization |
| AI behavior evaluation is incomplete and the feature is under pressure to ship | CTO | AI Engineer flags; CTO decides |

---

## Artifacts

The following artifacts are produced and retained as outputs of this procedure:

| Artifact | Owner | Created In |
|---|---|---|
| Feature Brief | Product Manager | Phase 1 |
| Task list (with assignments and estimates) | Tech Lead | Phase 2 |
| API contract (when applicable) | Backend Engineer | Phase 3 |
| Evaluation report (AI features) | AI Engineer | Phase 3 |
| Security review record | Security Engineer | Phase 4 |
| Test Plan | QA Engineer | Phase 5 |
| QA go/no-go recommendation | QA Engineer | Phase 5 |
| Defect report | QA Engineer | Phase 5 |
| Feature documentation | Documentation Specialist | Phase 6 |
| Release notes | Documentation Specialist | Phase 6 |
| Release record | Release Manager | Phase 7 |
| Feature memory entry | Product Manager | Phase 8 |
| Decision records (architectural) | Tech Lead | Phase 8 |

---

## Definition of Done

A new feature is done when all of the following are true:

- [ ] Feature Brief was approved before implementation began
- [ ] All tasks were decomposed and assigned before implementation began
- [ ] All acceptance criteria from the Feature Brief are satisfied in production
- [ ] Code was reviewed and approved by the Reviewer before merging
- [ ] Security review was completed for features that required it
- [ ] AI evaluation was completed before ship for features with AI behavior
- [ ] QA go recommendation was issued in writing before release
- [ ] All Blocking defects were resolved before release
- [ ] Feature documentation is published
- [ ] Release notes are published
- [ ] Release record is closed
- [ ] Feature memory is updated
- [ ] Architectural decisions made during development are recorded

---

## Memory Updates

After each feature is completed, the following memory records are updated:

| Record | Content | Owner |
|---|---|---|
| Feature memory | What the feature does, acceptance criteria as shipped, release version, key decisions | Product Manager |
| Decision records | Architectural decisions made; rationale | Tech Lead |
| API documentation | API contracts introduced or changed | Backend Engineer / Documentation Specialist |
| Security pattern library | Any new approved patterns introduced | Security Engineer |
| Monitoring signal definitions | Signals introduced for this feature | Monitoring Engineer |
| Documentation library | Feature documentation indexed | Documentation Specialist |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Gate compliance rate | 100% of features pass all 8 gates in sequence | Release records |
| Feature Brief approval before implementation | 100% — no feature begins Phase 3 without Gate 1 | Feature records |
| QA go rate (features that pass QA without No-Go) | Tracked; improving trend | QA records |
| Post-release defect rate (Blocking/High) | Zero — no Blocking or High defects discovered post-release | Incident records |
| Documentation at release | 100% — documentation published at or before release stability | Release records |
| Memory update completion | 100% — Feature Memory updated within one sprint of release | Memory audit |

---

## Failure Modes

### Scope change after Gate 1
The Feature Brief is approved and implementation begins. During Phase 3, the scope expands — additional requirements are added verbally, acceptance criteria are reinterpreted, or the PM adds capabilities that were not in the original brief. Engineers build to the new scope without a formal change to the brief. The brief is now a historical artifact rather than the authoritative specification. Caught when: QA validates against the original brief and the implementation does not match, or post-release behavior does not match user expectations.

**Response:** Any change to the Feature Brief after Gate 1 requires a written update to the brief and re-confirmation by the approvers. The PM cannot make scope changes based on verbal conversations. Engineers implement the written brief, not the verbal intent.

### Skipping QA to hit a deadline
Timeline pressure causes the team to move a feature directly from Phase 4 (Review) to Phase 7 (Release) without Phase 5 (QA). A defect that QA would have caught ships to production. The Release Manager authorizes the release without a written QA recommendation. Caught when: a post-release defect trace shows that no QA test plan existed for the affected code path.

**Response:** QA is not optional. A QA No-Go is documented in the release record even if the decision to ship is escalated and overridden by the CTO. The record shows that the team chose to proceed without QA clearance. The Release Manager does not issue a go call without a QA recommendation in writing.

### Feature ships without documentation
Development and release move quickly. Documentation is planned for "after release" and is never written. The feature is live, but there is no user documentation. Support volume increases. The feature is underused because users cannot understand it. Caught when: post-release support tickets indicate confusion about the feature, or a documentation audit finds a gap.

**Response:** Documentation is written in Phase 6, in parallel with QA — not after the release. The Documentation Specialist begins drafting as soon as Phase 3 is underway. Documentation readiness is a release gate. The Release Manager does not issue a go without documentation readiness confirmation from the Documentation Specialist.

### Feature memory never updated
The feature ships. Everyone moves to the next sprint. The Feature Memory is never updated. Over time, the company loses track of what has been built, why decisions were made, and what the state of the product is. Caught when: a new engineer asks what a feature does and nobody can point to a written record, or a product decision is made that conflicts with a decision that was already made and not recorded.

**Response:** Phase 8 is part of the procedure, not optional cleanup. The Product Manager is responsible for completing it. The feature is not considered complete until the memory update is done.

---

## Anti-Patterns

**"Let's just build it and write the brief after."** A Feature Brief written after implementation is a description of what was built, not a specification of what should have been built. It does not function as a quality gate and does not protect the team from scope ambiguity. Briefs are written before Gate 1.

**Acceptance criteria written as user stories rather than conditions.** "The user can export their data" is not an acceptance criterion. "When the user clicks Export, a CSV file is downloaded containing all records associated with their account, with fields in the order specified in the design doc" is an acceptance criterion. QA validates against criteria, not stories.

**The Tech Lead merging their own code without review.** Code review is not a formality that can be waived because the Tech Lead is trusted or time is short. The Reviewer exists to provide a second perspective. Even excellent engineers write bugs. Even correct code may not align with how the rest of the system is designed.

**Documentation written for the engineer, not the user.** The Documentation Specialist produces user-facing documentation. It describes what the user can do and how to do it — not how the code is structured, what API calls are made, or what the implementation decisions were. The audience is a user who has never heard of the feature before.

**Treating memory updates as administrative overhead.** The Feature Memory is not a bureaucratic record — it is how the company accumulates and retains knowledge about what it has built. A company that does not maintain its memory makes the same decisions repeatedly, loses context between sprints, and cannot onboard new employees effectively. Memory updates are engineering work.
