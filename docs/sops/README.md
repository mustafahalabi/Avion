# Standard Operating Procedures — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** CTO
**Last Updated:** 2026-06-29

This directory holds the **Standard Operating Procedures (SOPs)** of Engineering OS — the
step-by-step playbooks the virtual company follows to do its work. Each SOP defines who does
what, in what order, what every handoff requires, and what "complete" means for one kind of
work: shipping a feature, fixing a bug, reviewing code, validating QA, releasing, rolling back,
responding to incidents, and more. They turn the organizational documentation into repeatable
behavior the runtime can execute.

SOPs are owned by the **CTO** and maintained by the role named in each document's front-matter.
They are behavioral specifications, not implementation guides — they describe company behavior,
never prompts, models, or orchestration technology.

## Procedures

| SOP | Owner | Purpose |
|-----|-------|---------|
| [New Feature](./NEW_FEATURE.md) | Product Manager | Take a feature from a CEO objective to a shipped, documented, recorded capability. |
| [Bug Fix](./BUG_FIX.md) | Tech Lead | Handle a defect from report to confirmed production fix, root cause, and recorded learning. |
| [Code Review](./CODE_REVIEW.md) | Reviewer | Ensure merged code meets quality, correctness, security, and maintainability standards. |
| [QA Validation](./QA_VALIDATION.md) | QA Engineer | Confirm completed work behaves correctly before it reaches users. |
| [Release](./RELEASE.md) | Release Manager | Deliver validated, approved software to users, monitored and documented. |
| [Rollback](./ROLLBACK.md) | Release Manager | Reverse a production deployment to return to a known-good state quickly. |
| [Architecture Change](./ARCHITECTURE_CHANGE.md) | Tech Lead | Propose, review, approve, document, and execute structural changes to the system. |
| [Documentation Update](./DOCUMENTATION_UPDATE.md) | Technical Writer | Keep documentation accurate and current as the product and company evolve. |
| [Production Incident](./PRODUCTION_INCIDENT.md) | Monitoring Engineer | Detect, declare, triage, mitigate, recover, communicate, and learn from incidents. |
| [Safety Event Response](./SAFETY_EVENT.md) | Security Engineer | Respond to security and safety events with containment, recovery, and review. |
| [SEO Improvement](./SEO_IMPROVEMENT.md) | Search Visibility Specialist | Improve search visibility with measured, reviewed, validated changes. |
| [Speed & Performance Improvement](./SPEED_IMPROVEMENT.md) | Tech Lead | Make the product faster and more efficient without breaking it. |
| [Codebase Onboarding](./CODEBASE_ONBOARDING.md) | Tech Lead · CTO | Bring an employee or agent up to speed on a repository before they work in it. |

---

Each procedure is self-contained: read the **Purpose** section first, then follow the steps and
honor the handoffs. When a procedure is deviated from, that deviation must be documented and
reviewed — the process is the product.
