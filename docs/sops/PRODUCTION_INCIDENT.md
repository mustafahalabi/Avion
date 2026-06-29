# SOP: Production Incident

**SOP ID:** SOP-007  
**Category:** Standard Operating Procedure  
**Owner:** Monitoring Engineer  
**Version:** 1.0  

---

## Purpose

A production incident is any unplanned event that degrades the product for users — an outage, a severe performance regression, a data integrity problem, a security breach, or a critical defect surfacing in production. This procedure defines how Engineering OS responds: how an incident is detected, declared, triaged, mitigated, recovered, communicated, reviewed, and learned from.

The purpose of incident response is to **reduce user harm as fast as possible, then understand why it happened and prevent recurrence**. These are two distinct goals with two distinct phases. During the incident, the priority is mitigation — stopping the harm. After the incident, the priority is cause and prevention. Confusing the two — debugging root cause while users are down, or declaring the incident closed before prevention work exists — is the most common way incident response fails.

Every production incident follows this procedure. The procedure scales with severity: a P0 outage mobilizes the full response structure; a P3 issue follows the same steps at a lighter weight. What does not change is that every incident has a single accountable owner, a written record, and a follow-up that produces prevention work when needed.

This SOP is the destination of the escalation paths defined in [SOP-005: Release](./RELEASE.md) and [SOP-006: Rollback](./ROLLBACK.md). When a post-deployment anomaly is classified P0/P1, or when a rollback's post-rollback validation fails, this procedure takes over.

---

## Trigger

This procedure is triggered when any of the following occurs:

- The Monitoring Engineer detects a production anomaly that meets the P0, P1, or P2 severity criteria below
- An automated alert fires for an availability, error-rate, latency, or data-integrity threshold breach
- A user, the CEO, or any employee reports a production problem affecting users
- A post-deployment anomaly is classified P0/P1 during the monitoring window in [SOP-005: Release](./RELEASE.md)
- Post-rollback validation fails in [SOP-006: Rollback](./ROLLBACK.md) — the system is in an unexpected state and is treated as a P0 incident regardless of the original trigger
- A security vulnerability is found to be actively exploitable or exploited in production
- A scheduled or third-party dependency failure degrades the product for users

When in doubt about whether an event is an incident, **declare it.** A declared incident that turns out to be minor costs a record and a short review. An undeclared incident that turns out to be severe costs uncoordinated response and extended user harm. The asymmetry favors declaring.

---

## Owner

**Monitoring Engineer** — owns this procedure as a standing document and owns detection. The Monitoring Engineer is the default first responder: they detect or receive the report, perform initial triage, assign a severity, and declare the incident.

**Incident Commander (IC)** — owns the active incident from declaration through recovery. The Incident Commander is a *role*, designated per incident, not a fixed employee. For P2/P3 incidents, the Monitoring Engineer typically serves as IC. For P0/P1 incidents, an IC is designated at declaration — usually the Tech Lead or a senior engineer with context on the affected system; the CTO may serve as or appoint the IC for the most severe incidents. There is exactly one Incident Commander at any time, and command can be explicitly handed off but never left vacant.

The Incident Commander is the single accountable owner of the response. They do not have to be the person who fixes the problem — they coordinate the people who do, make the mitigation decisions, own communication cadence, and decide when the incident is mitigated, recovered, and resolved.

---

## Participants

| Role | Responsibility in this SOP |
|---|---|
| **Monitoring Engineer** | Detection; initial severity classification; incident declaration; production health observation throughout; recovery signal confirmation; post-incident metric analysis |
| **Incident Commander** | End-to-end response ownership; mitigation decisions; response coordination; communication cadence; declaring mitigated/recovered/resolved |
| **DevOps Engineer** | Mitigation execution (rollback, traffic shifting, scaling, restarts); environment restoration; deployment of hotfixes |
| **Infrastructure Engineer** | Infrastructure-level diagnosis and mitigation (capacity, networking, dependencies, data stores); production environment integrity |
| **Backend / Frontend / AI Engineers** | Technical diagnosis; forward-fix implementation; system expertise for the affected component |
| **Tech Lead** | Technical decision authority; often serves as Incident Commander for P0/P1; root cause analysis ownership; follow-up work creation |
| **Security Engineer** | Leads response for security incidents; assesses breach scope; advises on containment, disclosure, and evidence preservation |
| **QA Engineer** | Recovery validation; confirms that affected flows behave correctly after mitigation |
| **Release Manager** | Coordinates any hotfix or re-release required to resolve the incident; owns the release-side record |
| **Communications Lead** | Owns stakeholder and CEO communication during the incident (designated per incident; often the Release Manager or Incident Commander for smaller incidents) |
| **CTO** | Notified for all P0/P1 incidents; decision authority that exceeds the Incident Commander; appoints IC for the most severe incidents; receives the incident review |
| **CEO** | Notified for P0 incidents and any incident with significant or external user impact; informed of resolution and of any incident requiring customer disclosure |

