# SOP: Documentation Update

**SOP ID:** SOP-008  
**Category:** Standard Operating Procedure  
**Owner:** Documentation Specialist (Technical Writer)  
**Version:** 1.0  
**Status:** Approved  
**Last Updated:** 2026-06-29  

---

## Purpose

This procedure defines when and how Engineering OS updates its written company knowledge as part of completed work. It establishes that documentation is not a downstream chore performed when time allows — it is a deliverable of delivery itself. A unit of work is not done when its code merges; it is done when the knowledge the work created or changed has been written down, reviewed, and made findable.

Engineering OS accumulates value in two forms: the software it ships and the knowledge it retains about that software. The second form is fragile. Undocumented decisions become invisible, undocumented features become unsupportable, and undocumented incidents repeat. This SOP exists to make written knowledge a structural part of every workflow — feature, fix, architecture change, release, and incident — so the company's understanding of itself stays current as the product changes underneath it.

The Documentation Specialist owns the standard, the review, and the completeness of every documentation update. The author of the change owns the technical accuracy of what is written. This division is permanent: the engineer is accountable for *what is true*; the Documentation Specialist is accountable for *how it is written and whether it is complete*. Neither role substitutes for the other.

This SOP does not replace the documentation phases embedded in other procedures. It is the connective standard that those procedures reference. See [SOP-001: New Feature](./NEW_FEATURE.md) (Phase 6), [SOP-002: Bug Fix](./BUG_FIX.md), [SOP-005: Release](./RELEASE.md) (Changelog Standard), and [SOP-006: Rollback](./ROLLBACK.md) for the workflow contexts in which this SOP is invoked.

---

## Trigger

This procedure is triggered whenever completed or in-flight work changes what is true about the product, its architecture, its operation, or its history. Specifically:

- A feature is approved for development and enters [SOP-001: New Feature](./NEW_FEATURE.md) — documentation drafting begins in parallel with implementation, not after it.
- A defect is being fixed under [SOP-002: Bug Fix](./BUG_FIX.md) and the fix changes user-visible behavior, corrects documented behavior, or reveals a root cause worth recording.
- An architecture or system design decision is made that future engineers must understand to maintain or extend the system.
- A release is being assembled under [SOP-005: Release](./RELEASE.md) and requires a changelog and verified documentation readiness.
- A production incident or rollback occurs under [SOP-006: Rollback](./ROLLBACK.md) and produces a post-incident record and any required corrections to user-facing or operational documentation.
- An existing document is discovered to be inaccurate, stale, or contradicted by current behavior — regardless of what work surfaced the discrepancy.

A trigger fires even when the change feels too small to document. The judgment "this is too minor to write down" is the most common origin of documentation drift and is explicitly not a valid reason to skip this procedure.

---

## Owner

**Documentation Specialist (Technical Writer)** — owns this procedure end to end. The Documentation Specialist determines which documentation updates a unit of work requires, sets and enforces the documentation standard, reviews every update for completeness and clarity, and holds authority to block a release when required documentation is not ready. The Documentation Specialist does not own the technical accuracy of engineering claims; the author of the change does.

See the [Documentation Specialist handbook](../employees/TECHNICAL_WRITER.md) for the role's full authority, scope, and quality standard.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Documentation Specialist** | Owns the procedure; determines required updates; sets and enforces the documentation standard; reviews all updates for completeness and clarity; authors changelogs and release notes; confirms documentation readiness; blocks release when documentation is not ready |
| **Product Manager** | Confirms user-facing framing and intent; reviews feature documentation for alignment with the Feature Brief; updates [Feature Memory](../memory/FEATURE_MEMORY.md) |
| **Engineering** (Backend / Frontend / AI / Infrastructure) | Author of the change; accountable for technical accuracy of what is documented; supplies the technical substance; verifies code samples and API contracts |
| **Tech Lead** | Identifies documentation requirements during technical planning; authors or co-authors architecture decision records; confirms architectural decisions are recorded |
| **Reviewer** | Confirms during code review that required documentation updates exist and are linked; treats missing documentation as a review finding |
| **QA Engineer** | Confirms documented behavior matches validated behavior in staging; reports documentation/behavior mismatches as defects |
| **Release Manager** | Confirms documentation readiness as a release gate; will not issue a go decision without written documentation-readiness confirmation |
| **CTO** | Approves architecture decision records that set durable technical direction; receives escalations when documentation completeness blocks a release |

