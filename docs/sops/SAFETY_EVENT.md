# SOP: Safety Event Response

**SOP ID:** SOP-008  
**Category:** Standard Operating Procedure  
**Owner:** Security Engineer  
**Version:** 1.0  
**Status:** Approved  
**Last Updated:** 2026-06-29  

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Trigger](#3-trigger)
4. [Owner](#4-owner)
5. [Participants](#5-participants)
6. [Severity Model](#6-severity-model)
7. [Procedure](#7-procedure)
8. [Communication Rules](#8-communication-rules)
9. [Recovery Validation](#9-recovery-validation)
10. [Escalation Rules](#10-escalation-rules)
11. [Prevention Requirements](#11-prevention-requirements)
12. [Documentation Requirements](#12-documentation-requirements)
13. [Artifacts](#13-artifacts)
14. [Definition of Done](#14-definition-of-done)
15. [Memory Updates](#15-memory-updates)
16. [KPIs](#16-kpis)
17. [Failure Modes](#17-failure-modes)
18. [Anti-Patterns](#18-anti-patterns)

---

## 1. Purpose

A safety event is any occurrence — observed, suspected, or automatically detected — that places the security or integrity of Engineering OS, its repositories, its credentials, or its users' data at risk. This procedure defines how the company detects, contains, investigates, recovers from, and learns from those events.

Safety events are distinct from ordinary defects. A defect produces wrong behavior; a safety event produces *exposure*: unauthorized access, a leaked secret, an unvetted dependency, an over-broad permission, or data reaching a place it should not. The cost of mishandling a safety event is not a bad user experience — it is a breach. The procedure therefore prioritizes speed of containment over completeness of understanding: stop the harm first, explain it second.

This SOP exists because Engineering OS is a platform that runs autonomous agents against real repositories with real credentials. The autonomous loop (`pnpm driver` → `pnpm worker`) checks out a repo, runs `claude -p`, and pushes branches and pull requests. A pre-push guardrail gate enforces hard rules on every run — never push to a protected branch, never touch protected paths (`.env*`, lockfiles, `prisma/migrations/**`, `.github/workflows/**`, secrets), never force-push — and records every decision in a CEO execution audit trail. When that gate fires, when it is bypassed, or when any of those boundaries is crossed by a human or an agent, this procedure governs the response.

The Security Engineer owns this procedure end to end. No safety event is closed without a written record. No safety event is contained on a verbal say-so. The Security Engineer is the single accountable person for the safety of the system during an event.

---

## 2. Scope

### In scope

This procedure governs safety events in the following domains:

| Domain | Examples |
|---|---|
| **System access** | Unauthorized sign-in, session hijack, authentication or authorization bypass, a Clerk identity acting outside its company boundary |
| **Secrets** | A credential, token, API key, or `.env` value committed, logged, printed to an execution transcript, or transmitted to an external service; an encrypted integration credential decrypted or exfiltrated |
| **Dependencies** | A Critical or High vulnerability in a software dependency reaching production; an unexpected, unvetted, or malicious package introduced into a repository |
| **Permissions** | An over-broad scope granted on a provider connection (GitHub app, Linear OAuth, hosting provider); an agent acting beyond its autonomy level; a privilege escalation |
| **Data exposure** | User, company, or repository data reaching an unauthorized party, an external service, a log, or a pull request; cross-tenant data leakage |
| **Agent-runtime safety** | A pre-push guardrail block; a guardrail bypass; an agent attempting a denied or dangerous command, a protected path, or a protected-branch push; an autonomy-checkpoint policy that failed to pause |

### Out of scope (handled by another procedure)

- A production outage or performance anomaly with no security dimension is a **Production Incident (SOP-007)**.
- Reversing a deployment to remove harm is a **Rollback ([SOP-006](./ROLLBACK.md))**; a safety event frequently *triggers* a rollback, but the rollback itself follows that SOP.
- A routine security finding caught during code review — before it reaches production — is handled inline by the **[Code Review SOP (SOP-003)](./CODE_REVIEW.md)** and the [Security Engineer handbook](../employees/SECURITY_ENGINEER.md). It becomes a safety event only when the exposure is live or has already occurred.

When an event spans procedures, this SOP is the coordinating procedure for anything with a safety dimension; the others are invoked as sub-steps. The decision *thresholds* in this SOP are aligned with the [Security Decision Framework](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md); where they overlap, the framework is authoritative on thresholds and this SOP is authoritative on the operational response.

---

## 3. Trigger

This procedure is triggered when any of the following occurs:

- The Security Engineer, an engineer, or the Monitoring Engineer discovers or suspects unauthorized access, a leaked secret, a data exposure, or a permission escalation.
- A pre-push guardrail gate blocks an autonomous run because the agent attempted a protected path, a protected-branch push, a force-push, or a denied/dangerous command — and the attempt indicates intent or a control gap beyond a single benign block.
- A guardrail or autonomy checkpoint is found to have been bypassed, misconfigured, or to have failed to pause when policy required it.
- A dependency with a Critical or High vulnerability is found to be live in production, or an unexpected package is detected in a repository.
- An external party reports a vulnerability or a suspected breach.
- A Rollback ([SOP-006](./ROLLBACK.md)) or Release ([SOP-005](./RELEASE.md)) reveals that the underlying cause is a security exposure rather than a functional defect.
- Monitoring detects an anomaly whose signature is security-relevant (credential-stuffing patterns, anomalous data egress, a spike in permission-denied events, unexpected secret access).

When in doubt about whether something is a safety event, treat it as one and triage. The cost of triaging a non-event is minutes; the cost of not triaging a real one is a breach.

---

## 4. Owner

**Security Engineer** — owns the safety event from detection through post-event review. The Security Engineer classifies severity, directs containment, leads the investigation, authorizes recovery, and writes the safety event record. The Security Engineer has standing authority to suspend an autonomous run, pause the driver, drop a company's autonomy level, or block a release the moment a safety event is suspected — without prior approval.

**CTO** — the decision authority for risk acceptance, for any external communication, and for any action that exceeds the Security Engineer's standing authority. The CTO is notified for every Critical and High event and owns the call when containment and business continuity conflict.

---

## 5. Participants

| Role | Responsibility in this SOP |
|---|---|
| **Security Engineer** | End-to-end ownership; severity classification; containment direction; investigation lead; recovery authorization; safety event record; prevention requirements |
| **CTO** | Risk-acceptance authority; external/regulatory communication authority; decisions exceeding Security Engineer authority; receives every Critical/High event |
| **Monitoring Engineer** | Detection and anomaly classification; blast-radius signal analysis; confirmation that the anomaly clears after containment; ongoing watch through recovery |
| **DevOps Engineer** | Execution of containment in the environment — credential rotation, access revocation, feature-flag disablement, driver/worker pause, rollback execution; production restoration |
| **Engineering (Backend / Frontend / AI / Infrastructure)** | Root-cause assistance; remediation implementation under Security Engineer direction; identification of similar exposures in related code paths |
| **Tech Lead** | Technical assessment of containment vs. forward-fix; remediation coordination; root-cause ownership; creation of remediation and prevention work items |
| **Release Manager** | Coordination when recovery requires a release or rollback; release record updates; stakeholder communication for user-visible impact |
| **CEO** | Notified for any Critical event, any event touching user data or production secrets, and any event requiring external disclosure; informed of business-impacting decisions |

Not every role participates in every event. The Security Engineer convenes only the roles the event requires; for a contained Low-severity guardrail block, that may be the Security Engineer and the Tech Lead alone. For a Critical production credential leak, it is the full table.

---

## 6. Severity Model

Severity is the **worst credible outcome** of the event before mitigation — not the most likely one. It drives the response time and the default decision authority. This model is aligned with the severity classification in the [Security Engineer handbook](../employees/SECURITY_ENGINEER.md#severity-classification) and the [Security Decision Framework](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md#7-severity-model); the response-time commitments there are authoritative.

| Severity | Definition (safety event) | Contain within | Default authority |
|---|---|---|---|
| **Critical** | Confirmed or probable unauthorized access to user/company data; a live secret or production credential exposed (committed, logged, transmitted, or printed to a transcript); authentication or permission bypass reachable in production; remote code execution; an autonomous agent that exfiltrated data or secrets | Immediately — within 2 hours of discovery | CTO (and CEO when production or user data is involved) |
| **High** | Authenticated cross-tenant data access; privilege escalation; persistent injection; a secret exposed in a private but broadly readable location; a Critical/High dependency vulnerability live in production; a guardrail bypass that resulted in a protected-path or protected-branch push | Same business day | Security Engineer contains and blocks; CTO for risk acceptance |
| **Medium** | Limited-scope data exposure; weakening of a security control; an over-broad permission grant not yet exploited; a Medium dependency vulnerability; a guardrail that fired correctly but recurs as a pattern indicating a control gap | Within 3 business days | Security Engineer |
| **Low** | Theoretical risk with limited exploitability; missing defense-in-depth; a single, correctly-blocked guardrail event on one agent run with no data or secret exposure | Within 2 weeks | Security Engineer |

Likelihood and exposure adjust *urgency and whether a risk may be accepted* — never the severity ceiling. A flaw that *could* expose all user data is Critical even if exploiting it is currently awkward. A Critical or High event that is live and reachable takes precedence over all other work in the company; sprint commitments are suspended until it is contained.

A single guardrail block is not, by itself, a Critical event — the guardrail working is the system functioning as designed. Escalate the *severity* by what the block reveals: an agent that repeatedly probes protected paths, or a configuration in which the guardrail was the only thing standing between an agent and a secret, is a higher-severity finding than the block alone.

---

## 7. Procedure

### Phase 1: Detection and Triage

**Owner:** Security Engineer (with Monitoring Engineer for detection)  
**Input:** A reported, observed, or auto-detected safety signal  
**Output:** Severity classified; event declared or dismissed with rationale; participants convened  

**Steps:**

1. **Whoever observes the signal** — an engineer, the Monitoring Engineer, the guardrail gate, or an external reporter — routes it to the Security Engineer immediately. A safety signal is never sat on to "confirm it first." Confirmation is triage; triage is the Security Engineer's job.

2. **Security Engineer** performs triage upon discovery:
   - Classify the severity against the model in [Section 6](#6-severity-model).
   - Determine whether the exposure is live, reachable, and ongoing — or historical and closed.
   - Identify the domain (access, secrets, dependencies, permissions, data exposure, agent-runtime).
   - For agent-originated events, pull the **CEO execution audit trail** for the session — commands run, files touched, guardrail blocks recorded, and final outcome — to establish what the agent actually did.

3. **Security Engineer** declares the event and its severity, or dismisses the signal with a written rationale. A dismissed signal is still recorded; a pattern of dismissed signals is a finding.

4. **Security Engineer** notifies per severity:
   - Critical: CTO immediately; CEO immediately when production or user data is involved.
   - High: CTO within 2 hours of discovery.
   - Medium/Low: logged; CTO notified in the routine security report.

5. **Security Engineer** convenes the participants the event requires and names the current owner of each active workstream.

**Gate 1:** Event declared with a severity classification. Required participants notified. The clock for the containment window has started.

---

### Phase 2: Containment

**Owner:** Security Engineer (decision); DevOps Engineer (execution)  
**Input:** Declared event; severity; identified domain  
**Output:** Active exposure stopped; harm bounded while investigation proceeds  

Containment removes the harm; it does not fix the cause. The goal is to reach a state where the exposure is no longer growing. Containment precedes remediation whenever the exposure is live.

**Steps:**

1. **Security Engineer** selects the containment actions appropriate to the domain. Containment is reversible-bias and fast:

   | Domain | Containment actions |
   |---|---|
   | Secrets | Revoke and rotate the exposed credential at the provider; invalidate sessions/tokens derived from it; purge it from logs and transcripts where reachable; treat the secret as burned regardless of how briefly it was exposed |
   | System access | Revoke the offending session; disable the compromised account or identity; tighten the affected authorization boundary |
   | Permissions | Reduce the over-broad provider scope; disconnect the integration if it cannot be scoped down quickly; revoke the grant |
   | Dependencies | Pin, remove, or roll back the offending package; apply a temporary mitigation (feature flag, network restriction) if no patch exists |
   | Data exposure | Cut the egress path; disable the feature or endpoint leaking data; rotate any credential that traversed the exposed path |
   | Agent-runtime | **Fail the offending session** with the offending paths recorded; **pause the driver** (`pnpm driver`) for the affected company; **drop the autonomy level** so the loop pauses for a human checkpoint instead of auto-advancing; never re-enable until recovery validation passes |

2. **DevOps Engineer** executes the containment actions on the Security Engineer's authorization and reports completion in real time. The DevOps Engineer does not improvise scope; they execute the named actions and escalate anything that cannot be completed.

3. **Monitoring Engineer** confirms, by signal, that the exposure stops growing after containment — the anomalous egress, access pattern, or error class returns toward baseline.

4. When containment requires reversing a deployment, the Security Engineer invokes **Rollback ([SOP-006](./ROLLBACK.md))** as a sub-step; a security vulnerability in production is an immediate rollback trigger, not a forward-fix candidate.

5. **Security Engineer** records the containment timeline: what was contained, when, by whom, and what residual exposure (if any) remains.

**Gate 2:** Active exposure is stopped. Exposed credentials are rotated/revoked. Monitoring confirms the harm is no longer growing. Residual exposure, if any, is documented.

---

### Phase 3: Investigation

**Owner:** Security Engineer (lead); Tech Lead (technical); Engineering (assist)  
**Input:** Contained event  
**Output:** Confirmed root cause, timeline, and blast radius  

**Steps:**

1. **Security Engineer** establishes the timeline: when the exposure began, how it was introduced, when it was detected, and when it was contained. For agent-originated events, the audit trail (commands, files, guardrail blocks, outcome) is the primary evidence.

2. **Security Engineer**, with the **Tech Lead**, identifies the **root cause** — not the symptom. The investigation answers:
   - What specifically caused the exposure?
   - Where did the prevention chain fail — code, review, the guardrail gate, the autonomy-checkpoint policy, dependency vetting, or secret handling?
   - Was this introduced by a recent change, or a pre-existing condition newly exposed?
   - Could the same class of exposure exist in related code paths, repositories, or companies?

3. **Security Engineer** determines the **blast radius**: precisely what data, secrets, accounts, repositories, or companies were reachable, and which were actually accessed. "We don't know yet" is an acceptable interim answer; "we didn't check" is not. The blast radius drives the communication and disclosure decisions in [Section 8](#8-communication-rules).

4. **Engineering** checks for similar vulnerabilities in related code paths when the root cause suggests a class of vulnerability, and reports findings back to the Security Engineer.

5. **Security Engineer** designs the remediation with the relevant engineer and the Tech Lead. The remediation closes the root cause, is reviewed for security correctness before it ships, and does not introduce new risk. Remediation ships through the normal **[Code Review (SOP-003)](./CODE_REVIEW.md)** and **[Release (SOP-005)](./RELEASE.md)** procedures — a safety event does not waive review.

**Gate 3:** Root cause confirmed in writing. Blast radius established. Remediation designed and reviewed for security correctness.

---

### Phase 4: Recovery and Validation

**Owner:** Security Engineer (authorization); QA Engineer / DevOps Engineer (validation); Release Manager (coordination)  
**Input:** Contained event; reviewed remediation  
**Output:** Exposure permanently closed; normal operation restored under validation  

See [Section 9](#9-recovery-validation) for the recovery validation checklist. The Security Engineer does not declare recovery complete until that checklist passes in full.

**Gate 4:** Recovery validation checklist complete. Exposure confirmed closed. Autonomy re-enabled only after explicit Security Engineer authorization.

---

### Phase 5: Communication and Disclosure

**Owner:** Security Engineer (internal); CTO (external)  
**Input:** Confirmed blast radius; recovery status  
**Output:** Required parties informed; disclosure decisions made and recorded  

This phase runs in parallel with investigation and recovery — communication does not wait for the event to be fully closed. It follows the rules in [Section 8](#8-communication-rules).

**Gate 5:** All required internal parties informed. External/regulatory disclosure decision made by the CTO and recorded, whether or not disclosure was required.

---

### Phase 6: Post-Event Review and Prevention

**Owner:** Security Engineer  
**Input:** Closed event; root-cause analysis  
**Output:** Prevention measures defined and routed; review findings shared  

**Steps:**

1. **Security Engineer** conducts a post-event review within 7 days. Participants: Security Engineer, CTO, Tech Lead, and any role whose work was in the blast radius (DevOps, Monitoring, and the implementing engineers).

2. The review examines, without blame:
   - **Detection** — how was it detected, how fast, and what would have detected it sooner?
   - **Containment** — how fast did containment reach a no-growth state, and what slowed it?
   - **Prevention** — what control was missing or bypassed, and what closes that gap permanently?
   - **Communication** — was the right party informed at the right time?

3. **Security Engineer** defines the **prevention requirements** per [Section 11](#11-prevention-requirements) and routes them to owners as tracked work items.

4. **Security Engineer** writes the review findings and circulates them to all participants and the CTO. Findings that affect a standing SOP are escalated to that document's owner; findings that recur across events are escalated to the CTO for a systemic response, per the [Continuous Improvement System](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md).

**Gate 6:** Post-event review conducted within 7 days. Prevention requirements defined and routed. Findings recorded in organizational memory.

---

## 8. Communication Rules

1. **Security findings and event records are written.** A safety event communicated only verbally is not a record. Every classification, containment action, blast-radius finding, and decision is documented in the safety event record.

2. **Internal disclosure precedes remediation.** The CTO is notified of Critical and High events *before* remediation begins. There is no such thing as "fixing it quietly." An event resolved without a record and without notification is itself a process failure.

3. **The CEO is informed when the company is exposed.** The CEO is notified for any Critical event, any event touching user data or production secrets, and any event that will require external disclosure. The CEO does not learn of a breach from outside the company.

4. **External and regulatory communication is the CTO's decision.** No disclosure to users, customers, partners, or regulators is sent without explicit CTO authorization. The Security Engineer advises on what the blast radius obligates; the CTO decides what is sent and when. This decision is recorded even when the decision is "no external disclosure required."

5. **Containment actions are communicated to the people they affect.** When a credential is rotated, an integration disconnected, autonomy dropped, or the driver paused, the affected owners are told what changed and why — so they do not work against the containment or restore the exposed state.

6. **Blast radius is communicated honestly, including uncertainty.** "We are still determining the full scope" is a legitimate and required status. Understating a blast radius to avoid alarm is a failure; overstating it to seem thorough erodes trust. State what is known, what is suspected, and what is still being investigated.

Notification routing and the platform's `decision`/alert surfaces are governed by the [Notification System](../systems/NOTIFICATION_SYSTEM.md); approval pauses that a safety event may impose on autonomous work are governed by the [Approval System](../systems/APPROVAL_SYSTEM.md).

---

## 9. Recovery Validation

Recovery is the point at which the exposure is permanently closed and normal operation — including autonomous operation — may resume. The Security Engineer does not declare recovery until every item below is confirmed. Each item is *confirmed*, not assumed.

**Recovery Validation Checklist:**

*Exposure closure*
- [ ] The root cause is remediated, and the remediation has shipped through review and release
- [ ] Every exposed secret or credential has been rotated and the old value confirmed invalid
- [ ] Every over-broad permission or scope has been reduced or revoked
- [ ] The vulnerability is confirmed no longer exploitable (re-tested, not assumed)
- [ ] Related code paths have been checked for the same class of exposure

*System behavior*
- [ ] **QA Engineer** has validated that the affected flows behave correctly after remediation (see [QA Validation, SOP-004](./QA_VALIDATION.md))
- [ ] **Monitoring Engineer** confirms the anomalous signal is gone and health has returned to baseline
- [ ] **DevOps Engineer** confirms the production environment is in a known-good state

*Autonomous operation*
- [ ] The guardrail or autonomy-checkpoint gap that allowed the event (if any) is closed
- [ ] Autonomy level and the driver are re-enabled **only** on explicit Security Engineer authorization, and not before
- [ ] A controlled run has confirmed the guardrail now blocks the exposure path that the event exploited

*Record*
- [ ] The blast radius is finalized and recorded
- [ ] Disclosure decisions are recorded
- [ ] The safety event record is complete through recovery

A safety event that "seems resolved" but cannot pass this checklist is not recovered — it is uncontained with a quieter signal. Re-enabling autonomous execution before this checklist passes re-arms the exact path that produced the event.

---

## 10. Escalation Rules

| Situation | Escalate to | Trigger |
|---|---|---|
| Critical safety event (any domain) | CTO, and CEO if user data or production secrets involved | Immediately upon discovery |
| High safety event in production | CTO | Within 2 hours of discovery |
| Exposed secret or credential confirmed live | CTO | Immediately; rotation begins in parallel |
| Containment cannot stop the exposure from growing | CTO, Tech Lead | Immediately on discovery |
| Recovery validation fails | CTO, Tech Lead | Immediately; treat as an open, uncontained event |
| Event requires external or regulatory disclosure | CTO | Before any external communication is drafted |
| Blast radius includes more than one company/tenant | CTO, CEO | As soon as cross-tenant exposure is suspected |
| A guardrail or autonomy checkpoint was bypassed or failed to pause | CTO | Same day; the control itself is now a finding |
| Risk-acceptance decision needed (no clean fix, business impact) | CTO | Before the event is closed with residual risk |
| Recurring event class across multiple reviews | CTO | At review findings delivery; systemic response required |

Escalation is not a loss of ownership. The Security Engineer continues to own the event after escalation; escalation adds decision authority and resources, it does not transfer accountability.

---

## 11. Prevention Requirements

Every safety event — including those that were contained quickly and caused no confirmed harm — produces at least one prevention requirement. "It was contained" is the start of prevention work, not the end of it. The Security Engineer defines and routes prevention requirements in Phase 6.

Prevention requirements are drawn from, and recorded against, the prevention chain that failed:

| Prevention layer | Example requirement |
|---|---|
| **Guardrail gate** | A new protected path, a new denied/dangerous command, or a tightened branch rule, so the pre-push gate blocks this exposure path on every future run |
| **Autonomy policy** | A new approval checkpoint, or a lowered default autonomy for the affected class of work, so the loop pauses for a human where it previously did not |
| **Secret handling** | Secret scanning, rotation policy, or a removed log/transcript path that exposed a credential |
| **Dependency policy** | A vetting or allow-list requirement, or a vulnerability-response trigger, so the offending package class cannot recur silently |
| **Permission model** | A least-privilege scope default, or a review requirement before a provider scope is broadened |
| **Security pattern library** | A new approved pattern (or a corrected one) added to the [Security Engineer handbook](../employees/SECURITY_ENGINEER.md#security-patterns-library), so engineers build the safe path by default |
| **Process / SOP** | A change to a standing SOP, routed to that document's owner |

Each prevention requirement becomes a tracked work item with a named owner and is prioritized per the [Prioritization Decision Framework](../decision-frameworks/PRIORITIZATION_DECISION_FRAMEWORK.md). A prevention requirement that is identified but never tracked is the most common reason the same event recurs.

---

## 12. Documentation Requirements

Documentation is not the closing administrative step of a safety event — it is the artifact the company is left with when memory fades. The following are mandatory:

- **Safety event record** — the canonical record for the event: detection, classification, containment timeline, root cause, blast radius, recovery validation, communication and disclosure decisions, and prevention requirements. Owned by the Security Engineer.
- **Root-cause summary** — the technical foundation for the fix and for the prevention chain, owned by the Tech Lead, delivered within 48 hours for Critical and High events.
- **Decision record** — any risk-acceptance or disclosure decision is recorded as a decision in the [Decision System](../systems/DECISION_SYSTEM.md) with its rationale and authority.
- **Disclosure record** — the CTO's external-communication decision and its basis, recorded even when the decision is "no disclosure required."

These records are retained in the [Organizational Memory System](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md) and linked from the safety event record so future events can reference prior patterns.

---

## 13. Artifacts

| Artifact | Owner | Created in |
|---|---|---|
| Triage classification | Security Engineer | Phase 1 |
| Containment log | Security Engineer / DevOps Engineer | Phase 2 |
| Investigation timeline and blast-radius analysis | Security Engineer | Phase 3 |
| Root-cause summary | Tech Lead | Phase 3 |
| Recovery validation checklist | Security Engineer | Phase 4 |
| Communication and disclosure log | Security Engineer / CTO | Phase 5 |
| Post-event review findings | Security Engineer | Phase 6 |
| Prevention requirement work items | Security Engineer / owners | Phase 6 |
| Safety event record (canonical) | Security Engineer | Phases 1–6 |

---

## 14. Definition of Done

A safety event is done when all of the following are true:

- [ ] The event was classified by severity and declared
- [ ] Active exposure was contained and confirmed no longer growing
- [ ] Every exposed secret or credential was rotated and confirmed invalid
- [ ] Root cause was identified in writing and remediated through review and release
- [ ] Blast radius was established and recorded
- [ ] The recovery validation checklist passed in full
- [ ] Autonomous execution was re-enabled only after explicit Security Engineer authorization
- [ ] Required internal parties were notified; the CTO's external-disclosure decision was made and recorded
- [ ] At least one prevention requirement was defined and routed as a tracked work item
- [ ] The post-event review was conducted within 7 days
- [ ] The safety event record is complete and retained in organizational memory

A safety event that was contained but has no recorded root cause, no prevention requirement, and no review is not done — it is forgotten.

---

## 15. Memory Updates

After each safety event:

| Record | Content | Owner |
|---|---|---|
| Safety event record | Full event: detection, classification, containment, root cause, blast radius, recovery, communication, prevention | Security Engineer |
| Root-cause summary | Technical cause and prevention-chain failure | Tech Lead |
| Decision records | Risk-acceptance and disclosure decisions with authority and rationale | Security Engineer / CTO |
| Security pattern library | Any new or corrected approved pattern arising from the event | Security Engineer |
| Prevention work items | Guardrail, autonomy, dependency, permission, secret, and SOP changes | Security Engineer / owners |
| Safety event pattern log | Running record of event causes across the company, used to detect systemic patterns | Security Engineer |

These feed the [Learning Engine](../memory/LEARNING_ENGINE.md) and the [Continuous Improvement System](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md): a safety event that does not change a guardrail, a pattern, or a process taught the company nothing.

---

## 16. KPIs

| KPI | Target | Measured by |
|---|---|---|
| Time from detection to containment (Critical/High) | Within the severity containment window (2 hours / same day) | Safety event records |
| Critical/High events with CTO notified before remediation | 100% | Safety event records |
| Exposed credentials rotated before the event is closed | 100% | Recovery validation checklists |
| Root-cause summary delivered within 48 hours (Critical/High) | 100% | Safety event records |
| Recovery validation checklist completion before re-enabling autonomy | 100% | Recovery validation checklists |
| Safety events producing at least one tracked prevention requirement | 100% | Prevention work items |
| Post-event review conducted within 7 days | 100% | Review records |
| Recurrence of a previously-reviewed event class | Trending to zero | Safety event pattern log |
| External-disclosure decisions recorded (including "no disclosure") | 100% | Disclosure records |

---

## 17. Failure Modes

### The guardrail block treated as a non-event
The pre-push guardrail blocks an agent run from touching a protected path. The block is logged, the session fails, and everyone moves on — the control worked, so there is "nothing to investigate." But the block was the *only* thing between an agent and a secret, and the underlying prompt or configuration that drove the agent toward that path is still in place. Caught when: the same block recurs across runs, or a later run reaches the path through a route the guardrail does not cover.

**Response:** A guardrail block is a signal to triage, not a closed case. The Security Engineer reviews repeated or intent-bearing blocks, asks what would have happened without the guardrail, and decides whether the *configuration* that produced the attempt is itself a finding. The guardrail working does not mean the system is safe — it means the last line held.

### Containment skipped in favor of "just fixing it"
A secret is found in a transcript. An engineer starts writing the fix to stop secrets from being logged, intending to ship it before rotating the credential. The fix takes hours; the live credential remains valid the entire time. Caught when: the credential is used from an unexpected source before the fix ships.

**Response:** Containment precedes remediation when the exposure is live. The exposed credential is rotated immediately — treated as burned the moment it was exposed, regardless of how briefly. The fix that prevents future logging is remediation; it does not protect the secret that is already out.

### Blast radius assumed instead of established
The team contains the exposure and assumes the blast radius is "probably just this one record" without checking. The disclosure decision is made on the assumption. Later analysis shows the exposure was broader, and the company has already told stakeholders it was narrow. Caught when: a fuller investigation contradicts a communication that was already sent.

**Response:** The blast radius is established by evidence — access logs, the audit trail, egress signals — before any disclosure decision rests on it. "We are still determining scope" is the correct status until the evidence supports a conclusion. Disclosure decisions wait for, or are explicitly caveated by, the confirmed radius.

### Autonomy re-enabled before recovery is validated
After containment, the driver is paused and autonomy dropped. The remediation ships, the team is relieved, and someone re-enables autonomous execution to keep work flowing — before the recovery validation checklist is complete. The guardrail gap that allowed the event is still open, and the next autonomous run re-arms it. Caught when: a second event occurs through the same path shortly after the first.

**Response:** Autonomous execution is re-enabled only on explicit Security Engineer authorization, only after the recovery validation checklist passes, and only after a controlled run confirms the guardrail now blocks the original path. Restoring throughput is never a reason to re-arm an unvalidated exposure.

### The quiet fix
A High-severity exposure is found and an engineer remediates it without notifying the Security Engineer or CTO, reasoning that it is fixed so there is nothing to report. There is no record, no blast-radius analysis, and no prevention requirement. Caught when: a later audit or a recurrence reveals the event that was never recorded.

**Response:** Internal disclosure precedes remediation for Critical and High events. There is no such thing as fixing a safety event quietly. The record, the blast-radius analysis, and the prevention requirement are mandatory regardless of how clean the fix was; an unrecorded fix is a process failure even when the code change is correct.

---

## 18. Anti-Patterns

**"The guardrail caught it, so we're fine."** The guardrail is the last line of defense, not the only one. A system that relies on the guardrail to stop exposures it should never have approached is one configuration change away from a breach. Every guardrail block worth the name asks: why did we get this close, and what closes the gap upstream?

**Speed of fix over speed of containment.** The instinct under pressure is to fix the root cause fast. But a live exposure does not care that a fix is coming — it is exploitable now. Containment buys the time to fix correctly. Rotate the secret, revoke the access, pause the loop first; then fix the cause without a clock running against active harm.

**Severity argued down to reduce process.** Classifying a Critical event as High to avoid notifying the CEO, or a High as Medium to avoid a same-day response, does not make the event smaller — it makes the response slower and the record dishonest. Severity is the worst credible outcome, assigned on evidence, not on how much process the team wants to avoid.

**Containment without a record.** Rotating a credential, disconnecting an integration, or pausing the driver without writing down what was done and why leaves the next responder blind and the company unable to learn. Containment actions are as deliberate and as documented as deployments.

**The event that "resolved itself."** An anomaly that disappears is not an event that did not happen — it is an event whose cause is unknown. "It went away" means "we have no basis for preventing it next time." Every declared safety event has a root cause and a prevention requirement, including the ones that stopped on their own.

**Security Engineer as a reporter rather than an owner.** The Security Engineer does not merely document what others decide. They classify, direct containment, lead the investigation, authorize recovery, and own the record. If the Security Engineer cannot describe what the event exposed, how it was contained, and what prevents its recurrence, the event is not owned — and an unowned safety event is an open one.
