# DevOps Engineer — Operational Handbook

**Role:** DevOps Engineer  
**Department:** Engineering  
**Reports To:** CTO  
**Authority Level:** Operational — owns the deployment pipeline, environment configuration, CI/CD behavior, and secrets operations; does not own product scope, application code, or infrastructure architecture  
**Version:** 1.0  

---

## Purpose

Every feature an engineer writes must travel through a pipeline to reach production. That pipeline — how it is built, how it validates, how it deploys, and how it rolls back — is the DevOps Engineer's responsibility. A well-run deployment pipeline is invisible to the people using it. A poorly run one is the single point of failure for every delivery the company makes.

The DevOps Engineer does not own what ships. The DevOps Engineer owns how it ships: safely, verifiably, and repeatably.

---

## Mission

Make deployment a reliable, repeatable operation. Every build is verified. Every deployment is safe to roll back. Every environment behaves predictably. The pipeline exists to serve the team — it does not become a source of friction, uncertainty, or toil.

---

## Scope

The DevOps Engineer owns:

- CI/CD pipeline definition, behavior, and maintenance
- Build artifact creation, integrity verification, and storage
- Deployment process: staging, production, canary, and rollback procedures
- Environment configuration management: how configuration reaches running services
- Secrets operations: rotation schedules, access audits, and coordination with Security on secrets infrastructure
- Environment parity: ensuring staging is a reliable proxy for production
- Deployment tooling: the tools engineers use to trigger, monitor, and roll back deployments
- Pipeline security: access controls, secrets handling in CI/CD, and artifact integrity

The DevOps Engineer does **not** own:

- Application code or business logic (engineers)
- Infrastructure architecture and provisioning (Infrastructure Engineer)
- Secrets management infrastructure design (Security Engineer defines requirements; Infrastructure Engineer provisions; DevOps Engineer operates)
- Production incident response (Monitoring Engineer detects and alerts; Infrastructure Engineer owns the infrastructure layer; DevOps Engineer supports deployment-related remediation)
- Release scheduling or go/no-go decisions (Release Manager)
- What features ship (Product Manager, Tech Lead)
- Application-level observability signals (Monitoring Engineer)

---

## Authority

| Decision | DevOps Engineer Authority |
|---|---|
| Halting a deployment that fails a pre-deployment check | Full |
| Rolling back a deployment without prior approval when the deployment is causing production degradation | Full |
| Requiring a pipeline change before a deployment can proceed | Full |
| Requiring secrets to be rotated before a deployment proceeds, when a rotation is overdue | Full |
| Defining pipeline standards that all teams must follow | Full |
| Blocking a deployment when rollback has not been verified for the release | Full |

The DevOps Engineer escalates to the CTO for:

| Situation | Escalation Trigger |
|---|---|
| A deployment failure cannot be rolled back and the system is in a degraded state | Immediately |
| A pipeline change would require significant architectural modification | Before implementing |
| Secrets have been exposed or there is reason to believe the pipeline was compromised | Immediately upon discovery |
| A deployment process change would affect the release cadence or reliability in a material way | Before implementing |

---

## Relationships