---

## Severity Levels

Severity is assigned at triage and drives the entire response: who is engaged, how fast, how often communication goes out, and whether the CTO and CEO are pulled in. Severity is reassessed continuously — an incident can be upgraded or downgraded as understanding improves. The severity model is aligned with the classification used by the Monitoring Engineer (see [Monitoring Engineer handbook](../employees/MONITORING_ENGINEER.md)).

| Severity | Definition | Examples | Response posture |
|---|---|---|---|
| **P0 — Critical** | Complete outage, critical data-integrity loss, or active security breach. The core product is unusable for all or most users, or user data is at risk. | Service is down; checkout fails for everyone; data corruption is spreading; credentials leaked and being exploited. | Immediate, all-hands. IC designated at declaration. CTO and CEO notified. Mitigation begins immediately, in parallel with diagnosis. |
| **P1 — High** | Severe degradation of a core flow affecting a significant subset of users, with no acceptable workaround. | A primary feature is broken for a region or user segment; severe latency on core flows; partial data write failures. | Urgent. IC designated. CTO notified. Mitigation prioritized over diagnosis. |
| **P2 — Medium** | Partial or non-core degradation. A workaround exists, or the impact is limited to a small user set or a non-critical feature. | A secondary feature is failing; degraded performance on a non-core path; elevated but non-blocking error rate. | Prompt, business-hours-paced. Monitoring Engineer typically serves as IC. CTO informed, not paged. |
| **P3 — Low** | Minor issue with minimal user impact. Cosmetic, edge-case, or low-frequency, with no meaningful degradation of function. | A rare non-blocking error; a minor visual defect in production; a slow path used by very few users. | Tracked and scheduled. Handled through [SOP-002: Bug Fix](./BUG_FIX.md) unless it escalates. |

**Severity is assigned conservatively.** When the available evidence places an incident between two levels, assign the higher level and downgrade later if the impact proves smaller. Under-classification delays the right response; over-classification costs a few minutes of attention.

---

## Incident Roles and Command

Incident response works because authority is unambiguous. The following roles are assigned at declaration and may be combined for smaller incidents (the Monitoring Engineer may hold all of them for a P3).

| Role | Holds | Does not do |
|---|---|---|
| **Incident Commander** | All response decisions; mitigation authority; communication cadence; declares state transitions | Does not need to personally diagnose or fix — coordinates those who do |
| **Technical Resolver(s)** | Diagnosis and mitigation/fix execution for the affected component (DevOps, Infrastructure, Engineering, Security) | Does not decide overall response strategy or external communication alone |
| **Communications Lead** | Stakeholder updates; CEO/CTO notifications; user-facing status if applicable | Does not make technical mitigation decisions |
| **Scribe** | Maintains the incident timeline in real time — what was observed, decided, and done, with timestamps | Does not run the response |

**Command handoff:** When the Incident Commander needs to step away or a more appropriate IC is identified (for example, the CTO takes command of a P0), command is handed off explicitly and announced: "Handing IC to <name>." Until that announcement is acknowledged, the current IC retains command. Command is never silently dropped.

---

## Procedure

### Phase 1: Detection and Declaration

**Owner:** Monitoring Engineer  
**Input:** Anomaly signal, alert, or report  
**Output:** Declared incident with an initial severity and an assigned Incident Commander  

**Steps:**

1. **Monitoring Engineer** receives the trigger — an automated alert, an observed anomaly, or a report from a user or employee.

