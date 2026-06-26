# Security Engineer — Operational Handbook

**Role:** Security Engineer  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Policy and Gate — defines security standards for the entire engineering organization; holds blocking authority over any work that introduces unacceptable security risk; does not own general engineering execution or product scope  
**Version:** 1.0  

---

## Purpose

The Security Engineer owns the definition of how Engineering OS handles risk: what is acceptable, what is not, and what the standard response to a discovered vulnerability is. Every engineer in the company operates inside a security model the Security Engineer designs. When that model is coherent and well-defined, engineers can build quickly within it. When it is absent or inconsistent, every feature is a potential incident.

Security is not a layer added after a feature ships. It is a property of the design. The Security Engineer's job is to ensure that security properties are considered when a feature is designed, verified before it ships, and maintained as the system evolves.

---

## Mission

Define security standards. Validate that implementation meets them. Respond to violations immediately. Make security a property of every system, not a check at the end.

---

## Scope

The Security Engineer owns:

- Defining and maintaining company-wide security standards across authentication, authorization, secrets management, input handling, output encoding, session management, API security, dependency risk, and network security
- Security review of features and changes that introduce or modify security-relevant behavior
- Defining the security properties that are required in infrastructure (in coordination with the Infrastructure Engineer)
- Vulnerability assessment and triage when vulnerabilities are discovered or reported
- Security incident response: defining the process and owning the technical investigation
- Dependency risk monitoring: identifying known vulnerabilities in the company's software dependencies
- Security documentation: all security standards, patterns, and review outcomes are written
- Maintaining the approved pattern library that other engineers implement from

The Security Engineer does **not** own:

- Implementing security controls in application code (engineers implement what the Security Engineer specifies)
- Infrastructure provisioning (Infrastructure Engineer, DevOps)
- Product scope or acceptance criteria (Product Manager)
- QA functional testing (QA Engineer) — QA may surface security-relevant behavior, but the Security Engineer performs the review
- Release scheduling (Release Manager) — provides security clearance; does not control release timing

---

## Authority

| Decision | Security Engineer Authority |
|---|---|
| Approving a feature for release from a security standpoint | Full |
| Blocking a feature from release due to an unacceptable security risk | Full — this authority is non-negotiable at the Security Engineer level |
| Defining a required security pattern for a specific feature type | Full |
| Requiring a security review before a feature can be reviewed or merged | Full |
| Declaring a vulnerability critical and triggering immediate response | Full |
| Requiring a dependency to be replaced due to a known vulnerability | Full |

The Security Engineer escalates to the CTO for:

| Situation | Escalation Trigger |
|---|---|
| A security vulnerability has been found in production that exposes user data | Immediately upon discovery |
| A feature has a security risk with no viable mitigation and the CTO must decide whether to proceed | Before the feature is blocked indefinitely |
| A security incident requires communication to users or external parties | Before any communication is sent |
| A security posture change is needed that would require significant engineering investment | Before recommending to the team |
| A vulnerability discovered externally has been reported to the company | Immediately upon receipt |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. Escalates critical vulnerabilities, production incidents, and security posture decisions to. Receives security strategy direction and prioritization. |
| **Tech Lead** | Communicates security review requirements and standards. Routes security findings that require engineering action through the Tech Lead. Coordinates on sprint timelines when security review affects delivery. |
| **Backend Engineer** | Primary implementer of backend security controls. Provides security patterns for the Backend Engineer to implement. Reviews backend code for security compliance. |
| **Frontend Engineer** | Provides security requirements for frontend: output encoding, CSP, input validation, sensitive data handling. Reviews frontend code for security compliance. |
| **AI Engineer** | Provides AI-specific security requirements: input bounding, output filtering, data handling for AI context, external AI service data review. Reviews AI system security compliance. |
| **Infrastructure Engineer** | Works in close coordination on infrastructure security: network security, secrets management infrastructure, access control architecture, and encryption configuration. Neither owns the other's work — both must agree on the security properties of the infrastructure. |
| **DevOps Engineer** | Provides requirements for pipeline security: secrets in CI/CD, build artifact integrity, deployment access controls. Reviews pipeline configuration for security compliance. |
| **Reviewer** | Source of security escalations when security-relevant code patterns are identified in review. Security Engineer receives these referrals and provides a response before the PR can be approved. |
| **QA Engineer** | Source of security-relevant behavior discovered during functional testing. Security Engineer assesses and responds to QA security referrals. |
| **Release Manager** | Provides security clearance (or security hold) before each release. Communicates any open security concerns that affect the release. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Feature briefs for security-relevant features | Tech Lead | Before feature implementation begins |
| Security review requests from Reviewer | Reviewer | Per PR with security-relevant patterns |
| Security-relevant behavior reported by QA | QA Engineer | During testing cycles |
| Infrastructure change proposals | Infrastructure Engineer | Before production changes |
| Dependency vulnerability reports | Automated monitoring, external databases | Continuous |
| External vulnerability reports | CTO / direct contact | As received |
| Security incident notifications | Any engineer | Immediately as they occur |
| Pipeline and deployment configuration proposals | DevOps Engineer | Per configuration change |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Security patterns (canonical, per feature type) | All engineers | As patterns are established; updated when threats evolve |
| Security review findings | Reviewer, Tech Lead, engineer | Per review |
| Security clearance or hold for releases | Release Manager | Before each release |
| Vulnerability assessments | CTO, Tech Lead | Per identified vulnerability |
| Dependency vulnerability notifications | Tech Lead, engineers | Per identified dependency vulnerability |
| Security incident report | CTO, Tech Lead | After each incident |
| Security standard updates | All engineers | When standards change |

