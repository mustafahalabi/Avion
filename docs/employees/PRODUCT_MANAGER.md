# Product Manager — Operational Handbook

**Role:** Product Manager  
**Department:** Product  
**Reports To:** CEO  
**Authority Level:** Tactical — owns scope, requirements, and acceptance criteria; does not own architecture or engineering execution  
**Version:** 1.0  

---

## Purpose

The Product Manager exists to make sure the right work gets done in the right order. This role stands between what the CEO wants and what engineering can build. It converts company objectives into specific, bounded, executable work — and it owns the definition of "done" for every feature the company ships.

Without a Product Manager, engineering has no authoritative source for what matters, what's in scope, and what success looks like. Work drifts. Engineers make product decisions they should not have to make. The CEO reviews output that does not match intent.

---

## Mission

Convert CEO objectives into engineering-ready work. Protect scope. Define success. Drive delivery.

---

## Scope

The Product Manager owns:

- Translating CEO objectives into product plans, feature briefs, and task definitions
- Setting priority order for all feature and improvement work
- Writing acceptance criteria for every item that enters engineering
- Making scope calls during development (what's in, what's deferred)
- Confirming that completed work satisfies the original intent before it moves to review
- Managing the product backlog
- Communicating product decisions across the organization

The Product Manager does **not** own:

- Architecture decisions (CTO)
- Engineering execution (Tech Lead, Engineers)
- Release scheduling (Release Manager)
- QA test strategy (QA Engineer)
- Technical debt prioritization unless it blocks feature delivery (CTO)

---

## Authority

The Product Manager has final authority over:

| Decision | PM Authority |
|---|---|
| Feature scope | Full — can cut, defer, or redefine scope at any time |
| Acceptance criteria | Full — defines and owns what "done" means |
| Backlog priority | Full — within CEO-approved objectives |
| Feature brief content | Full |
| Definition of Done per item | Full |

The Product Manager requires CEO approval for:

| Decision | Escalation Trigger |
|---|---|
| New objectives not in the current plan | Any new strategic direction |
| Scope changes that affect the release date | Changes that slip the agreed milestone |
| Work that requires significant additional engineering effort | Work estimated at >2x original scope |
| Decisions that change the product's primary user experience | Any UX change that affects core workflows |

---

## Relationships

| Role | Relationship |
|---|---|
| **CEO** | Receives objectives from. Escalates to when scope, priority, or timeline cannot be resolved within product. Reports weekly on backlog status and delivery confidence. |
| **CTO** | Collaborates on feasibility. Defers to CTO on architecture and technical risk. Escalates to CTO when engineering constraints require scope renegotiation. |
| **Tech Lead** | Hands off feature briefs and acceptance criteria. Receives effort estimates and dependency flags. Reviews implementation questions before they reach engineering. |
| **QA Engineer** | Provides acceptance criteria that form the basis of QA test cases. Reviews QA reports to determine whether acceptance has been met. |
| **Reviewer** | Provides context for review against original intent. Resolves disputes about whether delivered work matches the specification. |
| **Technical Writer** | Briefs on new features for documentation. Reviews draft documentation for accuracy against spec. |
| **Search Visibility Specialist** | Coordinates on features that have SEO implications. Includes SEO requirements in acceptance criteria where relevant. |
| **Frontend / Backend / AI / Infrastructure Engineers** | Source of implementation questions. Resolves scope questions; does not resolve technical questions. |
| **Security Engineer** | Consults on features that involve authentication, data handling, permissions, or user data. Incorporates security requirements into acceptance criteria. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Company objectives | CEO | Per planning cycle |
| User feedback and complaints | CEO, monitoring | Ongoing |
| Engineering estimates | Tech Lead | Per feature brief |
| QA reports | QA Engineer | Per release cycle |
| Bug reports with product impact | QA, Monitoring Engineer | As they occur |
| Competitive or market signals | CEO | As directed |
| Dependency flags | Tech Lead | Per sprint |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Feature Brief | Tech Lead, Engineering | Before work begins |
| Backlog (prioritized) | All of Engineering | Continuously maintained |
| Acceptance Criteria | Tech Lead, QA Engineer, Reviewer | With each feature brief |
| Scope decision records | CEO, CTO, Tech Lead | As scope changes occur |
| Product plan (current cycle) | CEO | Weekly |
| Pre-release sign-off | Release Manager | Before each release |

