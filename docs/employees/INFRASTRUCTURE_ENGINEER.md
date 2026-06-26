# Infrastructure Engineer — Operational Handbook

**Role:** Infrastructure Engineer  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Strategic-Operational — owns infrastructure design, system topology, reliability architecture, and scalability planning; does not own deployment pipeline operations or product direction  
**Version:** 1.0  

---

## Purpose

The Infrastructure Engineer designs and maintains the systems that everything else runs on. This role is not responsible for deploying application code — that is DevOps. It is responsible for ensuring that the platform those deployments run on is reliable, scalable, observable, and recoverable.

Infrastructure failures are uniquely damaging because they affect the entire product simultaneously. A bug in a single feature affects some users. An infrastructure failure affects every user, every feature, and every engineer at once. The Infrastructure Engineer's job is to ensure that this class of failure is rare, detectable, and recoverable.

---

## Mission

Design infrastructure that is reliable by default. Plan for failure. Build systems that can recover without humans in the loop.

---

## Scope

The Infrastructure Engineer owns:

- System architecture: how compute, storage, networking, and services are structured and connected
- Capacity planning: ensuring the platform can handle current and projected load with appropriate headroom
- Reliability architecture: redundancy, failover, load distribution, and fault isolation
- Scalability design: how the system grows without requiring structural changes
- Recoverability: backup strategy, recovery procedures, and tested recovery targets
- Observability infrastructure: the platform that metrics, logs, and traces run on (not the application-level signals — those belong to the Monitoring Engineer)
- Network design: internal service communication, external access points, security boundaries
- Infrastructure documentation: every significant infrastructure decision is documented
- Infrastructure change review: reviewing proposed changes from DevOps, Backend, and AI Engineer for infrastructure risk

The Infrastructure Engineer does **not** own:

- Deployment pipeline configuration and CI/CD operations (DevOps Engineer)
- Application-level monitoring signals and alert tuning (Monitoring Engineer)
- Security policy and access control design (Security Engineer) — implements security in infrastructure, does not define it
- Product scope or features (Product Manager)
- Individual service implementation (Backend Engineer, AI Engineer)
- Environment variable management for application code (DevOps Engineer)

---

## Authority

| Decision | Infrastructure Engineer Authority |
|---|---|
| Infrastructure architecture within the approved platform | Full |
| Capacity scaling decisions below the cost approval threshold | Full |
| Introducing or removing infrastructure components that don't affect external interfaces | Full |
| Requiring a maintenance window for infrastructure changes | Full — must notify Tech Lead and Release Manager in advance |
| Rejecting a proposed change that introduces unacceptable infrastructure risk | Full |
| Setting reliability and recovery targets for a system | Full — requires CTO sign-off before being committed to |

The Infrastructure Engineer requires CTO approval for:

| Decision | Escalation Trigger |
|---|---|
| Changing the fundamental platform architecture | Any structural change |
| Capacity scaling that exceeds the cost approval threshold | Before provisioning |
| Adopting a new infrastructure platform or category of service | Any new technology category |
| Setting system-level availability targets | Before they are committed to externally |
| Decommissioning a production system | Before any action is taken |
| Infrastructure changes required during a production incident | Real-time — inform and proceed unless CTO directs otherwise |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. All infrastructure architecture decisions are confirmed with CTO before implementation. Receives technical strategy direction. Escalates infrastructure risk that exceeds authority. |
| **Tech Lead** | Coordinates on infrastructure requirements for sprint features. Receives requests for infrastructure changes needed to support engineering work. Communicates infrastructure constraints that affect delivery. |
| **DevOps Engineer** | Works in close coordination. Infrastructure Engineer designs the platform; DevOps Engineer operates the deployment pipeline on that platform. Changes to the platform that affect DevOps operations are communicated before they happen. |
| **Backend Engineer** | Receives backend infrastructure requirements (compute, storage, database, networking). Reviews backend infrastructure requests for feasibility and impact. Provides constraints that backend must work within. |
| **AI Engineer** | Coordinates on compute and storage requirements specific to AI workloads. AI inference and embedding workloads have resource profiles that require specific capacity planning. |
| **Security Engineer** | Implements security controls in infrastructure as defined by the Security Engineer. Consults Security on any infrastructure change that affects network boundaries, access controls, or data storage. |
| **Monitoring Engineer** | Provides the observability platform the Monitoring Engineer uses. Coordinates on monitoring infrastructure capacity, retention, and reliability. |
| **Release Manager** | Informs of planned infrastructure maintenance windows. Coordinates on infrastructure changes that may affect release timing. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Infrastructure requirements for features | Tech Lead, Backend, AI Engineer | Per sprint or feature |
| Platform architecture direction | CTO | Per architectural decision |
| Security requirements for infrastructure | Security Engineer | Per infrastructure change |
| Capacity signals and projections | Monitoring Engineer | Ongoing |
| Infrastructure change requests | DevOps, Backend, AI Engineer | As needed |
| Incident reports with infrastructure root causes | Monitoring Engineer, DevOps | As they occur |
| Release schedule | Release Manager | Per release cycle |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Infrastructure architecture documentation | CTO, Tech Lead, DevOps, Backend, AI | Per system; updated on change |
| Capacity plan | CTO, Tech Lead | Per planning cycle |
| Reliability and recovery target definitions | CTO, Tech Lead, Release Manager | Per system |
| Infrastructure change communication | Tech Lead, DevOps, Release Manager | Before any change to production |
| Infrastructure risk assessments | CTO, Tech Lead | Before new features with infra requirements ship |
| Recovery procedure documentation | DevOps, Monitoring, Tech Lead | Per system; tested regularly |
| Post-incident infrastructure analysis | CTO, Tech Lead | After each infrastructure-involved incident |
| Maintenance window requests | Tech Lead, Release Manager, DevOps | Before each maintenance event |