2. **Monitoring Engineer** performs a rapid confirmation that the signal is real and is affecting production. This is a sanity check, not a full diagnosis: is the error rate genuinely elevated, is the flow genuinely failing, is the report reproducible? The goal is to avoid both false alarms and the dismissal of a real problem.

3. **Monitoring Engineer** assigns an initial severity using the Severity Levels table. When uncertain between two levels, the higher level is chosen.

4. **Monitoring Engineer** declares the incident. Declaration creates the incident record and opens the incident timeline. For P0/P1, declaration also designates the Incident Commander (the Monitoring Engineer designates or, for the most severe incidents, the CTO appoints).

5. **Incident Commander** confirms they hold command and opens the response: engages the required Technical Resolvers, designates a Communications Lead and a Scribe (or holds those roles for a small incident), and starts the response timeline.

6. For P0/P1, the **Communications Lead** sends the initial notification (see Communication Protocol) within the first communication window — before diagnosis is complete. "We are aware and responding" is the correct first message.

**Gate 1:** Incident is declared with a severity and an Incident Commander. The incident record and timeline are open. Required responders are engaged.

---

### Phase 2: Triage

**Owner:** Incident Commander  
**Input:** Declared incident; initial observations  
**Output:** Confirmed severity, impact scope, and a working hypothesis of the cause  

**Steps:**

1. **Incident Commander** establishes the impact scope with the Monitoring Engineer:
   - What is broken, and what still works?
   - How many users are affected, and which segments?
   - Is the impact growing, stable, or improving?
   - Is data integrity or security at risk?

2. **Technical Resolvers** establish a working hypothesis of the cause. Triage diagnosis is bounded — it answers "what do we change to stop the harm?" not "what is the complete root cause?" Full root cause analysis happens after recovery, in Phase 5.

3. **Incident Commander** confirms or revises the severity based on the established scope. An incident triaged as P1 that proves to be a full outage is upgraded to P0 immediately, with the corresponding notifications.

4. **Incident Commander** identifies the likely mitigation path and orders it against the Mitigation Decision Framework below. For a deployment-caused incident, the framework will usually point to rollback; for a capacity or dependency issue, to a forward operational action.

5. **Incident Commander** confirms the correct specialists are engaged. A security-triggered incident pulls in the **Security Engineer** as lead resolver; an infrastructure-triggered incident pulls in the **Infrastructure Engineer**.

**Gate 2:** Severity confirmed. Impact scope is understood. A mitigation path is selected.

---

### Phase 3: Mitigation

**Owner:** Incident Commander (decision); Technical Resolvers (execution)  
**Input:** Confirmed severity; selected mitigation path  
**Output:** User harm stopped or reduced; production stabilized  

Mitigation removes the harm. It is not the permanent fix. A feature flag turned off, traffic shifted away from a failing region, a rollback to the last known-good version, or a service restart are all valid mitigations even though none of them is the root-cause fix. The fix comes later, as a clean change. The job of this phase is to get users out of harm.

**Mitigation Decision Framework:**

| Situation | Preferred mitigation | Cross-reference |
|---|---|---|
| Incident traced to a recent deployment | Roll back to the last known-good version | [SOP-006: Rollback](./ROLLBACK.md) |
| Incident isolated to a feature behind a flag | Disable the feature flag | — |
| Capacity or scaling limit | Scale the affected resource; shed non-critical load | Infrastructure Engineer handbook |
| Failing dependency or region | Shift traffic away from the failing path | Infrastructure / DevOps |
| Active security exploit | Contain: revoke credentials, block the vector, isolate affected systems | Security Engineer leads; see Escalation Rules |
| Data integrity issue in progress | Stop writes to the affected path immediately, then assess | Escalate to CTO before any data repair |

**Steps:**

1. **Incident Commander** selects the mitigation with the fastest safe path to reducing harm. Speed and reversibility are weighted over elegance. When two mitigations are viable, the more reversible one is chosen first.

2. **Technical Resolvers** execute the mitigation. Where the mitigation is a rollback, the response follows [SOP-006: Rollback](./ROLLBACK.md) for execution and target confirmation — this SOP does not duplicate that procedure; the Incident Commander owns the decision, the DevOps Engineer owns execution.

3. **Monitoring Engineer** observes the effect of the mitigation in real time: is the error rate dropping, is the flow recovering, is the affected metric returning toward baseline?