---

## Document Types

Engineering OS maintains distinct classes of written knowledge. Each class has a defined owner, audience, and home. This SOP governs updates to all of them.

| Document Type | Audience | Home | Primary Owner |
|---|---|---|---|
| User-facing product documentation | Users | Product docs | Documentation Specialist |
| API documentation | Integrators, engineers | API reference | Backend Engineer (content) / Documentation Specialist (form) |
| Changelog / release notes | Users, stakeholders | Release records | Documentation Specialist |
| Architecture documentation | Engineers | [docs/architecture/](../architecture/) | Tech Lead / CTO (content) / Documentation Specialist (form) |
| Architecture Decision Records (ADRs) | Engineers | [docs/adr/](../adr/) | Tech Lead / CTO |
| Standard Operating Procedures | The organization | [docs/sops/](.) | Procedure owner |
| Feature Memory | The company | [docs/memory/FEATURE_MEMORY.md](../memory/FEATURE_MEMORY.md) | Product Manager |
| Decision Memory | The company | [docs/memory/DECISION_MEMORY.md](../memory/DECISION_MEMORY.md) | Tech Lead |
| Repository Knowledge | Engineers | [docs/memory/REPOSITORY_KNOWLEDGE.md](../memory/REPOSITORY_KNOWLEDGE.md) | Tech Lead |
| Company Memory | The company | [docs/memory/COMPANY_MEMORY.md](../memory/COMPANY_MEMORY.md) | CTO |
| Incident / post-mortem records | The organization | Incident records | Monitoring Engineer / Tech Lead |
| Learning records | The organization | [docs/memory/LEARNING_ENGINE.md](../memory/LEARNING_ENGINE.md) | Owning role |

The Documentation Specialist owns the *form* of all of these — voice, structure, terminology, findability — and owns the *content* of user-facing documentation and changelogs directly. For all other types, the named role owns the content and the Documentation Specialist reviews for completeness and clarity.

---

## Required Updates by Work Type

The core rule of this SOP: every category of work has a defined set of documentation updates that are part of its Definition of Done. The table below is the authoritative mapping. Work in a category does not reach "done" until its required updates are complete and reviewed.

