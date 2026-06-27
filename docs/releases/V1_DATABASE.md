# Engineering OS — V1 Database Freeze

---

## Overview

| Field | Value |
|---|---|
| **Provider** | SQLite |
| **ORM** | Prisma (v6, `prisma-client` generator) |
| **Schema file** | `prisma/schema.prisma` |
| **Generated client** | `src/generated/prisma/` |
| **Migration state** | Schema applied via `prisma db push` (no migration history files) |
| **Datasource** | `datasource db { provider = "sqlite" }` |

---

## Entity List

| Model | Purpose |
|---|---|
| `User` | Authenticated user — linked to Clerk via `clerkId` |
| `Company` | Top-level org unit; owner references a `User` |
| `Department` | Hierarchical org unit within a company |
| `Role` | Named role with an integer level |
| `Employee` | Company employee; optionally linked to a `User` |
| `CompanySettings` | One-to-one settings for a company |
| `Workspace` | Engineering workspace within a company |
| `Repository` | Code repository registered to a workspace |
| `Project` | Engineering project within a workspace |
| `Feature` | Feature within a project |
| `Task` | Work item; the primary unit of engineering work |
| `Subtask` | Checklist item belonging to a task |
| `Sprint` | Time-boxed iteration within a project |
| `Milestone` | Date-bound goal within a project |
| `Memory` | Named memory bank per company |
| `MemoryRecord` | Individual fact stored in a memory bank |
| `Knowledge` | Global knowledge article |
| `KnowledgeRecord` | Record within a knowledge article |
| `RuntimeRequest` | CEO-submitted work request flowing through the runtime |
| `RuntimeEvent` | Audit event on a runtime request |
| `Conversation` | Chat thread tied to a company |
| `Message` | Chat message within a conversation |
| `Notification` | In-app notification for a user |
| `Event` | Generic event for timeline display |
| `TimelineEntry` | Structured timeline record for any entity |
| `Review` | Code/work review with verdict lifecycle |
| `QAResult` | QA result with per-check pass/fail data |
| `ChangeRequest` | Change request created when a review requests changes |
| `Release` | Release record with checklist and deployment status |
| `Incident` | Production incident record |
| `Integration` | External provider integration per company |
| `IntegrationSyncLog` | Sync log entry for an integration |

---

## Relationships

```
User ──(1)──> Company[] (as owner)
User ──(0..1)──> Employee

Company ──> Department[]
Company ──> Employee[]
Company ──> CompanySettings (1:1)
Company ──> Workspace[]
Company ──> Task[]
Company ──> Memory[]
Company ──> RuntimeRequest[]
Company ──> Conversation[]
Company ──> Integration[]

Department ──> Department[] (self-referential hierarchy via parentId)
Department ──> Employee[]

Role ──> Employee[]

Employee ──> Employee[] (self-referential reporting via managerId)
Employee ──> Task[] (as assignee)

Workspace ──> Project[]
Workspace ──> Repository[]

Project ──> Feature[]
Project ──> Milestone[]
Project ──> Sprint[]
Project ──> Task[]

Feature ──> Task[]

Task ──> Subtask[]

Sprint ──> Task[]

Memory ──> MemoryRecord[]

Knowledge ──> KnowledgeRecord[]

RuntimeRequest ──> RuntimeEvent[]
RuntimeRequest ──> Message[]

Conversation ──> Message[]

Review ──> ChangeRequest[]

Integration ──> IntegrationSyncLog[]
```

---

## Ownership Model

All data access is scoped by `companyId`. The authenticated user's company is resolved via `Company.findFirst({ where: { ownerId: user.id } })` in every server action before any read or write. Cross-company access is prevented by requiring this company resolution step.

Notable ownership enforcement:
- Tasks: `companyId` is set on creation and filtered on all reads/writes
- Reviews and QAResults: task ownership is validated against `companyId` before creation
- Integrations: scoped to `companyId`
- RuntimeRequests: scoped to `companyId`
- Conversations: scoped to `companyId`
- Notifications: scoped to `userId`

---

## Indexes and Constraints

| Model | Unique Constraints |
|---|---|
| `User` | `email`, `clerkId` |
| `Company` | `slug` |
| `Department` | `[companyId, slug]` |
| `Workspace` | `[companyId, slug]` |
| `Employee` | `userId` |
| `CompanySettings` | `companyId` |

All `id` fields use `@id @default(cuid())`.

All models have `createdAt @default(now())` and `updatedAt @updatedAt`.

---

## JSON-serialized Fields

The following fields store structured data as JSON strings within SQLite text columns:

| Model | Field | Type |
|---|---|---|
| `Repository` | `techStack` | `string[]` |
| `Repository` | `frameworks` | `string[]` |
| `Repository` | `dependencies` | `string[]` |
| `Repository` | `importantFiles` | `string[]` |
| `Memory` | `tags` | `string[]` |
| `QAResult` | `checks` | `{ label: string; passed: boolean }[]` |
| `Release` | `checklist` | `{ id: string; label: string; checked: boolean }[]` |
| `Release` | `taskIds` | `string[]` |
| `Integration` | `config` | `Record<string, unknown>` |
| `Integration` | `credentials` | Encrypted string (`iv:tag:ciphertext` hex) |
| `TimelineEntry` | `metadata` | `Record<string, unknown>` |
| `Event` | `metadata` | `Record<string, unknown>` |

---

## Status Enumerations

These are stored as plain strings (no Prisma enum — SQLite limitation):

**Task.status**: `todo` | `in-progress` | `in-review` | `done` | `blocked` | `cancelled`

**Task.priority**: `low` | `medium` | `high` | `urgent`

**Project.status**: `planning` | `active` | `paused` | `done` | `cancelled`

**Employee.status**: `active` | `inactive`

**Employee.workload**: `light` | `normal` | `heavy`

**RuntimeRequest.status**: `intake` | `in_progress` | `awaiting_approval` | `approved` | `rejected` | `complete` | `blocked`

**RuntimeRequest.requestType**: `feature` | `bug` | `architecture` | `security` | `documentation` | `configuration` | `performance` | `question`

**Review.status**: `pending` | `approved` | `changes_requested`

**QAResult.status**: `pending` | `passed` | `failed`

**Release.status**: `draft` | `ready` | `released`

**Release.deploymentStatus**: `not_started` | `deployed` | `rolled_back`

**Integration.status**: `disconnected` | `connected` | `error`

---

## Migration State

V1 uses `prisma db push` for schema synchronization. There are no timestamped migration files under `prisma/migrations/`. The schema is the source of truth.

For V2, migration to PostgreSQL and adoption of `prisma migrate` with versioned migrations is recommended.