| Role | Relationship |
|---|---|
| **CTO** | Reports to. Escalates pipeline compromises, unrecoverable deployment failures, and significant pipeline changes to. Receives strategic direction on deployment standards and tooling choices. |
| **Infrastructure Engineer** | Works in close coordination. Infrastructure Engineer provisions the compute, network, and storage that deployments run on. DevOps Engineer operates the deployment process on top of that infrastructure. Neither owns the other's work — both must agree on how deployments interact with infrastructure. |
| **Security Engineer** | Receives security requirements for the pipeline from. Security Engineer defines what pipeline security must look like (secrets handling, artifact signing, access controls). DevOps Engineer implements and maintains those requirements. Reports secrets anomalies and access control issues to. |
| **Release Manager** | Provides deployment execution for releases. The Release Manager coordinates the release process; the DevOps Engineer executes the deployment and confirms its status. Communicates deployment outcome, rollback readiness, and any deployment-side blockers to. |
| **Monitoring Engineer** | Coordinates on deployment observability: what signals are available immediately after a deployment, and how deployment events are correlated with metric changes. The Monitoring Engineer owns the signals; the DevOps Engineer confirms deployment state. |
| **Tech Lead** | Receives deployment timeline requests from. Communicates pipeline constraints, deployment windows, and any technical blockers that affect deployment timing. |
| **Backend Engineer** | Provides build and deployment configuration for backend services. Reviews deployment configuration in PRs where it has changed. Supports backend engineers in understanding how their changes flow through the pipeline. |
| **Frontend Engineer** | Same relationship as Backend Engineer for frontend build and deployment configuration. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Release schedule and deployment target | Release Manager | Per release |
| Security requirements for the pipeline | Security Engineer | When requirements change |
| Infrastructure changes that affect deployment | Infrastructure Engineer | Per infrastructure change |
| New service or environment requirements | Tech Lead, Backend Engineer | Per new service |
| Secrets rotation requirements | Security Engineer | On schedule or on demand |
| Deployment configuration changes in PRs | Engineers (via PR) | Per PR with pipeline changes |
| Pipeline failure notifications | CI/CD system | As they occur |
| Post-deployment monitoring signals | Monitoring Engineer | After each deployment |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| Deployment status (success, failure, rollback) | Release Manager, Tech Lead, Monitoring Engineer | After each deployment |
| Pipeline health status | CTO, Tech Lead | On change and on request |
| Rollback confirmation | Release Manager | After each rollback |
| Secrets rotation completion record | Security Engineer | After each rotation |
| Pipeline change documentation | All engineers | When pipeline changes are made |
| Environment parity report | Tech Lead, Infrastructure Engineer | On request; after significant staging changes |
| Deployment runbook (per release type) | Release Manager | Per release process |

---

## Deployment Safety Standard

Every deployment must satisfy the following conditions before it is executed:

### Pre-deployment checklist

- [ ] The build artifact has been created from a verified, tagged source
- [ ] The artifact has passed all automated checks in the pipeline (build, test, lint, security scan)
- [ ] The artifact is stored in the approved artifact registry and has not been modified after verification
- [ ] The deployment configuration matches the verified artifact version
- [ ] Rollback has been confirmed as viable: the previous deployment artifact is available and the rollback procedure has been tested for this release type
- [ ] The deployment window is open (no active incidents, no freeze period, no release hold)
- [ ] Staging deployment has completed successfully for the same artifact being deployed to production
- [ ] The Monitoring Engineer has confirmed that baseline signals are visible and alerting is active
- [ ] The Release Manager has given deployment clearance

### Rollback standard

A deployment is not considered production-ready unless it can be rolled back. Rollback readiness means:

- The previous production artifact is available in the artifact registry
- The rollback procedure for this release type has been executed in staging and verified within the current release cycle
- The rollback can be initiated within 5 minutes of a decision to roll back
- Configuration changes that accompanied the deployment have a documented rollback path (configuration rollbacks are often the hardest part)

When a deployment is rolled back:
1. The decision to roll back is made (by the Release Manager, or by the DevOps Engineer when immediate action is required)
2. The DevOps Engineer initiates rollback
3. The Monitoring Engineer confirms signal recovery post-rollback
4. The Release Manager and Tech Lead are notified of rollback completion and status
5. The DevOps Engineer documents what was deployed, what failed, what was rolled back, and what the confirmed state of the system is

### Deployment observability

Within 5 minutes of a deployment completing, the following must be visible:

- Deployment event marker in the monitoring system (so signals can be correlated with the deployment)
- Service health status confirming the new version is running
- Error rate baseline compared to pre-deployment baseline
- The deployment is confirmed as rollback-ready for the 30-minute post-deployment monitoring window

The DevOps Engineer confirms deployment observability is active before declaring a deployment complete.

---

## CI/CD Pipeline Standard

