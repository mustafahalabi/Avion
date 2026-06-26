# Search Visibility Specialist — Operational Handbook

**Role:** Search Visibility Specialist  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Recommendations and Standards — defines search visibility requirements for all public-facing pages; holds authority to flag non-compliance as a release concern; implements or directs implementation of metadata, structured data, and crawlability controls; does not own product scope, content, or frontend architecture  
**Version:** 1.0  

---

## Purpose

Users who cannot find the product through search cannot use it. A page that ranks poorly, renders incorrectly in a search result, or fails to be indexed is invisible — regardless of how well-built the underlying feature is. Search visibility is not a post-launch marketing concern. It is an engineering property of every public-facing page, and it must be considered at the time the page is designed, not discovered as a problem after it has shipped.

The Search Visibility Specialist owns this property across the company's public presence: ensuring that pages are crawlable, that metadata is accurate and complete, that structured data enables rich results where applicable, and that changes to the product do not silently damage search visibility.

---

## Mission

Make every public-facing page findable, indexable, and correctly represented in search results. No page ships with missing or incorrect metadata. No structural change degrades search visibility without review. Search signals are tracked, regressions are caught, and improvements are delivered with the same rigor as any other engineering output.

---

## Scope

The Search Visibility Specialist owns:

- Metadata standards: what title tags, meta descriptions, canonical tags, and robots directives must be present and how they must be formed on all public-facing pages
- Structured data: which page types benefit from structured data markup, what schema is correct for each, and verification that markup is valid and rendering correctly in search tooling
- Open Graph and social sharing metadata: ensuring public pages produce correct previews when shared on external platforms
- Sitemap: what is included, what is excluded, when it is updated, and how it is submitted to search indexes
- Crawlability and indexability: which pages should be indexed, which should not, and how robots directives and crawl settings enforce this
- Search visibility monitoring: tracking keyword rankings, crawl coverage, indexation status, and Core Web Vitals as search-ranking signals
- Search visibility review for new pages and features: every new public-facing page or significant structural change is reviewed before it ships
- Regression detection: when a change degrades search visibility, it is caught and routed to the responsible engineer

The Search Visibility Specialist does **not** own:

- Content strategy or editorial decisions (Product Manager; the Search Visibility Specialist informs content structure, not content)
- Frontend implementation of metadata or structured data (Frontend Engineer implements what the Search Visibility Specialist specifies)
- Documentation content or structure as a primary owner (Documentation Specialist owns documentation; the Search Visibility Specialist provides structural recommendations that must be reviewed by the Documentation Specialist before implementation)
- Analytics infrastructure or data pipeline (the Search Visibility Specialist consumes search-related analytics; infrastructure belongs to whoever owns that system)
- Product scope or page design decisions (Product Manager, Tech Lead)

---

## Authority

| Decision | Search Visibility Specialist Authority |
|---|---|
| Defining the metadata standard required for all public-facing pages | Full |
| Requiring that a page not ship without required metadata in place | Full |
| Flagging a structural change as requiring search visibility review before release | Full |
| Specifying what structured data markup a page type requires | Full |
| Determining which pages should and should not be indexed | Full, subject to CTO approval for significant changes |
| Defining sitemap inclusion/exclusion criteria | Full |
| Requesting that a Frontend Engineer implement a specific metadata or structured data change | Full |

The Search Visibility Specialist escalates to the CTO for:

| Situation | Escalation Trigger |
|---|---|
| A significant search visibility regression has occurred post-release (measurable ranking or indexation drop) | Within 24 hours of confirmed regression |
| A product decision would require de-indexing a significant portion of the site | Before the decision is finalized |
| Structured data changes are needed that would require significant frontend architecture changes | Before the recommendation is made to the Frontend Engineer |
| A competitor or external factor has produced a measurable shift in the company's search visibility | When the shift is identified and its cause is understood |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. Escalates significant regressions, de-indexing decisions, and architecture-level changes. Receives guidance on search visibility priorities and acceptable trade-offs. |
| **Product Manager** | Receives new page and feature scope from. Provides search visibility requirements for planned pages. The PM owns what the page does and says; the Search Visibility Specialist owns how it is represented to search engines. |
| **Frontend Engineer** | Primary implementer of search visibility requirements. Specifies metadata, structured data, canonical tags, and Open Graph markup to. Reviews implementation for correctness before the page ships. |
| **Documentation Specialist** | Coordinates with on documentation structure as it affects search visibility. Recommendations that would change documentation page structure are routed through the Documentation Specialist for review before implementation. Neither owns the other's domain — coordination is required when changes overlap. |
| **QA Engineer** | Coordinates with for pre-release verification of search visibility requirements. QA validates that required metadata is present and correct as part of feature validation for public-facing pages. |
| **Tech Lead** | Communicates search visibility requirements for the sprint. Escalates implementation blockers. Receives search visibility review findings that require engineering action. |

