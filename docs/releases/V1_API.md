# Engineering OS — V1 API Surface Freeze

All mutations are Next.js Server Actions. There are no REST or GraphQL endpoints. Authentication is enforced on every action via `getCurrentUser()` (Clerk).

---

## Convention

Every server action follows this pattern:
1. Call `getCurrentUser()` — returns `null` if unauthenticated; action returns early
2. Resolve the user's company via `Company.findFirst({ where: { ownerId: user.id } })`
3. Validate and scope all reads/writes to that company
4. Return a typed state object or `void`

---

## Work Actions (`src/app/actions/work.ts`)

### `createProject(prev, formData)`
- **Purpose**: Create a new engineering project in the user's workspace
- **Input**: `name` (required, max 200), `description` (optional, max 1000), `status` (enum)
- **Output**: Redirects to `/work/projects/[id]` on success; returns `{ errors }` on validation failure
- **Authorization**: Authenticated user; resolves company and workspace
- **Validation**: Zod schema; slug auto-generated from name
- **Failure modes**: Not authenticated, no workspace found, validation errors

### `createTask(projectId, prev, formData)`
- **Purpose**: Create a task within a project
- **Input**: `title` (required, max 500), `description` (optional, max 5000), `assigneeId` (optional), `priority` (enum), `featureId` (optional), `status` (enum)
- **Output**: Redirects to `/work/projects/[projectId]` on success; returns `{ errors }` on failure
- **Authorization**: Project must belong to user's workspace; assignee must belong to user's company; feature must belong to project
- **Validation**: Zod schema; cross-company injection prevention on assignee and feature
- **Failure modes**: Not authenticated, project not found, feature not found, assignee not in company

### `updateTaskStatus(taskId, status)`
- **Purpose**: Update a task's status
- **Input**: `taskId` (string), `status` (string)
- **Output**: `void`
- **Authorization**: Task must belong to user's company (`updateMany` with `companyId` filter)
- **Failure modes**: Silent — returns if unauthenticated or company not found

---

## Runtime Actions (`src/app/actions/runtime.ts`)

### `submitRequest(prev, formData)`
- **Purpose**: Submit a new CEO/company runtime request
- **Input**: `title` (required, max 300), `goal` (required, max 5000), `requestType` (enum of 8 types)
- **Output**: Returns `{ id }` on success; `{ errors }` on validation failure
- **Authorization**: Authenticated user; company resolved
- **Side effects**: Creates `RuntimeEvent` (intake); dispatches notification to user
- **Failure modes**: Not authenticated, company not found, validation errors

### `advanceRequestStatus(requestId, newStatus, description)`
- **Purpose**: Move a runtime request through its lifecycle
- **Input**: `requestId`, `newStatus` (string), `description` (string)
- **Output**: `void`
- **Authorization**: Request must belong to user's company
- **Side effects**: Creates `RuntimeEvent`; dispatches notification for `awaiting_approval`, `blocked`, `complete` transitions
- **Failure modes**: Silent — returns if unauthenticated, company not found, or request not found

---

## Quality Actions (`src/app/actions/quality.ts`)

### `createReview(prev, formData)`
- **Purpose**: Create a code/work review for a task
- **Input**: `entityId` (task ID), `entityType` (literal "task"), `title` (required, max 300), `reviewerId` (optional)
- **Output**: `{ success: true, id }` or `{ error: string }`
- **Authorization**: Task must belong to user's company (ownership validated)
- **Failure modes**: Not authenticated, company not found, task not found or not accessible, validation errors

### `submitReviewVerdict(reviewId, verdict, notes)`
- **Purpose**: Submit an approved or changes-requested verdict on a review
- **Input**: `reviewId`, `verdict` ("approved" | "changes_requested"), `notes` (string)
- **Output**: `void`
- **Authorization**: Review must belong to user's company
- **Side effects**:
  - `approved` → task status → `in-review`
  - `changes_requested` → creates `ChangeRequest`; task status → `in-progress`; dispatches notification
- **Failure modes**: Silent — returns if unauthenticated, company not found, or review not found

### `createQAResult(prev, formData)`
- **Purpose**: Create a QA result for a task with per-check pass/fail data
- **Input**: `entityId` (task ID), `entityType` (literal "task"), `checks` (JSON string of `{ label, passed }[]`)
- **Output**: `{ success: true, id }` or `{ error: string }`
- **Authorization**: Task must belong to user's company (ownership validated)
- **Failure modes**: Not authenticated, company not found, task not found or not accessible

