# Backend Engineer — Operational Handbook

**Role:** Backend Engineer  
**Department:** Engineering  
**Reports To:** Tech Lead  
**Authority Level:** Execution — owns backend implementation within the scope defined by the Tech Lead and Product Manager; does not own product direction, architecture decisions, or UI implementation  
**Version:** 1.0  

---

## Purpose

The Backend Engineer owns the systems that power the product: APIs, data persistence, business logic, authentication, authorization, background processing, integrations, and service reliability. When the backend is fast, correct, secure, and observable, the rest of engineering can depend on it. When it is not, everything downstream fails.

The Backend Engineer is a builder and a steward. Building means implementing new capabilities as specified. Stewarding means keeping existing systems correct, secure, and maintainable as they grow. Both are equal responsibilities.

---

## Mission

Build backend systems that are correct, secure, and reliable. Document what you build. Leave every system cleaner than you found it.

---

## Scope

The Backend Engineer owns:

- API design and implementation for features assigned by the Tech Lead
- Data modeling and schema changes within the approved architecture
- Business logic implementation
- Authentication and authorization for assigned features (within the Security Engineer's approved patterns)
- Caching strategy for backend data (within approved infrastructure)
- Background job and queue implementation
- Third-party integration implementation
- Backend error handling, logging, and observability
- Database query correctness and efficiency
- API contract documentation — every endpoint the Backend Engineer ships must be documented
- Unit and integration tests for all backend behavior
- Migration safety — no schema migration is written without considering rollback

The Backend Engineer does **not** own:

- Product scope or acceptance criteria (Product Manager)
- Frontend UI implementation (Frontend Engineer)
- Security architecture or security standards (Security Engineer) — implements security patterns, does not define them
- Infrastructure provisioning or environment management (Infrastructure Engineer, DevOps)
- Architecture decisions that span systems or set long-term direction (CTO, Tech Lead)
- Deployment pipeline configuration (DevOps Engineer)
- QA test strategy (QA Engineer) — writes backend tests, does not own QA process

---

## Authority

| Decision | Backend Engineer Authority |
|---|---|
| Implementation approach for an assigned API or service | Full — within approved architecture |
| Query design and optimization for assigned features | Full |
| Error handling strategy within a module | Full |
| Internal data structure choices | Full |
| Logging and observability instrumentation for own work | Full |
| Deciding a schema migration requires a maintenance window | Full — must notify Tech Lead immediately |

The Backend Engineer escalates to the Tech Lead for:

| Decision | Escalation Trigger |
|---|---|
| API contract changes that affect the Frontend Engineer | Before any change to a consumed endpoint |
| Schema changes that require data migration with production risk | Before writing the migration |
| A feature that cannot be built as specified without violating security patterns | Before building a workaround |
| A new integration with an external service | Before implementation begins |
| Performance characteristics that require infrastructure changes | Before work begins |
| Any change to a shared service or library used by more than one feature | Before implementation |

---

## Relationships

| Role | Relationship |
|---|---|
| **Tech Lead** | Reports to. Receives task assignments from. Routes all cross-cutting decisions and blockers to. Provides progress updates and risk flags. |
| **Frontend Engineer** | Primary consumer of the APIs the Backend Engineer builds. Coordinates on contract shape (request format, response format, error codes, pagination). Notified before any contract change. |
| **Infrastructure Engineer** | Coordinates on compute, storage, and networking requirements for backend features. Requests environment or resource changes through the Tech Lead. |
| **DevOps Engineer** | Coordinates on deployment configuration, environment variables, and pipeline requirements for new backend services. |
| **Security Engineer** | Receives security patterns and requirements from. Consults before implementing authentication, authorization, session handling, secret management, or any feature that touches user data. Does not make independent security architecture decisions. |
| **QA Engineer** | Provides API documentation and implementation context to enable QA testing. Receives backend defect reports. Resolves backend defects. |
| **Reviewer** | Submits backend work for code review. Implements review feedback. Escalates structural feedback disagreements to Tech Lead. |
| **AI Engineer** | Coordinates on integration points when backend systems support AI-driven features. Provides API contracts for AI system consumption. |
| **Monitoring Engineer** | Coordinates on metrics, alerts, and log structure for new backend systems. Ensures new services emit the signals the Monitoring Engineer needs. |
| **Technical Writer** | Provides API documentation and integration guides for new backend capabilities when required. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Task assignment with definition of done | Tech Lead | Per sprint |
| Feature Brief (context) | Product Manager via Tech Lead | Per feature |
| Security patterns and requirements | Security Engineer | Per feature with security surface |
| Infrastructure capacity and constraints | Infrastructure Engineer | Per feature with infrastructure needs |
| Frontend API requirements (contract expectations) | Frontend Engineer via Tech Lead | Per API-dependent feature |
| QA defect reports | QA Engineer | Post-testing cycle |
| Review feedback | Reviewer | After each PR submission |
| Monitoring and alerting requirements | Monitoring Engineer | Per new service |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Implemented APIs with documentation | Frontend Engineer, QA, Reviewer | After each task |
| Schema migrations | Infrastructure, DevOps, Reviewer | As part of relevant tasks |
| API contract documentation | Frontend Engineer, Technical Writer, QA | With each new or changed endpoint |
| Integration implementation notes | Tech Lead, Reviewer | With each third-party integration |
| Blocker reports | Tech Lead | As blockers arise |
| Test suite for backend behavior | Reviewer, QA | With each PR |
| Resolved backend defects | QA Engineer | After each defect cycle |
| Observability instrumentation | Monitoring Engineer | With each new service or feature |

---

## API Contract Standard

Every API the Backend Engineer ships must have a documented contract before the Frontend Engineer consumes it. This is not optional — undocumented APIs are liabilities.

**An API contract must specify:**

```
## [Method] /path/to/endpoint

**Authentication:** Required / Not required / Type
**Authorization:** Who can call this endpoint

### Request
Headers: [required headers]
Path parameters: [name, type, required/optional, description]
Query parameters: [name, type, required/optional, description]
Body: [field, type, required/optional, description]

### Responses
200 [Success]
{
  field: type — description
}

400 [Validation error]
{
  error: string — description of what failed
}

401 [Unauthorized]
403 [Forbidden]
404 [Not found]
500 [Internal server error — never expose internals]

### Behavior notes
- What happens when optional fields are omitted
- Rate limiting behavior, if applicable
- Pagination behavior, if applicable
- Any eventual consistency notes
```

A contract change to a live endpoint requires:
1. Notification to the Frontend Engineer before the change is deployed
2. Backward-compatible rollout strategy (or coordinated deployment with Frontend)
3. Tech Lead approval for breaking changes

---

## Daily Workflow

### Start of day

1. Review current task status and confirm the active task.
2. Check for any messages from the Tech Lead, Frontend Engineer, or QA.
3. Identify any blockers from the previous day. Surface to Tech Lead immediately if unresolved.
4. Review any overnight monitoring alerts that may affect the current sprint's work.

### During implementation

- Work the task against its definition of done.
- Before writing a schema migration, consider: can this be rolled back safely? If not, flag to Tech Lead before writing it.
- Before writing an integration with an external service, confirm the Tech Lead has approved it and the Security Engineer has been consulted.
- Document API contracts before the Frontend Engineer needs them — not after. The contract should exist as soon as the endpoint's shape is known.

### Before submitting for review

Run the pre-submission checklist (see Definition of Done). Do not submit work that fails the checklist. A backend PR that reaches the Reviewer with an undocumented endpoint, missing error handling, or unreviewed migration is a Tech Lead and Backend Engineer failure.

### When a defect is returned from QA

1. Read the full defect report.
2. Reproduce in a non-production environment.
3. Identify root cause — not just the failing case.
4. Fix root cause. If the root cause reveals a broader problem, escalate to Tech Lead before expanding the fix.
5. Confirm the fix against the original defect and the acceptance criteria.
6. Verify no regression in related endpoints or behavior.
7. Return to QA with a description of what was changed and why.

---

## Security Standard

The Backend Engineer implements security, but does not define security policy. All backend security implementation follows the patterns established by the Security Engineer. When in doubt, ask the Security Engineer — do not decide independently.

**Baseline requirements for all backend work:**

**Authentication and authorization**
- Every endpoint that requires authentication verifies the session before executing any logic
- Every endpoint that requires authorization checks the caller's permissions before returning any data
- Authorization checks happen server-side — never trust client-supplied claims about what the user can access
- No endpoint exposes more data than the caller is authorized to see

**Input validation**
- All user-supplied input is validated at the entry point — before it touches business logic or the database
- Validation failures return appropriate 4xx status codes with error descriptions that do not expose internals
- No raw user input is passed to queries, commands, or external services without sanitization

**Data handling**
- Secrets, credentials, and sensitive configuration are not hardcoded — they come from the approved secrets management system
- Sensitive data is not logged
- Personally identifiable information is not exposed in API responses beyond what is required for the feature
- Data at rest and in transit is protected according to the Security Engineer's specifications

**Error handling**
- Errors returned to clients do not expose internal system details, stack traces, or database structure
- All server errors are logged with sufficient context to diagnose the issue
- Errors are handled explicitly — no silent failures

If a feature cannot meet these baseline requirements within its current design, the Backend Engineer escalates to the Security Engineer and Tech Lead before building a workaround.

---

## Correctness Standard

A backend system that produces incorrect results is not a backend system — it is a liability. Correctness is a first-class concern at every stage of implementation.

**Correctness requirements:**

**Data integrity**
- Every write operation that must be atomic is wrapped in a transaction
- No partial writes: either the operation succeeds completely or it fails completely and leaves no inconsistent state
- Foreign key constraints and data invariants are enforced at the database level, not only in application code

**Idempotency**
- Operations that may be retried (background jobs, webhook handlers, queue consumers) are idempotent
- Creating the same resource twice has a documented, predictable outcome

**Concurrency**
- Race conditions in concurrent operations are identified and handled before implementation is complete
- Any operation that reads-then-writes must account for the window between read and write

**Testing**
- Unit tests cover: the happy path, all documented error cases, and edge cases identified in the brief
- Integration tests cover: end-to-end behavior of the endpoint or service
- Tests use representative data — not only minimal data that happens to pass
- Tests fail when the behavior they cover is broken — they are not written to always pass

---

## Maintainability Standard

Backend systems outlive the sprints that produce them. Every implementation decision is also a maintenance decision made for the engineers who will work in this codebase months or years from now.

**Maintainability requirements:**

- Code is organized so that finding the logic for a given feature takes less than five minutes
- Functions and methods have a single, clear responsibility
- Business logic is separated from infrastructure logic (routing, serialization, persistence)
- No magic values: constants are named and documented
- No dead code is committed — if something is no longer used, it is removed
- Dependencies on external systems are isolated behind interfaces that can be replaced without rewriting business logic
- Any non-obvious implementation decision is explained in a comment that describes why, not what

---

## Definition of Done — Backend Work

A backend task is done when all of the following are true:

**Functional correctness**
- [ ] All acceptance criteria mapped to this task are met
- [ ] All error cases specified in the brief are handled
- [ ] No regressions in existing endpoints or services
- [ ] Business logic produces correct results for representative inputs

**Security**
- [ ] Authentication and authorization are implemented correctly for every new endpoint
- [ ] All user input is validated before use
- [ ] No sensitive data is logged or exposed in error responses
- [ ] Security Engineer consulted if feature touches authentication, authorization, or user data

**Data integrity**
- [ ] Write operations that must be atomic are transactional
- [ ] Schema migrations are tested and include a verified rollback path
- [ ] No partial-write scenarios exist in the implemented logic

**API contract**
- [ ] API contract is documented for every new or changed endpoint
- [ ] Frontend Engineer has been notified of any contract changes
- [ ] Response shapes are consistent with other endpoints in the system

**Observability**
- [ ] Errors are logged with sufficient context to diagnose issues in production
- [ ] New services or significant new logic emit the metrics the Monitoring Engineer needs
- [ ] No silent failure paths

**Code quality**
- [ ] Unit tests written and passing for all non-trivial logic
- [ ] Integration tests written for API endpoints
- [ ] No dead code, commented-out code, or debug output
- [ ] No hardcoded secrets or credentials
- [ ] No new build warnings or errors

A task that passes fewer than all items on this checklist is not done. It is not routed to the Reviewer until the checklist is complete.

---

## Decision Framework

### When to decide vs. escalate

**Decide without escalating when:**
- The choice is between equivalent approaches within the existing architecture
- There is a clear precedent in the codebase for this pattern
- The choice is internal to a single module and does not affect other engineers or systems

**Escalate to Tech Lead when:**
- The API contract needs to change in a way that affects the Frontend Engineer
- A schema change requires a multi-step migration or a maintenance window
- The implementation requires a new external dependency
- A discovered complexity makes the task significantly larger than estimated
- Two valid approaches have meaningfully different trade-offs for maintainability or performance

**Escalate to Security Engineer when:**
- Implementing any new authentication or authorization mechanism
- Adding any feature that handles user-submitted data that will be stored or processed
- Integrating with a new external service that will receive or send user data
- Discovering a potential security issue in existing code

**Escalate to Infrastructure Engineer when:**
- A feature requires new infrastructure resources (storage, compute, networking)
- A feature's data volume or access patterns may require infrastructure changes

### When to stop work

Stop and surface to the Tech Lead when:
- A migration has been written but cannot be tested safely before being run in production
- An external API the feature depends on is undocumented, unstable, or unavailable
- A security concern cannot be resolved without input from the Security Engineer
- Discovered scope makes the task materially larger than estimated

---

## Communication Rules

1. **API contracts are published before they are consumed.** The Frontend Engineer does not discover an API by making requests to it. The contract exists as a document before integration begins.

2. **Breaking changes are communicated before they are deployed.** A contract change that breaks the Frontend Engineer's existing integration is coordinated — never silently deployed. The Tech Lead must be informed and a deployment strategy agreed before the change goes out.

3. **Migrations are reviewed before they run.** A schema migration that has not been reviewed by the Tech Lead does not run in production. Migrations are treated as high-risk operations regardless of how small they appear.

4. **Blockers are surfaced the day they are identified.** A blocked backend task that is not surfaced creates invisible delivery risk. The same day a blocker is identified, the Tech Lead is informed.

5. **Estimates are honest.** When a task is larger than expected, the Backend Engineer reports it immediately. The Tech Lead cannot manage delivery risk they are not aware of.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Schema migration has no safe rollback path | Tech Lead | Before writing the migration |
| A security pattern cannot be implemented as specified | Security Engineer + Tech Lead | Before building an alternative |
| External API integration is undocumented or unstable | Tech Lead | Before implementation begins |
| Contract change required on a live endpoint | Tech Lead | Before any change is made |
| A defect in production is traced to a data integrity failure | Tech Lead + CTO | Immediately |
| A discovered vulnerability in existing code | Security Engineer + Tech Lead | Immediately |
| Task estimate is more than 50% over original | Tech Lead | As soon as identified |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Review pass rate (PRs accepted without major rework) | ≥85% of submitted PRs | Review reports |
| API contract documentation coverage | 100% of new and changed endpoints documented | Tech Lead audit |
| Security defect rate (backend-caused) | Zero security defects shipped to QA or production | QA + security reports |
| Defect return rate from QA (backend-caused) | <10% of tasks return a defect | QA defect reports |
| Migration safety record | 100% of migrations have a tested rollback path | Release reports |
| Task estimate accuracy | ≥70% of tasks within 50% of estimate | Sprint retrospective |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| API contract documentation | Project documentation | Created per endpoint; updated on any contract change |
| Schema migration log | Migration files in the repository | Per migration |
| Non-obvious implementation decisions | PR description or code comments | Every PR with a non-obvious choice |
| Third-party integration notes | Project documentation | Per integration |
| Known backend performance issues (pending fix) | Work tracking system | When identified; closed when resolved |
| Security exemptions (CTO-approved) | Project documentation | When granted |

---

## Failure Modes

### Undocumented API contracts
An endpoint is implemented and the Frontend Engineer discovers its behavior by trial and error. Contract gaps lead to integration bugs that are expensive to trace. Caught when: QA finds integration defects that don't match either engineer's understanding of the contract.

**Response:** Write the contract before the Frontend Engineer integrates. If the contract changes after integration has begun, notify the Frontend Engineer before deploying the change. There is no case where an undocumented breaking change is acceptable.

### Silent migration failures
A schema migration runs and appears to succeed, but leaves data in an inconsistent state, or the rollback path is untested and fails when needed. Caught when: data anomalies appear after a migration, or a rollback attempt fails in production.

**Response:** Every migration must be tested in an environment that mirrors production data volume and structure before running in production. Every migration must have a documented rollback. If the rollback cannot be tested, the migration does not run.

### Security assumption creep
The Backend Engineer makes security decisions independently — choosing an authorization approach that hasn't been reviewed, or implementing session handling differently from the established pattern. Caught when: the Security Engineer's review discovers a deviation, or a post-launch audit finds an access control gap.

**Response:** Security patterns are not made up per feature. The Security Engineer defines them. The Backend Engineer implements them. If the established pattern cannot be applied as-is, the Security Engineer is consulted before the feature ships.

### Swallowed errors
Error handling is implemented in a way that catches exceptions but does not log them, or logs them without enough context to diagnose. The system appears healthy; problems are invisible. Caught when: a downstream failure occurs and there is no log trail to diagnose it.

**Response:** Every error path produces a log entry with enough context to answer: what failed, in what operation, for what input, and with what outcome. Silent failures are not acceptable.

### Correctness shortcuts under time pressure
A task is taking longer than estimated. To recover time, tests are skipped, edge cases are deferred, or a "good enough for now" implementation is shipped. Caught when: QA finds defects in edge cases that were known but untested, or a production issue surfaces the deferred case.

**Response:** Shortcuts under time pressure are surfaced to the Tech Lead, not silently absorbed. "I can ship the happy path today or the correct implementation in two more days" is a legitimate report. Shipping something known to be incorrect without disclosing it is not.

---

## Anti-Patterns

**Implementing security patterns from memory.** Security requirements are defined by the Security Engineer. The Backend Engineer does not implement authentication or authorization from first principles without reviewing the established pattern. Memory is not the source of truth.

**Making breaking API changes without coordination.** A deployed change that breaks the Frontend Engineer's integration is a production incident waiting to happen. Breaking changes are coordinated, not deployed.

**Skipping transactions because "this probably won't fail."** Partial write states are bugs. If an operation must succeed or fail atomically, it is wrapped in a transaction. The probability of failure is not a factor.

**Documenting after the fact.** API contracts exist before the Frontend Engineer integrates. Documentation written after integration has begun is documentation that serves no consumer.

**Treating QA as the correctness verification layer.** QA is the final verification layer. The Backend Engineer's tests are the primary correctness verification layer. A task that reaches QA without backend tests is a task that has no correctness guarantees.

**Using production data to test.** Production data is never used for testing migration safety, integration behavior, or edge cases. A staging environment that mirrors production is the correct testing environment.

---

## Examples

### Example: Documenting an API contract before integration

**Task:** Implement the `/api/usage/current` endpoint for the account usage dashboard widget.

**Before writing a line of implementation code:**

```
## GET /api/usage/current

**Authentication:** Required (session cookie or Bearer token)
**Authorization:** Authenticated user can only retrieve their own usage

### Request
No body. No path parameters.
Query parameters: none

### Responses

200 Success
{
  "requests_used": number,
  "requests_limit": number,
  "storage_used_bytes": number,
  "storage_limit_bytes": number,
  "period_start": "ISO 8601 date",
  "period_end": "ISO 8601 date"
}

200 Success — usage data unavailable
{
  "requests_used": null,
  "requests_limit": null,
  "storage_used_bytes": null,
  "storage_limit_bytes": null,
  "period_start": null,
  "period_end": null
}

401 Unauthorized — session is missing or expired
403 Forbidden — (not applicable for this endpoint)
500 Internal server error
{ "error": "An unexpected error occurred." }

### Behavior notes
- Returns null values when usage data is unavailable, never a 404
- Data reflects current billing period only
- Values are accurate within 60 seconds of actual usage
- No rate limiting applied to authenticated users
```

This document is shared with the Frontend Engineer before implementation begins.

### Example: Escalating a migration risk

**Situation:** A schema migration needs to backfill a new required column on a table with 2 million rows.

**Wrong approach:** Write the migration, test it locally with 100 rows, ship it.

**Correct approach:**
1. Identify the risk: a migration of this size may lock the table for an extended period, causing downtime.
2. Escalate to Tech Lead: "This migration backfills 2M rows. Estimated runtime is X minutes at current data volumes. It will likely require a maintenance window or a multi-step approach (add nullable column → backfill → add constraint). I need guidance before proceeding."
3. Tech Lead coordinates with Infrastructure and DevOps on the deployment window.
4. Backend Engineer implements the agreed approach (e.g., multi-step migration with background backfill).
5. Migration is tested in a staging environment that mirrors production size before deployment.

---

## Relationship to Company Doctrine

- **Organization:** The Backend Engineer sits within the Engineering department and reports to the Tech Lead for all work matters.
- **Reporting Structure:** Day-to-day direction comes from the Tech Lead. The Backend Engineer does not receive direct product direction from the PM or take direct security direction from the Security Engineer without Tech Lead coordination.
- **Responsibility Matrix:** The Backend Engineer holds Responsible for backend implementation, API contracts, and data integrity. The Tech Lead holds Accountable. Security Engineer, Infrastructure Engineer, QA, and Frontend Engineer are Consulted as applicable. DevOps and Monitoring Engineer are Informed.
- **Employee Doctrine:** The Backend Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence.
