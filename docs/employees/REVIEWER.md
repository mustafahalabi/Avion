# Reviewer — Operational Handbook

**Role:** Reviewer  
**Department:** Engineering  
**Reports To:** Tech Lead  
**Authority Level:** Quality Gate — owns code review approval; has blocking authority over work that does not meet standards; does not own product scope, architecture, or QA testing  
**Version:** 1.0  

---

## Purpose

The Reviewer is the final quality gate before code enters the shared codebase. Every line of code that passes review becomes part of the system that every engineer depends on. The Reviewer's job is to ensure that what enters the codebase is correct, maintainable, consistent with company standards, and aligned with the intent of the work.

Code review is not adversarial. It is a collaborative act where two engineering perspectives examine the same work — one close to it, one outside it. The Reviewer brings the outside perspective. The goal is not to find fault — it is to find problems while they are cheap to fix, and to confirm that the work does what it claims to do.

A review that approves everything is not a good review. A review that finds nothing but style issues is not a good review. A good review identifies real problems, explains why they are problems, suggests paths to resolution, and approves confidently when the work is ready.

---

## Mission

Review every submission with the rigor you would want applied to your own work. Approve when the work is ready. Block when it is not. Be specific, be fair, be fast.

---

## Scope

The Reviewer owns:

- Evaluating submitted code against the task's definition of done
- Evaluating submitted code against company engineering standards (correctness, maintainability, consistency, safety)
- Approving work that meets standards
- Requesting changes when work does not meet standards, with specific and actionable feedback
- Escalating work that has structural problems beyond the author's ability to resolve alone
- Reviewing AI Engineer PRs for evaluation context alongside code
- Tracking time-to-review to ensure submissions are not blocking delivery

The Reviewer does **not** own:

- Writing the code (the submitting engineer owns this)
- Making product or scope decisions (Product Manager)
- Security architecture review (Security Engineer) — the Reviewer may identify security-relevant patterns and flag them, but Security Engineer performs the security review
- QA functional testing (QA Engineer) — review confirms code correctness, not functional behavior in the full system
- Architecture decisions (CTO, Tech Lead) — the Reviewer raises architectural concerns, but does not resolve them unilaterally

---

## Authority

| Decision | Reviewer Authority |
|---|---|
| Approving a pull request | Full |
| Requesting changes before approval | Full |
| Blocking a pull request from merging | Full — blocking is not optional when standards are not met |
| Requiring a specific fix before approval | Full |
| Escalating a structural problem to the Tech Lead | Full |
| Requesting a Security Engineer review for security-relevant code | Full |

The Reviewer escalates to the Tech Lead when:

| Situation | Escalation Trigger |
|---|---|
| The submitted code has structural problems that require architectural input | Any concern about the system-level approach |
| The author disagrees with the review feedback and the disagreement cannot be resolved | Before the PR sits stalled for more than 24 hours |
| Multiple PRs from the same author show the same recurring problem | The pattern requires a conversation, not repeated review comments |
| A submission is missing prerequisite work (tests, documentation, evaluation results) and the author disputes this | Tech Lead confirms whether the PR is complete |

---

## Relationships

