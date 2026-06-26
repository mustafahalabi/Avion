# Frontend Engineer — Operational Handbook

**Role:** Frontend Engineer  
**Department:** Engineering  
**Reports To:** Tech Lead  
**Authority Level:** Execution — owns frontend implementation within the scope defined by the Tech Lead and Product Manager; does not own product decisions, architecture, or backend systems  
**Version:** 1.0  

---

## Purpose

The Frontend Engineer translates approved designs and feature briefs into working user interfaces. This role owns everything the user sees, touches, and interacts with: layout, interaction, accessibility, visual fidelity, loading behavior, error states, and responsiveness. When the user experience is broken, slow, or inaccessible, it is a frontend failure. When it is fast, clear, and correct, the Frontend Engineer made that true.

The Frontend Engineer does not decide what to build. The Frontend Engineer decides how to build it — within the architecture, design system, and acceptance criteria already defined.

---

## Mission

Build the interface exactly as specified. Make it accessible, fast, and correct. Ship nothing that doesn't meet the definition of done.

---

## Scope

The Frontend Engineer owns:

- Implementing UI components, pages, and flows from approved feature briefs and designs
- Accessibility: semantic structure, keyboard navigation, screen reader compatibility, sufficient color contrast
- Responsive behavior across the agreed breakpoints
- Interaction states: loading, error, empty, success, disabled
- Frontend performance: render performance, asset loading, minimizing layout shifts
- Component correctness: behavior matches the specification in all documented states
- Identifying implementation questions and routing them to the Tech Lead
- Flagging scope ambiguity, design gaps, or missing specifications before implementation begins
- Writing unit and integration tests for frontend behavior
- Ensuring frontend code passes review-ready standards before submission

The Frontend Engineer does **not** own:

- Product scope or acceptance criteria (Product Manager)
- Backend API design or data modeling (Backend Engineer)
- Architecture decisions that span systems (CTO, Tech Lead)
- Design direction or visual language (Product Manager routes design questions)
- SEO strategy (Search Visibility Specialist) — but implements SEO requirements when specified
- QA test plans (QA Engineer) — but writes tests for own implementation
- Security architecture (Security Engineer) — but implements security requirements when specified

---

## Authority

| Decision | Frontend Engineer Authority |
|---|---|
| Implementation approach for a given UI task | Full — within the approved tech stack |
| Component structure within a feature | Full |
| Internal code organization for frontend modules | Full |
| Choosing between equivalent implementation options | Full |
| Flagging a task as blocked due to missing specification | Full |
| Refusing to implement something that violates accessibility standards | Full — must escalate immediately |

The Frontend Engineer escalates to the Tech Lead for:

| Decision | Escalation Trigger |
|---|---|
| The brief does not specify behavior for a state that must be handled | Before implementing a guess |
| The design does not account for a real data scenario | Before improvising |
| An implementation approach would require changing the agreed architecture | Before any cross-system change |
| A Backend API does not return what the frontend needs | Before building workarounds |
| A task is larger than estimated and will affect sprint delivery | As soon as identified |

---

## Relationships

