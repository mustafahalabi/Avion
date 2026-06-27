# Engineering OS — V1 Architecture Freeze

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Client                      │
│         React Server Components + Client Components      │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────┐
│                  Next.js App Router                      │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  (auth)      │  │    (app)     │  │  Server Actions│  │
│  │  /sign-in   │  │  /dashboard  │  │  work.ts       │  │
│  │  /sign-up   │  │  /inbox      │  │  runtime.ts    │  │
│  │  /onboarding│  │  /chat       │  │  quality.ts    │  │
│  └─────────────┘  │  /work       │  │  releases.ts   │  │
│                   │  /company    │  │  memory.ts     │  │
│                   │  /memory     │  │  integrations  │  │
│                   │  /integrations│  │  notifications │  │
│                   │  /notifications│  │  chat.ts      │  │
│                   │  /settings   │  │  repository.ts │  │
│                   │  /timeline   │  └────────────────┘  │
│                   └──────────────┘                       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   Middleware (proxy.ts)                   │
│             Clerk — route protection                     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                      Prisma ORM                          │
│              src/generated/prisma/ (client)              │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    SQLite Database                        │
│                 (prisma.config.ts / .env)                │
└─────────────────────────────────────────────────────────┘
```

---

## Subsystems

### 1. Authentication Subsystem
- **Provider**: Clerk
- **Middleware**: `src/proxy.ts` — Clerk middleware wraps all routes; public routes (sign-in, sign-up) bypass protection; all others require session
- **User resolution**: `src/lib/current-user.ts` upserts a `User` record on every authenticated request, syncing name, email, and image from Clerk
- **Session**: Clerk manages JWTs; the application does not store session tokens

### 2. Data Access Subsystem
- **ORM**: Prisma with generated TypeScript client at `src/generated/prisma/`
- **Client singleton**: `src/lib/prisma.ts` exports a singleton Prisma client
- **Database**: SQLite for V1
- **Schema**: `prisma/schema.prisma` — single source of truth; applied via `prisma db push`
- **Company isolation**: Every query is scoped to `company.ownerId === user.id` — enforced in each server action

### 3. Server Action Subsystem
- **Pattern**: Next.js Server Actions (React `"use server"` directive)
- **Location**: `src/app/actions/` for global actions; inline in route segments for local actions
- **Validation**: Zod schemas on all inputs
- **Authorization**: Every action calls `getCurrentUser()` then resolves the user's company before any DB operation
- **Revalidation**: `revalidatePath()` called after every mutation to keep server-rendered pages fresh

### 4. Notification Subsystem
- **Model**: `Notification` — per-user, typed (info, warning, alert, decision, progress, blocker), prioritized, with entity reference and action URL
- **Dispatch**: `src/lib/notify.ts` — `notify()` for standalone calls; `notifyInTx()` for transactional dispatch
- **Consumers**: Runtime actions dispatch notifications on intake, awaiting_approval, blocked, complete; review actions dispatch on changes_requested

### 5. Company Runtime Subsystem
- **Purpose**: Structured intake for CEO requests
- **Flow**: Submit request → auto-route by type → lifecycle events → CEO approves/rejects
- **Routing**: `src/lib/request-routing.ts` maps request type to responsible team
- **Entities**: `RuntimeRequest`, `RuntimeEvent`
- **Chat bridge**: First message in a `Conversation` auto-creates a `RuntimeRequest`

### 6. Memory Subsystem
- **Purpose**: Persistent company knowledge organized into named banks
- **Entities**: `Memory` (bank), `MemoryRecord` (individual facts), `Knowledge`, `KnowledgeRecord`
- **Seeding**: `src/lib/company-seed.ts` initializes default memory banks on company creation
- **V1 limitation**: Memory is written and read by humans only; no AI retrieval in V1

### 7. Quality Gate Subsystem
- **Flow**: Task → Review (code review) → QAResult (QA pass/fail) → Task status transitions automatically
- **Review lifecycle**: `pending` → `approved` (task → `in-review`) | `changes_requested` (task → `in-progress`)
- **QA lifecycle**: `pending` → `passed` (task → `done`) | `failed`
- **Ownership validation**: Both Review and QAResult creation verify task belongs to user's company

### 8. Release Subsystem
- **Entities**: `Release` with version, checklist, task references, release notes, rollback plan
- **Lifecycle**: `draft` → `ready` (all checklist items checked) → `released`
- **Default checklist**: 6 items — tests, code review, QA, docs, rollback plan, deployment verification
- **Task linkage**: Task IDs stored as JSON array in `Release.taskIds`

### 9. Integration Subsystem
- **Providers**: Linear, GitHub, Slack, Vercel (credential-only in V1)
- **Security**: AES-256-GCM encryption via `src/lib/credentials-crypto.ts`; key from env
- **V1 limitation**: Credentials stored and validated; no live data sync implemented
- **Sync log**: Every connect/disconnect/sync-request creates an `IntegrationSyncLog` entry

### 10. Repository Intelligence Subsystem
- **Purpose**: Register and describe code repositories
- **Entities**: `Repository` with metadata, tech stack arrays, analysis status
- **V1 limitation**: Analysis is manual; no automated repository scanning

---

## Data Flow

### Authenticated Request
```
Browser → Clerk middleware → Route handler → getCurrentUser() → Company.findFirst() → DB query → RSC render → Browser
```

### Mutation (Server Action)
```
Form submit → Server Action → getCurrentUser() → Company resolution → Zod validation → DB write → revalidatePath() → Return state
```

### Notification Flow
```
Server Action mutation → notify() → Notification.create() → Notification Center page reflects new record
```

---

## Authentication Flow

```
1. User visits any protected route
2. Clerk middleware (proxy.ts) checks session cookie
3. If no session → redirect to /sign-in
4. If session → request proceeds
5. Server component calls getCurrentUser()
6. getCurrentUser() calls Clerk auth() → gets clerkId
7. Upsert User record with latest name/email/image from Clerk
8. Return User record to caller
9. Caller resolves Company via User.id
```

---

## Planning Flow

```
1. User submits request via Inbox form or Chat
2. submitRequest() or sendMessage() creates RuntimeRequest
3. requestType → REQUEST_ROUTING → assignedTo team
4. RuntimeEvent (intake) created
5. Notification dispatched to user
6. CEO views Inbox → advanceRequestStatus() moves through lifecycle
7. CEO approves → task created manually or via project board
```

---

## Runtime Flow

```
RuntimeRequest lifecycle:
  intake → in_progress → awaiting_approval → approved → complete
                     ↘ blocked
                     ↘ rejected
