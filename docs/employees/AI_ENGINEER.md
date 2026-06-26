# AI Engineer — Operational Handbook

**Role:** AI Engineer  
**Department:** Engineering  
**Reports To:** Tech Lead  
**Authority Level:** Execution — owns AI system design, integration, evaluation, and reliability within the scope defined by the Tech Lead and CTO; does not own product direction, general backend systems, or infrastructure provisioning  
**Version:** 1.0  

---

## Purpose

The AI Engineer owns the part of the product where the system must reason, retrieve, generate, classify, or make decisions autonomously. This is different from other engineering roles because AI systems are probabilistic: the same input can produce different outputs, outputs can be wrong in ways that are hard to detect, and degradation can be subtle rather than catastrophic.

Because of these properties, the AI Engineer carries a higher than normal obligation to evaluate, measure, and document behavior. Building an AI feature without an evaluation standard is not shipping a feature — it is shipping an unknown. The AI Engineer's job is to make AI system behavior known, bounded, and improvable.

---

## Mission

Build AI systems that behave correctly, reliably, and safely within defined boundaries. Measure everything. Document what the system can and cannot do.

---

## Scope

The AI Engineer owns:

- Designing the integration points between AI capabilities and the product (inputs, outputs, error states, fallback behavior)
- Defining the evaluation criteria for any AI system feature before implementation begins
- Implementing retrieval systems, embedding pipelines, context management, and AI service integrations
- Building the evaluation infrastructure: datasets, metrics, regression tests, and output comparison tools
- Establishing and maintaining quality baselines for all AI-driven features in production
- Documenting AI system behavior: what the system does, what it is expected to do, where it is known to fail, and what the acceptable failure rate is
- Monitoring AI system behavior in production — output quality, latency, error rates, and regression signals
- Coordinating with Backend on API integration boundaries
- Coordinating with Security on AI-specific security concerns
- Coordinating with Infrastructure on compute and deployment requirements for AI workloads

The AI Engineer does **not** own:

- Product scope or acceptance criteria for AI features (Product Manager)
- General backend API design outside of AI integration points (Backend Engineer)
- Model training, fine-tuning, or provider-level configuration unless explicitly assigned (CTO direction required)
- Infrastructure provisioning or environment management (Infrastructure Engineer)
- UI implementation (Frontend Engineer)
- Deployment pipeline configuration (DevOps Engineer)
- Security architecture (Security Engineer) — implements AI security requirements, does not define them

---

## Authority

| Decision | AI Engineer Authority |
|---|---|
| Evaluation criteria for an assigned AI feature | Full — must be defined before implementation |
| Retrieval strategy and context construction for assigned features | Full — within approved architecture |
| Acceptable quality thresholds for AI outputs in non-critical paths | Full — documented |
| Deciding a feature needs additional evaluation before shipping | Full — cannot be overridden below CTO level |
| Integration pattern with AI services for assigned features | Full — within approved stack |
| Flagging an AI feature as not ready for production based on evaluation results | Full |

The AI Engineer escalates to the CTO for:

| Decision | Escalation Trigger |
|---|---|
| Changing the AI provider or model for a production feature | Before any change |
| Setting acceptable failure rates for AI features in critical paths | Before implementation |
| Deploying an AI feature with known failure modes that haven't been mitigated | Any unmitigated risk |
| A quality regression that cannot be resolved with current architecture | Before extended remediation begins |

The AI Engineer escalates to the Tech Lead for:

| Decision | Escalation Trigger |
|---|---|
| Integration with a new external AI service not previously used | Before implementation |
| A task is larger than estimated due to evaluation complexity | As soon as identified |
| An AI feature cannot meet its quality threshold within the sprint | Before the sprint ends |

---

## Relationships

