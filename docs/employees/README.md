# Employee Handbooks — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

This directory holds the operational handbooks for every employee role in the Engineering OS virtual software company. Each handbook defines a role's identity, mission, responsibilities, authority, decision framework, KPIs, and definition of done — the durable specification of an employee, not a prompt. They translate the organizational design (departments, reporting structure, responsibility matrix) into per-role behavior that the company runtime can rely on.

These documents are owned by the **CTO** and maintained by the **Documentation Specialist (Technical Writer)**. Roles report into the Executive line per each handbook's `Reports To` field.

## Handbooks

| Role | Department | Handbook |
|---|---|---|
| Product Manager | Product | [PRODUCT_MANAGER.md](./PRODUCT_MANAGER.md) — owns scope, requirements, and acceptance criteria. |
| Tech Lead | Engineering | [TECH_LEAD.md](./TECH_LEAD.md) — owns engineering execution, task decomposition, and delivery readiness. |
| Frontend Engineer | Engineering | [FRONTEND_ENGINEER.md](./FRONTEND_ENGINEER.md) — owns frontend implementation within defined scope. |
| Backend Engineer | Engineering | [BACKEND_ENGINEER.md](./BACKEND_ENGINEER.md) — owns backend implementation within defined scope. |
| AI Engineer | Engineering | [AI_ENGINEER.md](./AI_ENGINEER.md) — owns AI system design, integration, evaluation, and reliability. |
| Infrastructure Engineer | Engineering | [INFRASTRUCTURE_ENGINEER.md](./INFRASTRUCTURE_ENGINEER.md) — owns infrastructure design, topology, reliability, and scalability planning. |
| DevOps Engineer | Engineering | [DEVOPS_ENGINEER.md](./DEVOPS_ENGINEER.md) — owns the deployment pipeline, environments, CI/CD, and secrets operations. |
| Release Manager | Engineering | [RELEASE_MANAGER.md](./RELEASE_MANAGER.md) — owns the release process end-to-end with authority to halt unready releases. |
| Monitoring Engineer | Engineering | [MONITORING_ENGINEER.md](./MONITORING_ENGINEER.md) — owns application monitoring, alert quality, and turning signals into work. |
| Reviewer | Engineering | [REVIEWER.md](./REVIEWER.md) — owns code review approval with blocking authority over substandard work. |
| QA Engineer | Engineering | [QA_ENGINEER.md](./QA_ENGINEER.md) — owns release validation with blocking authority over the quality bar. |
| Security Engineer | Engineering | [SECURITY_ENGINEER.md](./SECURITY_ENGINEER.md) — defines security standards and gates work that adds unacceptable risk. |
| Search Visibility Specialist | Engineering | [SEO_SPECIALIST.md](./SEO_SPECIALIST.md) — defines search visibility requirements for public-facing pages. |
| Documentation Specialist | Engineering | [TECHNICAL_WRITER.md](./TECHNICAL_WRITER.md) — owns documentation quality, completeness, and consistency. |

## Conventions

- Every handbook opens with front-matter: `Role`, `Department`, `Reports To`, `Authority Level`, and `Version`.
- Handbooks describe **company behavior**, not AI orchestration, prompts, or implementation technology.
- Additional roles (e.g. CTO, COO, Chief Designer, Product Analyst) are part of the organizational design and will gain handbooks as they are written.
