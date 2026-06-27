# Engineering OS — Platform V1 Release Manifest

---

## Product

| Field | Value |
|---|---|
| **Name** | Engineering OS |
| **Version** | 1.0.0 |
| **Release Date** | 2026-06-27 |
| **Repository** | engineering-os |
| **Commit** | `96aae9694e3aa67d0810765e24fbe63ec3795ff0` |
| **Git Tag** | `v1.0.0` |
| **Branch** | `master` |
| **Release Branch** | `release/v1` |

---

## Validation

| Check | Result |
|---|---|
| **Build** | ✅ PASS — `npm run build` exits 0, all routes compiled |
| **Lint** | ✅ PASS — `eslint` exits 0, zero warnings |
| **Typecheck** | ✅ PASS — `tsc --noEmit` exits 0 |
| **TODO scan** | ✅ PASS — zero unfinished-work TODOs in `src/` |
| **Smoke QA** | ✅ PASS — see `docs/qa/smoke-qa-evidence.md` |
| **Manual QA** | ✅ PASS — see `docs/qa/` for full QA evidence |

---

## Features Included

### Authentication & Workspace
- Clerk-based authentication (sign-in, sign-up, session management)
- Middleware-enforced route protection via `src/proxy.ts`
- Company workspace creation on first login
- Onboarding flow with company name, autonomy level, and culture profile

### Company Core
- Company model with owner, slug, logo, industry, description
- Department registry with parent/child hierarchy
- Employee directory with roles, titles, bios, workload, reporting structure
- Company settings (autonomy level, culture profile, timezone, currency, locale)
- Company overview page with department navigation

### CEO Dashboard
- Activity summary: employee count, task counts by status, pending requests
- Timeline of recent events
- Quick-access to blockers and approvals
- Summary of recent releases and integrations

### Company Runtime (Inbox)
- Request intake form with 8 typed categories (feature, bug, architecture, security, documentation, configuration, performance, question)
- Automatic routing to responsible team via `REQUEST_ROUTING` table
- Request lifecycle: intake → in_progress → awaiting_approval → approved/rejected/complete/blocked
- Event log per request
- Notification dispatch on key status transitions

### Company Chat
- Persistent conversation threads per company
- First message auto-creates a `RuntimeRequest` and routes it
- Follow-up messages acknowledged with inbox reference
- Conversation deletion

### Task and Planning Engine
- Projects with status lifecycle (planning, active, paused, done, cancelled)
- Tasks with priority (low, medium, high, urgent) and status lifecycle
- Task assignment to employees with cross-company validation
- Features linked to projects
- Subtasks per task
- Sprints and Milestones per project
- Task status update via inline select

### Repository Intelligence
- Repository registration with name, URL, description, primary language
- Tech stack, frameworks, dependencies, important files stored as JSON arrays
- Analysis status field (pending, analysed)
- Repository overview page

### Memory and Knowledge Engine
- Memory banks per company with categories (company, architecture, product, security, operations, employee, feature, decision)
- Memory records with content, source, and confidence score
- Knowledge base with records in markdown format
- Company-seeded memory banks on initialization

### Notifications
- Notification model: title, body, type, priority, entity reference, action URL, read state
- Mark-read and mark-all-read actions
- Notification center page
- Automatic notification dispatch from runtime, review, and QA flows

### Timeline
- TimelineEntry and Event models for audit trail
- Timeline page showing company activity

### Review and QA Quality Gate
- Review lifecycle: pending → approved / changes_requested
- Review verdict drives task status transitions (approved → in-review; changes_requested → in-progress)
- ChangeRequest records with reason and resolution
- QA Result with per-check pass/fail tracking
- QA pass drives task to `done` status
- Ownership validation — reviews and QA results are company-scoped

### Integrations
- Integration provider registry: Linear, GitHub, Slack, Vercel
- Credential storage with AES-256-GCM encryption
- Sync log per integration
- Connect, disconnect, and trigger-sync actions
- Status tracking: disconnected / connected / error

### Release Lifecycle
- Release model: version, title, description, release notes, rollback plan
- Default checklist: tests, code review, QA validation, docs, rollback plan, deployment verification
- Status lifecycle: draft → ready → released
- Deployment status: not_started → deployed
- Task linkage to releases
- `releasedAt` timestamp on mark-released

### Settings
- Company settings page (autonomy level, culture profile)
- Settings update via server action

---

## Accepted Limitations

| Limitation | Rationale |
|---|---|
| Integration sync is credential-only; no live provider data fetch | V1 scope — data pipeline deferred to V2 |
| AI inference not wired | Architecture designed for it; LLM calls deferred to V2 |
| No team collaboration — single-owner companies only | V1 is single-user; multi-tenant deferred |
| SQLite database | Acceptable for V1 single-instance; PostgreSQL migration in V2 |
| No background jobs or queues | Server actions only; async workers deferred |
| No file uploads or media storage | Out of scope for V1 |
| No real-time updates (WebSocket/SSE) | Polling and revalidation sufficient for V1 |
| Knowledge model is static — no AI retrieval | AI retrieval deferred to V2 |
| No audit log for all mutations | Basic event/timeline logging only |
| No role-based access control beyond company ownership | Owner-only model; RBAC deferred |

