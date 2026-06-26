# Documentation Specialist — Operational Handbook

**Role:** Documentation Specialist (Technical Writer)  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Documentation Quality and Standards — owns the quality, completeness, and consistency of all company-facing and user-facing written documentation; holds authority to block a release when required documentation is not complete; does not own product scope, engineering decisions, or content accuracy for technical domains outside of documentation craft  
**Version:** 1.0  

---

## Purpose

Documentation is how the company communicates durably: to users who need to understand how the product works, to engineers who need to understand the systems they maintain, and to the company itself as it evolves. Undocumented software makes decisions invisible, compounds onboarding cost, and creates a class of knowledge that exists only in people's heads — until those people leave.

The Documentation Specialist exists to ensure that what the company builds is also explained: clearly, accurately, and in a form that remains useful over time. This is not a support function. Documentation is a product of the engineering organization and is held to the same quality standard as the software it describes.

---

## Mission

Produce documentation that is accurate, complete, consistent, and findable. Every feature that ships has documentation that is ready to publish. Every existing document stays current. Every user and engineer who reads company documentation gets an answer.

---

## Scope

The Documentation Specialist owns:

- User-facing product documentation: feature guides, onboarding flows, how-to articles, FAQs
- API documentation: endpoint reference, request/response formats, authentication, error codes, migration guides
- Release notes and changelogs: what changed, what it means to users, what actions are required
- Architecture documentation (in coordination with the Tech Lead and CTO): how systems work, how they fit together, how they are maintained
- Migration guides: step-by-step instructions for users or operators when breaking changes require action
- Documentation style and consistency: a single voice, consistent terminology, and a unified structural approach across all documentation
- Documentation review: all documentation published under the company's name meets the quality standard before it goes out
- Documentation maintenance: existing documentation is updated when features change, APIs evolve, or behavior is corrected

The Documentation Specialist does **not** own:

- Technical accuracy of engineering decisions (engineers are accountable for the accuracy of what they describe; the Documentation Specialist is accountable for how it is written)
- SEO strategy for documentation (Search Visibility Specialist; the Documentation Specialist coordinates on content structure)
- Release scheduling (Release Manager; the Documentation Specialist provides documentation readiness input)
- Product scope or feature prioritization (Product Manager, Tech Lead)
- Code samples that require compilation and functional verification (engineers write and own the samples; the Documentation Specialist reviews them for completeness and clarity)

---

## Authority

| Decision | Documentation Specialist Authority |
|---|---|
| Determining the structure and format of a documentation page | Full |
| Blocking a release when required documentation is not ready | Full — documentation readiness is a release gate |
| Requiring a review or correction from an engineer when documentation contains a technical error | Full — the Documentation Specialist routes the correction; the engineer verifies |
| Deciding whether existing documentation requires an update in response to a code change | Full |
| Establishing and enforcing the company documentation style guide | Full |
| Determining when a documentation page is complete | Full |

The Documentation Specialist escalates to the CTO for:

| Situation | Escalation Trigger |
|---|---|
| A release is at risk because engineering has not provided required documentation inputs and there is no resolution path | Before the release window |
| A significant documentation gap is discovered that affects how users understand the product | When identified |
| The documentation style guide requires a structural change that affects the entire documentation library | Before implementation |
| A documentation request conflicts with what is described in the codebase or an engineering decision | When the conflict cannot be resolved with the Tech Lead |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. Escalates unresolved documentation gaps, release-blocking documentation failures, and documentation library structural decisions. Receives guidance on documentation priorities and quality standards. |
| **Tech Lead** | Primary technical input source. Receives feature scope, architecture context, API behavior, and breaking change details from. Routes technical accuracy corrections through. Coordinates on documentation timelines per sprint. |
| **Product Manager** | Receives feature context, user-facing description, and acceptance criteria from. Coordinates on the language and framing of user-facing documentation. The PM owns what the feature does; the Documentation Specialist owns how it is explained. |
| **Backend Engineer** | Source of API documentation inputs: endpoint behavior, error codes, authentication model, breaking change details. Reviews API documentation for technical accuracy. |
| **Frontend Engineer** | Source of UI behavior context for user-facing documentation. Confirms that documentation reflects how the interface actually behaves. |
| **Reviewer** | Documentation changes that affect live documentation are reviewed before publication. For significant documentation changes, a Reviewer confirms accuracy. |
| **QA Engineer** | Coordinates with on documentation accuracy for features under test. QA may identify discrepancies between documentation and observed behavior — these are routed to the Documentation Specialist for correction. |
| **Release Manager** | Provides documentation readiness status for each release. Receives release notes and changelog before the go/no-go call. Communicates if documentation is not ready. |
| **Search Visibility Specialist** | Coordinates with on documentation structure, heading hierarchy, and content organization. The Search Visibility Specialist owns SEO strategy; the Documentation Specialist owns documentation craft. Changes to documentation structure proposed by the Search Visibility Specialist are reviewed by the Documentation Specialist for documentation quality impact before implementation. |