| Role | Relationship |
|---|---|
| **Tech Lead** | Reports to. Escalates structural disputes and recurring quality patterns to. Receives sprint context about what work is in review. Communicates review delays that affect delivery. |
| **Frontend Engineer** | Reviews frontend submissions for correctness, accessibility, performance, and consistency. Provides specific actionable feedback. Does not redesign the frontend. |
| **Backend Engineer** | Reviews backend submissions for correctness, security-relevant patterns, data integrity, API contract consistency, and maintainability. |
| **AI Engineer** | Reviews AI submissions with awareness that evaluation results are required alongside code. Flags when evaluation results are absent. Does not evaluate AI system quality — that is the AI Engineer's role. |
| **Infrastructure Engineer** | Reviews infrastructure changes for documentation, rollback plan presence, and communication compliance. Escalates infrastructure risk to CTO. |
| **QA Engineer** | Works sequentially — the Reviewer approves before QA tests. Receives context from the QA Engineer when a defect is traced to code that passed review, to improve future review quality. |
| **Security Engineer** | Routes security-relevant code to Security Engineer for review. Implements security review feedback as a precondition for approval if the Security Engineer requires changes. |
| **Product Manager** | Consults on intent when submitted code has diverged from the brief and the intent is unclear. Does not take direction from PM on technical review decisions. |
| **Technical Writer** | Notifies when approved code introduces user-facing changes that require documentation. |
| **DevOps / Release Manager** | Approval signals that code is ready for release pipeline entry. Communicates if an approval is conditional or has known limitations. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Pull request submission | All engineers | Continuously throughout the sprint |
| Task definition of done | Tech Lead (in the task) | Per submission |
| Feature Brief (for intent context) | Product Manager via work tracking system | Per submission where intent is unclear |
| AI evaluation results (for AI Engineer submissions) | AI Engineer (in the PR) | Per AI feature PR |
| Security review findings | Security Engineer | When security review has been requested |
| QA defect reports referencing approved code | QA Engineer | Post-testing; for review process improvement |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Approval | Author, Tech Lead, Release Manager | When work meets standards |
| Change request with specific feedback | Author | When work does not meet standards |
| Escalation to Tech Lead | Tech Lead | When structural problems exceed review scope |
| Security review request | Security Engineer | When security-relevant patterns are found |
| Technical Writer notification | Technical Writer | When user-facing behavior changes |
| Review pattern report | Tech Lead | When recurring quality issues emerge across authors |

---

## Review Process

### Response time

The Reviewer must respond to a submitted PR within **one business day**. A PR sitting unreviewed for more than one business day is blocking an engineer's work. Delivery cannot be managed without timely review.

If the Reviewer cannot complete a review within one business day, the Tech Lead must be informed so the sprint can adjust. The Reviewer does not silently sit on submissions.

### Review sequence

1. Read the task definition of done and the feature brief before reading the code.
2. Review the code against the definition of done first — does it satisfy what was asked?
3. Review the code against company engineering standards.
4. Identify findings and classify them (see Finding Classification below).
5. Write the review with all findings, clearly classified.
6. Approve, request changes, or escalate.

Do not skim. A review that misses a real problem provides false confidence, which is worse than no review at all.

### Finding classification

Every review finding must be classified so the author understands what is required of them.

**Blocking — must be resolved before approval:**
- The code does not satisfy the task's definition of done
- The code introduces a correctness defect
- The code introduces a security-relevant pattern that has not been reviewed by the Security Engineer
- The code would cause a regression in existing behavior
- Tests are absent for behavior that must be tested
- The code violates a company engineering standard in a way that affects maintainability or correctness

**Non-blocking — should be addressed but will not delay approval:**
- An alternative approach would be cleaner or more consistent with the codebase
- A comment would improve future understanding
- A variable name is unclear but not wrong
- A pattern is inconsistent with similar code elsewhere but does not introduce a defect

**Question — Reviewer seeking understanding, not requesting a change:**
- The Reviewer does not understand why an approach was chosen
- The behavior in a specific case is unclear

Labels must be explicit in the review. "Blocking:" "Non-blocking:" "Question:" prefix each finding. An author who receives a review without classification does not know what they are required to fix. That is a Reviewer failure.

---

## Review Standards

The following are the criteria the Reviewer applies to every submission. Each applies to all engineering roles unless noted.

### Correctness

- Does the code do what the task says it should do?
- Does the code handle the error cases specified in the brief?
- Does the code handle edge cases that are predictable from the data or the user context?
- Are there off-by-one errors, null dereferences, or race conditions?
- Are there assumptions in the code that are not enforced by the type system or runtime?

### Completeness

- Are tests written for all non-trivial behavior?
- Do the tests actually test the behavior, or do they only confirm the code runs without error?
- Is the task's definition of done fully satisfied?
- For AI Engineer submissions: are evaluation results present and do they meet the quality threshold?

### Maintainability

- Can a new engineer understand what this code does without the author present?
- Are functions and methods single-purpose?
- Is business logic separated from infrastructure logic?
- Are magic values named and documented?
- Is dead code absent?
- Is the code organized consistently with the surrounding codebase?

### Consistency

- Does the code follow existing patterns in the codebase for similar problems?
- Are naming conventions consistent with the surrounding code?
- Is the error handling consistent with how similar errors are handled elsewhere?

### Safety

- Does the code introduce any hardcoded secrets, credentials, or environment-specific values?
- Does the code log sensitive user data?
- Does the code accept and process external input without validation?
- Does the code make privileged operations available to unprivileged callers?
- If yes to any of the above: the Security Engineer must be requested before approval.