4. **Incident Commander** evaluates the result:
   - If harm is stopped or materially reduced, the incident is **mitigated** — announce it and move to recovery validation.
   - If the mitigation did not work or made things worse, revert it if reversible, return to triage, and select the next path. Escalate to CTO if the first mitigation fails on a P0/P1.

5. **Data-integrity and security mitigations** are escalated to the CTO (and, for security, the Security Engineer) **before** any irreversible action — data repair or destruction, credential mass-revocation, or system isolation that affects other users.

**Gate 3:** The incident is declared **mitigated** — user harm is stopped or materially reduced and the production system is stable.

---

### Phase 4: Recovery Validation

**Owner:** QA Engineer (validation); Monitoring Engineer (signal confirmation)  
**Input:** Mitigated incident  
**Output:** Confirmation that affected flows are restored and stable  

**Steps:**

1. **QA Engineer** validates the affected user flows. The scope is the flows that were impaired, the core flows that must always work, and any flow that the mitigation itself could have affected. Validation confirms correct behavior — not merely the absence of the original alert.

2. **Monitoring Engineer** confirms that production health signals have returned to and are holding at baseline for a defined observation window (severity-dependent: longer for P0/P1, shorter for P2/P3). Recovery is not declared on the first good reading — it requires a stable window.

3. **Incident Commander** evaluates recovery validation:
   - **Pass:** affected flows are confirmed restored and signals are stable. The incident is declared **recovered**.
   - **Fail:** the mitigation resolved the original symptom but introduced or left a different problem. Return to triage; the incident remains open. A failed recovery on a previously P2 incident is reassessed and may be upgraded.

4. **Incident Commander** declares the incident **recovered** once validation passes and the observation window is clean. Recovery is distinct from resolution: the incident is recovered when users are no longer harmed; it is resolved when the cause is understood and prevention work exists (Phases 5–6).

**Gate 4:** Recovery validation passed. Affected flows confirmed restored. Health signals stable over the observation window. Incident declared recovered.

---

### Phase 5: Cause Analysis and Follow-Up Work

**Owner:** Tech Lead  
**Input:** Recovered incident; incident timeline  
**Output:** Root cause identified; prevention requirements defined; follow-up work items created  

This phase is where Engineering OS satisfies its non-negotiable rule that **every incident produces a cause and a prevention requirement.** Mitigation removed the harm; this phase ensures the harm does not return.

**Steps:**

1. **Tech Lead** leads the root cause analysis. It answers:
   - What was the immediate technical cause of the incident?
   - What was the contributing chain — where did code, review, QA, deployment, monitoring, or environment allow this to reach production or go undetected?
   - Why was it not caught earlier? Where could detection have been faster?
   - Was this introduced recently, or was it a latent condition that some change exposed?

2. **Tech Lead** distinguishes the **root cause** from the **trigger**. "A deploy went out" is a trigger; "an unguarded null path in the payment handler that no test exercised" is a root cause. The analysis is not complete until it reaches a cause that, if prevented, would have stopped the incident.

3. **Tech Lead** defines the **prevention requirements** — the specific changes that would prevent recurrence. Each prevention requirement falls into one or more categories:
   - **Code fix** — the defect itself (routed through [SOP-002: Bug Fix](./BUG_FIX.md))
   - **Test coverage** — the missing test that would have caught it
   - **Detection** — the missing alert or signal that would have surfaced it sooner (Monitoring Engineer)
   - **Process** — the gap in an SOP, review standard, or release gate that allowed it through
   - **Architecture/Infrastructure** — the structural weakness that made the failure possible or its blast radius large

4. **Tech Lead** creates **follow-up work items** for every prevention requirement, each with an owner and a priority. The permanent fix for the defect is created and prioritized according to the incident's severity. Follow-up items born from a P0/P1 incident are prioritized into the next sprint, not left to backlog drift.

5. **Release Manager** coordinates any **hotfix or re-release** needed to ship the permanent fix, following [SOP-005: Release](./RELEASE.md) (hotfix path) and confirming the fix passes review and QA before it ships. The mitigation is not the fix; the fix is delivered as a clean, validated release.

6. **Tech Lead** delivers a written root cause summary within **48 hours** of recovery for P0/P1 incidents (longer windows for P2/P3 are acceptable but the summary is always written).