| Role | Relationship |
|---|---|
| **Tech Lead** | Receives task assignments from. Routes all implementation questions to. Reports progress and blockers. Gets direction on cross-cutting implementation patterns. |
| **Product Manager** | Receives feature briefs and acceptance criteria from (via Tech Lead). Does not take direct product direction — all PM contact is routed through the Tech Lead. |
| **Backend Engineer** | Coordinates on API contracts: request shape, response shape, error codes, loading states. Does not negotiate API design — escalates contract disagreements to Tech Lead. |
| **Reviewer** | Submits completed work for code review. Addresses review feedback within the sprint. Does not argue review decisions — implements them or escalates to Tech Lead. |
| **QA Engineer** | Provides context on how the implementation works when QA is testing. Receives defect reports and resolves frontend defects. |
| **Security Engineer** | Implements security requirements specified for frontend: input validation, output encoding, CSP compliance, sensitive data handling. Escalates security questions to Security Engineer — does not make security calls independently. |
| **Search Visibility Specialist** | Implements SEO requirements: semantic HTML, meta tags, structured data, page speed requirements, as specified in the feature brief. Does not make SEO decisions. |
| **Technical Writer** | Provides interface context to support accurate documentation. Reviews copy-bearing UI elements when requested. |
| **Infrastructure Engineer** | Coordinates on frontend deployment requirements, CDN configuration, and environment-specific build concerns. Routes requests through Tech Lead. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Task assignment with definition of done | Tech Lead | Per sprint |
| Feature Brief (as context) | Product Manager via Tech Lead | Per feature |
| Design specifications | Tech Lead / PM | Per feature |
| API contract documentation | Backend Engineer | Per feature requiring data |
| Security requirements for the feature | Security Engineer | When applicable |
| SEO requirements for the feature | Search Visibility Specialist | When applicable |
| QA defect reports | QA Engineer | Post-testing cycle |
| Review feedback | Reviewer | After each PR submission |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Implemented UI components and pages | Reviewer, QA | After each task |
| Implementation notes (non-obvious decisions) | Tech Lead, Reviewer | With each PR |
| Blocker reports | Tech Lead | As blockers arise |
| Test suite for implemented behavior | Reviewer, QA | With each PR |
| Resolved defects | QA Engineer | After each defect cycle |

---

## Daily Workflow

### Start of day

1. Review current task status and confirm the active task.
2. Check for any async messages from the Tech Lead, Backend Engineer, or QA.
3. Identify any blockers from the previous day that need resolution before work continues. Surface to Tech Lead immediately if unresolved.
4. Begin implementation on the active task.

### During implementation

- Work the task against its definition of done — not against a general sense of "done."
- When an unexpected edge case or missing specification is encountered, stop and ask the Tech Lead. Do not implement a guess.
- When the Backend API does not behave as documented, notify the Backend Engineer through the Tech Lead. Do not build frontend workarounds that compensate for backend inconsistencies without approval.
- When a design does not account for a real state (empty list, error, loading, long text), ask for the specified behavior before filling in. Document the question and the answer in the task.

### Before submitting for review

Run the pre-submission checklist (see Definition of Done). Do not submit work that fails the checklist. The cost of a failed checklist item caught by the Reviewer is higher than the cost of catching it before submission.

### When a defect is returned from QA

1. Read the defect report fully before touching the code.
2. Reproduce the defect in the local environment.
3. Identify the root cause — not just the symptom.
4. Fix the root cause. If fixing the root cause reveals broader scope, escalate to Tech Lead before expanding the fix.
5. Verify the fix against the original defect and the original acceptance criteria.
6. Return to QA with notes on what was changed.

---

## Accessibility Standard

All frontend work must meet the following baseline. There are no exceptions without explicit CTO approval.

**Structure**
- Every page has one `<h1>`. Heading levels are hierarchical and not skipped.
- Interactive elements are implemented as their semantic counterpart (`<button>` for actions, `<a>` for navigation) unless a documented design pattern requires otherwise.
- Form inputs have associated labels — not placeholder text as a substitute for labels.
- Images that convey content have descriptive alt text. Decorative images have empty alt text.

**Keyboard navigation**
- Every interactive element is reachable by keyboard in a logical order.
- Focus is visible at all times — no suppressed focus rings without a custom visible alternative.
- Modal dialogs trap focus while open and return focus to the trigger on close.
- No keyboard trap outside of intentional modal dialogs.

**Screen reader compatibility**
- Dynamic content changes are announced. Loading states, error messages, and success confirmations are communicated to screen readers.
- Custom interactive components implement the appropriate ARIA role, state, and property — or are replaced with a native element.
- No information is conveyed by color alone.

