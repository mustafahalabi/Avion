# Integration Architecture — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** CTO  
**Approved By:** CEO  
**Last Updated:** 2026-06-29  

This document defines how Engineering OS connects to external systems — issue trackers, repositories, code review tools, deployment platforms, documentation stores, and communication tools — and how those connections are abstracted so they never become the product itself.

The governing principle is simple: **the company is the product; integrations are plumbing.** The CEO hires an engineering organization, not a dashboard of connectors. External tools must be replaceable without changing company behavior, and no external vendor may dictate how the company plans, executes, reviews, ships, or remembers.

This document is grounded in the code that exists today. It clearly separates **Implemented today** from **Designed / planned** so that implementation planning is honest about what is real. It does not invent connectors, sync engines, or automation that the codebase does not contain.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Integration Principles](#2-integration-principles)
3. [External System Categories](#3-external-system-categories)
4. [The Two Integration Surfaces](#4-the-two-integration-surfaces)
5. [Ownership Model](#5-ownership-model)
6. [Abstraction Boundaries](#6-abstraction-boundaries)
7. [Credential Storage and Encryption](#7-credential-storage-and-encryption)
8. [Connection Lifecycle and Status Model](#8-connection-lifecycle-and-status-model)
9. [Permissions and Security Considerations](#9-permissions-and-security-considerations)
10. [Error and Retry Behavior](#10-error-and-retry-behavior)
11. [Data Sync Considerations](#11-data-sync-considerations)
12. [How Integrations Are Consumed](#12-how-integrations-are-consumed)
13. [V1 Integration Scope](#13-v1-integration-scope)
14. [Deferred and Planned Integrations](#14-deferred-and-planned-integrations)
15. [Implementation Status Summary](#15-implementation-status-summary)
16. [Relationship to Other Architecture Documents](#16-relationship-to-other-architecture-documents)

---

## 1. Purpose and Scope

An integration is a configured connection between Engineering OS and an external tool or service. The [Domain Model](./DOMAIN_MODEL.md#integration) defines the `Integration` object as the company's first-class representation of such a connection: it has a type, a provider, credentials, and synchronization state.

This document covers:

- The principles every integration must satisfy.
- The categories of external systems the company expects to connect to.
- The data model and services that exist today for storing connections and credentials.
- Where credentials live, how they are encrypted, and who may use them.
- The error, retry, and sync behavior the platform implements and intends to implement.

This document does **not** cover the agent execution runtime (see [Company Runtime](./COMPANY_RUNTIME.md)), the safe Git workflow for agents (see [GitHub Workflow Foundation](./GITHUB_WORKFLOW_FOUNDATION.md)), or the modules that implement runtime behaviors (see [Technical Architecture](./TECHNICAL_ARCHITECTURE.md)). It is the contract for the connection layer those systems rely on.

---

## 2. Integration Principles

Every integration in Engineering OS — present or future — obeys these rules.

1. **Integrations are invisible.** The CEO never thinks in terms of "connectors." They connect a repository or a tracker once; from then on the company uses it. The product surface is the company, not the integration catalog.

2. **External tools are replaceable.** No company behavior may depend on a specific vendor. Repository hosting could be GitHub today and something else tomorrow; the runtime, the planner, and the employees must not change. Provider independence is a first-class property, exactly as it is for execution engines in the [Company Runtime](./COMPANY_RUNTIME.md#37-runtime-ownership-boundaries).

3. **The company owns the abstraction; the provider supplies the data.** Engineering OS reads from and writes to external systems through company-owned services. A provider is a source/sink, never a controller.

4. **Credentials are secrets, always.** Tokens are encrypted at rest, never logged, never returned to the CEO, and never embedded in CEO-facing artifacts. A connection is referenced by identity and scope, not by its raw secret.

5. **Connections are company-scoped by default.** An integration belongs to a Company. It may optionally be scoped to a user, but the unit of ownership is the organization, not the human.

6. **Failure is explicit and recorded.** A connection that errors, expires, or is revoked records that fact in a durable, queryable status. It does not fail silently and it does not pretend to be connected.

7. **No fake intelligence.** A stored credential is not the same as a working sync. The platform never reports data as "synced" that it has not actually fetched. Where live sync is not yet implemented, the platform says so plainly (this is enforced in code today — see [§11](#11-data-sync-considerations)).

8. **Least privilege.** The company requests only the scopes it needs to do its job, and surfaces the requested scopes to the CEO before connecting.

---

## 3. External System Categories

The company organizes external systems by the capability they provide, not by vendor. Each category is an abstraction boundary: any provider in a category must be swappable for another.

| Category | Capability provided | Representative providers | Company consumers |
|---|---|---|---|
| **Code / version control** | Host repositories; create branches, commits, and pull requests | GitHub | Tech Lead, Engineers, Reviewer (via the execution worker) |
| **Work / issue tracking** | Source and sink for projects, issues, cycles | Linear | Product Manager, Tech Lead |
| **Infrastructure / deployment** | Deploy, host, and report project health | Vercel | DevOps Engineer, Release Manager, Monitoring Engineer |
| **Communication** | Deliver company updates and notifications outward | Slack | Company Runtime (notification routing) |
| **Documentation store** | Persist and publish authoritative knowledge | *(planned)* | Technical Writer |
| **Code review tools** | External review automation | *(planned)* | Reviewer |
| **Monitoring** | Post-release signal collection | *(planned)* | Monitoring Engineer |

The categories map directly to the `Integration.type` taxonomy in the [Domain Model](./DOMAIN_MODEL.md#integration): `version_control`, `issue_tracking`, `deployment`, `monitoring`, `communication`.

**Implemented today:** code (GitHub), work (Linear), infrastructure (Vercel), and communication (Slack) appear as connectable providers. Of these, only GitHub is consumed end-to-end by the runtime (see [§12](#12-how-integrations-are-consumed)); the others can be connected and their credentials stored, but they are not yet read from or written to.

---

## 4. The Two Integration Surfaces

The codebase contains **two** connection models that exist for different reasons. This is deliberate, and the distinction matters for implementation planning.

### 4.1 `ProviderConnection` — the first-class connection (Implemented today)

`ProviderConnection` is the modern, authoritative connection record (Linear epic MUS-172–177). It models a real OAuth / app / token connection with scope and refresh metadata. It is what the runtime actually consumes.

Backing model (`apps/web/prisma/schema.prisma`, model `ProviderConnection`):

| Field | Purpose |
|---|---|
| `companyId` | Owning company (required) |
| `userId` | `null` = company-level connection; set = user-scoped connection |
| `provider` | `"github"` \| `"linear"` \| `"vercel"` — extensible |
| `connectionType` | `"oauth"` \| `"github_app"` \| `"manual_token"` |
| `status` | `connected` \| `disconnected` \| `error` \| `expired` \| `revoked` \| `needs_reauth` |
| `externalAccountId` / `externalAccountName` / `externalAccountEmail` | Connected account identity |
| `scopes` | JSON array of granted scope strings, e.g. `["repo","read:org"]` |
| `encryptedTokens` | AES-256-GCM ciphertext of the token payload (see [§7](#7-credential-storage-and-encryption)) |
| `tokenExpiresAt` | Access-token expiry, when known |
| `refreshAvailable` | Whether a refresh token is held |
| `errorCode` / `errorMessage` | Last recorded failure |
| `lastConnectedAt` / `disconnectedAt` | Connection timeline |

Uniqueness is enforced on the composite `(companyId, provider, userId)`. The database is PostgreSQL, and SQL unique constraints treat `NULL`s as distinct values, so the composite index alone cannot guarantee a single company-level row; company-level uniqueness (where `userId IS NULL`) is therefore enforced in application code in `upsertProviderConnection` (`apps/web/src/lib/provider-connection-service.ts`) as defense-in-depth.

The service layer (`apps/web/src/lib/provider-connection-service.ts`) is the only sanctioned way to touch this model:

- `upsertProviderConnection(input)` — create or refresh a connection; encrypts tokens before write.
- `getProviderConnection(companyId, provider, userId?)` — fetch with tokens decrypted.
- `listProviderConnections(companyId)` — all connections for a company.
- `disconnectProviderConnection(companyId, connectionId)` — set status `disconnected` and **overwrite stored tokens with `{}`**.
- `recordProviderConnectionError(companyId, connectionId, code, message)` — set status `error` with diagnostics.
- `deleteProviderConnection(companyId, connectionId)` — hard-delete a connection (ownership-guarded).
- `getConnectionScopes(connection)` / `isConnectionTokenExpired(connection)` — pure helpers.

GitHub has a dedicated facade, `apps/web/src/lib/github-connection-service.ts`, that adds provider-specific knowledge on top of the generic service:

- `GITHUB_REQUIRED_SCOPES = ["repo", "read:org", "workflow"]`, each with a human-readable description shown to the CEO before connecting.
- `recordGitHubConnection(input)` — records an OAuth callback or manual-token entry as a `ProviderConnection`.
- `getGitHubConnectionStatus(companyId, userId?)` — returns a computed status that includes **which required scopes are missing** and **whether the token has expired**, so the UI can prompt for re-auth precisely.

### 4.2 `Integration` — the generic connection catalog (Implemented today, sync stubbed)

`Integration` is the older, generic catalog model. It backs the `/integrations` settings UI and a provider catalog (`INTEGRATION_PROVIDERS` in `apps/web/src/lib/integrations.ts`: Linear, GitHub, Slack, Vercel), each with declared credential fields. It owns a child `IntegrationSyncLog` model (`status`, `message`, `recordsCount`) used as an audit trail of connect/disconnect/sync events.

Its server actions live in `apps/web/src/app/actions/integrations.ts`:

- `connectIntegration` — collects declared credential fields, encrypts them, upserts one `Integration` per provider per company, and writes a sync-log entry.
- `disconnectIntegration` — sets status `disconnected` and overwrites `credentials` with `{}`.
- `triggerSync` — **logs a sync request but performs no fetch.** The recorded message states plainly: *"Live provider sync is not yet implemented — credentials are stored but no data has been fetched from the provider."*

### 4.3 Which surface to use

`ProviderConnection` is the strategic surface and the one the runtime consumes. `Integration` remains the broader catalog and audit-log surface. New work that needs real, consumed credentials (especially anything the agent worker touches) must use `ProviderConnection`. The two are expected to converge over time; until then, do not duplicate a live credential across both models.

---

## 5. Ownership Model

Ownership follows the [Domain Model](./DOMAIN_MODEL.md#integration): **the CTO owns integration configuration; the DevOps Engineer owns integration operations.**

| Concern | Owner | Notes |
|---|---|---|
| Which providers are connectable | CTO | Defines the catalog and required scopes |
| Connecting / disconnecting a provider | CEO action, CTO accountable | The CEO performs the connect; the company is accountable for using it correctly |
| Credential health (expiry, refresh, errors) | DevOps Engineer | Surfaces `needs_reauth` / `error` states |
| Repository-hosting integrations | CTO (strategic), Tech Lead (operational) | Mirrors `Repository` ownership in the Domain Model |
| Deployment integrations | DevOps Engineer / Release Manager | Used during the release cycle |
| Communication integrations | Company Runtime | Notification delivery is a system function |

Two invariants from the Domain Model are load-bearing here and are enforced (or intended to be enforced) in code:

- **Credentials are never stored in plaintext.** ([§7](#7-credential-storage-and-encryption))
- **An errored integration generates a notification to the CTO.** Today the error *state* is recorded (`recordProviderConnectionError`, `Integration.errorMessage`); routing that state to a CTO notification is the runtime's responsibility (see [Company Runtime §25](./COMPANY_RUNTIME.md#25-notification-rules)).

The CEO never manages integrations as a primary activity. Connecting a repository is a one-time setup step, after which the company operates the connection on the CEO's behalf — consistent with the CEO experience defined across the architecture.

---

## 6. Abstraction Boundaries

The boundary between "company" and "provider" is drawn at the **service layer**. Nothing above the service layer ever sees a raw token; nothing below it ever makes a routing or company-logic decision.

```
┌─────────────────────────────────────────────────────────────┐
│  Company logic (employees, runtime, planner, release cycle)  │
│  — references connections by identity, scope, and status     │
└───────────────────────────┬─────────────────────────────────┘
                            │  (decrypted tokens, scoped)
┌───────────────────────────▼─────────────────────────────────┐
│  Integration service layer                                   │
│  provider-connection-service.ts / github-connection-service  │
│  — upsert / get / list / disconnect / record-error / scopes  │
│  — owns encryption boundary via credentials-crypto.ts        │
└───────────────────────────┬─────────────────────────────────┘
                            │  (HTTPS, Bearer auth)
┌───────────────────────────▼─────────────────────────────────┐
│  External provider (GitHub REST, Linear API, Vercel, Slack)  │
└──────────────────────────────────────────────────────────────┘
```

Boundary rules:

- **One canonical token path.** Tokens are decrypted only inside the service layer and handed to the consumer that needs them (e.g., the worker). They are never persisted decrypted and never returned to the client.
- **Provider-specific knowledge is isolated.** GitHub's required scopes, scope descriptions, and PR URL parsing live in GitHub-specific modules (`github-connection-service.ts`, `github-pull-request.ts`). Generic connection mechanics live in the generic service. Adding a provider means adding a facade, not rewriting the core.
- **Display state is pure.** UI status is derived by a pure function, `computeProviderCardState` (`apps/web/src/lib/provider-card-state.ts`), which never performs I/O. The view layer cannot accidentally read a secret.
- **Consumers depend on the abstraction, not the vendor.** The execution worker asks for "the GitHub connection for this company," not "this token." Swapping how the token is obtained (manual entry today, OAuth tomorrow) does not change the consumer.

---

## 7. Credential Storage and Encryption

All credentials are encrypted at rest by `apps/web/src/lib/credentials-crypto.ts`.

- **Algorithm:** AES-256-GCM with a 12-byte random IV per encryption.
- **Key:** a 32-byte key supplied as a 64-character hex string in the `CREDENTIALS_ENCRYPTION_KEY` environment variable. The module refuses to operate without a correctly sized key.
- **Stored format:** a compact string `iv:authTag:ciphertext`, all hex. The GCM auth tag provides tamper detection on decrypt.
- **Payload:** `encryptCredentials` serializes a `Record<string, string>` (e.g. `{ accessToken, refreshToken, installationId, manualToken }`) to JSON, then encrypts it. `ProviderConnection.encryptedTokens` and `Integration.credentials` both hold this format.
- **Fail-closed reads:** `decryptCredentials` returns an empty object on any failure (bad key, tampered ciphertext, malformed input) rather than throwing into the request path. A connection whose token cannot be decrypted behaves as having no usable credential.
- **Legacy migration:** if a stored value is plain JSON (a value beginning with `{`), it is parsed transparently. This lets older plaintext rows be read while new writes are always encrypted. Plaintext storage is not a supported steady state — it exists only to migrate.
- **Erasure on disconnect:** disconnecting overwrites the stored ciphertext with `{}` so a disconnected connection retains no secret material.

**Operational requirement:** `CREDENTIALS_ENCRYPTION_KEY` must be present and stable in every environment that reads or writes credentials (app, worker, driver). Rotating it without re-encrypting existing rows renders stored tokens unreadable (they will decrypt to `{}` and the connection will need re-auth). Key rotation tooling is **Designed / planned**, not implemented.

---

## 8. Connection Lifecycle and Status Model

A `ProviderConnection` moves through an explicit status set; the UI renders a derived card state on top of it.

```
(no record)
   │ connect (OAuth callback / manual token)
   ▼
connected ──────────────► expired        (token past tokenExpiresAt)
   │  │                      │
   │  │ provider/API failure │ re-auth
   │  ▼                      ▼
   │ error ───────────► needs_reauth
   │                         ▲
   │ disconnect / revoke     │
   ▼                         │
disconnected / revoked ──────┘  (re-connect)
```

- **`connected`** — usable; tokens present. If `tokenExpiresAt` is in the past, the connection is treated as effectively expired even while the stored status is `connected` (computed by `getGitHubConnectionStatus` and `computeProviderCardState`).
- **`error`** — last operation failed; `errorCode` / `errorMessage` explain why.
- **`expired`** — access token known to be past expiry.
- **`needs_reauth`** — the company must prompt the CEO to reconnect (also the display state for `revoked`).
- **`disconnected` / `revoked`** — terminal until reconnected; tokens erased.

The display layer collapses these into card states (`connected`, `disconnected`, `error`, `expired`, `needs_reauth`, `warning`) with human labels via `computeProviderCardState`. Missing-scope conditions are computed separately by the GitHub facade so the UI can tell the CEO exactly what additional access to grant.

---

## 9. Permissions and Security Considerations

Security is a design constraint on every integration, not a later hardening pass.

**Scopes and least privilege.**
- GitHub connections request exactly `repo`, `read:org`, and `workflow`, each surfaced to the CEO with a plain-language description before connecting.
- Granted scopes are stored per connection and `getGitHubConnectionStatus` computes **missing** required scopes, so the company can refuse or warn when access is insufficient rather than failing mid-task.

**Credential handling.**
- Tokens are AES-256-GCM encrypted at rest ([§7](#7-credential-storage-and-encryption)) and decrypted only inside the service layer.
- Tokens are never returned to the browser, never written to logs, and never placed in CEO-facing notifications, timeline entries, or artifacts — consistent with the [Company Runtime](./COMPANY_RUNTIME.md#25-notification-rules) rule that CEO-facing content contains no implementation detail.
- Disconnect erases stored tokens; delete removes the record entirely. Both are ownership-guarded (`companyId` is checked before any mutation).

**Tenancy isolation.**
- Every read and write is scoped by `companyId`. Service functions that mutate take `companyId` as an ownership guard and return `null`/`false` when the record is not owned by the caller's company. A company can never read or disconnect another company's connection.
- Company-level vs user-scoped connections are distinguished by `userId` (nullable), with uniqueness enforced per `(companyId, provider, userId)`.

**Blast-radius control at execution time.**
- A connected credential does not grant unrestricted action. When the execution worker uses a GitHub token, it operates behind the worker guardrails: protected paths (`.env`, `.env.*`, `*.key`, `prisma/migrations/**`, `.github/workflows/**`) and protected branches are blocked regardless of token power (`apps/web/src/lib/worker-permissions.ts`; see [GitHub Workflow Foundation](./GITHUB_WORKFLOW_FOUNDATION.md)). Possessing a token is necessary but not sufficient to make a dangerous change.

**Auditability.**
- The `Integration` surface records connect/disconnect/sync events as `IntegrationSyncLog` rows. `ProviderConnection` records `errorCode`/`errorMessage` and connection timestamps. Together these provide a queryable history of how a connection has behaved.

---

## 10. Error and Retry Behavior

Integration error handling follows the retry/recovery distinction defined in the [Company Runtime](./COMPANY_RUNTIME.md#33-retry): transient failures are retried; substantive failures are recorded and surfaced.

**Principles.**

1. **Distinguish transient from substantive.** A timeout or a 5xx from a provider is transient and retryable. An expired token, a revoked grant, or a missing scope is substantive — it requires re-authentication, not a retry.

2. **Record substantive failures as state.** Substantive failures set the connection to `error` / `expired` / `needs_reauth` with a machine-readable `errorCode` and a human-readable `errorMessage`. The company then prompts the CEO to reconnect rather than silently retrying a doomed call.

3. **Fail closed on credentials.** If a token cannot be decrypted or is absent, the operation does not proceed with a partial or guessed credential — it stops and reports a missing-credential condition. The worker does exactly this: with no usable GitHub token it records `"No GitHub token available to open a pull request."` and does not attempt the call.

4. **Never report success without the side effect.** A connection action that did not actually reach the provider is never logged as a successful sync (see [§11](#11-data-sync-considerations)).

5. **Surface, don't bury.** An errored integration is intended to generate a CTO notification (Domain Model invariant). The error is preserved on the record so it remains visible until resolved.

**Retry policy (target).** For genuinely transient provider failures the platform applies bounded retry with exponential backoff, consistent with the runtime's "external API calls — retry with exponential backoff" rule. Centralized, configurable backoff for provider calls is **Designed / planned**; today the live consumer (the worker) treats a failed provider call as a recorded `prError` on the session rather than retrying in a loop.

---

## 11. Data Sync Considerations

"Sync" means moving data between an external system and the company's own records. The platform treats sync as a deliberate, truthful operation.

**What is true today.**

- **Credentials can be stored for Linear, GitHub, Slack, and Vercel**, but storing a credential is explicitly *not* a sync. The generic `triggerSync` action records a sync-log entry stating that *live provider sync is not yet implemented and no data has been fetched.* This honesty is intentional and is a hard project rule: the platform must not present fake repository intelligence or fake automation.
- **GitHub is the one provider consumed for real**, and its "sync" is push-shaped, not pull-shaped: the company writes to GitHub (clones a repo, pushes a branch, opens a PR) using the stored connection. See [§12](#12-how-integrations-are-consumed).
- **Repository understanding is sourced from analysis, not from a tracker sync.** The company's knowledge of a codebase comes from repository intelligence (file-tree ingestion, framework/route detection, change intelligence), not from importing issues. Integration sync and repository analysis are distinct subsystems.

**Design principles for future sync.**

1. **One direction of truth per field.** For any synced field, exactly one system is authoritative. The company does not let two systems silently overwrite each other.
2. **Idempotent application.** Re-running a sync converges to the same state; it does not duplicate records. (This mirrors how plan approval applies idempotently in the planner.)
3. **Sync is observable.** Every sync run records what was fetched and how many records changed (`IntegrationSyncLog.recordsCount`), so the company can show truthful, queryable sync history.
4. **Scoped, incremental pulls.** Where a provider supports it, sync fetches deltas (by cursor/timestamp) rather than re-reading the world on every run.
5. **Conflicts escalate, not overwrite.** A sync conflict that the company cannot resolve by rule is surfaced, consistent with how memory and decision conflicts are escalated rather than silently resolved.

Bidirectional issue-tracker sync (Linear), deployment/health sync (Vercel), and outbound communication delivery (Slack) are all **Designed / planned**.

---

## 12. How Integrations Are Consumed

The only end-to-end integration consumption path in the platform today is the **execution worker using the GitHub connection** to deliver agent work. It demonstrates the intended shape for all future consumers.

Path (`apps/web/src/worker/index.ts`):

1. The worker claims a queued `ExecutionSession` and resolves its repository.
2. It fetches the company's GitHub connection: `getProviderConnection(companyId, "github")`.
3. It clones/checks out the repository, passing the **encrypted** token payload to the checkout step (decryption happens at the service boundary).
4. The agent (`claude -p`) runs in the checked-out repo under the worker guardrails.
5. On a successful commit, the worker decrypts the usable token — `accessToken` for OAuth, falling back to `manualToken` for manual connections — parses the repo's `owner/repo` from its URL (`parseGitHubRepoUrl`), and opens or reuses a pull request via the GitHub REST API (`openOrReusePullRequest`, `Authorization: Bearer <token>`).
6. PR metadata (`prUrl`, `prNumber`, `prStatus`, `commitSha`) is recorded back onto the session.

What this path establishes as the consumption contract:

- The consumer asks the **service layer** for a connection; it never reads the DB column directly.
- The consumer receives a credential **scoped to a company and a provider**, decrypted only where it is used.
- A **missing or unusable credential is a recorded, explicit failure** — the session records `prError`, it does not crash or guess.
- The credential's power is **bounded by guardrails** at the moment of use, not just by the scopes granted at connect time.

This is the template every future provider consumer (Linear writes, Vercel deploys, Slack notifications) should follow.

---

## 13. V1 Integration Scope

Engineering OS V1 focuses on software engineering only, and the integration surface reflects that focus.

**In scope and implemented:**

- **GitHub (code / version control).** First-class `ProviderConnection` with required-scope tracking, manual-token and (modeled) OAuth/GitHub-App connection types, encrypted storage, status/expiry/error tracking, and **live consumption by the execution worker** to clone, push, and open PRs.
- **Connection management UI.** A `/integrations` surface to connect, view status, disconnect, and inspect a sync/audit log, backed by the `Integration` catalog and `ProviderConnection`.
- **Encrypted credential storage** for all catalog providers (GitHub, Linear, Slack, Vercel).

**In scope, partially implemented:**

- **Linear (work / issue tracking)** and **Vercel (infrastructure / deployment)** — connectable with stored, encrypted credentials, but **not yet consumed** (no live read/write). Their sync is stubbed and labeled as such.
- **Slack (communication)** — connectable (incoming webhook), but outbound delivery is not yet wired.

**Out of scope for V1:** anything that would require real bidirectional sync engines or new provider categories (see [§14](#14-deferred-and-planned-integrations)).

---

## 14. Deferred and Planned Integrations

The following are intentionally deferred. They are designed for but not built, and must not be represented as working.

| Item | Status | Notes |
|---|---|---|
| OAuth authorization-code flows (vs. manual token entry) | Designed | `connectionType: "oauth"` and `"github_app"` are modeled; manual-token entry is the path exercised today |
| OAuth token refresh | Designed | `refreshAvailable` and `tokenExpiresAt` fields exist; no refresh loop is implemented |
| Encryption-key rotation tooling | Designed | Re-encryption of stored rows on key change is not implemented |
| Live Linear sync (issues/projects/cycles) | Designed | Credentials store; no fetch/write |
| Live Vercel sync (deployments/health) | Designed | Feeds the release/monitoring cycle when built |
| Outbound Slack notifications | Designed | Notification delivery channel |
| Documentation-store integration | Planned | For Technical Writer knowledge publication |
| Code-review tool integration | Planned | External reviewer automation |
| Centralized provider retry/backoff | Designed | Bounded exponential backoff for transient provider failures |
| Convergence of `Integration` and `ProviderConnection` | Planned | Unify the catalog surface and the first-class connection surface |
| CTO notification on integration error | Designed | Error *state* is recorded today; routing to a CTO notification is a runtime responsibility |

The hard project rule applies throughout: **do not create fake repository intelligence or fake automation.** A deferred integration shows as not-yet-active in the UI; it never pretends to sync.

---

## 15. Implementation Status Summary

| Capability | Status | Where |
|---|---|---|
| `ProviderConnection` model + service | **Implemented** | `apps/web/prisma/schema.prisma`, `apps/web/src/lib/provider-connection-service.ts` |
| GitHub connection facade (scopes, status, expiry) | **Implemented** | `apps/web/src/lib/github-connection-service.ts` |
| AES-256-GCM credential encryption | **Implemented** | `apps/web/src/lib/credentials-crypto.ts` |
| Generic `Integration` catalog + sync log | **Implemented** | `apps/web/src/lib/integrations.ts`, `apps/web/src/app/actions/integrations.ts` |
| Pure UI status derivation | **Implemented** | `apps/web/src/lib/provider-card-state.ts` |
| Live GitHub consumption (clone / push / PR) | **Implemented** | `apps/web/src/worker/index.ts`, `apps/web/src/lib/github-pull-request.ts` |
| Guardrails over token use | **Implemented** | `apps/web/src/lib/worker-permissions.ts` |
| OAuth code flow / token refresh | Designed | model fields present; flow not built |
| Live Linear / Vercel / Slack sync | Designed | credentials stored; not consumed |
| Centralized retry/backoff; key rotation | Designed | — |

---

## 16. Relationship to Other Architecture Documents

- **[DOMAIN_MODEL.md](./DOMAIN_MODEL.md#integration)** defines the `Integration` object, its ownership, and the invariants (encrypted credentials, error-triggers-notification) this document implements.
- **[COMPANY_RUNTIME.md](./COMPANY_RUNTIME.md)** defines retry vs. recovery ([§33](./COMPANY_RUNTIME.md#33-retry)), notification rules ([§25](./COMPANY_RUNTIME.md#25-notification-rules)), and the provider-independence principle that integrations must uphold.
- **[GITHUB_WORKFLOW_FOUNDATION.md](./GITHUB_WORKFLOW_FOUNDATION.md)** describes the safe Git workflow and guardrails that bound how the GitHub connection is used at execution time.
- **[TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)** defines the modules and events that implement runtime behaviors, including how integration errors are routed.
- **[INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md)** defines how the CEO views connection status in the Integrations surface.
- **[../sops/RELEASE.md](../sops/RELEASE.md)** is the procedure that will consume deployment and monitoring integrations once they are built.
