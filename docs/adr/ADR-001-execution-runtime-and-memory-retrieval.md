# ADR-001: Execution Runtime and Memory Retrieval Architecture

**Status:** Accepted  
**Date:** 2026-06-27  
**Author:** CTO  
**Approved By:** CEO  

---

## Context

Before implementing Engineering OS Platform v1, the team needed to make foundational decisions about how employee roles are invoked, how company memory is retrieved and served, and which external frameworks or infrastructure would be adopted. These decisions affect every module in the system and are difficult to reverse once implementation begins.

The key tensions that required resolution:

- The organizational model requires persistent employee roles, durable work artifacts, and company memory that survives across sessions and provider changes. This points toward building a runtime owned by Engineering OS rather than outsourcing orchestration to a third-party workflow framework.
- AI execution engines (Claude Code, Codex CLI, Gemini CLI, API providers) are the practical tools that perform reasoning and code generation. The architecture must support these without becoming dependent on any single one.
- Company memory is a competitive advantage. It must be stored durably, remain accessible across providers, and be designed for future semantic retrieval without requiring a separate vector database in V1.
- The development team is small and V1 scope is constrained. Adopting complex infrastructure (LangGraph, Temporal, dedicated vector databases) before it is needed would slow delivery and add operational risk.

---

## Decisions

### Decision 1: Engineering OS owns the Company Runtime

**Decided:** Engineering OS will own and implement its own Company Runtime rather than outsourcing core orchestration to LangGraph, Temporal, or another workflow framework in V1.

The Company Runtime is responsible for:
- Orchestration (which employee acts, in what order, on what work)
- Scheduling and dispatch (when events fire, which worker claims them)
- Runtime state (current phase of every active work item)
- Retries, cancellation, and escalation
- Persistence (writing structured outputs to durable records)
- Timeline updates and notifications
- Company memory and event routing

The runtime event queue is a table in PostgreSQL. A Worker process polls the table, claims events via a Lease mechanism, and delegates processing to AgentRunner.

### Decision 2: V1 uses a DB-backed runtime event table and Worker/Dispatcher model

**Decided:** The runtime event queue in V1 is a table in the primary PostgreSQL database. Workers poll this table for pending events and claim them via a database-level Lease (row-level lock or status + claimed_by field).

This is sufficient for V1 scale and avoids the operational complexity of a dedicated queue service. The event table is durable (persisted to PostgreSQL), recoverable (events not completed within the Lease timeout are re-queued), and auditable (every event is a permanent record).

### Decision 3: Employees are persistent company roles invoked by AgentRunner

**Decided:** Employees are defined as persistent organizational roles — not always-running background processes, not transient prompts, and not separate authenticated users.

When an employee must act, the Company Runtime emits a domain event. A Worker claims the event. AgentRunner identifies the responsible employee role, assembles a Context Package, and invokes the Execution Adapter. The employee produces a Structured Result. The runtime persists the result as durable artifacts and emits the next event.

Employees do not listen for work. They are invoked.

### Decision 4: Execution engines are provider-independent adapters

**Decided:** No execution engine is architecturally required. Claude Code, Codex CLI, Gemini CLI, API-based providers, local models, and future engines are all valid Execution Adapters.

AgentRunner interacts with execution engines only through the Execution Adapter interface. Adapters translate a Context Package into engine-specific input and translate engine-specific output into a Structured Result. Provider-specific flags (e.g., `--permission-mode bypassPermissions`) live in the adapter layer and are never surfaced to the Company Runtime.

### Decision 5: Claude Code, Codex CLI, and other engines are replaceable providers

**Decided:** Claude Code will be the initial Execution Adapter in V1. It is not the only supported adapter, and the architecture must not assume its presence. The system must be demonstrably portable — switching the execution engine should require only a different adapter registration, not changes to the Company Runtime, AgentRunner, or Context Builder.

### Decision 6: Interactive mode and background mode are separate execution policies

**Decided:** V1 supports interactive supervised execution, in which the CEO can observe the execution engine working in real time. V1.5 will add background automation, in which work proceeds without an active user session. These are abstract execution policies expressed in the Execution Profile — not engine-specific configuration.

### Decision 7: `claude -p` and provider-specific flags are adapter-level concerns

**Decided:** Provider-specific invocation flags, permission modes, and API credentials are configuration for Execution Adapters, not concepts understood by the Company Runtime. The runtime operates only with abstract policy names (interactive_supervised, background_automation, ask_before_running, read_only, full_access). Adapters translate these to engine-specific configuration at invocation time.

### Decision 8: Shared context lives in durable Engineering OS records, not hidden model sessions

**Decided:** Employees never communicate through hidden AI model sessions or transient context windows. All inter-employee communication takes the form of durable company artifacts — Comments, Reviews, Plans, Decisions, QA Results, Reports, Memory Records, and Timeline Events. The Context Builder assembles these artifacts into a Context Package before each invocation. The execution engine receives a curated package; it does not maintain session state across invocations.

### Decision 9: V1 uses structured PostgreSQL memory first

**Decided:** V1 company memory is stored as relational records in PostgreSQL. This includes Memory Records (discrete facts accumulated by employees), Knowledge Records (curated reference material), and JSONB-based Knowledge Graph Snapshots (repository structure and dependency data). Plain SQL is the source of truth. The schema is designed to support Embedding Records and vector retrieval without requiring migration.

