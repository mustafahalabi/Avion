# SOP: Code Review

**SOP ID:** SOP-003  
**Category:** Standard Operating Procedure  
**Owner:** Reviewer  
**Version:** 1.0  

---

## Purpose

Code review is the mechanism by which the engineering organization ensures that code merged into the codebase meets its quality, correctness, security, and maintainability standards before it is shipped to users. It is not a bureaucratic gate. It is a collaboration between the author and the Reviewer — a second perspective that catches what the author cannot see alone.

Code that is reviewed well is code the entire team owns. Code that is rubber-stamped is code the author owns alone, with all the risk that implies. The quality of a review is inseparable from the quality of what ships.

---

## Trigger

This procedure is triggered when:

- An engineer has completed a task, confirmed it meets its Definition of Done, and submitted the change for review
- A Tech Lead has confirmed Delivery Readiness and routed the change to the Reviewer
- A hotfix requires expedited review

---

## Owner

**Reviewer** — owns the review from the moment it is assigned through approval or escalation. The Reviewer is accountable for the accuracy and completeness of every finding.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Author (engineer)** | Prepares the change for review; responds to findings; implements required changes |
| **Tech Lead** | Confirms Delivery Readiness before routing to Reviewer; receives escalations; routes security referrals |
| **Reviewer** | Performs the review; classifies all findings; approves, requests changes, or escalates |
| **Security Engineer** | Performs security review when the change contains security-relevant patterns |
| **QA Engineer** | Performs QA validation after the change is approved and merged (covered in SOP-004: QA Validation) |

---

## Preconditions

Before a change enters code review, all of the following must be true:

- [ ] The author has confirmed the change satisfies the task Definition of Done
- [ ] The Tech Lead has completed Delivery Readiness review (10-item checklist per the Tech Lead handbook)
- [ ] The change is scoped to a single task or a coherent, bounded set of changes — it is not a bundle of unrelated work
- [ ] The change includes tests appropriate to what was built or changed
- [ ] The change description clearly states: what changed, why it changed, and how to verify it

A change that does not satisfy preconditions is returned to the author by the Reviewer without review, with the specific precondition that is not met.

---

## Procedure

### Phase 1: Review Preparation (Author)

**Owner:** Author  
**Input:** Completed change  
**Output:** Review-ready change with complete context  

**Steps:**

1. **Author** confirms the change satisfies the task Definition of Done before requesting review. The Reviewer should not be the person who discovers a missing test, an unrun build, or an unmet acceptance criterion.

2. **Author** writes a change description that includes:
   - **What:** a concise summary of what this change does
   - **Why:** what problem this solves or what requirement this satisfies, with a reference to the originating task or Feature Brief
   - **How to verify:** the steps a Reviewer should take to confirm the change behaves as described
   - **Risk areas:** any parts of the change the author is uncertain about, or areas where a second set of eyes is especially valuable
   - **Out of scope:** anything the Reviewer might expect to see that is intentionally not included in this change

3. **Author** flags the change for security review if any of the security review trigger conditions (per the Security Engineer handbook) apply.

4. **Author** routes the change to the Reviewer via the Tech Lead.

**Gate 1:** Change is submitted with a complete description. Preconditions are satisfied.

---

### Phase 2: Review (Reviewer)

**Owner:** Reviewer  
**Input:** Change with complete description; acceptance criteria from the originating task  
**Output:** Review findings, classified and written  

**Steps:**

1. **Reviewer** reads the change description fully before examining the code. The description frames the intent; the code is examined against that intent.

2. **Reviewer** reviews the change for:

   **Correctness**
   - Does the change do what the description says it does?
   - Does it satisfy the acceptance criteria it is meant to address?
   - Are there edge cases not handled that the acceptance criteria require?
   - Does the change handle error conditions correctly?

   **Test coverage**
   - Does the change include tests?
   - Do the tests cover the behavior being changed, not just the happy path?
   - Is there a test for each acceptance criterion the change claims to satisfy?
   - For bug fixes: is there a regression test that would catch a recurrence?

   **Code quality**
   - Is the change readable by someone who did not write it?
   - Are variable, function, and class names clear and consistent with the codebase conventions?
   - Is there duplication that should be consolidated?
   - Is there complexity that is not warranted by the problem?

   **Security**
   - Does the change introduce any of the security review trigger conditions?
   - If so, has the Security Engineer been flagged?

   **Maintainability**
   - Would a future engineer understand what this code does and why, without asking the author?
   - Are there implicit dependencies or behavioral assumptions that should be made explicit?

   **Scope**
   - Is the change scoped to what was described? Does it include unrelated changes?
   - Are there changes that belong in a separate PR?

