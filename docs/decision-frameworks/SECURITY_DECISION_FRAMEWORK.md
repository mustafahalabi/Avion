# Security Decision Framework

**Status:** Approved  
**Version:** 1.0  
**Owner:** Security Engineer  
**Last Updated:** 2026-06-29  

---

This document is the repeatable decision logic Engineering OS uses to evaluate security risk. It tells any employee who encounters a security-relevant choice how to classify it, how severe it is, who is allowed to decide it, and what must be true before the work can proceed. It exists so that security is never an opinion, never a matter of who is in the room, and never an optional step that gets skipped under deadline pressure.

The framework is implementation-neutral and provider-neutral. It does not assume a specific authentication library, secrets manager, cloud, or framework. It defines the questions that must be answered and the thresholds that determine the outcome — the answers are filled in by the codebase under review.

This document defines *how to decide*. The [Security Engineer handbook](../employees/SECURITY_ENGINEER.md) defines *who does the work and to what standard*. The [Decision System](../systems/DECISION_SYSTEM.md) defines *how a decision is recorded and remembered*. The [Approval System](../systems/APPROVAL_SYSTEM.md) defines *how the platform pauses for a human*. Where this framework and the Security Engineer handbook overlap, they are intended to agree; where they disagree, the handbook is authoritative on process and this document is authoritative on the decision thresholds.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Core Principles](#3-core-principles)
4. [The Decision Loop](#4-the-decision-loop)
5. [Risk Categories](#5-risk-categories)
6. [Required Questions per Category](#6-required-questions-per-category)
7. [Severity Model](#7-severity-model)
8. [Likelihood and Exposure](#8-likelihood-and-exposure)
9. [Decision Criteria](#9-decision-criteria)
10. [Authority: Who Decides](#10-authority-who-decides)
11. [Approval Triggers and Escalation Paths](#11-approval-triggers-and-escalation-paths)
12. [Compliance and Data Handling](#12-compliance-and-data-handling)
13. [Output Format: The Security Decision Record](#13-output-format-the-security-decision-record)
14. [Worked Examples](#14-worked-examples)
15. [Anti-Patterns](#15-anti-patterns)
16. [Relationship to Other Documents](#16-relationship-to-other-documents)

---

## 1. Purpose

Every feature is a potential incident if security is treated as something added at the end. The purpose of this framework is to make the security decision **repeatable** — two reviewers applying it to the same change should reach the same outcome, and the same reviewer applying it on a tight deadline should reach the same outcome they would on a quiet day.

The framework has four jobs:

1. **Classify.** Place a change into the right risk category and severity so the response is proportional.
2. **Decide.** Produce one of a fixed set of outcomes — Approve, Conditionally Approve, Block, or Escalate — using stated thresholds, not intuition.
3. **Route.** Send the decision to the authority entitled to make it, and escalate severe risk instead of absorbing it.
4. **Record.** Produce a written Security Decision Record so the company remembers why a risk was accepted, blocked, or mitigated.

Security in Engineering OS is **non-optional**. There is no category of change small enough, no release urgent enough, and no author trusted enough to bypass the relevant questions in this framework. A change that touches a risk category and is not evaluated has not been "lightly reviewed" — it has shipped an unmeasured risk.

---

## 2. Scope

**In scope.** Any change, feature, dependency, or configuration that touches one or more of the [risk categories](#5-risk-categories): authentication, authorization, secrets and credentials, data exposure, input and output handling, dependencies and supply chain, HTTP security headers, cookies and sessions, rate limiting and abuse, and compliance and data handling. This includes infrastructure and pipeline changes that alter the security properties of the running system.

**Out of scope.** Choices with no security consequence — internal variable naming, local refactors that do not change a trust boundary, documentation structure, and test-case selection within an approved security strategy. The dividing line is the same one the [Decision System](../systems/DECISION_SYSTEM.md#2-scope) draws: **consequence**. If a choice changes who can reach what data, what runs with what privilege, what secret is exposed, or what risk the company carries to production, it is in scope.

When in doubt about whether a change is in scope, treat it as in scope and run the [decision loop](#4-the-decision-loop). The cost of an unnecessary evaluation is minutes; the cost of a missed one is an incident.

---

## 3. Core Principles

- **Security is a property of the design, not a final-stage check.** The questions in this framework are asked when a feature is designed, verified before it ships, and re-asked when the system changes.
- **Default deny.** When the framework cannot establish that a control is present and correct, the answer is Block, not Approve. Absence of evidence is treated as absence of the control.
- **Written over verbal.** A security decision communicated in conversation is not a decision of record. Every outcome produces a [Security Decision Record](#13-output-format-the-security-decision-record).
- **One owner per decision.** Every security decision has exactly one accountable decision-maker at the correct authority level. Consensus is not a substitute for ownership.
- **Escalate severe risk; never absorb it silently.** A Critical or High risk with no clean mitigation is escalated, not quietly accepted. Silent absorption is the failure mode this framework exists to prevent.
- **Provider-neutral reasoning.** Decisions are justified by the security property required (for example, "secrets must come from a managed secret store, not source"), never by a specific vendor. Swapping the underlying tool must not change the decision.

---

## 4. The Decision Loop

Every security evaluation runs the same loop. The loop is deterministic: the same inputs produce the same outcome.

1. **Identify the change.** What is being added or modified, and which trust boundaries does it cross?
2. **Match risk categories.** Use the [Risk Categories](#5-risk-categories) table. A change may match several. Evaluate each one it touches.
3. **Answer the required questions.** For each matched category, answer every question in [Section 6](#6-required-questions-per-category). An unanswerable question is a finding, not a pass.
4. **Assign severity.** Rate the worst credible outcome using the [Severity Model](#7-severity-model), adjusted by [likelihood and exposure](#8-likelihood-and-exposure).
5. **Apply the decision criteria.** Convert findings and severity into one outcome — Approve, Conditionally Approve, Block, or Escalate — using [Section 9](#9-decision-criteria).
6. **Route to the right authority.** Use [Section 10](#10-authority-who-decides) and [Section 11](#11-approval-triggers-and-escalation-paths) to confirm the decision is made at the correct level.
7. **Record.** Write the [Security Decision Record](#13-output-format-the-security-decision-record) and store it with the work item.

The loop never terminates at "looks fine." It terminates at a recorded outcome with a named owner.

---

## 5. Risk Categories

Every in-scope change matches at least one category below. The category determines the required questions and the baseline severity ceiling — the most severe outcome that a flaw in that category can credibly produce.

| # | Category | What it covers | Baseline severity ceiling |
|---|---|---|---|
| 1 | **Authentication** | How identity is established: login, session creation, token issuance, multi-factor, account recovery. | Critical (auth bypass) |
| 2 | **Authorization** | What an established identity is allowed to do: access control, ownership checks, privilege boundaries, tenancy isolation. | Critical (privilege escalation / cross-tenant access) |
| 3 | **Secrets & credentials** | API keys, tokens, signing keys, passwords, connection strings, and any sensitive configuration. | Critical (credential exposure) |
| 4 | **Data exposure** | Where sensitive or personal data is read, returned, logged, cached, or transmitted. | Critical (unauthenticated data access) |
| 5 | **Input & output handling** | Validation of untrusted input and encoding of output: injection, deserialization, file upload, template rendering. | Critical (RCE / persistent injection) |
| 6 | **Dependencies & supply chain** | Third-party packages, their transitive tree, and known vulnerabilities or unmaintained sources. | High → Critical (per CVE) |
| 7 | **HTTP security headers** | Response headers that constrain browser behavior: CSP, HSTS, frame options, content-type options, referrer policy. | Medium (defense-in-depth gap) |
| 8 | **Cookies & sessions** | Cookie attributes and session lifecycle: `HttpOnly`, `Secure`, `SameSite`, scope, expiration, fixation, invalidation. | High (session hijack / fixation) |
| 9 | **Rate limiting & abuse** | Protection of endpoints from high-volume or automated abuse: brute force, enumeration, scraping, resource exhaustion. | High (credential stuffing / DoS) |
| 10 | **Compliance & data handling** | Legal and policy obligations: personal data minimization, retention, residency, consent, auditability. | High → escalate (legal exposure) |

A change that matches multiple categories inherits the **highest** baseline ceiling among them. The actual severity is then set by the findings, never below what the evidence supports.

---

## 6. Required Questions per Category

These are the non-optional questions. Each must be answered with evidence from the change under review. An answer of "unknown" or "not checked" is a finding and blocks Approval until resolved.

### 6.1 Authentication
- Is identity established using the company's approved authentication mechanism rather than a bespoke one?
- Are session tokens generated with sufficient entropy and stored so they cannot be read by client-side script or leaked in logs/URLs?
- Is session expiration enforced server-side, and are sessions invalidated on logout and credential change?
- Do authentication failures avoid revealing whether an account exists?
- Is there brute-force resistance (rate limiting, lockout, or equivalent) on authentication endpoints?
- For account recovery: can the recovery flow be used to take over an account without proving control of the registered identity?

### 6.2 Authorization
- Is authorization checked **server-side** for every protected operation, not just hidden in the UI?
- Does every operation that acts on a resource verify the caller owns or is permitted that specific resource (no IDOR)?
- Can a caller reach another caller's data by guessing, enumerating, or substituting an identifier?
- In a multi-tenant context, is tenant isolation enforced on every query path?
- Does the change follow least privilege — does it grant the minimum access required, and no more?

### 6.3 Secrets & credentials
- Are all secrets sourced from the approved secret store, never hardcoded in source, config files, or client bundles?
- Does the change avoid printing secrets to logs, error messages, or telemetry?
- Are secrets scoped to the least privilege and rotated-capable (no shared, unrotatable master credentials)?
- If a new credential is introduced, is there a documented owner and rotation path?

### 6.4 Data exposure
- Is sensitive or personal data returned only to callers entitled to it, and only the fields they need?
- Is sensitive data in transit protected by transport-layer encryption end to end?
- Is sensitive data kept out of logs, analytics, caches, and error payloads, or masked where it must appear?
- Are signed or pre-authorized links time-bounded and, where the data is sensitive, bound to an authenticated session?

### 6.5 Input & output handling
- Is all untrusted input validated at the system boundary against an expected format, not merely length?
- Is there any path where input reaches a query, command, file path, template, or external system without explicit, context-appropriate handling?
- Is output containing user-supplied data encoded for the exact context it renders in?
- For file upload/download: are type, size, and destination constrained, and is untrusted content never executed?

### 6.6 Dependencies & supply chain
- Does any new or updated dependency carry a known vulnerability at or above Medium severity?
- Is the dependency from a maintained source with a track record of addressing security issues?
- Does it materially expand the attack surface (new network calls, native code, broad permissions) for the value it provides?
- Is the dependency pinned and integrity-verified so a compromised upstream cannot silently alter it?

### 6.7 HTTP security headers
- Are the baseline security headers present on responses (content security policy, transport security, frame options, content-type options, referrer policy)?
- Does the change weaken an existing header (for example, loosening CSP or widening allowed frame ancestors)?
- Are cross-origin resource sharing settings as narrow as the feature allows, never a blanket wildcard for credentialed requests?

### 6.8 Cookies & sessions
- Do cookies carrying session or sensitive state set `HttpOnly`, `Secure`, and an appropriate `SameSite` attribute?
- Is cookie scope (domain/path) as narrow as the feature requires?
- Is the session resistant to fixation (a new session identifier is issued on privilege change such as login)?
- Are sessions invalidated server-side on logout, password change, and revocation — not merely cleared client-side?

### 6.9 Rate limiting & abuse
- Are endpoints that could be abused by volume (login, search, export, send) rate-limited or otherwise throttled?
- Are enumeration vectors (sequential IDs, verbose "not found vs. forbidden" responses) closed?
- Do error responses avoid leaking internal detail that aids an attacker while remaining useful to legitimate callers?
- Is there protection against resource exhaustion from a single caller (pagination caps, payload size limits)?

### 6.10 Compliance & data handling
- Does the change collect only the personal data it needs, with a defined retention and deletion path?
- Are data residency, consent, or auditability obligations relevant — and if so, are they met?
- Does the change create a new flow of personal data to a third party that has not been reviewed and accepted?
- Is there a record (auditable) of who accessed or changed sensitive data where the obligation requires it?

---

## 7. Severity Model

Severity is the worst credible outcome of a flaw, before mitigation. It drives response time and authority. This model matches the [Security Engineer handbook](../employees/SECURITY_ENGINEER.md#severity-classification); the response times below are authoritative there.

| Severity | Definition | Response time | Default authority |
|---|---|---|---|
| **Critical** | Unauthenticated access to user data, remote code execution, or complete authentication bypass. | Immediate — within 2 hours of discovery | CTO (and CEO if in production) |
| **High** | Authenticated access to other users' data, privilege escalation, persistent injection, session hijack. | Same business day | Security Engineer blocks; CTO for risk acceptance |
| **Medium** | Limited-scope data exposure, non-persistent injection, weakening of a security control, missing rate limit on a sensitive endpoint. | Within 3 business days | Security Engineer |
| **Low** | Theoretical risk with limited practical exploitability, missing defense-in-depth (for example, a non-critical header). | Within 2 weeks | Security Engineer |

Severity is assigned to the **worst credible** outcome, not the most likely one. A flaw that *could* expose all user data is Critical even if exploiting it is currently awkward — likelihood adjusts urgency and acceptance, not the ceiling.

---

## 8. Likelihood and Exposure

Severity sets the ceiling; likelihood and exposure determine urgency and whether a risk may be accepted. Assess two axes:

- **Exploitability** — How hard is it to trigger? Reachable by an unauthenticated remote caller (high) versus requiring privileged local access and an unlikely race (low).
- **Exposure** — Is the affected code in production now, behind a flag, or pre-release? A Critical flaw in production is an incident; the same flaw behind a disabled flag pre-merge is a blocking finding handled in the normal flow.

The combination adjusts the response, never the severity label:

| Severity × Exploitability | In production | Pre-release |
|---|---|---|
| **Critical**, easily exploitable | Emergency: contain now, notify CTO + CEO | Block; no merge until fixed |
| **High**, exploitable | Same-day fix or documented CTO acceptance | Block; fix before release |
| **Medium**, conditional | Schedule within response window | Conditionally approve with required change |
| **Low**, theoretical | Track; address within window | Approve or conditionally approve with note |

When a Critical or High issue is live and exploitable, the [emergency path](#11-approval-triggers-and-escalation-paths) takes precedence over all other work.

---

## 9. Decision Criteria

Every evaluation ends in exactly one of four outcomes. These map directly to the Security Engineer's [review responses](../employees/SECURITY_ENGINEER.md#security-review-response). The criteria are thresholds, not preferences.

### Approve
- Every required question for every matched category is answered with evidence.
- No finding at Medium severity or above is unresolved.
- Patterns used are consistent with the company's approved security patterns.
- Any data sent to an external service has been reviewed and accepted.

### Conditionally Approve
- A specific, bounded change is required that does **not** alter the security design.
- The required change is clear, written, and independently verifiable.
- No Critical or High finding remains open. (Critical/High cannot be resolved by a condition — they block until fixed and re-reviewed.)
- The work may proceed only after the condition is implemented and confirmed.

### Block
- An authentication or authorization bypass exists.
- User data is reachable by an unauthorized caller.
- Untrusted input reaches a dangerous context without correct handling.
- A secret is hardcoded or reachable outside the approved secret store.
- A dependency carries a known Critical or High vulnerability with no mitigation.
- A required question cannot be answered (default deny).

### Escalate
- A Block would stop a strategically important change and there is **no viable mitigation** — the CTO must decide whether to accept the residual risk.
- A Critical vulnerability exists in production.
- A risk-acceptance or policy-exception decision is required above the Security Engineer's authority.
- A compliance or legal obligation is implicated and the correct action is unclear.

A Block always carries a resolution path: the specific flaw, the required remediation, and how the fix will be verified. A Block without a resolution path is not actionable and is itself a defect in the review.

---

## 10. Authority: Who Decides

Security authority follows the same one-owner principle as the rest of the company (see the [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md)). The decision-maker is determined by severity and by whether a known risk is being **accepted** rather than fixed.

| Decision | Security Engineer | CTO | CEO |
|---|---|---|---|
| Approve / conditionally approve a change that meets the standard | **Decides** | Informed | — |
| Block a change for unacceptable risk | **Decides** (non-negotiable at this level) | Informed | — |
| Require a security pattern or a pre-merge security review | **Decides** | Informed | — |
| Declare a vulnerability Critical and trigger response | **Decides** | Notified immediately | Notified if in production |
| Require a dependency replaced for a known vulnerability | **Decides** | Informed | — |
| **Accept** a Medium residual risk to ship | **Decides** (documented) | Informed | — |
| **Accept** a High residual risk to ship | Recommends | **Approves** | Informed |
| **Accept** a Critical residual risk, or proceed past a security Block | Recommends with options | **Approves** | **Approves** if user-facing data risk |
| Security exception to an established policy (for example, a one-time protected-path deviation) | Recommends | **Approves** | Informed |
| External disclosure or user notification of a security incident | Prepares | **Approves** | **Approves** |
| Compliance/legal trade-off affecting product direction | Advises | Recommends | **Decides** |

The pattern is consistent: the **Security Engineer decides whether something is safe and blocks what is not.** Only the **CTO can authorize accepting a High or Critical residual risk**, and only the **CEO can own a decision that knowingly exposes user data, requires external disclosure, or trades off a compliance obligation against the business.** Authority to *accept risk* is never the same as authority to *do the work* — an engineer under deadline cannot self-authorize shipping a known High risk.

---

## 11. Approval Triggers and Escalation Paths

A security decision must leave the Security Engineer's desk and go up when any trigger below fires. These align with the escalation rules in the [Security Engineer handbook](../employees/SECURITY_ENGINEER.md#escalation-rules) and the gates in the [Approval System](../systems/APPROVAL_SYSTEM.md).

| Trigger | Escalate to | Within |
|---|---|---|
| Critical vulnerability discovered in production | CTO + CEO | Immediately |
| High vulnerability discovered in production | CTO | 2 hours |
| External vulnerability report received | CTO | Immediately on receipt |
| A Block has no viable mitigation and the change is business-critical | CTO | Before the block becomes indefinite |
| Request to accept a High or Critical residual risk | CTO (CEO for user-data exposure) | Before any acceptance is recorded |
| Security incident requires user or external communication | CTO → CEO | Before any communication is sent |
| Dependency with a Critical/High vulnerability has no available patch | CTO | Within the severity response window |
| Compliance obligation conflicts with the requested change | CTO → CEO | Before the change proceeds |

**Emergency path.** When user data has been or may have been exposed, when authentication can be bypassed in production, or when a user can act as another user, the finding is an emergency. Sprint commitments are suspended. The Security Engineer, CTO, and Tech Lead contain first (feature flag, rate limit, access restriction, or rollback per the [Rollback SOP](../sops/ROLLBACK.md)), then remediate the root cause, then verify, then record. The CEO is notified for any emergency that touches user data. No emergency is resolved "quietly" — every one produces a post-incident record.

**Release gate.** No release proceeds while a security Block is open against work in its scope. The Security Engineer provides written clearance or hold to the Release Manager before each release, consistent with the [Release SOP](../sops/RELEASE.md). A held release is the system working as intended, not a failure.

---

## 12. Compliance and Data Handling

Compliance is treated as a risk category, not a separate bureaucracy. The framework keeps it provider- and jurisdiction-neutral by reasoning about obligations, not specific regulations:

- **Data minimization.** Collect only the personal data a feature needs. Every new field of personal data is a question: why is it collected, where does it live, and when is it deleted?
- **Retention and deletion.** Personal data has a defined retention period and a working deletion path. A feature that stores personal data with no deletion story is a finding.
- **Consent and purpose.** Data collected for one purpose is not silently repurposed. A new use of existing personal data is an in-scope decision.
- **Third-party flows.** Sending personal data to a new external service is reviewed before it ships, regardless of how convenient the integration is.
- **Auditability.** Where an obligation requires it, access to and changes of sensitive data are recorded in a tamper-evident way.

When a compliance obligation is implicated and the correct action is not obvious, the decision **escalates to the CTO and, where it affects product direction, to the CEO** — compliance trade-offs against the business are a CEO-owned decision. The framework's role is to surface the obligation early, not to interpret law.

---

## 13. Output Format: The Security Decision Record

Every run of the [decision loop](#4-the-decision-loop) produces one Security Decision Record, stored with the work item (PR, task, or incident). It is the durable, attributable artifact future employees reference. It feeds company memory as a Decision Record of type `security` (see the [Decision System](../systems/DECISION_SYSTEM.md#9-decision-record-format) and the `Decision Record` object in the [Domain Model](../architecture/DOMAIN_MODEL.md#decision-record)).

```
SECURITY DECISION RECORD

Subject:            <PR / task / dependency / incident under review>
Date / Reviewer:    <date> / <Security Engineer>
Categories matched: <one or more of the 10 risk categories>

Findings:
  - [<category>] <severity> — <observation>
      Location:    <file / endpoint / config>
      Reasoning:   <why this is a risk; worst credible outcome>
      Required:    <remediation, or "none — meets standard">
      Verification:<how the fix will be confirmed>

Severity (highest): <Critical / High / Medium / Low>
Exploitability:     <easily exploitable / conditional / theoretical>
Exposure:           <production / behind flag / pre-release>

Outcome:            <Approve | Conditionally Approve | Block | Escalate>
Decision owner:     <Security Engineer | CTO | CEO>
Conditions:         <bounded required changes, if Conditionally Approved>
Residual risk:      <what remains after mitigation, and who accepted it>
Escalation:         <to whom, why, and options presented — if Escalate>
```

Rules for the record:

- **Every finding is classified and located.** A finding without a severity and a location is incomplete.
- **A Block names its resolution path.** Flaw, remediation, and verification are all present.
- **Accepted risk names its owner.** "The team felt it was fine" is not an owner; a residual High or Critical risk names the CTO or CEO who accepted it.
- **The record is written, not verbal.** An undocumented approval is not an approval.

---

## 14. Worked Examples

### Example 1 — Authorization finding, Conditionally Approved

A new `DELETE /api/account` endpoint accepts a `userId` in the request body and deletes that account. Authentication is correct and uses the approved pattern. The authorization question "can a caller act on another caller's resource?" fails: the endpoint never checks that the `userId` matches the authenticated session.

- **Category:** Authorization. **Severity:** High (authenticated access to another user's resource). **Exposure:** pre-release.
- **Outcome:** Conditionally Approve — bounded, verifiable change that does not alter the design. **Required change:** ignore the body `userId`; derive identity from the session. **Verification:** a request with User A's session and User B's `userId` deletes A's account or errors.
- **Owner:** Security Engineer.

### Example 2 — Data exposure, Block then Escalate

A data-export feature issues a signed download URL valid for 24 hours that requires no session on access. The data-exposure question "is sensitive data reachable only by entitled callers?" fails: anyone with the link reaches a user's full history unauthenticated.

- **Category:** Data exposure. **Severity:** Critical (unauthenticated access to user data). **Exposure:** pre-release.
- **Outcome:** Block. No clean in-place fix exists without an architecture change, so **Escalate to CTO** with options: (1) shorten validity to minutes, (2) require session on access, (3) one-time-use token.
- **Owner:** CTO decides the mitigation; Security Engineer holds the block until resolved.

### Example 3 — Dependency vulnerability, Block

A routine package bump pulls in a transitive dependency with a known High-severity vulnerability. The dependency question fails. No patched version is compatible.

- **Category:** Dependencies & supply chain. **Severity:** High. **Exposure:** pre-release.
- **Outcome:** Block. Replace or pin to a safe version before merge. If no patched version exists, **Escalate to CTO** to agree an interim mitigation and document residual risk with a review date.
- **Owner:** Security Engineer blocks; CTO if a no-patch acceptance is needed.

### Example 4 — Missing header, Approve with note

A frontend change ships without tightening a non-critical referrer-policy header. All other questions pass.

- **Category:** HTTP security headers. **Severity:** Low (defense-in-depth gap). **Exposure:** pre-release.
- **Outcome:** Approve with a tracked note to add the header within the Low response window. Not a blocker on its own.
- **Owner:** Security Engineer.

---

## 15. Anti-Patterns

- **Approving because "it's probably fine."** "Probably fine" is not an outcome. The framework produces Approve, Conditionally Approve, Block, or Escalate — each written and owned.
- **Skipping the questions for a "small" change.** There is no change small enough to bypass its categories' required questions. Small changes flip trust boundaries as easily as large ones.
- **Conditionally approving a Critical or High finding.** Critical and High findings block until fixed and re-reviewed. A condition is only for bounded changes that do not alter the security design.
- **Self-authorizing accepted risk.** An engineer under deadline cannot accept a known High or Critical risk to ship. That authority belongs to the CTO (and CEO for user-data exposure). Authority to do the work is not authority to accept the risk.
- **Vendor-specific reasoning.** "It's fine because we use Provider X" is not a justification. Decisions are justified by the required security property; swapping the vendor must not change the answer.
- **Silent absorption.** A known risk that is neither fixed nor escalated nor recorded is the single most dangerous outcome. Every risk is documented at discovery, with a severity and a remediation or accepted-risk-with-review-date.
- **Security as a final-stage gate.** Requirements are surfaced at planning, not discovered when the PR arrives. A feature built without knowing its security requirements usually needs rework.
- **Defining security by what has not been attacked.** A feature that has not been exploited is not a secure feature. The framework asks "is the control present and correct?" — not "has anyone attacked it yet?"

---

## 16. Relationship to Other Documents

- [Security Engineer — Operational Handbook](../employees/SECURITY_ENGINEER.md) — owns the review process, severity definitions, response times, and pattern library this framework references. Authoritative on *who does the work and how*.
- [Decision System](../systems/DECISION_SYSTEM.md) — how a security decision becomes a recorded, attributed, remembered Decision Record. Security decisions are Decision Records of type `security`.
- [Approval System](../systems/APPROVAL_SYSTEM.md) — how and when the platform pauses for an explicit human approval, including the autonomy gate around agentic actions.
- [Company Playbook](../company/COMPANY_PLAYBOOK.md) — the company principles this framework operationalizes: quality is everyone's responsibility, security is engineering, written over verbal, one owner per decision.
- [Responsibility Matrix](../organization/RESPONSIBILITY_MATRIX.md) — confirms one accountable owner per security activity.
- [Code Review SOP](../sops/CODE_REVIEW.md) — where security-relevant patterns are first identified and routed into this framework.
- [Release SOP](../sops/RELEASE.md) — the release gate that this framework's security clearance or hold feeds into.
- [Rollback SOP](../sops/ROLLBACK.md) — the containment path invoked on the emergency security path.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — defines the `Decision`, `Decision Record`, `Review`, and `Risk` objects that a Security Decision Record produces and references.