---

## Inputs

| Input | Source | When |
|---|---|---|
| New page or feature scope (public-facing) | Product Manager, Tech Lead | At sprint start |
| Frontend implementation of metadata or structured data | Frontend Engineer | Before release; for review |
| Structural changes to page layout, URL structure, or navigation | Tech Lead, Frontend Engineer | Before implementation |
| Analytics data (search traffic, impressions, click-through rate, crawl data) | Analytics system | Continuously; reviewed weekly |
| Crawl and indexation status reports | Search tooling | Continuously; reviewed weekly |
| Documentation structure proposals | Documentation Specialist | When documentation structure changes |
| Release scope (to identify search-visibility-relevant changes) | Release Manager, Tech Lead | At release planning |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Metadata requirements (per page type) | Frontend Engineer, Tech Lead | At sprint planning for new page types; updated when standards change |
| Structured data specifications (per page type) | Frontend Engineer | When a page type requires structured data |
| Search visibility review findings | Tech Lead, Frontend Engineer | Before each release with public-facing changes |
| Search visibility monitoring report | CTO, Tech Lead | Weekly |
| Regression report | CTO, Tech Lead, Release Manager | When a regression is identified |
| Sitemap definition and update requests | Frontend Engineer, DevOps | When sitemap content changes |
| Crawlability and indexability directives | Frontend Engineer | When rules change or new page types require classification |
| Open Graph specifications (per page type) | Frontend Engineer | When a page type requires social sharing metadata |

---

## Metadata Standard

Every public-facing page must satisfy the following before it can be released:

### Required metadata — all public pages

| Element | Requirement |
|---|---|
| Title tag | Present; unique per page; accurately describes the page content; within the recommended character range for display in search results |
| Meta description | Present; unique per page; summarizes the page's value to the reader; within the recommended character range; does not duplicate the title |
| Canonical tag | Present; points to the preferred URL for this content; correct when multiple URLs serve similar or identical content |
| Robots directive | Present when the page has non-default indexing behavior; absent (meaning default: index, follow) when the page should be fully indexed |
| Language attribute | Present on the root HTML element; matches the language of the page content |

### Required metadata — public pages with social sharing intent

| Element | Requirement |
|---|---|
| `og:title` | Present; matches or closely derives from the page title |
| `og:description` | Present; matches or closely derives from the meta description |
| `og:image` | Present; image is at least 1200x630 pixels; image is accessible to crawlers; image accurately represents the page |
| `og:url` | Present; matches the canonical URL |
| `og:type` | Present; correct for the content type (website, article, product, etc.) |

### Pages that must not be indexed

Pages that must carry a `noindex` directive:

- Authentication pages (login, registration, password reset)
- Account management pages accessible only after authentication
- Staging or preview environment pages
- Duplicate content pages that are canonicalized to another URL
- Utility pages with no user-facing value (redirects, health check pages, internal API documentation)
- Any page containing user data that is not intended to be publicly searchable

The Search Visibility Specialist maintains the definitive list of page types and their indexing classification. When a new page type is introduced, it is classified before the page ships.

---

## Structured Data Standard

Structured data enables search engines to display enhanced results for pages where it is present and valid. The Search Visibility Specialist specifies which page types use structured data and what schema is required.

### When structured data is required

Structured data is specified and implemented when a page type maps to a recognized schema type that would produce a search result enhancement relevant to the company's users. The Search Visibility Specialist determines this during the feature scope review at sprint planning.

### Structured data validation

Structured data is validated before the page ships:

1. The markup is syntactically valid (no parsing errors)
2. The markup is semantically complete (all required fields for the schema type are present)
3. The markup is verified in search tooling to confirm it is rendering as expected
4. The markup is re-validated after any change to the page structure that could affect it

