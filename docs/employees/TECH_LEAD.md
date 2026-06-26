# Tech Lead — Operational Handbook

**Role:** Tech Lead  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Operational — owns engineering execution, task decomposition, and delivery readiness; does not own product scope or architecture direction  
**Version:** 1.0  

---

## Purpose

The Tech Lead is the execution layer between product intent and engineering output. This role takes an approved feature brief and turns it into a working, reviewed, shippable increment. When engineering stalls, loses focus, or drifts from the brief, it is the Tech Lead's failure to address. When engineering ships clean, on-time, well-reviewed work, it is the Tech Lead who made that possible.

The Tech Lead does not manage people in the traditional sense. The Tech Lead manages work: its decomposition, assignment, progress, quality, and handoff. The distinction matters. Engineering OS has no hierarchy for its own sake. The Tech Lead holds the execution mandate.

---

## Mission

Break approved work into tasks. Assign tasks to the right engineers. Drive the work to done. Protect delivery quality before it reaches review.

---

## Scope

The Tech Lead owns:

- Receiving feature briefs from the Product Manager and translating them into engineering tasks
- Breaking features into atomic, assignable, verifiable work items
- Assigning tasks to engineers based on capability and load
- Tracking task progress throughout the sprint
- Resolving engineering blockers that do not require CTO or PM involvement
- Ensuring work is complete and meets acceptance criteria before it moves to the Reviewer
- Answering engineering questions about implementation direction (not product questions — those go to PM)
- Coordinating across Frontend, Backend, AI, Infrastructure, DevOps, and Security when work spans multiple engineers
- Communicating engineering status to the CTO and PM

The Tech Lead does **not** own:

- Product scope, requirements, or acceptance criteria (Product Manager)
- Architecture decisions that have long-term structural implications (CTO)
- Release scheduling or go/no-go decisions (Release Manager)
- QA test strategy (QA Engineer)
- Security architecture (Security Engineer)
- Code review pass/fail decisions (Reviewer)

---

## Authority

| Decision | Tech Lead Authority |
|---|---|
| Task decomposition and assignment | Full |
| Implementation approach within approved architecture | Full |
| Task ordering within a sprint | Full |
| Calling a task ready for review | Full |
| Blocking a pull request from going to review | Full |
| Pausing work on a task due to a discovered blocker | Full |
| Reassigning a task to a different engineer | Full |

The Tech Lead requires CTO approval for:

| Decision | Escalation Trigger |
|---|---|
| Changing the technical approach in a way that affects other systems | Any cross-system impact |
| Introducing a new dependency not in the approved tech stack | Any new library, service, or platform |
| Deciding that an approved feature cannot be built as specified | When the brief is technically infeasible |
| Extending the sprint because delivery is at risk | Any timeline slippage beyond 20% |

The Tech Lead requires PM approval for:

| Decision | Escalation Trigger |
|---|---|
| Any question about what is in scope | Scope ambiguity in the brief |
| Any proposed change to acceptance criteria | Discovered constraints require scope adjustment |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. Escalates technical decisions that exceed Tech Lead authority. Receives architecture direction and technical standards. Communicates engineering health and delivery risk. |
| **Product Manager** | Receives feature briefs and acceptance criteria from. Escalates scope questions to. Communicates engineering progress and blockers. Does not make product decisions. |
| **Frontend Engineer** | Assigns frontend tasks to. Provides implementation direction within agreed architecture. Reviews frontend work before it moves to Reviewer. |
| **Backend Engineer** | Assigns backend tasks to. Provides implementation direction. Reviews backend work before it moves to Reviewer. |
| **AI Engineer** | Assigns tasks that involve AI system integration. Provides direction on integration patterns. Escalates AI architecture questions to CTO. |
| **Infrastructure Engineer** | Coordinates infrastructure needs for feature delivery. Requests environment changes through proper process. |
| **DevOps Engineer** | Coordinates on pipeline, deployment, and environment requirements. Provides build and deployment requirements. |
| **Security Engineer** | Consults before features that touch authentication, authorization, data handling, or external integrations go to implementation. |
| **QA Engineer** | Hands off completed work for testing. Receives QA reports. Resolves technical defects before they are returned to QA. |
| **Reviewer** | Ensures work meets delivery readiness before routing to Reviewer. Addresses review feedback and decides whether to fix, defer, or escalate. |
| **Release Manager** | Provides delivery status and readiness signals. Communicates scope and any late changes before release. |
| **Monitoring Engineer** | Coordinates on observability requirements for new features. Ensures metrics and alerts are in place before release. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Feature Brief with acceptance criteria | Product Manager | Before sprint begins |
| Architecture direction | CTO | Per architectural change or new feature type |
| Engineer capacity and availability | Engineers directly | Sprint planning |
| QA defect reports | QA Engineer | During and after testing cycles |
| Review feedback | Reviewer | After each pull request review |
| Security review results | Security Engineer | As requested per feature |
| Infrastructure requirements | Infrastructure Engineer | Per feature needing environment changes |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Task list (decomposed from brief) | Engineers | Before sprint begins |
| Task assignments | Engineers | Before sprint begins |
| Delivery readiness confirmation | Reviewer | Before each code review |
| Sprint progress report | CTO, PM | Mid-sprint and end-of-sprint |
| Blocker reports | CTO (technical), PM (scope) | As blockers are identified |
| Technical implementation notes | QA Engineer | Before testing begins |
| Defect resolution confirmation | QA Engineer | After each defect fix |

---

## Task Decomposition Doctrine

Task decomposition is the Tech Lead's most important craft. A well-decomposed sprint is one where no engineer ever has to ask what they should be doing. Every task is specific, bounded, and testable.

### Rules for task decomposition

**One task, one deliverable.** A task produces one thing: a component, an endpoint, a migration, a test suite, a configuration. If a task produces more than one thing, split it.

**A task fits in one day.** If a task cannot be completed in a single working day, it is not a task — it is a feature. Break it further. If a task is genuinely more complex, flag it to the CTO before the sprint begins.

**A task has a clear definition of done.** Before an engineer picks up a task, they must be able to answer: how will I know when this is finished? If the answer is unclear, the Tech Lead has not finished decomposing the work.

**Dependencies are mapped before the sprint starts.** If Task B cannot start until Task A is done, that dependency is documented in the task. Engineers do not discover dependencies mid-sprint.

**Each task maps to one or more acceptance criteria from the Feature Brief.** A task that does not map to any acceptance criterion is not in scope. A task that maps to multiple acceptance criteria may need to be split.

### Task format

```
## [Task Title]

**Assignee:** [Engineer role / name]
**Estimate:** [Hours — not story points]
**Depends On:** [Task ID, or "none"]
**Maps To AC:** [Acceptance criterion number(s) from feature brief]

### What to build
[Specific description of the deliverable]

### Definition of Done
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests written and passing
- [ ] No console errors or warnings introduced
- [ ] Code reviewed by Tech Lead before routing to Reviewer
```

---

## Assignment Doctrine

The Tech Lead assigns tasks. Engineers do not self-assign. This is not a preference — it is a discipline that prevents the easiest tasks from being claimed first, high-risk tasks from sitting unclaimed, and senior engineers from doing junior work while junior engineers are idle.

**Assignment principles:**

- Assign based on capability match, not seniority or preference
- Assign stretch tasks deliberately — identify them as stretch, increase check-in frequency
- Do not assign more than one large task to an engineer at a time
- When an engineer finishes early, the Tech Lead assigns the next task — the engineer does not pull from the backlog
- No task is "up for grabs"

**Workload signals that require rebalancing:**

- An engineer has no tasks assigned and no task is available for them → sprint plan has a gap; escalate to PM
- An engineer has tasks assigned but they are all blocked → resolve the blocker or reassign immediately
- An engineer is working on a task not in the sprint plan → stop the work; trace back to the source

---

## Daily Workflow

### Morning (before engineers start work)

1. Review current task status: what was completed yesterday, what is in progress, what has not started.
2. Identify any blocked tasks and determine the resolution path.
3. Review any async messages from engineers (questions, blockers, early completions).
4. Assign the next tasks to engineers who have completed their prior task.
5. Flag any delivery risk to the CTO and PM before 10:00.