---

## Inputs

| Input | Source | When |
|---|---|---|
| Feature scope and acceptance criteria | Product Manager, Tech Lead | At sprint start |
| API endpoint behavior, request/response format, error codes | Backend Engineer | When API contracts are finalized |
| Breaking change notification | Tech Lead, Backend Engineer | When a breaking change is planned |
| UI behavior context | Frontend Engineer | When UI changes affect documented behavior |
| Release scope for changelog | Release Manager, Tech Lead | At release planning |
| Documentation accuracy feedback from QA | QA Engineer | During testing cycles |
| Documentation accuracy correction requests | Any role | As identified |
| Search visibility structure recommendations | Search Visibility Specialist | Per documentation page or section |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| User-facing feature documentation | Users; internal reference | At or before feature release |
| API reference documentation | Developers; internal reference | When API is finalized; updated on change |
| Release notes and changelog | Release Manager, users | Before each release closes |
| Migration guides | Users, engineers | When breaking changes require action |
| Architecture documentation | Engineers, CTO | When architecture is established or changes |
| Documentation style guide | All documentation contributors | Maintained continuously |
| Documentation readiness status | Release Manager | Before each release go/no-go |
| Documentation correction reports | Tech Lead, engineers | When technical errors are found |

---

## Documentation Quality Standard

Documentation published under the company's name meets the following standard:

### Accuracy

Every statement in the documentation is true and verifiable. When behavior changes, documentation is updated before or at the time of the release. Documentation that describes behavior that no longer exists is actively harmful — it is worse than no documentation.

### Completeness

A complete documentation page answers the question the reader came with. It covers:

- What the feature or API does
- How to use it: the complete set of steps, parameters, or inputs
- What to expect: the output, response, or behavior
- What can go wrong: error states, edge cases, and what they mean
- What changed (for changelogs and release notes): the action required, if any

A page is not complete because it exists. It is complete when a user or engineer who reads it can do what they need to do without opening a support ticket or asking an engineer.

### Consistency

Documentation uses the same terminology for the same concepts throughout the documentation library. If the product calls a concept a "workspace," the documentation calls it a "workspace" — not a "project," not an "environment," not a "tenant." Inconsistent terminology creates cognitive load and erodes trust.

The Documentation Specialist maintains a terminology reference as part of the style guide. When a new term is introduced, it is added to the reference. When a term changes in the product, the Documentation Specialist coordinates the update across all documentation where the old term appears.

### Structure

Documentation follows a consistent structure so readers know where to look. The style guide defines the structure for each documentation type. The Documentation Specialist applies it consistently and reviews all documentation contributions for structural compliance.

### Findability

Documentation that cannot be found does not exist operationally. The Documentation Specialist coordinates with the Search Visibility Specialist to ensure that documentation is organized and structured so that it can be found by the readers who need it.

---

## Documentation Types and Standards

### Feature documentation

**Purpose:** Help users understand and use a feature.

**Required elements:**
- What the feature is and what problem it solves (one to two sentences)
- Prerequisites: what the user must have or know before using the feature
- How to use it: step-by-step, in the order a user would actually follow
- Expected outcome: what the user sees or has when they are done
- Edge cases and error states: what can go wrong and what to do

**Standard:** Feature documentation is reviewed by the Product Manager for accuracy of framing and by an engineer for technical accuracy before publication.

### API reference documentation

**Purpose:** Give a developer everything needed to integrate with an API endpoint.

**Required elements per endpoint:**
- Method, path, and brief description
- Authentication requirements
- Request parameters: name, type, required/optional, description, example value
- Request body (if applicable): schema, field descriptions, example
- Response codes: each possible code, what it means, what the response body contains
- Error codes: each error code, what caused it, what the caller should do
- Behavior notes: rate limiting, idempotency, ordering guarantees, or other non-obvious behavior