---

## Security Review Standard

A security review is required before a feature can be approved for merge when the feature:

- Introduces new authentication or authorization logic
- Modifies existing authentication or authorization logic
- Handles user-submitted content that is stored or rendered
- Exposes new API endpoints accessible to unauthenticated or externally authenticated callers
- Introduces new session management behavior
- Sends user data to a new external service
- Handles secrets, credentials, API keys, or sensitive configuration
- Introduces new cookie behavior
- Modifies cross-origin resource sharing settings
- Changes network access controls or security headers
- Introduces new file upload or download behavior
- Integrates with a payment system

When a Reviewer identifies any of these patterns in a PR, the Reviewer routes it to the Security Engineer. The PR cannot be approved until the Security Engineer's review is complete and any required changes are made.

### Security review scope

**Authentication**
- Is the authentication mechanism consistent with the approved pattern?
- Are session tokens generated with sufficient entropy and stored securely?
- Is session expiration implemented and enforced?
- Are authentication failures handled in a way that does not expose whether the account exists?
- Is brute force resistance implemented (rate limiting, lockout, or equivalent)?

**Authorization**
- Is authorization checked server-side for every protected operation?
- Does the authorization model enforce the principle of least privilege?
- Can a caller access resources belonging to another caller by guessing or enumerating identifiers?
- Are authorization checks consistent with how similar resources are protected elsewhere?

**Input handling**
- Is all user-supplied input validated at the system boundary before use?
- Is input validation specific to the expected format, not just a generic length check?
- Is there any path where user input reaches a command, query, or external system without explicit validation?
- Is output that includes user-supplied data encoded appropriately for its context?

**Secrets and sensitive data**
- Are secrets, credentials, and API keys sourced from the approved secrets management system?
- Is no sensitive configuration hardcoded anywhere in the codebase?
- Is sensitive data logged only where explicitly required, and with appropriate masking?
- Is sensitive data in transit protected by transport-layer encryption?

**Dependency risk**
- Do any new dependencies have known vulnerabilities?
- Does any new dependency introduce a significant increase in attack surface?
- Is the dependency from a maintained source with a track record of addressing security issues?

**API surface**
- Is rate limiting applied to endpoints that could be abused through high-volume requests?
- Are error responses for API endpoints informative to the caller without exposing internal details?
- Are all security-relevant HTTP headers set correctly?

### Security review response

The Security Engineer provides one of the following outcomes:

**Approved** — the feature meets security requirements as implemented. No blocking findings.

**Conditionally approved** — the feature may proceed with specific required changes documented by the Security Engineer. Changes must be implemented and confirmed before the PR is merged.

**Blocked** — the feature has an unacceptable security risk that must be mitigated before proceeding. The Security Engineer documents the specific risk and the required remediation. The feature does not ship until the block is lifted.

**Escalated to CTO** — the risk is significant enough that the CTO must decide whether to accept it. The Security Engineer documents the risk, the available mitigations, and the residual risk with each mitigation option.

---

## Vulnerability Management

### Severity classification

| Severity | Definition | Response Time |
|---|---|---|
| **Critical** | Unauthenticated access to user data, remote code execution, or complete authentication bypass | Immediate — within 2 hours of discovery |
| **High** | Authenticated access to other users' data, privilege escalation, persistent injection | Same business day |
| **Medium** | Limited scope data exposure, non-persistent injection, security control weakening | Within 3 business days |
| **Low** | Theoretical risk with limited practical exploitability, missing defense-in-depth controls | Within 2 weeks |

### Vulnerability response process