---

## Security Decisions

| Area | Decision |
|---|---|
| **Authentication** | Clerk — externally managed identity, session tokens handled by Clerk SDK |
| **Authorization** | All server actions verify the current user owns the company before any mutation |
| **Cross-company isolation** | Every data read and write scopes to `companyId` tied to the authenticated user |
| **Credential encryption** | AES-256-GCM with per-value random IV; key loaded from `CREDENTIALS_ENCRYPTION_KEY` env var |
| **Input validation** | Zod schemas on all server action inputs; max lengths enforced |
| **Route protection** | Clerk middleware enforces authentication on all non-public routes |
| **Entity ownership validation** | Reviews and QA results validate task belongs to user's company before creating |
| **Assignee validation** | Task creation validates assignee belongs to the same company |

---

## Documentation Index

| Document | Path |
|---|---|
| README | `README.md` |
| Vision | `docs/vission/VISSION.md` |
| Operating System | `docs/company/COMPANY_OPERATING_SYSTEM.md` |
| Playbook | `docs/company/COMPANY_PLAYBOOK.md` |
| Organization | `docs/organization/ORGANIZATION.md` |
| Departments | `docs/organization/DEPARTMENTS.md` |
| Reporting Structure | `docs/organization/REPORTING_STRUCTURE.md` |
| Responsibility Matrix | `docs/organization/RESPONSIBILITY_MATRIX.md` |
| Employee Directory | `docs/organization/EMPLOYEE_DIRECTORY.md` |
| Employee Handbook | `docs/company/EMPLOYEE_TEMPLATE.md` |
| Technical Architecture | `docs/architecture/TECHNICAL_ARCHITECTURE.md` |
| Domain Model | `docs/architecture/DOMAIN_MODEL.md` |
| Information Architecture | `docs/architecture/INFORMATION_ARCHITECTURE.md` |
| Company Runtime | `docs/architecture/COMPANY_RUNTIME.md` |
| ADR-001 | `docs/adr/ADR-001-execution-runtime-and-memory-retrieval.md` |
| V1 Scope | `docs/v1-scope.md` |
| MVP Roadmap | `docs/product/MVP_ROADMAP.md` |
| Product Requirements | `docs/product/PRODUCT_REQUIREMENTS.md` |
| QA: Smoke | `docs/qa/smoke-qa-evidence.md` |
| QA: Workflow | `docs/qa/workflow-qa.md` |
| QA: Task Model | `docs/qa/task-model-qa.md` |
| QA: Employee/Company | `docs/qa/employee-company-qa.md` |
| QA: Integration/Repository | `docs/qa/integration-repository-qa.md` |
| SOP: Bug Fix | `docs/sops/BUG_FIX.md` |
| SOP: Code Review | `docs/sops/CODE_REVIEW.md` |
| SOP: New Feature | `docs/sops/NEW_FEATURE.md` |
| SOP: QA Validation | `docs/sops/QA_VALIDATION.md` |
| SOP: Release | `docs/sops/RELEASE.md` |
| SOP: Rollback | `docs/sops/ROLLBACK.md` |
| Release Manifest | `docs/releases/V1_RELEASE_MANIFEST.md` |
| Database Freeze | `docs/releases/V1_DATABASE.md` |
| API Surface Freeze | `docs/releases/V1_API.md` |
| UI Freeze | `docs/releases/V1_UI.md` |
| Architecture Freeze | `docs/releases/V1_ARCHITECTURE.md` |
| Scope Freeze | `docs/releases/V1_SCOPE.md` |
| Technical Debt | `docs/releases/V1_TECHNICAL_DEBT.md` |
| V2 Backlog | `docs/releases/V2_BACKLOG.md` |
| Cleanup Recommendations | `docs/releases/V1_CLEANUP.md` |

---

## Architecture Snapshot

| Subsystem | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Runtime | Node.js (Vercel Fluid Compute compatible) |
| Database | SQLite via Prisma ORM |
| Authentication | Clerk |
| Styling | Tailwind CSS |
| Validation | Zod |
| Credential Encryption | AES-256-GCM (Node.js crypto) |
| Middleware | Clerk middleware (`src/proxy.ts`) |
| Server Actions | Next.js Server Actions (all mutations) |
| Generated Client | Prisma generated TypeScript client (`src/generated/prisma/`) |

---

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| SQLite not suitable for concurrent production writes | Medium | Acceptable for V1 single-user; migrate to PostgreSQL in V2 |
| No background job queue | Low | All work is synchronous; no long-running operations in V1 |
| Credentials encryption key loss = unrecoverable credentials | High | Key must be stored in a secrets manager; document in ops runbook |
| No rate limiting on server actions | Medium | Low traffic expected; add in V2 with middleware |
| Integration sync logs show honest "not yet implemented" message | Low | Accurately documents V1 state; no false data shown to user |

---

## Future Work

All deferred features are catalogued in `docs/releases/V2_BACKLOG.md`.

Platform V2 development begins after this freeze is complete and the `release/v1` branch is created.