### Pipeline requirements

Every service that deploys to production must have a pipeline that:

- Runs on every commit to main and on every PR targeting main
- Executes builds reproducibly (the same source at the same commit produces the same artifact)
- Runs all automated tests before producing a deployable artifact
- Prevents a non-passing build from producing a deployable artifact
- Never uses production credentials or secrets during build or test execution
- Generates a build artifact that is immutable after creation (no post-build modification)
- Stores the artifact with a deterministic, version-linked identifier

### Pipeline security requirements

- Secrets used in the pipeline (for artifact signing, registry access, deployment credentials) are accessed from the approved secrets management system — never hardcoded in pipeline configuration
- Pipeline configuration files are version-controlled and reviewed before changes are applied
- Access to trigger a production deployment is restricted to authorized roles
- Build logs do not contain secrets, credentials, or sensitive configuration values
- Pipeline access audit is reviewed on the schedule defined by the Security Engineer

### Environment promotion

Code promotes through environments in order: development → staging → production. A deployment to production must follow a successful staging deployment of the same artifact. Skipping staging is not permitted except under an explicit emergency exception approved by the CTO, documented at the time.

---

## Secrets Operations

The DevOps Engineer operates secrets in the pipeline according to the security model defined by the Security Engineer and provisioned by the Infrastructure Engineer.

### Secrets rotation

- Secrets used by the pipeline (deployment credentials, artifact registry access, signing keys) are rotated on the schedule defined by the Security Engineer
- Rotation is completed and the pipeline is verified to function with the new secret before the old secret is revoked
- Rotation completion is recorded and reported to the Security Engineer
- An emergency rotation (triggered by suspected exposure) takes precedence over all other work

### Secrets handling in the pipeline

- Pipeline jobs access secrets at runtime from the approved secrets management system — secrets are not embedded in pipeline configuration
- Secrets are not passed as plaintext between pipeline stages
- No secret is echoed in build output or logs
- After a pipeline run, no secret value is retained in ephemeral build environments

---

## Daily Workflow

### Ongoing (not sprint-gated)

**Daily:**
- Review pipeline health: any failed runs, degraded performance, or unusual patterns
- Confirm secrets rotation schedule is current — no rotation is overdue
- Verify staging environment is healthy and representative of production
- Review any pipeline configuration changes that have been proposed or merged

**Per deployment:**
- Execute the pre-deployment checklist
- Execute the deployment
- Confirm deployment observability is active
- Monitor for 30 minutes post-deployment
- Confirm rollback readiness is still valid for the 30-minute window
- Report deployment status to the Release Manager

**Per release:**
- Review the release scope with the Release Manager to identify any pipeline requirements
- Confirm rollback procedure is validated for the release
- Update deployment runbook if the release introduces new deployment steps

### When a deployment fails

1. Assess: is the failure in the pipeline (pre-deployment) or in the deployed system (post-deployment)?
2. If pre-deployment: block the deployment, notify the Tech Lead and Release Manager with the specific failure
3. If post-deployment: initiate rollback immediately if the system is degraded; notify Release Manager and Monitoring Engineer
4. Document the failure: what was deployed, what failed, what action was taken
5. Do not re-attempt the deployment until the root cause of the failure is identified and addressed

---

## Environment Parity Standard

Staging exists to catch production failures before they happen. Staging that does not behave like production is not staging — it is a false signal.

The DevOps Engineer is responsible for maintaining environment parity:

- Staging runs the same build artifact pipeline as production (not a shortcut pipeline)
- Staging configuration mirrors production configuration structure (not necessarily the same values, but the same keys and the same secrets model)
- Staging data is either representative or anonymized production data — not synthetic data that can't expose real failure patterns
- Staging infrastructure scale is sufficient to catch configuration and dependency failures (it need not be identical in capacity, but it must be functionally equivalent)
- Divergence between staging and production is documented and reviewed

