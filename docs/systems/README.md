# Systems — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Last Updated:** 2026-06-29  

---

This directory holds the **behavioral system specifications** for Engineering OS — the documents that define how the virtual company *behaves* as it runs. Each system describes one cross-cutting capability (planning, review, memory, communication, and so on): what it does, who owns it, the records it produces, and the rules it follows. These specs sit on top of the company-level documents in [`../architecture/`](../architecture/) — chiefly [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) and [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md) — and elaborate them into self-contained operating systems.

Every document here follows the same discipline: it describes company behavior, not prompts, models, or storage engines, and it keeps **Implemented today** behavior strictly separate from **Designed / planned** behavior so the specs never overstate what the platform does. Unless noted otherwise, the **CTO** owns these specifications.

## Systems

| Document | Owner | Purpose |
|---|---|---|
| [APPROVAL_SYSTEM.md](./APPROVAL_SYSTEM.md) | CTO | When and how the company pauses for an explicit human decision, who may decide, and how every approval is recorded. |
| [COMMUNICATION_SYSTEM.md](./COMMUNICATION_SYSTEM.md) | CTO | How employees collaborate, report status, raise blockers, escalate, and keep the CEO informed without implementation detail. |
| [CONTINUOUS_IMPROVEMENT_SYSTEM.md](./CONTINUOUS_IMPROVEMENT_SYSTEM.md) | CTO | The company's learning loop — turning reviews, QA findings, incidents, and feedback into better future work and hardened standards. |
| [DECISION_SYSTEM.md](./DECISION_SYSTEM.md) | CTO | How the company records, evaluates, approves, communicates, and remembers decisions that constrain future work. |
| [KNOWLEDGE_LIBRARY_SYSTEM.md](./KNOWLEDGE_LIBRARY_SYSTEM.md) | Technical Writer (curation) · CTO (authority) | How durable, reference-quality knowledge is authored, validated, connected, searched, and maintained — distinct from experiential Memory. |
| [NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md) | CTO | The attention-management layer that decides what deserves a person's attention, who receives it, when, and what stays silent. |
| [ORGANIZATIONAL_MEMORY_SYSTEM.md](./ORGANIZATIONAL_MEMORY_SYSTEM.md) | CTO | How the company stores meaningful knowledge across memory layers and makes it available to employees so it compounds over time. |
| [PLANNING_SYSTEM.md](./PLANNING_SYSTEM.md) | Product Manager | How a CEO outcome becomes a scoped, reviewable plan — projects, milestones, features, criteria, risks, and execution-ready tasks. |
| [REPORTING_SYSTEM.md](./REPORTING_SYSTEM.md) | CTO | How raw work records become concise, decision-oriented summaries of what progressed, what is at risk, and what shipped. |
| [REVIEW_SYSTEM.md](./REVIEW_SYSTEM.md) | CTO | How the company judges whether work is good enough to advance — the quality conscience that gates `done`. |
| [WORK_ITEM_SYSTEM.md](./WORK_ITEM_SYSTEM.md) | Tech Lead | How a unit of work is captured, structured, owned, decomposed, tracked, reviewed, completed, and archived. |

---

For the company-level behavioral contract these systems build on, see [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md); for object shapes and lifecycles, see [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md).
