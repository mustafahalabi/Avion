# Engineering OS — V1 Technical Debt

---

## Overview

This document catalogs known technical debt accepted during V1 development. Each item includes the reason it was accepted, its impact, and the recommended V2 resolution.

---

## Debt Items

### TD-001: SQLite as the production database

| Field | Detail |
|---|---|
| **Area** | Data layer |
| **Reason accepted** | Simple setup for a single-user V1; no multi-region or concurrent-write requirements |
| **Impact** | Cannot safely handle concurrent writes at scale; not suitable for multi-tenant deployment; no native JSON column type (JSON stored as TEXT) |
| **V2 solution** | Migrate to PostgreSQL with Prisma migrate; add proper JSON columns; use connection pooling (PgBouncer or Vercel Postgres) |
| **Priority** | High — must migrate before multi-user or production-scale deployment |

---

### TD-002: No versioned database migrations

| Field | Detail |
|---|---|
| **Area** | Data layer |
| **Reason accepted** | `prisma db push` is fast for solo development; no migration history needed for a single developer |
| **Impact** | Schema changes cannot be safely rolled back; no audit trail of schema evolution; risky for any shared or production database |
| **V2 solution** | Switch to `prisma migrate dev` / `prisma migrate deploy`; establish baseline migration from V1 schema |
| **Priority** | High — required before any team or production deployment |

---

### TD-003: JSON-serialized arrays and objects in SQLite TEXT columns

| Field | Detail |
|---|---|
| **Area** | Data model |
| **Reason accepted** | SQLite does not support native array/JSON column types; Prisma abstracting them as strings was the pragmatic V1 choice |
| **Impact** | Cannot query into JSON fields (e.g., filter by tech stack); client must parse/stringify; risk of format drift |
| **V2 solution** | PostgreSQL with native `jsonb` columns; Prisma `Json` type for type-safe access |
| **Priority** | Medium — workaround is functional but limits querying |

---

### TD-004: Integration credentials stored in legacy plaintext format (migration path only)

| Field | Detail |
|---|---|
| **Area** | Security |
| **Reason accepted** | Legacy credential format (plain JSON) is handled transparently in `decryptCredentials()` with a migration path; new credentials are always encrypted |
| **Impact** | Any credentials saved before the AES-256-GCM encryption was added are stored in plaintext and returned as-is |
| **V2 solution** | One-time migration script to re-encrypt all `credentials` fields that start with `{`; remove legacy path in `decryptCredentials()` |
| **Priority** | High — run migration before any production deployment with real credentials |

---

### TD-005: No rate limiting on server actions

| Field | Detail |
|---|---|
| **Area** | Security / reliability |
| **Reason accepted** | Single-user application; no external consumers; low traffic expected in V1 |
| **Impact** | Server actions can be called repeatedly without throttling; potential for accidental or intentional abuse |
| **V2 solution** | Add rate limiting middleware (e.g., Upstash Rate Limit via Vercel Middleware) keyed by user ID or IP |
| **Priority** | Medium — required before public or multi-user deployment |

---

### TD-006: `Release.taskIds` stored as JSON array of strings

| Field | Detail |
|---|---|
| **Area** | Data model |
| **Reason accepted** | Avoided a join table for V1 simplicity; task linkage is additive and low-frequency |
| **Impact** | Cannot do a relational join to load task data alongside release; must parse JSON and make a second query; no referential integrity (a deleted task leaves a dangling ID) |
| **V2 solution** | Add a `ReleaseTask` join table with proper foreign keys; use Prisma relation |
| **Priority** | Medium — functional in V1 but creates data integrity risk |

---

### TD-007: No audit log for general mutations

| Field | Detail |
|---|---|
| **Area** | Observability |
| **Reason accepted** | `RuntimeEvent` covers request lifecycle; `IntegrationSyncLog` covers integrations; general mutation logging was out of scope for V1 |
| **Impact** | Cannot reconstruct who changed what on tasks, projects, employees, reviews, or releases; compliance and debugging are limited |
| **V2 solution** | Prisma middleware or a generic `AuditLog` model capturing entity type, entity ID, action, actor, old/new values |
| **Priority** | Medium — required for any compliance or team-accountability use case |

---

### TD-008: Company-seed is synchronous and not idempotent

| Field | Detail |
|---|---|
| **Area** | Data layer |
| **Reason accepted** | Seeding runs only once at onboarding; no retry mechanism needed for V1 |
| **Impact** | If seeding fails partway through, the company is left in a partial state with no recovery path |
| **V2 solution** | Make seed idempotent (upsert-based); run in a transaction; add a `seeded` flag to `Company` |
| **Priority** | Low — failure is unlikely in the single-user case but should be hardened |

---

### TD-009: No background job queue

| Field | Detail |
|---|---|
| **Area** | Infrastructure |
| **Reason accepted** | All V1 operations are synchronous and fast; no long-running tasks exist |
| **Impact** | When integration sync, AI inference, or automated analysis is added in V2, they cannot be run in server actions without blocking the request |
| **V2 solution** | Vercel Queues or similar durable queue; worker functions for async tasks |
| **Priority** | High — blocks V2 AI and integration features |

---

### TD-010: `proxy.ts` filename vs Next.js convention

| Field | Detail |
|---|---|
| **Area** | Codebase clarity |
| **Reason accepted** | The Clerk middleware was placed in `src/proxy.ts` and exports as `proxy` + `config`; Next.js expects `middleware.ts` at `src/` with export `default` and `config` |
| **Impact** | Non-standard placement; a developer unfamiliar with the project will not find the middleware in the expected location |
| **V2 solution** | Rename to `src/middleware.ts` and export as `default`; verify Clerk middleware still applies correctly |
| **Priority** | Low — works correctly; cosmetic/convention issue only |

---

### TD-011: Knowledge base has no UI

| Field | Detail |
|---|---|
| **Area** | Feature completeness |
| **Reason accepted** | `Knowledge` and `KnowledgeRecord` models were defined as infrastructure; the Memory UI was shipped as the human-facing layer; Knowledge was intended for AI retrieval |
| **Impact** | Users cannot browse or manage Knowledge records through the UI |
| **V2 solution** | Build Knowledge management UI; wire to AI retrieval when LLM is added |
| **Priority** | Medium — defer until AI retrieval is implemented in V2 |

---

### TD-012: Incident model has no UI

| Field | Detail |
|---|---|
| **Area** | Feature completeness |
| **Reason accepted** | `Incident` model was defined in the schema as a placeholder; incident management was deferred |
| **Impact** | Incidents cannot be created, viewed, or managed through the platform |
| **V2 solution** | Build incident management UI and lifecycle actions |
| **Priority** | Medium — depends on V2 operational use cases |