3. **Reviewer** classifies every finding before writing it:
   - **[Blocking]** — must be resolved before the change can be approved. The Reviewer will not approve until this is addressed.
   - **[Non-blocking]** — should be addressed in this change or in a follow-up; does not prevent approval. The author acknowledges it.
   - **[Question]** — the Reviewer needs clarification; may become Blocking or Non-blocking once answered.

4. **Reviewer** writes findings using the following format:
   - **Classification prefix:** `[Blocking]`, `[Non-blocking]`, or `[Question]`
   - **Location:** the specific line, function, or section where the finding applies
   - **Observation:** what the Reviewer sees
   - **Reasoning:** why it matters
   - **Suggestion:** what would resolve it (for Blocking and Non-blocking findings)

5. **Reviewer** determines the overall outcome after completing all findings:
   - **Approve** — no Blocking findings; the change may be merged
   - **Request Changes** — one or more Blocking findings exist; the change may not be merged until they are resolved
   - **Escalate** — the change requires input beyond the Reviewer's authority (security decision, architectural decision, risk acceptance)

**Gate 2:** All findings are written, classified, and an overall outcome is determined.

---

### Phase 3: Security Review (when triggered)

**Owner:** Security Engineer  
**Input:** Change flagged for security review; context from the Author and Reviewer  
**Output:** Security clearance or security finding(s)  

**Steps:**

1. **Security Engineer** reviews the change for security-relevant patterns using the Security Review Standard defined in the Security Engineer handbook.

2. **Security Engineer** classifies all security findings using the same Blocking / Non-blocking / Question classification.

3. **Security Engineer** issues one of the following outcomes:
   - **Approved** — no security concerns
   - **Conditionally approved** — specific required changes documented
   - **Blocked** — unacceptable security risk; change must not merge until resolved
   - **Escalated to CTO** — risk acceptance decision required

4. The change cannot receive a final Approve from the Reviewer while a Security Engineer block is active.

**Gate 3 (when applicable):** Security Engineer review is complete. No active security blocks.

---

### Phase 4: Author Response

**Owner:** Author  
**Input:** Review findings  
**Output:** All findings addressed  

**Steps:**

1. **Author** reads all findings before implementing any changes. Understanding the full set of findings prevents local fixes that conflict with each other.

2. For each **[Blocking]** finding:
   - The author implements the required change, or
   - The author explains why the suggested resolution is incorrect and proposes an alternative — the Reviewer then decides whether the alternative resolves the finding
   - "I'll fix it in a follow-up" is not a resolution for Blocking findings

3. For each **[Non-blocking]** finding:
   - The author implements the suggestion and acknowledges it, or
   - The author acknowledges it and explains why they are not implementing it, with the intent to address it in a follow-up (the follow-up is tracked, not verbal)

4. For each **[Question]**:
   - The author answers the question clearly
   - The Reviewer then determines whether the answer resolves it or reclassifies it

5. **Author** notifies the Reviewer when all findings have been addressed and the change is ready for re-review. The author summarizes what changed in response to findings.

**Gate 4:** Author has addressed all findings and notified the Reviewer.

---

### Phase 5: Re-Review and Approval

**Owner:** Reviewer  
**Input:** Updated change; author's responses to findings  
**Output:** Final outcome (Approve or continued Request Changes)  

**Steps:**

1. **Reviewer** confirms that each Blocking finding has been resolved as required — or accepts an alternative the author has proposed.

2. **Reviewer** confirms that Non-blocking findings have been acknowledged and are either resolved or tracked.

3. **Reviewer** confirms security clearance is in place if the change required security review.

4. **Reviewer** issues Approve.

5. **Tech Lead** or author merges the approved change.

**Gate 5:** Change is approved and merged.

