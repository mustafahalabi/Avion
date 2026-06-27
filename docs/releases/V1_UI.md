# Engineering OS — V1 UI Freeze

---

## Overview

Engineering OS is a server-rendered Next.js App Router application. All pages are dynamically rendered (`ƒ` in the build output). The UI is organized into two route groups: `(auth)` for unauthenticated flows and `(app)` for the authenticated platform.

---

## Navigation

The authenticated shell (`src/app/(app)/layout.tsx`) includes:
- Left sidebar (`src/components/nav/sidebar.tsx`) with navigation links to all major sections
- User menu (`src/components/nav/user-menu.tsx`) with Clerk user controls

### Sidebar Sections

| Section | Route |
|---|---|
| Dashboard | `/dashboard` |
| Inbox | `/inbox` |
| Chat | `/chat` |
| Work → Projects | `/work/projects` |
| Work → Tasks | `/work/tasks` |
| Work → Repositories | `/work/repositories` |
| Work → Quality | `/work/quality` |
| Work → Releases | `/work/releases` |
| Company | `/company` |
| Memory | `/memory` |
| Integrations | `/integrations` |
| Notifications | `/notifications` |
| Timeline | `/timeline` |
| Settings | `/settings` |

---

## Auth Pages

### Sign-In — `/sign-in/[[...sign-in]]`
- Clerk-hosted sign-in component
- Catch-all slug supports Clerk's multi-step flows

### Sign-Up — `/sign-up/[[...sign-up]]`
- Clerk-hosted sign-up component

### Register — `/register`
- Static page (pre-Clerk redirect pattern)

### Onboarding — `/onboarding`
- Multi-step onboarding form: company name, autonomy level, culture profile
- Saves via `saveOnboardingSettings` server action
- Redirects to `/dashboard` on completion

---

## Dashboard — `/dashboard`

- CEO overview: summary cards (employees, tasks by status, pending requests)
- Recent runtime requests panel
- Recent notifications panel
- Recent releases panel
- Loading state: `src/app/(app)/dashboard/loading.tsx`

---

## Inbox — `/inbox`

### Inbox List — `/inbox`
- Lists all `RuntimeRequest` records for the company
- Status badges and request type labels
- Request submission form (`src/app/(app)/inbox/request-form.tsx`): title, goal, request type dropdown

### Request Detail — `/inbox/requests/[id]`
- Full request view: title, goal, type, status, assigned team, clarification, resolution
- Event log timeline
- Status advance controls (`src/app/(app)/inbox/requests/[id]/request-status-controls.tsx`): buttons to move through lifecycle stages

- Loading state: `src/app/(app)/inbox/loading.tsx`

---

## Chat — `/chat`

### Chat List — `/chat`
- Lists all conversations for the company
- New conversation button (`src/app/(app)/chat/new-conversation-button.tsx`): creates a conversation and navigates to it

### Chat Thread — `/chat/[id]`
- Message thread with user and company messages
- `request_created` message type shows a special card linking to the created runtime request
- Chat input form (`src/app/(app)/chat/[id]/chat-input.tsx`): content field, request type selector, send button

---

## Company — `/company`

### Company Overview — `/company`
- Company name, description, industry, website
- Department cards with employee count
- Quick-link to employee directory
- Loading state: `src/app/(app)/company/loading.tsx`

### Department Detail — `/company/departments/[slug]`
- Department description and hierarchy
- Employee list for the department

### Employee Directory — `/company/employees`
- Grid/list of all employees
- Status badges, role, title, department

### Employee Detail — `/company/employees/[id]`
- Employee profile: name, title, mission, bio, responsibilities
- Workload, status, start date
- Reporting chain (manager, direct reports)
- Assigned tasks list

---

## Work — `/work`

### Work Hub — `/work`
- Overview: project count, task counts, repository count, pending quality items
- Loading state: `src/app/(app)/work/loading.tsx`

### Projects List — `/work/projects`
- All projects: name, status, description, task count
- Link to create new project

### New Project — `/work/projects/new`
- Form: name (required), description, status
- `src/app/(app)/work/projects/new/new-project-form.tsx`

### Project Detail — `/work/projects/[id]`
- Project info: name, slug, status, description
- Task list with status and priority
- Add task form: `src/app/(app)/work/projects/[id]/add-task-form.tsx`