### `updateQAStatus(qaId, status, notes)`
- **Purpose**: Manually update a QA result's status
- **Input**: `qaId`, `status` (string), `notes` (string)
- **Output**: `void`
- **Authorization**: QA result must belong to user's company
- **Side effects**: If `status === "passed"` and `entityType === "task"`, task status → `done`
- **Failure modes**: Silent — returns if unauthenticated, company not found, or QA result not found

---

## Release Actions (`src/app/actions/releases.ts`)

### `createRelease(prev, formData)`
- **Purpose**: Create a new release record
- **Input**: `version` (required, max 50), `title` (optional, max 300), `description` (optional, max 2000)
- **Output**: `{ success: true, id }` or `{ error: string }`
- **Authorization**: Authenticated user; company resolved
- **Side effects**: Initializes with default 6-item checklist; status `draft`, deploymentStatus `not_started`
- **Failure modes**: Not authenticated, company not found, validation errors

### `updateReleaseChecklist(releaseId, checklist)`
- **Purpose**: Update the release checklist items; auto-advances status to `ready` when all checked
- **Input**: `releaseId`, `checklist` (`{ id, label, checked }[]`)
- **Output**: `void`
- **Authorization**: Release must belong to user's company (`updateMany`)
- **Failure modes**: Silent

### `updateReleaseNotes(releaseId, releaseNotes, rollbackPlan)`
- **Purpose**: Save release notes and rollback plan
- **Input**: `releaseId`, `releaseNotes` (string), `rollbackPlan` (string)
- **Output**: `void`
- **Authorization**: Release must belong to user's company (`updateMany`)
- **Failure modes**: Silent

### `markReleased(releaseId)`
- **Purpose**: Mark a release as deployed
- **Input**: `releaseId`
- **Output**: `void`
- **Authorization**: Release must belong to user's company (`updateMany`)
- **Side effects**: Sets `status: released`, `deploymentStatus: deployed`, `releasedAt: now()`
- **Failure modes**: Silent

### `addTaskToRelease(releaseId, taskId)`
- **Purpose**: Link a task to a release
- **Input**: `releaseId`, `taskId`
- **Output**: `void`
- **Authorization**: Release and task must belong to user's company; deduplication enforced
- **Failure modes**: Silent

### `removeTaskFromRelease(releaseId, taskId)`
- **Purpose**: Unlink a task from a release
- **Input**: `releaseId`, `taskId`
- **Output**: `void`
- **Authorization**: Release must belong to user's company
- **Failure modes**: Silent

---

## Memory Actions (`src/app/actions/memory.ts`)

### `createMemory(prev, formData)`
- **Purpose**: Create a new memory bank
- **Input**: `title` (required, max 200), `summary` (optional, max 2000), `category` (enum of 8 categories)
- **Output**: Redirects to `/memory/[id]` on success; returns `{ errors }` on failure
- **Authorization**: Authenticated user; company resolved
- **Failure modes**: Not authenticated, company not found, validation errors

### `addMemoryRecord(memoryId, prev, formData)`
- **Purpose**: Add a fact record to a memory bank
- **Input**: `content` (required, max 10000), `source` (optional, max 500), `confidence` (number 0–1)
- **Output**: `undefined` (success) or `{ errors }`
- **Authorization**: Memory must belong to user's company
- **Failure modes**: Not authenticated, company not found, memory not found, validation errors

---

## Integration Actions (`src/app/actions/integrations.ts`)

### `connectIntegration(prev, formData)`
- **Purpose**: Save credentials and connect an integration provider
- **Input**: `provider` (string matching a registered provider ID); provider-specific credential fields
- **Output**: `{ success: true, id }` or `{ error: string }`
- **Authorization**: Authenticated user; company resolved; unknown providers rejected
- **Side effects**: Credentials encrypted with AES-256-GCM; upserts integration; logs sync event
- **Failure modes**: Unknown provider, missing required credential fields, encryption key not configured, company not found

### `disconnectIntegration(integrationId)`
- **Purpose**: Disconnect an integration and clear credentials
- **Input**: `integrationId`
- **Output**: `void`
- **Authorization**: Integration must belong to user's company
- **Side effects**: Clears credentials to `{}`; logs disconnect event
- **Failure modes**: Silent — returns if unauthenticated or integration not found