---

## Review Quality Standards

The Reviewer is accountable for the quality of the review, not only for producing a response. A review that issues Approve without examining correctness, test coverage, and security triggers is not a review — it is a signature.

### Standards for the Reviewer

**Thoroughness:** Every file changed is read. The Reviewer does not sample. If the change is too large to review thoroughly in one pass, the Reviewer asks the author to split the change before reviewing.

**Specificity:** Every finding references the specific location it applies to. A finding that says "the error handling needs work" is not actionable. A finding that says "[Blocking] `handlePayment()` catches all exceptions and returns a 200 response — this masks payment processing failures from callers. Callers need to receive an error signal they can act on" is actionable.

**Accuracy:** The Reviewer does not flag things they are uncertain about as Blocking without first asking a [Question] to clarify. Blocking findings are findings the Reviewer is confident require resolution.

**Completeness:** The Reviewer surfaces all findings in the first pass where possible. A finding discovered after approval requires re-opening the review. Incomplete first passes slow the process and reduce trust.

**Timeliness:** Code review is completed within one business day of assignment. When the Reviewer cannot complete a review within that window, they notify the Tech Lead immediately.

### Standards for the Author

**Responsiveness:** The author responds to findings within one business day. When the author disagrees with a Blocking finding, they explain their position specifically — they do not simply re-submit the change unchanged and hope for approval.

**Scope discipline:** The author does not add unrelated changes after a review has started. If a related fix is discovered during the review response, it is either included with the Reviewer's knowledge or submitted as a separate change.

**Honesty about risk:** When the author flags risk areas in the change description, they are doing the Reviewer a service. The change description is not a sales pitch for the change — it is a briefing.

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| A Blocking finding is disputed and the author and Reviewer cannot agree on resolution | Tech Lead | After one full exchange of positions |
| A change has a security risk that exceeds the Reviewer's authority to accept | Security Engineer, CTO | When the Reviewer identifies the risk |
| A change requires an architectural decision that has not been made | CTO, Tech Lead | Before the change can proceed |
| A change cannot be reviewed within the one-business-day window | Tech Lead | As soon as the Reviewer knows |
| The same author has recurring Blocking findings across multiple reviews | Tech Lead | When the pattern is identified (2+ reviews) |
| A Reviewer consistently approves changes that later reveal defects in QA or production | Tech Lead, CTO | When the pattern is identified |

---

## Review Output Format

Every finding in a review follows this format:

```
[Classification] Location: specific file, function, or line

Observation: what the Reviewer sees.
Reasoning: why it matters.
Suggestion: what would resolve it.
```

**Example — Blocking finding:**

```
[Blocking] api/payments.js, line 147 — handleWebhookEvent()

Observation: The function does not verify the webhook signature before processing the event payload.
Reasoning: An unsigned webhook can be replayed or forged. Processing it allows an attacker to trigger payment state changes without a valid originating event.
Suggestion: Verify the signature against the shared secret before deserializing the payload. The approved pattern for this is in the Security Patterns Library under "Webhook authentication."
```

**Example — Non-blocking finding:**

```
[Non-blocking] utils/formatDate.js, line 23

Observation: The date formatting logic is duplicated here and in utils/formatTimestamp.js.
Reasoning: Both functions do the same thing with slightly different variable names. If the format needs to change, it will need to change in two places.
Suggestion: Consider consolidating into a single utility in a follow-up — not blocking this change since the duplication predates it.
```

**Example — Question:**

```
[Question] db/migrations/0042_user_schema.sql

Observation: This migration adds a NOT NULL column to the users table without a default.
Reasoning: On a table with existing rows, this will fail unless rows are backfilled first. I want to confirm there's a backfill step I'm not seeing, or that this is intentional for a table that has no existing rows.
Suggestion: If there are existing rows, either add a default or a separate backfill migration before this one.
```

---

## Definition of Done

A code review is done when all of the following are true:

- [ ] All findings are written with classification prefix, location, observation, reasoning, and suggestion
- [ ] An overall outcome has been determined: Approve, Request Changes, or Escalate
- [ ] For Request Changes: all Blocking findings are resolved before Approve is issued
- [ ] For security-relevant changes: Security Engineer review is complete with no active blocks
- [ ] All Non-blocking findings are acknowledged by the author (resolved or tracked)
- [ ] The change is approved and merged