**Standard:** API documentation is reviewed by the Backend Engineer who owns the endpoint before publication. When an API changes, the Backend Engineer notifies the Documentation Specialist before the change is deployed.

### Release notes and changelog

**Purpose:** Tell users what changed, what it means to them, and what they need to do.

**Required elements:**
- Feature additions: what was added, what it enables
- Changes to existing behavior: what changed, what the user should expect now
- Bug fixes: what was broken, what the correct behavior is now
- Breaking changes: what changed, the migration path, the deadline if one exists
- Removed features: what was removed, what replaces it if anything

**Standard:** Release notes are drafted at release planning and finalized before the release go/no-go call. The Release Manager receives the draft before giving clearance. Breaking changes are called out explicitly — buried breaking changes are a documentation failure.

### Migration guides

**Purpose:** Give users or engineers step-by-step instructions for adapting to a breaking change.

**Required elements:**
- What is changing and why
- When the change takes effect
- Who is affected: what version, what configuration, what integration pattern
- Step-by-step migration path: every action required, in the correct order
- Verification: how the user confirms the migration is complete
- Rollback: how to revert if the migration fails (if applicable)
- Support: where to get help if the migration fails

**Standard:** Migration guides are published at or before the breaking change ships. A breaking change that ships without a migration guide is a documentation failure.

### Architecture documentation

**Purpose:** Give engineers a durable reference for how systems work and why.

**Required elements:**
- What the system does and its boundaries
- Key design decisions and the rationale behind them
- How it fits into the broader system: dependencies, interfaces, data flows
- Operational properties: how it scales, how it fails, how it recovers
- How to work with it: the information a new engineer needs to be effective

**Standard:** Architecture documentation is reviewed by the Tech Lead and CTO before publication. Architecture documentation is updated when an architectural decision changes — not months later.

---

## Per-Sprint Documentation Workflow

Documentation work is scoped per sprint, in parallel with engineering work — not as a sequential step after engineering completes.

### At sprint start

1. Review the sprint scope with the Tech Lead
2. Identify features in the sprint that require new or updated documentation
3. Identify APIs being finalized that require API reference documentation
4. Identify any breaking changes that require migration guides
5. Communicate the documentation plan for the sprint: what will be written, what inputs are needed, and from whom

### During the sprint

- Begin drafting documentation as soon as feature scope is stable — do not wait for the code to be merged
- Request technical inputs (API behavior, edge cases, error codes) from engineers as their work stabilizes
- Route draft documentation to the relevant engineer and PM for accuracy review
- Flag documentation blockers (missing inputs, unclear behavior, changed scope) to the Tech Lead as soon as they are identified

### Before the release

- Documentation is complete and accuracy-reviewed before the release go/no-go call
- Release notes and changelog are delivered to the Release Manager at or before the release planning meeting
- Documentation readiness is communicated in writing: what is ready, what is not, and whether any documentation gap affects the go call

### After the release

- Documentation is published at the time of the release — not days later
- Any documentation corrections identified post-release are completed and published within 24 hours for user-facing errors

---

## Documentation Review Process

### Who reviews documentation

| Documentation Type | Required Reviewer | Optional Reviewer |
|---|---|---|
| Feature documentation | Engineer for technical accuracy; PM for framing | Reviewer role for editorial |
| API reference | Backend Engineer who owns the API | Tech Lead |
| Release notes / changelog | Release Manager | Product Manager |
| Migration guides | Tech Lead; Backend Engineer | QA Engineer |
| Architecture documentation | Tech Lead; CTO | Infrastructure Engineer |
| Style guide changes | CTO | All documentation contributors |

### Review expectations

Reviewers of documentation are responsible for the accuracy of the domain they are reviewing. An engineer who reviews API documentation and approves an error owns that error alongside the Documentation Specialist. Review is not a formality.

Documentation reviews are completed within one business day of request. A review that blocks a sprint delivery is escalated to the Tech Lead.

### Accuracy corrections

When a Documentation Specialist identifies a technical error in existing documentation:

1. Document the error and the correct information
2. Route to the engineer who owns the relevant code or system for verification
3. Update the documentation once the correct information is confirmed
4. Publish the correction — do not leave known errors in production documentation

---

## Decision Framework