### Task Detail — `/work/tasks/[id]`
- Task title, description, priority, status
- Inline status select: `src/app/(app)/work/tasks/[id]/task-status-select.tsx`
- Assigned employee
- Linked reviews
- Linked QA results
- Subtask checklist

### Repositories List — `/work/repositories`
- All repositories: name, description, language, analysis status

### Add Repository — `/work/repositories/new`
- Form: name, URL, description, primary language, tech stack (CSV), frameworks (CSV), dependencies (CSV), important files (CSV)
- `src/app/(app)/work/repositories/new/add-repository-form.tsx`

### Repository Detail — `/work/repositories/[id]`
- Repository overview: name, URL, description, language
- Tech stack, frameworks, dependencies, important files as badge lists
- Analysis status

### Quality List — `/work/quality`
- Reviews tab: all reviews with status badges and entity references
- QA Results tab: all QA results with pass/fail counts

### Review Detail — `/work/quality/[id]`
- Review title, entity reference, status, verdict, notes
- Verdict form (`src/app/(app)/work/quality/[id]/review-verdict-form.tsx`): approve / request changes with notes

### Releases List — `/work/releases`
- All releases: version, title, status, deployment status, released date

### New Release — `/work/releases/new`
- Form: version (required), title, description
- `src/app/(app)/work/releases/new/new-release-form.tsx`

### Release Detail — `/work/releases/[id]`
- Release info: version, title, description, status
- Checklist: `src/app/(app)/work/releases/[id]/release-checklist.tsx` — checkboxes auto-advance status to `ready` when all checked
- Release notes editor: `src/app/(app)/work/releases/[id]/release-notes-form.tsx` — notes and rollback plan
- Tasks section: `src/app/(app)/work/releases/[id]/release-tasks-section.tsx` — link/unlink tasks
- Release button: `src/app/(app)/work/releases/[id]/release-button.tsx` — marks released when checklist complete

---

## Memory — `/memory`

### Memory List — `/memory`
- All memory banks: title, category, record count
- Link to create new memory bank
- Loading state: `src/app/(app)/memory/loading.tsx`

### New Memory Bank — `/memory/new`
- Form: title (required), summary, category
- `src/app/(app)/memory/new/new-memory-form.tsx`

### Memory Bank Detail — `/memory/[id]`
- Memory bank info: title, summary, category
- Memory records list: content, source, confidence
- Add record form: `src/app/(app)/memory/[id]/add-record-form.tsx`

---

## Integrations — `/integrations`

### Integrations List — `/integrations`
- All integrations: name, provider, status badge, last sync
- Provider cards for configured providers

### Integration Detail — `/integrations/[id]`
- Provider info: name, category, description, docs link
- Connect form (`src/app/(app)/integrations/[id]/connect-form.tsx`): provider-specific credential fields
- Sync button (`src/app/(app)/integrations/[id]/sync-button.tsx`): triggers sync log
- Disconnect button (`src/app/(app)/integrations/[id]/disconnect-button.tsx`)
- Sync log history

---

## Notifications — `/notifications`

- All notifications for the current user: title, body, type badge, priority, timestamp, read state
- Mark-read button per notification: `src/app/(app)/notifications/mark-read-button.tsx`
- Mark-all-read button: `src/app/(app)/notifications/mark-all-read-button.tsx`

---

## Timeline — `/timeline`

- Chronological timeline of `TimelineEntry` and `Event` records
- Entity type labels, event type badges, summary text

---

## Settings — `/settings`

- Company settings form: `src/app/(app)/settings/settings-form.tsx`
- Autonomy level selector (assist, copilot, autonomous)
- Culture profile selector (startup, enterprise, agency)

---

## Error and Not-Found Pages

| File | Purpose |
|---|---|
| `src/app/(app)/error.tsx` | App-level error boundary |
| `src/app/not-found.tsx` | 404 not found page |

---

## UI Component Library

Located at `src/components/ui/`:

| Component | File |
|---|---|
| Avatar | `avatar.tsx` |
| Badge | `badge.tsx` |
| Button | `button.tsx` |
| Card | `card.tsx` |
| (Tailwind CSS utilities) | via `src/lib/utils.ts` (`cn()`) |