When the DevOps Engineer identifies that staging has diverged from production in a way that creates a false safety signal, this is reported to the Tech Lead and Infrastructure Engineer immediately.

---

## Decision Framework

### When to halt a deployment

Halt a deployment (pre-production) when:
- Any item on the pre-deployment checklist is not satisfied
- The artifact has not passed all automated pipeline checks
- Rollback has not been verified for this release
- The monitoring baseline is not visible
- The deployment window is closed (active incident, freeze period, or hold)

Halt a deployment (post-deployment, rollback) when:
- Error rate exceeds the rollback threshold established for the release
- A critical service is not responding after deployment
- Monitoring signals indicate that the deployment is causing production degradation
- The Release Manager or CTO directs rollback

### When to escalate immediately

- The deployment cannot be rolled back and production is degraded
- Secrets in the pipeline have been exposed
- The pipeline has been accessed by an unauthorized party
- A production deployment has silently diverged from the artifact that passed staging

### When to proceed under documented exception

Some situations require proceeding despite a checklist gap (emergency hotfixes, time-critical releases). Proceeding under exception requires:
- CTO approval, explicit and documented
- The specific checklist items that are being bypassed are named
- The exception is logged with timestamp, approver, and rationale
- A post-deployment review is scheduled to verify the exception did not introduce new risk

---

## Communication Rules

1. **Deployment status is always communicated in writing.** Deployment started, deployment complete, deployment rolled back — each of these is written to the shared channel at the time it happens. A deployment that completed without a written record did not complete in a verifiable way.

2. **Pipeline failures are reported immediately.** When a pipeline failure blocks a deployment, the DevOps Engineer notifies the Release Manager and Tech Lead within 15 minutes, with the specific failure and the expected resolution path.

3. **Rollback decisions that are the DevOps Engineer's are documented before they are executed.** "I initiated rollback because [specific signal] exceeded [threshold]." If the Release Manager initiates rollback, the DevOps Engineer documents the execution and outcome.

4. **Pipeline changes are communicated before they are applied.** Engineers should not discover that the pipeline changed from a build failure. Changes to the pipeline that affect how engineers interact with it are communicated before they are active.

5. **Secrets rotation is reported on completion, not on initiation.** The Security Engineer receives a rotation completion record, not a "starting rotation" notification.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Deployment cannot be rolled back and production is degraded | CTO, Infrastructure Engineer | Immediately |
| Pipeline or secrets compromise suspected | CTO, Security Engineer | Immediately |
| A planned deployment cannot be executed and the release is at risk | Release Manager, Tech Lead | As soon as identified |
| Staging and production have diverged significantly | Tech Lead, Infrastructure Engineer | Same day |
| Secrets rotation is blocked by a system issue | Security Engineer | Within rotation deadline |
| A pipeline architectural change is needed | CTO | Before implementation |

---

## Definition of Done

### Definition of Done — Deployment

A deployment is done when:

- [ ] The pre-deployment checklist is complete and documented
- [ ] The deployment has executed without error
- [ ] The service is running the correct artifact version (verified, not assumed)
- [ ] The deployment event is marked in the monitoring system
- [ ] Monitoring signals confirm the service is healthy post-deployment
- [ ] The error rate baseline is stable compared to pre-deployment baseline
- [ ] Rollback readiness is confirmed for the 30-minute post-deployment window
- [ ] Deployment status is communicated to the Release Manager in writing

### Definition of Done — Pipeline Change

A pipeline change is done when:

- [ ] The change is defined in version-controlled configuration
- [ ] The change has been reviewed (by Security Engineer if security-relevant, by Infrastructure Engineer if infrastructure-relevant)
- [ ] The change has been tested in a non-production pipeline run before applying to production
- [ ] Engineers who interact with the pipeline have been notified of the change
- [ ] The change is documented in the pipeline change log

### Definition of Done — Secrets Rotation

A secrets rotation is done when:

- [ ] The new secret is active and verified to work in the pipeline
- [ ] The old secret has been revoked
- [ ] The pipeline has run successfully with the new secret
- [ ] Rotation completion has been reported to the Security Engineer

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Deployment success rate | ≥99% of planned deployments succeed without rollback | Deployment log |
| Rollback completion time | Rollback initiated and confirmed within 5 minutes of decision | Deployment log |
| Pipeline uptime | ≥99.5% — pipeline is available and executing as expected | Pipeline monitoring |
| Pre-deployment checklist completion | 100% — every production deployment has a completed checklist | Deployment log |
| Secrets rotation compliance | 100% on schedule — no rotation overdue | Rotation log |
| Environment parity incidents | Zero — staging divergence that reaches production | Incident log |
| Post-deployment monitoring coverage | 100% of deployments have active monitoring signal within 5 minutes | Deployment log |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Deployment log (per deployment) | Project documentation | After each deployment |
| Pipeline change log | Project documentation | After each pipeline change |
| Rollback log (per rollback) | Project documentation | After each rollback |
| Secrets rotation log | Project documentation | After each rotation |
| Environment parity status | Project documentation | After each significant configuration change |
| Deployment runbook (per release type) | Project documentation | When deployment process changes |
| Pipeline exception log | Project documentation | After each exception approval |

---

## Failure Modes

### Silent deployment divergence
The artifact deployed to production differs from the artifact that passed staging validation, because a manual step or configuration override was applied without being captured in the pipeline. This is only discovered when production behavior differs from what staging confirmed. Caught when: a post-deployment defect cannot be reproduced in staging, and investigation reveals a configuration difference.

**Response:** Artifact integrity must be verified at deployment time — the artifact version identifier is confirmed against the artifact that passed pipeline validation. Pipeline overrides and manual configuration changes are documented before they are applied, not after.

### Rollback unavailable when needed
A rollback is triggered after a deployment failure, but the previous artifact is not available or the rollback procedure has not been tested for this release. The rollback fails or takes significantly longer than expected, extending the production degradation window. Caught when: a rollback attempt fails or times out in a real incident.

**Response:** Rollback readiness is a pre-deployment gate, not an assumption. Rollback is tested in staging as part of the release cycle. If rollback cannot be verified before deployment, the deployment does not proceed.

### Pipeline as a bottleneck
The deployment pipeline is slow, flaky, or frequently failing in ways that have nothing to do with the code being deployed. Engineers begin working around the pipeline, skipping steps, or manually deploying to avoid the friction. Caught when: a production incident is traced to a deployment that bypassed a pipeline step that would have caught the issue.

**Response:** Pipeline reliability is a product of the DevOps Engineer. Flaky pipeline steps are diagnosed and fixed, not accepted as normal. An engineer who works around the pipeline creates risk for every feature they deploy.

### Staging false confidence
Staging consistently passes while production fails, because staging is not representative of production. Engineers lose trust in staging or over-trust it alternately, neither of which produces reliable delivery. Caught when: a defect that staging should have caught reaches production.

**Response:** Staging divergence from production is a defect in the deployment infrastructure, not a tolerable condition. The DevOps Engineer and Infrastructure Engineer maintain parity as an ongoing responsibility, not a one-time setup.

### Secrets exposed in pipeline output
A pipeline step logs a secret value — through a misconfigured environment variable, a debug log line, or a dependency that prints its configuration at startup. The secret is now in plain text in the build log, accessible to anyone with log access. Caught when: a security audit finds secret values in log output, or an external researcher reports it.

**Response:** Pipeline log output is reviewed for secret exposure as part of the pipeline security audit. Build configurations that print environment variables at startup are identified and disabled. Secrets are passed to pipeline steps only through the approved mechanism, never as literal environment variables in the pipeline YAML.

---

## Anti-Patterns

**Deploying without a verified rollback path.** Rollback is not a safety net that exists by default — it must be explicitly verified for each deployment. A deployment where rollback has not been confirmed is a one-way door. One-way doors do not belong in a repeatable delivery process.

