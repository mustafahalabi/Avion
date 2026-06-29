# UX Specifications — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

This directory holds the **UX specifications** for Engineering OS — the experience layer that sits between structure and code. Each document specifies *what the CEO is trying to do, what they see, and how a surface should feel*, at the altitude a wireframe can be drawn from. These are UX specifications, not frontend build sheets: they prescribe no components, routes, colors, pixel values, transports, or framework choices. Those belong to engineering, which these documents exist to guide.

The specs here are downstream of the structural and behavioral models that own them — [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md), [Company Runtime](../architecture/COMPANY_RUNTIME.md), and the [CEO Experience](../ceo-experience/) docs. Where this directory overlaps with those, the model owns the structure and these documents own the *experience through it*. The governing rule across every spec is the product's one non-negotiable: **the CEO states outcomes and approves decisions; the company owns execution.**

This directory is owned by the **Product Manager**.

## Contents

| Document | Description |
|---|---|
| [CEO_DASHBOARD.md](./CEO_DASHBOARD.md) | The CEO Dashboard — the primary surface and first thing the CEO sees on every visit: what it communicates, how it is prioritized, and how it should feel. |
| [COMPANY_CHAT.md](./COMPANY_CHAT.md) | Company Chat — the conversational surface for communicating goals, receiving summaries, and approving decisions, kept a company conversation rather than a prompt console. |
| [CORE_FLOWS.md](./CORE_FLOWS.md) | Core product UX flows — the end-to-end journeys a CEO travels, from first arrival to delivered software, each as a sequence of CEO goals and system responses. |
| [EMPLOYEE_PAGES.md](./EMPLOYEE_PAGES.md) | Employee pages — the experience of the employee list and detail surfaces: role, department, status, workload, confidence, memory, performance, and active work in organizational language. |
