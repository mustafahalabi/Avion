# Product Alerts

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

This document defines the alerting policy for Engineering OS — what the company tells the CEO, when it tells them, with what urgency, and what it deliberately stays silent about. Alerts are the company's voice into the CEO's attention. They are the mechanism by which a virtual company that runs continuously, often unattended, surfaces the small number of moments that genuinely require a human decision while suppressing everything else.

This is a product policy document, not a delivery-channel specification. It defines *which* events deserve an alert and *how loud* that alert should be. It does not prescribe email, push, SMS, or any other transport — those are infrastructure choices that must never leak into the policy. Where this document describes behavior the platform implements today, it labels it **Implemented today**. Where it describes the intended policy that is not yet fully built, it labels it **Designed / planned**. Inventing capability is a hard project rule violation; this document does not do it.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Alert Principles](#2-alert-principles)
3. [Alert Types](#3-alert-types)
4. [Priority Levels](#4-priority-levels)
5. [When to Alert Immediately](#5-when-to-alert-immediately)
6. [When to Include in a Digest](#6-when-to-include-in-a-digest)
7. [Who Receives Which Alerts](#7-who-receives-which-alerts)
8. [Examples](#8-examples)
9. [Anti-Patterns](#9-anti-patterns)
10. [Success Criteria](#10-success-criteria)
11. [Implemented Today vs. Designed](#11-implemented-today-vs-designed)
12. [Relationship to Other Documents](#12-relationship-to-other-documents)

---

## 1. Purpose and Scope

### 1.1 What an alert is

An **alert** is a deliberate, policy-governed interruption of the CEO's attention. It says: *the company has reached a state you should know about, and possibly act on.* Every alert carries a type, a priority, a plain-language description of what happened, and — where action is possible — a direct path to take that action.

Alerts are distinct from the **Timeline** (the company's full, browsable history) and from **work item status** (which the CEO can always pull on demand). The Timeline records everything; alerts surface the few things worth pushing. The CEO should be able to ignore the product for a day and trust that anything that mattered generated an alert, and anything that generated an alert actually mattered.

### 1.2 What this document governs

- The catalog of alert types and what each one means.
- The priority scale and how priority is assigned.
- The decision of whether an event interrupts immediately or waits for a digest.
- Which recipient an alert is routed to.
- The examples, anti-patterns, and success criteria that keep the policy honest.

### 1.3 What this document explicitly does not govern

- **Delivery channels.** Whether an alert arrives in-app, by email, or by push is out of scope. The policy is channel-agnostic by design. A given priority *may* justify a more intrusive channel, but the channel is never part of the alert's identity.
- **Notification rendering.** Icons, colors, and layout are owned by the design system and the [Information Architecture](../architecture/INFORMATION_ARCHITECTURE.md#19-notification-structure) document.
- **The underlying event model.** The objects that alerts reference (Requests, Tasks, Reviews, QA Results, Releases) are defined in the domain model and organized by the Information Architecture. This document references them; it does not define them.

---

## 2. Alert Principles

These principles govern every alerting decision. When two principles conflict, the earlier one wins.

**2.1 Protect the CEO from noise above all else.**
The cost of a false alert is higher than the cost of a missed digest entry. A CEO who receives fifty alerts a day stops reading them, and the one alert that mattered is lost in the flood. The default answer to "should this generate an alert?" is *no*. An event earns an alert only by clearing a real bar: it requires a decision, it represents a risk, or it is a milestone the CEO would genuinely want pushed to them.

**2.2 Every alert is either a decision or a notable outcome.**
There is no third category. If an alert does not ask the CEO to decide something and does not report a genuinely notable outcome, it should not exist. Routine progress — a task moving from one internal state to the next, an engineer picking up work — is never an alert. It is Timeline material at most.

**2.3 Alerts speak in outcomes, never in operations.**
An alert says "Your password-reset feature is ready for your approval," not "Task #4823 transitioned to in-review and a pull request was opened on branch `feat/pw-reset`." Branches, pull request numbers, commit SHAs, file paths, and command logs never appear in an alert. This is the same contract the rest of the product honors: the CEO sees outcomes, the company owns operations. (See [Information Architecture §2](../architecture/INFORMATION_ARCHITECTURE.md#2-navigation-philosophy).)

**2.4 An actionable alert carries its action.**
If the CEO can do something about an alert — approve, reject, view — the alert links directly to the place where that action is taken. A decision alert that does not lead to a decision surface is a defect. Today every actionable alert carries an `actionUrl` that deep-links to the relevant Inbox or work surface.

**2.5 Priority reflects consequence, not volume.**
An alert is urgent because of what happens if the CEO ignores it, not because the system felt strongly. A blocked request that stalls all downstream work is urgent. A completed routine request is low priority even though it represents real work finishing.

**2.6 Silence is a feature.**
When the company is running smoothly at high autonomy, the CEO should hear almost nothing. A quiet alert stream is not a sign the product is doing nothing — it is a sign the company is absorbing the operational load exactly as intended. The product must never manufacture alerts to feel "alive."

**2.7 Alerts never block the work they describe.**
Emitting an alert is best-effort. A failure in the alerting path must never break the underlying workflow. This is enforced in code today: the gate-advancement checkpoint notifier wraps its emission in a try/catch and swallows failures precisely so that a missing notification surface cannot stall a task at a gate.

---

## 3. Alert Types

Engineering OS organizes alerts along two axes that exist in the data model today: a **type** (what kind of event this is) and a **priority** (how loud it should be). The `type` is a semantic category; the `priority` is the urgency. The two are independent — a `decision` can be high or urgent depending on what is being decided.

### 3.1 Implemented type taxonomy

The platform's notification layer (`src/lib/notify.ts`) emits the following types today. Each maps to a distinct meaning and a distinct visual treatment on the Notifications surface.

| Type | Meaning | Typical priority | Actionable |
|---|---|---|---|
| `decision` | The company needs the CEO to approve or reject something before it can proceed. | high | Yes |
| `blocker` | Work has stalled and cannot continue without attention. | urgent | Yes |
| `alert` | A quality gate produced a negative outcome (changes requested, QA failed) that the CEO should know about. | high | Yes |
| `warning` | A condition that is not yet a failure but is trending the wrong way. | medium | Sometimes |
| `progress` | A notable outcome was reached — a request completed. | low | No |
| `info` | A neutral, informational event — a new request was accepted and routed. | medium | No |

These six types are the truth of the system as built. They are intentionally coarse: a small, stable vocabulary is easier for the CEO to learn than a sprawling one.

### 3.2 Designed semantic types

The [Information Architecture §19](../architecture/INFORMATION_ARCHITECTURE.md#19-notification-structure) defines a higher-level, CEO-facing notion of notification *purpose* that the product is converging toward. These map onto the implemented types above and represent where the policy is heading.

| Designed purpose | Description | Maps to implemented type | Status |
|---|---|---|---|
| `approval_request` | A workflow phase requires CEO approval to proceed. | `decision` | **Implemented today** |
| `escalation` | An employee escalated a decision beyond its authority. | `decision` / `blocker` | **Designed / planned** |
| `incident_alert` | A P0/P1 production incident was detected. | `alert` / `blocker` | **Designed / planned** (incident pipeline not yet wired) |
| `status_update` | A significant milestone was reached. | `progress` | **Partially implemented** (request completion only) |
| `company_health` | A health metric changed materially. | `warning` | **Designed / planned** |

When the incident and health pipelines come online, they should reuse the existing `notify` taxonomy rather than inventing parallel machinery.

---

## 4. Priority Levels

Priority answers one question: *how much should this interrupt the CEO?* The platform supports four levels (`src/lib/notify.ts`), and they map directly to the consequence of inaction.

| Priority | Meaning | Consequence of ignoring | Default surfacing |
|---|---|---|---|
| `urgent` | Something is broken or fully stalled right now. | Downstream work halts; the company cannot make progress. | Immediate, most prominent. |
| `high` | A decision is required, or a quality gate failed. | Work waits on the CEO; a feature cannot ship until they act. | Immediate. |
| `medium` | A neutral but real event the CEO may want to see. | Nothing breaks; the CEO is simply less informed. | Immediate-but-quiet, digest-eligible. |
| `low` | A routine positive outcome. | None. | Digest-eligible; never interruptive on its own. |

### 4.1 How priority is assigned

Priority is assigned at emission time by the workflow that produces the event, not inferred later. The mapping is deliberate and consistent across the codebase today:

- A request reaching `awaiting_approval` emits `decision` / **high** — a human must act for the feature to advance.
- A request reaching `blocked` emits `blocker` / **urgent** — the pipeline is stuck.
- A request reaching `complete` emits `progress` / **low** — good news, no action.
- A new request being accepted emits `info` / **medium** — neutral confirmation.
- A review returning `changes_requested` or QA returning `failed` emits `alert` / **high** — a gate said no.
- A review or QA checkpoint pausing for the CEO emits `decision` / **high** — the autonomy level requires sign-off.

### 4.2 Priority is not severity inflation

The product must resist the temptation to mark everything `high` "to be safe." A priority scale where most items are high is a scale with no signal. The bar for `urgent` is *the company is stuck*. The bar for `high` is *a human decision gates progress*. Everything else is `medium` or `low`.

---

## 5. When to Alert Immediately

An event warrants an **immediate** alert when delay has a cost. Three conditions justify immediacy:

**5.1 A decision gates progress.**
When the company has done all it can and now waits on the CEO, holding the alert wastes wall-clock time the CEO cannot recover. These are the `decision` alerts: a feature brief awaiting approval, a review checkpoint, a QA checkpoint. The platform emits these the moment the workflow reaches the gate.

> **Implemented today:** When a request advances to `awaiting_approval`, `advanceRequestStatus` emits a `decision`/high notification with a deep link to the request. When the gate-advancement service pauses a task at a review or QA checkpoint (because autonomy is sub-threshold), `notifyCheckpoint` emits a `decision`/high notification linking to the Inbox.

**5.2 Work is blocked.**
A `blocker` means the company cannot proceed at all. Every minute of delay is a minute of stalled throughput. These are emitted immediately at `urgent`.

> **Implemented today:** A request reaching `blocked` emits a `blocker`/urgent notification.

**5.3 A quality gate failed.**
When a review requests changes or QA fails, the CEO should know promptly — not because they must act on the spot, but because it changes their expectation of when the feature ships. These are immediate at `high`.

> **Implemented today:** `recordReviewVerdict` emits an `alert`/high notification on `changes_requested`; `recordQaResult` emits an `alert`/high notification on `failed`.

**5.4 The immediacy test**

Before making any alert immediate, apply this test: *If the CEO saw this thirty seconds from now instead of in tomorrow's summary, would anything be different?* If the honest answer is no, the alert is not immediate — it is digest material.

---

## 6. When to Include in a Digest

A **digest** batches low-consequence, no-action events into a single periodic summary so the CEO can stay informed without being interrupted. The digest is the relief valve that lets the immediate stream stay sacred.

### 6.1 What belongs in a digest

- **Routine completions.** A request finished, a feature shipped at high autonomy with no approval required. (`progress` / low.)
- **Neutral confirmations.** A request was accepted and routed. (`info` / medium.) The CEO can see this when they next look; it does not need to chase them.
- **Aggregated health trends.** "Documentation coverage rose 4 points this week." (Designed.)
- **Volume events.** Anything that, individually, is unremarkable but collectively tells a story — N tasks completed, M reviews approved.

### 6.2 What never belongs in a digest

- Anything `urgent`. A blocker discovered at 9am must not wait for a 6pm summary.
- Any open decision. A pending approval is not a status line in a recap; it is a live ask that should already have interrupted.
- Incidents. By definition time-sensitive.

### 6.3 Digest cadence (designed)

The digest cadence is a CEO setting, defaulting to a single daily summary. A CEO at full autonomy may prefer weekly; a hands-on CEO may want none, surfacing low-priority items only inside the product. The cadence governs *batching*, never *suppression* — a digest-eligible event is always recorded and always visible on demand; the digest only decides whether it also gets pushed.

> **Status — Designed / planned.** Digest batching and scheduling are **not implemented today.** The platform currently records every notification individually and presents them in the Notifications surface, grouped into **Unread** and **Earlier** sections (`/notifications`). Low-priority items therefore already avoid interrupting beyond a badge increment, but true periodic digest *delivery* is future work. Until it ships, the policy is honored by *priority discipline* — low-consequence events are emitted at `low`/`medium` so they never escalate — rather than by batching.

---

## 7. Who Receives Which Alerts

### 7.1 The single recipient today

In V1 there is exactly one human per company: the **CEO**, who is the company owner. Every alert is therefore routed to the owner's user account. This is reflected directly in the data: notifications carry a `userId` (the recipient) and a `companyId` (the scope), and every emission today resolves the recipient to the company owner.

> **Implemented today:** `notify` writes a `Notification` row keyed to `userId`. Workflow emitters resolve `userId` from the authenticated CEO or from `company.ownerId` (as the checkpoint notifier does). Badge counts are scoped per user: the sidebar bell counts `notification` rows where `read: false` for the current user, and the Inbox badge counts pending approval checkpoints for the user's company.

### 7.2 Routing by alert type

Even with one recipient, alerts route to different *surfaces*, and that routing is meaningful:

| Alert | Recipient | Lands on | Surfaced by |
|---|---|---|---|
| `decision` — request awaiting approval | CEO | Inbox → request detail | Sidebar bell + Inbox badge + dashboard card |
| `decision` — review/QA checkpoint | CEO | Inbox approvals | Sidebar bell + Inbox badge + dashboard "Pending approvals" card |
| `blocker` | CEO | Request detail | Sidebar bell, Notifications |
| `alert` — changes requested / QA failed | CEO | Work → quality detail | Sidebar bell, Notifications |
| `progress` / `info` | CEO | Notifications | Notifications surface only (badge) |

> **Implemented today:** Pending approval checkpoints (review/QA) are counted by `countPendingCheckpoints` and surfaced in three places: the Inbox badge (app layout), the dashboard **Pending approvals** card, and the dashboard **Decisions Awaiting Your Approval** section. The Inbox exposes **Approve / Reject** controls (`ApprovalActions`) that resume the real review/QA services so no gate is bypassed.

### 7.3 Designed routing

When the company gains a second human (a co-founder, a delegated approver) and when employees can escalate, routing will need a recipient-resolution rule rather than "always the owner." The designed rule: route to the human who owns the decision being asked, falling back to the CEO. Escalations route up the reporting chain defined in the [Reporting Structure](../organization/REPORTING_STRUCTURE.md). This is **Designed / planned**; today the owner receives everything.

---

## 8. Examples

The following examples show the policy applied end to end. Each gives the trigger, the emitted type and priority, the immediacy decision, and the CEO-facing message. The "Implemented today" examples correspond to real emission sites in the codebase.

### 8.1 Feature brief ready for approval — *Implemented today*

- **Trigger:** A request advances to `awaiting_approval`.
- **Type / priority:** `decision` / high.
- **Immediacy:** Immediate — a human decision gates progress.
- **Recipient:** CEO.
- **Message:** "Decision needed: *Add password reset*. A feature brief is ready for your approval."
- **Action:** Deep link to the request in the Inbox.

### 8.2 Review checkpoint paused by autonomy — *Implemented today*

- **Trigger:** At sub-threshold autonomy, the gate-advancement service halts a task at the review gate instead of auto-advancing.
- **Type / priority:** `decision` / high.
- **Immediacy:** Immediate.
- **Recipient:** CEO.
- **Message:** "Approval needed: review. *Password reset endpoint* is awaiting your review decision."
- **Action:** Inbox approvals, with **Approve / Reject**.

### 8.3 QA failed — *Implemented today*

- **Trigger:** A QA result is recorded with verdict `failed`.
- **Type / priority:** `alert` / high.
- **Immediacy:** Immediate — it changes the CEO's shipping expectation.
- **Recipient:** CEO.
- **Message:** "QA failed: *Checkout flow* — payment total mismatch on multi-item carts."
- **Action:** Link to the QA result.

### 8.4 Request blocked — *Implemented today*

- **Trigger:** A request advances to `blocked`.
- **Type / priority:** `blocker` / urgent.
- **Immediacy:** Immediate — the pipeline is stuck.
- **Recipient:** CEO.
- **Message:** "Blocked: *Customer dashboard*. This request is blocked and needs your attention."
- **Action:** Link to the request.

### 8.5 Request completed — *Implemented today*

- **Trigger:** A request advances to `complete`.
- **Type / priority:** `progress` / low.
- **Immediacy:** Not immediate — digest-eligible. Records to the Notifications surface; no interruption beyond a badge.
- **Recipient:** CEO.
- **Message:** "Complete: *Add dark mode*. This request has been completed."
- **Action:** Optional link to the request.

### 8.6 New request accepted — *Implemented today*

- **Trigger:** The CEO submits an outcome and the request is routed.
- **Type / priority:** `info` / medium.
- **Immediacy:** Quiet confirmation.
- **Recipient:** CEO.
- **Message:** "New request: *Add billing*. Routed to the Product Manager. Team is reviewing."
- **Action:** Link to the request.

### 8.7 Production incident — *Designed / planned*

- **Trigger:** The Monitoring Engineer detects a P1 anomaly.
- **Type / priority:** `alert` (escalating to `blocker`) / urgent.
- **Immediacy:** Immediate, most intrusive available channel.
- **Recipient:** CEO (and, when multi-recipient routing exists, the Release Manager).
- **Status:** The incident pipeline is not wired today; this example documents intended policy.

---

## 9. Anti-Patterns

These are the failure modes the policy exists to prevent. Each has been observed in products that drown their users.

**9.1 The chatty company.**
Emitting an alert for every internal state transition — task assigned, task started, branch created, commit pushed. This trains the CEO to ignore alerts. *Rule:* internal transitions are Timeline entries, never alerts.

**9.2 Severity inflation.**
Marking everything `high` or `urgent` "to be safe." When most alerts are urgent, none are. *Rule:* `urgent` means the company is stuck; `high` means a human decision gates progress; everything else is lower.

**9.3 Operational leakage.**
Putting branch names, PR numbers, commit SHAs, file paths, or command logs into an alert. This breaks the CEO experience and forces the CEO to think like an engineer. *Rule:* alerts speak in features and outcomes, never in Git or CI artifacts.

**9.4 The dead-end alert.**
An alert that asks for a decision but does not link to where the decision is made. *Rule:* every actionable alert carries its `actionUrl`.

**9.5 The duplicate storm.**
Re-emitting the same alert on every poll, retry, or page render until the CEO acts. *Rule:* an alert fires once per state transition. Pending state is reflected by *counts and badges* that the CEO pulls (the sidebar bell, the Inbox badge, the dashboard card) — not by repeated pushes.

**9.6 Blocking on the alert.**
Letting a failure in the alerting path break the workflow it describes. *Rule:* emission is best-effort and must never throw into the workflow. This is enforced today in the checkpoint notifier.

**9.7 Manufactured liveness.**
Generating alerts so the product feels active when the company is quietly succeeding. *Rule:* silence at high autonomy is correct. Do not fabricate signal.

**9.8 Channel creep in policy.**
Letting "send an email" or "push to phone" become part of an alert's definition. *Rule:* the policy decides type, priority, and immediacy; channels are an infrastructure concern resolved separately.

---

## 10. Success Criteria

The alerting system is succeeding when the following hold. These are the acceptance criteria for the policy and the bar any future alerting work must clear.

**10.1 Every alert is actionable or notable.**
A sample of emitted alerts contains zero entries that are neither a decision nor a notable outcome. No routine transitions appear.

**10.2 No operational artifacts reach the CEO.**
No alert in production contains a branch name, PR number, commit SHA, file path, or command. Verified by inspection of emitted titles and bodies.

**10.3 Decisions are never lost.**
Every `decision` alert corresponds to a live, resolvable approval surface, and the count of open decisions is always visible (sidebar bell, Inbox badge, dashboard card). A pending approval can always be acted on directly. *Implemented today.*

**10.4 Urgency is meaningful.**
The share of `urgent` alerts stays small. If most alerts are urgent, the scale has failed.

**10.5 The CEO can go quiet safely.**
At full autonomy with a healthy company, the immediate-alert stream approaches zero while work continues — and nothing important is missed, because anything important would have cleared the immediacy bar.

**10.6 Alerts never break work.**
A forced failure in the notification path leaves the underlying workflow unaffected. *Implemented today* via best-effort emission.

**10.7 Approval intervention declines with trust.**
As a company matures and autonomy rises, the volume of `decision` alerts trends down — the CEO is asked to decide less because the company has earned more latitude. This mirrors the [PRD success metric](../product/PRODUCT_REQUIREMENTS.md#15-success-metrics) "CEO Approval Intervention Rate: declining over time."

---

## 11. Implemented Today vs. Designed

This section consolidates the honest split between what the platform does now and what remains policy-only, so no reader mistakes intent for capability.

### 11.1 Implemented today

- A `Notification` record with `userId`, `companyId`, `title`, `body`, `type`, `priority`, `entityType`, `entityId`, `actionUrl`, and read state.
- A six-value type taxonomy (`info`, `warning`, `alert`, `decision`, `progress`, `blocker`) and a four-value priority scale (`low`, `medium`, `high`, `urgent`), emitted via a single `notify` / `notifyInTx` helper.
- Real emission at the workflow points that matter: request accepted, request awaiting approval, request blocked, request complete, review changes-requested, QA failed, and review/QA autonomy checkpoints.
- A Notifications surface that groups **Unread** and **Earlier**, with per-item and bulk mark-as-read.
- Pending-approval visibility in three places — sidebar bell (unread count), Inbox badge (pending checkpoints), and a dashboard **Pending approvals** card — plus inline **Approve / Reject** that resumes the real review/QA services.
- Best-effort emission: a notification failure cannot break gate advancement.

### 11.2 Designed / planned

- **Digest batching and cadence.** No periodic summary is produced today; low-priority items rely on priority discipline and badge-only surfacing instead of true digests.
- **Delivery channels beyond in-app.** Email, push, and any external transport are out of scope and unbuilt; the policy stays channel-agnostic.
- **Incident and company-health alerts.** The `incident_alert` and `company_health` purposes are designed but not wired; the monitoring and health pipelines do not yet emit.
- **Escalation routing.** Employee-to-CEO escalations as a distinct alert path are designed; today escalating workflows surface as `decision`/`blocker`.
- **Multi-recipient routing.** With a single CEO per company in V1, all alerts route to the owner. Recipient-resolution by decision ownership is future work.

---

## 12. Relationship to Other Documents

- **[Information Architecture §19 — Notification Structure](../architecture/INFORMATION_ARCHITECTURE.md#19-notification-structure)** defines where notifications live in the product's information hierarchy and the CEO-facing notification purposes. This document defines the *policy* (which events alert, with what priority, immediately or digested); the IA defines the *placement*.
- **[Product Requirements §12 — F-10 Notifications and Approvals](../product/PRODUCT_REQUIREMENTS.md#12-v1-features)** is the product feature this policy operationalizes. The PRD's principle that "a CEO who receives 50 notifications a day is no longer a CEO" is the founding constraint of this document.
- **[Product Requirements §6–§7 — Autonomy and Culture](../product/PRODUCT_REQUIREMENTS.md#7-product-principles)** govern *when* a decision alert is required: the autonomy level determines whether a gate pauses for CEO approval (generating a `decision` alert) or auto-advances silently.
- **[Release SOP](../sops/RELEASE.md)** and the other SOPs define the workflow gates whose transitions produce alerts. Alerts are the CEO-facing projection of SOP gate events.
- **[Reporting Structure](../organization/REPORTING_STRUCTURE.md)** defines the escalation chain that future escalation alerts will route along.

---

*End of document.*
