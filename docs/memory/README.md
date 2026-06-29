# Memory — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

This directory holds the specifications for the **Engineering OS memory system** — the durable knowledge the virtual company carries between tasks, employees, and outcomes. Each document is the operational contract for one memory layer or cross-cutting concern: what belongs in it, who owns it, when it is written and read, and how it stays accurate over time.

These documents describe **organizational behavior, not storage technology**. The system-wide model (layers, the record model, read rules, retention, supersession) is owned by [ORGANIZATIONAL_MEMORY_SYSTEM.md](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md); the documents here specialize that model for each layer. The CTO owns this area, with the Product Manager owning Feature Memory and the Tech Lead operating Repository Knowledge.

## Documents

| Document | Owner | Purpose |
|---|---|---|
| [COMPANY_MEMORY.md](./COMPANY_MEMORY.md) | CTO | Shared, organization-wide knowledge: standards, architecture, business rules, naming, technical-debt records, and lessons learned. |
| [EMPLOYEE_MEMORY.md](./EMPLOYEE_MEMORY.md) | CTO | The narrowest layer — what an individual role remembers independently of the rest of the organization. |
| [REPOSITORY_KNOWLEDGE.md](./REPOSITORY_KNOWLEDGE.md) | CTO · Tech Lead | The durable, codebase-specific understanding the company holds about each repository it manages. |
| [FEATURE_MEMORY.md](./FEATURE_MEMORY.md) | Product Manager | The per-feature record linking product rationale (problem, requester, intent) to the technical decisions that shaped it. |
| [DECISION_MEMORY.md](./DECISION_MEMORY.md) | CTO | The company's significant choices, the reasoning behind them, rejected alternatives, accepted risks, and when to revisit. |
| [LEARNING_ENGINE.md](./LEARNING_ENGINE.md) | CTO | The write side of organizational learning: how validated lessons become permanent changes to standards, memories, and SOPs. |
| [CONNECTED_KNOWLEDGE.md](./CONNECTED_KNOWLEDGE.md) | CTO | The relationships that turn individual records into a navigable graph — provenance, dependencies, ownership, and impact. |

## Related

- [ORGANIZATIONAL_MEMORY_SYSTEM.md](../systems/ORGANIZATIONAL_MEMORY_SYSTEM.md) — the canonical, system-wide memory model these documents specialize.
- [CONTINUOUS_IMPROVEMENT_SYSTEM.md](../systems/CONTINUOUS_IMPROVEMENT_SYSTEM.md) — improvement governance and the promotion gate referenced by the Learning Engine.
- [Domain Model](../architecture/DOMAIN_MODEL.md) · [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) — the implementation surface these layers map onto.
