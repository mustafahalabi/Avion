# Knowledge Library System — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** Technical Writer (curation) · CTO (authority)  
**Last Updated:** 2026-06-29  

This document defines how the company organizes, validates, connects, searches, and maintains durable knowledge. It is the behavioral specification for the Knowledge Library — the curated, reference-quality tier of company information that employees rely on when they make decisions.

The Knowledge Library is a *system*, not a folder of documents. It sits alongside the company's experiential Memory and is deliberately distinguished from it: Memory accumulates continuously and may be rough; Knowledge is intentionally authored, reviewed, and published. This document specifies that distinction and the rules that keep the library trustworthy.

This document describes company behavior. It does not prescribe a storage engine, an index implementation, or an embedding model. Where a behavior is already implemented in the platform today, that is stated explicitly and separated from behavior that is designed but not yet built. Storage choices are intentionally treated as replaceable — see [§13 Current Implementation Status](#13-current-implementation-status).

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Knowledge vs. Memory](#3-knowledge-vs-memory)
4. [Knowledge Types](#4-knowledge-types)
5. [Knowledge Domains and How They Relate](#5-knowledge-domains-and-how-they-relate)
6. [Ownership](#6-ownership)
7. [Knowledge Lifecycle](#7-knowledge-lifecycle)
8. [Validation Rules](#8-validation-rules)
9. [Update and Supersession Rules](#9-update-and-supersession-rules)
10. [Connection and Search](#10-connection-and-search)
11. [Quality Standards](#11-quality-standards)
12. [Failure Modes](#12-failure-modes)
13. [Current Implementation Status](#13-current-implementation-status)
14. [Relationship to Other Documents](#14-relationship-to-other-documents)

---

## 1. Purpose

The Knowledge Library exists so the company answers a question once and never re-derives the answer. When an engineer needs the approved way to implement authentication, when a reviewer needs the company's coding standard, when the Release Manager needs the rollback runbook — the answer is a published, owned, current Knowledge Record, not a fresh derivation or a guess.

The library has three responsibilities:

1. **Preserve authoritative answers.** Architecture decisions, API contracts, approved patterns, standards, and runbooks are written down once, reviewed, and published so they bind future work.
2. **Make knowledge retrievable at the moment of decision.** Every employee retrieves relevant knowledge before producing an output (see [COMPANY_RUNTIME.md §13](../architecture/COMPANY_RUNTIME.md#13-knowledge-retrieval)). The library is the source that retrieval reads.
3. **Compound organizational intelligence.** Knowledge that is curated, connected, and kept current is what makes the company smarter over time. Knowledge that is stale or unfindable is worse than no knowledge — it teaches employees the wrong thing with confidence.

The library is a competitive asset of the company in the same way Memory is. It is the difference between an organization that learns and one that repeats itself.

---

## 2. Scope

**In scope:**

- The curated, reference-quality tier of company information: the Knowledge base and its Knowledge Records.
- How knowledge is typed, owned, validated, published, superseded, and retired.
- How the five knowledge domains — documentation, architecture, repository, product, and operational knowledge — relate to one another and to Memory.
- The quality bar a record must meet before it is published, and the failure modes that erode that bar.

**Out of scope:**

- **Experiential Memory mechanics.** Memory layers, Memory Records, and the rules for accumulating them belong to the Memory system and [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#knowledge-and-memory-objects). This document references Memory only to draw the boundary in [§3](#3-knowledge-vs-memory).
- **Temporary conversation context.** Session-scoped working memory (Conversations and their Messages) is explicitly *not* knowledge. See [§3](#3-knowledge-vs-memory).
- **Storage, indexing, and retrieval implementation.** The library is specified as behavior. The persistence layer is replaceable; today's implementation is recorded in [§13](#13-current-implementation-status) for transparency, not as a contract.
- **Repository analysis mechanics.** How the company derives repository facts is owned by the repository intelligence system ([REPOSITORY_ANALYSIS_SNAPSHOTS.md](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md)); this document covers only how those facts become durable repository *knowledge*.

---

## 3. Knowledge vs. Memory

Engineering OS maintains two complementary stores. Conflating them is the most common and most damaging mistake, so the boundary is defined precisely.

| Dimension | Memory | Knowledge |
|---|---|---|
| **Nature** | Experiential — what the company has observed and learned | Curated — what the company officially asserts as true |
| **Creation** | Generated continuously by workflow completion and by employees | Intentionally authored and reviewed before publication |
| **Quality** | May be rough, partial, or low-confidence | Reference-quality; reviewed for accuracy |
| **Trust** | Carries a confidence indicator; treated as evidence | Treated as authoritative; the company's official position |
| **Lifecycle** | Accumulated, deprecated, superseded — never deleted | Drafted → reviewed → published → deprecated — never deleted |
| **Owner** | The employee or workflow that produced the record | Technical Writer (curation), CTO/Tech Lead (approval) |
| **Typical record** | "When we shipped checkout we found the gateway times out at 8s." | "The approved payment integration pattern is X." |

**The relationship is directional.** Memory feeds Knowledge. A pattern observed repeatedly in Memory, or a lesson learned from an incident, is *promoted* into Knowledge through deliberate curation: the Technical Writer drafts a record, an authority reviews it for accuracy, and it is published. Knowledge does not feed back into Memory automatically — Knowledge is the distilled, vetted output, not raw experience.

**Both differ from conversation context.** A Conversation is temporary working memory scoped to a single thread between the CEO and the company. Conversation content is *never* treated as durable knowledge. If something said in a conversation matters beyond the session, an employee must capture it as a Memory Record (evidence) or promote it to a Knowledge Record (an asserted standard). Until that capture happens, it does not exist from the company's perspective once the session closes. This separation is a hard rule: the library must never depend on transient conversation state.

---

## 4. Knowledge Types

Every Knowledge Record has a type. The type determines who must approve it, how it is validated, and how often it is re-checked for staleness.

| Type | Description | Approval Authority | Re-validation Trigger |
|---|---|---|---|
| `architecture` | Canonical architecture descriptions, diagrams, and system boundaries | CTO | Architectural change; major release |
| `api_contract` | Published interface contracts between services or for external consumers | Tech Lead → CTO | Any change to the interface |
| `pattern` | The company's approved way to solve a recurring problem | Tech Lead | New pattern supersedes; incident reveals the pattern is unsafe |
| `standard` | Coding, naming, documentation, accessibility, and security standards | CTO | Standard revision; culture-profile change |
| `guide` | How-to references for employees performing recurring work | Technical Writer → Tech Lead | Source process changes |
| `runbook` | Operational procedures: deployment, rollback, incident response | Release Manager / DevOps → CTO | Post-incident review; tooling change |

**Type rules:**

- A record has exactly one primary type. A document that spans types (an architecture guide that also defines a standard) is split so each assertion has one owner and one re-validation trigger.
- The type is chosen at draft time and does not change. If the nature of the content changes, the old record is deprecated and a new record of the correct type is published.
- `runbook` and `api_contract` records carry the highest operational risk when stale and therefore have the strictest re-validation triggers — any change to the underlying procedure or interface invalidates the record until it is re-reviewed.

---

## 5. Knowledge Domains and How They Relate

The deliverable for this system is an explicit account of how the company's five knowledge domains relate. They are *domains* — slices of the library organized by subject — not separate stores. A single Knowledge base holds all of them.

### 5.1 The five domains

1. **Documentation knowledge** — User-facing and developer-facing documentation: changelogs, feature documentation, public guides. Authored and curated by the Technical Writer. This is the outward-facing surface of the library.
2. **Architecture knowledge** — How the system is built and why: system boundaries, data flow, technology selections, and the decisions that constrain them. Owned by the CTO.
3. **Repository knowledge** — What the company knows about a specific codebase: structure, conventions, dependencies, frameworks, and known debt. Derived from repository analysis and promoted into durable knowledge by the Tech Lead. This is the codebase-specific subset of architecture knowledge.
4. **Product knowledge** — What the product does, who it is for, what shipped, and the business rules that govern behavior. Owned by the Product Manager; sourced from Feature Briefs and Feature Memory.
5. **Operational knowledge** — How the company runs the system in production: deployment runbooks, rollback procedures, monitoring baselines, and incident playbooks. Owned by the Release Manager and DevOps, approved by the CTO.

### 5.2 How they relate

```
                     ┌──────────────────────────┐
                     │   Documentation knowledge │  (the curated surface)
                     └─────────────▲────────────┘
                                   │ distilled from
        ┌──────────────────┬───────┴───────┬───────────────────┐
        │                  │               │                   │
  Architecture        Repository        Product           Operational
  knowledge           knowledge         knowledge          knowledge
   (CTO)              (Tech Lead)       (Product Mgr)      (Release/DevOps→CTO)
        ▲                  ▲               ▲                   ▲
        │                  │               │                   │
   Decisions &       Repository        Feature Briefs &     Releases,
   architecture      analysis &        Feature Memory       incidents &
   reviews           snapshots                              monitoring
```

- **Architecture knowledge is the spine.** Repository, product, and operational knowledge all reference architecture knowledge for constraints. An API contract (architecture/`api_contract`) is referenced by repository knowledge (how it is implemented here), by product knowledge (what capability it exposes), and by operational knowledge (how it is deployed and monitored).
- **Repository knowledge specializes architecture knowledge for one codebase.** General architecture knowledge says "we publish API contracts before frontend implements against them." Repository knowledge says "in *this* repo, contracts live here and follow this convention." Repository knowledge is sourced from the repository intelligence system and promoted deliberately; it is never assumed current without a recent analysis.
- **Product knowledge is sourced from delivery.** Every shipped Feature leaves a Feature Memory record; the durable, curated portion — what the feature does, the business rules it enforces — is promoted into product knowledge.
- **Operational knowledge is sourced from running the system.** Runbooks are authored from real releases and refined by post-incident reviews. A runbook that was never run against reality is a draft, not knowledge.
- **Documentation knowledge is the distilled, outward-facing layer.** It is authored from the other four domains by the Technical Writer. It does not introduce new facts; it presents existing knowledge clearly for its audience.

No domain is permitted to silently contradict another. When repository knowledge and architecture knowledge disagree, the conflict is surfaced and resolved by authority (CTO for architecture), not by leaving two contradictory records published. See [§8](#8-validation-rules) and [§9](#9-update-and-supersession-rules).

---

## 6. Ownership

Knowledge follows the company's permanent rule: **one owner**. Every Knowledge Record has exactly one accountable owner, even when many employees contribute content.

| Responsibility | Role |
|---|---|
| Curation, organization, editing for clarity, publication | **Technical Writer** |
| Accuracy approval for architecture and standards | **CTO** |
| Accuracy approval for repository patterns and API contracts | **Tech Lead** |
| Operational runbook accuracy | **Release Manager / DevOps Engineer** (CTO approves) |
| Product and business-rule accuracy | **Product Manager** |
| Authority over the library as a whole | **CTO** |

**The Technical Writer owns curation, not content.** Engineers and other specialists provide the technical substance; the Technical Writer organizes it, edits it for clarity, routes it for accuracy approval, and publishes it. The Technical Writer never invents technical content. This mirrors the knowledge-update procedure in [COMPANY_RUNTIME.md §23](../architecture/COMPANY_RUNTIME.md#23-knowledge-updates) and the Technical Writer's mandate in their handbook ([TECHNICAL_WRITER.md](../employees/TECHNICAL_WRITER.md)).

**Ownership is durable.** When an owning role is reassigned or the original author is unavailable, ownership transfers to the current holder of the role — it does not lapse. An ownerless Knowledge Record is a validation failure ([§8](#8-validation-rules)).

---

## 7. Knowledge Lifecycle

A Knowledge Record moves through a defined lifecycle. The status values are `draft → in_review → published → deprecated`. The transitions are gated; a record cannot skip a state.

```
identified gap or promotion candidate
   ↓ (Technical Writer drafts)
draft
   ↓ (routed to accuracy authority)
in_review
   ↓ (authority approves accuracy)        ↓ (authority rejects)
published                                  back to draft
   ↓ (superseded by a newer record OR judged no longer accurate)
deprecated  ──→ points to successor (if one exists)
```

**Lifecycle rules:**

1. **Draft.** The Technical Writer (or a contributing specialist) drafts the record from a source: a Memory Record, a Decision, a Feature Brief, a repository analysis, an incident review, or vendor documentation. The draft names its type, its owner, and its source.
2. **Review.** The draft is routed to the accuracy authority for its type ([§4](#4-knowledge-types)). The authority reviews for *accuracy* — is this true and current? — not for style. The Technical Writer owns style.
3. **Publish.** Only an approved record is published. A published record is authoritative: employees may rely on it without re-deriving it. Publication records who approved it and when.
4. **Deprecate.** A published record is deprecated when it is superseded by a newer record or when it is judged no longer accurate. Deprecation is the only retirement path — see [§9](#9-update-and-supersession-rules).

**A record is never deleted.** Deprecated records are retained for history and traceability. This is a hard invariant shared with Memory and the Decision system: the company does not erase what it once asserted.

---

## 8. Validation Rules

Validation is what separates a Knowledge Record from a note. A record that fails any of these checks is not eligible for publication.

**Pre-publication validation (all must hold):**

- [ ] **Single type.** The record has exactly one of the types in [§4](#4-knowledge-types).
- [ ] **Single owner.** Exactly one accountable owner is named, and it is the correct authority for the type.
- [ ] **Accuracy-reviewed.** The record was reviewed by its accuracy authority and approved. A record cannot be self-published by its author without review.
- [ ] **Sourced.** The record names where its content came from (Memory Record, Decision, Feature Brief, repository analysis, incident review, or external source). Knowledge with no traceable source cannot be re-derived when its source changes and is therefore not publishable.
- [ ] **Non-contradictory.** The record does not contradict another published record. If it must change an existing assertion, the existing record is deprecated in the same operation ([§9](#9-update-and-supersession-rules)).
- [ ] **Audience-appropriate.** The content matches its domain's audience. Documentation knowledge is user-facing; it must not contain commit hashes, internal ticket IDs, or implementation logs (the same standard the [Release SOP](../sops/RELEASE.md#changelog-standard) applies to changelogs).

**Ongoing validation (staleness):**

- Every type carries a re-validation trigger ([§4](#4-knowledge-types)). When the trigger fires — an interface changes, an incident review completes, an architecture decision is recorded — the affected record is flagged for re-review. A flagged record remains published but is marked as requiring re-validation so consumers know it is under review.
- `runbook` and `api_contract` records are re-validated against reality, not against intent. A runbook is valid only if it describes what actually happens when it is run.

**Validation is the gate that makes the library trustworthy.** An unvalidated entry that is treated as authoritative is more dangerous than a missing entry, because employees act on it with confidence. See [§12](#12-failure-modes).

---

## 9. Update and Supersession Rules

Knowledge changes over time. The library handles change through supersession, never through silent edits or deletion.

**Supersession sequence:**

```
new fact, decision, or correction arrives
   ↓
owner drafts a successor Knowledge Record (new version)
   ↓
successor is reviewed and approved
   ↓
successor is published AND prior record is deprecated in the same operation
   ↓
deprecated record links forward to its successor
```

**Update rules:**

- **Supersede, do not overwrite.** A published record is not edited in place to change an assertion. A new record is published and the old one is deprecated with a forward link. This preserves the history of what the company believed and when — essential for incident reviews and for understanding why past work was done a certain way.
- **Minor corrections** (a typo, a broken link, a clarifying sentence that does not change the assertion) may be applied in place by the owner without a full supersession cycle. The test is whether the *meaning* changed; if it did, supersede.
- **Conflict resolution by authority.** When two records or two domains conflict, the conflict is escalated to the owning authority (CTO for architecture and standards, Tech Lead for repository patterns, Product Manager for business rules) and resolved by deprecating the incorrect record. Conflicts are never left published side by side, and they are never resolved by consensus or by leaving the reader to choose. This follows the conflict-resolution discipline in [COMPANY_RUNTIME.md §16](../architecture/COMPANY_RUNTIME.md#16-conflict-resolution).
- **Promotion from Memory triggers an update check.** When a recurring Memory pattern or an incident lesson is promoted into Knowledge, the owner checks whether an existing record must be superseded rather than creating a duplicate.

---

## 10. Connection and Search

Knowledge is only valuable if it is retrievable at the moment of decision. The library is designed to be both *connected* and *searchable*.

**Connection (designed).** Knowledge Records reference one another and reference the artifacts they were derived from — Decisions, Feature Briefs, repository analyses, and Memory Records. These connections let an employee follow a chain: from a product capability, to the API contract it depends on, to the runbook that deploys it. Connection is what turns a pile of documents into a knowledge system. The relationships are specified in [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#knowledge-and-memory-objects) (Knowledge → Knowledge Records → Knowledge Sources, with references into Decisions and Memory).

**Search (designed).** Retrieval is scoped to the employee and the task: an engineer about to implement retrieves the standards and patterns for their domain; a reviewer retrieves the quality standards; the Release Manager retrieves the deployment history and runbooks. Retrieval is mandatory before an employee produces an output — see [COMPANY_RUNTIME.md §13–14](../architecture/COMPANY_RUNTIME.md#13-knowledge-retrieval). When retrieval finds a gap, the employee records the gap and proceeds with best judgment, then files the result so the gap is closed.

**Storage independence.** How connection and search are physically implemented — relational joins, a graph, full-text indexing, or vector embeddings over record content — is an implementation choice and is intentionally left open. The behavioral contract is: knowledge is connected to its sources and related records, and it is retrievable scoped to role and task. The engine behind that contract is replaceable. The current state of the implementation is in [§13](#13-current-implementation-status).

---

## 11. Quality Standards

The library defines an explicit quality bar. A record that does not meet it is not published.

| Standard | Expectation |
|---|---|
| **Accurate** | Reviewed and approved by the accuracy authority for its type. True at the time of publication. |
| **Current** | Subject to its re-validation trigger. A stale record is flagged, not silently trusted. |
| **Sourced** | Traceable to the Memory Record, Decision, analysis, or external source it was derived from. |
| **Owned** | Exactly one accountable owner, who is the correct authority for the type. |
| **Singular** | Asserts one thing of one type. No record mixes architecture, standards, and runbooks. |
| **Self-contained** | Understandable by any employee in the relevant domain without tribal context. |
| **Audience-correct** | Matches the audience of its domain. Documentation knowledge is user-facing and free of implementation noise. |
| **Non-contradictory** | Does not conflict with another published record; conflicts are resolved by supersession. |
| **Plain language** | Written so a competent employee can act on it. Curation removes jargon that does not earn its place. |

**The quality bar is the point of the system.** Memory tolerates rough, low-confidence records because Memory is evidence. Knowledge does not, because Knowledge is authority. The moment the library publishes something inaccurate, unsourced, or ownerless, every employee who retrieves it inherits the error. Holding the bar is the Technical Writer's primary discipline and the CTO's primary oversight responsibility.

---

## 12. Failure Modes

These are the recurring ways a knowledge library degrades. Each is paired with the response that prevents it.

### Conversation content treated as knowledge
Something stated in a CEO conversation is acted on as if it were a published standard, but it was never captured. When the session closes, the context is gone and the "knowledge" cannot be traced or trusted.

**Response:** Conversation context is never knowledge. If it matters beyond the session, it is captured as a Memory Record (evidence) or promoted to a reviewed Knowledge Record (authority). Until then it does not exist for the company. This is the durable-vs-temporary boundary from [§3](#3-knowledge-vs-memory), enforced.

### Stale knowledge trusted as current
A runbook or API contract was accurate when published, the underlying procedure changed, and no one re-validated. An employee follows it and the deployment fails or the integration breaks.

**Response:** Every type carries a re-validation trigger ([§4](#4-knowledge-types)). When the trigger fires, the record is flagged for re-review and consumers see it is under review. `runbook` and `api_contract` records are validated against reality, not intent.

### Unsourced knowledge that cannot be re-derived
A record asserts a fact with no link to where it came from. When the source changes, no one knows the record is now wrong, and it cannot be regenerated.

**Response:** Sourcing is a publication gate ([§8](#8-validation-rules)). A record names its origin or it is not published.

### Contradictory records published side by side
Two records — often one in architecture knowledge and one in repository knowledge — assert different things. Employees retrieve whichever they find first and make inconsistent decisions.

**Response:** Non-contradiction is a publication gate. Conflicts are resolved by the owning authority via supersession ([§9](#9-update-and-supersession-rules)), never by leaving both published.

### Silent edits that erase history
A published record is edited in place to change an assertion, destroying the record of what the company previously believed. A later incident review cannot reconstruct why past work was done a certain way.

**Response:** Supersede, do not overwrite. Meaningful changes create a successor and deprecate the prior record with a forward link. Records are never deleted.

### Documentation knowledge written for the wrong audience
User-facing documentation is filled with commit hashes, internal ticket IDs, and implementation detail. Readers cannot understand what changed.

**Response:** Audience-correctness is a quality standard and a publication gate. Documentation knowledge is user-facing first; technical detail lives in the record's source, not in the published documentation. This mirrors the changelog standard in the [Release SOP](../sops/RELEASE.md#changelog-standard).

### The library treated as a dumping ground
Every rough note is published as Knowledge, eroding the distinction between evidence and authority. The bar collapses and employees stop trusting the library.

**Response:** Rough material belongs in Memory. Promotion into Knowledge is deliberate, reviewed, and gated. The Technical Writer guards the boundary; the CTO holds the authority to keep it.

---

## 13. Current Implementation Status

This section records what the platform actually persists today, separated from what is designed. It is provided for transparency. The behaviors in §1–§12 are the contract; the storage below is an implementation detail and is replaceable.

**Implemented today:**

- **A Knowledge container with records.** The platform persists a `Knowledge` container (title, description, category, tags) holding many `KnowledgeRecord` entries (content, with a `format` field defaulting to `markdown`). This is the seed of the curated tier described in this document.
- **A Memory tier with records, used in the product UI.** The company-scoped `Memory` model (title, summary, `category`, owner type/id, tags) holds many `MemoryRecord` entries (content, optional `source`, and a `confidence` value from 0 to 1). A working **Memory** section in the app lists memory banks by category, shows per-record source and confidence, and lets the CEO add records. Companies are seeded with starter banks — Company, Architecture, Product, Security, and Operations — which align with the knowledge domains in [§5](#5-knowledge-domains-and-how-they-relate).
- **Category taxonomy.** Memory categories implemented today are `company`, `architecture`, `product`, `security`, `operations`, `employee`, `feature`, and `decision` — the spine of the domain organization in this document.
- **Separation from conversation context.** Conversations and Messages are persisted as their own models, distinct from Memory and Knowledge, which keeps temporary working context structurally separate from durable knowledge as required by [§3](#3-knowledge-vs-memory).

**Designed but not yet built:**

- **The full lifecycle and review gate.** The `draft → in_review → published → deprecated` status machine ([§7](#7-knowledge-lifecycle)), the per-type approval authorities ([§4](#4-knowledge-types)), and the publication validation gates ([§8](#8-validation-rules)) are specified here but are not yet enforced by the platform.
- **Knowledge Sources and connection.** Source tracking and inter-record references ([§10](#10-connection-and-search)) are specified in [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#knowledge-and-memory-objects) but the `KnowledgeRecord` model does not yet carry source or relationship links.
- **Scoped retrieval and search.** Role- and task-scoped retrieval ([§10](#10-connection-and-search)) and any indexing or embedding layer are designed, not implemented. No automated promotion from Memory to Knowledge exists yet.
- **A dedicated Knowledge UI.** Today the curated tier is surfaced through the Memory section; a distinct, lifecycle-aware Knowledge surface is future work.

Consistent with the project's hard rule, no automated knowledge intelligence is claimed beyond what the code does. The promotion, validation, and search behaviors are deliberately gated behind specification — this document is part of that specification.

---

## 14. Relationship to Other Documents

- **[DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#knowledge-and-memory-objects)** defines the Knowledge, Knowledge Record, Knowledge Source, Memory, and Memory Record objects and their invariants. This document specifies the *behavior* of the curated tier built on those objects.
- **[COMPANY_RUNTIME.md](../architecture/COMPANY_RUNTIME.md)** specifies when knowledge is retrieved (§13), when memory is retrieved (§14), and how knowledge updates are performed by the Technical Writer (§23). This document specifies what the library that those steps read and write must look like.
- **[REPOSITORY_ANALYSIS_SNAPSHOTS.md](../architecture/REPOSITORY_ANALYSIS_SNAPSHOTS.md)** owns how repository facts are derived; this document covers only how those facts become durable repository knowledge ([§5](#5-knowledge-domains-and-how-they-relate)).
- **[RELEASE.md](../sops/RELEASE.md)** and the other [SOPs](../sops/) produce operational and product knowledge — runbooks, changelogs, release records — that the library curates. The changelog standard there is the canonical example of audience-correct documentation knowledge.
- **[TECHNICAL_WRITER.md](../employees/TECHNICAL_WRITER.md)** is the handbook for the role that owns curation. **[COMPANY_OPERATING_SYSTEM.md](../company/COMPANY_OPERATING_SYSTEM.md)** defines the organizational principles — one owner, documentation is engineering — that this system enforces.
