# Accessibility Decision Framework

**Status:** Approved  
**Version:** 1.0  
**Owner:** Frontend Engineer  
**Approved By:** CTO  
**Last Updated:** 2026-06-29  

This framework defines how Engineering OS makes accessibility decisions. It is the canonical decision logic the company applies whenever a piece of user-facing work raises a question about usability, semantics, keyboard behavior, screen-reader behavior, color and contrast, focus, or inclusive interaction. It exists so that accessibility is decided the same way every time, by every employee, regardless of who is doing the work or which repository is in play.

This document is implementation-neutral. It does not assume a framework, a component library, a rendering model, or a testing tool. It defines the questions to ask, the criteria to weigh, the evidence required, and the form the answer takes. The implementation layer — how a given repository satisfies these decisions — lives in the repository's own memory and in the [Frontend Engineer handbook](../employees/FRONTEND_ENGINEER.md).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Core Principle: Accessibility Is a Quality Requirement](#3-core-principle-accessibility-is-a-quality-requirement)
4. [Decision Criteria](#4-decision-criteria)
5. [Required Questions](#5-required-questions)
6. [Decision Logic](#6-decision-logic)
7. [Validation Rules and Evidence](#7-validation-rules-and-evidence)
8. [Participation by Role](#8-participation-by-role)
9. [Output Format](#9-output-format)
10. [Worked Examples](#10-worked-examples)
11. [Anti-Patterns](#11-anti-patterns)
12. [Exemptions and Escalation](#12-exemptions-and-escalation)
13. [Related Documents](#13-related-documents)

---

## 1. Purpose

Accessibility decisions are made constantly and usually invisibly: which element to use for a control, whether a color pair is legible, how a status change is announced, what happens when a user navigates with a keyboard instead of a pointer. Left to individual judgment, these decisions drift. One engineer ships a native control; another ships a styled container with a click handler. One screen announces its errors; another shows them only in color. The result is an interface that is accessible in places and broken in others, and a company that cannot say with confidence whether what it ships is usable by everyone it claims to serve.

This framework removes that drift. It gives every employee a single, repeatable way to:

- Recognize when a decision has an accessibility dimension.
- Ask the right questions before committing to an approach.
- Apply consistent criteria to choose between options.
- Produce the evidence that proves the decision was sound.
- Record the decision so the company learns from it.

The framework supports the company belief that **quality is everyone's responsibility** (see the [Company Playbook](../company/COMPANY_PLAYBOOK.md)). Accessibility is not a specialist's afterthought bolted on at QA. It is a property of the work, decided during the work, by the person doing the work.

---

## 2. Scope

### In scope

This framework governs accessibility decisions for any work that produces or changes a human-facing interface, including:

- Page and view structure (headings, landmarks, document order).
- Interactive controls (buttons, links, inputs, menus, dialogs, custom widgets).
- Keyboard operability and focus management.
- Screen-reader and assistive-technology behavior (names, roles, states, announcements).
- Color, contrast, and non-color signaling.
- Forms, validation, and error communication.
- Motion, timing, and content that updates dynamically.
- Responsive and touch interaction, including target sizing.

### Out of scope

- **Implementation mechanics for a specific stack.** How a repository wires focus management or labels a control is a repository-memory and Frontend concern, not a company-level decision rule. This framework states the decision; the repository states the technique.
- **Visual design taste.** Aesthetic preference is a design decision. This framework only constrains design where it crosses into accessibility (for example, contrast or color-only signaling).
- **Brand and content tone.** Owned by Product and Growth.
- **Legal certification.** This framework encodes the company's engineering standard. Formal conformance attestation, where a customer requires it, is a separate, CTO-owned engagement.

### Relationship to the baseline standard

The measurable baseline — one `<h1>` per page, labeled inputs, visible focus, a 4.5:1 text contrast ratio, and so on — is defined in the [Frontend Engineer handbook, Accessibility Standard](../employees/FRONTEND_ENGINEER.md). This framework does not restate that baseline as new rules; it tells employees **how to decide** when a situation is ambiguous, when two compliant options compete, or when the baseline appears to conflict with a design or a deadline. When this framework and the baseline standard agree, the baseline is the floor. When a situation is not covered by the baseline, this framework's decision logic governs.

---

## 3. Core Principle: Accessibility Is a Quality Requirement

Accessibility is treated exactly like correctness, security, and performance: a non-negotiable property of acceptable work, not a feature that can be traded away. The following principles are binding.

1. **Accessibility is part of the Definition of Done.** A user-facing task is not done until its accessibility obligations are met and validated. This mirrors the company [Definition of Done](../company/COMPANY_PLAYBOOK.md) — a task that ships an inaccessible interface is incomplete, not "done with a known issue."

2. **Accessibility is not gated on the brief mentioning it.** The absence of an explicit accessibility requirement in a Feature Brief never lowers the standard. Every user-facing interface meets the baseline whether or not the brief calls it out.

3. **Native semantics first.** When a native element provides the required behavior, it is preferred over a custom re-implementation. Custom widgets are a deliberate, justified choice — never the path of least resistance.

4. **No information by color alone.** Any state communicated by color is also communicated by text, shape, icon, or position.

5. **Keyboard parity.** Anything a user can do with a pointer, a user can do with a keyboard, in a logical order, with focus always visible.

6. **Equivalent experience, not identical experience.** The goal is that every user can perceive, operate, and understand the interface — not that the experience is pixel-identical across every input method or assistive technology.

7. **Decisions are evidenced.** An accessibility claim ("this is keyboard accessible") is only complete when accompanied by the evidence that proves it (see [Validation Rules and Evidence](#7-validation-rules-and-evidence)).

8. **Accessibility failures are defects.** When verification finds an accessibility gap, it is filed as a defect with severity matched to user impact — not logged as a cosmetic observation. This is consistent with QA's treatment of accessibility in the [QA Engineer handbook](../employees/QA_ENGINEER.md).

---

## 4. Decision Criteria

When an accessibility question has more than one defensible answer, weigh the options against the following criteria, in priority order. Higher criteria dominate lower ones; a lower criterion never justifies sacrificing a higher one.

| Priority | Criterion | The question it answers |
|---|---|---|
| 1 | **Perceivability** | Can every user perceive the content and state, regardless of vision, hearing, or input device? |
| 2 | **Operability** | Can every user operate every control — by keyboard, pointer, touch, and assistive technology? |
| 3 | **Understandability** | Is the structure, labeling, and feedback clear enough that the interface can be understood without sighted, pointer-based context? |
| 4 | **Robustness** | Will the solution keep working across assistive technologies and future changes, using durable semantics rather than fragile tricks? |
| 5 | **Consistency** | Does the solution match established patterns in this repository and in the company, so users and engineers encounter one predictable model? |
| 6 | **Implementation cost** | Among options that satisfy the criteria above, which is simplest to build and maintain? |

Cost is the lowest-priority criterion deliberately. Cost may decide between two accessible options; it may never select an inaccessible one. This ordering is the accessibility-specific specialization of the company's general decision order (User Value → Engineering Quality → Maintainability → Performance → Delivery Speed → Complexity) described in the [Company Playbook](../company/COMPANY_PLAYBOOK.md).

---

## 5. Required Questions

Every user-facing change must answer the questions below before it is considered designed or implemented. The questions are grouped by dimension. An honest "not applicable" is an acceptable answer, but the question is always asked. Skipping the questions is itself a process defect.

### Structure and semantics

- Does the view have a single, correct top-level heading, with heading levels that descend without skipping?
- Is each region of the page expressed as a landmark or semantic region a user can navigate to?
- Is every interactive thing implemented as the element that natively carries its behavior (an action as a button, a navigation as a link), or is there a documented reason it cannot be?

### Keyboard and focus

- Can every interactive element be reached and operated by keyboard alone, in an order that matches the visual and logical flow?
- Is focus visible on every focusable element at all times?
- When a transient surface opens (dialog, menu, panel), is focus moved into it, contained while it is open, and returned to the trigger when it closes?
- Are there any keyboard traps outside of an intentional, escapable modal?

### Screen reader and assistive technology

- Does every control have an accessible name that conveys its purpose without relying on surrounding visual context?
- For custom widgets, are the correct role, state, and properties exposed — or should a native element replace the custom one?
- Are dynamic changes (loading, success, error, count updates) announced to assistive technology?

### Color, contrast, and signaling

- Does text meet the minimum contrast ratio (4.5:1 for normal text, 3:1 for large text)?
- Is every state that is shown with color also shown with text, icon, shape, or position?
- Are non-text indicators (focus, selection, error borders) distinguishable beyond hue alone?

### Forms and feedback

- Does every input have a persistent, programmatically associated label — not placeholder text standing in for a label?
- When validation fails, is the user told which field failed and why, in text, and is that message reachable by assistive technology?
- Is required-versus-optional status communicated in more than one way?

### Motion, timing, and responsiveness

- Does any animation respect a user's reduced-motion preference?
- Are there time limits a user could need to extend, or auto-updating content a user could need to pause?
- Does the interface remain operable and free of horizontal scroll across supported breakpoints, with touch targets large enough to use?

---

## 6. Decision Logic

The following procedure converts the questions above into a decision. It is deliberately mechanical so that two employees facing the same situation reach the same outcome.

### Step 1 — Classify the surface

Determine whether the change is user-facing. If it touches anything a person perceives or operates, it is in scope and the framework applies. Internal scripts, build tooling, and non-rendered code are out of scope.

### Step 2 — Choose the element model

For each interactive element, apply this order:

1. **Native element available and sufficient?** Use it. Stop.
2. **Native element available but visually constrained?** Use the native element and restyle it. A styling limitation is not a license to abandon native semantics.
3. **No native element fits the interaction?** Build a custom widget against a recognized interaction pattern, and supply the role, state, property, and keyboard behavior that pattern requires. Record why a native element was insufficient.

Re-implementing a native control as a generic container with a handler is the lowest-ranked option and requires justification under [Exemptions](#12-exemptions-and-escalation).

### Step 3 — Establish keyboard and focus behavior

Define the full keyboard contract before implementation: what is focusable, in what order, what each key does, and how focus moves when surfaces open and close. If the contract cannot be stated, the design is not yet complete and is flagged to the Tech Lead.

### Step 4 — Establish the assistive-technology contract

Define the accessible name, role, and announced state changes for every control and every dynamic region. If a state change matters to a sighted user, it matters to a screen-reader user; specify how it is announced.

### Step 5 — Resolve color and contrast

Verify contrast against the baseline. For every color-carried meaning, add a redundant non-color signal. If a brand or design choice fails contrast, this is a design conflict, not an accessibility waiver — escalate per Step 7.

### Step 6 — Validate and collect evidence

Run the validation appropriate to the change (see [Validation Rules and Evidence](#7-validation-rules-and-evidence)) and capture the evidence that each obligation is met. A decision without evidence is not finished.

### Step 7 — Escalate conflicts; never silently downgrade

If meeting the standard conflicts with a design specification, a deadline, or a technical constraint, the decision is escalated to the Tech Lead before any work proceeds. The interface is never quietly shipped below standard. Only the CTO may grant an exemption, and only with a recorded rationale and remediation plan.

```
user-facing change?
  no  -> framework does not apply
  yes -> choose element model (native first)
         -> define keyboard + focus contract
            -> define assistive-technology contract
               -> resolve color/contrast + non-color signaling
                  -> standard met?
                       yes -> validate, collect evidence, record decision -> DONE
                       no  -> conflict? escalate to Tech Lead
                                          -> CTO exemption with rationale + remediation
                                          -> otherwise: do not proceed
```

---

## 7. Validation Rules and Evidence

A decision is only complete when it is validated and the validation is recorded. The company does not accept "it should be accessible" — it accepts demonstrated accessibility. Evidence is proportional to the surface's complexity and risk.

### Evidence by obligation

| Obligation | Required evidence |
|---|---|
| Semantic structure | Confirmation that heading order is correct and regions are reachable as landmarks; an accessibility-tree inspection for non-trivial views |
| Keyboard operability | A recorded keyboard walkthrough: every control reached and operated by keyboard, focus visible throughout, in logical order |
| Focus management | Confirmation that transient surfaces move, contain, and restore focus, with no unintended traps |
| Accessible names and roles | Inspection of the accessibility tree confirming each control's name, role, and state |
| Dynamic announcements | Confirmation that loading, success, and error changes are announced, via assistive-technology check or accessibility-tree verification |
| Color and contrast | Measured contrast ratios for affected text and indicators; confirmation that no meaning is color-only |
| Forms and errors | Confirmation that labels are associated and that validation errors are identified in text and reachable by assistive technology |
| Motion and timing | Confirmation that reduced-motion preference is respected and that no uncontrollable time limit exists |
| Responsiveness | Confirmation of operability and no horizontal scroll at supported breakpoints; touch-target sizing checked |

### Validation tiers

- **Automated checks** catch a meaningful subset (missing names, contrast failures, structural errors) and are run in the development environment as a precondition, not a conclusion. Zero automated violations is necessary but not sufficient.
- **Manual keyboard and assistive-technology checks** are required for any new or changed interactive surface. Automated tooling does not certify operability; a human walkthrough does.
- **Tool-agnostic by design.** This framework names no specific scanner, browser, or screen reader. The repository's memory records which tools that repository uses; the obligation is that the evidence exists and is reproducible, not that a particular product produced it.

### Where evidence lives

Validation evidence is attached to the work item and referenced in the decision record (see [Output Format](#9-output-format)). For released work it becomes part of QA's record, consistent with the [QA Validation SOP](../sops/QA_VALIDATION.md). Accessibility evidence is durable: a future engineer revisiting the surface can see what was checked and how.

---

## 8. Participation by Role

Accessibility is owned end to end by the Frontend Engineer but is a shared responsibility across the delivery chain. Each role applies this framework at a defined point. Ownership boundaries follow the [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md).

| Role | When they apply the framework | What they own |
|---|---|---|
| **Frontend Engineer** | During implementation | Primary owner. Chooses the element model, defines keyboard and assistive-technology contracts, resolves contrast, collects evidence, and records the decision. Refuses to implement a specification that violates the standard and escalates instead. See the [Frontend Engineer handbook](../employees/FRONTEND_ENGINEER.md). |
| **Product Manager** | During brief authoring | Ensures acceptance criteria do not implicitly require an inaccessible pattern, and treats accessibility as a default expectation rather than a scoped extra. Owns the scope conversation when the standard cannot be met in the planned window. See the [Product Manager handbook](../employees/PRODUCT_MANAGER.md). |
| **Reviewer** | During code review | Verifies that the required questions were answered and the evidence exists. Files blocking findings for accessibility gaps; an accessibility violation is a blocking finding, not a suggestion. See the [Code Review SOP](../sops/CODE_REVIEW.md) and the [Reviewer handbook](../employees/REVIEWER.md). |
| **QA Engineer** | During QA validation | Performs functional accessibility verification (keyboard operability, tab order, labeling, error identification, announcements) and files failures as defects with user-impact severity. See the [QA Engineer handbook](../employees/QA_ENGINEER.md). |
| **Search Visibility / SEO Specialist** | During public-page review | Confirms that accessibility and crawlability reinforce rather than fight each other — semantic structure, descriptive text alternatives, and meaningful link text serve both users and crawlers. See the [SEO Specialist handbook](../employees/SEO_SPECIALIST.md). |
| **CTO** | On exemption requests and conflicts | Sole authority to grant an exemption from the baseline, with recorded rationale and remediation plan. Holds final architectural authority over the framework itself. |

No role may silently waive accessibility. A gap is either fixed, or escalated and formally exempted by the CTO. The CEO is never asked to decide accessibility implementation; the company owns that, surfacing only the rare exemption that carries product or risk consequences.

---

## 9. Output Format

Every non-trivial accessibility decision produces a short, structured record. This makes the decision auditable, teaches future work, and gives the Reviewer something concrete to verify. Routine applications of the baseline do not each need a record; a decision needs a record when an option was chosen between alternatives, when a custom widget was built, or when an exemption was requested.

The record uses the company structured-communication shape (Recommendation → Reasoning → Risks → Alternatives → Confidence → Next Action) and is stored as a Decision Record in company memory per the [Domain Model](../architecture/DOMAIN_MODEL.md).

```
Accessibility Decision Record

Surface:          <view / component / flow affected>
Decision:         <the approach chosen, stated plainly>
Element model:    <native | restyled native | custom widget + pattern>
Keyboard contract:<focus order, key behaviors, focus move/return>
AT contract:      <accessible names, roles, announced state changes>
Color/contrast:   <ratios verified; non-color signals used>
Reasoning:        <why this option, against the decision criteria>
Alternatives:     <options rejected, and why>
Evidence:         <links to validation: keyboard walkthrough, AT check,
                   contrast measurements, automated results>
Risks:            <residual risk, if any>
Confidence:       <low | medium | high>
Exemption:        <none | CTO-approved, with rationale + remediation date>
Next action:      <follow-up work, if any>
```

A claim in this record without corresponding evidence is treated as unverified and is returned by the Reviewer.

---

## 10. Worked Examples

### Example A — Action styled as a non-interactive container

**Situation.** A design shows a "Save" action rendered as a styled box. The quickest implementation attaches a click handler to a generic container.

**Application.** Step 2 of the [decision logic](#6-decision-logic): a native action element exists and is sufficient. A generic container with a handler is the lowest-ranked option, would not be keyboard operable by default, and would expose no role or state. The decision is to use the native button element and restyle it to match the design.

**Outcome.** Native button, keyboard operable for free, correct role and state, visible focus. Evidence: keyboard walkthrough and accessibility-tree inspection confirming name and role. No exemption needed. This is the canonical resolution of the most common anti-pattern.

### Example B — Status communicated only by color

**Situation.** A list shows item health as a green or red dot.

**Application.** Required questions on signaling: meaning is carried by color alone. Criterion 1 (Perceivability) fails for users who cannot distinguish the hues.

**Outcome.** Add a redundant signal — a text label ("Healthy" / "Failing") and a distinct shape or icon — alongside the color. Evidence: confirmation that the state is legible without color and that contrast for the text passes.

### Example C — Competing accessible options for a custom menu

**Situation.** No native element fits a roving multi-level menu. Two accessible implementations are proposed; one is simpler to maintain.

**Application.** Both options satisfy Perceivability, Operability, Understandability, and Robustness. The tie is broken by Consistency (does one match an existing pattern in the repository?) and then Implementation cost. Because both are accessible, cost is legitimately allowed to decide.

**Outcome.** The pattern matching the repository's existing menu is chosen; the decision and the rejected alternative are recorded so the next engineer reuses the same model.

### Example D — Design conflict with contrast

**Situation.** Brand guidance specifies a light-gray label on white that measures 2.9:1.

**Application.** Step 5 finds a contrast failure. This is a design conflict, not an accessibility waiver. Step 7: escalate to the Tech Lead before implementing. The resolution is a corrected color that passes 4.5:1, or, if brand insists, a CTO exemption with a recorded rationale and a remediation date. The interface does not ship at 2.9:1 by default.

---

## 11. Anti-Patterns

These are recurring failures the framework exists to prevent. Each is a defect, not a preference.

- **Treating accessibility as out of scope because the brief did not mention it.** The standard applies to every user-facing interface unconditionally.
- **Re-implementing native controls as generic containers.** This discards built-in keyboard, role, and state behavior and is the single most common source of inaccessible interfaces.
- **Using placeholder text as a label.** Placeholder text disappears on input and is not an accessible name. A form without persistent associated labels fails the standard.
- **Suppressing the focus indicator for aesthetics.** Removing visible focus without a custom visible replacement breaks keyboard operability.
- **Conveying meaning by color alone.** Every color-carried state needs a redundant signal.
- **Announcing nothing on dynamic change.** Loading, success, and error states that are silent to assistive technology leave non-sighted users without feedback.
- **Declaring "accessible" without evidence.** An unverified claim is not a decision; it is a hope.
- **Treating accessibility findings as cosmetic.** Accessibility gaps are defects with user-impact severity, filed and tracked like any other defect.
- **Silently shipping below standard to hit a deadline.** The only path below the baseline runs through a recorded CTO exemption with a remediation plan.
- **Inaccessible interactive content hidden behind crawlable markup.** Public pages must serve users and crawlers with the same semantic, operable structure.

---

## 12. Exemptions and Escalation

The baseline accessibility standard has no exceptions without explicit CTO approval. This framework defines the only legitimate path to a temporary gap.

1. **Identify the conflict.** The Frontend Engineer (or Reviewer, or QA) determines that the standard cannot be met as specified, whether for design, technical, or timeline reasons.
2. **Escalate to the Tech Lead before proceeding.** Work does not continue on the affected surface while the conflict is open.
3. **Attempt resolution first.** Most conflicts are resolved by correcting the specification (a different color, a native element, a revised interaction). An exemption is a last resort, not a shortcut.
4. **Request a CTO exemption if unresolved.** The request states the gap, the user impact, why it cannot be met now, and a concrete remediation date.
5. **Record it.** An approved exemption is documented on the work item and in the decision record, with the remediation tracked as follow-up work. An exemption without a remediation plan is not granted.

Escalation paths follow the company [Escalation Rules](../company/COMPANY_PLAYBOOK.md). Accessibility conflicts are an engineering matter resolved within the company; they reach the CEO only when an exemption carries product, brand, or compliance consequences that require a business decision.

---

## 13. Related Documents

- [Company Playbook](../company/COMPANY_PLAYBOOK.md) — company values, decision order, Definition of Done, and escalation rules this framework specializes.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — definitions of Decision, Decision Record, Review, and QA Result objects referenced here.
- [Frontend Engineer handbook](../employees/FRONTEND_ENGINEER.md) — the measurable accessibility baseline and the implementation-level standard.
- [QA Engineer handbook](../employees/QA_ENGINEER.md) — functional accessibility verification and defect handling.
- [Reviewer handbook](../employees/REVIEWER.md) — how accessibility gaps are surfaced as blocking findings in review.
- [Product Manager handbook](../employees/PRODUCT_MANAGER.md) — accessibility as a default expectation in briefs and acceptance criteria.
- [SEO Specialist handbook](../employees/SEO_SPECIALIST.md) — alignment of accessibility and crawlability on public pages.
- [Code Review SOP](../sops/CODE_REVIEW.md) — where the Reviewer applies this framework.
- [QA Validation SOP](../sops/QA_VALIDATION.md) — where QA records accessibility evidence.
- [New Feature SOP](../sops/NEW_FEATURE.md) — the delivery flow in which these decisions are made.
- [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) — ownership boundaries across roles.
