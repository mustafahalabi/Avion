# First Use Experience — Engineering OS

**Status:** Approved  
**Version:** 1.0  
**Owner:** Product Manager  
**Last Updated:** 2026-06-29  

This document defines what a new user experiences the first time they enter Engineering OS — from account creation through the moment their company begins its first piece of work. It is a product experience specification, not a frontend build sheet. It defines the journey, the feeling it must produce, the decisions the user makes, the empty states they encounter, and the understanding they must reach before any work begins.

The governing intent is simple and non-negotiable: first use must feel like **arriving at a company you already own and run** — not like configuring a tool. Every screen, default, and word choice in the first session serves that one impression.

Where this document describes behavior, it distinguishes what the platform implements **today** from what is **designed but not yet built**. Inventing capability that does not exist is a hard project violation; the implementation status section makes the line explicit.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Principles of First Use](#2-principles-of-first-use)
3. [The First User Journey](#3-the-first-user-journey)
4. [Account Creation and Authentication](#4-account-creation-and-authentication)
5. [Company Creation](#5-company-creation)
6. [Company Style — Autonomy Selection](#6-company-style--autonomy-selection)
7. [Company Style — Culture Selection](#7-company-style--culture-selection)
8. [Repository Onboarding Entry Point](#8-repository-onboarding-entry-point)
9. [Meeting the Team — Initial Employee Introduction](#9-meeting-the-team--initial-employee-introduction)
10. [The First Project Path](#10-the-first-project-path)
11. [Empty States](#11-empty-states)
12. [What Must Be Understood Before First Work Begins](#12-what-must-be-understood-before-first-work-begins)
13. [Success Criteria](#13-success-criteria)
14. [Implementation Status — Today vs. Designed](#14-implementation-status--today-vs-designed)
15. [Relationship to Other Documents](#15-relationship-to-other-documents)

---

## 1. Purpose

First use is the most important moment in the product. It is where the user decides what Engineering OS *is*. If the first session feels like a SaaS setup form, the user concludes they have bought a project-management tool and will use it like one. If the first session feels like walking into a staffed engineering office, the user becomes a CEO — and the entire value proposition follows.

This document exists to:

- Define the canonical first-use journey from sign-up to first work.
- Specify the two configuration decisions the user makes — autonomy and culture — and how they are framed.
- Specify how a repository is connected and what the user is told about it.
- Define how the company introduces its employees so the user feels staffed, not configured.
- Define the empty states that carry the experience when there is nothing to show yet.
- State the understanding a user must reach before the company can do meaningful work on their behalf.

First use is owned by Product. It draws on the organizational model defined in [`../architecture/COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md), the navigation model in [`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md), and the canonical journey in [`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) (§10, Primary User Journey). This document does not redefine those models; it specifies the first contact with them.

---

## 2. Principles of First Use

These principles govern every decision in the first session. When they conflict, the earlier principle wins.

**2.1 The user is a CEO from the first screen.**  
The product never addresses the user as an operator, an admin, or a "user." The greeting is "CEO." The company is "yours." Employees are "standing by." The framing is established before any configuration is requested.

**2.2 Two decisions, not twenty.**  
A new company requires exactly two configuration choices: how much autonomy the company has, and what culture it operates under. Everything else is pre-staffed. The onboarding screen states this plainly: "Two choices. Your company handles everything else." First use must never present a settings matrix.

**2.3 The company exists before it is configured.**  
The user does not assemble a company. The company — departments, roles, employees, memory — is created the instant the user arrives. Configuration adjusts a company that already exists; it does not build one.

**2.4 Defaults are opinions, not blanks.**  
Every choice ships with a recommended default (Assist autonomy, Startup culture). The defaults are marked and chosen so a user who clicks through without deciding still gets a sensible, safe company. First use must be completable by accepting defaults.

**2.5 Nothing is required to feel staffed.**  
A user who connects no repository and submits no request must still feel they have a company. The roster, the departments, and the "standing by" framing carry the experience through every empty state.

**2.6 Empty states sell the next action.**  
There is no inert empty screen in first use. Every empty state names the single next thing the company is waiting for the CEO to do, and offers the button to do it.

**2.7 No implementation vocabulary reaches the user.**  
Branches, pull requests, CI, file paths, and provider tokens never appear in the first-use narrative. The user connects "a repository," meets "their team," and submits "a request." The runtime is invisible, per [`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) §2.

---

## 3. The First User Journey

The canonical first session has five stages. The first three are mandatory and complete in minutes; the last two begin the company's working life.

| Stage | What happens | User decision | Outcome |
|---|---|---|---|
| 1. Enter | Account creation and authentication | Credentials only | Authenticated user |
| 2. Receive the company | A fully staffed company is created automatically | None | Company with departments, roster, and memory |
| 3. Set the style | Choose autonomy and culture | Two choices (defaults available) | Company configured to behave the way the CEO wants |
| 4. Connect the work | Connect a repository (optional, skippable) | Connect or skip | Codebase linked, or deferred |
| 5. Put it in motion | Submit the first request | State one goal | A plan is drafted for review |

Two onboarding surfaces implement stages 2–4 today (see §14): a single-screen **onboarding form** and a multi-step **setup wizard**. Both reach the same end state — a configured company on the dashboard — and both treat repository connection as optional. The remainder of this document describes the experience independent of which surface a given build presents.

The journey is intentionally short. Time-to-first-feature is a tracked experience metric ([`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) §15), targeted at under 24 hours; the first session itself should take only a few minutes before the company can begin.

---

## 4. Account Creation and Authentication

The user arrives, creates an account, and authenticates. This stage carries no company concepts — it is identity only, and it is deliberately thin so the user reaches their company quickly.

What the user experiences:

- A sign-up surface for new accounts and a sign-in surface for returning ones.
- No company questions, no repository questions, no role questions at this stage. Identity is separated from company setup so the first company-facing screen is the company itself, not a form.

What the user must understand at this stage: **only that they are creating their own account.** No engineering concepts are introduced yet. The CEO framing begins at the next screen, when the company appears.

---

## 5. Company Creation

The defining property of first use: **the company is created for the user, not by the user.**

The instant an authenticated user reaches onboarding without an existing company, Engineering OS provisions a complete organization in a single atomic step. The user does nothing to cause this beyond arriving. The created company includes, from the first moment:

- **Five departments** — Executive, Product, Engineering, Quality, and Operations — each with a stated mission.
- **A full V1 employee roster** — fourteen employees seeded across those departments, each with a name, a role, a one-line mission, and stated responsibilities (the full roster is detailed in §9).
- **A reporting hierarchy** — every employee except the CTO reports to a manager, so the org chart is real, not flat.
- **A starting memory** — a set of seeded company memory records (Company, Architecture, Product, Security, and Operations memory) so the organization has knowledge scaffolding from day one.
- **Default settings** — Assist autonomy and Startup culture, ready to be confirmed or changed.

The company is given a placeholder name ("My Company") which the user renames during setup. From the user's perspective, they did not build any of this. They arrived, and a company was waiting.

This is the structural payoff of the product principle that *the company, not the AI, is the product* ([`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) §7.2). The user never sees an "add your first employee" flow, because a real company does not start empty.

> **Understanding to reach:** *I did not assemble this team. I hired a company, and it is already staffed.*

---

## 6. Company Style — Autonomy Selection

The first of the two configuration decisions is **autonomy** — how much authority the company has to act without the CEO's approval. This is the single most consequential setting in the product, because it determines where the CEO stands in every future workflow.

The user chooses one of four levels. The framing is in terms of *what the company does* and *where the CEO is asked to approve* — never in terms of internal mechanics.

| Level | What the company does | Where the CEO approves | First-use guidance |
|---|---|---|---|
| **Manual** | Plans and recommends only | Every action, before it happens | Maximum control; highest approval volume |
| **Assist** *(default)* | Implements the work | Before any code merges | Recommended starting point — see the work, keep the merge gate |
| **Delegate** | Completes features end to end | Before deployment | For users who trust implementation and want to gate releases |
| **Autonomous** | Operates independently | Receives summaries | For mature, trusted companies |

**Assist is the recommended default** and is marked as such. It gives a brand-new CEO the experience of a company that does real work while preserving a clear approval gate before anything reaches their codebase — the right balance of visibility and safety for a first session.

Autonomy is not a one-time decision locked at onboarding. It is a company setting the CEO can raise or lower at any time from company settings, and trust is expected to grow with use. First use only needs to establish a starting posture, not a permanent one.

The autonomy level chosen here is enforced throughout the runtime: it is the single switch that decides whether a completed piece of work pauses for CEO review or advances on its own. The behavioral contract behind each level is defined in [`../architecture/COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md); first use is where the CEO sets it for the first time.

> **Understanding to reach:** *I decide how much the company does on its own. I can change my mind later.*

---

## 7. Company Style — Culture Selection

The second configuration decision is **culture** — the values and priorities every employee operates under. Where autonomy decides *how much the company acts*, culture decides *how the company makes trade-offs* when it does.

The user chooses one of four profiles:

| Profile | What it optimizes for |
|---|---|
| **Startup** *(default)* | Move fast, accept calculated technical debt, optimize for speed and learning |
| **Enterprise** | Extensive reviews, security-first, documentation required, coverage enforced |
| **Design First** | Premium user experience, accessibility, motion, and typography |
| **Performance First** | Minimal resource usage, fast loading, lean architecture |

**Startup is the recommended default**, appropriate for the early-stage founders who are the primary persona ([`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) §8).

Culture is framed as a single high-level choice precisely so the CEO never configures dozens of individual standards. A startup's definition of "done" differs from an enterprise's; the culture profile encodes that difference once, and every employee inherits it. Like autonomy, culture is adjustable later from company settings.

Together, autonomy and culture are the *entire* required configuration of a new company. The onboarding surface presents them as a single short step and states explicitly that these two choices are all the company needs.

> **Understanding to reach:** *These two settings shape every decision my team makes — and they are the only setup the company asks of me.*

---

## 8. Repository Onboarding Entry Point

Engineering OS works on the CEO's existing codebase. First use therefore offers a clear, early entry point to **connect a repository** — but treats it as optional, because the company must feel real even before any code is linked.

What first use provides:

- A prominent "connect a repository" step, framed as: *link a GitHub repository so your company can analyze, plan, and implement changes directly in your codebase.*
- A repository connection surface that captures the repository's identity and high-level shape (name, URL, primary language, stack, key dependencies, and important files).
- An explicit **"Skip for now"** path. A user who is not ready to connect code can complete onboarding and connect later.
- A persistent reminder afterward: while no repository is connected, the dashboard shows a setup banner inviting the CEO to finish connecting their codebase.

Repository connection is the bridge between the company and real work. Until a repository is connected, the company can be met and configured but has nothing to build against. This is why the dashboard keeps surfacing the connect-a-repository prompt until the connection exists, and why the empty work board points the CEO toward it (§11).

What the CEO is **not** asked to do at this stage: manage branches, configure CI, install workflows, or reason about tokens and permissions. Those belong to the company, not the CEO ([`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) §2). The CEO connects "a repository"; the company handles everything underneath.

Once a repository is connected, the company's understanding of it — architecture, frameworks, dependencies, patterns, and known risk areas — is what later work is planned against. The depth of that repository intelligence is specified in the architecture documents and is out of scope for this first-use document; here, the only requirement is that connecting a repository is easy, optional, and framed as handing the company the keys to the codebase.

> **Understanding to reach:** *Connecting my repository is how I give the company something real to build. I can do it now or later, and I never have to manage the plumbing.*

---

## 9. Meeting the Team — Initial Employee Introduction

The emotional core of first use is the moment the CEO **meets their team.** After configuration, the user is invited to do exactly that — and the company's roster is presented as people with roles, missions, and reporting lines, not as a feature list.

The seeded V1 roster the CEO meets:

| Department | Employees |
|---|---|
| **Executive** | CTO |
| **Product** | Product Manager, Technical Writer |
| **Engineering** | Tech Lead, Frontend Engineer, Backend Engineer, AI Engineer, Infrastructure Engineer |
| **Quality** | Reviewer, QA Engineer, Security Engineer |
| **Operations** | DevOps Engineer, Release Manager, Monitoring Engineer |

Each employee carries, from the moment the company is created:

- **A role and department** — so the CEO sees a structured organization, not a pool of generic agents.
- **A one-line mission** — what this employee owns. (For example, the Tech Lead's mission is to break approved work into tasks, assign them to the right engineers, and drive them to done at high quality.)
- **Responsibilities** — the concrete duties the employee is accountable for.
- **A reporting line** — who they report to, so the org chart is navigable.

The introduction reinforces the specialist principle ([`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) §7.6): the CEO has a Reviewer whose job is review, a Security Engineer whose job is security, a QA Engineer whose job is validation. These are roles a small team could never afford to hire — and the CEO has all of them on day one.

The completion screen of setup makes the intent explicit: the company is ready, the team is standing by, and the natural next action is to meet them and then put them to work. The "Meet the team" path leads into the Company section, where the full roster and each employee's detail are browsable per [`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) §11.

> **Understanding to reach:** *These are my employees. Each one owns something. I direct them; I do not do their jobs.*

---

## 10. The First Project Path

First use ends — and the company's working life begins — when the CEO submits their first request. This is the product's defining interaction: the CEO states an outcome, and the company turns it into a plan.

The path:

1. **The CEO states one goal.** The request is captured as a title and a plain-language description answering *what should be built and why*. The CEO may optionally associate it with a connected repository and set a priority. No task breakdown, no assignment, no technical detail is asked of the CEO — only the outcome they want.

   The placeholder text models the right altitude of input: an outcome like *"Build repository intelligence to understand any codebase,"* not a task like *"add a function to parse package.json."*

2. **The company drafts a plan.** Submitting a request produces a reviewable planning draft — *not* live work. The submission surface states this directly: a planning draft is generated, and no work records are created yet. This protects the CEO: stating a goal is safe and reversible, because nothing is built until the plan is reviewed.

3. **The CEO reviews and approves the plan.** The draft decomposes the outcome into the structure the company will execute — projects, features, tasks, quality gates, and a release path. The CEO approves, adjusts, or rejects. Approval is what turns a draft into real, tracked work records.

4. **The company goes to work.** Once approved, work flows through the company's standard lifecycle — implementation, review, QA, and release — with CEO approval inserted at the points the chosen autonomy level requires (§6).

The critical first-use property is that **the CEO's only input is the goal.** Every other product in the category requires the user to create a task, assign it, and specify how. Engineering OS requires only the outcome ([`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) §12, F-02). The first request is where the CEO experiences that difference for the first time.

> **Understanding to reach:** *I state outcomes. The company produces a plan I approve. I never write the tasks myself.*

---

## 11. Empty States

Because a new company has no history, the first session is full of empty states. In Engineering OS, empty states are not dead ends — each one is an invitation that names the single next action and offers it. This is how the experience stays alive before any work exists.

The empty states a new CEO encounters, and what each must do:

| Surface | Empty condition | What it shows | The action it offers |
|---|---|---|---|
| **Dashboard — setup banner** | No repository connected | A reminder to finish company setup | Complete setup / connect a repository |
| **Dashboard — greeting** | New company | "Good [morning], CEO. [Company] · Ready for your first request." | Sets expectation, no dead air |
| **Dashboard — getting started** | No active requests yet | "Your company is ready. N employees are standing by." | Submit first request / Meet the team |
| **Work — projects** | No projects yet | "No projects yet" | Create your first project |
| **Pending approvals** | Nothing awaiting approval | (Hidden) | Appears only when a decision is genuinely pending |

Empty-state rules for first use:

- **Every empty state names the next action.** No first-use screen shows "nothing here" without telling the CEO what the company is waiting for.
- **The roster is never empty.** Because the company is fully staffed at creation, the Company section shows a full team even on day one. There is no "no employees" state in normal first use.
- **Approval and notification surfaces stay quiet until they matter.** The CEO is not shown a fabricated to-do list. Pending-approval prompts appear only when a real checkpoint is waiting, so the first non-empty approval the CEO sees is always meaningful.
- **The dashboard reflects reality.** Active-work and recent-completion areas are genuinely empty until the first request runs, and they say so plainly rather than showing placeholder activity.

The guiding rule: a new CEO should never feel lost. At every point in the first session there is one obvious next step, surfaced by the empty state in front of them.

---

## 12. What Must Be Understood Before First Work Begins

First use is complete not when configuration is saved, but when the CEO holds the mental model the rest of the product depends on. The experience is designed to instill these understandings, in order:

1. **I am the CEO.** I direct outcomes; I do not perform implementation.
2. **I have a company, not a tool.** It is staffed, structured, and standing by — I did not assemble it.
3. **Two settings shape its behavior.** Autonomy decides how much it acts without me; culture decides how it makes trade-offs. Both are changeable.
4. **My employees are specialists.** Each owns a domain. I trust the role, not a single output.
5. **Connecting a repository gives the company real work to do.** It is optional to start, but it is the bridge to building anything.
6. **I state goals; the company plans.** A request produces a draft I approve. Nothing is built until I approve it.
7. **Approval is where I stay in control.** My autonomy level decides where the company pauses for me.

If a user finishes the first session without these understandings, the first-use experience has failed — regardless of how many settings were saved. The success criteria in §13 are the observable proxies for these understandings.

This list also defines the boundary of first use. Deep concepts — memory accumulation, company health, the full work hierarchy, release and incident flows — are *not* required before first work. They are discovered through use and are documented elsewhere ([`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md), [`../architecture/COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md)). First use deliberately teaches only what is needed to start.

---

## 13. Success Criteria

First use is successful when the following are true. These are written to be observable, not aspirational.

**Completion criteria**

- A new user reaches a configured company on the dashboard in a single short session, accepting defaults if they wish.
- The user makes at most two real decisions (autonomy, culture) plus naming the company. No other configuration is required to finish.
- The user can complete onboarding **without** connecting a repository, and is clearly invited to connect one later.

**Comprehension criteria**

- The user can state, in their own words, that they are the CEO of a staffed company.
- The user understands that autonomy and culture are adjustable and what each controls.
- The user understands that submitting a request produces a plan they approve, not immediate code.

**Experience criteria**

- At no point in the first session is the user shown an inert empty screen with no next action.
- At no point is the user asked to make an implementation decision (branches, CI, file paths, tokens).
- The roster is populated and browsable from the first session; the company never appears empty of people.

**Activation criterion**

- The first session ends with the user positioned at the single next action — connect a repository, or submit their first request — and that action is one click away from the dashboard.

These criteria align with the product's experience metrics — Time-to-First-Feature and a declining CEO-actions-per-feature trend ([`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) §15). First use is the front door to both.

---

## 14. Implementation Status — Today vs. Designed

This section separates what the platform implements **today** from what is **designed but not yet built**, per project rules. It is the authoritative line; the narrative above describes the intended experience, and the table below states how much of it currently exists.

**Implemented today**

| Capability | Status | Notes |
|---|---|---|
| Account creation and authentication | ✅ Implemented | Sign-up / sign-in via the auth provider; the legacy register route redirects into sign-up. |
| Automatic company creation on first arrival | ✅ Implemented | A company is provisioned atomically when an authenticated user has none. |
| Full org seeding (departments, roles, roster, hierarchy, starting memory) | ✅ Implemented | Five departments, fourteen roles and employees with reporting lines, and five seeded company memory records. |
| Autonomy selection (Manual / Assist / Delegate / Autonomous) | ✅ Implemented | Assist is the marked default; persisted to company settings. |
| Culture selection (Startup / Enterprise / Design First / Performance First) | ✅ Implemented | Startup is the marked default; persisted to company settings. |
| Single-screen onboarding form | ✅ Implemented | Captures company name, autonomy, and culture; lands on the dashboard. |
| Multi-step setup wizard (welcome → style → repository → done) | ✅ Implemented | Parallel surface; includes the skippable repository step and a "meet your team" finish. |
| Repository connection entry point | ✅ Implemented | Collects repository identity and high-level shape; "Skip for now" supported. |
| Dashboard setup banner while no repository is connected | ✅ Implemented | Persistent prompt to complete setup. |
| New-company dashboard getting-started and empty states | ✅ Implemented | "Standing by," "Submit first request," "Meet the team," and empty work/project states. |
| First request → reviewable planning draft (no work records yet) | ✅ Implemented | Goal captured as title + description, optional repository and priority. |
| Settings to change autonomy and culture after onboarding | ✅ Implemented | Both remain editable in company settings. |

**Designed / planned (not yet built as a unified first-run)**

| Capability | Status | Notes |
|---|---|---|
| A single, guided, consolidated first-run flow | ◻ Designed | Two onboarding surfaces exist today; a unified guided onboarding is a named roadmap item ("Onboarding and Setup"). |
| Automatic repository analysis presented for CEO review during onboarding | ◻ Designed | Repository intelligence exists in the platform, but first-run does not yet present an architecture summary for confirmation as part of onboarding. |
| Recommended-autonomy guidance based on company maturity | ◻ Designed | Defaults are marked today; adaptive recommendations are future. |
| In-product employee "introduction" moment beyond the roster pages | ◻ Designed | Employees are browsable today; a richer first-meeting introduction is a design goal. |
| Greenfield (no existing repository) first-run path | ◻ Open question | Tracked as an open product question; V1 assumes an existing codebase. |
| Real-AI planning of the first request | ◻ Gated | Plan generation is deterministic today by deliberate policy until the Engineering OS Specification is written; real-AI planning is gated behind it. |

The defining gap is presentation, not capability: the building blocks of a great first run exist, but they are not yet assembled into one guided, opinionated first-run experience. Closing that gap is the work this document specifies the target for.

---

## 15. Relationship to Other Documents

- [`../product/PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) — defines the product, the personas, and the canonical Primary User Journey (§10) that this document specifies the first contact with. First use must satisfy the experience metrics in §15 there.
- [`../architecture/INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) — defines the navigation model and the CEO-facing object hierarchy the user enters after onboarding. First use must never violate its rule that implementation vocabulary stays out of the CEO's view.
- [`../architecture/COMPANY_RUNTIME.md`](../architecture/COMPANY_RUNTIME.md) — defines the behavioral contract of autonomy levels and the work lifecycle that the first request enters.
- [`../sops/NEW_FEATURE.md`](../sops/NEW_FEATURE.md) — the procedure the first request follows once its plan is approved.

First use owns one thing exclusively: the journey from sign-up to first work, and the understanding the CEO must reach along the way. Where this document and the architecture documents overlap, the architecture documents own the models and this document owns the first experience of them.