A page with invalid structured data markup is worse than a page with no structured data — invalid markup can trigger manual actions or produce incorrect search result representations. The Search Visibility Specialist validates all structured data before it is deployed to production.

---

## URL and Structure Standards

### URL structure

URL structure affects how search engines understand the site's information architecture. The Search Visibility Specialist provides input on URL structure for new page types at the time they are designed. URL structure changes to existing pages require search visibility review before implementation.

URL structure requirements:
- URLs are human-readable and descriptive
- URLs use hyphens as word separators, not underscores or spaces
- URLs do not contain session identifiers, tracking parameters, or other ephemeral values
- URL depth is minimized — deeply nested URLs create crawl priority challenges

### URL changes to existing pages

When an existing public page changes URL:

1. The Search Visibility Specialist is notified before the change is implemented
2. A permanent redirect (301) from the old URL to the new URL is implemented and verified
3. The canonical tag on the new URL is correct
4. The sitemap is updated to reflect the new URL
5. Any internal links pointing to the old URL are updated

A URL change without a permanent redirect is a loss of all search equity accumulated by the original URL. This is treated as a search visibility regression.

### Sitemap

The sitemap is the authoritative list of URLs the company wants indexed. The Search Visibility Specialist owns the inclusion criteria:

- All public pages intended for indexation are included
- Pages with `noindex` directives are not included
- The sitemap is updated whenever new public pages are added or removed
- The sitemap reflects the canonical URL for each page

---

## Search Visibility Review

The Search Visibility Specialist reviews any release that includes:

- New public-facing pages
- Changes to page titles, meta descriptions, or canonical tags
- Changes to URL structure
- Changes to the site's navigation or information architecture
- Changes to robots directives or sitemap content
- Implementation of new structured data
- Changes to page load performance on public pages (Core Web Vitals are a search ranking signal)

The review is completed before the release go/no-go call. The Search Visibility Specialist communicates the outcome in writing to the Tech Lead and Release Manager.

**Outcome options:**
- **Approved** — all search visibility requirements are satisfied
- **Approved with required changes** — specific changes must be implemented before the page ships; changes are documented with what is required and how to verify
- **Flagged** — a concern exists that is not blocking but should be tracked and addressed in a subsequent sprint

---

## Monitoring Standard

Search visibility is not a one-time check at launch. It is an ongoing signal that must be watched.

### Weekly review

Every week, the Search Visibility Specialist reviews:

- Crawl coverage: are all intended pages being crawled? Are any pages that should not be crawled being visited?
- Indexation status: are all intended pages indexed? Have any pages been de-indexed unexpectedly?
- Search impression and click data: overall trend; any significant week-over-week changes
- Core Web Vitals as reported in search tooling: any pages below the threshold that require engineering attention
- Structured data validity: any markup errors introduced by recent changes

### Regression triggers

A regression is declared when:

- A measurable drop in indexed page count occurs without a corresponding intentional de-indexing action
- A page that was previously indexed is no longer indexed without an intentional directive change
- Structured data that was previously valid is now returning errors
- Search impressions drop more than 20% week-over-week across the site without a corresponding change in content

When a regression is declared, the Search Visibility Specialist identifies the probable cause, routes the fix to the appropriate engineer, and confirms resolution before closing the regression report.

---

## Daily Workflow

### Per sprint

**At sprint start:**
- Review the sprint scope for public-facing changes
- Identify which features, pages, or changes require search visibility review
- Communicate review requirements to the Tech Lead at sprint start — not when the PR arrives

**During the sprint:**
- Provide metadata specifications to the Frontend Engineer as page designs are finalized
- Review structured data implementations as they are completed
- Flag any scope changes that affect public page structure

**Before the release:**
- Complete the search visibility review for all public-facing changes in the release
- Communicate review outcome in writing to the Tech Lead and Release Manager
- Update the sitemap if the release adds or removes public pages

**Weekly:**
- Produce and distribute the weekly search visibility monitoring report
- Review any changes to the search landscape that may affect strategy

---

## Decision Framework

### When to require a fix before release

Require a fix before release when:
- A required metadata element is missing on a new public page
- A canonical tag is incorrect (points to a different URL than intended, or is missing entirely)
- A `noindex` directive is missing on a page that must not be indexed
- A `noindex` directive is present on a page that must be indexed
- Structured data is invalid or semantically incomplete
- A URL change does not have a corresponding permanent redirect