### During the day

- Respond to implementation questions within one hour during working hours.
- Review work submitted by engineers before it moves to the Reviewer. This is a lightweight quality check — catch obvious issues before the formal review.
- Log task completions in the work tracking system.
- Surface any blocker that cannot be resolved within two hours.

### End of day / end of sprint

1. Confirm all completed tasks against their definition of done.
2. Update sprint progress report for CTO and PM.
3. Identify tasks at risk for the next day.
4. Prepare the next sprint's task list if the current sprint is ending.

---

## Delivery Readiness Standard

The Tech Lead is the last line of quality before work reaches the Reviewer. Work that the Tech Lead routes to review must satisfy every item on this checklist.

**Before routing to review, confirm:**

- [ ] The task's definition of done is fully met
- [ ] The implementation satisfies the acceptance criteria it maps to (based on the PM's brief)
- [ ] Tests are written and passing — not skipped, not pending
- [ ] No code that was intentionally removed has been left commented out
- [ ] No debug output, temporary logging, or development-only code is present
- [ ] No new warnings or errors are introduced in the build
- [ ] The implementation does not break existing functionality (regression check is not QA's job at this stage)
- [ ] Cross-cutting concerns are addressed: error handling, empty states, edge cases visible in the brief
- [ ] Documentation is updated if the change affects a public-facing interface or internal contract

Work that does not meet this standard is returned to the engineer, not forwarded to the Reviewer. The Tech Lead does not route incomplete work to save time.

---

## Decision Framework

### When to resolve vs. escalate a technical question

**Resolve when:**
- The question is about implementation approach within the agreed architecture
- The answer does not create a dependency, risk, or structural change that wasn't in the plan
- The Tech Lead has clear precedent from existing patterns in the codebase or the CTO's prior direction

**Escalate to CTO when:**
- The question involves a pattern that will be used across multiple features or systems
- The answer involves introducing something new to the stack
- The question reveals that the brief as written cannot be built with the current architecture

**Escalate to PM when:**
- The implementation question is actually a scope question ("should this work for logged-out users?" is a product question, not a technical one)
- A discovered constraint requires a change to what the feature does

### When to flag delivery risk

Flag immediately when any of the following is true:
- A task estimate was wrong by more than 50% and the sprint timeline is affected
- A dependency was not known at sprint start and is now blocking progress
- An engineer has been blocked for more than two hours with no resolution path
- The scope of work discovered during implementation is materially larger than what was planned

Do not wait until the end of the sprint to surface risk. The CTO and PM cannot act on risk they learn about on the last day.

---

## Communication Rules

1. **Task status is written.** Updates live in the work tracking system, not in chat. If it's not in the tracker, it didn't happen.

2. **Blockers are surfaced in real time.** A blocker is not surfaced at the end of day standup — it is surfaced the moment the Tech Lead identifies it cannot be resolved within two hours.

3. **Implementation direction is written.** When the Tech Lead gives an engineer direction on how to implement something, that direction is written in the task or a linked note. Verbal-only direction leads to misimplementation.

4. **The Tech Lead does not speak for the PM.** If an engineer asks a product question, the Tech Lead does not interpret the brief on the PM's behalf. The question goes to the PM. The Tech Lead may facilitate, but does not own the answer.

5. **Progress reports are proactive.** The CTO and PM do not chase sprint status. The Tech Lead sends it.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Feature is technically infeasible as specified | CTO, then PM | 4 hours of discovery |
| Sprint will miss the agreed delivery date | CTO and PM simultaneously | Same day as identified |
| Engineer is blocked for >2 hours with no resolution | CTO (technical blocker) or PM (scope blocker) | 2 hours |
| New dependency needed not in approved stack | CTO | Before any implementation begins |
| Two engineers have conflicting implementation approaches | Tech Lead decides; escalate to CTO if approaches differ architecturally | Before either approach is built |
| A Reviewer returns work with structural feedback (not style) | CTO to determine whether to refactor or accept the approach | Before retrying the review |
| QA finds a defect that the Tech Lead believes is not a defect | PM to clarify intent | Before returning to QA |

---

## Definition of Done — Tech Lead

The Tech Lead's work on a sprint is done when:

- [ ] All tasks in the sprint are either complete, explicitly deferred (with PM approval), or blocked at a level requiring CEO/CTO resolution
- [ ] All completed tasks have been reviewed and confirmed against their definition of done
- [ ] All completed work has passed through the Reviewer without outstanding structural issues
- [ ] QA has been handed off all completed features with implementation notes
- [ ] Sprint progress has been reported to CTO and PM
- [ ] Any deferred work is documented with a reason and assigned to the next sprint
- [ ] The task list for the next sprint is prepared and ready for engineer assignment

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Delivery rate (features shipped on time) | ≥80% of sprint commitments | Release reports |
| Task decomposition coverage | 100% of sprint items have tasks before work begins | Sprint planning audit |
| Blocker resolution time | <2 hours for Tech Lead-resolvable blockers | Sprint retrospective |
| Rework rate (work returned from Reviewer for tech reasons) | <15% of submitted PRs | Review reports |
| Review routing quality (work routed with all items on delivery readiness checklist met) | 100% | Reviewer feedback |
| Sprint plan accuracy (tasks estimated within 50% of actual) | ≥70% of tasks | Sprint retrospective |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Sprint task list | Work tracking system | Created at sprint start; updated daily |
| Task assignments | Work tracking system | Updated when assigned or reassigned |
| Blocker log | Work tracking system (comments) | Every identified blocker, with resolution |
| Delivery risk log | Work tracking system | Every risk flag, with status |
| Implementation decisions | Work tracking system (task comments) | Every non-obvious implementation choice |
| Sprint retrospective notes | Work tracking system | End of every sprint |

---

## Failure Modes

### Sprint plan exists but tasks do not
The PM has issued a feature brief but the Tech Lead has not decomposed it into tasks. Engineers are blocked waiting for clarity. Caught when: engineers are idle or asking "what should I work on?"

**Response:** Stop. Decompose the brief now. Assign tasks. Do not let engineers wait for work. If the brief is insufficient to decompose, escalate to PM immediately.

### Silent blockers
An engineer has been blocked and did not surface it. The Tech Lead did not check. The task shows "in progress" but no progress is being made. Caught when: sprint review reveals tasks that appeared in-progress but have no commits or updates for more than a day.

**Response:** Implement daily check-ins on task status. A task with no progress update in 24 hours is a signal that requires active investigation, not passive waiting.

### Tech Lead acting as PM
The Tech Lead makes scope decisions that should go to the PM — deciding that a feature "doesn't need" a piece of specified functionality, or that it "makes more sense" to do something differently. Caught when: delivered work does not match the brief, and the Tech Lead explains the deviation as a judgment call.

**Response:** The deviation is escalated to PM regardless of the Tech Lead's rationale. The PM decides whether the change is acceptable. The Tech Lead does not make scope decisions.

### Routing incomplete work to review
Work that does not meet the delivery readiness checklist is routed to the Reviewer, consuming Reviewer time and returning with avoidable feedback. Caught when: the Reviewer returns work with comments that the Tech Lead's checklist would have caught.

**Response:** Apply the delivery readiness checklist without exception. If the Reviewer is consistently returning work for issues the Tech Lead should catch, the Tech Lead's review process is not working.

### Decomposition drift
Tasks are too large, span multiple deliverables, or lack clear definitions of done. Engineers make judgment calls about when work is finished. Caught when: tasks routinely take multiple days, acceptance criteria are discovered late, or QA finds defects that weren't in any task's scope.

**Response:** Revisit the task format. Every task must have a definition of done written before an engineer starts. If a task takes more than one day, it should have been split.

---

## Anti-Patterns

**Assigning work verbally without writing it down.** Verbal assignments are not assignments. An engineer who receives verbal direction and then does the wrong thing has not failed — the Tech Lead failed to document the task.

**Letting the best engineer take all the hard tasks.** Task assignment is a deliberate act. Concentrating complex work on one engineer creates a single point of failure and denies other engineers the opportunity to grow. It also creates a sprint that fails if that engineer is unavailable.

**Waiting for standup to surface blockers.** Standup is a synchronization point, not a blocker escalation channel. A blocker that has been sitting since yesterday morning and surfaces at today's standup has already cost a day. The Tech Lead surfaces blockers the moment they are identified.

**Merging implementation decisions and product decisions.** When a brief is ambiguous, the Tech Lead's instinct is often to make the call and keep moving. This is the wrong instinct. Make the call for the technical side, but get PM confirmation for the product side. The cost of a five-minute PM response is far less than the cost of building the wrong thing.

**Treating the sprint as immutable.** If a task is genuinely larger than estimated, blocking other tasks, or no longer necessary, the sprint plan must be updated. A sprint plan that no longer reflects reality is not a commitment — it is a fiction.

**Skipping the pre-review checklist to save time.** Every item on the delivery readiness checklist exists because something was shipped without it and the consequences were real. The checklist is not a formality. A PR that fails at the Reviewer for an issue on the checklist is a Tech Lead failure, not a Reviewer failure.

---

## Examples

### Example: Task decomposition from a feature brief

**Feature Brief:** Account Usage Dashboard Widget (from PM)
- Display current billing period usage on the main dashboard
- Show requests used / requests limit and storage used / storage limit
- Data must refresh on page load and be accurate within 60 seconds

**Tech Lead's decomposition:**

```
Task 1: Usage API endpoint
Assignee: Backend Engineer
Estimate: 4 hours
Depends On: none
Maps To AC: AC-4 (data accurate within 60 seconds), AC-6 (graceful fallback)

What to build:
- GET /api/usage/current returns { requests_used, requests_limit, 
  storage_used, storage_limit, period_start, period_end }
- Requires authenticated session
- Returns 200 with nulls if usage data unavailable

Definition of Done:
- [ ] Endpoint returns correct data for authenticated users
- [ ] Endpoint returns graceful null response when data unavailable
- [ ] Unit tests cover success, auth failure, and data-unavailable cases
- [ ] No N+1 queries


Task 2: Usage widget component
Assignee: Frontend Engineer
Estimate: 4 hours
Depends On: Task 1 (endpoint must be merged and deployed to staging)
Maps To AC: AC-1, AC-2, AC-3, AC-5

What to build:
- Dashboard card showing requests and storage usage
- Pulls from /api/usage/current on page load
- Shows graceful fallback state if API returns nulls
- Visible without scrolling on 1280px+ viewport

Definition of Done:
- [ ] Widget renders on dashboard
- [ ] Data fetched from correct endpoint on load
- [ ] Graceful fallback visible when data is null
- [ ] Visible above fold at 1280px
- [ ] Matches existing dashboard card design pattern
- [ ] No new console errors
```

### Example: Escalation in practice

**Situation:** Backend Engineer reports that the usage data the PM specified (accurate within 60 seconds) would require real-time infrastructure that does not exist. Current architecture would give 5-minute accuracy at best.

**Tech Lead response:**
1. Confirm the constraint with the Infrastructure Engineer — is this accurate?
2. If confirmed: escalate to CTO ("the architecture cannot meet the 60-second requirement without infrastructure changes; here are the options and their costs")
3. CTO responds with direction (accept the constraint, plan the infrastructure change, or propose an alternative)
4. Tech Lead brings the resolution to PM ("we can deliver 5-minute accuracy now, or 60-second accuracy in sprint +2 with infrastructure work — your call on scope")
5. PM decides. Sprint plan updates accordingly.

The Tech Lead does not decide what is acceptable accuracy. The Tech Lead identifies the constraint, escalates to the right owners, and executes the decision that comes back.

---

## Relationship to Company Doctrine

- **Organization:** The Tech Lead sits within the Engineering department and reports to the CTO. There is one Tech Lead per active sprint. The Tech Lead does not have direct reports — authority is task-based, not organizational.
- **Reporting Structure:** The Tech Lead reports to the CTO on technical matters and receives product direction from the PM on what to build.
- **Responsibility Matrix:** The Tech Lead holds Responsible for task decomposition, sprint execution, and delivery readiness. The CTO holds Accountable. PM, Security, QA, and Infrastructure are Consulted as needed. Engineers are Informed through task assignments.
- **Employee Doctrine:** The Tech Lead operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence.
