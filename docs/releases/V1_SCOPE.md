# Engineering OS — V1 Official Scope

This is the official V1 contract. It defines exactly what shipped, what was partially built, what was intentionally deferred, and what was rejected.

---

## Implemented (Shipped in V1)

### Platform Foundation
- [x] Next.js App Router project structure
- [x] Prisma ORM with SQLite
- [x] Tailwind CSS styling
- [x] Zod input validation on all server actions
- [x] Singleton Prisma client
- [x] cn() utility for Tailwind class merging

### Authentication
- [x] Clerk authentication (sign-in, sign-up)
- [x] Middleware-enforced route protection
- [x] User record sync from Clerk on every request
- [x] Onboarding flow (company name, autonomy level, culture profile)

### Company Core
- [x] Company model (name, slug, owner, logo, industry, website, description)
- [x] Department model with parent/child hierarchy
- [x] Employee model (name, title, mission, bio, responsibilities, workload, status, reporting)
- [x] Role model
- [x] Company settings (autonomy, culture, timezone, currency, locale)
- [x] Company seed on workspace creation
- [x] Company overview page
- [x] Department detail page
- [x] Employee directory page
- [x] Employee detail page

### CEO Dashboard
- [x] Summary cards (employees, tasks, requests)
- [x] Recent requests panel
- [x] Recent notifications panel
- [x] Recent releases panel

### Company Runtime (Inbox)
- [x] RuntimeRequest with 8 typed categories
- [x] Automatic routing by request type
- [x] Full lifecycle (intake → complete/rejected/blocked)
- [x] RuntimeEvent audit log per request
- [x] Request submission form
- [x] Request detail page with status controls
- [x] Notifications on key transitions

### Company Chat
- [x] Persistent conversation threads
- [x] Auto-create RuntimeRequest on first message
- [x] Conversation list and thread view
- [x] Conversation deletion
- [x] Company acknowledgement messages

### Task and Planning Engine
- [x] Projects with full lifecycle
- [x] Tasks with priority and status lifecycle
- [x] Task assignment with cross-company validation
- [x] Features linked to projects
- [x] Subtasks per task
- [x] Sprints per project
- [x] Milestones per project
- [x] Inline task status update

### Repository Intelligence
- [x] Repository registration
- [x] Tech stack, framework, dependency metadata as JSON arrays
- [x] Analysis status field
- [x] Repository detail page

### Memory and Knowledge Engine
- [x] Memory banks per company with 8 categories
- [x] Memory records (content, source, confidence)
- [x] Knowledge base model with records
- [x] Default memory bank seeding on company creation

### Notifications
- [x] Notification model (typed, prioritized, entity-linked)
- [x] Notification center page
- [x] Mark-read and mark-all-read
- [x] Automatic dispatch from runtime, review, and QA flows

### Timeline
- [x] TimelineEntry and Event models
- [x] Timeline page

### Quality Gate
- [x] Review lifecycle (pending → approved/changes_requested)
- [x] Review verdict → task status transitions
- [x] ChangeRequest records
- [x] QA Result with per-check pass/fail tracking
- [x] QA pass → task done automation
- [x] Ownership validation on review and QA creation

### Integrations
- [x] Provider registry (Linear, GitHub, Slack, Vercel)
- [x] AES-256-GCM credential encryption
- [x] Connect, disconnect actions
- [x] Sync log per integration
- [x] Integration detail page with connect form

### Release Lifecycle
- [x] Release model (version, notes, checklist, rollback plan)
- [x] Default 6-item checklist
- [x] Status lifecycle (draft → ready → released)
- [x] Task linkage to releases
- [x] Mark-released action with timestamp

### Settings
- [x] Company settings page
- [x] Autonomy level and culture profile update

---

## Partially Implemented

| Feature | What Shipped | What Is Missing |
|---|---|---|
| Integration sync | Credential storage, connect/disconnect, sync log | Live data fetch from providers |
| Repository intelligence | Registration and metadata storage | Automated analysis, AI-powered insights |
| Memory retrieval | Write and browse | AI-powered retrieval, semantic search |
| Notification delivery | In-app only | Email, Slack, push notifications |
| Timeline | Models exist, page renders | Automated event creation from all mutations |
| Incident management | `Incident` model exists in schema | No UI, no actions |
| Knowledge base | `Knowledge` and `KnowledgeRecord` models | No UI for Knowledge (only Memory has UI) |

---

## Deferred (Intentionally Moved to V2)

| Feature | Reason Deferred |
|---|---|
| AI inference (LLM calls) | Architecture designed for it; agent framework not scoped for V1 |
| Live integration sync (Linear, GitHub, Slack, Vercel) | Data pipeline infrastructure deferred |
| Background jobs / async workers | No queue system in V1 |
| Multi-user / team collaboration | Single-owner model sufficient for V1 |
| Role-based access control (RBAC) | Owner-only authorization covers V1 needs |
| File uploads / media storage | Not required for V1 workflows |
| Real-time updates (WebSocket/SSE) | Server-side revalidation sufficient for V1 |
| Automated repository scanning | Manual registration covers V1 |
| Email / push notifications | In-app notifications sufficient for V1 |
| Audit log for all mutations | Event log covers runtime; full audit deferred |
| PostgreSQL migration | SQLite acceptable for single-instance V1 |
| API key / token management for external access | No external API consumers in V1 |
| Sprint planning UI | Sprint model exists; planning board deferred |
| Reporting and analytics | Dashboard covers V1 needs |
| Search | No full-text search in V1 |
| Export / import | Not scoped for V1 |

All deferred items are catalogued in `docs/releases/V2_BACKLOG.md`.

---

## Rejected (Will Not Be Built)

| Feature | Reason |
|---|---|
| Native mobile app | Web-first; no mobile requirement identified |
| On-premise / self-hosted deployment | Cloud-first product |
| Third-party marketplace / plugin system | Too early; not a V1 or V2 requirement |
| Customer-facing portal | Internal engineering tool only |

---

## Out of Scope

| Area | Notes |
|---|---|
| Billing / subscription management | Not an Engineering OS concern |
| HR/payroll integration | Out of scope; employee model is engineering-focused |
| Compliance/legal tooling | Not in product scope |
| CI/CD pipeline execution | Integrations track deployments; pipeline execution is external |