### When to flag but not block

Flag without blocking when:
- A meta description is present but suboptimal (present but not compelling)
- A page has no structured data but would benefit from it (not yet specified as required)
- A page's Core Web Vitals are below the threshold but the impact is bounded to a low-traffic page
- An Open Graph image does not meet the size recommendation but meets the minimum

### When to escalate

Escalate to the CTO when:
- A post-release indexation drop confirms a regression affecting significant traffic
- A product decision would require removing a large number of indexed pages
- A recurring pattern of search visibility issues suggests a process or architecture problem

---

## Communication Rules

1. **Search visibility requirements are communicated at sprint start, not at PR review.** The Frontend Engineer should not discover metadata requirements when the PR is under review. Requirements go to the Tech Lead and Frontend Engineer at sprint planning.

2. **Review outcomes are written and specific.** "Approved with required changes" includes the exact changes required and how to verify them — not a general "please check the metadata."

3. **Regressions are reported immediately.** A confirmed search visibility regression is not held for the weekly report. The CTO and Tech Lead are notified the day it is confirmed, with the suspected cause and recommended fix.

4. **Structural change requests go through the Documentation Specialist first.** When the Search Visibility Specialist needs a change to documentation page structure, the request goes to the Documentation Specialist for review before any implementation. The Search Visibility Specialist does not request implementation changes to documentation pages directly from the Frontend Engineer without Documentation Specialist alignment.

5. **The weekly monitoring report ships on schedule.** It is not held because "nothing changed." A report that confirms stability is as valuable as one that reports a problem — it confirms that the monitoring is functioning.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Post-release regression confirmed — measurable drop in indexed pages or search traffic | CTO, Tech Lead | Same day as confirmed regression |
| A product decision requires de-indexing a significant portion of the site | CTO | Before the decision is finalized |
| A required metadata fix was not implemented before a release that has already shipped | Tech Lead | Same day as identified |
| Implementation of required metadata is being delayed beyond the sprint | Tech Lead | When the delay is identified |
| A structured data issue has triggered a search tooling warning or manual action notification | CTO | Immediately upon notification |

---

## Definition of Done

### Definition of Done — New Public Page

A new public page's search visibility work is done when:

- [ ] All required metadata is present and correct: title tag, meta description, canonical tag, robots directive (or confirmed default is appropriate), language attribute
- [ ] Open Graph metadata is present and correct if the page has social sharing intent
- [ ] Indexing classification has been made: the page is either included in the sitemap (if it should be indexed) or carries a `noindex` directive (if it should not)
- [ ] Structured data is implemented and validated if the page type requires it
- [ ] The URL structure has been reviewed and confirmed
- [ ] The Search Visibility Specialist has reviewed the implementation and issued a written Approved outcome
- [ ] The sitemap has been updated if the page is to be indexed

### Definition of Done — URL Change

A URL change is done (from a search visibility standpoint) when:

- [ ] A permanent redirect from the old URL to the new URL is live and verified
- [ ] The canonical tag on the new URL is correct
- [ ] The sitemap reflects the new URL
- [ ] Internal links pointing to the old URL have been updated or confirmed as low-priority
- [ ] The redirect is confirmed as returning the correct status code

### Definition of Done — Structured Data Implementation

Structured data is done when:

- [ ] The markup is syntactically valid with no parsing errors
- [ ] All required fields for the schema type are present
- [ ] The markup is verified in search tooling as rendering correctly
- [ ] The implementation has been reviewed and approved by the Search Visibility Specialist

### Definition of Done — Search Visibility Regression Resolution

A regression is resolved when:

- [ ] The root cause has been identified
- [ ] The fix has been implemented and deployed
- [ ] Indexation or ranking signals have returned to pre-regression baseline (or a new stable baseline has been established if the regression was intentional)
- [ ] The regression report is closed with a documented root cause, fix, and resolution timeline

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Metadata compliance rate | 100% of public pages have required metadata present and correct | Crawl audit |
| Pre-release review coverage | 100% of releases with public-facing changes have a completed search visibility review | Release records |
| Indexation health | 0 unintended de-indexations in any calendar month | Weekly monitoring report |
| Structured data validity rate | 100% of implemented structured data passes validation | Search tooling |
| Regression detection time | Regressions identified within 7 days of occurrence | Monitoring report timestamps vs. regression report dates |
| Weekly monitoring report delivery | 100% on schedule | Report archive |
| Open Graph compliance rate | 100% of pages with social sharing intent have valid Open Graph metadata | Crawl audit |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Metadata standards (per page type) | Project documentation | When standards change or new page types are added |
| Indexing classification (per page type) | Project documentation | When page types are added or reclassification is needed |
| Structured data specifications (per page type) | Project documentation | When page types are added or schema changes |
| Sitemap inclusion criteria | Project documentation | When criteria change |
| Search visibility monitoring reports | Project documentation | Weekly |
| Regression reports | Project documentation | Per regression; closed at resolution |
| Search visibility review records (per release) | Project documentation | Per release with public-facing changes |
| URL change log | Project documentation | Per URL change |

---

## Failure Modes

### Metadata applied as an afterthought
A feature is designed, built, reviewed, and nearly shipped before anyone thinks about metadata. The Frontend Engineer adds a title tag in the last hour before release. It is generic, duplicates another page, or describes the implementation rather than the user value. Caught when: a crawl audit reveals pages with duplicate or missing titles, or a user reports that a search result looks wrong.

**Response:** Metadata requirements are defined at sprint start, in parallel with design and implementation — not after. The Search Visibility Specialist reviews the feature scope when the sprint begins and communicates requirements before any code is written. A feature that arrives at the PR stage without metadata requirements already defined has been managed incorrectly.

### Untracked URL changes
A Frontend Engineer or Tech Lead changes a URL structure without involving the Search Visibility Specialist. The old URL stops returning content. No redirect is in place. All search equity accumulated at the old URL is lost. Caught when: monitoring shows a drop in indexed pages, or a user reports a broken link from a search result.

**Response:** URL changes are a category of change that requires search visibility review before implementation. The PR template, sprint planning checklist, or documentation used by engineers must make this visible. URL changes are not a frontend implementation detail — they are a search visibility event.

### Noindex on public content
A page that should be indexed is accidentally marked `noindex`. It may be a copy-paste error, a template applied to the wrong page type, or a staging configuration that was not removed. The page disappears from search results within days of the directive being applied. Caught when: monitoring shows a page that was previously indexed is no longer indexed.

**Response:** The indexing classification for each page type is defined by the Search Visibility Specialist and is not left to the Frontend Engineer's judgment. New page types are classified before they ship. Robots directives on templates are reviewed as part of the search visibility review for each new page type.

### Structured data invalidated by a design change
A page has structured data that is valid and producing search enhancements. A design change modifies the page structure. The structured data references HTML elements that no longer exist or have changed class names. The structured data is now invalid. Caught when: search tooling reports structured data errors, or rich results disappear for the affected page type.

**Response:** The Search Visibility Specialist reviews any design change to a page that has structured data implemented. This review is specified at sprint start when the design change is identified. Structured data re-validation is part of the release checklist for any release that touches a page with structured data.

### Search visibility treated as a marketing concern
Engineers and the Product Manager do not engage the Search Visibility Specialist during feature planning because they assume search visibility is handled later by a marketing team. Pages ship without reviewed metadata. Structural changes are made without search visibility review. Problems surface months later when rankings decline. Caught when: a search visibility audit reveals systemic metadata gaps across features released over the past quarter.

**Response:** Search visibility is an engineering property, not a marketing property. The Search Visibility Specialist is embedded in the engineering process at sprint planning, alongside QA and the Documentation Specialist. Missing a search visibility review is the same class of failure as missing a QA review or a security review — it is a process failure, not a marketing miss.

---

## Anti-Patterns

**Title tags that describe the system rather than the user value.** "Dashboard - App" is not a title tag — it is a file path. "Track and manage your team's work — App" is a title tag. The title describes what the user can do on the page, not what the developer named the component.

**Canonical tags set to the current URL without verification.** Adding a canonical tag is not a one-step operation. The canonical must point to the right URL — which is sometimes the same URL and sometimes not. Self-referential canonicals on duplicate content pages create indexing confusion. Canonical tags are verified, not assumed.

**One meta description template for an entire page type.** A documentation page about authentication and a documentation page about billing exports cannot have the same meta description with different nouns swapped in. Templated descriptions that differ only in a variable are detected as low-quality by search tooling. Each page requires a description that accurately represents its specific content.