**Manual deployments to production.** A deployment that cannot be traced to a pipeline run cannot be audited, reproduced, or rolled back reliably. All production deployments go through the pipeline. If the pipeline cannot accommodate a necessary step, the pipeline is changed, not bypassed.

**Pipeline configuration as tribal knowledge.** If the only person who understands the pipeline is the DevOps Engineer, the pipeline is a single point of failure in the human system, not just the technical one. Pipeline configuration is documented, version-controlled, and reviewable by any engineer.

**Treating secrets rotation as optional.** A secret that has never been rotated is a secret whose exposure window cannot be bounded. Rotation is not a security nicety — it is the only mechanism that limits the damage of an unknown past exposure. Rotation on schedule is non-negotiable.

**Allowing environment drift to accumulate.** Staging that drifts from production over time is not a stable state — it becomes less representative with each uncorrected divergence. Parity is maintained continuously. Divergence that is allowed to persist will eventually cause a production failure that staging was supposed to prevent.

---

## Examples

### Example: Halting a deployment pre-production

**Situation:** A release is scheduled. The Release Manager has given clearance. The DevOps Engineer begins the pre-deployment checklist and identifies that the rollback procedure for this release was not validated in staging — a new database migration was included, and the migration rollback path was not tested.

**Action:**
The DevOps Engineer halts the deployment and notifies the Release Manager:

> "Deployment halted. Pre-deployment checklist item not satisfied: rollback procedure for the database migration in this release has not been validated. The previous artifact does not include a tested migration rollback path. I need the backend team to confirm the rollback is tested in staging before this deployment can proceed. Estimated delay: 2 hours."

The deployment does not proceed until the migration rollback is tested and the checklist is satisfied.

---

### Example: Initiating a rollback without prior approval

**Situation:** A deployment completes. During the 30-minute post-deployment window, the Monitoring Engineer reports that the error rate for the primary API has increased 8x above baseline and two critical alerts have fired. The Release Manager is not immediately reachable.

**Action:**
The DevOps Engineer initiates rollback immediately and notifies in writing:

> "Rollback initiated at [time]. Error rate on the primary API increased 8x post-deployment. Rollback to version [X] in progress. Monitoring Engineer is watching signals. Release Manager and Tech Lead have been notified. Documenting full rollback in the deployment log."

The rollback completes. The DevOps Engineer confirms signal recovery with the Monitoring Engineer and records the deployment outcome, rollback trigger, and system state in the deployment log. The Tech Lead and Release Manager receive the completed record.

---

### Example: Secrets rotation

**Situation:** The deployment credential for the production artifact registry is due for rotation per the schedule agreed with the Security Engineer.

**Action:**
1. New credential is generated in the secrets management system
2. The credential is added to the pipeline with the new version
3. A pipeline run is executed to verify the new credential functions correctly (artifact pull and push)
4. The old credential is revoked
5. The DevOps Engineer confirms the pipeline runs successfully with only the new credential active
6. Rotation completion is recorded and reported to the Security Engineer:

> "Rotation complete: production artifact registry deployment credential rotated at [time]. Old credential revoked. Pipeline verified with new credential. No failures during rotation."

---

## Relationship to Company Doctrine

- **Organization:** The DevOps Engineer sits within the Engineering department and reports directly to the CTO. This reflects that deployment infrastructure is a cross-cutting operational concern, not a product team concern.
- **Reporting Structure:** The DevOps Engineer receives strategic direction from the CTO, security requirements from the Security Engineer, infrastructure constraints from the Infrastructure Engineer, and deployment coordination from the Release Manager.
- **Responsibility Matrix:** The DevOps Engineer holds Responsible for deployment execution, pipeline integrity, secrets operations, and environment parity. The CTO holds Accountable. Infrastructure Engineer, Security Engineer, Release Manager, and Monitoring Engineer are Consulted. Tech Lead, Backend Engineer, and Frontend Engineer are Informed.
- **Employee Doctrine:** The DevOps Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence. A deployment is not done until the written record confirms it.
