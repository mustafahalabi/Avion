# Dependency Choice Decision Framework — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** Tech Lead  
**Last Updated:** 2026-06-29  

This document is the repeatable decision logic the Engineering department applies before adopting an **external dependency** — a library, package, SDK, API, platform, or service the company does not own but commits to relying on. It defines how the company evaluates a candidate, what it must inspect before adoption, who is allowed to approve it, what risk it must record, and the conditions under which a dependency must be refused outright.

This framework is a specialization, not a new authority. The [Decision System](../systems/DECISION_SYSTEM.md) defines how *any* decision moves through the company — its lifecycle, owners, approvers, reasoning format, and memory rules. This document supplies the **dependency-specific evaluation logic** that the Decision System refers to as "the department decision framework." Where the two overlap, the Decision System governs the process and this document governs the judgment.

This framework is implementation-neutral and provider-neutral. It does not endorse a package manager, a registry, a vendor, or a license. It defines the questions that must be answered and the thresholds that determine the outcome — the answers are filled in by the candidate under review. A decision made with this framework is recorded against the [Domain Model](../architecture/DOMAIN_MODEL.md) objects (Decision, Decision Record, Risk, Memory) and, when structural, written as an [ADR](../adr/ADR-001-execution-runtime-and-memory-retrieval.md).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Relationship to the Decision System and Sibling Frameworks](#3-relationship-to-the-decision-system-and-sibling-frameworks)
4. [The Dependency Evaluation Loop](#4-the-dependency-evaluation-loop)
5. [Evaluation Criteria](#5-evaluation-criteria)
6. [Maintenance Signals](#6-maintenance-signals)
7. [Security Signals](#7-security-signals)
8. [License Considerations](#8-license-considerations)
9. [Risk Scoring](#9-risk-scoring)
10. [Authority — Who Decides](#10-authority--who-decides)
11. [Approval Triggers](#11-approval-triggers)
12. [When a Dependency Should Not Be Used](#12-when-a-dependency-should-not-be-used)
13. [Output Format — the Dependency Decision Record](#13-output-format--the-dependency-decision-record)
14. [Worked Examples](#14-worked-examples)
15. [Anti-Patterns](#15-anti-patterns)
16. [Relationship to Other Documents](#16-relationship-to-other-documents)

---

## 1. Purpose

Every dependency is a permanent liability the company takes on in exchange for a temporary convenience. The code arrives free; the ownership does not. From the moment a package enters the dependency tree, the company inherits its bugs, its vulnerabilities, its license, its release cadence, its maintainer's attention span, and its eventual abandonment. A dependency is rarely "just a library" — it is a long-term commitment that future engineers cannot easily reverse once code depends on its API.

This framework exists so that adopting a dependency is a **repeatable, defensible, and remembered** decision rather than an `npm install` made under deadline pressure. It gives Engineering, the Tech Lead, the Security Engineer, the CTO, and DevOps a shared method so that two engineers facing the same choice with the same context reason in the same order, inspect the same signals, and reach a decision they can all defend.

The framework has four jobs:

1. **Evaluate.** Examine a candidate against fixed criteria and real signals — maintenance, security, license, fit — instead of popularity or familiarity.
2. **Decide.** Produce one of a fixed set of outcomes — Adopt, Adopt with Conditions, Reject, or Escalate — using stated thresholds, not intuition.
3. **Route.** Send the decision to the authority entitled to make it, and escalate structural or high-risk adoptions instead of absorbing them silently.
4. **Record.** Produce a written Dependency Decision Record so the company remembers why a dependency was adopted, what risk it carries, and what it was chosen over.

This aligns directly with the [Company Playbook](../company/COMPANY_PLAYBOOK.md): *Simplicity wins; complexity must justify itself. Every action should reduce future work. Long-term quality beats short-term speed.* A dependency that fails those tests is a tax on every future engineer, not a shortcut.

---

## 2. Scope

**In scope.** Any external code or service the company commits to relying on:

- **Libraries and packages** — anything added to the dependency manifest (runtime, build, or development), including transitive dependencies a direct dependency drags in.
- **SDKs and clients** — vendor-provided code that couples the company to a provider's API surface.
- **External APIs and platforms** — hosted services the running system calls (payment, email, auth, storage, AI inference, observability).
- **Build, CI, and infrastructure tooling** — actions, plugins, base images, and runners that execute with access to source or secrets.
- **Replacing or upgrading a major dependency** — a major-version bump or a swap from one provider to another is a dependency decision, not a routine edit.

**Out of scope.** Choices with no external-ownership consequence:

- Pinning a patch version of an already-approved dependency, or a routine lockfile update produced by the approved upgrade process.
- Choosing between two modules *within* an already-adopted library.
- Internal utilities the company writes and owns, which are governed by the [Architecture Decision Framework](./ARCHITECTURE_DECISION_FRAMEWORK.md), not this one.

The dividing line is the same one the [Decision System §2](../systems/DECISION_SYSTEM.md#2-scope) draws: **consequence and reversibility**. If a choice adds code or a service the company does not own, couples future work to an external API, or expands the trust or license surface, it is a dependency decision and this framework applies. When in doubt whether a candidate is in scope, treat it as in scope and run the [evaluation loop](#4-the-dependency-evaluation-loop) — the cost of an unnecessary evaluation is minutes; the cost of a missed one is a CVE, a license violation, or a rewrite.

---

## 3. Relationship to the Decision System and Sibling Frameworks

This framework does not restate the Decision System. It plugs into it, and it borrows the security thresholds and architecture judgment that two sibling frameworks already own. The mapping is exact:

| Concern | Owned by | Reference |
|---|---|---|
| Decision lifecycle (identified → framed → evaluated → decided → recorded → remembered) | Decision System | [§4](../systems/DECISION_SYSTEM.md#4-decision-lifecycle) |
| Owner and approver assignment | Decision System | [§5](../systems/DECISION_SYSTEM.md#5-owners-and-approvers) |
| Required reasoning format (Recommendation → Reasoning → Risks → Alternatives → Confidence → Next action) | Decision System | [§8](../systems/DECISION_SYSTEM.md#8-required-reasoning-format) |
| Decision record fields and immutability | Decision System | [§9](../systems/DECISION_SYSTEM.md#9-decision-record-format) |
| Memory update and supersession rules | Decision System | [§13](../systems/DECISION_SYSTEM.md#13-memory-updates) |
| **Security thresholds for a dependency's supply-chain risk** | [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md) | §7 below defers to it |
| **Whether adopting a dependency changes the architecture** | [Architecture Decision Framework](./ARCHITECTURE_DECISION_FRAMEWORK.md) | §11 below defers to it |
| **Long-term ownership cost of carrying a dependency** | [Technical Debt Decision Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md) | §9 below references it |
| **How to evaluate a dependency candidate** | **This framework** | §4–§9 |
| **Who decides, and when adoption must be approved** | **This framework** | §10–§11 |
| **When a dependency must be refused** | **This framework** | §12 |

In short: the Decision System tells you *that* a dependency decision must be framed, reasoned, owned, approved where required, recorded, and remembered. The Security and Architecture frameworks own the security and structural judgments. This framework tells you *how to evaluate the dependency itself* and *when to refuse it*.

---

## 4. The Dependency Evaluation Loop

Every adoption runs the same loop. The loop is deterministic: the same candidate with the same evidence produces the same outcome, regardless of who runs it or how close the deadline is.

1. **State the need.** What problem requires a dependency? What breaks if we build nothing? Name the specific capability — not "we need a date library," but "we need IANA-timezone-correct arithmetic the standard library cannot do safely."
2. **Consult memory first.** Has the company already adopted, rejected, or standardized on something for this need? Retrieval is mandatory ([Decision System §13](../systems/DECISION_SYSTEM.md#13-memory-updates)). Re-adopting where a standard exists, or re-litigating a prior rejection without new information, is a finding.
3. **Generate alternatives.** At minimum: the candidate, the closest already-approved dependency, and **build-it-ourselves / use the platform primitive**. "Add the dependency" with no alternative considered is a default in disguise (see [§15](#15-anti-patterns)).
4. **Evaluate each option** against the [criteria](#5-evaluation-criteria), the [maintenance signals](#6-maintenance-signals), the [security signals](#7-security-signals), and the [license](#8-license-considerations). Stop an option the moment it hits a [red line](#12-when-a-dependency-should-not-be-used).
5. **Score the risk** of the leading option using [§9](#9-risk-scoring), and write down its mitigation and owner.
6. **Route to the right authority** ([§10](#10-authority--who-decides), [§11](#11-approval-triggers)) and obtain approval where required.
7. **Record** the [Dependency Decision Record](#13-output-format--the-dependency-decision-record) and store it with the work item and in company memory.

The loop never terminates at "it has a lot of stars" or "I've used it before." It terminates at a recorded outcome with a named owner and a documented risk.

---

## 5. Evaluation Criteria

Every candidate is evaluated against seven criteria. These are not a scorecard to be averaged — they are dimensions every option must be examined on, in priority order. An option that is strong on six and fatal on one is not a strong option.

| # | Criterion | The question it answers | What "good" looks like |
|---|---|---|---|
| 1 | **Necessity** | Do we actually need a dependency, or can the platform / a few lines of our own code do this? | The capability is genuinely non-trivial, error-prone to build, or outside the team's domain — not a one-liner wrapped in a package. |
| 2 | **Security** | What is the blast radius if this code or service is compromised or malicious? | Small, auditable surface; runs with least privilege; no unexplained network, filesystem, or install-time behavior. (See [§7](#7-security-signals).) |
| 3 | **Maintenance health** | Is this actively maintained, and will it still be alive in five years? | Recent releases, responsive maintainers, real community, healthy bus factor. (See [§6](#6-maintenance-signals).) |
| 4 | **License compatibility** | Can the company legally use this for its purpose? | A permissive, known license compatible with the company's distribution model. (See [§8](#8-license-considerations).) |
| 5 | **Fit and footprint** | Does it solve our problem without dragging in far more than we need? | Solves the actual need; proportionate transitive tree and install size; no large unused surface. |
| 6 | **Replaceability** | If this fails us, how hard is it to remove? | A narrow, well-isolated integration surface; the company is not structurally married to the API. |
| 7 | **Long-term cost** | What does it cost to own — upgrades, breaking changes, audits — over five years? | Predictable upgrade path; stable API; the carrying cost is justified by the value. (Feeds the [Technical Debt Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md).) |

**Priority order.** Inherited from the [Company Playbook](../company/COMPANY_PLAYBOOK.md) and specialized for dependencies:

```
User Value
   ↓
Necessity & Security      (an unneeded or unsafe dependency has negative value)
   ↓
Maintenance & License     (a dead or legally incompatible dependency is disqualified)
   ↓
Fit & Replaceability      (the cost paid by every future engineer)
   ↓
Long-term cost
   ↓
Delivery Speed            (never overrides the criteria above)
```

A higher criterion is only traded for a lower one when the higher one is genuinely satisfied, never to rescue a lower one. The first criterion — **necessity** — is deliberately first: the cheapest, safest, most maintainable dependency is the one not added. *Complexity must justify itself.*

---

## 6. Maintenance Signals

A dependency's future is owned by people the company does not employ. Before adopting, the evaluator inspects whether those people are present and active. These are signals, not a single pass/fail number — a strong project may be weak on one and healthy overall, but several weak signals together are a finding.

| Signal | Healthy | Warning | Disqualifying |
|---|---|---|---|
| **Release recency** | Released within the last ~6 months; predictable cadence | No release in 12+ months | No release in 2+ years with open security issues |
| **Maintainer activity** | Issues and PRs triaged; recent commits by maintainers | Slow response; backlog growing | Maintainer publicly stepped away; no active maintainer |
| **Bus factor** | Multiple active maintainers or a backing organization | A single maintainer carries the project | A single maintainer who is unresponsive |
| **Issue health** | Bugs acknowledged and resolved; security issues handled promptly | Long-lived unaddressed bug reports | Reported, unpatched security issues |
| **Adoption** | Real, broad usage by credible projects | Niche or declining usage | Effectively unused / superseded by a maintained fork |
| **Breaking-change discipline** | Honors semantic versioning; documents migrations | Breaking changes in minor releases | No versioning discipline; surprises on every upgrade |
| **Documentation** | Clear docs, changelog, and upgrade notes | Sparse docs; stale changelog | None — the source is the only documentation |

**Bus factor and abandonment are weighted heaviest.** A library maintained by one person who has lost interest is a future emergency: the day a CVE lands against it, the company owns the patch. Prefer dependencies with institutional backing or several active maintainers for anything structural. An **unmaintained dependency in a security-relevant category is a red line** — see [§12](#12-when-a-dependency-should-not-be-used).

---

## 7. Security Signals

A dependency is code the company runs with its own privileges, and an external service is a new trust boundary. Both are supply-chain risk. This framework does not re-derive security thresholds — it defers to the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md), whose category 6, *Dependencies & supply chain*, carries a baseline severity ceiling of **High → Critical**. Every dependency that touches a [security risk category](./SECURITY_DECISION_FRAMEWORK.md#5-risk-categories) is run through that framework's [decision loop](./SECURITY_DECISION_FRAMEWORK.md#4-the-decision-loop), and the **Security Engineer holds blocking authority** over the result.

The dependency-specific signals the evaluator must inspect:

- **Known vulnerabilities.** Does the candidate, or anything in its transitive tree, have unresolved advisories? An unpatched vulnerability in a path the company will actually exercise is disqualifying until resolved or provably unreachable.
- **Install-time behavior.** Does the package run scripts on install, fetch remote code, or phone home? Unexplained install-time execution is treated as hostile until justified.
- **Privilege and surface.** What does the code need access to — network, filesystem, environment, secrets? Least privilege applies: a string-formatting library that wants network access is a finding.
- **Secret handling.** For SDKs and external APIs: where do credentials live, and does the integration force a secret into source or logs? Secrets must come from a managed store, never the repository — and `.env*` files, lockfiles, and CI secrets are protected by the [GitHub Workflow Foundation](../architecture/GITHUB_WORKFLOW_FOUNDATION.md) guardrails the worker enforces.
- **Transitive trust.** A direct dependency inherits the trust of everything it pulls in. A small, clean package that drags in a large or dubious transitive tree carries that tree's risk, not its own.
- **Provenance.** Is the package published from a verifiable source by a recognized publisher, or is it a typo-squat / look-alike of a well-known name? Name and publisher are verified before install.

**Default deny.** When the evaluator cannot establish that a security property holds, the answer is Reject, not Adopt. Absence of evidence is treated as absence of the control, exactly as in [Security Decision Framework §3](./SECURITY_DECISION_FRAMEWORK.md#3-core-principles).

---

## 8. License Considerations

A license is a binding legal constraint the company accepts permanently the moment it ships the dependency. License review is **non-optional** and happens before adoption, not at release. The evaluator establishes the license of the candidate **and** of its transitive tree — a permissive package that depends on a copyleft one inherits the obligation.

| License class | Examples (illustrative) | Default disposition |
|---|---|---|
| **Permissive** | MIT, BSD, Apache-2.0, ISC | Allowed. Apache-2.0 patent grant is preferred for larger dependencies. |
| **Weak copyleft** | MPL-2.0, LGPL | Allowed with care — obligations are file- or linkage-scoped; the integration must respect them. **Tech Lead reviews; CTO approves** if the boundary is unclear. |
| **Strong copyleft** | GPL, AGPL | **Requires CTO approval and a documented reason.** AGPL in a hosted service can impose source-disclosure obligations on the whole service and is refused by default. |
| **Source-available / non-OSI** | BSL, SSPL, "fair source," custom | **Requires CTO approval.** Field-of-use and commercial restrictions are read in full; expiry/conversion terms are recorded. |
| **No license / unclear** | No `LICENSE` file; conflicting statements | **Red line — not adopted.** Unlicensed code is "all rights reserved"; using it is infringement. |

**Rules:**

- **No license means no adoption.** Absence of an explicit license is not permission — it is the opposite.
- **Attribution and notice obligations are honored.** A permissive license that requires preserving copyright notices is satisfied, not ignored.
- **The transitive tree is in scope.** The most restrictive license anywhere in the dependency path governs the obligation.
- **License changes are watched.** A dependency that relicenses on a future version (a common pattern) is re-evaluated at that version, not auto-upgraded.

When a license is anything other than clearly permissive, the disposition is recorded in the [Dependency Decision Record](#13-output-format--the-dependency-decision-record) with the obligation the company accepted.

---

## 9. Risk Scoring

Risk is a first-class part of every dependency decision, not a closing caveat. **The acceptance criteria of this framework require that every adopted dependency carries a documented risk.** This framework uses the company's standard risk attributes — **severity**, **description**, **mitigation**, **owner role** — defined in [Decision System §11](../systems/DECISION_SYSTEM.md#11-risk-notes), and scores each candidate so the decision-maker and approver agree on how serious the exposure is before adoption.

### Scoring an individual dependency

Each candidate is scored on two axes:

| Axis | Levels | Meaning |
|---|---|---|
| **Likelihood** | low / medium / high | How probable is it that this dependency becomes a problem — abandonment, a CVE, a breaking change, a license shift — under realistic conditions? |
| **Impact** | low / medium / high / critical | If it does, how bad is the consequence to correctness, security, legal exposure, or the ability to deliver? |

Impact is anchored by the dependency's role: a build-time formatter is rarely above medium impact; a library on the authentication path or in the request hot path can be critical.

The two combine into a single **severity** that drives the response:

| Severity | Typical combination | Required response |
|---|---|---|
| **Low** | low impact, any likelihood | Note the dependency and its license in the record; no mitigation required. |
| **Medium** | medium impact; or high-likelihood low-impact | Document an explicit mitigation (e.g., isolation behind an interface) and an owner role. |
| **High** | high impact, medium+ likelihood; or any **critical**-impact dependency | Mitigation is mandatory **and** adoption is a separate, recorded approval — see [§11](#11-approval-triggers). A security-relevant high-severity risk is a [security exception](./SECURITY_DECISION_FRAMEWORK.md#11-approval-triggers-and-escalation-paths). |

### Risk acceptance is its own decision

Adopting a high-severity dependency is never silent and never bundled invisibly into a feature change. Per [Decision System §11](../systems/DECISION_SYSTEM.md#11-risk-notes):

- **Technical risk** (abandonment, breaking changes, footprint) is accepted by the **CTO**.
- **Security / supply-chain risk** that crosses a trust boundary is a security exception held by the **Security Engineer**, proceeding only on a CTO-authorized, recorded exception.
- **Legal / license risk** beyond clearly permissive is accepted by the **CTO**, and a business-level license risk is framed by the CTO and accepted by the **CEO**.

The carrying cost of an adopted dependency — the upgrades, audits, and eventual removal it commits the company to — is also recorded as ongoing [technical debt](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md) so it is tracked rather than forgotten.

---

## 10. Authority — Who Decides

Dependency decisions are **owned by the Tech Lead**, but several roles hold mandatory input or a veto. Drawing the line precisely prevents both failure modes: an engineer adding a structural dependency alone, and a Tech Lead escalating every dev-tooling bump. The Linear deliverable's required perspectives — CTO, Tech Lead, Security, Engineering, DevOps — map to authority as follows.

| Decision character | Owner (frames + proposes) | Authority to decide | Recorded as |
|---|---|---|---|
| **A small, reversible, dev/build-only dependency** — clearly permissive license, healthy maintenance, no new trust boundary | Engineer | **Tech Lead decides** (or pre-approved from a standing allowlist) | Memory record (category `decision`) |
| **A runtime dependency local to one module**, reversible, no security category touched | Engineer | **Tech Lead decides**, records the rationale and risk | Memory record |
| **A new structural / cross-cutting dependency** — relied on by many modules, hard to remove, or that sets a convention | Tech Lead | **CTO approves** | Decision record / [ADR](../adr/ADR-001-execution-runtime-and-memory-retrieval.md) |
| **Anything touching a [security risk category](./SECURITY_DECISION_FRAMEWORK.md#5-risk-categories)** — auth, secrets, crypto, data handling, or a new external trust boundary | Tech Lead frames; **Security Engineer evaluates** | **CTO approves on Security Engineer input** | Decision record + security exception |
| **A non-permissive or unclear license** | Tech Lead frames | **CTO approves** (business-level → CEO) | Decision record + license note |
| **An external API / platform with operational and cost commitments** | Tech Lead frames; **DevOps assesses** operability, SLOs, runtime cost | **CTO approves** | Decision record / ADR + [Integration](../architecture/DOMAIN_MODEL.md#integration) |
| **Any option requiring acceptance of a high-severity risk** | Tech Lead | **CTO approves** (acceptance is the CTO's per [§9](#9-risk-scoring)) | Decision record + risk record |

**Role lenses.** Each role examines a candidate through its own concern:

- **Engineering** establishes *necessity and fit* — is the dependency needed, does it solve the real problem, is the integration surface narrow?
- **Tech Lead** owns the decision — weighs the criteria, ensures alternatives were considered, decides within bounds, and frames escalations.
- **Security Engineer** owns the *supply-chain and trust-boundary* verdict and holds a blocking veto on security grounds ([Security Decision Framework §10](./SECURITY_DECISION_FRAMEWORK.md#10-authority-who-decides)).
- **CTO** approves structural, high-risk, and non-permissive-license adoptions, and accepts technical risk.
- **DevOps** owns *operability and runtime cost* for external services — availability, rate limits, failure modes, credential rotation, and what an outage of the provider does to the company's product.

**The CEO is never asked to choose between libraries.** Dependency decisions reach the CEO only as *outcomes* — a license obligation that affects the business, a platform commitment with material cost, or a supply-chain risk accepted at the business level. The CEO sees "this provider locks us in and costs $X/month," never "adopt package A versus package B." See [Decision System §14](../systems/DECISION_SYSTEM.md#14-relationship-to-roles).

---

## 11. Approval Triggers

Some adoptions require approval **regardless of autonomy level** because they cross a mandatory gate. Raising the company's autonomy does not waive them. These restate, for dependencies, the mandatory gates in [Decision System §6](../systems/DECISION_SYSTEM.md#6-which-decisions-require-approval).

**Always requires CTO approval, at any autonomy level:**

- Introducing a **new structural dependency** relied on across modules, or one that is hard to remove.
- Adopting anything that touches a **security risk category** or opens a new trust boundary (Security Engineer evaluates first).
- Adopting a dependency with a **non-permissive or unclear license** (strong copyleft, source-available, or no license).
- Adopting an **external API or platform** the running system depends on (DevOps assesses operability and cost).
- Accepting a **high-severity dependency risk** to make an option viable.

**Requires CEO involvement (framed by the CTO):**

- A dependency or platform commitment that materially changes the **cost, timeline, or vendor lock-in** of an outcome the CEO submitted, surfaced as a business trade.
- Acceptance of a **business or legal risk** created by a license or provider choice.

**Stays with the Tech Lead (no approval gate):**

- Reversible, module-local, clearly permissive dependencies with healthy maintenance and no security category touched.
- Dev/build-only tooling from a standing, Tech-Lead-maintained allowlist.

A useful rule: **if removing the dependency later would touch more than one module, or if it runs with access to secrets or user data, assume it needs CTO approval until shown otherwise.**

Note the distinction from execution authorizations: the autonomy policy that gates *agentic actions* (running the agent, pushing, opening a PR, merging) is enforced in code and described in [Decision System §7](../systems/DECISION_SYSTEM.md#7-autonomy-and-the-approval-gate) and the [Approval System](../systems/APPROVAL_SYSTEM.md). This section governs the *human adoption decision*, which is a documented practice. The two meet in one place worth noting: lockfiles and `prisma/migrations/**` are protected paths the worker's guardrails will not let an agent touch, so a dependency change that edits a manifest is, by design, a human-reviewed decision rather than an autonomous one.

---

## 12. When a Dependency Should Not Be Used

The acceptance criteria require this framework to define when a dependency must be **refused**. The following are red lines. A candidate that hits any one of them is rejected regardless of how convenient it is — the convenience does not survive the liability.

- **No license, or an unclear/conflicting license.** Unlicensed code is "all rights reserved." There is no version of this that is acceptable.
- **A license incompatible with the company's distribution model** that the CTO has not approved with a documented obligation (e.g., AGPL in a hosted service by default).
- **Unmaintained in a consequential role.** No release in years, an absent maintainer, and the dependency sits on the security or correctness path. The company would own the next CVE with no upstream to fix it.
- **An unresolved, reachable security vulnerability** in the candidate or its transitive tree, with no patch and no provable way to avoid the vulnerable path.
- **Unexplained or hostile behavior** — install-time scripts that fetch remote code, undocumented network calls, or obfuscated source. Treated as malicious until proven otherwise.
- **Provenance failure** — a typo-squat or look-alike of a well-known package, or a package whose publisher cannot be verified.
- **The need does not justify a dependency at all** — the capability is a few lines of code the company can own and test itself, or a platform primitive already exists. Adding a package here is a *negative*: it trades owned, auditable code for unowned supply-chain risk. ("Left-pad" cases.)
- **Disproportionate footprint** — a large transitive tree or heavy install brought in to use a sliver of functionality, where a smaller dependency or local code achieves the same.
- **Redundancy** — the company already has an approved dependency or standard for this need, and the candidate adds a second way to do the same thing with no justified advantage. *Consistency beats novelty.*

When a candidate is refused, the **rejection is recorded in memory with its reason** ([Decision System §13](../systems/DECISION_SYSTEM.md#13-memory-updates)) so the same dependency is not re-proposed later without new information. A rejection is as much a decision of record as an adoption.

---

## 13. Output Format — the Dependency Decision Record

Every dependency decision — adoption *or* rejection — produces a written record. For routine, in-bounds adoptions this is a memory record (category `decision`); for structural adoptions it is a [Decision Record](../systems/DECISION_SYSTEM.md#9-decision-record-format) or an [ADR](../adr/ADR-001-execution-runtime-and-memory-retrieval.md). Both use the same field set.

### The Dependency Decision Record

| Field | Content |
|---|---|
| **Title** | The dependency and the decision (e.g., "Adopt `<library>` for timezone-correct date arithmetic"). |
| **Status** | `adopted`, `adopted with conditions`, `rejected`, `superseded`, or `reversed`. |
| **Owner / Approver** | Tech Lead (owner); CTO when approval was required; Security Engineer when a security category was touched; DevOps when an external service. |
| **Date** | When the decision was made. |
| **Need / Forces** | The capability required and why it justifies an external dependency. What breaks if we build nothing. |
| **Candidate** | Name, version, source/registry, publisher, and link. |
| **Alternatives considered** | The other genuine options — including **build-it-ourselves** and the closest approved dependency — and the specific reason each was rejected. |
| **Criteria evaluation** | How the chosen option scores against the seven criteria ([§5](#5-evaluation-criteria)) in priority order. |
| **Maintenance assessment** | The [maintenance signals](#6-maintenance-signals) inspected and the verdict. |
| **Security assessment** | The [security signals](#7-security-signals) inspected; the Security Decision Framework outcome if a category was touched. |
| **License** | The license of the dependency **and** its transitive tree, and any obligation the company accepts. |
| **Risk** | Severity, description, mitigation, and owner role ([§9](#9-risk-scoring)). High-severity risks show who accepted them. **Mandatory — no record without it.** |
| **Conditions** | For "adopted with conditions" — what must be true (e.g., isolated behind an interface, pinned, scheduled for re-evaluation). |
| **Consequences** | What this constrains or enables, and the ongoing carrying cost recorded as [technical debt](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md). |
| **Supersedes / Superseded by** | Links to prior or subsequent decisions, when applicable. |

**Format rules** (inherited from [Decision System §9](../systems/DECISION_SYSTEM.md#9-decision-record-format)):

- **Plain language.** Understandable by any employee, not only the author. *Documentation is engineering.*
- **Immutable in intent.** A record is never edited to change the decision; a new record supersedes it and links back.
- **Self-contained.** A future engineer understands the adoption — and why the alternatives lost — without reconstructing the conversation.
- **Written to memory.** Every record, adoption or rejection, is stored so future work references it instead of re-deriving or contradicting it.

---

## 14. Worked Examples

These examples show the framework applied end to end. They are illustrative reasoning, not records of specific shipped decisions.

### Example A — A decision the Tech Lead makes alone

**Situation.** A feature needs to parse and format human-readable byte sizes. An engineer proposes a tiny, well-known utility.

**Loop.** Need: a minor formatting nicety. Memory: nothing standardized. Alternatives: the package, or ~15 lines of owned code. Criteria: necessity is *low* — this is genuinely a few lines. Building it ourselves wins on necessity, replaceability, and footprint; the dependency adds supply-chain surface for no real saving.

**Outcome.** **Reject the dependency, build it ourselves** ([§12](#12-when-a-dependency-should-not-be-used), "the need does not justify a dependency"). Tech Lead decides; a short memory record captures the rejection so it is not re-proposed.

### Example B — A decision the CTO must approve

**Situation.** Several modules need durable background job processing. The Tech Lead proposes a widely used queue library that many modules will depend on.

**Loop.** Need: real and recurring. Memory: no existing standard. Alternatives: the library, a hand-rolled queue, or the DB-backed pattern already in the codebase. Criteria: necessity high; maintenance healthy (multiple maintainers, recent releases); license permissive; but **replaceability is low** — many modules will couple to its API, and it is a structural, cross-cutting commitment.

**Risk.** Lock-in to the library's API — medium impact, medium likelihood; mitigated by wrapping it behind a company-owned interface. Owner role: Tech Lead.

**Outcome.** Structural and cross-cutting → **CTO approves**, recorded as an [ADR](../adr/ADR-001-execution-runtime-and-memory-retrieval.md). The Tech Lead frames a recommendation in the [required reasoning format](../systems/DECISION_SYSTEM.md#8-required-reasoning-format).

### Example C — A decision that involves Security, DevOps, and the CEO

**Situation.** A feature needs to send transactional email. The Tech Lead proposes adopting a hosted email provider's SDK and API.

**Loop.** Need: real. This is an **external platform** (new trust boundary), an **SDK** (supply-chain), it handles **personal data** (a security category), and it carries **runtime cost and an SLA** (operability).

- **Security Engineer** runs the [Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md): API key must come from a managed secret store, recipient data minimized and not logged. Conditionally approves subject to those controls.
- **DevOps** assesses operability: rate limits, failure mode if the provider is down, credential rotation, and monthly cost at expected volume.
- **License** of the SDK is permissive; the *service* terms are recorded.

**Outcome.** External platform with security and cost commitments → **CTO approves on Security and DevOps input**. Because the provider introduces ongoing cost and a degree of lock-in to an outcome the CEO submitted, the CTO frames the *business trade* — "this provider, this cost, this dependency" — for the **CEO**, who is never shown the SDK comparison. Recorded as a Decision Record plus an [Integration](../architecture/DOMAIN_MODEL.md#integration), with the supply-chain risk and the accepted controls.

---

## 15. Anti-Patterns

Each anti-pattern is a recurring way dependency decisions go wrong. They specialize the failure modes in [Decision System §16](../systems/DECISION_SYSTEM.md#16-failure-modes).

### `npm install`-driven development
A dependency is added the instant a problem appears, with no evaluation. **Caught when:** the manifest grows in a feature PR with no decision record. **Response:** every adoption runs the [loop](#4-the-dependency-evaluation-loop); an unevaluated dependency is a recorded finding in review.

### Popularity as proof
A dependency is justified by stars, downloads, or "everyone uses it." **Caught when:** the reasoning cites popularity instead of the criteria. **Response:** popularity is one *maintenance signal* among many, not a security, license, or fit verdict. Widely used packages still get abandoned, compromised, and relicensed.

### The dependency with no alternative
A package is presented as the only option, with no "build it ourselves" considered. **Caught when:** the record's alternatives section is empty. **Response:** a decision without alternatives — including the status quo and owning the code — is a default and is returned to the owner ([Decision System §10](../systems/DECISION_SYSTEM.md#10-alternatives)).

### Trivial dependency
A package is added to do something the standard library or a few lines already do. **Caught when:** the necessity criterion is *low* and the integration is larger than the code it replaces. **Response:** owning a small amount of auditable code beats inheriting supply-chain risk ([§12](#12-when-a-dependency-should-not-be-used)).

### License blindness
A dependency ships without anyone reading its license or its transitive tree's licenses. **Caught when:** the record has no license field, or a copyleft license sits unnoticed in the tree. **Response:** license review is non-optional and precedes adoption ([§8](#8-license-considerations)).

### Ignoring the transitive tree
A small, clean direct dependency is approved while the dozens of packages it pulls in are never inspected. **Caught when:** a vulnerability or restrictive license is found in a transitive package post-adoption. **Response:** the trust, license, and footprint of the whole tree are evaluated, not just the top-level name ([§7](#7-security-signals), [§8](#8-license-considerations)).

### Adopting the abandoned
A dependency that has not shipped in years is adopted because it "still works." **Caught when:** the maintenance signals are weak and no one owns the upgrade path. **Response:** abandonment in a consequential role is a red line; the company would own the next CVE alone ([§6](#6-maintenance-signals)).

### Silent lock-in
An external SDK is wired directly into many modules with no isolating interface, marrying the company to a vendor. **Caught when:** replaceability is low and removal would touch the whole codebase. **Response:** structural dependencies are isolated behind an owned interface and approved by the CTO ([§10](#10-authority--who-decides)).

### Re-litigating a rejection
A previously rejected dependency is proposed again with no new information. **Caught when:** no one consulted the recorded rejection. **Response:** retrieval before deciding is mandatory ([§4](#4-the-dependency-evaluation-loop)); reversing a rejection is legitimate only with new conditions, and it supersedes the original record rather than ignoring it.

---

## 16. Relationship to Other Documents

- **[Decision System](../systems/DECISION_SYSTEM.md)** — the governing process for all decisions: lifecycle, owners and approvers, reasoning format, record format, risk notes, and memory. This framework is the dependency-specific *judgment* it refers to as "the department decision framework."
- **[Security Decision Framework](./SECURITY_DECISION_FRAMEWORK.md)** — owns the supply-chain and trust-boundary thresholds this framework defers to for any security-relevant dependency; the Security Engineer's blocking authority applies here.
- **[Architecture Decision Framework](./ARCHITECTURE_DECISION_FRAMEWORK.md)** — owns the judgment for whether adopting a dependency changes the architecture; a structural dependency is also an architecture decision.
- **[Technical Debt Decision Framework](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md)** — the carrying cost of every adopted dependency (upgrades, audits, eventual removal) is tracked as debt through that framework.
- **[Company Playbook](../company/COMPANY_PLAYBOOK.md)** — the values this framework operationalizes: *Simplicity wins; consistency beats novelty; every action should reduce future work; documentation is engineering.*
- **[Domain Model](../architecture/DOMAIN_MODEL.md)** — defines the Decision, Decision Record, Risk, Memory, and Integration objects a dependency decision is recorded against.
- **[GitHub Workflow Foundation](../architecture/GITHUB_WORKFLOW_FOUNDATION.md)** — defines the protected paths (lockfiles, `prisma/migrations/**`, `.env*`) that make manifest changes a human-reviewed decision rather than an autonomous one.
- **[Approval System](../systems/APPROVAL_SYSTEM.md)** — defines how the platform pauses for a human at sub-threshold autonomy, the runtime counterpart to this framework's approval triggers.
- **Engineering OS Specification v1.0** (planned) — will formalize the decision model and unlock AI-assisted dependency evaluation; until then this framework is the authoritative method, applied by Engineering, the Tech Lead, Security, DevOps, and the CTO.