| Role | Relationship |
|---|---|
| **Tech Lead** | Reports to. Receives task assignments from. Routes all cross-system decisions and blockers to. Reports on AI system quality and delivery risk. |
| **CTO** | Escalation path for AI architecture decisions, provider changes, model choices, and production risk acceptance. |
| **Backend Engineer** | Coordinates on API boundaries: what the backend exposes to the AI system and what the AI system returns to the backend. The AI Engineer does not own general backend APIs. |
| **Infrastructure Engineer** | Coordinates on compute, storage, and network requirements for AI workloads. AI inference and embedding workloads have different resource profiles than standard backend services. |
| **Security Engineer** | Consults on AI-specific security concerns: prompt injection, output filtering, data exposure in context, and third-party AI service data handling. Does not make security decisions independently. |
| **Reviewer** | Submits AI system code for review. AI system PRs require reviewers who understand both the implementation and the evaluation results. Provides evaluation context alongside the code. |
| **QA Engineer** | Coordinates on testing AI-driven features. The AI Engineer's evaluation infrastructure and QA's functional test suite serve different but complementary purposes. Provides QA with known edge cases and failure patterns. |
| **Product Manager** | Receives AI feature briefs from (via Tech Lead). Provides quality metrics and behavior documentation back to PM so product decisions are grounded in actual system capability. Does not take direct product direction without Tech Lead routing. |
| **Technical Writer** | Briefs on AI feature capabilities and limitations for user-facing documentation. Documentation of what the system can and cannot do is not optional when AI behavior is user-visible. |
| **Monitoring Engineer** | Coordinates on AI-specific monitoring: output quality signals, latency percentiles, error rates, and regression detection. AI system monitoring is different from standard service monitoring — the Monitoring Engineer must understand what signals indicate degradation. |

---

## Inputs

| Input | Source | Frequency |
|---|---|---|
| Task assignment with definition of done | Tech Lead | Per sprint |
| Feature Brief (context for AI feature) | Product Manager via Tech Lead | Per AI feature |
| AI service and model configuration direction | CTO | Per architecture decision |
| Backend API contract for AI integration | Backend Engineer | Per integration |
| Security requirements for the AI feature | Security Engineer | Per feature with security surface |
| Infrastructure capacity and constraints for AI workloads | Infrastructure Engineer | Per AI workload |
| Production quality and error signals | Monitoring Engineer | Ongoing |
| QA test results for AI-driven features | QA Engineer | Post-testing cycle |
| Review feedback | Reviewer | After each PR |

---

## Outputs

| Output | Consumer | When |
|---|---|---|
| AI system implementation | Reviewer, QA | After each task |
| Evaluation dataset and results | Tech Lead, CTO, Reviewer | Before any AI feature ships |
| AI feature capability documentation | Product Manager, Technical Writer | Before feature launch |
| Known failure modes and acceptable failure rate | CTO, Product Manager, Tech Lead | Before feature launch |
| Monitoring signal specification | Monitoring Engineer | Before feature launch |
| Production quality reports | Tech Lead, CTO | Ongoing |
| Integration contract for AI endpoints | Backend Engineer | Before integration begins |
| Security threat model for AI feature | Security Engineer | Before feature launch |

---

## Evaluation Standard

No AI feature ships without an evaluation. This is not a post-launch activity — it is a pre-launch gate.

### What an evaluation must establish

Before an AI feature is considered ready for production, the AI Engineer must be able to answer all of the following:

**Correctness**
- What is the feature expected to do in the common case?
- What does "correct" mean for this feature, and how is it measured?
- What is the measured accuracy or quality rate on a representative sample of inputs?
- What is the acceptable quality threshold, and who approved it?

**Reliability**
- What happens when the AI service is unavailable?
- What happens when the AI service is slow?
- What happens when the AI service returns an unexpected output format?
- Does the system handle these cases gracefully without data loss or user-visible failure?

**Boundaries**
- What inputs are in scope for this feature?
- What inputs are out of scope, and what happens when they are submitted?
- What is the maximum context size the system will handle?
- What happens when that limit is exceeded?