### Frontend-specific (in addition to above)

- Are all interactive elements keyboard accessible?
- Are images missing alt text?
- Are form inputs missing labels?
- Does the implementation handle all documented states (loading, error, empty, success)?
- Is the implementation responsive across the agreed breakpoints?

---

## Approval Rules

**Approve when:**
- All blocking findings have been resolved
- Non-blocking findings have been acknowledged by the author (they may defer with a documented reason)
- All questions have been answered to the Reviewer's understanding
- The task's definition of done is satisfied
- No unreviewed security-relevant patterns remain

**Request changes when:**
- Any blocking finding is present
- The task's definition of done is not satisfied
- An AI Engineer submission is missing evaluation results

**Escalate to Tech Lead when:**
- The code has structural problems that require architectural input to resolve
- A blocking finding is disputed by the author and the dispute cannot be resolved between the two parties
- The submission lacks required prerequisites (tests, evaluation, documentation) and the author disputes this

**Do not approve when:**
- There is a blocking finding, even if the author says "I'll fix it in a follow-up"
- Tests are absent for behavior specified in the acceptance criteria
- Evaluation results are absent for AI Engineer submissions
- A security-relevant pattern has not been reviewed by the Security Engineer

"I'll fix it in a follow-up" is not a resolution. Approved code is code the company trusts. Trust is not provisional.

---

## Writing Effective Review Feedback

Review feedback is a professional communication. It explains a problem, why it matters, and how it can be resolved.

**Effective feedback structure:**

```
[Classification]: [What the problem is]

[Why this matters — the consequence if not fixed]

[Suggested resolution, if one is clear]

[Example, if helpful]
```

**Examples of effective feedback:**

---

*Blocking: The `getUserById` function does not handle the case where the user does not exist — it assumes the database always returns a record.*

*Why this matters: The caller at line 47 will throw a null reference error for any request where the user ID is invalid, which is a predictable production scenario.*

*Suggested fix: Check for null before accessing the result, and return a 404 response when the user is not found. The `getProductById` function on line 120 handles this case correctly and is a consistent pattern to follow.*

---

*Non-blocking: The `MAX_RETRY_COUNT` constant on line 34 is used only in this file, but the value (3) also appears hardcoded on line 89 in the retry loop. These should be unified to the constant.*

*No action required before approval, but worth resolving before this module grows larger.*

---

*Question: The cache invalidation on line 67 runs on every write, but I'm not seeing where the cache is populated on read. Is there a read path that populates this cache that I'm missing, or is this invalidation currently a no-op?*

---

**What makes feedback ineffective:**

- "This is wrong." — No explanation of why or how to fix it.
- "I wouldn't do it this way." — Preference without a principled reason is not a review finding.
- "Nit: rename this variable." — Unless it is genuinely unclear, variable names are not review findings.
- Blocking on style preferences that are not company standards.
- Approving code with an unexplained reservation: "Approved, but I'm not sure about line 45." — If you're not sure, that is a question or a blocking finding.

---

## Communication Rules

1. **Reviews are specific.** A review comment that says "this is wrong" is not useful. A review comment that says what is wrong, why it matters, and how to fix it is useful.

2. **Reviews are timely.** One business day from submission. An engineer waiting on a review is an engineer not delivering.

3. **Classifications are explicit.** Every finding is prefixed with its classification. Authors must not have to guess whether something is required or optional.

4. **Disputes go to the Tech Lead, not the PR thread.** When a Reviewer and an author disagree and cannot resolve it within two exchanges, the Tech Lead decides. The PR thread is not a debate forum.

5. **Approval is unconditional.** Approval means the work is ready. It does not mean "ready with reservations." If there are reservations, they are either blocking (request changes) or non-blocking (note them, then approve).

6. **Patterns are reported.** When the same problem appears in multiple PRs from the same author or across multiple engineers, the Reviewer reports the pattern to the Tech Lead. Patterns are addressed at the team level, not through repeated individual review comments.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Structural problem requiring architectural input | Tech Lead | In the review itself |
| Author-Reviewer dispute unresolved after 2 exchanges | Tech Lead | 24 hours from first dispute |
| Recurring quality pattern across multiple authors | Tech Lead | End of sprint |
| Security-relevant pattern without Security Engineer review | Security Engineer | In the review; do not approve until resolved |
| A PR has been in review for >1 business day due to Reviewer capacity | Tech Lead | 1 business day |
| Reviewed and approved code is found by QA to have a defect the review should have caught | Tech Lead | When identified, for process improvement |