### Decision 10: pgvector is the preferred future semantic retrieval layer inside PostgreSQL

**Decided:** When semantic retrieval becomes necessary (planned for V1.5), it will be implemented using the pgvector extension inside the existing PostgreSQL database. Embeddings are stored as Embedding Records alongside their parent Memory or Knowledge Records. The Context Builder uses hybrid retrieval: structured SQL filters combined with pgvector similarity ranking.

### Decision 11: A separate vector database is not needed for V1

**Decided:** Pinecone, Weaviate, Qdrant, and similar dedicated vector databases are not adopted for V1. pgvector inside PostgreSQL is architecturally sufficient and eliminates operational overhead. Vectors are retrieval indexes, not the primary data store. The relational records are always the source of truth.

---

## Consequences

### Positive

- The Company Runtime is owned by Engineering OS, making it modifiable, auditable, and aligned with the product's organizational model.
- Provider independence is a first-class architectural property. Users can switch execution engines without losing company memory or history.
- No external workflow framework dependency. V1 is simpler to deploy, debug, and evolve.
- PostgreSQL handles both relational data and future vector retrieval. The operational surface area stays minimal.
- The Worker + event table model is recoverable and auditable. Events are permanent records.

### Negative and Tradeoffs

- Engineering OS must implement and maintain its own runtime event dispatching. At large scale, a dedicated queue service or durable workflow engine may be superior.
- The Worker polling model has higher latency than event-push architectures. Acceptable for V1; may require revision at scale.
- pgvector inside PostgreSQL is effective but less specialized than dedicated vector databases at very large embedding volumes. This becomes a concern if knowledge scales into tens of millions of records.
- V1.5 background execution requires a persistent Worker process deployed outside the web request cycle. This adds deployment complexity compared to a pure serverless model.

---

## Alternatives Considered

### LangGraph as the Company Runtime

LangGraph provides graph-based state machines for multi-agent orchestration. It was considered because it is well-suited to multi-step agent workflows.

**Why not adopted:** LangGraph would make the Company Runtime dependent on a third-party framework whose abstractions may not align with the Engineering OS organizational model. It would introduce a framework dependency at the core of the system, limiting the team's ability to evolve the runtime independently. It adds operational complexity in V1 where it is not necessary. It is deferred to V2 evaluation if the product needs justify it.

### Temporal as the Company Runtime

Temporal provides durable execution for long-running workflows. It was considered because it handles retries, state persistence, and workflow versioning natively.

**Why not adopted:** Temporal requires significant operational infrastructure and introduces a dependency that is disproportionate to V1 scale. The Worker + event table model provides comparable durability and recoverability at a fraction of the complexity. Temporal is deferred to V2 evaluation if the Worker model proves insufficient.

### A separate vector database for semantic retrieval

Dedicated vector databases (Pinecone, Weaviate, Qdrant) were considered for managing embedding retrieval.

**Why not adopted:** These systems add an additional operational dependency, require data synchronization between PostgreSQL and the vector store, and introduce complexity that is not justified for V1. pgvector inside PostgreSQL is the correct first step. A separate vector database would only be justified by scale that V1 will not reach.

### Making Claude Code the core runtime

An alternative architecture would have used Claude Code's native multi-agent orchestration as the primary execution model.

**Why not adopted:** This would make the Company Runtime dependent on a single provider's tool. Users could not switch execution engines. Company memory would be tied to Claude Code's session model. Provider independence would be impossible. This conflicts directly with Product Principle 8 (Execution Engines Are Configurable Infrastructure).

---

## Follow-up Work

The following items are deferred and should be revisited at the appropriate phase:

- **Worker reliability at scale** — the polling interval, Lease timeout, and concurrent Worker count should be benchmarked after V1 beta usage patterns are known.
- **pgvector integration** — schema design for Embedding Records and Context Builder support for hybrid retrieval (V1.5).
- **Background Worker deployment** — process management, monitoring, and restart policies for Workers running outside the web request cycle (V1.5).
- **Temporal evaluation** — if V2 scale or workflow complexity exceeds what the Worker + event table model can handle, evaluate Temporal or an equivalent durable workflow engine.
- **Execution Adapter registry** — per-company and per-employee adapter configuration UI and storage (V1.5).

---

## Related Documents

- [COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md) — describes the organizational behavior of the Company Runtime and the event-driven invocation model
- [TECHNICAL_ARCHITECTURE.md](../architecture/TECHNICAL_ARCHITECTURE.md) — defines AgentRunner, Context Builder, Worker, Execution Architecture (Section 10), and the three-layer Memory Architecture (Section 4.10)
- [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md) — defines Runtime Event, Agent Run, Context Package, Execution Adapter, Execution Profile, Embedding Record, and Knowledge Graph Snapshot
- [MVP_ROADMAP.md](../product/MVP_ROADMAP.md) — Section 13 (Technology Strategy and Phasing) documents the V1/V1.5/V2 technology decisions aligned with this ADR
- [PRODUCT_REQUIREMENTS.md](../product/PRODUCT_REQUIREMENTS.md) — Product Principle 8 (Provider Independence) and the execution mode requirements in F-09