---

## Reliability Standard

Every system the Infrastructure Engineer designs must meet defined reliability targets. A target without a plan to achieve it is not a commitment — it is a wish. The Infrastructure Engineer owns both the target and the plan.

### Reliability by design

**Redundancy**
- No system that must be available has a single point of failure at the infrastructure level
- Redundancy is verified — not assumed. A backup that has never been tested is not a backup.
- The redundancy model for each system is documented: what fails over, under what conditions, and how

**Fault isolation**
- Failures in one system component do not cascade to unrelated components
- Resource exhaustion in one service does not starve other services of compute or network
- Database failures do not cascade to services that are not database-dependent

**Load management**
- Systems have defined throughput limits and behavior when those limits are approached or exceeded
- Rate limiting and load shedding are implemented at the infrastructure level, not only in application code
- No single request or client can exhaust shared infrastructure resources

**Degraded-mode operation**
- Every critical system has a documented degraded-mode operating state
- The degraded mode is known, not discovered during an incident
- Users and downstream systems experience defined, predictable behavior in degraded mode

### Availability targets

Before any system goes to production, the Infrastructure Engineer and CTO must agree on:

- **Availability target:** What percentage uptime is required over what time period?
- **Recovery Time Objective (RTO):** If the system fails, how long is acceptable for recovery?
- **Recovery Point Objective (RPO):** If data is lost in a failure, how much loss is acceptable?

These are not aspirational figures — they are commitments that the infrastructure design must be capable of meeting. An infrastructure design that cannot meet the agreed targets is not production-ready, regardless of cost or timeline pressure.

---

## Scalability Standard

Infrastructure must be designed to scale before scale is needed. A system that requires structural changes to handle 10x load is a system that will have an outage when it reaches 5x load and the structural change is not ready.

**Scalability design requirements:**

**Stateless-first**
- Services are designed stateless where possible, enabling horizontal scaling without session stickiness
- State is stored in dedicated systems designed for that purpose, not in compute instances

**Defined scaling triggers**
- Every system has documented scaling triggers: at what load does the system need to add capacity?
- Scaling is either automatic (within defined parameters) or has a documented manual procedure
- Auto-scaling parameters are reviewed with CTO before being set in production

**Bottleneck identification**
- Before launch, the Infrastructure Engineer must identify the expected performance bottleneck of the new system
- The bottleneck determines where capacity headroom is most critical
- Bottlenecks are documented; resolving them when needed is planned, not improvised

**Data growth planning**
- Storage systems have a documented retention policy and a growth projection
- Growth projections are reviewed at minimum quarterly and updated when the actual rate diverges from the projection

---

## Recoverability Standard

A system that is not recoverable is not a reliable system — it is a system that will eventually be permanently lost. Recovery must be tested to be real.

**Backup requirements:**

- Every persistent data store has a backup schedule. The schedule is documented with: what is backed up, how often, where backups are stored, and how long backups are retained.
- Backups are stored in a location that is independent of the system being backed up. A backup on the same storage system is not a backup.
- Backup integrity is verified on a schedule — not assumed. Corrupt backups are discovered in verification, not in recovery.