---

## Memory Updates

Code review does not typically produce standalone memory records, but the following updates occur as a result of reviews:

| Trigger | Record Updated | Owner |
|---|---|---|
| A Blocking finding reveals a missing or incorrect pattern in the codebase | Tech Lead creates a follow-up work item; Security Engineer updates the pattern library if security-relevant | Tech Lead / Security Engineer |
| A recurring finding type is identified across multiple reviews | Tech Lead documents the pattern and determines whether standards or training should be updated | Tech Lead |
| A change introduces a new approved pattern | Security Engineer or Tech Lead updates the relevant pattern documentation | Security Engineer / Tech Lead |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Review turnaround time | <1 business day from assignment to first response | Review records |
| Author response time | <1 business day from finding delivery to author response | Review records |
| Post-merge Blocking defect rate | <5% — changes approved without Blocking findings that are later found to have Blocking-level defects in QA or production | QA and incident records |
| Security referral compliance | 100% — all changes meeting security trigger conditions receive Security Engineer review | Security review log |
| Precondition return rate | Tracked — changes returned before review due to unmet preconditions | Review records |

---

## Failure Modes

### Approval without genuine review
The Reviewer approves because the author is senior, the change looks familiar, or time is short. A defect that the Reviewer would have caught with a thorough read ships to production. Caught when: a QA or production defect is traced to a change that received a single-sentence approval with no findings.

**Response:** Approvals without findings are a signal, not a proof of quality. A change with no issues is possible — but the Reviewer should be able to articulate why: the code is simple, well-tested, and within a well-understood area. An approval on a 400-line change with no findings and no questions warrants scrutiny of the review process itself.

### Blocking finding resolved without verification
The author responds to a Blocking finding by making a change. The Reviewer approves without confirming the change actually resolves the finding — they take the author's word for it. The original issue persists in a slightly different form. Caught when: the issue surfaces in QA or production after being marked resolved.

**Response:** The Reviewer re-reviews every Blocking finding's resolution specifically. "Author says it's fixed" is not a resolution. The Reviewer reads the updated code at the finding's location and confirms the issue is gone.

### Finding scope creep
The Reviewer expands the review beyond the change's scope, raising Blocking findings on code the author did not touch and did not introduce. The review becomes a general audit of the codebase rather than a review of the change. The author is held responsible for pre-existing issues they did not create. Caught when: the author escalates a Blocking finding the Reviewer acknowledges predates the change.

**Response:** Review scope is the change. The Reviewer flags pre-existing issues as Non-blocking observations or creates separate work items for them — they do not block the current change on issues the author did not introduce. When a pre-existing issue is serious enough to block the change (e.g., the change makes a bad pattern worse), the Reviewer states this explicitly and the reasoning is discussed.

### Non-blocking findings ignored without acknowledgment
The author responds to Blocking findings and submits for re-review. Non-blocking findings are silently ignored — not resolved, not acknowledged, not tracked. The Reviewer approves anyway because there are no Blocking findings remaining. The Non-blocking issues accumulate without record. Caught when: a future review surfaces the same Non-blocking issue and there is no record of it having been raised before.

**Response:** Non-blocking findings require explicit acknowledgment. The author either resolves them, or states that they are tracking them for a follow-up (with a specific work item reference). "I saw it" is not an acknowledgment. The Reviewer confirms acknowledgment before approving.

### Review used as a design feedback session
A change arrives for review that embeds a design decision that was never discussed. The Reviewer raises a Blocking finding about the design approach. The author and Reviewer debate the design in the review thread. The review becomes a design session that should have happened at planning. Multiple rounds of changes follow. Caught when: a review requires more than two rounds of Blocking findings and author responses.

**Response:** Design decisions are made before implementation, not discovered during review. When a change arrives for review with an embedded design decision, the Reviewer may note it — but raises it as a systemic issue with the Tech Lead rather than attempting to resolve it through the review. The appropriate response is: "This design approach was not discussed in planning. I have a concern about it. Please involve the Tech Lead before proceeding." Design feedback during review is a symptom of an upstream process failure.