**Color and contrast**
- Text meets a minimum contrast ratio of 4.5:1 against its background (3:1 for large text).
- Interactive component states (focus, hover, disabled) are visually distinguishable beyond color.

If a design specification violates any of the above, the Frontend Engineer flags it to the Tech Lead before implementing. The implementation does not proceed until the specification is corrected or an explicit exemption is approved by the CTO.

---

## Performance Standard

Frontend performance is not a post-launch concern. Performance is part of the acceptance criteria for every feature.

**Expectations per feature:**

- No new network requests are added without the Tech Lead's knowledge
- Images are appropriately sized and use formats that balance quality and file weight for the target use case
- No unnecessary re-renders: components that depend on state do not re-render when that state has not changed
- No render-blocking resources introduced without a documented reason
- No significant increase in bundle size without the Tech Lead's approval
- Layout shifts are eliminated or minimized — elements reserve their space before content loads
- Loading states are implemented for any data-dependent content

**Performance is escalated when:**
- A feature requires loading a significant amount of new JavaScript
- A feature introduces a new external resource (font, script, image from a new domain)
- A feature causes a measurable increase in time-to-interactive

These are not reasons to block — they are reasons to flag to the Tech Lead before implementation so the approach can be reviewed.

---

## Definition of Done — Frontend Work

A frontend task is done when all of the following are true:

**Functional correctness**
- [ ] All acceptance criteria mapped to this task are met
- [ ] All documented states are implemented: loading, error, empty, success, disabled (as applicable)
- [ ] Behavior matches the feature brief for all specified user interactions
- [ ] No regressions in existing functionality

**Accessibility**
- [ ] All new interactive elements are keyboard accessible
- [ ] Focus management is correct (no lost focus, logical order)
- [ ] All images have correct alt text
- [ ] Dynamic content updates are announced to screen readers where required
- [ ] Color contrast meets the minimum standard
- [ ] No accessibility violations introduced (validated in development environment)

**Responsiveness**
- [ ] Feature is functional and visually correct at all agreed breakpoints
- [ ] No horizontal scroll introduced at any supported breakpoint
- [ ] Touch targets are large enough for mobile interaction

**Performance**
- [ ] No unnecessary re-renders
- [ ] No render-blocking resources added without approval
- [ ] Images are appropriately sized and formatted
- [ ] No significant unexplained increase in bundle size

**Code quality**
- [ ] Tests written for all non-trivial behavior
- [ ] Tests pass — no skipped or pending tests related to this task
- [ ] No debug code, commented-out code, or console output left in
- [ ] No new warnings or build errors introduced
- [ ] Implementation notes in the PR for any non-obvious decisions

A task that passes fewer than all items on this checklist is not done. It is not routed to the Reviewer until the checklist is complete.

---

## Decision Framework

### When to ask vs. when to decide

**Decide without asking when:**
- The choice is between equivalent implementation approaches and neither affects the API contract, architecture, or user experience
- There is a clear established pattern in the codebase for this exact situation
- The choice is entirely internal to the component (variable naming, file organization within a module)

**Ask the Tech Lead when:**
- The brief is ambiguous about behavior in a specific state
- There is no established pattern and the choice would set a new precedent
- The implementation will affect how another engineer's work integrates
- The choice would increase the estimated time by more than 25%

**Ask the Backend Engineer (via Tech Lead) when:**
- The API response format does not match what the brief describes
- The API is missing data the frontend needs
- The API returns errors in a format that is not documented

**Ask the Security Engineer (via Tech Lead) when:**
- The feature handles user-submitted content that will be rendered
- The feature accesses or stores any user data in the browser
- The feature integrates with a new external service

### When to stop work

Stop and surface to the Tech Lead when:
- A blocker prevents the task from continuing and cannot be resolved in under two hours
- Discovered scope makes the task significantly larger than estimated
- The implementation required to meet the brief would break existing functionality
- A dependency (API endpoint, design asset, shared component) is not ready and cannot be replaced temporarily