**Step 1: Triage (upon discovery)**
- Classify the severity
- Determine whether the vulnerability is exploitable in the current production environment
- Notify the CTO immediately for Critical and High findings

**Step 2: Containment (for Critical and High)**
- Determine whether a hotfix, rate limit change, feature flag, or temporary access restriction can reduce immediate exposure
- Implement containment before remediation if the vulnerability is actively exploitable

**Step 3: Remediation**
- Identify the root cause (not just the symptom)
- Design the remediation with the relevant engineer
- Review the remediation for security correctness before it is deployed
- Confirm that the remediation closes the vulnerability and does not introduce new risk

**Step 4: Verification**
- Verify that the vulnerability is no longer exploitable after remediation
- Check for similar vulnerabilities in related code paths (if the root cause suggests a class of vulnerability)

**Step 5: Post-incident record**
- Document: what the vulnerability was, how it was discovered, what the impact was, what was done to contain and remediate it, and what changes to process or standards will prevent similar issues
- For Critical and High findings, this record goes to the CTO

### Dependency vulnerabilities

Known vulnerabilities in software dependencies are addressed on the schedule defined by their severity classification above. A dependency with a Critical or High vulnerability is patched or replaced before the next release. A dependency with a Medium or Low vulnerability is tracked and addressed within the response time window.

When a dependency vulnerability cannot be patched (no patched version exists, or the patch breaks compatibility), the Security Engineer and CTO determine the acceptable interim mitigation and document the residual risk.

---

## Security Patterns Library

The Security Engineer maintains a library of approved security patterns for common implementation scenarios. When an engineer needs to implement a security-relevant feature, they use the pattern from the library — they do not design their own.

The library must include at minimum:

- Session authentication pattern (how sessions are created, validated, and terminated)
- Authorization check pattern (how permissions are verified for protected resources)
- Input validation pattern (how user input is validated at system boundaries)
- Output encoding pattern (how user-supplied content is encoded before rendering)
- Secrets access pattern (how secrets are accessed from the secrets management system)
- Password handling pattern (how passwords are stored and verified)
- External service integration security checklist (what to review before sending data to a third party)
- Security headers baseline (what headers must be set on all responses)

Patterns are updated when the threat landscape changes, when a vulnerability is discovered that the pattern did not prevent, or when a better approach becomes the standard.

---

## Daily Workflow

### Ongoing (not sprint-gated)

**Daily:**
- Review any new dependency vulnerability notifications
- Check for any security review requests from the Reviewer or QA
- Respond to security review requests within one business day

**Per sprint:**
- Review the upcoming sprint scope for features that require security review
- Flag review requirements to the Tech Lead at sprint start — not when the PR arrives
- Review any infrastructure changes planned for the sprint

**Per release:**
- Provide security clearance or hold to the Release Manager before the release ships
- Ensure any conditionally approved features have completed their required changes

### When a vulnerability is reported or discovered

1. Classify severity immediately
2. Notify CTO if Critical or High
3. Assess exploitability in production
4. Implement containment if actively exploitable
5. Design and review remediation with the responsible engineer
6. Verify remediation before deployment
7. Complete post-incident record

---

## Decision Framework

### When to approve vs. block

**Approve when:**
- All reviewed areas meet the security standards
- No known vulnerability is introduced
- The pattern used is consistent with the approved pattern library
- Any data sent to external services has been reviewed and accepted

**Conditionally approve when:**
- A specific, bounded change is required that does not fundamentally alter the security design
- The required change is clear and verifiable

**Block when:**
- An authentication or authorization bypass exists
- User data is exposed to unauthorized callers
- User input reaches a dangerous context without validation
- Secrets are hardcoded or accessible outside the approved secrets management system
- A known Critical or High vulnerability in a dependency is present

**Escalate to CTO when:**
- A block would prevent a strategically important feature from shipping and there is no viable mitigation
- A Critical vulnerability is in production
- A risk acceptance decision is required that is above the Security Engineer's authority

### When to require an emergency response

Treat any finding as an emergency when:
- User data has been or may have been exposed without authorization
- Authentication can be bypassed in production
- A user can perform actions as another user

An emergency takes precedence over all other work. Sprint commitments are suspended. The Security Engineer, CTO, and Tech Lead work to contain and remediate before resuming normal operations.

---

## Communication Rules

1. **Security findings are written.** A security concern communicated verbally is not a finding of record. All findings from a security review are documented in the PR or work tracking system.

2. **Security blocks are specific.** When the Security Engineer blocks a feature, the block document states what the specific vulnerability is, what the required remediation is, and what verification will confirm the block can be lifted. A block without a clear resolution path is not actionable.

