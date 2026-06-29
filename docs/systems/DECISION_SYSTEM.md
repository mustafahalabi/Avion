# Decision System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

This document defines the Decision System: how the virtual company records, evaluates, approves, communicates, and remembers important decisions. A decision is any choice the company makes that constrains future work, accepts risk, or changes scope, architecture, or what reaches production.

The Decision System is the connective tissue between the [Company Runtime](../architecture/COMPANY_RUNTIME.md), the organizational decision framework, and the company's memory. It does not invent new behavior — it specifies how decisions move through the company so that no significant choice is made silently, no required approval is skipped, and every decision the company makes becomes durable knowledge the company can reference later.

This document describes company behavior and the records that behavior produces. It does not describe prompts, models, or implementation internals. Where a behavior is already enforced in software, this document says so explicitly and separates it from behavior that is designed but not yet built.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Decision Types](#3-decision-types)
4. [Decision Lifecycle](#4-decision-lifecycle)
5. [Owners and Approvers](#5-owners-and-approvers)
6. [Which Decisions Require Approval](#6-which-decisions-require-approval)
7. [Autonomy and the Approval Gate](#7-autonomy-and-the-approval-gate)
8. [Required Reasoning Format](#8-required-reasoning-format)
9. [Decision Record Format](#9-decision-record-format)
10. [Alternatives](#10-alternatives)
11. [Risk Notes](#11-risk-notes)
12. [Communicating Decisions](#12-communicating-decisions)
13. [Memory Updates](#13-memory-updates)
14. [Relationship to Roles](#14-relationship-to-roles)
15. [What Engineering OS Implements Today](#15-what-engineering-os-implements-today)
16. [Failure Modes](#16-failure-modes)
17. [Relationship to Other Documents](#17-relationship-to-other-documents)

---

## 1. Purpose

Every engineering organization makes decisions constantly — about architecture, scope, risk, security, and what ships. In a human company most of these decisions are made in conversation and lost. Engineering OS exists to make the company smarter over time, and that is only possible if decisions are first-class objects: recorded, attributed, reasoned, and remembered.

The Decision System has four responsibilities:

1. **Record** — every significant decision becomes a durable record. A decision that is not recorded did not happen from the company's perspective.
2. **Evaluate and approve** — decisions are made by the authority that owns them, and decisions that exceed an employee's authority are routed to the correct approver, including the CEO.
3. **Communicate** — decisions that affect the CEO or another employee are surfaced in plain organizational language, never as raw technical detail.
4. **Remember** — every decision feeds company memory, so future work references prior decisions instead of re-deriving or contradicting them.

The compounding value of Engineering OS depends on this. An employee who makes a choice that contradicts an existing decision has failed their responsibility. The Decision System is what makes "the company already knows this" true.

---

## 2. Scope

**In scope.** Decisions that constrain future work or carry organizational consequence:

- Architecture and system design choices
- Technical approach within an approved architecture
- Product scope (what is in, what is out, what is deferred)
- Risk acceptance (technical and business)
- Security exceptions to established policy
- Process deviations (e.g., overriding a quality gate)
- Authorization of agentic actions that touch real code — running an agent, pushing, opening a pull request, merging (see [Section 7](#7-autonomy-and-the-approval-gate))

**Out of scope.** Routine choices that are an employee's job to make and do not require a record:

- Variable names, file layout, and other local implementation details
- Test-case selection within an approved QA strategy
- Documentation structure
- Minor clarifications that do not change scope or acceptance criteria

The dividing line is consequence. If a choice changes what the company builds, what it ships, what risk it carries, or what a future employee must respect, it is a decision and belongs in this system. If it is reversible, local, and within an employee's domain, it is not.

---

## 3. Decision Types

The company classifies every decision into one of the following types. The type determines who decides, who approves, and where the decision is remembered.

| Type | Description | Examples |
|---|---|---|
| **Architecture** | A choice about system structure, technology selection, or design patterns that affects multiple modules and is costly to reverse. | Adopt a DB-backed runtime event queue; standardize on a provider-independent execution adapter. |
| **Technical approach** | How to implement within an already-approved architecture. | Which existing pattern to reuse for a feature; how to sequence backend and frontend work. |
| **Scope** | What a body of work will and will not include. | Defer a sub-feature to a later release; mark a capability out of scope. |
| **Risk acceptance** | A conscious decision to proceed despite a known risk. | Ship with a documented medium-severity limitation; accept a dependency that is behind on versions. |
| **Security exception** | A deviation from an established security policy or standard. | Permit an exception to a protected-path rule for a one-time migration (CTO-authorized). |
| **Process deviation** | Proceeding past a standard gate or out of the normal cadence. | Override a QA No-Go; run an unplanned hotfix release. |
| **Execution authorization** | Permission for an agent to perform an action that touches real code. | Approve running the agent, pushing a branch, opening a PR, or merging at a given autonomy level. |

Architecture, scope, risk, and security decisions are the ones most often escalated. Technical-approach decisions are the most common and are usually made and recorded by the Tech Lead without escalation. Execution authorizations are unique to Engineering OS: they are the decisions the platform itself enforces in code (see [Section 15](#15-what-engineering-os-implements-today)).

---

## 4. Decision Lifecycle

A decision moves through the following states. The lifecycle is the same regardless of type; only the owner, the approver, and the approval requirement change.

```
identified
  ↓ (an employee recognizes a choice with consequence)
framed
  ↓ (owner states the decision, gathers context and alternatives)
evaluated
  ↓ (owner applies the department decision framework)
   ├─ within authority ─────────────→ decided
   └─ exceeds authority ─→ escalated ─→ awaiting_approval
                                          ↓ (approver acts)
                                        decided  | rejected
decided
  ↓ (decision record written)
recorded
  ↓ (communicated to affected parties; memory updated)
remembered
```

**State definitions:**

| State | Meaning |
|---|---|
| `identified` | An employee has recognized that a choice with consequence exists. |
| `framed` | The owner has stated the decision, retrieved relevant memory and knowledge, and identified the alternatives. |
| `evaluated` | The owner has applied their department's decision framework and formed a recommendation. |
| `escalated` | The decision exceeds the owner's authority and has been routed to the correct approver with a recommendation. |
| `awaiting_approval` | The decision is paused pending an approver's action (often the CEO at an autonomy gate). |
| `decided` | The authority has chosen. The choice and its reasoning are settled. |
| `rejected` | The approver declined. The work returns to the owner with the rejection recorded. |
| `recorded` | The decision is written as a durable record. |
| `remembered` | The decision is in company memory and any affected parties are notified. |

A decision is never silently abandoned. A decision that is reversed later does not delete the original — it creates a new decision that supersedes it and links back, preserving the history. This mirrors the memory-supersession rule in the [Company Runtime](../architecture/COMPANY_RUNTIME.md#22-memory-updates).

---

## 5. Owners and Approvers

Every decision has exactly one owner — the employee accountable for framing and (where authorized) making it — and, when the decision exceeds the owner's authority, exactly one approver. Authority is the basis of resolution; decisions are settled by authority, not consensus.

| Decision type | Owner (proposes) | Approver |
|---|---|---|
| Architecture | Tech Lead | CTO |
| Technical approach (within architecture) | Tech Lead | — (Tech Lead decides) |
| Scope | Product Manager | CEO (if significant) |
| Risk acceptance — technical | CTO | — (CTO decides) |
| Risk acceptance — business | CTO (frames) | CEO |
| Security exception | Security Engineer (flags) | CTO |
| Process deviation — release | Release Manager | CTO |
| Quality-gate override (QA No-Go) | QA Engineer (issues No-Go) | CTO (CEO informed) |
| Execution authorization | Runtime (proposes via policy) | CEO (at the autonomy gate) |

**Ownership rules:**

- **One owner.** The employee who owns a decision remains accountable even when others contribute.
- **Escalate with a recommendation, never with a blank question.** An owner who lacks authority does not ask "what should we do?" — they present a recommendation in the required reasoning format ([Section 8](#8-required-reasoning-format)) and ask the approver to confirm or redirect.
- **Blocking authorities cannot be overridden at the employee level.** A Security hold and a QA No-Go stop the work. Only a CTO-level override proceeds past them, and the override is itself a recorded decision.
- **The CEO never chooses between technical options.** The CEO is presented with outcomes and approvals, not implementation alternatives. Decisions framed for the CEO are organizational, not technical.

Escalation paths follow the company reporting structure: Engineering → Tech Lead → CTO → CEO; Product → Product Manager → CTO → CEO; Operations → Release Manager → CTO → CEO; Security → Security Engineer → CTO → CEO. See [Company Runtime §17](../architecture/COMPANY_RUNTIME.md#17-escalation-rules).

---

## 6. Which Decisions Require Approval

A decision requires approval when it exceeds the owner's authority or crosses a mandatory gate. Two mechanisms determine this: **autonomy level** (which scales how much the company may do without the CEO) and **mandatory gates** (which always require approval regardless of autonomy).

**Mandatory approval — always, at any autonomy level:**

- A change to the system architecture beyond current bounds
- A request to override a QA No-Go (CTO authorizes; CEO is informed)
- A security exception to an established company policy
- A P0 production incident response posture (CEO is notified and kept informed)

**Autonomy-driven approval — scales with the company's trust setting:**

| Autonomy level | Routine approvals required |
|---|---|
| **Manual** | Every gate — plan, task list, review completion, QA Go, release. |
| **Suggest** | The company may prepare and propose freely; running, pushing, opening a PR, review/QA sign-off, and release stay gated. |
| **Assist** | Plan approval and release authorization; a confirmation gate before the agent runs. |
| **Delegate** | Release authorization (and merge); routine review/QA proceed. |
| **Autonomous** | No routine approvals; only mandatory gates (P0 incidents, security holds). |

The five autonomy levels are the company-wide [Trust Model](../architecture/COMPANY_RUNTIME.md#18-approval-requests). The Decision System's contribution is to make the gates concrete and enforceable for the one class of decision the platform executes itself: execution authorizations.

---

## 7. Autonomy and the Approval Gate

For execution-authorization decisions — the agentic actions that touch real code — the approval requirement is not advisory. It is computed by a single, shared policy that both the manual path (a CEO clicking a button) and the autonomous driver consult, so the two paths produce identical authorization decisions for the same inputs.

**The gated actions** are: create a session, run the agent, push a branch, open a pull request, auto-merge, auto-review, and auto-qa. Each action at each autonomy level resolves to one of three dispositions:

| Disposition | Meaning |
|---|---|
| `allow` | May proceed immediately, no checkpoint. |
| `requires_approval` | Permitted, but a CEO approval checkpoint must clear first. |
| `deny` | Never permitted at this level. |

The full action matrix (autonomy level × action → disposition) is enforced in code. Representative rows:

| Action | Manual | Suggest | Assist | Delegate | Autonomous |
|---|---|---|---|---|---|
| create_session | approval | allow | allow | allow | allow |
| run_agent | approval | approval | approval | allow | allow |
| push | approval | approval | allow | allow | allow |
| open_pr | approval | approval | allow | allow | allow |
| auto_merge | deny | deny | approval | approval | allow |
| auto_review | approval | approval | approval | allow | allow |
| auto_qa | approval | approval | approval | allow | allow |

When an action resolves to `requires_approval` and no approval is yet on record, the runtime raises an **approval checkpoint** — a paused decision the CEO must resolve — rather than proceeding. The checkpoint has a strict lifecycle: it is created `awaiting_approval`, and is then either `approved` or `rejected` exactly once; re-resolving a settled checkpoint is rejected. This is the execution-layer realization of the general lifecycle in [Section 4](#4-decision-lifecycle).

Guardrails are independent of this decision. Regardless of autonomy level or any approval, the agent may never push to a protected branch, touch protected paths (`.env*`, lockfiles, migrations, CI workflows, secrets), or force-push. Guardrails are not decisions to be approved — they are invariants. See the [GitHub Workflow Foundation](../architecture/GITHUB_WORKFLOW_FOUNDATION.md).

---

## 8. Required Reasoning Format

Every escalated decision and every approval request is communicated in the company's structured reasoning format. This format is mandatory because it forces the owner to think completely and lets the approver decide quickly.

| Element | Content |
|---|---|
| **Recommendation** | The single choice the owner recommends, stated plainly. |
| **Reasoning** | Why this recommendation, grounded in context, memory, and the department decision framework. |
| **Risks** | What could go wrong with the recommendation — and with the alternatives. |
| **Alternatives** | The other options considered and why they were not chosen. |
| **Confidence** | How certain the owner is (high / medium / low). |
| **Next action** | Exactly what the approver needs to decide or approve. |

**Rules:**

- A recommendation without alternatives is incomplete. "There was no other option" is itself an alternatives statement and must be defended.
- Confidence is honest, not performative. A low-confidence recommendation is still a valid recommendation; it tells the approver where to focus.
- The reasoning never includes implementation minutiae when the approver is the CEO. The CEO sees outcomes, risks, and the recommended action — not code, file names, or branch names.

This is the same structured communication format used for escalations in the [Company Runtime §17](../architecture/COMPANY_RUNTIME.md#17-escalation-rules); the Decision System requires it for any decision that leaves the owner's hands.

---

## 9. Decision Record Format

Every decision that is made — not only those that were escalated — produces a decision record. The record is the durable artifact the company remembers and references.

**Required fields:**

| Field | Content |
|---|---|
| **Title** | A one-line statement of the decision (e.g., "Adopt DB-backed runtime event queue for V1"). |
| **Type** | One of the decision types in [Section 3](#3-decision-types). |
| **Status** | `decided`, `superseded`, or `reversed`. |
| **Date** | When the decision was made. |
| **Owner** | The employee accountable for the decision. |
| **Approver** | The authority who approved it, when approval was required. |
| **Context** | The situation and the tension that made a decision necessary. |
| **Decision** | The choice itself, stated unambiguously. |
| **Reasoning** | Why this choice, per the required reasoning format. |
| **Alternatives rejected** | The options considered and why each was not chosen. |
| **Risks and limitations** | Known risks accepted and limitations shipped, with severity. |
| **Consequences** | What this decision constrains or enables going forward. |
| **Supersedes / Superseded by** | Links to prior or subsequent decisions, when applicable. |

**Format rules:**

- Written in plain language. A decision record must be understandable by any employee, not only the one who wrote it.
- Immutable in intent. A decision record is not edited to change the decision; a new record supersedes it and links back. The original objection or alternative is preserved.
- Self-contained. A reader should understand the decision and why it was made without needing to reconstruct the conversation around it.

For foundational, project-shaping decisions, the company uses an Architecture Decision Record (ADR) — see [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md) for the canonical example, which records the runtime, provider-independence, and memory-retrieval decisions for Platform v1. Routine decisions are recorded as memory records (see [Section 13](#13-memory-updates)). ADRs and decision memory records share the same intent; the ADR is the heavyweight form reserved for decisions that touch every module.

---

## 10. Alternatives

The discipline of recording alternatives is what separates a decision from a default. A decision that lists no alternatives is a decision that was never really made.

**Rules for alternatives:**

- Record the alternatives that were genuinely considered, not a token list. If the owner only seriously considered one path, the record says so and explains why the space was that narrow.
- For each rejected alternative, record **why** it was rejected — the specific trade-off that disqualified it, not a generic dismissal.
- When the chosen option is later reversed, the reversing decision should revisit the original alternatives. Often the right answer was an alternative that conditions have now made viable.
- The employee who loses a conflict has their objection preserved in the record. A documented dissent is organizational integrity, not a loss.

Recording alternatives is also what makes the company's memory useful: a future employee facing a similar choice can see not only what was decided but what was ruled out, and why — and avoid relitigating settled trade-offs.

---

## 11. Risk Notes

Risk is a first-class part of a decision, not a footnote. Two kinds of risk attach to decisions: risks identified during planning, and risks accepted by a decision.

**Risk attributes.** Every recorded risk carries:

| Attribute | Content |
|---|---|
| **Severity** | `low`, `medium`, or `high`. |
| **Description** | What the risk is, in plain language. |
| **Mitigation** | How the company will reduce or contain the risk. |
| **Owner role** | The employee role accountable for watching or mitigating the risk. |

**Risk-acceptance rules:**

- Accepting a risk is itself a decision and produces a decision record. "We shipped with a known limitation" must name the limitation, its severity, and who accepted it.
- Technical risk is accepted by the CTO; business risk is framed by the CTO and accepted by the CEO. A high-severity risk is never accepted silently.
- Risks surfaced during planning (the planning risk register) flow into the decisions made at plan approval. A plan's risks are visible to the approver before the plan is approved — risk is part of the approval decision, not a surprise discovered later.

This aligns with how the deterministic planner already surfaces a structured risk register (severity, description, mitigation, owner role) into every plan the CEO reviews — see [Section 15](#15-what-engineering-os-implements-today).

---

## 12. Communicating Decisions

Decisions are communicated to exactly the parties who need them, in the form appropriate to each audience. Over-communicating decisions is as much a failure as hiding them — it trains the CEO to stop reading.

**Audiences and channels:**

| Audience | What they receive | When |
|---|---|---|
| **CEO** | Approval requests for decisions requiring CEO authority; notification when a decision affects an outcome they submitted. | At the gate; on material change. |
| **Affected employees** | The decision and its consequences for their work, as a durable artifact (comment, plan, decision record). | When the decision is recorded. |
| **The company (memory)** | The full decision record. | When the decision is recorded. |
| **Timeline** | A plain-language entry for significant decisions (e.g., a significant architectural decision). | When the decision is significant enough to be company history. |

**Communication rules:**

- Decisions reach the CEO as outcomes and approvals, never as raw technical detail. A decision notification that reads "merged PR #442 after resolving 3 blocking findings" has failed; "your authentication feature passed review and is moving to QA" has succeeded.
- An approval request that pauses the company is surfaced as an actionable item the CEO can resolve directly — approve or reject — and the act of resolving it resumes the work through the real services.
- Routine decisions are not pushed to the CEO. Technical-approach decisions, defect resolutions, and review findings live in memory and on work items, not in the CEO's attention queue.

See [Company Runtime §25 Notification Rules](../architecture/COMPANY_RUNTIME.md#25-notification-rules) for the company-wide notification discipline this section specializes for decisions.

---

## 13. Memory Updates

A decision is not finished when it is made — it is finished when it is remembered. Memory is how decisions compound into organizational intelligence.

**What gets written to memory:**

- The decision record itself, categorized as a **decision** so it can be retrieved by future work in the same area.
- Architectural decisions made during a feature, recorded by the Tech Lead during the memory-update phase.
- Security patterns approved by exception, recorded by the Security Engineer.
- Risk acceptances and the limitations shipped, so future work knows the known boundaries.

**Memory rules for decisions:**

- **Retrieval is mandatory before deciding.** Before an owner frames a decision, they retrieve relevant prior decisions. A decision that contradicts an existing one without superseding it is an error, not a new choice.
- **Supersede, do not contradict.** When a new decision changes an earlier one, the new record links to and supersedes the old. The history is preserved; the company can see how its thinking changed.
- **Decisions are remembered in plain language.** A memory record that only the author understands has not been remembered by the company.
- **Knowledge gaps are recorded.** If an owner finds no prior decision where one should exist, they record the gap by making — and documenting — the decision, filling the gap for the next employee.

Decision memory shares the company's memory architecture: company, architecture, product, security, operations, employee, feature, and decision categories. Decisions are the category that most directly prevents the company from relearning what it already knows.

---

## 14. Relationship to Roles

The Decision System touches five roles directly. Each has a distinct relationship to decisions.

**CTO.** The CTO is the technical decision authority and the default approver for architecture, technical risk, security exceptions, and quality-gate overrides. The CTO owns this document. The CTO is the last technical escalation point before the CEO and is responsible for ensuring decisions are recorded, not made in conversation.

**Product Manager.** The Product Manager owns scope decisions. They frame what is in, out, and deferred, and escalate significant scope changes to the CEO. Product-versus-engineering conflicts are framed by the Product Manager and the Tech Lead and, when unresolved, decided by the CTO.

**Tech Lead.** The Tech Lead is the most frequent decision-maker. They own technical-approach decisions within an approved architecture and decide most engineering conflicts. They propose architecture decisions for CTO approval and record architectural decisions during the memory-update phase.

**Security Engineer.** The Security Engineer holds blocking authority. A security hold is not overridden by implementation preference; only a CTO-authorized, recorded exception proceeds past it. The Security Engineer records approved security patterns to memory.

**CEO.** The CEO is the final approval authority for scope significance, business-risk acceptance, release authorization (below the autonomous level), and every execution-authorization checkpoint that the autonomy policy gates. The CEO decides outcomes; the CEO never decides implementation. The CEO's four interaction points — goal submission, plan approval, release approval, and incident response — are the only decisions the CEO is required to make. See [Company Runtime §35](../architecture/COMPANY_RUNTIME.md#35-ceo-interaction-points).

---

## 15. What Engineering OS Implements Today

The Decision System describes the full intended behavior. The platform implements a concrete, enforced subset of it today. This section separates the two honestly. (Per a hard project rule, no behavior is described here as automated unless it is genuinely built.)

### Implemented today

| Capability | How it is realized |
|---|---|
| **Execution-authorization policy** | A single shared autonomy policy computes `allow` / `requires_approval` / `deny` for every gated agentic action at every autonomy level. Both the manual server actions and the autonomous driver consult the same policy, so authorization is identical across both paths. |
| **Approval checkpoints with a strict lifecycle** | A checkpoint is raised `awaiting_approval` and resolved exactly once to `approved` or `rejected`; re-resolving a settled checkpoint is refused. |
| **CEO decision queue** | When a sub-threshold autonomy gate pauses a task at a review or QA checkpoint, the pause is persisted (a pending review or QA result) and surfaced as a "needs your approval" item the CEO can approve or reject. Approving or rejecting resumes the flow through the real review and QA services, so no gate is bypassed. |
| **Decision notifications** | A `decision`-typed notification fires when an approval is needed, and approval counts surface on the sidebar bell, the inbox badge, and a dashboard "pending approvals" card. |
| **Risk register in plans** | The deterministic planner emits a structured risk register — severity, description, mitigation, and owner role — into every plan presented to the CEO, so risk is part of the plan-approval decision. |
| **Decision as a memory category** | "Decision" is a first-class memory category; decision records can be created and retrieved as durable company memory. |
| **Next-action recommendation** | Company intelligence computes the CEO's recommended next action from workspace state — pending plan approvals, blocked work, failed executions — prioritizing the decisions that most need CEO attention. |
| **Architecture Decision Records** | Foundational decisions are recorded as ADRs (see [ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md)). |

### Designed / planned

| Capability | Status |
|---|---|
| A dedicated decision-record entity with the full field set in [Section 9](#9-decision-record-format) | Designed. Today, decisions are captured as memory records (category `decision`) and ADR markdown; a structured entity is planned. |
| AI-generated decision framing and recommendations | Planned and deliberately gated. Plan generation is deterministic today; real-AI reasoning is blocked until the canonical Engineering OS Specification v1.0 is written. |
| Automatic timeline entries for every significant decision | Partially designed. Timeline and event models exist; comprehensive decision-to-timeline wiring is a follow-up. |
| Decision-conflict detection against prior memory at framing time | Designed. Mandatory retrieval is specified; automated contradiction detection is not yet built. |

The boundary is deliberate: Engineering OS enforces the decisions that touch real code (execution authorizations, quality gates) in software today, while the broader organizational decision record remains a documented practice backed by memory and ADRs until the specification work unlocks more.

---

## 16. Failure Modes

The Decision System fails in characteristic ways. Each is recorded here so the company can recognize and correct it.

### A decision is made in conversation and never recorded

An employee makes a consequential choice while working and moves on without a record. Later, another employee makes a contradicting choice because the first was invisible. Caught when: two parts of the system embody opposite assumptions and no record explains either.

**Response:** A decision that is not recorded did not happen. If a choice was consequential enough to make, it is consequential enough to record. The owner writes the decision record before the work that depends on it proceeds.

### An owner escalates without a recommendation

An employee who lacks authority routes the decision up as an open question — "what should we do?" — forcing the approver to do the framing work. Caught when: the approver has to ask for context the escalation should have contained.

**Response:** Escalation carries a recommendation in the required reasoning format. The owner does the framing; the approver decides. An escalation without a recommendation is sent back.

### A blocking gate is overridden without a recorded decision

A QA No-Go or a security hold is bypassed under deadline pressure on a verbal "the risk is fine," with no CTO authorization and no record. The risk surfaces in production. Caught when: a post-incident review cannot establish that the override was authorized.

**Response:** Blocking authorities are overridden only by a CTO decision, recorded alongside the original No-Go or hold. "The team felt it was acceptable" is not a documented decision. This mirrors the release-override rule in [SOP: Release](../sops/RELEASE.md#release-delay-rules).

### Alternatives are omitted from the record

A decision is recorded as a conclusion with no record of what else was considered. A future employee re-litigates the same trade-offs because the rejected options and their reasons were lost. Caught when: someone proposes an option that was already considered and rejected, and no one can say why.

**Response:** Alternatives and the reason each was rejected are mandatory fields. A decision without them is incomplete and is returned to the owner.

### Risk acceptance is silent

The company ships with a known limitation that no one explicitly accepted. There is no record of the severity, the mitigation, or who decided to proceed. Caught when: the limitation becomes a production problem and no one owns the decision to have shipped it.

**Response:** Accepting risk is a decision with its own record. High-severity risk is never accepted silently; technical risk is accepted by the CTO, business risk by the CEO.

### A decision reaches the CEO as technical detail

An approval request or notification exposes PRs, file paths, or review findings to the CEO instead of outcomes and risks. The CEO is trained to either rubber-stamp or ignore. Caught when: the CEO cannot tell from the request what they are actually approving.

**Response:** Decisions surfaced to the CEO are organizational and outcome-focused. Implementation detail belongs in the record and on work items, never in the CEO's approval queue.

### The autonomy gate is bypassed by one of the two paths

The manual path and the autonomous driver diverge, so an action that requires approval on one path proceeds without it on the other. Caught when: the same action at the same autonomy level behaves differently depending on who triggered it.

**Response:** Both paths consult the single shared autonomy policy. There is exactly one definition of the authorization decision and one checkpoint lifecycle; neither path is permitted a private interpretation.

---

## 17. Relationship to Other Documents

- **[Company Runtime](../architecture/COMPANY_RUNTIME.md)** defines decision-making, conflict resolution, escalation, and approval-request behavior at the runtime level. The Decision System specializes that behavior for the decision as an object — its types, record format, and memory.
- **[ADR-001](../adr/ADR-001-execution-runtime-and-memory-retrieval.md)** is the canonical example of a recorded foundational decision and the heavyweight form of the decision-record format in [Section 9](#9-decision-record-format).
- **[GitHub Workflow Foundation](../architecture/GITHUB_WORKFLOW_FOUNDATION.md)** defines the guardrails that bound execution-authorization decisions — the invariants that no decision or approval may override.
- **[SOP: Release](../sops/RELEASE.md)** defines the release-authorization and QA-override decisions in procedural detail; the Decision System describes their authority and record.
- **[Domain Model](../architecture/DOMAIN_MODEL.md)** defines the underlying objects — Memory, Review, QA Result, Notification, Timeline — that the decision records and approval checkpoints are persisted against.
- The **Engineering OS Specification v1.0** (planned) will formalize the decision model — the structured decision entity, its state machine, and its invariants — and unlock the AI-assisted decision framing this document describes as designed.
