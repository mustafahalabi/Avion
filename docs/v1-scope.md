# Engineering OS Platform v1 — Scope and Deferrals

This document records what is intentionally not implemented in V1, why, and what the constrained behavior is. The UI reflects these constraints truthfully and does not imply unsupported features are complete.

---

## Repository Intelligence

**V1 behavior:** Repository records store manually entered metadata — name, URL, description, primary language, tech stack, frameworks, dependencies, and important files. All values are user-provided. The `analysisStatus` field is set to `"pending"` on creation.

**Not in V1:**
- Automated file tree import from a GitHub/GitLab provider
- Static analysis of repository contents
- Automatic dependency detection
- File count or structure extraction

**UI truth:** The repository detail page shows `analysisStatus: pending` and does not present manually entered data as analyzed intelligence. The "add repository" form labels fields as metadata inputs, not analyzed output.

---

## Integrations — Live Provider Sync

**V1 behavior:** Integration credentials are encrypted with AES-256-GCM and stored. Connecting an integration saves credentials and logs the action. Triggering sync logs a "sync requested" event but does not fetch any data from the provider.

**Not in V1:**
- OAuth flows
- Live data import from Linear, GitHub, Slack, or Vercel
- Webhook ingestion
- Automatic project/issue/PR sync

**UI truth:** Integration list page says "Live provider sync is not active in V1." Sync button and logs show truthful "no provider sync" messages.

**Error handling:** If `CREDENTIALS_ENCRYPTION_KEY` is missing or misconfigured, `connectIntegration` returns a controlled user-facing error instead of an unhandled exception.

---

## Task Dependencies and Planning Output

**V1 behavior:** Tasks have `projectId` (direct project task) or `featureId` (feature-level task). All tasks are visible across work surfaces (dashboard, /work, /work/projects, project detail).

**Not in V1:**
- Task-to-task dependency edges (blocks/blocked-by)
- Gantt or critical path views
- Sprint planning output or auto-scheduling
- Planning goal model beyond sprint goal field

**UI truth:** No dependency or planning UI is rendered. Sprint model (`Sprint.goal`) exists in the schema and is available for future use.

**Deferral note:** Dependency model would require a `TaskDependency` join table. This is schema-ready but deferred to V2.

---

## Knowledge Base

**V1 behavior:** `Knowledge` and `KnowledgeRecord` models exist in the schema. No UI, actions, or API endpoints expose them.

**Not in V1:**
- Knowledge base browsing UI
- Knowledge record creation or search
- AI-assisted knowledge extraction

**UI truth:** No Knowledge navigation item or page exists. The schema is reserved for V2.

---

## Runtime — Delegation, Collaboration, Escalation Persistence

**V1 behavior:** The runtime engine records request status transitions and events via `RuntimeRequest` and `RuntimeEvent`. Requests flow through: intake → planning → awaiting\_approval → executing → in\_review → in\_qa → complete.

**Not in V1:**
- Persisted delegation assignments beyond `assignedTo` string
- Collaboration or multi-agent coordination records
- Escalation chains or escalation entity
- Structured clarification threads beyond `clarification` field
- Completion certificates or sign-off records

**UI truth:** The inbox/request detail shows status, events, and clarification text. No delegation tree or escalation log is rendered.

---

## Chat — Task and Decision Links

**V1 behavior:** Chat messages (`Message`) are linked to a `RuntimeRequest` via `requestId`. Conversations are scoped to a company.

**Not in V1:**
- Message links to `Task`, `Decision`, or `TimelineEntry`
- Per-task chat threads
- Decision record entity

**UI truth:** Chat is scoped to runtime requests only. No task-chat or decision-chat UI exists.

---

## Reporting and Generated Summaries

**V1 behavior:** Timeline page shows `RuntimeEvent` records. No report records are persisted.

**Not in V1:**
- Generated report entity or storage
- PDF/markdown export
- Automated weekly or sprint summaries
- AI-generated narrative reports

**UI truth:** The timeline page shows raw events only. No report generation button or UI exists.

---

## Employee Operational Fields

**V1 behavior:** Employees have: `name`, `title`, `mission`, `bio`, `responsibilities`, `workload`, `status`, `reportsTo` (string fallback), `managerId` (relational). The detail page shows all populated fields and a relational manager link where available.

**Not in V1 (formally deferred):**
- `authority` structured field (decision-making authority level)
- `confidence` field (performance confidence score)
- `activitySummary` (AI-generated activity digest)
- Employee memory references surface (link from employee to Memory records)

**Schema note:** These fields are not in the Prisma schema in V1. Adding them requires a migration. They are planned for V2 alongside the Knowledge base and reporting engine.

**UI truth:** The employee detail page does not show absent fields or imply they exist.