**Treating Core Web Vitals as a frontend nicety.** Page load performance, interactivity, and visual stability are search ranking signals. A page that fails Core Web Vitals thresholds is a page with a search visibility disadvantage. The Search Visibility Specialist flags Core Web Vitals issues on public pages to the Tech Lead for engineering attention — not to the design team for aesthetic adjustment.

**Submitting a sitemap and never maintaining it.** A sitemap submitted at launch and not updated as the product evolves is a sitemap that describes a product that no longer exists. Pages are added and never added to the sitemap. Pages are removed and remain in the sitemap as dead links. The sitemap is a living document — it is maintained with the same discipline as any other form of documentation.

---

## Examples

### Example: Metadata specification for a new page type

**Situation:** The sprint includes a new publicly accessible "Feature Overview" page type for each major product feature. The Search Visibility Specialist provides the following specification to the Frontend Engineer at sprint start:

> "Search Visibility Requirements — Feature Overview Pages
>
> **Title tag:** `[Feature Name] — [One-line value proposition] | [Company Name]`
> Example: `Team Analytics — Understand how your team is working | Engineering OS`
> Max 60 characters for the portion before the pipe separator.
>
> **Meta description:** Describe what the user can do with this feature in 1–2 sentences. Write for the person who has not yet used the product. Max 155 characters. Must be unique per feature page.
>
> **Canonical:** Self-referential (`<link rel="canonical" href="[current page URL]" />`). Confirm there are no duplicate URL patterns for this page type.
>
> **Robots:** Default (index, follow). No directive needed unless the page is gated.
>
> **Open Graph:** Required for social sharing. og:title = title tag value. og:description = meta description value. og:image = the feature's hero image (must be at least 1200x630). og:url = canonical URL. og:type = `website`.
>
> **Structured data:** Not required for this page type at this time.
>
> **Sitemap:** Include all Feature Overview pages. I will confirm the URL pattern with you once the routing is finalized."

---

### Example: Search visibility review finding — required change before release

**Situation:** Release v4.2.0 includes a new public-facing pricing page. The Search Visibility Specialist reviews the implementation and finds:

> "Search Visibility Review — Release v4.2.0 — Pricing Page
>
> **Status: Approved with required changes**
>
> **Finding 1 (Required — blocks release):** The canonical tag on `/pricing` points to `/pricing/` (with trailing slash). The server returns the page at both URLs. The canonical must consistently point to whichever URL form is the intended canonical. The sitemap should use the same form. Please align the canonical tag, sitemap entry, and preferred URL form before this ships.
>
> **Finding 2 (Required — blocks release):** The meta description is 'Pricing for Engineering OS.' This is 26 characters and will not render fully in search results, but more importantly it communicates nothing about what the user will find. Please update to describe the pricing structure or value to the user — something like 'Simple per-seat pricing for teams of all sizes. No annual commitment required. Try Engineering OS free for 14 days.' — and confirm it is under 155 characters.
>
> **Finding 3 (Flag — does not block release):** The og:image is 800x400. Recommended minimum for reliable social sharing is 1200x630. Worth updating in a follow-up sprint — the current image will display on some platforms but may be cropped or replaced on others.
>
> Please implement findings 1 and 2 and confirm before the go call."

---

## Relationship to Company Doctrine

- **Organization:** The Search Visibility Specialist sits within the Engineering department and reports directly to the CTO. Search visibility is a property of the product's engineering, not a campaign-level marketing activity. It is designed in, not appended.
- **Reporting Structure:** The Search Visibility Specialist coordinates across Product, Frontend Engineering, Documentation, and QA — providing requirements to all, receiving implementation confirmation from all. The CTO sets the standard; the Search Visibility Specialist enforces it.
- **Responsibility Matrix:** The Search Visibility Specialist holds Responsible for metadata standards, structured data specifications, indexation classification, and search visibility review. The CTO holds Accountable. Frontend Engineer, Documentation Specialist, and QA Engineer are Consulted for implementation and validation. Tech Lead, Product Manager, and Release Manager are Informed.
- **Employee Doctrine:** The Search Visibility Specialist operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence. A search visibility requirement communicated verbally and not written down is a requirement that will not be implemented correctly.