**Gate 5:** Root cause identified and distinguished from the trigger. Prevention requirements defined. Follow-up work items created with owners. Permanent fix scheduled.

---

### Phase 6: Incident Review

**Owner:** Incident Commander  
**Input:** Root cause analysis; incident timeline; follow-up work items  
**Output:** Blameless incident review; process improvements routed to owners  

**Steps:**

1. **Incident Commander** convenes a blameless incident review within **5 business days** of recovery for P0/P1 incidents. Participants include the Monitoring Engineer, Tech Lead, the Technical Resolvers involved, the Communications Lead, and the CTO. P2 incidents are reviewed in a lighter-weight written form; P3 incidents are summarized in the record without a meeting.

2. The review examines the full lifecycle:
   - **Detection:** How was the incident detected, and how fast? What would have detected it sooner?
   - **Response:** How quickly was it declared, triaged, and mitigated? Was command clear? Were the right people engaged at the right time?
   - **Mitigation:** Was the right mitigation chosen? Did it work the first time? What slowed it down?
   - **Communication:** Were stakeholders and the CEO informed at the right cadence with accurate information?
   - **Prevention:** Are the follow-up work items sufficient to prevent recurrence? Is anything missing?

3. The review is **blameless.** It examines systems and decisions, not individuals. The question is always "what about our process, tooling, or systems allowed this?" — never "who is at fault?" A review that produces blame produces silence in the next incident.

4. **Incident Commander** writes the incident review document — a single record that ties together the timeline, severity, impact, mitigation, root cause, follow-up work, and process findings — and circulates it to participants and the CTO.

5. Any process finding that affects a standing SOP is routed to that document's owner for update. Findings that recur across multiple incidents are escalated to the CTO for a systemic response.

6. **Incident Commander** declares the incident **resolved** once the review is complete, follow-up work exists with owners, and process findings are routed. Resolution closes the incident record.

**Gate 6:** Blameless incident review conducted. Incident review document written and circulated. Process findings routed to owners. Incident declared resolved.

---

## Communication Protocol

Communication runs in parallel with the technical response from the moment of declaration. The Incident Commander owns the cadence; the Communications Lead owns the messages. The guiding rule is **communicate early, communicate honestly, and communicate on a predictable cadence even when there is no new information.** Silence during an incident is read as loss of control.

| Audience | What they receive | Cadence by severity |
|---|---|---|
| **CTO** | Declaration, severity, impact, mitigation status, resolution | P0/P1: at declaration, then every 30 minutes until recovered. P2: at declaration and at resolution. |
| **CEO** | Plain-language impact summary, current status, expected resolution, any external/customer impact | P0: at declaration and at every major state change (mitigated, recovered, resolved). P1 with significant impact: at declaration and resolution. |
| **Internal responders** | Working channel for the incident; current IC; current hypothesis and mitigation | Continuous during the active incident |
| **Affected stakeholders / on-call** | What is impacted, what to do, where to follow updates | At declaration for P0/P1 |
| **Users (if applicable)** | Honest status of impact and recovery, without internal technical detail | Per CTO/CEO direction for user-visible P0/P1 incidents; security incidents follow the Security Engineer's disclosure guidance |

**The first message ships before diagnosis is complete.** "We are aware of an issue affecting <X> and are actively responding" is the correct first communication for a P0/P1 — it goes out within the first communication window, not after the cause is known. Subsequent updates carry the current state honestly: what is known, what is being done, and when the next update will come.

For security incidents, the **Security Engineer** advises on what may be communicated and when. Disclosure, user notification, and any regulatory notification follow the Security Engineer's guidance and CTO approval before they go out.

---

## Incident Time Standards

Engineering OS targets the following time standards. They are targets, not guarantees; a breach is noted in the incident review and its cause identified.

| Stage | Target | Rationale |
|---|---|---|
| Trigger to declaration | < 5 minutes (P0/P1) | An incident cannot be coordinated until it is declared |
| Declaration to first communication | < 10 minutes (P0/P1) | Stakeholders should learn of the incident from us, fast |
| Declaration to mitigation start | < 15 minutes (P0) | Mitigation is the priority; diagnosis runs in parallel |
| Mitigation to recovery validation | Severity-dependent observation window | Recovery requires a stable window, not a single good reading |
| Root cause summary delivery | < 48 hours (P0/P1) | The analysis is most accurate while the event is fresh |
| Incident review | < 5 business days (P0/P1) | Findings are most actionable while the event is recent |