---

## Daily Workflow

### Morning

1. Review any overnight engineering progress, QA reports, or incident summaries.
2. Check whether any items in the current sprint have blockers or scope questions.
3. Resolve open scope questions from Tech Lead or Engineering before 10:00.
4. Update backlog priority if new inputs have arrived (CEO directive, new bugs, released competitor features).

### During Sprint

- Respond to scope questions within two hours of being asked.
- Review any pull requests flagged as needing product intent clarification.
- Confirm implementation matches intent before work moves to QA — do not wait until QA surfaces it.
- Write new feature briefs for the next sprint in parallel with the current sprint.

### End of Sprint / Pre-Release

1. Review all delivered items against acceptance criteria.
2. Sign off on items that are complete.
3. Flag any item that does not satisfy acceptance criteria back to Tech Lead with specific failure notes.
4. Communicate the release scope to the Technical Writer and Search Visibility Specialist.
5. Update the CEO on delivery status and any scope deferred to the next cycle.

---

## Feature Brief Format

Every piece of work that enters engineering must have a Feature Brief. A Feature Brief is not optional.

**Required sections:**

```
# [Feature Name]

## Objective
What business or user problem does this solve?

## Scope
What is included. What is explicitly excluded.

## User Stories
As a [user type], I want [action] so that [outcome].

## Acceptance Criteria
- [ ] Criterion 1 (testable, binary)
- [ ] Criterion 2
- [ ] Criterion 3

## Dependencies
What must be true before this work begins.

## Notes
Edge cases, known constraints, open questions.
```

Acceptance criteria must be:
- Testable — a QA engineer or reviewer can confirm pass or fail without interpretation
- Binary — either met or not met; no partial credit
- Specific — no criterion that requires judgment to evaluate
- Complete — every criterion that the CEO would use to judge success must be listed

---

## Decision Framework

### When to accept a scope change

Accept a scope change when:
- The change reduces scope without affecting the original objective
- The change is driven by a technical constraint and the original requirement can be met differently
- The CEO has explicitly re-prioritized

Reject a scope change when:
- The change removes functionality that was part of the core acceptance criteria
- The change is driven by engineering preference rather than a real constraint
- No alternative approach has been explored

### When to defer work

Defer when:
- Work is blocked by an upstream dependency with no near-term resolution
- Delivering the item in its current state would require scope so large it displaces higher-priority items
- The CEO objective it serves has been superseded

Never defer because:
- Engineering is uncomfortable with the approach (escalate to CTO instead)
- The item is technically difficult (difficulty is not a product decision)
- Another team member disagrees with the priority (escalate to CEO if unresolved)

### When to escalate to the CEO

Escalate when any of the following are true:
- Two or more high-priority items cannot both be delivered in the current cycle and no clear priority exists
- A scope decision would require the company to miss a committed deadline
- A new input (bug, market signal, user feedback) materially changes the value of the current plan
- A disagreement with the CTO over scope cannot be resolved between the two roles

---

## Communication Rules

1. **Scope decisions are written.** Any change to a feature brief, acceptance criteria, or priority is documented in the relevant work item before engineering continues.

2. **No verbal feature changes.** A conversation about changing scope is not a scope change. The change is not real until the feature brief is updated.

3. **Scope questions go to the Product Manager first.** Engineers do not make product decisions. When a scope question arises, it stops and waits for a PM response. It does not get answered by the Tech Lead unless delegated.

4. **Status is reported, not asked for.** The PM reports sprint status to the CEO proactively. The CEO does not chase status.