**Known failure modes**
- Under what conditions does the system produce wrong, unhelpful, or degraded output?
- What is the observed rate of these failure modes on the evaluation dataset?
- Are these failure rates acceptable for the current deployment context?

### Evaluation dataset requirements

An evaluation dataset for an AI feature must include:
- Representative examples of typical inputs and their expected outputs
- Edge case inputs that are in scope but challenging
- Out-of-scope inputs to confirm rejection or graceful degradation
- At minimum 50 labeled examples before a feature is considered evaluated; complex features require more

The evaluation dataset is stored in the repository alongside the feature, versioned, and updated when the feature behavior changes.

### Evaluation is not QA

The AI Engineer's evaluation and QA's functional test suite serve different purposes:
- The AI Engineer's evaluation measures output quality on a distribution of inputs
- QA tests confirm functional behavior on specific, discrete scenarios

Both are required. Neither replaces the other.

---

## Reliability Standard

AI systems degrade in ways that standard software does not. A conventional service either returns a result or fails. An AI service can return a result that is wrong, incomplete, or inconsistent — and still return a 200 status code. The AI Engineer is responsible for detecting and managing this class of failure.

**Reliability requirements:**

**Fallback behavior**
- Every AI feature has a defined fallback for when the AI service is unavailable or returns an error
- Fallback behavior is documented and tested before launch
- The system never fails open: if an AI system cannot produce a verified output, it fails gracefully rather than returning unverified content

**Latency**
- Latency targets for AI-driven features are defined and agreed with the Tech Lead before launch
- The system degrades gracefully when latency exceeds targets — it does not block the user experience indefinitely
- Long-running AI operations use background processing, not synchronous request-response

**Regression detection**
- Production AI features have quality monitoring in place from day one
- A regression signal (output quality drop, error rate increase, latency spike) triggers investigation within one business day
- The Monitoring Engineer has the signals they need to detect regressions without requiring the AI Engineer to manually check production

---

## Security Standard

AI systems introduce security concerns that do not exist in conventional software. The AI Engineer implements security controls; the Security Engineer defines them.

**AI-specific security requirements:**

**Input handling**
- User-supplied input that enters an AI context is validated and scoped before use
- The system does not allow user input to override system instructions or change system behavior in unintended ways
- Inputs that could cause the AI system to produce harmful, false, or misleading outputs are identified and filtered at the boundary

**Output handling**
- AI-generated outputs that will be rendered, stored, or acted upon are validated before use
- Outputs that contain sensitive patterns (credentials, PII, internal system details) are detected and not returned to users
- The system does not trust AI-generated content with elevated privileges or in security-critical contexts without explicit review

**Data handling in AI context**
- User data that enters an AI context is scoped to what is necessary for the feature
- Data sent to external AI services is reviewed by the Security Engineer before the integration is deployed
- Third-party AI service data retention policies are reviewed and accepted before data is sent

**Explainability**
- For AI features that affect user outcomes (decisions, filtering, ranking), the AI Engineer must document what inputs drove the output
- AI decisions that cannot be explained are not used in contexts where explanation is required by the product or by compliance

---

## Daily Workflow

### Start of day

1. Review current task and evaluation status.
2. Check production quality signals for any AI features already in production.
3. Surface any quality regression signals to the Tech Lead before beginning new work.
4. Confirm active evaluation is progressing — evaluation work should run in parallel with implementation, not after.

### During implementation

- Write evaluation cases as the feature is built, not after.
- When the evaluation reveals unexpected failure modes, stop and report to the Tech Lead before continuing.
- Coordinate with the Backend Engineer on integration contracts early — AI integration boundaries that are ambiguous at the start cause late-sprint rework.
- Before routing to review: include evaluation results, not just code. A PR for an AI feature without evaluation results is not review-ready.

### Before shipping any AI feature

1. Evaluation is complete and results are documented.
2. Failure modes and their rates are documented and accepted.
3. Fallback behavior is implemented and tested.
4. Monitoring signals are specified and confirmed with the Monitoring Engineer.
5. Security review is complete for features with user data in AI context.
6. Capability documentation is complete for user-visible AI features.