---

## Escalation Rules

| Situation | Escalate To | Trigger |
|---|---|---|
| P0 incident declared | CTO and CEO | At declaration |
| P1 incident declared | CTO | At declaration; CEO if significant user impact |
| First mitigation fails on a P0/P1 | CTO | Immediately on failed mitigation |
| Data-integrity issue requiring irreversible action | CTO | Before any data repair or destruction |
| Security breach (active or suspected) | Security Engineer, CTO | At declaration; CEO if user data or external disclosure is involved |
| Recovery validation fails | CTO, Tech Lead | Immediately — system is in an unexpected state |
| Incident exceeds a time standard with no clear path forward | CTO | When the standard is breached |
| Root cause cannot be identified within 48 hours | CTO | At the 48-hour mark — further investigation authorized |
| Incident review finds a systemic, recurring failure | CTO | At review delivery |
| Customer/regulatory disclosure may be required | Security Engineer, CTO, CEO | As soon as the possibility is identified |

---

## Artifacts

| Artifact | Owner | Created In |
|---|---|---|
| Incident record | Monitoring Engineer | Phase 1 |
| Incident timeline (live) | Scribe | Phases 1–4 |
| Triage assessment (scope, severity, hypothesis) | Incident Commander | Phase 2 |
| Mitigation log | Technical Resolvers | Phase 3 |
| Recovery validation result | QA Engineer | Phase 4 |
| Communication log | Communications Lead | Phases 1–6 |
| Root cause summary | Tech Lead | Phase 5 |
| Follow-up work items | Tech Lead | Phase 5 |
| Incident review document | Incident Commander | Phase 6 |

---

## Definition of Done

A production incident is done (resolved) when all of the following are true:

- [ ] The incident was declared with a severity and an Incident Commander
- [ ] User harm was mitigated and the mitigation was confirmed effective
- [ ] Recovery validation passed and health signals were stable over the observation window
- [ ] All required stakeholders, including the CTO (and CEO where applicable), were communicated with on cadence
- [ ] A root cause was identified and distinguished from the trigger
- [ ] Prevention requirements were defined
- [ ] Follow-up work items were created with owners, including the permanent fix
- [ ] The permanent fix is scheduled or shipped through the appropriate release path
- [ ] A blameless incident review was conducted (meeting for P0/P1; written for P2; summary for P3)
- [ ] The incident review document was written and circulated to participants and the CTO
- [ ] Process findings were routed to the relevant SOP or system owners
- [ ] The incident record is complete and closed

---

## Memory Updates

After each incident:

| Record | Content | Owner |
|---|---|---|
| Incident record | Full lifecycle: timeline, severity, impact, mitigation, recovery, communication, resolution | Incident Commander |
| Root cause analysis | Technical cause, contributing chain, prevention requirements | Tech Lead |
| Incident review document | Detection, response, mitigation, communication, and prevention findings | Incident Commander |
| Follow-up work items | Fix, tests, detection, process, and architecture changes, each with an owner | Tech Lead |
| Monitoring signal updates | New or adjusted alerts and signals introduced as a result of the incident | Monitoring Engineer |
| Incident pattern log | Running record of incident causes across incidents — used to surface systemic patterns | Monitoring Engineer |
| SOP / standard updates | Any change to a standing SOP, review standard, or release gate identified in the review | Document owner |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Time to declare (P0/P1) | < 5 minutes from trigger | Incident records |
| Time to first communication (P0/P1) | < 10 minutes from declaration | Communication logs |
| Time to mitigation (P0) | Tracked; improving trend | Incident records |
| Incidents with a written root cause | 100% — every incident has a root cause summary | Incident records |
| Incidents producing follow-up prevention work where required | 100% | Incident records |
| Incident review conducted within 5 business days (P0/P1) | 100% | Review records |
| Repeat incidents from the same root cause | Zero — a recurrence indicates prevention work was insufficient or unshipped | Incident records |
| Follow-up work item completion rate | Tracked; P0/P1 follow-ups completed within the committed sprint | Linear work items |

---

## Failure Modes