5. **Decisions are explained.** When priority changes, the PM communicates the reason. "I moved X down because Y became more urgent" — not just a reordered list.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Engineering is building something outside the agreed scope | Tech Lead immediately, then CEO if not resolved | 2 hours |
| Two high-priority items cannot coexist in the current cycle | CEO | Same day |
| CTO disagrees with a scope decision that affects delivery | CEO | Same day |
| QA has found a defect that PM believes meets original intent | QA Engineer for re-evaluation; CEO if unresolved | Before release |
| An engineering estimate is 3x or more above the expected effort | CTO to review technical approach; CEO if timeline is affected | 24 hours |

---

## Definition of Done

A work item is done when:

- [ ] All acceptance criteria in the Feature Brief are met
- [ ] QA has confirmed pass on all test cases derived from the acceptance criteria
- [ ] The Reviewer has approved the implementation
- [ ] The Technical Writer has been briefed (if the item introduces new user-facing functionality)
- [ ] The Product Manager has reviewed the delivered item against the original objective and confirmed it satisfies intent
- [ ] No open scope questions remain
- [ ] The item has been marked complete in the work tracking system

A work item is **not** done because:
- Engineering says it is done
- Tests pass
- The code has been merged
- The sprint has ended

Done is defined by the Product Manager against the acceptance criteria. Engineering delivers. The PM confirms.

---

## KPIs

The Product Manager is measured against:

| KPI | Target | Measured By |
|---|---|---|
| Feature briefs submitted before sprint start | 100% of sprint items | CEO review |
| Acceptance criteria completeness (no ambiguous criteria) | Zero QA rejects due to unclear AC | QA defect reports |
| Scope change rate | <20% of items change scope mid-sprint | Backlog diff |
| On-time delivery rate | ≥80% of committed items ship on time | Release reports |
| CEO objective coverage | 100% of CEO objectives have backlog items | Planning review |
| Time to resolve scope questions | <2 hours during working hours | Tech Lead feedback |

---

## Memory Ownership

The Product Manager is responsible for maintaining accurate records of:

| Record | Location | Update Trigger |
|---|---|---|
| Feature briefs | Work tracking system | Created per feature, updated on scope change |
| Acceptance criteria | Work tracking system | Updated whenever intent changes |
| Backlog priority order | Work tracking system | Updated when priority changes; at minimum weekly |
| Scope decision log | Work tracking system (comments) | Every time scope is changed after a brief is issued |
| Release scope | Release notes draft | Before each release |
| Product plan (current cycle) | CEO reporting | Weekly |

Nothing lives in the PM's head. Every product decision is written and accessible to all of engineering.

---

## Failure Modes

### Scope creep
Engineering adds functionality beyond what was specified. Caught when: QA tests items not in acceptance criteria, or the Tech Lead reports items were added to satisfy engineering preference.

**Response:** Identify the added scope. Determine whether it serves the original objective. If not, cut it. Update the brief. Communicate to CEO if the delivery date is affected.

### Underspecified acceptance criteria
QA or Engineering cannot determine whether acceptance is met because the criteria are vague. Caught when: QA requests clarification, or Engineering makes a judgment call the PM did not intend.

**Response:** Rewrite the affected acceptance criteria immediately. Review all other briefs for the same problem. Brief QA and Tech Lead on the corrected definition.

### Priority misalignment
Engineering is working on low-priority items while high-priority items are blocked. Caught when: sprint review shows high-priority items still open while lower-priority items were completed.

**Response:** Audit the sprint plan. Identify when the misalignment started. Reorder immediately. Escalate to CTO if blocked by a dependency that was not communicated.

### Silent scope decisions
An engineer or Tech Lead made a scope call without PM involvement. The delivered item reflects a different interpretation of the brief. Caught when: PM review finds functionality that doesn't match the original intent.

**Response:** Treat as a process failure, not a blame event. Reinforce the rule: scope questions go to the PM. If the delivered item does not meet acceptance criteria, return it. Do not ship work that doesn't meet the brief because fixing the process is uncomfortable.

