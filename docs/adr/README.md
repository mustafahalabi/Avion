# Architecture Decision Records — Engineering OS

**Status:** Active
**Owner:** CTO
**Approved By:** CEO
**Last Updated:** 2026-06-29

This directory holds the **Architecture Decision Records (ADRs)** for Engineering OS — durable, numbered records of the foundational technical decisions that shape the platform. Each ADR captures the context, the options weighed, the decision taken, and its consequences, so that future contributors can understand *why* the system is built the way it is rather than only *how*.

ADRs are append-only history. An accepted decision is not edited away when it changes; instead a new ADR supersedes it and references the one it replaces. The CTO owns this record set and the CEO approves each decision.

---

## Index

| ADR | Title | Status | Summary |
|---|---|---|---|
| [ADR-001](./ADR-001-execution-runtime-and-memory-retrieval.md) | Execution Runtime and Memory Retrieval Architecture | Accepted | Establishes an Engineering OS-owned runtime and provider-agnostic execution adapters, with durable company memory stored for future semantic retrieval without a V1 vector database. |

---

## Conventions

- **Filename:** `ADR-NNN-short-kebab-title.md` (zero-padded, monotonically increasing number).
- **Front-matter:** `Status`, `Date`, `Author`, `Approved By`.
- **Status values:** `Proposed` → `Accepted` → `Superseded` (a superseding ADR links back to the one it replaces).
- **Body:** Context → Decision → Consequences. State the tensions before the choice.

To add a record, copy the structure of an existing ADR, take the next number, and link it in the index table above.