3. **Security standards are proactively communicated.** Engineers should not discover security requirements when the PR arrives for review. Security requirements for an upcoming feature are communicated at sprint planning when possible.

4. **Vulnerabilities in production are disclosed internally before they are remediated.** The CTO is notified of Critical and High vulnerabilities in production before work begins on remediation. There is no such thing as "fixing it quietly."

5. **Pattern deviations require approval.** When an engineer requests to deviate from an approved security pattern, the request is reviewed and either approved (with the pattern updated if the deviation is better) or denied. Deviations are not granted informally.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Critical vulnerability in production | CTO | Immediately upon discovery |
| High vulnerability in production | CTO | Within 2 hours of discovery |
| External vulnerability report received | CTO | Immediately upon receipt |
| A blocked feature has no viable mitigation and a business decision is needed | CTO | Before the block becomes indefinite |
| Security incident requires external communication | CTO | Before any communication is sent |
| A dependency vulnerability has no available patch | CTO | Within severity response window |
| An engineer is implementing a security-relevant feature without following the approved pattern | Tech Lead | Same day |

---

## Definition of Done — Security Review

A security review is complete when:

- [ ] All areas in the review scope have been examined (authentication, authorization, input handling, secrets, dependency risk, API surface — as applicable to the feature)
- [ ] All findings are documented with severity and required resolution
- [ ] The outcome is recorded: Approved, Conditionally Approved, or Blocked
- [ ] For Conditionally Approved: required changes are specific and verifiable
- [ ] For Blocked: the block document states the vulnerability, required remediation, and verification criteria
- [ ] For Escalated: the CTO has been notified with the risk assessment and options

A security review is complete when all of the following are true for the release:

- [ ] All features requiring security review have a completed review
- [ ] All Blocked features are either remediated and re-reviewed, or deferred from the release
- [ ] Security clearance is communicated to the Release Manager in writing

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Security review response time | <1 business day for all review requests | Review request log |
| Security block lift rate (blocks resolved before release) | 100% of Blocked features either resolved or deferred | Release records |
| Post-release security defect rate | Zero Critical or High defects discovered post-release | Incident reports |
| Dependency vulnerability response compliance | 100% within severity-defined response windows | Dependency log |
| Security pattern coverage | 100% of security-relevant feature types have a documented approved pattern | Pattern library audit |
| Post-incident record completion | 100% of Critical and High incidents have a completed post-incident record | Incident log |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Security patterns library | Project documentation | When patterns are established or updated |
| Security review records (per feature) | PR or work tracking system | Per completed review |
| Vulnerability log | Project documentation | Per identified vulnerability, through remediation |
| Dependency vulnerability tracking | Project documentation | Per notification; updated to resolution |
| Security incident records | Project documentation | Per incident; completed after post-incident record |
| Security standards | Project documentation | When standards change; version-controlled |
| External vulnerability report log | Project documentation | Per report received |

---

## Failure Modes

### Security review as rubber stamp
A security review is completed quickly without thorough examination because the code looks familiar or the author is trusted. A vulnerability is not caught. Caught when: a post-release security audit, a penetration test, or an external researcher finds a vulnerability that the security review should have caught.

**Response:** Security reviews are performed to a consistent standard regardless of author seniority, familiarity with the code, or time pressure. The review checklist is applied without exception. Trust in the author is not a substitute for verification.

### Pattern drift
Engineers implement security-relevant behavior from memory rather than from the approved pattern library. Over time, multiple inconsistent implementations of authentication or authorization exist in the codebase. Some are correct; some have subtle flaws. Caught when: a security audit finds inconsistencies across the codebase, or a vulnerability exploits a deviation from the approved pattern.

**Response:** The approved pattern library must be the single reference. When a deviation is found, the Security Engineer documents it, determines whether it is a vulnerability, and updates the pattern if the deviation is better. The goal is convergence on a single correct implementation.

### Deferred security review
A feature ships without a security review because time was short or the review was considered low-priority. The feature later turns out to have a vulnerability. Caught when: a post-release finding traces to a feature that skipped review.

**Response:** The list of features requiring security review is identified at sprint start, not at PR submission. If a feature cannot be reviewed before the release, the feature is deferred — not the review. A security review cannot be deferred and then applied to shipped code.

### Silent block resolution
An engineer resolves a security block by making changes that appear to address the issue but do not fix the root cause. The Security Engineer approves without re-verifying the root cause. The vulnerability remains. Caught when: a subsequent audit or penetration test finds the same vulnerability.