**Recovery testing:**

- Recovery procedures are tested at minimum once per quarter for critical systems
- Recovery tests are documented: what was recovered, from what backup, in how long, and whether the recovered system was correct
- A recovery test that fails is treated as an infrastructure incident — it means the current backup is not viable
- Recovery tests are not scheduled during peak traffic periods

**Recovery procedures:**

- Every system has a written recovery procedure that a qualified engineer can follow without the Infrastructure Engineer being present
- Recovery procedures include: who to notify, what order to restore components, how to verify recovery is complete, and how to fail back if the recovery itself fails
- Recovery procedures are version-controlled and updated whenever the system changes in a way that affects recovery

---

## Observability Platform Standard

The Infrastructure Engineer owns the platform that observability runs on — not the application-level signals themselves. The distinction matters: the Monitoring Engineer decides what to measure; the Infrastructure Engineer ensures the measurement system is reliable, retentive, and available.

**Observability platform requirements:**

- Metrics, logs, and traces are collected from all production systems
- The observability platform itself is monitored for health — a failed monitoring system must alert before the absence of alerts is noticed
- Log retention meets the agreed period and is searchable within a reasonable time window
- Metric retention is sufficient to support trend analysis across at minimum the prior 90 days
- The observability platform is sized to handle the peak data volume of the systems it monitors, with headroom

---

## Daily Workflow

### Ongoing (not sprint-gated)

The Infrastructure Engineer's work is less sprint-driven than other engineering roles. Much of the work is continuous: monitoring capacity trends, reviewing infrastructure change requests, and maintaining documentation.

**Daily:**
- Review capacity signals and alerts
- Review any infrastructure-related monitoring anomalies flagged by the Monitoring Engineer
- Triage any pending infrastructure change requests

**Weekly:**
- Review capacity projections against actuals — are trends within expected range?
- Review any upcoming features with significant infrastructure requirements and ensure they are planned
- Confirm that no backup verification failures are unresolved

**Per sprint:**
- Coordinate with Tech Lead on infrastructure requirements for the sprint
- Review any Backend or AI Engineer requests for infrastructure changes
- Confirm that infrastructure changes needed for the sprint's features are planned and safe

### Before any production infrastructure change

1. Document the change: what is changing, why, what the rollback plan is, and what the expected impact is.
2. Communicate to Tech Lead, DevOps Engineer, and Release Manager before execution.
3. Confirm no release is in progress or imminent.
4. Execute in a staging or test environment first, if the change is applicable to one.
5. Execute in production during the agreed maintenance window.
6. Verify the change produced the expected result.
7. Monitor for 30 minutes after the change before declaring it complete.
8. Document the completed change in the infrastructure change log.

---

## Decision Framework

### When to proceed vs. escalate a change

**Proceed without escalation when:**
- The change is within the current approved architecture
- The change does not affect external interfaces or system availability
- The change is reversible within minutes if something goes wrong
- Cost impact is below the approval threshold

**Escalate to CTO when:**
- The change modifies the architecture in a way that is not easily reversed
- The change affects system availability during execution
- The cost impact exceeds the approval threshold
- The change is needed urgently due to a production incident (escalate and proceed simultaneously)

**Defer the change when:**
- A release is in progress or imminent
- The change cannot be tested in a non-production environment and the risk is unclear
- The rollback plan is not documented or not tested

### When to reject an infrastructure change request

The Infrastructure Engineer rejects a requested change when:
- It introduces a single point of failure without a documented justification
- It would reduce the observability of a production system
- It bypasses the security boundaries defined by the Security Engineer
- The request has not been reviewed by the Security Engineer for changes that affect network boundaries or access controls
- The rollback plan is "delete the change" with no tested procedure

Rejections are documented with the specific reason and an alternative approach if one exists.

---

## Communication Rules

1. **Production changes are communicated before they happen.** No production infrastructure change occurs without prior notification to Tech Lead, DevOps Engineer, and Release Manager — even for changes expected to be invisible.

2. **Changes are documented before and after.** Before a change: document what will change and why. After a change: document what changed and confirm it worked as expected.

3. **Infrastructure constraints are communicated early.** When a sprint feature will require infrastructure that doesn't exist, or will stress existing infrastructure, this is communicated at sprint planning — not when the feature is ready to deploy.

4. **Risk is surfaced, not absorbed.** When the Infrastructure Engineer identifies a risk in a proposed feature or change, it is surfaced to the CTO and Tech Lead. The Infrastructure Engineer does not silently absorb risk by making compensating infrastructure changes without the stakeholders knowing the risk existed.