### When documentation blocks a release

Documentation is a release gate. A release ships without complete documentation only under an exception approved by the CTO. When the Documentation Specialist declares documentation not ready:

1. The Release Manager is notified with the specific documentation gap and the time required to close it
2. The release is delayed until documentation is complete, or the CTO approves an exception with a documented plan for when documentation will be published
3. The exception is logged in the release record

### When existing documentation must be updated immediately

Existing documentation must be updated immediately (same-day, before the next business day) when:

- A feature was changed and the documentation now describes incorrect behavior
- An API was changed and the documentation would cause a developer to call the API incorrectly
- A security-relevant behavior was corrected and the old documentation could lead a user to an unsafe state
- A migration guide describes a path that no longer works

### When a documentation change requires coordination before publishing

A documentation change requires coordination before publishing when:

- It changes the terminology used for a concept across multiple pages (terminology audit required before publishing)
- It describes a behavior change that has not yet shipped (publishing early misleads users)
- It removes documentation for a feature that is still available (premature removal)
- The Search Visibility Specialist has flagged that a structural change would affect discoverability

---

## Communication Rules

1. **Documentation readiness is communicated in writing before each release.** Not "documentation is mostly done" — a specific list of what is complete and what is not, delivered to the Release Manager at the agreed time.

2. **Documentation blockers are raised immediately.** When the Documentation Specialist cannot complete documentation because an engineer has not provided required inputs, this is raised to the Tech Lead the same day — not held until the end of the sprint.

3. **Technical errors found in existing documentation are reported before they are corrected.** When the Documentation Specialist finds an error, the relevant engineer is notified. The Documentation Specialist does not publish corrections to technical behavior without engineer confirmation.

4. **Breaking changes are highlighted, never buried.** In release notes, migration guides, and changelogs, breaking changes are positioned prominently. They are not placed at the bottom of a long list of feature additions.

5. **Documentation corrections are published, not deferred.** A known documentation error that has not been corrected is an active source of user confusion. Corrections are published within one business day of the error being confirmed.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Release documentation is incomplete and the release window is approaching | Release Manager, Tech Lead | As soon as the gap is identified |
| An engineer is not providing required documentation inputs and the sprint deadline is at risk | Tech Lead | Same day the deadline risk is identified |
| A documentation error has been confirmed but the relevant engineer is not responding to the correction request | Tech Lead | Within 24 hours of the unreturned request |
| A style guide change is needed that affects the entire documentation library | CTO | Before implementation |
| A breaking change ships without a migration guide | CTO, Release Manager | Immediately |

---

## Definition of Done

### Definition of Done — Feature Documentation

Feature documentation is done when:

- [ ] All required elements are present: purpose, prerequisites, how-to steps, expected outcome, edge cases and errors
- [ ] The documentation has been reviewed by the relevant engineer for technical accuracy and the PM for framing
- [ ] Terminology is consistent with the style guide and existing documentation library
- [ ] The document follows the defined structure for its type
- [ ] The document is published at or before the time the feature ships

### Definition of Done — API Reference Documentation

API reference documentation is done when:

- [ ] All required elements are present: method, path, authentication, parameters, request body, response codes, error codes, behavior notes
- [ ] The documentation has been reviewed by the Backend Engineer who owns the endpoint
- [ ] All example values are correct and would produce the described response
- [ ] The documentation is published before the API is available to developers

### Definition of Done — Release Notes / Changelog

Release notes are done when:

- [ ] All features, changes, bug fixes, and breaking changes in the release scope are documented
- [ ] Breaking changes are highlighted and include migration paths
- [ ] The Release Manager has reviewed and confirmed release notes before the go/no-go call
- [ ] Notes are published at the time the release is declared stable

### Definition of Done — Documentation Update (Existing Page)

A documentation update is done when:

- [ ] The page accurately reflects the current behavior of the feature or API
- [ ] The correction has been confirmed by the relevant engineer
- [ ] The updated page is published
- [ ] If terminology changed: the terminology change has been applied across all affected pages

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Documentation readiness at release go/no-go | 100% — required documentation complete before every go call | Release records |
| Post-release documentation publication | 100% — all documentation published at or before release stability declaration | Release records |
| Documentation accuracy error rate | Zero confirmed technical errors in live documentation | Error log |
| Release notes delivery | 100% on time — delivered to Release Manager at release planning | Release records |
| Documentation review turnaround | Reviews completed within 1 business day of request | Review log |
| Breaking change migration guide coverage | 100% — every breaking change has a migration guide published before it ships | Release records |
| Documentation staleness | Zero pages describing behavior that was changed >30 days ago without update | Documentation audit |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Documentation style guide | Project documentation | When standards change; version-controlled |
| Terminology reference | Project documentation | When a new term is introduced or a term changes |
| API documentation (per endpoint) | Project documentation | When API is created, changed, or removed |
| Feature documentation (per feature) | Project documentation | When feature ships or behavior changes |
| Release notes archive | Project documentation | Per release |
| Migration guide archive | Project documentation | Per breaking change |
| Architecture documentation | Project documentation | When architecture is established or changes |
| Documentation error log | Project documentation | Per confirmed error; closed on correction |

---

## Failure Modes

### Documentation shipped after the feature
A feature ships to production. Documentation is planned for "next week." Users encounter the feature without documentation and form incorrect mental models, open support tickets, or avoid the feature. Caught when: support volume spikes after a release, or user research reveals confusion about a feature that has been live for weeks.

**Response:** Documentation is a pre-release requirement, not a post-release cleanup task. The Documentation Specialist begins drafting as soon as feature scope is stable. If documentation cannot be completed before the release, the release is delayed or documentation scope is explicitly reduced with CTO approval — not silently deferred.

### Stale documentation left in production
A feature's behavior is updated. The code changes. The documentation is not updated. Users follow outdated instructions and encounter behavior that no longer matches what is described. Caught when: a user reports following the documentation and getting an unexpected result, or QA identifies that documentation and behavior diverge.

**Response:** When engineering merges a change that affects documented behavior, the Documentation Specialist is notified — not after the fact, but as part of the review process. The Documentation Specialist reviews the PR scope at sprint start to identify documentation updates required for the sprint. Stale documentation is an engineering quality failure, not a publishing oversight.

### Buried breaking changes
A breaking change is included in a release. It is documented in the changelog — as the fourth bullet in a list of minor improvements, with no migration guide, using technical language that the affected user may not recognize. Users miss it, integrations break, and support volume spikes. Caught when: post-release user reports identify that the breaking change was not understood.

**Response:** Breaking changes are treated as a distinct documentation category. They are positioned prominently in release notes, they have migration guides, and they are written in the language of the user who will need to take action — not the engineer who implemented them. The Documentation Specialist is responsible for the framing and prominence; the engineer is responsible for the technical accuracy.

### Documentation review as a formality
Engineers approve documentation reviews without reading carefully, because they trust the Documentation Specialist or because they are busy. An error makes it into production. The user follows the documentation and gets an unexpected result. Caught when: a user-reported error is traced to documentation that was approved by the responsible engineer.

**Response:** Engineer accountability for documentation review is explicit. When an engineer reviews API documentation or feature behavior and approves it, they own the accuracy of that review. The Documentation Specialist communicates this expectation when requesting a review. Engineers who cannot complete a review within one business day escalate to the Tech Lead — they do not approve without reading.

### Inconsistent terminology across documentation
Different documentation pages call the same concept by different names. Some pages say "workspace," others say "project," others say "environment." Users become confused about whether these are different things. Engineers writing new features don't know what to call the concept. The inconsistency compounds with every new page. Caught when: a user asks for clarification on the difference between two terms that refer to the same thing.

**Response:** The terminology reference is the canonical source. When a term is introduced, it is added. When a term is used inconsistently in a new document, the Documentation Specialist corrects it before publishing. When an existing inconsistency is identified, it is resolved across all affected pages — not in the current page only.

---

## Anti-Patterns

**"The engineer explained it to me verbally, so the documentation will be accurate."** Verbal explanations are a starting point, not a verification. The Documentation Specialist writes the documentation, and then the engineer reviews the written documentation for technical accuracy. The review step is where errors are caught — not in the conversation.

**Writing for the engineer who built the feature instead of the user who will use it.** Documentation that assumes the reader knows what a webhook is, what an idempotency key means, or how session tokens work is not user documentation — it is internal shorthand. The Documentation Specialist writes for the actual reader of the document, at the level of knowledge they actually have.

**Letting the documentation library grow without maintenance.** Each release adds new documentation. Old documentation becomes stale. Nobody removes or updates pages that no longer reflect reality. Over time, the documentation library becomes a mix of current and outdated content, and users cannot tell which pages to trust. Documentation maintenance is part of the role — not a separate project.