### Debugging root cause while users are down
The team becomes absorbed in finding *why* the incident is happening while production remains broken. Engineers trace the bug, read logs, and form theories while the error rate stays elevated and users continue to be harmed. The rollback or flag-off that would have stopped the harm in two minutes waits behind a root cause investigation that takes an hour. Caught when: the incident review shows that a fast mitigation was available early but was deferred in favor of diagnosis.

**Response:** Mitigation comes first. The Incident Commander's first question is "how do we stop the harm now?" not "why is this happening?" Root cause is a Phase 5 activity, performed after recovery. During the active incident, diagnosis exists only to choose the mitigation, not to produce the permanent fix.

### No one is in command
An incident is detected and several people start responding — each investigating, each trying a fix, none coordinating. Two engineers apply conflicting mitigations. Communication is duplicated or missed. No one decides when the incident is mitigated. Caught when: the review shows overlapping or contradictory actions and no single decision-maker.

**Response:** Every incident has exactly one Incident Commander, designated at declaration. The IC does not have to fix anything personally — they coordinate, decide, and own the response. If it is unclear who the IC is, the incident has no command, and establishing command is the first action.

### The incident is "closed" at recovery
The mitigation works, users are fine, and the team moves on. No root cause analysis is performed, no follow-up work is created, and no review is held. The same incident recurs weeks later because nothing was prevented. Caught when: a second incident traces to the same cause as a previous one that was never analyzed.

**Response:** Recovery is not resolution. An incident is resolved only after the root cause is identified, prevention work exists with owners, and the review is complete. The Definition of Done is not satisfied by "users are okay now." The most valuable output of an incident is the prevention that stops the next one.

### Severity set too low to avoid the response
An incident is classified P2 because a P0/P1 would require paging the CTO, mobilizing responders, and notifying the CEO — and the team would rather avoid the disruption. The under-classification means the response is slower and lighter than the impact warrants. Caught when: the review shows that user impact matched a higher severity than was declared.

**Response:** Severity reflects user impact, not the team's appetite for disruption. When evidence places an incident between levels, the higher level is chosen and downgraded later if warranted. The cost of over-classifying is a few minutes of attention; the cost of under-classifying is extended, under-resourced user harm.

### Communication goes silent during the response
The technical response consumes everyone's attention and the communication cadence lapses. Stakeholders and the CEO are left without updates for an hour. They assume the worst, escalate independently, or learn about the incident from users. Caught when: the CEO or a stakeholder asks for status that should have been pushed to them.

**Response:** Communication runs in parallel with the technical work and on a fixed cadence — even when there is no new information, "still investigating, next update in 30 minutes" goes out. The Communications Lead owns this so the Technical Resolvers can focus on the fix. Silence is interpreted as loss of control.

---

## Anti-Patterns

**The hero who fixes it alone and never tells anyone.** A single engineer notices a production problem, quietly fixes it, and moves on without declaring an incident, writing a record, or analyzing the cause. The organization never learns the incident happened, the prevention work is never done, and the next occurrence finds the team unprepared. Every production incident is declared and recorded, regardless of how quickly one person can resolve it. The fix is not the point; the learning is.

**Blame in the review.** An incident review that searches for the person who caused the incident teaches everyone to hide problems, downplay severity, and respond defensively in the next incident. Reviews are blameless and examine systems, tooling, and process — never individuals. The question is always "what allowed this?" not "who did this?"

**Mitigation mistaken for resolution.** Turning off a feature flag or rolling back is a mitigation — it stops the harm but leaves the defect unfixed and the cause unknown. Declaring the incident resolved at mitigation leaves the underlying problem live, waiting to recur the moment the mitigation is reversed. Resolution requires the cause, the prevention, and the permanent fix.

**Follow-up work that lands in the backlog and is never done.** The incident produces a list of prevention work items that are dutifully created and then deprioritized into a backlog that never clears. The prevention never ships, and the same incident returns. Follow-up work from P0/P1 incidents is prioritized into the next sprint with an owner; its completion is tracked, not assumed.

**Severity inflation and deflation by habit.** A team that calls everything a P0 burns out its responders and dulls the meaning of the highest severity; a team that calls everything a P2 under-responds to real harm. Severity is assigned to match impact, consistently, every time — so that the level reliably communicates how serious the incident is and triggers the right response.
