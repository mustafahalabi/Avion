# Core Product UX Flows — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

This document defines the **core user experience flows** of Engineering OS — the end-to-end journeys a CEO travels through, from first arrival to delivered software. Each flow is specified as a sequence of CEO goals and the system's responses, at the altitude a wireframe can be drawn from. It is a UX specification, not a frontend build sheet and not a code design. It prescribes *what the user is trying to do, what they see, and what the company does in response* — never components, routes, or implementation.

This document is deliberately a **flow-level** view. It does not redefine the models it traverses: the first-run journey is owned in depth by [`../ceo-experience/FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md), the approval and trust contract by [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md), and navigation by [`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md). Where this document and those overlap, they own the model and this document owns the *flow through it*.

The governing rule of every flow below is the product's one non-negotiable: **the CEO states outcomes and approves decisions; the company owns execution.** Any step that asks the CEO to make an implementation decision — a branch name, a file path, a CI choice — is a flow failure.

---

## Table of Contents

1. [How to Read These Flows](#1-how-to-read-these-flows)
2. [The Flow Map](#2-the-flow-map)
3. [Flow 1 — First-Run](#3-flow-1--first-run)
4. [Flow 2 — Company Creation](#4-flow-2--company-creation)
5. [Flow 3 — Repository Onboarding](#5-flow-3--repository-onboarding)
6. [Flow 4 — Work Delegation](#6-flow-4--work-delegation)
7. [Flow 5 — Planning Review](#7-flow-5--planning-review)
8. [Flow 6 — Progress Monitoring](#8-flow-6--progress-monitoring)
9. [Flow 7 — Approval](#9-flow-7--approval)
10. [Flow 8 — Release Completion](#10-flow-8--release-completion)
11. [Flow 9 — Error and Blocked States](#11-flow-9--error-and-blocked-states)
12. [Cross-Flow Rules](#12-cross-flow-rules)
13. [Relationship to Other Documents](#13-relationship-to-other-documents)

---

## 1. How to Read These Flows

Every flow in this document is described with the same anatomy so it can be turned directly into a wireframe sequence.

| Element | What it specifies |
|---|---|
| **Goal** | What the CEO is trying to accomplish, in their own words. |
| **Entry point** | Where in the product the flow begins (the surface, per the IA). |
| **Preconditions** | What must already be true for the flow to start. |
| **Steps** | An ordered table of *CEO action → System response*. The left column is what the person does; the right column is what the company shows or does back. |
| **Exit states** | The possible ways the flow ends, including the not-happy paths. |
| **Next flow** | Where the CEO naturally goes after this flow completes. |

**Flow notation conventions:**

- A **CEO action** is always something a person decides or states — never an engineering operation.
- A **system response** is always framed in outcome language. If a response would expose a branch, PR number, file path, or pipeline status, it is wrong (see [`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) §2).
- A **gate** is a point where the company pauses for a CEO decision. Whether a gate appears is governed by the company's autonomy level, not by the flow (see Flow 7 and [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §8).
- An **empty state** is treated as a first-class step, not an afterthought. Every empty state names the single next action.

These flows describe the **target experience**. Where a step depends on capability that is designed but not yet assembled into a single guided surface, it is marked and traced to the owning document rather than overclaimed.

---

## 2. The Flow Map

The core flows form one continuous arc from arrival to delivery, with monitoring, approval, and error handling threaded through the working flows rather than bolted on at the end.

```
First-Run
   │
   ├─▶ Company Creation ──▶ Repository Onboarding
   │                              │
   │                              ▼
   └───────────────────▶ Work Delegation ──▶ Planning Review
                                                  │
                                  (approve plan)  ▼
                                          Progress Monitoring ◀─┐
                                                  │             │
                                          (gate reached)        │ (resume)
                                                  ▼             │
                                              Approval ─────────┘
                                                  │
                                                  ▼
                                          Release Completion

      Error & Blocked States  ──  can surface inside any flow above
```

Three flows are **linear and one-time** per company (First-Run, Company Creation, Repository Onboarding). Five flows are **recurring** for the life of the company (Work Delegation, Planning Review, Progress Monitoring, Approval, Release Completion). Error and blocked states are **cross-cutting** — they can interrupt any flow and route the CEO to a single clear next action.

The recurring flows map to the CEO's four interaction modes — outcome input, approvals, browse, configure ([`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §2.3). No flow introduces a fifth mode.

---

## 3. Flow 1 — First-Run

**Goal:** "I just signed up. Show me what I bought and get me to my first useful action."

**Entry point:** The application landing surface immediately after authentication.

**Preconditions:** The user has authenticated. No engineering concepts have been introduced yet.

This flow is the consolidated walk through the first session. Its narrative, principles, empty states, and success criteria are owned in full by [`../ceo-experience/FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md); the table below is the flow-level summary that the other one-time flows branch from.

| # | CEO action | System response |
|---|---|---|
| 1 | Completes sign-up / sign-in | Authenticates and routes the user toward their company — no company, repository, or role questions at this step. |
| 2 | Arrives with no company | Provisions a complete, staffed company automatically (Flow 2). The CEO does nothing to cause this beyond arriving. |
| 3 | Is greeted | Addresses the user as **CEO**, names the company, and states the company is "yours" and "standing by." |
| 4 | Sets company style | Presents exactly two choices — autonomy and culture — each with a marked recommended default. |
| 5 | Reaches the connect-work step | Offers a prominent **connect a repository** step with an explicit **"Skip for now"** path (Flow 3). |
| 6 | Lands on the dashboard | Shows a getting-started state: "Your company is ready. N employees are standing by," with one obvious next action. |

**Exit states:**

- **Configured, repository connected** → ready to delegate work (Flow 4).
- **Configured, repository skipped** → dashboard shows a persistent setup banner inviting the CEO to finish connecting a codebase.
- **Returning user** → bypasses creation and lands directly on the dashboard.

**Next flow:** Work Delegation (Flow 4), or Repository Onboarding (Flow 3) if skipped earlier.

**The one rule this flow must never break:** the user must finish the first session feeling they *arrived at a company they already own*, not that they *configured a tool*. Every step above serves that impression.

---

## 4. Flow 2 — Company Creation

**Goal:** "Give me my company." (In practice the CEO never states this — the company is created for them.)

**Entry point:** Triggered automatically the first time an authenticated user reaches onboarding without an existing company.

**Preconditions:** Authenticated user; no company yet associated with the account.

The defining property of this flow is that **the company is created for the user, not by the user.** There is no "add your first employee" step, because a real company does not start empty.

| # | CEO action | System response |
|---|---|---|
| 1 | Arrives without a company | Provisions a full organization in a single atomic step: five departments, the full V1 employee roster, a reporting hierarchy, and seeded starting memory. |
| 2 | Sees the new company | Presents the company under a placeholder name, ready to be renamed. |
| 3 | Names the company | Accepts a company name (the only naming the CEO performs in setup). |
| 4 | Confirms autonomy | Records the autonomy level — **Assist** is the marked default — to company settings. |
| 5 | Confirms culture | Records the culture profile — **Startup** is the marked default — to company settings. |
| 6 | Finishes setup | Confirms the company is ready and offers to **meet the team** and then put it to work. |

**What this flow never asks:** to assemble departments, to define roles, to hire employees, or to configure more than the two style choices plus a name. Two decisions, not twenty.

**Exit states:**

- **Company configured** → proceeds to Repository Onboarding (Flow 3) or directly to the dashboard.
- **Defaults accepted** → a fully valid company is created by clicking through; no choice is required to finish.

**Next flow:** Repository Onboarding (Flow 3).

The roster, hierarchy, and the autonomy/culture decisions in this flow are specified in [`../ceo-experience/FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md) §5–§9 and in [`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) F-06/F-07. This flow does not redefine them; it sequences the CEO's path through them.

---

## 5. Flow 3 — Repository Onboarding

**Goal:** "Give the company something real to build on — my codebase."

**Entry point:** The connect-a-repository step during first-run, or the dashboard setup banner / company settings at any later time.

**Preconditions:** A configured company exists. The CEO has a repository they want the company to work in.

Repository connection is the bridge between a company that *exists* and a company that can *build*. It is offered early but treated as optional, because the company must feel real even before any code is linked.

| # | CEO action | System response |
|---|---|---|
| 1 | Chooses to connect a repository | Frames the step plainly: *link a repository so your company can analyze, plan, and implement changes in your codebase.* |
| 2 | Provides the repository's identity | Captures the repository's name, location, primary language, stack, and key dependencies — high-level shape only. |
| 3 | Confirms the connection | Links the codebase to the company and acknowledges that the company can now plan against real work. |
| 4 | (Alternatively) skips | Accepts **"Skip for now,"** completes onboarding, and surfaces a persistent dashboard banner to connect later. |
| 5 | Returns to the dashboard | Removes the setup banner once a repository is connected; empty work states now point toward delegating work rather than connecting code. |

**What the CEO is never asked here:** to manage branches, configure CI, install workflows, or reason about tokens and permissions. Those belong to the company ([`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) §2). The CEO connects "a repository"; the company handles everything underneath.

**Exit states:**

- **Repository connected** → the company can plan and implement against real code; proceed to Work Delegation (Flow 4).
- **Skipped** → company is fully usable for browsing and meeting the team; the connect prompt persists until satisfied.

**Designed / not yet a unified first-run step:** automatic repository analysis presented to the CEO for confirmation *during* onboarding (an architecture summary to review and correct). Repository intelligence exists in the platform, but presenting it as a confirmation step inside onboarding is designed, not yet assembled — see [`../ceo-experience/FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md) §14. The flow above does not depend on that step to complete.

**Next flow:** Work Delegation (Flow 4).

---

## 6. Flow 4 — Work Delegation

**Goal:** "Tell the company what I want built."

**Entry point:** The outcome / request input surface, reachable from the dashboard, the inbox, and the work board's empty state.

**Preconditions:** A configured company. A connected repository is recommended but the request can be captured without one.

This is the product's defining interaction. The CEO states an outcome; the company turns it into a plan. The CEO's **only** input is the goal.

| # | CEO action | System response |
|---|---|---|
| 1 | Opens the request surface | Presents a single goal field with placeholder text that models the right altitude: an outcome ("Build repository intelligence to understand any codebase"), not a task ("add a function to parse package.json"). |
| 2 | States one goal | Captures the request as a title plus a plain-language description of *what should be built and why*. |
| 3 | (Optional) adds context | Lets the CEO associate the request with a connected repository and set a priority (`low` / `medium` / `high` / `urgent`). Nothing more is requested. |
| 4 | Submits the request | Records the outcome as **proposed**, logs the submission to the company timeline, and **generates a reviewable planning draft — not live work.** |
| 5 | Reads the confirmation | States explicitly that a plan was drafted and that **no work records are created yet** — stating a goal is safe and reversible. |

**What this flow forbids:** asking the CEO to decompose the work, assign an employee, choose a library, or specify an approach. The CEO does not even choose *who* handles the request — the company routes it internally.

**Exit states:**

- **Plan drafted** → the CEO is routed into Planning Review (Flow 5).
- **Request saved without immediate review** → the draft waits in the decision queue; the dashboard's next-action recommendation surfaces it.

**Next flow:** Planning Review (Flow 5).

This flow corresponds to the CEO's **outcome input** interaction mode and F-02 in [`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md). The planning engine it feeds is specified in [`../systems/PLANNING_SYSTEM.md`](../systems/PLANNING_SYSTEM.md).

> **Accuracy note.** Today plan generation is **deterministic and templated**, by deliberate policy — real-AI planning is gated behind the canonical Engineering OS Specification. The CEO experience of the flow is identical either way; the gating is internal. See [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §5.4.

---

## 7. Flow 5 — Planning Review

**Goal:** "Did the company understand me, and is this the right thing to build? If so, go."

**Entry point:** The plan review surface, reached from Work Delegation or from a pending plan-approval item in the inbox.

**Preconditions:** An outcome has been submitted and a planning draft exists. No real work records have been created yet.

Plan approval is the highest-leverage decision the CEO makes. It is where the CEO confirms the company is about to build the *right* thing, before any execution begins. Approval is also the moment a draft becomes real, tracked work.

| # | CEO action | System response |
|---|---|---|
| 1 | Opens the plan | Presents a plain-language summary: *what will be delivered, why, and the shape of the work* — readable by a CEO, not an engineer. |
| 2 | Reviews the breakdown | Shows the structure the company will execute — projects, features, tasks, quality gates, and a release path — at a summary altitude, with drill-down available but not required. |
| 3 | Forms a verdict | Offers exactly three responses: **Approve**, **Request changes**, or **Reject**. |
| 4a | Approves | Applies the plan idempotently into real Project / Feature / Task records with full traceability, and begins the company's standard work lifecycle. |
| 4b | Requests changes | Returns the draft to the company for revision; the CEO is not asked to edit tasks themselves. |
| 4c | Rejects | Discards the draft without creating work records; the outcome can be restated or dropped. |

**What this flow forbids:** asking the CEO to edit the task breakdown, reassign work, or adjust estimates. The CEO accepts or returns the plan as a business artifact — they do not operate it.

**Exit states:**

- **Approved** → work records created; the CEO moves to Progress Monitoring (Flow 6).
- **Changes requested** → revised draft returns to this same flow.
- **Rejected** → no work created; the company is idle on this outcome.

**Next flow:** Progress Monitoring (Flow 6).

The deterministic plan, the approval semantics, and the idempotent apply are specified in [`../systems/PLANNING_SYSTEM.md`](../systems/PLANNING_SYSTEM.md) and [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §6.1. The procedure the approved plan follows is [`../sops/NEW_FEATURE.md`](../sops/NEW_FEATURE.md).

---

## 8. Flow 6 — Progress Monitoring

**Goal:** "Show me what my company is doing right now, without making me manage it."

**Entry point:** The dashboard (default landing surface), with drill-down into Work and the timeline.

**Preconditions:** At least one plan has been approved and work is in motion.

Monitoring is a **browse** interaction, not a management one. The CEO observes to stay informed; they never reassign an engineer or reorder a task list. The experience is a live feed of organizational activity, not a log of AI prompts.

| # | CEO action | System response |
|---|---|---|
| 1 | Opens the dashboard | Shows the live company state in one view: active work, recent completions, company health, and anything pending the CEO's approval. |
| 2 | Reads active work | Shows each active item in plain language — "Implementing: Password reset endpoint," "Reviewing: Checkout changes," "Testing: Registration flow" — with which feature it belongs to and how long it has been running. |
| 3 | Reads "what needs me" | Surfaces a single prioritized **next action** plus a short list of secondary attention items, each with a one-line reason grounded in real state. |
| 4 | Drills into an item | Opens the work item's outcome-level detail — status, owning role, history — without ever exposing diffs, branches, or pipeline output. |
| 5 | Reviews history | Offers the company timeline: features shipped, decisions recorded, releases deployed — a narrative of what the company has accomplished. |

**What this flow forbids:** showing the CEO raw engineering activity (commits, file changes, CI runs) or requiring them to intervene for work to proceed. Routine progress never demands CEO action.

**Exit states:**

- **All clear** → the CEO browses and leaves; work continues autonomously within the configured autonomy level.
- **A gate is reached** → a "needs your approval" item appears and routes the CEO to the Approval flow (Flow 7).
- **Something stalls or blocks** → the next-action recommendation routes the CEO to the Error and Blocked States flow (Flow 9).

**Next flow:** Approval (Flow 7) when a gate appears; Release Completion (Flow 8) when work finishes; otherwise the CEO returns to Work Delegation for the next outcome.

The dashboard surface is specified in [`../ceo-experience/COMPANY_DASHBOARD.md`](../ceo-experience/COMPANY_DASHBOARD.md), the timeline in [`../ceo-experience/COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md), and the next-action recommendation in [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §7.2.

---

## 9. Flow 7 — Approval

**Goal:** "The company paused for a decision only I can make. Decide and let it continue."

**Entry point:** The inbox, the dashboard "Pending approvals" card, or the sidebar bell — all of which surface the same decision queue.

**Preconditions:** A gated action or quality gate is waiting on the CEO. Whether and where this happens is determined entirely by the company's autonomy level.

Approval is how the CEO retains control without managing execution. Approval moments are deliberately rare, high-signal, and always arrive with the context needed to decide.

| # | CEO action | System response |
|---|---|---|
| 1 | Notices a pending decision | Raises a `decision` notification and shows a count on the sidebar bell, the inbox badge, and a dashboard "Pending approvals" card. |
| 2 | Opens the approval item | Presents a **"needs your approval"** item stating *what is being approved, which task or session it belongs to, and a one-line summary* — no digging required. |
| 3 | Reads the consequence | States plainly what happens **if approved** and what happens **if rejected**. |
| 4a | Approves | Resumes the real workflow through the company's review/QA services — approval never bypasses a gate, it clears it. |
| 4b | Rejects | Returns the work to the company; a rejected review sends the task back to implementation rather than advancing it. |
| 5 | Returns to the queue | Recomputes the decision queue and updates all pending counts; the next attention item, if any, is surfaced. |

**The autonomy contract (which gates appear):** the gated actions are `create_session`, `run_agent`, `push`, `open_pr`, `auto_review`, `auto_qa`, and `auto_merge`. At each autonomy level, each resolves to **allow**, **requires approval**, or **deny**. At **Assist** (the default), a completed piece of work pauses for CEO review; at **Autonomous**, the same work advances on its own. The full matrix is authoritative in [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §8.4; this flow does not restate it.

**The approval contract (non-negotiable):**

- Every approval request states both outcomes — approve and reject.
- Routine task completions never generate an approval; only genuinely consequential gates do.
- Approvals and rejections are permanently recorded against the work item.
- The company never advances a gated action while its checkpoint is unresolved.
- A task never reaches `done` without a recorded approved review **and** passing QA — even at the highest autonomy level. Raising autonomy skips *waiting on the CEO*, never the *gates*.

**Exit states:**

- **Approved** → work resumes toward review, QA, and release.
- **Rejected** → work returns to an earlier phase with the rejection recorded.
- **Deferred** → the item remains in the decision queue and continues to surface until resolved.

**Next flow:** Progress Monitoring (Flow 6) as work resumes; Release Completion (Flow 8) for the final ship.

This flow corresponds to the CEO's **approvals** interaction mode. It is specified in depth in [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §6–§8, [`../systems/APPROVAL_SYSTEM.md`](../systems/APPROVAL_SYSTEM.md), and [`../ceo-experience/PRODUCT_ALERTS.md`](../ceo-experience/PRODUCT_ALERTS.md).

---

## 10. Flow 8 — Release Completion

**Goal:** "The work is done. Confirm it's ready and ship it — and tell me what shipped."

**Entry point:** A release-ready notification or the work board, leading to the release surface.

**Preconditions:** Work for a feature has passed review and QA. A release candidate has been assembled from the completed work.

Release is one of the highest-visibility moments for the CEO because it represents the completion of the company's work. The CEO's role is to confirm readiness (where autonomy requires it) and to receive a plain-language record of what shipped.

| # | CEO action | System response |
|---|---|---|
| 1 | Is notified work is ready | Surfaces "Your feature is ready for release," assembled from completed, review-passed, QA-passed work. |
| 2 | Reviews readiness | Presents the release candidate: features included, the QA Go/No-Go recommendation, and the readiness checklist status — in CEO language. |
| 3 | Approves the release | (If the autonomy level gates deployment) Records the approval and proceeds; at higher autonomy the company ships and the CEO receives a summary instead. |
| 4 | Receives the outcome | Marks the work delivered, records a CEO-facing release summary, and writes a `release_deployed` / `feature_shipped` entry to the timeline. |
| 5 | Reads the record | Shows what shipped, why it mattered, and links to the feature's memory — closing the loop opened in Work Delegation. |

**What this flow forbids:** asking the CEO to operate a deployment, manage environments, run a pipeline, or read a changelog diff. The CEO approves an outcome and receives a record; the Release Manager owns the mechanics.

**Exit states:**

- **Shipped, gated** → the CEO approved and the release deployed.
- **Shipped, autonomous** → the company deployed within guardrails and delivered a summary.
- **Held** → a No-Go recommendation or unmet readiness item stops the release; the CEO is told what is outstanding (routes to Flow 9).

**Next flow:** back to Work Delegation (Flow 4) for the next outcome — "Add dark mode."

Release behavior is specified in [`../sops/RELEASE.md`](../sops/RELEASE.md); rollback, if a release must be reversed, follows [`../sops/ROLLBACK.md`](../sops/ROLLBACK.md). The timeline record is specified in [`../ceo-experience/COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md).

---

## 11. Flow 9 — Error and Blocked States

**Goal:** "Something went wrong or got stuck. Tell me what happened and what to do — in my language."

**Entry point:** Cross-cutting. A blocked or failed state can surface inside any working flow, and is routed to the CEO through the next-action recommendation, the inbox, and notifications.

**Preconditions:** Work is in motion and a condition arises that the company cannot resolve on its own, or that requires the CEO's judgment to unblock.

Errors and blocks are not dead ends. Like empty states, every one names a single clear next action. The CEO is never shown a raw stack trace, a failed command, or a guardrail path — they are shown what it means for the outcome and what decision unblocks it.

| Condition | What the CEO is told | The action offered |
|---|---|---|
| **Execution failed or stalled** | "Work on [outcome] could not complete and needs attention." | Retry, re-scope, or open the item for a decision. |
| **Agent needs clarification** | "The company paused on [outcome] and needs a direction from you." | Provide the missing direction; the company resumes. |
| **Task or request blocked** | "[Outcome] is blocked and cannot proceed." | Resolve the blocker or reprioritize. |
| **Guardrail stopped an action** | "A safety rule stopped an unsafe change; the work was held, not shipped." | Review the held work; the unsafe action never executed. |
| **QA No-Go / failed gate** | "Quality validation did not pass for [outcome]." | Send the work back for fixes; nothing ships on a No-Go. |
| **Release held** | "[Outcome] is ready except for [outstanding item]." | Clear the outstanding item or hold the release. |

**Priority of attention.** When multiple conditions exist, the company surfaces them in priority order so the CEO always sees the most consequential first: pending plan approvals, then failed/stalled executions and clarifications, then blocked work, then ready-to-run and active work. The recommendation engine carries this ordering ([`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §7.2).

**What this flow forbids:** surfacing the technical cause to the CEO. Guardrail paths, command failures, and stack traces are recorded in the company's internal audit trail — never shown to the CEO as something to debug. The CEO decides direction; the company handles the mechanics of recovery.

**Exit states:**

- **Resolved** → the CEO's decision unblocks the work and it rejoins its original flow.
- **Re-scoped or dropped** → the outcome is restated (Flow 4) or abandoned.
- **Held safely** → a guardrail-stopped or No-Go item stays held; nothing unsafe or unvalidated ever ships.

**Next flow:** returns to whichever flow was interrupted, typically Progress Monitoring (Flow 6).

The safety floor behind guardrail stops — protected paths and denied commands that hold across every autonomy level — is specified in [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) §8.3. Notification routing for alerts is specified in [`../systems/NOTIFICATION_SYSTEM.md`](../systems/NOTIFICATION_SYSTEM.md) and [`../ceo-experience/PRODUCT_ALERTS.md`](../ceo-experience/PRODUCT_ALERTS.md).

---

## 12. Cross-Flow Rules

These rules hold across every flow above. A wireframe that violates any of them has broken the CEO experience, regardless of how polished the screen is.

**12.1 One primary object per surface.** Each flow step is anchored to a single primary object — an outcome, a plan, a work item, a release. Steps never mix object types at the primary level ([`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) §1.2).

**12.2 No implementation vocabulary, ever.** Across all nine flows, no step exposes branches, pull request numbers, CI status, file paths, diffs, deployment commands, or environment names. If one appears, the flow is wrong.

**12.3 Every empty and error state names the next action.** No flow shows an inert "nothing here" or a raw failure. Each names the single thing the company is waiting for the CEO to do, and offers the control to do it.

**12.4 The CEO's input is always an outcome or a decision.** Across all flows, the CEO only ever (a) states a goal, (b) approves/rejects/requests changes, (c) browses, or (d) configures. No flow asks for a fifth kind of input.

**12.5 Gates are governed by autonomy, not by the flow.** The presence and placement of approval gates is a function of the autonomy level, applied consistently whether work was started manually or by the company's own scheduler. A flow does not hard-code a gate; it inherits it from posture.

**12.6 Quality gates are non-negotiable.** No flow offers a path to ship without a passing review and QA. Autonomy can remove the CEO's *waiting*, never the *gates*.

**12.7 Status is framed as accomplishment, decision-needed, or current state.** Never as a log of engineering steps. Outcomes in, outcomes out.

---

## 13. Relationship to Other Documents

This document owns the **flow-level UX** — the sequenced journeys a CEO travels and the system responses at each step. It is the bridge between the product's models and its wireframes. Where it overlaps with the documents below, they own the model and this document owns the path through it.

- [`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) — product scope, personas, V1 features (F-01…F-10), and the canonical Primary User Journey (§10) these flows make concrete.
- [`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) — where every surface in these flows lives, and the rule that implementation vocabulary never reaches the CEO.
- [`../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) — the experiential contract: interaction modes, approval moments, decision moments, and the authoritative autonomy matrix. Owns Flow 7's model.
- [`../ceo-experience/FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md) — the first-run journey in depth, including empty states and success criteria. Owns Flows 1–3's models.
- [`../ceo-experience/COMPANY_DASHBOARD.md`](../ceo-experience/COMPANY_DASHBOARD.md) and [`../ceo-experience/COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md) — the monitoring surfaces Flow 6 traverses.
- [`../ceo-experience/PRODUCT_ALERTS.md`](../ceo-experience/PRODUCT_ALERTS.md) — how approval and attention alerts reach the CEO across Flows 7 and 9.
- [`../systems/PLANNING_SYSTEM.md`](../systems/PLANNING_SYSTEM.md), [`../systems/APPROVAL_SYSTEM.md`](../systems/APPROVAL_SYSTEM.md), [`../systems/WORK_ITEM_SYSTEM.md`](../systems/WORK_ITEM_SYSTEM.md), [`../systems/NOTIFICATION_SYSTEM.md`](../systems/NOTIFICATION_SYSTEM.md) — the systems that back planning, approvals, work tracking, and alerts.
- [`../sops/NEW_FEATURE.md`](../sops/NEW_FEATURE.md), [`../sops/RELEASE.md`](../sops/RELEASE.md), [`../sops/ROLLBACK.md`](../sops/ROLLBACK.md) — the company's execution procedures behind Flows 5, 8, and 9.
- [`../architecture/COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md) — the behavioral contract of autonomy and the work lifecycle every recurring flow rides on.