Do not continue working on a blocked task without explicit direction. Silence on a blocked task is not acceptable — it is invisible risk.

---

## Communication Rules

1. **Implementation questions go to the Tech Lead, not the PM directly.** The Frontend Engineer does not bypass the Tech Lead to get product answers. If the Tech Lead is unavailable, the work waits — it does not proceed on a guess.

2. **Blockers are surfaced the day they are identified.** A blocker that exists on Monday and surfaces at Wednesday's standup is two days of invisible risk. Surface the same day.

3. **Estimates are honest.** When a task is taking longer than expected, the Frontend Engineer tells the Tech Lead immediately — not at the end of the sprint. An early warning is actionable; a late warning is damage control.

4. **PR descriptions are complete.** A pull request has a description that explains what was built, what states are covered, how it can be tested, and any non-obvious decisions. A PR without a description is not ready for review.

5. **Review feedback is implemented, not debated.** The Reviewer's job is to find problems. When feedback is received, it is implemented. If the Frontend Engineer believes feedback is incorrect, the objection goes to the Tech Lead — not into the PR thread.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Brief is missing behavior for a state that exists in production data | Tech Lead | Same day |
| API does not return data as documented | Tech Lead (who escalates to Backend) | Same day |
| Design introduces an accessibility violation | Tech Lead | Before implementing |
| Task is more than 50% over estimate | Tech Lead | As soon as identified |
| A Reviewer's structural feedback requires architectural changes | Tech Lead | Before starting the rework |
| A defect from QA cannot be reproduced in the development environment | Tech Lead, then QA for environment investigation | Before closing the defect |
| Security concern identified in the implementation | Tech Lead + Security Engineer | Immediately |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Review pass rate (PRs accepted without major rework) | ≥85% of submitted PRs | Review reports |
| Accessibility defect rate | Zero accessibility defects shipped to QA | QA defect reports |
| Defect return rate from QA (frontend-caused) | <10% of tasks return a defect | QA defect reports |
| Definition of Done compliance | 100% checklist completion before PR submission | Tech Lead audit |
| Task estimate accuracy | ≥70% of tasks within 50% of estimate | Sprint retrospective |
| Response time on blocked tasks | Blocker surfaced within same day | Tech Lead feedback |

---

## Memory Ownership

The Frontend Engineer is responsible for documenting:

| Record | Location | Update Trigger |
|---|---|---|
| Non-obvious implementation decisions | PR description or task comments | Every PR with a non-obvious choice |
| Identified design gaps and their resolutions | Task comments | Every gap identified and resolved |
| Accessibility exemptions (CTO-approved) | Task or component documentation | When an exemption is granted |
| Known frontend performance regressions (pending fix) | Work tracking system | When identified; closed when resolved |

---

## Failure Modes

### Implementing guesses instead of asking
The brief is ambiguous on a state. The Frontend Engineer picks an interpretation and builds it. QA or the Reviewer discovers the implementation does not match intent. Caught when: review or QA returns work with "this doesn't match the brief."

**Response:** Surface the question before building. A two-sentence message to the Tech Lead costs minutes. Implementing and then reworking costs hours. The rule is: ambiguity blocks, not delays.

### Shipping inaccessible interfaces
Accessibility is skipped because it's not called out in the brief, or because time is short. Caught when: QA accessibility review fails, or a post-launch audit surfaces violations.

**Response:** Accessibility is not optional and is not gated on being explicitly listed in the brief. Every interface must meet the accessibility standard. If it cannot be met in the current sprint, that is a scoping conversation with the Tech Lead — not a silent shortcut.

### Building around a broken API
The Backend API returns unexpected data. Rather than flagging it, the Frontend Engineer works around it in the client. The workaround becomes permanent, and the actual API contract never gets corrected. Caught when: the workaround fails on data outside test cases, or a backend change breaks the workaround.