### `triggerSync(integrationId)`
- **Purpose**: Request a sync (V1: logs intent only; no live data fetch)
- **Input**: `integrationId`
- **Output**: `{ message: string }`
- **Authorization**: Integration must belong to user's company; must be in `connected` status
- **Side effects**: Creates sync log entry documenting that live sync is not yet implemented
- **Failure modes**: Not authenticated, company not found, integration not found, not connected

---

## Notification Actions (`src/app/actions/notifications.ts`)

### `markNotificationRead(notificationId)`
- **Purpose**: Mark a single notification as read
- **Input**: `notificationId`
- **Output**: `void`
- **Authorization**: Notification must belong to current user (`updateMany` with `userId` filter)
- **Failure modes**: Silent

### `markAllRead()`
- **Purpose**: Mark all unread notifications as read for the current user
- **Input**: none
- **Output**: `void`
- **Authorization**: Scoped to current user
- **Failure modes**: Silent

---

## Chat Actions (`src/app/actions/chat.ts`)

### `createConversation()`
- **Purpose**: Create a new conversation thread
- **Input**: none
- **Output**: `{ id: string }`
- **Authorization**: Authenticated user; company resolved; redirects to `/sign-in` or `/onboarding` if not ready
- **Failure modes**: Redirect on missing auth or company

### `sendMessage(conversationId, prev, formData)`
- **Purpose**: Send a message in a conversation
- **Input**: `content` (required, max 2000), `requestType` (string)
- **Output**: `{ conversationId }` or `{ error: string }`
- **Authorization**: Conversation must belong to user's company
- **Side effects**: First message → auto-creates `RuntimeRequest` + `RuntimeEvent`; sets conversation title; sends company acknowledgement message. Subsequent messages → sends follow-up acknowledgement
- **All writes in a single `$transaction`**
- **Failure modes**: Not authenticated, company not found, conversation not found, validation errors

### `deleteConversation(conversationId)`
- **Purpose**: Delete a conversation and redirect to chat list
- **Input**: `conversationId`
- **Output**: `void` (redirects to `/chat`)
- **Authorization**: Conversation must belong to user's company (`deleteMany`)
- **Failure modes**: Silent if not found

---

## Repository Actions (`src/app/actions/repository.ts`)

### `addRepository(prev, formData)`
- **Purpose**: Register a code repository
- **Input**: `name` (required, max 200), `url` (optional URL), `description` (optional), `primaryLanguage` (optional), `techStack` (CSV), `frameworks` (CSV), `dependencies` (CSV), `importantFiles` (CSV)
- **Output**: Redirects to `/work/repositories/[id]` on success; returns `{ errors }` on failure
- **Authorization**: Authenticated user; company and workspace resolved
- **Side effects**: CSV fields converted to JSON arrays; `analysisStatus` set to `pending`
- **Failure modes**: Not authenticated, no workspace found, validation errors

---

## Onboarding Actions (`src/app/(auth)/onboarding/actions.ts`)

### `saveOnboardingSettings({ companyId, name, autonomyLevel, cultureProfile })`
- **Purpose**: Save company name and settings during initial onboarding
- **Input**: `companyId`, `name`, `autonomyLevel`, `cultureProfile`
- **Output**: `void` (throws on error)
- **Authorization**: Company must belong to current user
- **Failure modes**: Throws "Unauthenticated" or "Company not found"

### `saveCompanySettings({ companyId, autonomyLevel, cultureProfile })`
- **Purpose**: Update company settings post-onboarding
- **Input**: `companyId`, `autonomyLevel`, `cultureProfile`
- **Output**: `void` (throws on error)
- **Authorization**: Company must belong to current user
- **Failure modes**: Throws "Unauthenticated" or "Company not found"

---

## Internal Utilities

### `getCurrentUser()` — `src/lib/current-user.ts`
- Resolves Clerk session; upserts `User` record in DB; returns null if unauthenticated

### `notify()` / `notifyInTx()` — `src/lib/notify.ts`
- Creates a `Notification` record; `notifyInTx` runs inside a Prisma transaction

### `encryptCredentials()` / `decryptCredentials()` — `src/lib/credentials-crypto.ts`
- AES-256-GCM encryption/decryption for integration credentials
- Requires `CREDENTIALS_ENCRYPTION_KEY` env var (64-char hex)

### `REQUEST_ROUTING` — `src/lib/request-routing.ts`
- Maps `requestType` → responsible team name for inbox routing
