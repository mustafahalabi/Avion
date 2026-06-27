# Engineering OS — Platform V2 Backlog

This document is the official registry of all features, improvements, and infrastructure work deferred from V1. V2 development should draw from this backlog.

Items are grouped by theme and approximately ordered by dependency and strategic value.

---

## Infrastructure and Data

| ID | Item | Notes |
|---|---|---|
| V2-I-001 | Migrate database from SQLite to PostgreSQL | Required before multi-user or production deployment; use Prisma migrate |
| V2-I-002 | Establish versioned migration history | Baseline V1 schema; switch to `prisma migrate deploy` |
| V2-I-003 | Replace JSON TEXT columns with native jsonb | Enables relational queries into tech stack, checks, metadata fields |
| V2-I-004 | Add `ReleaseTask` join table | Replace `Release.taskIds` JSON array with proper relational join |
| V2-I-005 | Background job queue | Vercel Queues or equivalent; required for AI inference and live sync |
| V2-I-006 | Connection pooling | PgBouncer or Vercel Postgres pooler for PostgreSQL |
| V2-I-007 | Re-encrypt legacy plaintext credentials | One-time migration; remove legacy path in `decryptCredentials()` |
| V2-I-008 | Rename `src/proxy.ts` → `src/middleware.ts` | Align with Next.js convention |

---

## Security and Compliance

| ID | Item | Notes |
|---|---|---|
| V2-S-001 | Rate limiting on server actions | Upstash Rate Limit or Vercel Middleware; key by user ID |
| V2-S-002 | Role-based access control (RBAC) | Beyond owner-only; team members with scoped permissions |
| V2-S-003 | General audit log | `AuditLog` model capturing all mutations with actor, old/new values |
| V2-S-004 | Idempotent company seeding | Upsert-based seed; transaction-wrapped; seeded flag |
| V2-S-005 | API key management | For future external API consumers |
| V2-S-006 | Secrets rotation support for integration credentials | Allow re-keying with new encryption key |

---

## AI and Intelligence

| ID | Item | Notes |
|---|---|---|
| V2-A-001 | LLM integration for AI-powered responses | Wire Anthropic Claude to chat and runtime flows |
| V2-A-002 | Memory retrieval (semantic search) | AI-powered retrieval from memory banks |
| V2-A-003 | Knowledge base AI retrieval | Surface `Knowledge` records to the AI context |
| V2-A-004 | Automated task planning from RuntimeRequest | LLM breaks a request goal into tasks automatically |
| V2-A-005 | Repository intelligence — automated analysis | Scan repos and populate tech stack, summary, important files |
| V2-A-006 | Code review AI suggestions | LLM-powered suggestions in the Review flow |
| V2-A-007 | QA check generation | LLM generates QA checklist from task description |
| V2-A-008 | Timeline summarization | AI-generated daily/weekly summaries from TimelineEntry |

---

## Integrations — Live Data Sync

| ID | Item | Notes |
|---|---|---|
| V2-INT-001 | Linear sync — projects, issues, cycles | Import Linear issues as Tasks; bidirectional status sync |
| V2-INT-002 | GitHub sync — repositories, PRs, releases | Import repos; link PRs to tasks; import release tags |
| V2-INT-003 | Slack notifications | Dispatch notifications to Slack channels |
| V2-INT-004 | Vercel deployment tracking | Import deployment status into Release records |
| V2-INT-005 | Integration sync worker | Background job for scheduled and triggered syncs |
| V2-INT-006 | OAuth flow for provider authentication | Replace API key entry with OAuth for applicable providers |
| V2-INT-007 | Additional providers | Jira, Notion, PagerDuty, Datadog |

---

## Collaboration and Multi-User

| ID | Item | Notes |
|---|---|---|
| V2-C-001 | Team member invitations | Multiple users per company with assigned roles |
| V2-C-002 | Per-user permissions | Read-only, contributor, admin levels |
| V2-C-003 | Real-time updates | WebSocket or SSE for live collaboration |
| V2-C-004 | @mentions in messages and notes | Link to team members in comments |
| V2-C-005 | Activity feed per employee | Individual work history and contributions |

---

## Work and Planning

| ID | Item | Notes |
|---|---|---|
| V2-W-001 | Sprint planning board | Kanban/board view for sprint task management |
| V2-W-002 | Drag-and-drop task prioritization | Visual ordering within sprints and backlogs |
| V2-W-003 | Time tracking | Estimate vs actual on tasks |
| V2-W-004 | Task dependencies | Block/unblock relationships between tasks |
| V2-W-005 | Recurring tasks | Templates and scheduled task creation |
| V2-W-006 | Bulk task operations | Select multiple tasks for bulk status/priority updates |
| V2-W-007 | Advanced task search and filtering | Filter by assignee, priority, status, date range |

---

## Reporting and Analytics

| ID | Item | Notes |
|---|---|---|
| V2-R-001 | Engineering velocity metrics | Tasks completed per sprint/week |
| V2-R-002 | Quality metrics | Review approval rate, QA pass rate, change request frequency |
| V2-R-003 | Release health dashboard | Time between releases, rollback frequency |
| V2-R-004 | Employee workload analytics | Aggregate task load by employee |
| V2-R-005 | Export to CSV/PDF | Task lists, release notes, audit logs |

---

## Notifications and Communication

| ID | Item | Notes |
|---|---|---|
| V2-N-001 | Email notifications | Transactional emails for decisions, blockers, completions |
| V2-N-002 | Slack notification delivery | Push to Slack via integration |
| V2-N-003 | Notification preferences | Per-user opt-in/out for notification types |
| V2-N-004 | Digest emails | Daily/weekly summaries |

---

## UI and UX

| ID | Item | Notes |
|---|---|---|
| V2-UX-001 | Full-text search | Search across tasks, projects, employees, memory |
| V2-UX-002 | Dark mode | Theme toggle |
| V2-UX-003 | Keyboard shortcuts | Power-user navigation |
| V2-UX-004 | Mobile-responsive improvements | Optimize layouts for tablet/mobile |
| V2-UX-005 | Onboarding tour | Guide new users through key features |
| V2-UX-006 | Command palette | Quick-access to any page or action |

---

## Missing Features from V1 Models

| ID | Item | Notes |
|---|---|---|
| V2-M-001 | Incident management UI | `Incident` model exists; needs pages and actions |
| V2-M-002 | Knowledge base UI | `Knowledge`/`KnowledgeRecord` exist; needs browsable interface |
| V2-M-003 | Sprint board | `Sprint` model exists; needs planning and tracking UI |
| V2-M-004 | Milestone tracking | `Milestone` model exists; needs timeline view |
| V2-M-005 | Feature management | `Feature` model exists; needs dedicated management page |