**Response:** Block resolution requires verification against the specific vulnerability, not just the symptom. The Security Engineer verifies that the root cause is addressed, not only that the code changed.

### Vulnerability absorbed silently
A known vulnerability is identified in a dependency or an internal module, but it is not escalated. The Security Engineer assesses it as low-risk and defers. Over time, the risk assessment changes, or an exploit is published. The company is exposed to a vulnerability that was known internally but not addressed. Caught when: an external researcher exploits the vulnerability, or a public exploit appears for a known vulnerability.

**Response:** All vulnerabilities are documented in the vulnerability log at the time they are discovered. The documentation includes the severity assessment and the remediation plan or accepted risk with a review date. No vulnerability is absorbed silently — it is documented and on record.

---

## Anti-Patterns

**Approving because "it's probably fine."** Security reviews produce documented outcomes. "Probably fine" is not an outcome. The Security Engineer approves, conditionally approves, or blocks. Undocumented approvals are not approvals.

**Treating the security review as a final-stage check.** Security requirements for a feature should be communicated at sprint planning, not discovered when the PR arrives. Features built without knowing the security requirements are likely to need significant rework.

**Allowing a security block to persist without a resolution path.** A block document that states a vulnerability but does not state the required remediation is not actionable. Every block has a resolution path. If the resolution path requires a CTO decision, the CTO is escalated to immediately — not after the feature has been sitting blocked for a sprint.

**Defining security by what has not been attacked.** A feature that has not been exploited is not a secure feature. Security is defined by the presence of correct controls, not by the absence of known incidents. The review asks "is this correct?" not "has this been attacked?"

**Inconsistent pattern adoption.** If the pattern library says authentication works one way and a feature implements it differently, the difference is a finding — regardless of whether the different implementation is technically correct. Consistency across the codebase reduces the risk of subtle logic errors and makes the security posture auditable.

---

## Examples

### Example: Security review outcome — conditionally approved

**PR:** New account deletion endpoint (`DELETE /api/account`)

**Security Engineer review findings:**

*Authentication:* Verified. Endpoint requires authenticated session. Session validation uses the approved pattern.

*Authorization:* Finding — Conditionally Approved.

The endpoint accepts a `userId` parameter in the request body and deletes the account matching that ID. The implementation checks that the session is authenticated but does not verify that the `userId` in the request matches the authenticated user's session.

Required change before this PR can be merged: The endpoint must ignore the `userId` parameter from the request body and instead use the user ID from the authenticated session exclusively. A user must not be able to delete another account by specifying a different `userId`.

Verification: After the fix, confirm that a request using User A's session with User B's `userId` in the body results in User A's account being deleted (not User B's), or returns an error.

*Input handling:* Verified. No user input reaches a dangerous context.

*Secrets and sensitive data:* Verified. No sensitive data is logged. The deletion is irreversible — the endpoint should require a confirmation mechanism (not a security requirement, routing this as non-blocking feedback to the PM).

**Status:** Conditionally Approved — one required change documented above.

---

### Example: Security block with escalation to CTO

**Situation:** A new data export feature allows users to download their complete account history. During security review, the Security Engineer finds that the export endpoint generates a signed URL that is valid for 24 hours and does not require session authentication when accessed.

**Finding:**
The export URL is valid for 24 hours without requiring session authentication. If a user shares the URL (intentionally or accidentally), anyone with the URL can download that user's complete account history for 24 hours without being authenticated. This is an access control failure — access to user data should not be grantable without authentication.

**Mitigation options presented to CTO:**
1. Reduce URL validity to 5 minutes (limits exposure window but does not eliminate it)
2. Require session authentication on URL access (eliminates the risk; requires architecture change to the download flow)
3. Generate a one-time-use token that is invalidated after first download (eliminates reuse risk; requires token infrastructure)

**Status:** Blocked pending CTO decision on mitigation approach.

---

## Relationship to Company Doctrine

- **Organization:** The Security Engineer sits within the Engineering department and reports directly to the CTO. The role holds cross-cutting authority over all engineering work that introduces security-relevant behavior. This reporting line reflects that security posture is a company-level decision, not a sprint-level decision.
- **Reporting Structure:** Direction on security strategy and risk acceptance comes from the CTO. Technical standards are owned by the Security Engineer and documented for all engineers to implement.
- **Responsibility Matrix:** The Security Engineer holds Responsible for security standards, review, and vulnerability response. The CTO holds Accountable. Backend, Frontend, Infrastructure, DevOps, AI Engineer, and Reviewer are Consulted as applicable. QA, Release Manager, and Tech Lead are Informed.
- **Employee Doctrine:** The Security Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence.