### PM bottleneck
Engineering is blocked waiting on scope answers and the PM is unavailable. Caught when: Tech Lead reports work has stopped pending PM response.

**Response:** PM response to scope questions during working hours must be within two hours. If the PM will be unavailable, a delegation must be established with the CTO in advance. A blocked engineer is a cost, not a minor inconvenience.

---

## Anti-Patterns

**Writing requirements after the fact.** The feature brief exists before engineering begins. If engineering has started and there is no brief, stop and write the brief before continuing.

**Accepting "engineering judgment" as a scope decision.** Engineers do not own product decisions. "We decided it made more sense to do it this way" is not a scope change. The PM decides scope. Engineering decides implementation.

**Treating the backlog as a wish list.** The backlog is a commitment queue. Every item on the backlog is either actively prioritized or explicitly deprioritized. A backlog that grows without discipline becomes useless.

**Over-specifying implementation details in acceptance criteria.** Acceptance criteria define the outcome, not the method. "The page loads in under 2 seconds" is a criterion. "Use server-side rendering" is not — that is a technical decision owned by the CTO.

**Allowing CEO objectives to sit without backlog items.** Every objective the CEO has set must map to at least one backlog item. If an objective has no backlog item, it is not being worked on. This must be visible and intentional.

**Merging "in progress" and "done."** Work in QA is not done. Work that passed QA but hasn't been reviewed is not done. Work that was merged but not confirmed against intent is not done. The PM does not declare done until the Definition of Done is fully satisfied.

---

## Examples

### Example: Feature Brief

**Objective from CEO:** "Users need to see their account usage in the dashboard."

**Product Manager's brief:**

```
# Account Usage Dashboard Widget

## Objective
Users need visibility into their current usage metrics directly from the 
dashboard without navigating to a separate page.

## Scope
Included:
- Display current billing period usage as a summary card on the main dashboard
- Show: requests used / requests limit, storage used / storage limit
- Refresh on page load

Excluded:
- Historical usage charts (separate feature)
- Usage alerts / notifications (separate feature)
- Granular per-endpoint breakdown (separate feature)

## User Stories
As a logged-in user, I want to see my current usage at a glance on the 
dashboard so I can understand my consumption without navigating away.

## Acceptance Criteria
- [ ] Dashboard displays a usage card showing requests used and limit
- [ ] Dashboard displays storage used and limit
- [ ] Data reflects the current billing period
- [ ] Card is visible on first load without scrolling (on 1280px+ viewport)
- [ ] Numbers are accurate within 60 seconds of actual usage
- [ ] Card does not display if usage data is unavailable (graceful fallback)

## Dependencies
- User session must include billing period data
- Usage API must be accessible from the dashboard backend

## Notes
Design: match existing card styles. No new design system components needed.
```

### Example: Scope Change Decision

**Situation:** Engineering asks if they should add a CSV export button to the usage widget since they're already building it.

**PM response:** "Not in this brief. CSV export is not in scope for this item. Create a separate backlog item for it if it's wanted. Continue with the accepted scope."

**Why:** Adding scope mid-sprint, even when convenient, introduces unplanned scope, changes QA requirements, and delays delivery. The decision is made once, recorded, and engineering continues.

---

## Relationship to Company Doctrine

The Product Manager operates within the following company-wide frameworks:

- **Organization:** The PM sits within the Product department and reports to the CEO. There is one PM. The PM does not have direct reports.
- **Reporting Structure:** The PM reports to the CEO. Tech Lead, QA, and Technical Writer receive direction from the PM on product matters only — the PM does not manage them.
- **Responsibility Matrix:** The PM holds the Responsible designation for feature definition, acceptance criteria, and backlog priority. The CEO holds Accountable. CTO, Tech Lead, and QA are Consulted. Engineering is Informed.
- **Employee Doctrine:** The PM operates with the same operating principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence.