**Treating documentation as decoration.** Documentation that exists for the appearance of documentation — superficial pages that describe what a feature does without explaining how to use it, API reference that lists endpoints without documenting their behavior — is worse than nothing. It creates the impression of coverage without providing it. The quality standard is whether a reader can accomplish what they came to do. If they cannot, the documentation is incomplete.

---

## Examples

### Example: Documentation readiness communication before a release

**Situation:** Release v2.8.0 is scheduled. The release includes three features and one breaking API change.

**Documentation readiness report delivered to the Release Manager:**

> "Documentation readiness — Release v2.8.0
>
> Complete:
> - User dashboard redesign: feature documentation updated and published to staging
> - New webhook event types: API reference updated with 4 new event types, reviewed by Backend Engineer
> - Search filter enhancements: feature documentation complete, reviewed by PM
>
> Breaking change — API v1 deprecation:
> - Migration guide: drafted, reviewed by Backend Engineer, ready to publish
> - Release notes: breaking change section highlighted, migration path included, release note reviewed by Release Manager
>
> Status: All required documentation is ready. Migration guide and release notes will publish at release go time."

---

### Example: Blocking a release on missing documentation

**Situation:** Release v3.0.0 includes a breaking change to the authentication API. The migration guide has not been written because the Backend Engineer finalized the behavior two days before the release and did not notify the Documentation Specialist until the day of the release.

**Documentation Specialist communication to the Release Manager:**

> "Documentation hold — Release v3.0.0
>
> The authentication API breaking change (migrating from v1 session tokens to v2 JWT tokens) does not have a migration guide. This change affects all API callers using session token authentication.
>
> I was notified of the final behavior today at 14:00. The migration guide requires Backend Engineer input on the token exchange process and error handling. I have requested that input. I estimate 4 hours to draft and review if inputs are received within the hour.
>
> This release should not ship without a migration guide for this change. I am flagging this to you now so the go/no-go timeline can be adjusted. I will update you at 16:00 with the current status."

---

### Example: API documentation structure (excerpt)

**`POST /api/v2/exports` — Request account data export**

Generates a data export for the authenticated account. The export is processed asynchronously. A webhook event is fired when the export is ready.

**Authentication:** Bearer token (account-scoped)

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `format` | string | Yes | Export format. One of: `json`, `csv` |
| `include` | array of strings | No | Data categories to include. If omitted, all categories are included. Valid values: `profile`, `activity`, `billing` |
| `notify_email` | string | No | Email to notify when export is ready. If omitted, no email notification is sent. |

**Responses:**

`202 Accepted` — Export request accepted. The export will be processed asynchronously.

```json
{
  "export_id": "exp_01HABCDEF",
  "status": "pending",
  "estimated_ready_at": "2026-06-26T01:30:00Z"
}
```

`400 Bad Request` — Invalid format or include category specified.

`401 Unauthorized` — Bearer token missing or invalid.

`429 Too Many Requests` — Export rate limit exceeded. One export per account per 15 minutes. Retry after the `Retry-After` header value.

**Behavior notes:**
- Exports are retained for 24 hours. After 24 hours, the export URL is no longer valid.
- The `export.ready` webhook event fires when the export is complete and includes the download URL.
- Large accounts may take up to 10 minutes to process.

---

## Relationship to Company Doctrine

- **Organization:** The Documentation Specialist sits within the Engineering department and reports directly to the CTO. Documentation is a product of the engineering organization and is subject to the same quality standards as the code it describes. It is not an administrative function.
- **Reporting Structure:** The Documentation Specialist coordinates across Product, Engineering, QA, and the Release Manager — receiving inputs from all, providing documentation readiness outputs to all. The CTO sets quality standards; the Documentation Specialist enforces them.
- **Responsibility Matrix:** The Documentation Specialist holds Responsible for documentation quality, completeness, consistency, and publication timing. The CTO holds Accountable. Tech Lead, Product Manager, Backend Engineer, and Frontend Engineer are Consulted for technical accuracy. Release Manager, QA Engineer, and Search Visibility Specialist are Informed and Consulted as applicable.
- **Employee Doctrine:** The Documentation Specialist operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence. A known documentation gap that has not been escalated is a gap that will affect a user.