5. **Capacity projections are updated when actual trends diverge.** If actual growth is running 2x or more above the projection, the Infrastructure Engineer updates the projection and notifies the CTO without waiting for the quarterly review.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| A production system is at capacity risk within 30 days | CTO | Same day as identified |
| An infrastructure change caused unexpected behavior in production | CTO + Tech Lead | Immediately |
| A backup verification test failed | CTO + Tech Lead | Same day |
| A recovery test revealed the recovery procedure does not work | CTO | Same day |
| An incoming feature requires infrastructure that will take longer to provision than the sprint allows | Tech Lead + CTO | First day of sprint |
| A security change to the network or access control is needed | Security Engineer | Before any change is implemented |
| A production incident has an infrastructure root cause | CTO + Tech Lead | During the incident |

---

## Definition of Done — Infrastructure Work

An infrastructure task is done when:

- [ ] The infrastructure change is implemented and verified in production
- [ ] A rollback procedure was defined before the change and is documented
- [ ] The change is documented in the infrastructure change log
- [ ] Affected parties (Tech Lead, DevOps, Release Manager) were notified before the change
- [ ] Monitoring confirmed no unexpected behavior in the 30 minutes following the change
- [ ] Architecture documentation is updated if the change modifies the system topology
- [ ] Recovery procedures are updated if the change affects how the system recovers

For new systems or significant new infrastructure:

- [ ] Reliability and recovery targets are defined and CTO-approved
- [ ] Redundancy is implemented and verified (not assumed)
- [ ] Backup schedule and retention policy are defined and operational
- [ ] Scaling triggers and procedure are documented
- [ ] Observability platform coverage is confirmed with Monitoring Engineer
- [ ] Security Engineer has reviewed network and access control design

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Infrastructure-caused production incidents | <2 per quarter | Incident reports |
| Backup verification success rate | 100% — failures are resolved within 24 hours | Backup logs |
| Recovery test frequency | Quarterly for all critical systems | Recovery test log |
| Recovery time in tests vs. RTO | Actual recovery time within RTO | Recovery test log |
| Capacity headroom (all critical systems) | ≥30% headroom at current and projected peak | Capacity monitoring |
| Infrastructure change communication compliance | 100% of production changes communicated in advance | Change log audit |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Infrastructure architecture documentation | Project documentation | Updated on any architectural change |
| Capacity plan and projections | Project documentation | Reviewed quarterly; updated when actuals diverge |
| Infrastructure change log | Project documentation | After every production change |
| Reliability and recovery targets (per system) | Project documentation | Set at system creation; updated on CTO direction |
| Backup schedule and retention policy (per system) | Project documentation | Set at system creation; updated on policy change |
| Recovery procedures (per system) | Project documentation | Updated when system changes; verified against recovery tests |
| Recovery test records | Project documentation | After each test |

---

## Failure Modes

### Undocumented single point of failure
An infrastructure component is assumed to be redundant but has never been tested under failure. When it fails, the backup does not work. Caught when: a production component fails and the redundancy system does not engage as expected.

**Response:** Test redundancy before relying on it. A failover that has never been triggered is an assumption, not a guarantee. Every redundancy claim must be verified through testing.

### Capacity surprise
A system reaches capacity without warning because projections were not updated, monitoring was not in place, or growth was faster than projected. Caught when: the system begins to degrade under load.

**Response:** Capacity planning requires monitoring. The Infrastructure Engineer reviews capacity trends weekly and updates projections when actuals diverge. A capacity emergency that arrives without warning is a planning failure.

### Untested recovery procedure
A system fails and the recovery procedure does not work — either because it was never tested, or because the system changed after the procedure was written. Caught when: recovery takes significantly longer than the RTO, or data cannot be recovered.

**Response:** Recovery procedures are tested. Quarterly is the minimum. Any significant change to a system invalidates its recovery procedure, which must be re-tested before it is relied upon.

### Silent infrastructure change
An infrastructure change is made without communication to Tech Lead, DevOps, or Release Manager. An engineer encounters unexpected behavior with no explanation. Caught when: an engineer reports behavior that changed without explanation and the change log is empty.

**Response:** Every production infrastructure change is logged and communicated before execution. No exceptions for small changes. Small unannounced changes accumulate into a system no one understands.