| Work Type | Required Documentation Updates |
|---|---|
| **Feature** ([SOP-001](./NEW_FEATURE.md)) | User-facing feature documentation; API documentation (if the feature exposes or changes an API); release notes; [Feature Memory](../memory/FEATURE_MEMORY.md) entry; ADR for any architectural decision made during development; updates to any existing document the feature changes |
| **Bug Fix** ([SOP-002](./BUG_FIX.md)) | Correction of any documentation that described the buggy behavior; changelog entry for user-visible fixes; root-cause and prevention note in the defect record; [Learning](../memory/LEARNING_ENGINE.md) record if the fix reveals a systemic gap |
| **Architecture / System Change** | An [ADR](../adr/) capturing the decision, alternatives, and rationale; updates to affected [architecture documentation](../architecture/); [Decision Memory](../memory/DECISION_MEMORY.md) and [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md) updates; migration guide if the change requires action by operators or users |
| **Release** ([SOP-005](./RELEASE.md)) | Changelog per the [Release Changelog Standard](./RELEASE.md#changelog-standard); confirmation that all in-scope feature and fix documentation is published; release record |
| **Incident / Rollback** ([SOP-006](./ROLLBACK.md)) | Post-incident record (timeline, impact, root cause, corrective actions); corrections to any documentation that misled or contributed; operational runbook update if the response exposed a gap; [Learning](../memory/LEARNING_ENGINE.md) record |

If a unit of work spans multiple categories — for example, a feature that also makes an architecture decision — it inherits the required updates of every category it touches.

---

## Preconditions

Before a documentation update is considered started:

- [ ] The work that triggers the update is identified and scoped (a Feature Brief, defect record, ADR, release scope, or incident record exists)
- [ ] The Documentation Specialist has determined which document types this work requires updating, using the Required Updates by Work Type mapping
- [ ] The author of the technical substance is identified and available to supply or verify content
- [ ] The home for each updated document is known (existing page to update, or location for a new one)

---

## Procedure

### Phase 1: Determine Required Updates

**Owner:** Documentation Specialist  
**Input:** The triggering work item (Feature Brief, defect record, planned architecture change, release scope, or incident)  
**Output:** A documentation update plan — the list of documents to create or change, with owners  

**Steps:**

1. The **Documentation Specialist** classifies the work by type and applies the Required Updates by Work Type mapping to produce the list of required documentation updates.
2. For features, this happens during [SOP-001](./NEW_FEATURE.md) Phase 2 (Technical Planning), so drafting can begin in parallel with implementation in Phase 3. Documentation is never first scoped after QA completes.
3. The **Documentation Specialist** names a content owner for each required update (the engineer for API/technical content, the Tech Lead/CTO for ADRs, the Product Manager for feature framing, and the Documentation Specialist for user-facing prose and changelogs).
4. The **Documentation Specialist** records the documentation update plan against the work item so the Reviewer and Release Manager can later verify completeness.

**Gate 1:** The documentation update plan exists and names a content owner for every required update.

---

### Phase 2: Draft

**Owner:** Documentation Specialist (prose); content owners (technical substance)  
**Input:** The documentation update plan; the substance of the change  
**Output:** Draft documents ready for review  

**Steps:**

1. **Content owners** supply the technical substance: engineers provide API contracts, behaviors, and verified code samples; the Tech Lead/CTO provide architecture rationale and alternatives for ADRs; the Product Manager provides intent and user framing.
2. The **Documentation Specialist** drafts user-facing documentation, changelog entries, and release notes to the company documentation standard — consistent voice, terminology, and structure.
3. Drafting proceeds in parallel with implementation. For features, the Documentation Specialist begins as soon as [SOP-001](./NEW_FEATURE.md) Phase 3 is underway; for architecture changes, the ADR is drafted as the decision is made, not reconstructed afterward.
4. Where a change makes existing documentation inaccurate, the **Documentation Specialist** updates the existing document in the same cycle rather than leaving a known-stale page in place.

**Gate 2:** All required documents have a complete draft. No required document is left unstarted.

---

### Phase 3: Review

**Owner:** Documentation Specialist (completeness and clarity); content owner (technical accuracy)  
**Input:** Draft documents  
**Output:** Reviewed documents with all blocking findings resolved  

**Steps:**

1. The **content owner** (engineer, Tech Lead, or Product Manager) reviews the draft for technical accuracy and confirms that every factual claim is correct.
2. The **Documentation Specialist** reviews for completeness, clarity, consistency with the style guide, and findability. Findings are classified:
   - **Blocking:** factual error, missing required content, or a defect that makes the document unusable — must be resolved before approval
   - **Non-blocking:** an improvement that should be addressed but does not block
   - **Question:** a clarification request that does not block
3. For features, the **Reviewer** confirms during [SOP-003: Code Review](./CODE_REVIEW.md) that the required documentation updates exist and are linked from the change. Missing required documentation is a review finding, not an afterthought.
4. The **QA Engineer**, during [SOP-004: QA Validation](./QA_VALIDATION.md), confirms that documented behavior matches the behavior validated in staging. A mismatch is reported as a defect against either the documentation or the implementation.
5. Content owners resolve all Blocking findings; the Documentation Specialist re-reviews and confirms resolution.

See the [Review Rules](#review-rules) and [Approval Rules](#approval-rules) sections for the standard applied here.

**Gate 3:** Technical accuracy confirmed by the content owner; completeness and clarity confirmed by the Documentation Specialist; all Blocking findings resolved.

---

### Phase 4: Publish and Confirm Readiness

**Owner:** Documentation Specialist  
**Input:** Reviewed and approved documents  
**Output:** Published documentation; readiness confirmed to the Release Manager  

**Steps:**

1. The **Documentation Specialist** publishes the approved documents to their homes and ensures each is indexed and findable from where a reader would look for it.
2. For changes that ship in a release, the **Documentation Specialist** provides written documentation-readiness confirmation to the **Release Manager**, satisfying the documentation gate in [SOP-005: Release](./RELEASE.md). The Release Manager does not issue a go decision without it.
3. The **Documentation Specialist** confirms the changelog is authored, reviewed, and ready to publish the moment the deployment succeeds — never written retroactively in the hour after deployment.
4. Where documentation publication must be timed to deployment (for example, a feature guide for a feature not yet live), the Documentation Specialist coordinates timing with the Release Manager.

**Gate 4:** Required documentation is published and findable; written documentation-readiness confirmation is on record for any release.

---

### Phase 5: Memory and Knowledge Update

**Owner:** Documentation Specialist (coordination); named memory owners (content)  
**Input:** Published documentation; completed work  
**Output:** Company memory and knowledge records updated  

**Steps:**

1. The **Product Manager** updates [Feature Memory](../memory/FEATURE_MEMORY.md) for features: what the feature does, acceptance criteria as shipped, the release it shipped in, and key decisions.
2. The **Tech Lead** records architectural decisions in [Decision Memory](../memory/DECISION_MEMORY.md) and updates [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md) where the change alters how the codebase is understood.
3. The owning role records [Learning](../memory/LEARNING_ENGINE.md) outcomes for fixes and incidents that reveal a systemic gap.
4. The **Documentation Specialist** confirms that all documentation written for the work is indexed, linked, and findable, and that no required memory update from the Required Updates mapping is outstanding.

**Gate 5:** All required memory and knowledge records are updated. Published documentation is indexed and cross-linked.

---

## Review Rules

Documentation is reviewed against two independent standards, and both must pass before a document is approved.

| Standard | Reviewer | What it checks |
|---|---|---|
| **Technical accuracy** | Content owner (engineer, Tech Lead, or CTO) | Every factual claim is correct; behaviors, contracts, and samples match the implementation |
| **Completeness and clarity** | Documentation Specialist | Required content is present; the document answers the reader's question; voice, terminology, and structure follow the style guide; the document is findable |

Rules:

- A document is not approved until both standards pass. Clear writing about incorrect behavior, and correct facts written unintelligibly, are both failures.
- The Reviewer treats absence of a required documentation update as a Blocking code-review finding under [SOP-003: Code Review](./CODE_REVIEW.md).
- The QA Engineer treats a documentation/behavior mismatch as a defect under [SOP-004: QA Validation](./QA_VALIDATION.md).
- User-facing documentation is reviewed against the test: *would a reader who has never seen this feature understand what changed and what to do, without reading the code?* If not, it is not ready.
- Changelogs are held to the [Release Changelog Standard](./RELEASE.md#changelog-standard) — user-facing language, not commit messages or internal ticket IDs.

---

## Approval Rules

| Document Type | Approves Technical Accuracy | Approves Completeness / Clarity | Additional Approval |
|---|---|---|---|
| User-facing product documentation | Owning engineer | Documentation Specialist | Product Manager confirms framing |
| API documentation | Owning engineer | Documentation Specialist | — |
| Changelog / release notes | — | Documentation Specialist | Release Manager approves for publication |
| Architecture documentation | Tech Lead | Documentation Specialist | — |
| Architecture Decision Record (ADR) | Tech Lead | Documentation Specialist | CTO approves direction-setting decisions |
| Incident / post-mortem record | Tech Lead / Monitoring Engineer | Documentation Specialist | — |
| Memory updates | Named memory owner | Documentation Specialist (findability) | — |

Rules:

- The Documentation Specialist holds final authority over completeness and clarity for every document type and may block publication on that basis.
- The CTO approves ADRs that set durable technical direction. The Tech Lead may approve ADRs scoped to a single system at their level.
- No document is published while a Blocking finding is open against it.

---

## Decision Gates Summary

| Gate | Condition | Owner of Gate |
|---|---|---|
| Gate 1 | Documentation update plan exists with content owners named | Documentation Specialist |
| Gate 2 | All required documents have a complete draft | Documentation Specialist |
| Gate 3 | Technical accuracy and completeness confirmed; Blocking findings resolved | Documentation Specialist |
| Gate 4 | Required documentation published; release readiness confirmed in writing | Documentation Specialist |
| Gate 5 | Memory and knowledge records updated; documentation indexed | Documentation Specialist |

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| Required documentation is not ready at the release gate | CTO | When the Release Manager is blocked from issuing a go |
| Content owner is unavailable to verify technical accuracy before the deadline | Tech Lead, then CTO | When accuracy cannot be confirmed in time |
| An ADR records a decision that conflicts with an existing recorded decision | CTO | On discovery |
| Engineering disputes a Documentation Specialist Blocking finding on completeness | CTO | When the dispute cannot be resolved between the two roles |
| A published document is found to have shipped a material inaccuracy | CTO, Documentation Specialist | Immediately on discovery; correction prioritized |
| Documentation is repeatedly deferred across multiple work items | CTO | When a pattern of skipped updates is identified |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Documentation update plan | Documentation Specialist | Phase 1 |
| Feature documentation | Documentation Specialist | Phase 2–4 |
| API documentation update | Backend Engineer / Documentation Specialist | Phase 2–4 |
| Architecture Decision Record (ADR) | Tech Lead / CTO | Phase 2–4 |
| Architecture documentation update | Tech Lead / Documentation Specialist | Phase 2–4 |
| Changelog / release notes | Documentation Specialist | Phase 2–4 |
| Documentation-readiness confirmation | Documentation Specialist | Phase 4 |
| Post-incident record | Monitoring Engineer / Tech Lead | Phase 2–4 |
| Memory updates (Feature / Decision / Repository / Learning) | Named memory owners | Phase 5 |

---

## Definition of Done

A documentation update is done when all of the following are true:

- [ ] The documentation update plan was created and every required update from the Required Updates by Work Type mapping is accounted for
- [ ] Every required document is drafted, reviewed for technical accuracy by the content owner, and reviewed for completeness and clarity by the Documentation Specialist
- [ ] All Blocking findings are resolved
- [ ] Required documentation is published, indexed, and findable
- [ ] For releases, written documentation-readiness confirmation is on record with the Release Manager
- [ ] The changelog (for user-visible changes) is published per the Release Changelog Standard
- [ ] ADRs are recorded for architectural decisions and approved at the correct level
- [ ] All required memory and knowledge records (Feature, Decision, Repository, Learning) are updated
- [ ] No existing document made inaccurate by the change was left stale

A unit of work whose documentation Definition of Done is not met is not complete, regardless of the state of its code.

---

## Memory Updates

After a documentation update completes, the following records are confirmed current:

| Record | Content | Owner |
|---|---|---|
| [Feature Memory](../memory/FEATURE_MEMORY.md) | What shipped, acceptance criteria as shipped, release version, key decisions | Product Manager |
| [Decision Memory](../memory/DECISION_MEMORY.md) | Architectural and technical decisions and their rationale | Tech Lead |
| [Repository Knowledge](../memory/REPOSITORY_KNOWLEDGE.md) | Structural or architectural changes to how the codebase works | Tech Lead |
| [Company Memory](../memory/COMPANY_MEMORY.md) | Standards, conventions, or company-wide rules that changed | CTO |
| [Learning Engine](../memory/LEARNING_ENGINE.md) | Lessons from fixes and incidents that reveal systemic gaps | Owning role |
| Documentation index | Confirmation that all published documents are linked and findable | Documentation Specialist |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Documentation at release | 100% — every release ships with its required documentation published | Release records |
| Required-update completion | 100% — every work item completes the updates its type requires | Work records |
| Documentation/behavior mismatches found in QA | Downward trend; zero shipped to production | QA defect records |
| Changelog published within 1 hour of deployment | >95% | Release records |
| ADR coverage for architectural decisions | 100% — no architectural decision ships without a recorded ADR | Decision Memory audit |
| Stale-document corrections | Tracked; documents corrected in the same cycle as the change that made them stale | Documentation audit |
| Memory update completion | 100% — required memory records updated within one sprint of completion | Memory audit |

---

## Failure Modes

### Documentation treated as a post-release task
Work ships, the team moves to the next item, and documentation is scheduled for "later." Later never arrives. The feature is live and undocumented; support volume rises and the feature is underused. Caught when: a documentation audit or a support pattern reveals an undocumented shipped capability.

**Response:** Documentation drafting begins in parallel with implementation (Phase 2), and documentation readiness is a release gate. The Release Manager does not issue a go without written documentation-readiness confirmation. There is no "after release" slot for required documentation.

### A code change silently invalidates existing documentation
An engineer changes a behavior that an existing document describes. The code review focuses on the code; the now-incorrect document is never touched. Users follow documentation that no longer matches the product. Caught when: a user reports that the documented steps do not work, or QA finds a documentation/behavior mismatch.

**Response:** The Required Updates mapping makes "updates to any existing document the change affects" an explicit deliverable. The Reviewer treats a missing documentation update as a Blocking finding. Stale documents are corrected in the same cycle as the change that staled them.

### Architecture decisions made but never recorded
A significant technical decision is made in a discussion or a pull request and is never captured in an ADR. Months later, an engineer reverses it without knowing it was deliberate, or relitigates a settled question. Caught when: a decision is questioned and no record of the original rationale exists.

**Response:** Every architectural decision requires an ADR recorded as the decision is made — not reconstructed afterward. The Tech Lead confirms architectural decisions are recorded as part of the work's Definition of Done; the CTO approves direction-setting ADRs.

### Changelog written as an afterthought
The changelog is produced in the hour after deployment, by whoever is available, from commit messages, to satisfy a checklist item. It lists internal ticket IDs and implementation detail and tells the user nothing. Caught when: a stakeholder reads the changelog and cannot tell what changed.

**Response:** The changelog is authored before deployment, reviewed against the [Release Changelog Standard](./RELEASE.md#changelog-standard), and ready to publish the moment the deployment succeeds. It is a user-facing document; technical detail belongs in the release record.

### Incident learnings never written down
A production incident is resolved, the system is restored, and everyone moves on. No post-incident record is written, no contributing documentation is corrected, and no operational gap is closed. The same incident recurs. Caught when: a near-identical incident occurs and the response is no faster than the first time.

**Response:** Incidents and rollbacks under [SOP-006](./ROLLBACK.md) require a post-incident record and any corrective documentation as part of closing the incident. A learning record is filed when the incident reveals a systemic gap. The incident is not closed until its written knowledge exists.

---

## Anti-Patterns

**"The code is the documentation."** Source code records what the system does; it does not record what it is for, what alternatives were rejected, or how a user accomplishes a task. A reader who must read the implementation to understand the product has been failed by the documentation, not served by the code.

**Documentation written for the engineer, not the reader.** User-facing documentation that describes API calls, internal structure, or implementation decisions is engineering notes, not user documentation. The audience is a reader who has never seen the feature. Internal detail belongs in architecture docs and ADRs, not in the user guide.

**Skipping the update because the change is "minor."** The judgment that a change is too small to document is the single most common cause of documentation drift. Minor changes accumulate into a product that no longer matches its documentation. If the change altered what is true, it requires the update its type defines.

**Treating accuracy review and clarity review as interchangeable.** A document that an engineer confirmed is technically correct is not therefore complete or clear, and a well-written document is not therefore accurate. Both reviews are required, by different roles, and neither substitutes for the other.

**Memory updates as administrative overhead.** Feature, Decision, and Repository memory are how the company retains what it has learned. A company that does not maintain its memory makes the same decisions twice, loses context between sprints, and cannot onboard new employees. Memory updates are engineering work and are part of the Definition of Done — not optional cleanup.