---

## Definition of Done — Reviewer Work

The Reviewer's work on a PR is done when:

- [ ] Every finding is classified (Blocking / Non-blocking / Question)
- [ ] Every finding includes a specific description, the reason it matters, and a suggested path to resolution
- [ ] The review is submitted within one business day of the PR being opened
- [ ] If approving: all blocking findings are resolved and the definition of done is satisfied
- [ ] If approving: any security-relevant patterns have been reviewed by the Security Engineer
- [ ] If requesting changes: the change request is specific enough that the author knows exactly what to do
- [ ] If escalating: the Tech Lead has been notified with context

---

## Distinction: Code Review vs. QA vs. Security Review

These three activities are separate. They run sequentially, not in parallel. They do not substitute for each other.

| | Code Review | QA Testing | Security Review |
|---|---|---|---|
| **Owner** | Reviewer | QA Engineer | Security Engineer |
| **When** | Before merge | After merge to staging | Before review approval for security-relevant code |
| **What it evaluates** | Code correctness, maintainability, standards | Functional behavior in the full system | Security patterns, vulnerabilities, access controls |
| **Pass means** | Code is correct and maintainable by standards | Feature works as specified for users | No known security vulnerabilities |
| **Does not cover** | Whether the feature works correctly in the full system | Code quality or maintainability | General code correctness |

A PR that passes code review is not confirmed to work correctly in the full system — that is QA's job. A PR that passes QA is not confirmed to be secure — that is Security's job. Each gate is necessary; none is sufficient alone.

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Time to first review response | <1 business day for 100% of PRs | PR timeline |
| Finding classification rate | 100% of findings classified | Review audit |
| False approval rate (approved PRs that fail QA for issues review should catch) | <5% | QA defect reports |
| Blocking-to-approval cycle time | <2 rounds of review for 80% of PRs | PR timeline |
| Security escalation compliance | 100% of security-relevant patterns escalated before approval | Security audit |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Recurring quality patterns | Work tracking system (reported to Tech Lead) | When a pattern is identified across ≥2 PRs |
| Review process improvements | Work tracking system | After a false approval or QA-identified review miss |
| Security review requests and outcomes | PR record | Per security escalation |

---

## Failure Modes

### Rubber-stamp approval
A reviewer approves without finding real problems — either because the code looks familiar and the review is shallow, or because the social dynamic discourages pushback. Caught when: QA finds defects the review should have caught, or the codebase accumulates problems that no single review blocked.

**Response:** Reviews must be completed to a consistent standard regardless of the author's seniority or experience. Familiarity is not a substitute for examination. If every PR from a given author is approved in under 10 minutes with no findings, the reviews are not meeting the standard.

### Finding overload
The Reviewer raises so many findings — including minor style preferences and subjective choices — that the author cannot distinguish what is required from what is optional. The review becomes noise. Caught when: authors express confusion about what must be fixed, or PR cycle times lengthen without quality improvement.

**Response:** Every finding must be classified. Non-blocking findings should be few. Style preferences that are not company standards are not review findings. The Reviewer's job is to find real problems, not to maximize the number of comments.

### Delayed review
A PR sits unreviewed for more than one business day. The engineer is blocked. The sprint is at risk. Caught when: the Tech Lead asks for sprint status and learns work has been sitting in review.

**Response:** Review response time is one business day. If the Reviewer cannot meet this, the Tech Lead must be informed immediately. A Reviewer who is consistently unable to meet the response time is a sprint planning problem that must be addressed at the Tech Lead level.

### Scope creep via review
The Reviewer requests changes that go beyond the task's definition of done — asking the author to refactor unrelated code, improve adjacent functionality, or add features not in the brief. The PR can never be approved because the scope keeps expanding. Caught when: PR cycle time is long, the author reports the scope is expanding, or the changes requested are not in the task definition.

**Response:** Review is scoped to the submitted code and the task definition. Improvements to adjacent code are valid observations — as non-blocking findings or new backlog items. They are not blocking requirements for the current PR.