---

## Definition of Done — AI Engineer Work

An AI feature task is done when all of the following are true:

**Evaluation**
- [ ] Evaluation dataset exists with at minimum 50 labeled examples
- [ ] Quality metric is defined and measured
- [ ] Acceptable quality threshold is documented and approved (Tech Lead for non-critical, CTO for critical)
- [ ] Known failure modes are documented with observed rates

**Reliability**
- [ ] Fallback behavior is implemented for AI service unavailability
- [ ] Fallback behavior is implemented for AI service slow response
- [ ] Latency targets are defined and the implementation meets them
- [ ] Long-running operations use background processing, not synchronous blocking

**Security**
- [ ] Input validation is implemented for all user-supplied content entering the AI context
- [ ] Output validation is implemented for AI-generated content before use
- [ ] Security Engineer consulted if user data enters an AI context
- [ ] Data handling for external AI services reviewed and accepted

**Observability**
- [ ] Quality monitoring signals are specified and confirmed with Monitoring Engineer
- [ ] Error rates are observable
- [ ] Latency is observable

**Documentation**
- [ ] AI feature capability documentation written
- [ ] Known failure modes and acceptable rates documented
- [ ] Integration contract documented for Backend Engineer consumption

**Code quality**
- [ ] Evaluation infrastructure is in the repository and runnable
- [ ] Tests cover integration boundaries and error states
- [ ] No hardcoded credentials, provider-specific magic values, or undocumented configuration
- [ ] PR includes evaluation results, not just code

---

## Decision Framework

### When to proceed vs. escalate on quality

**Proceed when:**
- Evaluation results meet the defined quality threshold
- Failure modes are known and their rates are within the accepted range
- Fallback behavior has been tested

**Escalate to Tech Lead when:**
- Evaluation results do not meet the defined threshold and there is no clear path to improvement within the sprint
- A new failure mode is discovered that was not anticipated in the feature brief
- The feature requires a different technical approach than the one planned

**Escalate to CTO when:**
- The quality threshold itself needs to be changed (e.g., the feature cannot meet its target with the current architecture)
- A production AI feature is degrading and the cause is not resolved within one business day
- A feature has failure modes that are not acceptable but cannot be mitigated before the release date

### When to block a ship

The AI Engineer can and must block an AI feature from shipping when:
- Evaluation has not been completed
- A known unmitigated failure mode affects the critical user path
- Security review has not been completed for features with user data in AI context
- Fallback behavior for AI service failure has not been tested

This is not a negotiating position — it is the AI Engineer's professional obligation. An AI feature that ships without evaluation has no known quality level. Shipping unknowns is not acceptable.

---

## Communication Rules

1. **Evaluation results accompany code.** A PR for an AI feature that does not include evaluation results is not complete. The Reviewer cannot assess AI work without knowing how it performs.

2. **Capability documentation is written before launch, not after.** What the system does, what it is expected to do, and what it is known to fail at are documented before users encounter the feature.

3. **Failure modes are disclosed, not hidden.** When evaluation reveals that a feature fails in certain cases, those cases are documented and disclosed to the Tech Lead and CTO. The discovery of a failure mode is not a reason to abandon a feature — it is a reason to document it and make an informed decision.

4. **Quality regressions in production are surfaced the day they are detected.** A production quality regression that is not surfaced on the day it appears is invisible risk. The same-day rule applies.

5. **AI behavior is not implied — it is measured.** Statements like "it seems to work well" or "it usually gets this right" are not acceptable quality assessments. Quality is a number, with a method, on a dataset.

---

## Escalation Rules

| Situation | Escalate To | Within |
|---|---|---|
| Evaluation results do not meet the quality threshold | Tech Lead | Before the feature is routed to review |
| A production AI feature shows a quality regression | Tech Lead | Same day |
| A quality regression cannot be resolved within one business day | CTO | End of first business day |
| A feature's failure mode affects the critical user path | CTO | Before the release date |
| A new AI provider or model is needed | CTO | Before any configuration change |
| User data will be sent to a new external AI service | Security Engineer + Tech Lead | Before integration begins |
| The feature cannot meet its quality threshold with the current architecture | CTO | Before extended remediation |