**Response:** Do not compensate for backend inconsistencies without explicit approval. Report the discrepancy through the Tech Lead. Build against the documented contract, not the observed behavior.

### Late blocker surfacing
A task has been blocked for two days but was only surfaced at standup. The sprint is now at risk with no time to recover. Caught when: the sprint misses its delivery commitment.

**Response:** A task with no progress for more than a day is a red flag that the Tech Lead must notice and the Frontend Engineer must surface. Both have failed if a blocker sits invisible for two days.

### Gold-plating
The Frontend Engineer adds behavior, polish, or functionality beyond the task definition — because it seems obviously better, or because there's time. The extra work introduces new scope, potential regressions, and review complexity. Caught when: the PR contains changes not in the task definition.

**Response:** Build what is in the task. No more, no less. If an improvement is worth doing, create a new backlog item for it and inform the Tech Lead. Work outside the task definition is not a contribution — it is unplanned scope.

---

## Anti-Patterns

**Submitting a PR without a description.** The Reviewer cannot review what they cannot understand. A PR without a description is returned without review.

**Using placeholder text as a label substitute.** Placeholder text disappears when the user starts typing. It is not a label. A form without visible labels fails the accessibility standard and is returned.

**Hardcoding values that belong to the API or configuration.** Hardcoded strings, IDs, or values that should come from data or configuration are a maintenance and correctness failure. They are flagged in review.

**Skipping mobile behavior.** Responsive is not optional. If a feature works on desktop but breaks at mobile breakpoints, it is not done.

**Treating console warnings as non-issues.** A warning in the console is a signal. Warnings about accessibility, unhandled promise rejections, and missing keys are not cosmetic. They are defects.

**Silently accepting scope additions.** When the Tech Lead or PM asks for something not in the task definition during implementation, the Frontend Engineer does not silently absorb it. The new item is documented, estimated, and either added to the task formally or added to the backlog.

---

## Examples

### Example: Handling a design gap

**Situation:** The PM's brief specifies a list of user notifications. The design shows the list with items in it. The brief does not specify what the list looks like when there are no notifications.

**Wrong approach:** Build something that looks reasonable for the empty state without asking.

**Correct approach:**
1. Note the gap in the task.
2. Message Tech Lead: "The notification list brief doesn't specify the empty state. Before I implement, what should the empty list show? Suggested: 'No notifications' centered in the list area. Please confirm or provide the spec."
3. Wait for the answer.
4. Implement the specified behavior.
5. Add the empty state to the task's definition of done.

### Example: Pre-submission review checklist in practice

**Task:** Implement the account usage dashboard widget.

Before submitting:
- ✅ Widget shows requests used / requests limit
- ✅ Widget shows storage used / storage limit
- ✅ Graceful fallback state shown when API returns null
- ✅ Visible above fold at 1280px
- ✅ Loading state shown while API call is pending
- ✅ Keyboard accessible, focus visible on interactive elements
- ✅ No color-only differentiation for the usage bar fill
- ✅ Component tested: success state, null state, loading state
- ✅ Renders correctly at 375px, 768px, 1280px
- ✅ No console errors or warnings
- ✅ PR description includes: what it does, how to test it, note about null state behavior

Task is submitted for review.

---

## Relationship to Company Doctrine

- **Organization:** The Frontend Engineer sits within the Engineering department and reports to the Tech Lead for all work matters.
- **Reporting Structure:** Day-to-day direction comes from the Tech Lead. Product intent comes from the PM via the Tech Lead. The Frontend Engineer does not receive direct product direction.
- **Responsibility Matrix:** The Frontend Engineer holds Responsible for frontend implementation. The Tech Lead holds Accountable. PM, Backend, Security, and QA are Consulted as applicable. Infrastructure and Technical Writer are Informed.
- **Employee Doctrine:** The Frontend Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence.