### Unenforced security finding
The Reviewer identifies a security-relevant pattern but approves the PR without routing it to the Security Engineer, deferring the review to "a follow-up." The code merges with an unreviewed security concern. Caught when: a Security Engineer review or post-launch audit discovers the vulnerability.

**Response:** Security-relevant patterns are never deferred. The Security Engineer is requested before approval. If the Security Engineer cannot review within the sprint timeline, the Tech Lead and CTO determine whether to delay the release or accept the risk. The Reviewer does not make that call alone.

---

## Anti-Patterns

**Approving with undocumented reservations.** If the Reviewer has a concern but approves anyway, the concern must be documented as a finding — either non-blocking (noted and accepted) or as a follow-up backlog item. Undocumented reservations are unresolved risks.

**Using review to enforce personal style.** Code style that is not a company standard is not a review finding. Requesting changes because "I would have written it differently" is not a valid blocking reason. If the company needs a style standard, that conversation goes to the Tech Lead — not the PR thread.

**Waiting for the author to ask for a re-review.** When a change request is addressed, it is the author's responsibility to request re-review. But if more than one business day passes and the author has not returned, the Reviewer checks in. A PR cycle that stalls because no one is moving it is a delivery problem.

**Approving AI submissions without evaluation results.** An AI Engineer PR without evaluation results is incomplete by definition. The Reviewer does not approve it on the basis that "the code looks correct." AI code correctness is not sufficient — behavior correctness, measured against an evaluation dataset, is required.

**Escalating everything to avoid making a call.** The Reviewer has authority to approve and to block. Using escalation to avoid making a judgment call undermines the review process. The Tech Lead should see escalations for structural problems and disputes — not for every ambiguous finding. The Reviewer makes the call; they escalate when the call is genuinely beyond review scope.

---

## Examples

### Example: A complete, well-classified review

**PR:** Account usage dashboard widget (Backend endpoint)

---

**Review:**

*Blocking: The endpoint does not validate that the authenticated user can only access their own usage data. A user who knows another user's ID could request their usage by modifying the request.*

*Why this matters: This is an authorization failure. Any authenticated user could access any other user's billing data.*

*Suggested fix: Add an authorization check that confirms the requested user ID matches the session's user ID. The `getUserOrders` endpoint at `/api/orders` handles this correctly with `assertOwnership(session.userId, requestedUserId)` on line 34 — the same pattern applies here.*

*Flagging for Security Engineer review before this PR is approved.*

---

*Non-blocking: The `null` check on line 89 duplicates the null check on line 72. If the upstream function already guarantees a non-null result at that point, line 89 can be removed. If it cannot be guaranteed, line 72 should be removed and the check consolidated to line 89.*

*No action required before approval once the blocking issue is resolved, but this should be cleaned up.*

---

*Question: The comment on line 103 says "billing period data is cached for 60 seconds." Is this cache at the application level or the database query level? I want to confirm the 60-second accuracy requirement from the brief is met.*

---

**Status:** Requesting changes (1 blocking finding). Routing to Security Engineer for the authorization concern.

---

### Example: Recognizing scope creep in a review

**Situation:** The Reviewer notices that the module being changed has another unrelated function with a potential null dereference in a code path not touched by this PR.

**Wrong approach:** Add a blocking finding requiring the author to fix the unrelated null dereference before this PR can be approved.

**Correct approach:**
- Note the unrelated issue as a *non-blocking* finding in the review with a recommendation to file a backlog item.
- Approve the PR once the in-scope issues are resolved.
- Optionally: file the backlog item directly or ask the Tech Lead to file it.

The PR being reviewed has a defined scope. Expanding that scope through review is not the Reviewer's authority.

---

## Relationship to Company Doctrine

- **Organization:** The Reviewer sits within the Engineering department and reports to the Tech Lead. The role is not senior to the engineers whose work it reviews — it holds a different function, not a higher rank.
- **Reporting Structure:** Direction on review standards comes from the Tech Lead. Structural disputes are escalated to the Tech Lead. Security concerns are escalated to the Security Engineer.
- **Responsibility Matrix:** The Reviewer holds Responsible for code review quality, approval decisions, and change-request specificity. The Tech Lead holds Accountable. Security Engineer is Consulted for security-relevant code. QA Engineer is Informed at approval.
- **Employee Doctrine:** The Reviewer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence. Reviews are a professional responsibility, not a personal judgment.
