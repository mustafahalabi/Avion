# Architecture — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Approved By:** CEO
**Last Updated:** 2026-06-29

This directory holds the architecture and behavioral specifications for Engineering OS — the documents that translate the organizational model into product and system behavior. They are intentionally implementation-neutral about infrastructure (no frameworks, storage engines, or vendors prescribed), while separating designed behavior from what the live codebase realizes today. The CTO owns this directory; changes that contradict an approved document require CTO sign-off and a recorded Decision Record.

Start with the [Domain Model](./DOMAIN_MODEL.md) (the objects), then [Company Runtime](./COMPANY_RUNTIME.md) (how the company behaves), then the supporting specs below.

## Documents

| Document | Purpose |
| --- | --- |
| [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) | Single source of truth for every object, its owner, relationships, and lifecycle rules. |
| [COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md) | How the virtual company behaves at runtime — the core behavioral specification. |
| [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) | System boundaries, module responsibilities, data ownership, event contracts, and failure modes. |
| [STATE_MACHINES.md](./STATE_MACHINES.md) | Per-entity lifecycle contracts: states, transitions, owners, terminal and forbidden transitions. |
| [EVENT_MODEL.md](./EVENT_MODEL.md) | What an event is, who produces and consumes it, and how events become timeline, notifications, and memory. |
| [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | How information is organized — the product's hierarchy and how a CEO navigates the company they own. |
| [INTEGRATION_ARCHITECTURE.md](./INTEGRATION_ARCHITECTURE.md) | How Engineering OS connects to external systems while keeping integrations replaceable plumbing. |
| [MEMORY_ENGINE_ARCHITECTURE.md](./MEMORY_ENGINE_ARCHITECTURE.md) | How the company remembers — what is stored, who owns it, and how learning feeds it. |
| [COMPANY_INTELLIGENCE.md](./COMPANY_INTELLIGENCE.md) | The awareness layer: what changed, what is blocked, what needs the CEO's attention. |
| [GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md) | Safe, traceable Git workflow for agent-driven implementation (branches, PRs, session links). |
| [REPOSITORY_ANALYSIS_SNAPSHOTS.md](./REPOSITORY_ANALYSIS_SNAPSHOTS.md) | Durable point-in-time records of what was detected in a repository. |
| [REPOSITORY_SNAPSHOT_COMPARISON.md](./REPOSITORY_SNAPSHOT_COMPARISON.md) | Deterministic comparison of what changed between two analysis snapshots. |
| [REPOSITORY_IMPACT_ANALYSIS.md](./REPOSITORY_IMPACT_ANALYSIS.md) | Classifies changes by area and risk, identifies owners, and recommends next actions. |