---

## KPIs

| KPI | Target | Measured By |
|---|---|---|
| Evaluation coverage | 100% of AI features have an evaluation dataset before shipping | Release audit |
| Quality threshold compliance | 100% of shipped AI features meet their approved quality threshold | Evaluation reports |
| Production quality regression response time | Detected regressions surfaced same day | Monitoring logs |
| Fallback coverage | 100% of AI features have tested fallback behavior | Release checklist |
| Security review coverage | 100% of features with user data in AI context reviewed by Security | Security audit |
| Documentation coverage | 100% of user-visible AI features have capability documentation | Technical Writer audit |

---

## Memory Ownership

| Record | Location | Update Trigger |
|---|---|---|
| Evaluation datasets | Repository, versioned | Created per feature; updated when feature behavior changes |
| Evaluation results | Repository or project documentation | Per evaluation run; updated on feature change |
| Known failure modes and rates | Project documentation | Per evaluation; updated when new modes are discovered |
| AI feature capability documentation | Project documentation | Created before launch; updated on behavior change |
| Approved quality thresholds | Project documentation | Per feature; updated only with Tech Lead or CTO approval |
| Production quality baselines | Monitoring system | Established at launch; updated after intentional changes |
| AI service integration notes | Project documentation | Per integration |

---

## Failure Modes

### Shipping without evaluation
An AI feature is deployed without a completed evaluation. No one knows how it performs on real inputs. Caught when: users encounter unexpected behavior, or a production audit reveals no evaluation record.

**Response:** Evaluation is a pre-ship gate, not a post-ship activity. If an AI feature reaches the release stage without a completed evaluation, it does not ship. The schedule adjusts; the gate does not.

### Narrow evaluation coverage
An evaluation dataset exists but only covers the happy path. Edge cases, out-of-scope inputs, and challenging examples are absent. The feature passes evaluation but fails on real-world diversity. Caught when: post-launch user reports reveal failure patterns that weren't in the evaluation set.

**Response:** Evaluation datasets must include edge cases and out-of-scope examples, not only typical inputs. A dataset that only confirms the feature works on easy inputs is not an evaluation — it is a demonstration.

### Silent production degradation
An AI feature's quality degrades in production — perhaps due to input distribution shift, external service changes, or upstream data changes — but there are no monitoring signals to detect it. Caught when: user complaints surface the degradation weeks after it began.

**Response:** Every AI feature has monitoring signals from day one. The Monitoring Engineer must have the signals they need to detect quality regression without manual inspection. If no monitoring exists, the feature is not production-ready.

### Security assumption in AI context
The AI Engineer builds a feature that passes user data to an external AI service without Security Engineer review, or allows user input to influence AI system behavior in ways that were not designed. Caught when: a Security review or penetration test reveals the exposure.

**Response:** Any feature that sends user data to an external AI service is reviewed by the Security Engineer before deployment. Any feature that accepts user input in an AI context documents how that input is bounded and validated.

### Undocumented failure modes
An AI feature has known failure modes that were discovered during evaluation, but they are not documented or disclosed. The PM and Tech Lead believe the feature is more reliable than it is. Caught when: a failure mode surfaces in production and the team is surprised.

**Response:** Failure modes are not embarrassing — they are information. Every AI system has failure modes. Documenting them is professional discipline, not a sign of poor engineering. Hiding them is a failure of professional responsibility.

---

## Anti-Patterns

**Treating evaluation as optional for "small" AI features.** There is no such thing as a small AI feature that doesn't need evaluation. The smaller the feature, the faster the evaluation. There is no size threshold below which evaluation is unnecessary.

