# Decision Frameworks — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

This directory holds the company's **decision frameworks** — the repeatable, implementation-neutral reasoning logic Engineering OS applies to recurring kinds of engineering judgment. Each framework defines the questions to ask, the criteria to weigh, the evidence required, who is allowed to decide, when approval is triggered, and how the outcome is recorded. They exist so that the same kind of decision is made the same way every time, by every employee, regardless of who is doing the work or which repository is in play.

These documents are specializations, not new authorities. The [Decision System](../systems/DECISION_SYSTEM.md) governs *how* any decision moves through the company — its lifecycle, owners, approvers, reasoning format, and memory rules. The frameworks here supply the domain-specific **judgment** that the Decision System refers to as "the department decision framework." Decisions made with them are recorded against the [Domain Model](../architecture/DOMAIN_MODEL.md) and, when foundational, written as an [ADR](../adr/).

## Frameworks

| Framework | Owner | Purpose |
|---|---|---|
| [Accessibility](./ACCESSIBILITY_DECISION_FRAMEWORK.md) | Frontend Engineer | How the company decides usability, semantics, keyboard/screen-reader behavior, contrast, focus, and inclusive interaction for user-facing work. |
| [Architecture](./ARCHITECTURE_DECISION_FRAMEWORK.md) | CTO | How to evaluate choices about system structure, technology selection, and design patterns that span modules and are costly to reverse. |
| [Dependency Choice](./DEPENDENCY_CHOICE_DECISION_FRAMEWORK.md) | Tech Lead | How to evaluate, approve, or refuse an external dependency (library, package, SDK, API, platform, or service). |
| [Internal vs External](./INTERNAL_VS_EXTERNAL_DECISION_FRAMEWORK.md) | CTO | The company's "build vs. buy" logic across four options: build internally, buy a managed service, adopt a dependency, or defer. |
| [Performance](./PERFORMANCE_DECISION_FRAMEWORK.md) | CTO | How to reason about speed, latency, bundle weight, resource usage, and user-perceived performance, and when a cost is acceptable. |
| [Prioritization](./PRIORITIZATION_DECISION_FRAMEWORK.md) | Product Manager | How the company decides what to work on next — repeatable, traceable ranking of value against cost and risk. |
| [Risk Analysis](./RISK_ANALYSIS_DECISION_FRAMEWORK.md) | CTO | How to identify, score, communicate, mitigate, accept, and monitor risk so no risk is silent, unowned, or unmeasured. |
| [Security](./SECURITY_DECISION_FRAMEWORK.md) | Security Engineer | How to classify and evaluate security risk, who may decide it, and what must be true before work proceeds. |
| [Technical Debt](./TECHNICAL_DEBT_DECISION_FRAMEWORK.md) | CTO | How to identify, evaluate, accept, reduce, document, and escalate technical debt honestly and accountably. |

## Related

- [Decision System](../systems/DECISION_SYSTEM.md) — the process every decision follows.
- [Domain Model](../architecture/DOMAIN_MODEL.md) — the Decision, Decision Record, Risk, and Memory objects these frameworks write to.
- [Architecture Decision Records](../adr/) — where foundational decisions are permanently recorded.