```

---

## Memory Flow

```
1. Company seeded with default memory banks on creation
2. User navigates to /memory → sees all memory banks
3. User creates new memory bank with category
4. User adds records (facts) with source and confidence
5. Memory banks are browsable and searchable in UI
```

---

## Review Flow

```
1. Task exists in a project
2. User creates Review linked to task
3. Reviewer submits verdict:
   - approved → task status → in-review
   - changes_requested → ChangeRequest created → task → in-progress → notification sent
4. QA creates QAResult with per-check pass/fail
5. QA marks passed → task → done
```

---

## Release Flow

```
1. User creates Release with version number
2. Default 6-item checklist initialized
3. User checks off checklist items → status auto-advances to "ready" when all done
4. User writes release notes and rollback plan
5. User links relevant tasks to release
6. Release button enabled when checklist complete
7. markReleased() → status: released, deploymentStatus: deployed, releasedAt: now()
```

---

## Integration Flow

```
1. User visits /integrations → sees 4 providers
2. User navigates to provider detail
3. User fills connect form with credentials
4. connectIntegration() validates provider, encrypts credentials, upserts Integration
5. Sync log entry created
6. Status shows "connected"
7. triggerSync() creates a log entry (live sync not implemented in V1)
8. disconnectIntegration() clears credentials, sets status disconnected
```

---

## Repository Flow

```
1. User navigates to /work/repositories/new
2. Fills form: name, URL, language, tech stack (CSV), etc.
3. addRepository() converts CSVs to JSON arrays, sets analysisStatus: pending
4. Repository detail page shows metadata as badge lists
5. Analysis is manual in V1 — engineer updates fields directly
```
