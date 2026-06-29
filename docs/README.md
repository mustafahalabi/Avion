# Engineering OS — Documentation

**Status:** Approved
**Version:** 1.0
**Owner:** Technical Writer
**Approved By:** CTO
**Last Updated:** 2026-06-29

This directory is the canonical documentation set for Engineering OS — the Virtual Software Company. It holds the durable organizational design (company, employees, departments), the behavioral and technical specifications that turn that design into running software, the CEO-facing product experience, and the operational records (QA, reviews, releases) produced as the company builds itself. Documentation is owned by the Technical Writer and maintained alongside the codebase; specifications are owned by the CTO and approved by the CEO.

Everything below is organized by subdirectory. Each entry links to the folder and names its primary entry point.

## Map of `docs/`

| Area | What it contains |
|---|---|
| [adr/](./adr/) | Architecture Decision Records — point-in-time decisions with context and consequences. Start with `ADR-001-execution-runtime-and-memory-retrieval.md`. |
| [architecture/](./architecture/) | Behavioral and technical specs: domain model, event model, state machines, runtime, repository intelligence. See `COMPANY_RUNTIME.md`. |
| [ceo-experience/](./ceo-experience/) | The CEO-facing product surface: dashboard, timeline, first-use, and product alerts. See `EXECUTIVE_USER_EXPERIENCE.md`. |
| [company/](./company/) | Foundational company definition: the Company Operating System, Playbook, and Employee Template. |
| [decision-frameworks/](./decision-frameworks/) | Reusable frameworks employees apply when deciding (architecture, security, performance, prioritization, risk, and more). |
| [design/](./design/) | Visual foundation and navigation/layout guidance for the product UI. |
| [employees/](./employees/) | Operational handbooks for each role (Tech Lead, Frontend, Backend, QA, Reviewer, and others). |
| [glossary/](./glossary/) | The shared company language and glossary of terms. |
| [memory/](./memory/) | Memory architecture: employee, company, feature, decision, and repository knowledge plus the learning engine. |
| [organization/](./organization/) | Org structure: departments, employee directory, reporting structure, and responsibility matrix. |
| [product/](./product/) | Product requirements and the MVP roadmap. |
| [qa/](./qa/) | QA checklists, smoke-test evidence, and per-area quality records. |
| [releases/](./releases/) | Release manifests and the frozen v1 scope/architecture/API plus the v2 backlog. |
| [reviews/](./reviews/) | Dogfooding and truth-audit reviews of shipped slices. |
| [sops/](./sops/) | Standard operating procedures for recurring work (new feature, bug fix, code review, release, rollback, incidents). |
| [systems/](./systems/) | Cross-cutting company systems: planning, work items, approvals, notifications, decisions, communication, reporting, and memory. |
| [ux/](./ux/) | UX specs for core flows, the CEO dashboard, company chat, and employee pages. |
| [vission/](./vission/) | The north-star product vision (`VISSION.md`). |

## Top-level documents

- [v1-scope.md](./v1-scope.md) — the frozen scope of Platform v1.
