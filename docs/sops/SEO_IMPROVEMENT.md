# SOP: SEO Improvement

**SOP ID:** SOP-007  
**Category:** Standard Operating Procedure  
**Owner:** Search Visibility Specialist  
**Version:** 1.0  

---

## Table of Contents

1. [Purpose](#purpose)
2. [Scope and Relationship to Other Procedures](#scope-and-relationship-to-other-procedures)
3. [Trigger](#trigger)
4. [Owner](#owner)
5. [Participants](#participants)
6. [Preconditions](#preconditions)
7. [Audit Dimensions](#audit-dimensions)
8. [Procedure](#procedure)
9. [Validation Evidence Standard](#validation-evidence-standard)
10. [Decision Gates Summary](#decision-gates-summary)
11. [Escalation Rules](#escalation-rules)
12. [Artifacts](#artifacts)
13. [Definition of Done](#definition-of-done)
14. [Memory Updates](#memory-updates)
15. [KPIs](#kpis)
16. [Failure Modes](#failure-modes)
17. [Anti-Patterns](#anti-patterns)

---

## Purpose

This procedure defines how Engineering OS plans, performs, validates, and documents a deliberate improvement to the search visibility of its public-facing surface. It exists to make search visibility work repeatable and evidence-based rather than a series of one-off, untracked tweaks.

An SEO improvement is distinct from the routine, per-feature search visibility review that happens inside [SOP-001: New Feature](./NEW_FEATURE.md). That review is a gate on new work. This procedure is the workflow for a focused initiative — auditing what already exists across metadata, structured data, sitemaps, crawlability, indexability, and content quality; identifying the highest-value opportunities; implementing the changes with the same engineering rigor as any other feature; and proving the change worked with recorded evidence.

The standards this procedure improves against are owned by the [Search Visibility Specialist handbook](../employees/SEO_SPECIALIST.md). This SOP does not redefine those standards. It defines the sequence of work, the handoffs, the validation evidence required, and what completion means. Every search visibility improvement initiative follows this procedure.

---

## Scope and Relationship to Other Procedures

This SOP covers improvements to:

- **Metadata** — title tags, meta descriptions, canonical tags, robots directives, language attributes, and Open Graph / social sharing markup.
- **Structured data** — schema markup correctness, completeness, and validity across page types.
- **Sitemaps** — inclusion and exclusion accuracy, freshness, and submission state.
- **Crawlability** — whether intended pages are reachable and discoverable, and whether crawl budget is being wasted on pages that should not be crawled.
- **Indexability** — whether intended pages are indexed and unintended pages are excluded.
- **Content quality** — structural and on-page signals (heading structure, internal linking, descriptive copy, duplicate content) that affect how a page is understood and ranked. Editorial content strategy remains owned by the Product Manager; this procedure improves the *structure and signals* of content, not its editorial intent.

This SOP does **not** cover:

- The per-feature search visibility review that gates new public pages — that is [SOP-001: New Feature](./NEW_FEATURE.md), Phase 6.
- The act of shipping the improvement to production — that follows [SOP-005: Release](./RELEASE.md).
- Reverting a change that degrades search visibility — that follows [SOP-006: Rollback](./ROLLBACK.md), with the regression treated per the handbook's regression triggers.

No platform-specific assumptions are made in this procedure. References to "search tooling," "the search index," "the crawler," and "a structured data validator" are deliberately generic; the procedure applies regardless of framework, hosting provider, or which search engines and tools the company uses.

---

## Trigger

This procedure is triggered when any of the following occurs:

- The weekly search visibility monitoring report (see the [Search Visibility Specialist handbook](../employees/SEO_SPECIALIST.md), Monitoring Standard) surfaces a recurring weakness or a trend worth a dedicated initiative.
- A confirmed regression requires more than a single targeted fix to restore (the immediate fix follows the handbook's regression path; a broader corrective initiative follows this SOP).
- The CEO or CTO sets an objective that depends on improved organic discoverability.
- A scheduled audit cadence (for example, quarterly) is reached.
- A significant structural change to the product — new public sections, a navigation redesign, or a URL-structure change — warrants a deliberate visibility pass beyond the per-feature review.

---

## Owner

**Search Visibility Specialist** — owns this procedure end-to-end: scoping the audit, prioritizing opportunities, specifying the changes, reviewing implementation, defining and confirming validation evidence, and closing the initiative record. The Search Visibility Specialist does not own product scope, content editorial, or frontend architecture, and does not implement application code directly; they specify and verify, and direct implementation through the Tech Lead and Frontend Engineer.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Search Visibility Specialist** | Initiative owner; audit; opportunity prioritization; change specifications; implementation review; validation evidence definition and confirmation; initiative record |
| **Product Manager** | Confirms business priority and acceptable trade-offs; owns any editorial/content decisions surfaced by the audit; approves changes that alter page intent or scope |
| **Tech Lead** | Routes specifications into the sprint; decomposes implementation tasks; confirms delivery readiness; coordinates engineering escalations |
| **Frontend Engineer** | Implements metadata, structured data, canonical/robots directives, Open Graph markup, sitemap generation, internal linking, and Core Web Vitals fixes as specified |
| **QA Engineer** | Validates that specified changes are present and correct in the candidate build as part of pre-release validation (see [SOP-004: QA Validation](./QA_VALIDATION.md)) |
| **Documentation Specialist / Technical Writer** | Reviews and aligns any documentation-page structural changes; authors the changelog and updates affected documentation (see [Technical Writer handbook](../employees/TECHNICAL_WRITER.md)) |
| **Analytics** *(when available)* | Provides search-traffic, impression, click-through, and ranking baselines and post-change measurement; consulted for opportunity sizing and validation evidence |
| **Release Manager** | Coordinates shipping the improvement under [SOP-005: Release](./RELEASE.md) |
| **CTO** | Approves de-indexing of significant page sets, architecture-level structured-data changes, and any change with strategic search-visibility risk |

> When a dedicated Analytics function is not yet staffed, the Search Visibility Specialist consumes the available search-tooling and analytics data directly and records that the Analytics role was unstaffed in the initiative record. The validation-evidence requirement is not waived; only the role performing measurement changes.

---

## Preconditions

Before the audit begins, all of the following must be true:

- [ ] The initiative has an explicit objective (what the improvement is meant to achieve) confirmed by the Product Manager or CTO.
- [ ] The current search-visibility baseline is captured or capturable: indexed page count, crawl coverage, structured-data validity state, and available ranking/impression/click-through data.
- [ ] The set of page types in scope is identified.
- [ ] Access to crawl data, indexation status, and a structured data validator is available.
- [ ] The applicable standards (metadata, structured data, indexing classification, URL structure, sitemap inclusion) are current in the [Search Visibility Specialist handbook](../employees/SEO_SPECIALIST.md).

---

## Audit Dimensions

The audit in Phase 1 evaluates every in-scope page type against each dimension below. Each dimension produces findings classified as **Required** (must be fixed for the initiative to meet its objective), **Recommended** (worth doing, prioritized by value), or **Flag** (tracked, not in this initiative's scope).

| Dimension | What is audited | Evidence captured |
|---|---|---|
| **Metadata** | Title tag, meta description, canonical tag, robots directive, language attribute — present, unique, accurate, within recommended ranges | Crawl audit export listing each page type's current values |
| **Open Graph / social** | `og:title`, `og:description`, `og:image`, `og:url`, `og:type` present and correct on pages with social-sharing intent | Crawl audit + rendered preview check |
| **Structured data** | Schema present where the page type warrants it; markup syntactically valid and semantically complete; rendering as expected in tooling | Structured data validator output per page type |
| **Sitemaps** | Sitemap reflects the canonical URL of every page intended for indexing; excludes `noindex` pages; is current | Sitemap diff vs. the live URL set |
| **Crawlability** | Intended pages are reachable and discoverable; crawl budget is not spent on pages that should not be crawled | Crawl-coverage report |
| **Indexability** | Intended pages are indexed; unintended pages carry `noindex` and are excluded; indexing classification matches the handbook | Indexation report vs. classification |
| **Content quality** | Heading structure, descriptive on-page copy, internal linking, and duplicate-content signals | Per-page-type structural review notes |
| **Core Web Vitals** | Public pages meet the performance thresholds that act as ranking signals | Performance report per page type |

---

## Procedure

### Phase 1: Search Visibility Audit

**Owner:** Search Visibility Specialist  
**Input:** Initiative objective; baseline data; in-scope page types  
**Output:** Audit report with classified findings across all eight dimensions  

**Steps:**

1. The **Search Visibility Specialist** captures the baseline: indexed page count, crawl coverage, structured-data validity, and the available ranking/impression/click-through data (with the **Analytics** role when staffed). The baseline is recorded as a dated snapshot — every later claim of improvement is measured against it.

2. The Search Visibility Specialist audits each in-scope page type against every dimension in [Audit Dimensions](#audit-dimensions), capturing the listed evidence for each.

3. Each finding is written specifically and is classified **Required**, **Recommended**, or **Flag**. A finding states the page type, the current state, the desired state, and how compliance will be verified. "Improve metadata" is not a finding; "Feature Overview pages share one meta description differing only by feature name; each requires a unique description under 155 characters describing that feature's user value" is a finding.

4. The Search Visibility Specialist routes any finding that touches content intent or page scope to the **Product Manager**, and any finding that touches documentation-page structure to the **Documentation Specialist** — neither is implemented without that owner's alignment.

**Gate 1:** Audit report is complete, evidence-backed, and findings are classified. Baseline snapshot is recorded.

---

### Phase 2: Opportunity Prioritization and Improvement Plan

**Owner:** Search Visibility Specialist  
**Input:** Audit report; baseline; business objective  
**Output:** Prioritized improvement plan with per-change specifications and expected outcomes  

**Steps:**

1. The **Search Visibility Specialist** sizes each finding by expected impact (traffic, indexation health, rich-result eligibility, ranking-signal strength) and implementation cost, consulting **Analytics** where available.

2. Required findings are scheduled first. Recommended findings are ordered by value. Flags are recorded for a future initiative.

3. For each change in the plan, the Search Visibility Specialist writes a specification the Frontend Engineer can implement without ambiguity: the exact target state, the affected page types, and the verification method. Specifications reference the handbook standards rather than restating them.

4. For each change, the plan states the **expected, measurable outcome** and the **validation evidence** that will prove it (see [Validation Evidence Standard](#validation-evidence-standard)). A change with no defined evidence does not enter the plan.

5. The Search Visibility Specialist reviews the plan with the **Product Manager** (business priority, trade-offs) and the **Tech Lead** (engineering feasibility and sequencing). Changes that would de-index a significant page set, or that require architecture-level structured-data changes, are escalated to the **CTO** for approval before entering the plan.

**Gate 2:** Improvement plan is approved by the Tech Lead (feasibility) and Product Manager (priority), with CTO approval recorded for any change requiring it. Every change has a specification and defined validation evidence.

---

### Phase 3: Implementation

**Owner:** Tech Lead (coordination); Frontend Engineer (execution)  
**Input:** Approved improvement plan with specifications  
**Output:** Implemented changes ready for review and validation  

**Steps:**

1. The **Tech Lead** decomposes the plan into tasks per the Task Decomposition Doctrine in [SOP-001: New Feature](./NEW_FEATURE.md) and assigns them to the **Frontend Engineer**.

2. The **Frontend Engineer** implements each change to its specification — metadata, structured data, canonical/robots directives, Open Graph markup, sitemap generation, internal-linking and content-structure changes, and Core Web Vitals fixes. Scope questions route through the Tech Lead, not directly to the Search Visibility Specialist.

3. The **Search Visibility Specialist** reviews each implementation against its specification before it proceeds — confirming, for example, that a canonical points to the intended URL form and that structured data is valid in tooling, not merely present.

4. Code is reviewed under [SOP-003: Code Review](./CODE_REVIEW.md). The Search Visibility Specialist's implementation review is in addition to, not a substitute for, code review.

5. The Tech Lead confirms Delivery Readiness before the changes move to validation.

**Gate 3:** All planned changes are implemented to specification, reviewed by the Search Visibility Specialist, code-reviewed, and Delivery Readiness is confirmed.

---

### Phase 4: Validation

**Owner:** Search Visibility Specialist (search-visibility evidence); QA Engineer (pre-release validation)  
**Input:** Implemented changes deployed to a staging or pre-production environment  
**Output:** Recorded validation evidence proving each change meets its specification  

**Steps:**

1. The changes are deployed to a non-production environment per [SOP-004: QA Validation](./QA_VALIDATION.md).

2. The **QA Engineer** validates, as part of feature validation for the affected public pages, that each specified metadata, structured data, and directive change is present and correct. QA records pass/fail per change.

3. The **Search Visibility Specialist** collects the validation evidence defined for each change in Phase 2 and confirms it against the specification — for example, validator output showing structured data is valid, a crawl export showing unique titles and descriptions, a sitemap diff, or a rendered social-preview check. Evidence is collected on the candidate build, not asserted from intent.

4. For changes whose outcome can only be measured post-indexation (rankings, impressions, indexed page count), the Search Visibility Specialist records the **pre-change baseline** and the **post-change measurement plan and window**, so the outcome is verified after release rather than assumed at release.

5. Any change that fails validation returns to Phase 3. A change is not carried to release on the expectation that it "should" work.

**Gate 4:** Every change has recorded validation evidence confirming it meets its specification, or a recorded post-release measurement plan for outcomes that can only be measured after indexation.

---

### Phase 5: Documentation and Release

**Owner:** Technical Writer (documentation); Release Manager (release)  
**Input:** Validated changes  
**Output:** Updated documentation and changelog; changes shipped to production  

**Steps:**

1. The **Technical Writer** updates any affected documentation and authors the changelog entry per the Changelog Standard in [SOP-005: Release](./RELEASE.md). The changelog describes user- and stakeholder-visible effects (for example, "richer search result previews for feature pages"), not implementation detail.

2. The **Search Visibility Specialist** updates the standards records in the [handbook](../employees/SEO_SPECIALIST.md) when the initiative changes a standard (a new indexing classification, a new structured-data specification, a revised metadata pattern).

3. The improvement ships under [SOP-005: Release](./RELEASE.md). The Search Visibility Specialist completes the search visibility review for the release and the **Release Manager** runs the Release Readiness Checklist.

4. After release, the **Search Visibility Specialist** updates the sitemap and confirms the live state matches the validated specifications.

**Gate 5:** Documentation and changelog are published; standards records are updated; the change is live in production and confirmed against specification.

---

### Phase 6: Post-Release Measurement and Memory Update

**Owner:** Search Visibility Specialist  
**Input:** Live changes; post-change measurement plan; baseline snapshot  
**Output:** Outcome verification; initiative record closed; memory updated  

**Steps:**

1. The **Search Visibility Specialist** monitors the post-release window per the handbook Monitoring Standard, watching for regressions introduced by the change and for the expected improvement to materialize.

2. At the end of the measurement window, the Search Visibility Specialist compares post-change measurements to the recorded baseline (with **Analytics** where available) and records the outcome: improvement confirmed, neutral, or regression.

3. A change that produces a regression is handled per the handbook regression path and, if it requires reverting, [SOP-006: Rollback](./ROLLBACK.md).

4. The Search Visibility Specialist closes the initiative record (see [Artifacts](#artifacts)) and updates company memory (see [Memory Updates](#memory-updates)).

**Gate 6:** Post-release outcome is measured against baseline and recorded. Initiative record is closed. Memory is updated.

---

## Validation Evidence Standard

Every claimed improvement is backed by evidence on file. "We updated the metadata" is not evidence; the recorded artifact that proves the metadata is now correct is evidence. Evidence is one of two kinds:

| Kind | When used | Required evidence |
|---|---|---|
| **Build evidence** (verifiable at release) | Metadata, structured data, canonical/robots directives, Open Graph, sitemap content, internal-linking and content-structure changes, Core Web Vitals on staging | The validator output, crawl export, sitemap diff, rendered preview, or performance report captured on the candidate build, showing the specified target state |
| **Outcome evidence** (verifiable post-indexation) | Indexed page count, ranking, impressions, click-through, crawl coverage at scale | The recorded pre-change baseline plus the post-change measurement taken at the end of the defined window, compared against baseline |

Rules:

1. Every change in the improvement plan names its evidence kind and the specific artifact before implementation begins (Phase 2).
2. Build evidence is collected at Gate 4 and stored in the initiative record.
3. Outcome evidence requires a recorded baseline before the change ships and a measurement at a defined window after; the initiative is not closed until outcome evidence is recorded (Gate 6).
4. Evidence is captured from tooling output, not asserted from the author's expectation.
5. The same evidence standard applies whether or not a dedicated Analytics function is staffed; only the role collecting it changes.

---

## Decision Gates Summary

| Gate | Condition | Owner of Gate |
|---|---|---|
| Gate 1 | Audit complete; findings classified; baseline recorded | Search Visibility Specialist |
| Gate 2 | Improvement plan approved; each change specified with defined evidence | Tech Lead + Product Manager (CTO where required) |
| Gate 3 | Changes implemented to spec; reviewed; Delivery Readiness confirmed | Tech Lead |
| Gate 4 | Validation evidence recorded for every change | Search Visibility Specialist + QA Engineer |
| Gate 5 | Documentation/changelog published; standards updated; change live | Release Manager |
| Gate 6 | Post-release outcome measured against baseline; record closed | Search Visibility Specialist |

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| A change in the plan would de-index a significant set of pages | CTO | Before the change enters the approved plan |
| Structured-data improvement requires architecture-level frontend change | CTO, Tech Lead | Before specification is finalized |
| A finding touches editorial/content intent | Product Manager | When the finding is written |
| A finding requires documentation-page structural change | Documentation Specialist | Before any implementation is requested |
| Required implementation is delayed beyond the sprint | Tech Lead | When the delay is identified |
| Post-release measurement confirms a regression caused by the initiative | CTO, Tech Lead | Same day the regression is confirmed |
| Outcome evidence cannot be obtained (no measurement data available) | CTO | Before the initiative is closed |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Baseline snapshot | Search Visibility Specialist | Phase 1 |
| Audit report (findings across all dimensions) | Search Visibility Specialist | Phase 1 |
| Improvement plan (prioritized, with per-change specs and defined evidence) | Search Visibility Specialist | Phase 2 |
| Implementation tasks | Tech Lead | Phase 3 |
| Validation evidence set | Search Visibility Specialist / QA Engineer | Phase 4 |
| Changelog entry | Technical Writer | Phase 5 |
| Updated standards records | Search Visibility Specialist | Phase 5 |
| Post-release outcome measurement | Search Visibility Specialist | Phase 6 |
| Initiative record | Search Visibility Specialist | Phase 6 |

---

## Definition of Done

An SEO improvement initiative is done when all of the following are true:

- [ ] A dated baseline snapshot was captured before any change was made
- [ ] The audit covered metadata, Open Graph, structured data, sitemaps, crawlability, indexability, content quality, and Core Web Vitals for every in-scope page type
- [ ] Every change had a written specification and a defined validation evidence requirement before implementation
- [ ] All implemented changes were reviewed by the Search Visibility Specialist and code-reviewed
- [ ] Build evidence is recorded for every change verifiable at release
- [ ] Outcome evidence (post-release measurement vs. baseline) is recorded for every change whose effect is only measurable after indexation
- [ ] No unintended de-indexation or structured-data regression was introduced (or any regression is resolved and recorded)
- [ ] Documentation and changelog are published; affected standards records are updated
- [ ] The change is live in production and confirmed against specification
- [ ] The initiative record is closed and company memory is updated

---

## Memory Updates

After each initiative, the following memory records are updated:

| Record | Content | Owner |
|---|---|---|
| Initiative record | Objective, baseline, audit findings, plan, evidence, outcome | Search Visibility Specialist |
| Metadata / structured data / indexing standards | Any standard changed by the initiative | Search Visibility Specialist |
| Sitemap inclusion criteria | Any change to what is included or excluded | Search Visibility Specialist |
| URL change log | Any URL change made by the initiative | Search Visibility Specialist |
| Changelog | User- and stakeholder-visible effects of the improvement | Technical Writer |
| Documentation library | Any documentation updated as part of the initiative | Documentation Specialist |
| Monitoring report | The post-release outcome and any regression observed | Search Visibility Specialist |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Evidence-backed changes | 100% — every shipped change has recorded build or outcome evidence | Initiative records |
| Baseline capture | 100% — every initiative records a baseline before any change | Initiative records |
| Required-finding closure | 100% of Required findings resolved before the initiative closes | Audit report vs. initiative record |
| Regression introduced by an initiative | 0 unresolved regressions caused by an SEO improvement | Monitoring reports |
| Structured-data validity after initiative | 100% of touched structured data passes validation | Structured data validator |
| Outcome confirmation | Outcome measured against baseline for 100% of post-indexation changes | Initiative records |
| Time from regression detection to resolution | Within the handbook regression window | Monitoring report vs. regression report timestamps |

---

## Failure Modes

### Changes shipped without recorded evidence
The improvement is implemented, looks correct in a quick manual check, and ships. No validator output, crawl export, or sitemap diff is stored. Months later a regression appears and there is no record of the state the initiative actually delivered. Caught when: a post-hoc audit cannot determine what the initiative changed or whether it ever worked.

**Response:** Build evidence is collected at Gate 4 for every change, and outcome evidence at Gate 6. A change with no defined evidence does not enter the plan (Gate 2). The initiative does not close until the evidence is on file.

### Improving signals on pages that should not be indexed
The audit finds weak metadata across many pages and the initiative improves all of them — including authentication, account, and utility pages that should carry `noindex`. Effort is spent making invisible pages "better," and in the worst case a page that should be excluded becomes more discoverable. Caught when: the indexing classification is checked against the page set and mismatches appear.

**Response:** Indexability and crawlability are audited first (Phase 1) and the indexing classification from the handbook governs which pages are in scope. The initiative improves the signals of pages that *should* be found and confirms the exclusion of pages that should not.

### Optimizing for a metric instead of the user
The initiative chases a single number — keyword density, title length, an impression count — and produces templated, keyword-stuffed metadata that reads as low quality to both users and search tooling. Caught when: search tooling flags low-quality or duplicative metadata, or click-through declines despite higher impressions.

**Response:** Content-quality and metadata findings are written against the user-value standard in the handbook, not against a single metric. Each page requires metadata that accurately represents its specific content. Outcome evidence measures real signals (rankings, click-through), not a proxy that can be gamed.

### Structured data added in bulk without validation
To capture rich results quickly, structured data is added across many page types at once and shipped without validating each. Invalid markup ships, which is worse than no markup — it can trigger tooling warnings or incorrect result rendering. Caught when: the search tooling reports structured-data errors after release.

**Response:** Structured data is validated in tooling at Gate 4 for every page type before release, and the validator output is the recorded evidence. Bulk changes do not waive per-type validation.

### Outcome never measured
The changes ship and the team moves on. The post-release measurement window is never checked, so whether the initiative achieved its objective is unknown, and a regression introduced by the change goes unnoticed. Caught when: a later report shows a decline that began at the initiative's release date.

**Response:** Phase 6 is part of the procedure, not optional follow-up. The initiative is not closed until the post-release outcome is measured against the recorded baseline and the result is recorded.

---

## Anti-Patterns

**Treating an SEO improvement as a batch of untracked tweaks.** A pile of small metadata edits with no audit, no plan, no evidence, and no baseline is not an improvement initiative — it is undocumented churn that cannot be evaluated or reversed cleanly. Every initiative has a baseline, a plan, and evidence.

**Auditing only metadata.** Metadata is the most visible dimension, so it absorbs all the attention while crawlability, indexability, sitemap accuracy, structured-data validity, content structure, and Core Web Vitals go unexamined. A title-tag pass on a site that is wasting crawl budget on pages that should be excluded has improved the wrong thing. The audit covers all eight dimensions.

**Claiming improvement from intent.** "This will improve rankings" is a hypothesis, not a result. Build evidence proves the change was delivered correctly; outcome evidence proves it had the intended effect. Both are recorded.

**Bypassing the content and documentation owners.** The Search Visibility Specialist owns how pages are represented to search engines, not what they say. Findings that change content intent go to the Product Manager; findings that change documentation structure go to the Documentation Specialist. Implementing around those owners produces conflict and rework.

**Shipping the improvement outside the release process.** Search visibility changes are production changes. They go through [SOP-005: Release](./RELEASE.md) with a search visibility review and a Release Readiness Checklist — not as a side channel because they are "just metadata." A `noindex` shipped by accident is as damaging as any production defect.