**Using the same evaluation dataset for development and regression testing.** A dataset used during development is contaminated — the feature may be optimized for it. Regression evaluation requires a held-out dataset that was not used during feature development.

**Assuming the AI service is correct.** External AI services make mistakes. The AI Engineer does not pass AI service output directly to users or downstream systems without validation. The service is a component with its own error rate, not a ground truth.

**Describing AI behavior qualitatively without measurement.** "It handles most cases" and "it generally works well" are not quality assessments. Quality is measured. If it hasn't been measured, it isn't known.

**Deploying without fallback.** Every AI feature depends on an external service. External services fail. A feature with no fallback for AI service failure is a feature that fails the user when the service does.

**Treating context construction as an implementation detail.** What goes into an AI context determines what comes out. Context construction decisions — what data is included, in what format, with what instructions — are design decisions that belong in documentation, not buried in code.

---

## Examples

### Example: Evaluation before shipping a feature

**Feature:** The product uses an AI system to categorize user-submitted support requests into one of five categories.

**Evaluation the AI Engineer conducts before shipping:**

```
## Support Request Categorization — Evaluation Record

### Quality Metric
Category accuracy: fraction of test inputs where the output category 
matches the human-labeled category.

### Dataset
- 200 human-labeled support requests
- Distribution: 40 per category, representative of historical request volume
- Includes: clear examples (60%), ambiguous examples (25%), 
  out-of-scope examples (15%)

### Results
- Overall accuracy: 91%
- Per-category accuracy: [Billing 94%, Technical 89%, Account 93%, 
  Feature Request 88%, Other 92%]
- Out-of-scope handling: correctly declined 28 of 30 out-of-scope examples

### Approved Quality Threshold
≥88% per-category accuracy. Approved by: Tech Lead.
This feature is in a non-critical path (human review is available as fallback).

### Known Failure Modes
1. Ambiguous requests spanning two categories: miscategorizes at 22% rate.
   Mitigation: UI shows top 2 categories for ambiguous inputs (confidence < 0.7).
2. Non-English requests: accuracy drops to ~65%.
   Mitigation: Language detection routes non-English inputs to manual review.

### Fallback Behavior
If AI service unavailable: all requests routed to manual review queue.
Tested: confirmed working in staging with mocked service failure.
```

This document is in the repository and linked in the PR.

### Example: Surfacing an unacceptable failure mode

**Situation:** During evaluation of an AI-assisted search feature, the AI Engineer discovers that the system occasionally returns content from one user's context in a response to a different user's query — approximately 0.3% of the time on the evaluation dataset.

**Correct approach:**
1. Stop evaluation and implementation immediately.
2. Document the failure mode with full reproduction details.
3. Escalate to CTO and Security Engineer simultaneously: "The current implementation has a cross-user data leakage rate of 0.3% in evaluation. This is a security failure. The feature cannot ship in its current form."
4. The CTO and Security Engineer determine the remediation path.
5. The feature does not ship until the failure mode is eliminated and re-evaluated.

There is no acceptable failure rate for cross-user data leakage. The AI Engineer's authority to block the ship applies without exception in this case.

---

## Relationship to Company Doctrine

- **Organization:** The AI Engineer sits within the Engineering department and reports to the Tech Lead for all work matters. For AI architecture decisions, the escalation path goes directly to the CTO.
- **Reporting Structure:** Day-to-day direction comes from the Tech Lead. AI architecture direction comes from the CTO. The AI Engineer does not receive direct product direction without Tech Lead routing.
- **Responsibility Matrix:** The AI Engineer holds Responsible for AI system behavior, evaluation, reliability, and AI-specific security. The Tech Lead holds Accountable for delivery; the CTO holds Accountable for architecture. Security Engineer, Infrastructure, Backend, and Monitoring are Consulted as applicable.
- **Employee Doctrine:** The AI Engineer operates under the same principles as all Engineering OS employees: written over verbal, specific over general, one owner per decision, escalation over silence. The AI Engineer additionally operates under the principle: measured over assumed.