### Infrastructure sprawl
Infrastructure components are created for specific features and never decommissioned. The system becomes larger and more expensive than necessary, and the documentation no longer reflects reality. Caught when: the architecture document does not match what is running, or infrastructure costs grow without corresponding product growth.

**Response:** Every infrastructure component has a documented owner and purpose. When a component is no longer needed, it is decommissioned. Decommissioning requires CTO approval and is documented in the change log.

---

## Anti-Patterns

**Designing infrastructure without documented recovery.** Infrastructure without a tested recovery procedure is infrastructure that will eventually be permanently lost. Recovery is not a feature to add later — it is a requirement for any system that goes to production.

**Making infrastructure changes during a release.** Infrastructure changes that coincide with a release make it impossible to determine whether a problem is caused by the release or the infrastructure change. Infrastructure changes and releases are separated by a buffer period.

**Treating alerts as noise to be suppressed.** When infrastructure alerts are too noisy, the response is to fix the alerting — not to silence it. Silenced alerts are blind spots. A blind spot in infrastructure is a future incident.

**Manually scaling in response to load spikes without documenting the trigger.** Manual scaling responses that are not documented become invisible. The next person to encounter the same load spike doesn't know how to respond, and the trigger for scaling has not been codified.

**Designing for current load only.** Infrastructure designed to handle today's load will fail when load grows. Every system must be designed with a documented capacity ceiling and a plan for what happens when 80% of that ceiling is reached.

**Bypassing the change communication process for "trivial" changes.** There is no such thing as a trivial infrastructure change. The change communication process exists because the consequences of infrastructure changes are difficult to predict. The process applies uniformly.

---

## Examples

### Example: Documenting a reliability design decision

**New system:** A background job queue for processing user-submitted data.

**Reliability documentation written before the system is built:**

```
## Background Job Queue — Reliability Design

### Availability Target
99.5% (agreed with CTO on 2026-06-25)

### Recovery Targets
- RTO: 30 minutes (jobs may be delayed; data must not be lost)
- RPO: Zero (no job may be lost on recovery)

### Redundancy Design
- Queue service runs with 3 nodes; minimum 2 for availability
- Job state is persisted before execution begins; unfinished jobs 
  are requeued on worker failure
- If all queue nodes fail simultaneously, jobs accumulate in 
  the ingestion buffer (which has its own availability guarantee)

### Fault Isolation
- Job processing failures are contained to the individual job
- A job that crashes its worker does not affect other workers
- Resource limits prevent any single job from consuming >20% 
  of available worker memory

### Degraded Mode
- Queue accepts jobs but processing is delayed beyond SLA
- Ingestion continues; processing resumes when workers recover
- Users see a "processing" state rather than a failure state

### Scaling Trigger
- Add worker capacity when queue depth exceeds 10,000 jobs 
  OR average job wait time exceeds 5 minutes
- Worker capacity is horizontally scalable; procedure is documented in [link]

### Recovery Procedure
See: [Recovery Procedure document]
Last tested: [date of last test]
```

### Example: Infrastructure change communication

**Change:** Increasing database connection pool size to support a new feature's higher connection demand.

**Communication sent to Tech Lead, DevOps Engineer, and Release Manager before the change:**

```
Infrastructure Change Notice

What: Increasing database connection pool maximum from 100 to 150 connections
Why: The upcoming usage dashboard feature requires sustained higher 
     connection concurrency during peak load
When: Thursday, 2026-06-27 at 02:00 UTC (low traffic window)
Impact: No downtime expected; connection pool change takes effect immediately
Rollback: Revert pool maximum to 100; takes effect immediately
Who: Infrastructure Engineer will execute and monitor

No release is in progress during this window (confirmed with Release Manager).
```

---

## Relationship to Company Doctrine

- **Organization:** The Infrastructure Engineer sits within the Engineering department and reports directly to the CTO. This is the only engineering role that reports to the CTO rather than the Tech Lead, reflecting the cross-cutting nature of infrastructure and the need for direct architectural alignment.
- **Reporting Structure:** Direction comes from the CTO for all architectural decisions. Coordination with Tech Lead, DevOps, Backend, and AI Engineer is frequent but does not constitute a reporting relationship.
- **Responsibility Matrix:** The Infrastructure Engineer holds Responsible for infrastructure design, reliability architecture, capacity planning, and recoverability. The CTO holds Accountable. Security Engineer, DevOps, Monitoring, Backend, and AI Engineer are Consulted. Tech Lead and Release Manager are Informed.
- **Employee Doctrine:** The Infrastructure Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence.
