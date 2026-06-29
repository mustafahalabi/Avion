# Navigation and Layout System — Engineering OS

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

This document defines the **navigation and layout system** of Engineering OS: the app shell, how the product is structured into navigable regions, how the CEO moves between them, and the layout archetypes that every screen is composed from. It is the design layer that sits between the product's information architecture and its eventual frontend implementation.

It is a **design specification, not a frontend build sheet.** It prescribes structure, behavior, and intent — what regions exist, how they relate, how navigation behaves, and what each layout archetype must contain. It deliberately avoids framework-specific instruction: no components, routes, CSS, or rendering strategy. Any compliant frontend, in any stack, should be able to implement this document.

This document is downstream of [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md), which defines *what information exists and how it is grouped*. This document defines *how that information is framed in space and traversed*. Where the two touch, the Information Architecture is authoritative for the model and this document is authoritative for the shell and layout. The surface-level content of specific screens is owned by the CEO-experience documents (the Dashboard, Timeline, and First Use documents), which this document references rather than restates.

Where it describes behavior, it distinguishes **Implemented today** (real, traceable software in the current build) from **Designed / planned** (specified intent not yet built). It never claims capability that does not exist.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Layout Principles](#2-layout-principles)
3. [The App Shell](#3-the-app-shell)
4. [Primary Navigation](#4-primary-navigation)
5. [Secondary Navigation](#5-secondary-navigation)
6. [Company Switcher Behavior](#6-company-switcher-behavior)
7. [The Layout Archetypes](#7-the-layout-archetypes)
8. [Dashboard Layout](#8-dashboard-layout)
9. [Detail Page Layout](#9-detail-page-layout)
10. [Timeline Layout](#10-timeline-layout)
11. [Conversation and Outcome-Input Layout](#11-conversation-and-outcome-input-layout)
12. [Responsive Behavior Principles](#12-responsive-behavior-principles)
13. [Empty and Loading States](#13-empty-and-loading-states)
14. [Status, Breadcrumbs, and Wayfinding](#14-status-breadcrumbs-and-wayfinding)
15. [Implementation Status](#15-implementation-status)
16. [Related Documents](#16-related-documents)

---

## 1. Purpose and Scope

A product that wants the CEO to feel like they walked into a staffed engineering company cannot assemble its screens ad hoc. The navigation and the layout *are* the company's building — its lobby, its floors, the way someone finds their way around it. If the building is laid out like a database admin panel, no amount of organizational language on the screens will rescue the feeling.

This document exists to:

- Define a single **app shell** every authenticated surface lives inside, so the product feels like one coherent place rather than a collection of pages.
- Fix the **primary and secondary navigation** model so the CEO always knows where they are and how to get anywhere.
- Specify **company switching** so a CEO who owns more than one company moves between them cleanly and without ambiguity.
- Establish a small, reusable set of **layout archetypes** — dashboard, detail, timeline, conversation — so that every screen is a known shape rather than a bespoke one.
- State the **responsive, empty, and loading** principles that keep the experience whole across devices and across every point in a company's lifecycle.

### 1.1 What is out of scope

This document does **not** define:

- Visual design — color, type, spacing, iconography, motion. Those belong to a visual design system.
- The content of specific screens — the Dashboard's sections, the Timeline's events, the Inbox's items. Those are owned by the CEO-experience documents listed in §16.
- The data model — objects, fields, relationships. Those are owned by [`DOMAIN_MODEL.md`](../architecture/DOMAIN_MODEL.md).
- Routing, rendering, component, or framework decisions. Those belong to the frontend implementation and must trace back to this document, not redefine it.

### 1.2 The one governing constraint

Every decision in this document answers to a single rule, inherited from [`INFORMATION_ARCHITECTURE.md` §2](../architecture/INFORMATION_ARCHITECTURE.md#2-navigation-philosophy): **the product is organized around the company, not around tools.** Navigation maps to how a CEO thinks about their organization — *the company, the work, the memory, what needs me* — never to a software product tree of "projects, settings, integrations." If a navigation label, a layout region, or a switcher ever reads like a developer tool instead of a company, this document has been violated.

---

## 2. Layout Principles

These principles govern every layout and navigation decision. When they conflict, earlier ones win.

**2.1 One shell, one company, one place.** Everything the CEO sees after authentication lives inside a single persistent shell scoped to exactly one active company. The shell never disappears mid-session; navigation swaps the content region, not the frame. The CEO should never feel they have "left" the company to visit a different application.

**2.2 One primary object per screen.** Every content view is anchored to a single primary object — a dashboard, a project, an employee, a release. Mixing primary object types in one view creates navigational ambiguity. This is the layout expression of [`INFORMATION_ARCHITECTURE.md` §1.2](../architecture/INFORMATION_ARCHITECTURE.md#1-information-architecture-principles).

**2.3 Breadth before depth.** The default view of any section is its summary. Detail is reached by an explicit act of navigation, never forced on arrival. Layouts open at the highest useful altitude and let the CEO descend.

**2.4 Position encodes priority.** Reading order is attention order. The most decision-critical content occupies the top and the start of the reading flow; informational content follows. A layout that scatters decisions among status has failed to rank.

**2.5 The frame answers "where am I, and what needs me?" at all times.** Persistent shell elements — the primary navigation, the active-company indicator, the attention counts (notification bell, Inbox badge) — are visible from every surface, so situational awareness never depends on which screen the CEO happens to be on.

**2.6 Never expose the machine in chrome.** No shell element, navigation label, breadcrumb, or layout region ever surfaces a branch name, pull-request number, CI status, file path, diff, deployment command, or environment name. This prohibition (from [`INFORMATION_ARCHITECTURE.md` §2](../architecture/INFORMATION_ARCHITECTURE.md#2-navigation-philosophy)) applies to the layout system itself, not only to screen content.

**2.7 Every state is designed.** Empty, loading, and error are first-class layouts, not afterthoughts. A region with nothing to show resolves to an intentional state — never a blank rectangle and never a broken frame.

**2.8 Layouts are archetypes, not bespoke.** Each screen is an instance of one of a small set of layout archetypes (§7). Consistency of shape is what lets the CEO learn the product once and navigate all of it. A new screen adopts an existing archetype unless there is a documented reason it cannot.

---

## 3. The App Shell

The **app shell** is the persistent frame that wraps every authenticated surface. It is the company's building. It is composed of three durable regions plus the swappable content region.

### 3.1 Shell regions

| Region | Role | Persistence |
|---|---|---|
| **Identity rail** | Holds the active-company indicator / company switcher, and the CEO's own account affordance. Anchors "whose company am I in." | Persistent |
| **Primary navigation** | The five top-level destinations (§4). Anchors "where in the company am I." | Persistent |
| **Utility region** | Global affordances that are valid from anywhere: global search, the notification bell with its unread count, the Inbox badge, and the always-available "submit a request" entry point. | Persistent |
| **Content region** | The active surface. This is the only region navigation replaces. | Swappable |

The first three regions form the **chrome**: they remain stable as the CEO moves through the product, providing continuous orientation. Only the content region changes.

### 3.2 Shell invariants

- **The shell is always scoped to one company.** Every object the content region shows belongs to the active company. There is no cross-company view inside the content region; switching companies is an explicit act (§6).
- **Attention is always visible.** The notification bell's unread count and the Inbox badge's pending-approval count live in the chrome and are readable from every surface, so the CEO learns that something needs them without being on the Dashboard. *(Implemented today: the sidebar notification bell and Inbox badge counts — see [`COMPANY_DASHBOARD.md` §10.2](../ceo-experience/COMPANY_DASHBOARD.md#10-notifications).)*
- **Submitting an outcome is always one act away.** The CEO's most fundamental interaction — stating a new outcome — is reachable from the chrome on every screen, never buried inside a section ([`INFORMATION_ARCHITECTURE.md` §21](../architecture/INFORMATION_ARCHITECTURE.md#21-global-navigation-concepts)).
- **The shell never leaks implementation.** Per §2.6, no chrome element exposes engineering mechanics.

### 3.3 What the shell is not

The shell is not a workspace and not a toolbar. It carries orientation and global affordances only. Work — reviewing a plan, approving a checkpoint, reading a project — happens in the content region, never in the chrome.

---

## 4. Primary Navigation

Primary navigation is the spine of the product. It contains exactly **five** destinations, mapping one-to-one to the CEO's mental model of their company as defined in [`INFORMATION_ARCHITECTURE.md` §6](../architecture/INFORMATION_ARCHITECTURE.md#6-primary-navigation).

| # | Destination | The CEO's question it answers | Anchored object |
|---|---|---|---|
| 1 | **Dashboard** | "What is happening right now, and what needs me?" | Company runtime state |
| 2 | **Company** | "Who works here, and how is the organization doing?" | Departments and employees |
| 3 | **Work** | "What are we building, and what has shipped?" | Initiatives, projects, releases |
| 4 | **Memory** | "What do we know and what have we decided?" | Memory and decision records |
| 5 | **Inbox** | "What requires my attention?" | Approvals, notifications, conversations |

### 4.1 Rules of primary navigation

- **Exactly five, fixed.** The set does not grow per company or per feature. New capabilities slot *into* one of the five as secondary navigation, never as a sixth primary destination. Five is the load a CEO can hold without a manual.
- **Dashboard is home.** It is the default landing surface after authentication and after a company switch ([`INFORMATION_ARCHITECTURE.md` §6](../architecture/INFORMATION_ARCHITECTURE.md#6-primary-navigation)).
- **Company language only.** Labels are "Company," "Work," "Memory" — never "Users," "Projects & Tasks," "Database." The CEO navigates an organization, not a schema (§2.1 of the IA's navigation philosophy).
- **The active destination is always indicated.** The current primary destination is visibly marked, so "where am I" is answerable from the chrome alone.
- **Settings and Timeline are not primary.** Settings lives inside **Company**; Timeline lives inside **Work** (and is referenced from the Dashboard). Elevating either to the spine would dilute the five-question model.

### 4.2 Why these five

The five destinations are not arbitrary product areas — they are the four things a CEO holds in mind about any organization (*the company, the work, the memory, what needs me*) plus the live present (the Dashboard) that ties them together. This is the load-bearing reason the spine is stable: it reflects the CEO's cognition, not the application's surface count.

---

## 5. Secondary Navigation

Secondary navigation appears **within** a primary destination and lists that destination's subsections. It is contextual: it changes when the primary destination changes, and it is absent or minimal on surfaces that have a single view (such as the Dashboard).

The subsection sets are owned by [`INFORMATION_ARCHITECTURE.md` §7](../architecture/INFORMATION_ARCHITECTURE.md#7-secondary-navigation). The layout system's responsibility is how they behave, not what they contain.

### 5.1 Secondary-navigation rules

- **Secondary is scoped to its parent.** It never lists destinations from a different primary section. Crossing sections is done through the primary spine or through object links (§14.3), not through secondary navigation.
- **One level of secondary, then drill-down.** A primary destination has at most one persistent level of secondary navigation. Deeper structure is reached by selecting an object and entering a detail layout (§9), not by nesting a third navigation tier in the chrome. Depth is earned by navigating into objects, not by stacking menus.
- **Secondary reflects state where it is cheap and honest.** A subsection may carry a count or status hint when that hint is trustworthy and useful (for example, an Inbox subsection indicating pending approvals). It must never carry a fabricated or speculative indicator.
- **The active subsection is indicated**, mirroring the primary-destination rule, so the CEO's position is unambiguous at both tiers.

### 5.2 Example: secondary navigation within Work

Within **Work**, secondary navigation exposes Active Features, Projects, Repository, Sprints, Milestones, Timeline, and Incidents ([`INFORMATION_ARCHITECTURE.md` §7](../architecture/INFORMATION_ARCHITECTURE.md#7-secondary-navigation)). Selecting *Projects* lists projects; selecting a single project enters the **detail layout** (§9), where further structure (Summary, Work, Review, QA, Release, Memory, History) is presented as in-page sections — not as additional chrome-level navigation.

---

## 6. Company Switcher Behavior

The **company switcher** lives in the identity rail and names the active company. It is the mechanism by which a CEO who owns more than one company moves between them.

### 6.1 The model

- **A company is a complete tenant.** Every object — employees, work, memory, timeline, inbox, settings — belongs to exactly one company ([`INFORMATION_ARCHITECTURE.md` §4](../architecture/INFORMATION_ARCHITECTURE.md#4-company-hierarchy)). There is no shared state across companies.
- **Exactly one company is active at a time.** The entire shell — primary navigation, every subsection, every count, the content region — is scoped to the active company. The switcher is the only control that changes that scope.
- **Switching is a full context swap, not a filter.** Choosing a different company replaces the whole working context. It is not a way to view two companies at once; cross-company aggregation does not exist in the shell.

### 6.2 Switcher behavior

| Behavior | Specification |
|---|---|
| **Display** | The switcher always shows the active company's name (and, where present, its identity mark), so "whose company am I in" is answerable at a glance from the chrome. |
| **Invocation** | Opening the switcher lists the companies the CEO owns or belongs to, with the active one indicated. |
| **On switch** | The shell rescopes to the chosen company and lands on that company's **Dashboard** — the consistent home surface — so the CEO re-orients in the new context rather than landing on an unrelated deep view. |
| **Attention counts** | The notification bell and Inbox badge recompute for the newly active company; they never mix counts across companies. |
| **Single-company case** | When the CEO has exactly one company, the switcher degrades to a passive company indicator (it still names the company; it simply has nothing to switch to). |
| **Create / add** | Adding or creating a company is reachable from the switcher, framed as "found a new company," consistent with the first-use framing in [`FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md). |

### 6.3 Implementation status

**Designed / planned.** V1 is built around a **single company with a single CEO** ([`INFORMATION_ARCHITECTURE.md` V1 Scope](../architecture/INFORMATION_ARCHITECTURE.md#v1-scope); see also the single-CEO constraint referenced in [`COMPANY_DASHBOARD.md` §2](../ceo-experience/COMPANY_DASHBOARD.md#2-primary-user)). In V1 the switcher therefore behaves as the passive company indicator described above. The multi-company switching behavior in §6.2 is the designed target for when a CEO can own more than one company; it is specified here so the identity rail is built to accommodate it from the start, not retrofitted.

---

## 7. The Layout Archetypes

Every content surface in Engineering OS is an instance of one of a small set of **layout archetypes**. Constraining screens to known shapes is what makes the product learnable: the CEO learns four layouts, not forty screens.

| Archetype | Used for | Defining shape | Defined in |
|---|---|---|---|
| **Dashboard** | The single situational-awareness surface | A ranked, top-to-bottom stack of conditional sections | §8 |
| **Detail** | Any single primary object (project, employee, release, memory record) | A header identifying the object + in-page sections for its facets | §9 |
| **Timeline** | Chronological history | A reverse-chronological, grouped event stream with filters | §10 |
| **Conversation / outcome input** | Stating outcomes and reading the company's structured responses | A focused composer + a structured response stream | §11 |

A fifth, implicit shape — the **list** (a collection of objects that each link into a detail layout) — is treated as the entry point to the detail archetype rather than a standalone archetype: a list exists to route the CEO into a single object.

The sections below specify each archetype. Where a CEO-experience document already owns a specific surface's content (the Dashboard and Timeline), this document specifies the **layout contract** and links to that document for the content.

---

## 8. Dashboard Layout

The Dashboard is the product's home and its only pure situational-awareness surface. Its **content** — which sections exist, when each is shown, and what each contains — is owned by [`COMPANY_DASHBOARD.md`](../ceo-experience/COMPANY_DASHBOARD.md). This section specifies its **layout contract**.

### 8.1 Layout contract

- **Single column of ranked sections.** The Dashboard is a vertical stack of sections presented in attention-priority order: blocking decisions first, then the recommended next action, then company vitals, then work needing attention, then work in motion, then history. This ordering is mandated by [`COMPANY_DASHBOARD.md` §5](../ceo-experience/COMPANY_DASHBOARD.md#5-information-hierarchy) and is the layout expression of §2.4 (position encodes priority).
- **Conditional sections collapse, they do not blank.** A section with nothing to show is omitted entirely so the surface stays dense with signal — except where absence would be ambiguous (an established company at rest, an all-idle team), where an intentional empty state is shown instead ([`COMPANY_DASHBOARD.md` §6](../ceo-experience/COMPANY_DASHBOARD.md#6-states-and-empty-states)).
- **Read-and-route, not a workspace.** Each section is a summary that links to the surface where the corresponding action is taken (Inbox, Work, Company). The Dashboard caps per-section item counts and provides a "view all" path rather than rendering unbounded lists — the breadth-first rule (§2.3).
- **Persistent submit affordance.** The "submit a request" entry point is present regardless of company state, consistent with the shell invariant in §3.2.
- **No implementation leakage.** As everywhere, no engineering mechanics appear (§2.6).

### 8.2 Relationship to the recommended next action

The Dashboard's most distinctive section — the single computed **Recommended Next Action** — is positioned near the top precisely because it has already ranked the workspace for the CEO ([`COMPANY_DASHBOARD.md` §11](../ceo-experience/COMPANY_DASHBOARD.md#11-recommended-next-action)). The layout must give it visual primacy among the informational sections beneath it.

---

## 9. Detail Page Layout

The **detail layout** is the workhorse archetype. It renders a single primary object — a project, an employee, a release, a memory record, a review — and everything about it.

### 9.1 Anatomy

A detail page has three layered parts, top to bottom:

| Part | Contents |
|---|---|
| **Object header** | The object's name, its type, its current status (a status indicator), its owner where applicable, and its place in the hierarchy via breadcrumbs (§14.2). The header answers "what am I looking at, and what state is it in" before the CEO reads anything else. |
| **Summary band** | A plain-language statement of what the object is and why it matters, written for a CEO, not an engineer. For a project, this is the "what is this delivering and what state is it in" summary ([`INFORMATION_ARCHITECTURE.md` §12](../architecture/INFORMATION_ARCHITECTURE.md#12-project-structure)). |
| **Facet sections** | The object's facets as in-page sections — for a project: Summary, Feature Brief, Work, Team, Review, QA, Release, Memory, History. These are *sections within the page*, not chrome-level navigation (§5.1). |

### 9.2 Layout rules

- **The header is the anchor.** It is always present and always identifies the object and its status. The CEO can scan only the header and know what the object is and how it is doing.
- **Facets are summaries with drill-down.** Each facet section shows an outcome-level summary and links deeper where depth exists. A project's *Work* facet shows task counts and state, not the raw task list; the task list is reached on drill-down ([`INFORMATION_ARCHITECTURE.md` §12](../architecture/INFORMATION_ARCHITECTURE.md#12-project-structure), [§13](../architecture/INFORMATION_ARCHITECTURE.md#13-task-structure)). This enforces breadth-before-depth (§2.3).
- **Status before detail.** Quality facets (Review, QA, Release) are shown as status first — "approved," "passing," "ready" — and expand to detail only on the CEO's request. The CEO reads outcome status, never raw review findings ([`INFORMATION_ARCHITECTURE.md` §14](../architecture/INFORMATION_ARCHITECTURE.md#14-review-structure)).
- **Relationships are traversable from the page.** Every related object named on a detail page is a link to that object's own detail page (§14.3) — a project links to its feature, a release links to its QA result, a memory record links to its source work item.
- **The same archetype serves every object.** Employee, project, release, memory record, and review detail pages share this header + summary + facets shape, varying only in which facets appear. This is what makes a new object type instantly legible.

### 9.3 The detail layout never asks the CEO an engineering question

A detail page presents outcomes and status. It never renders a diff, a file path, a branch, or a CI panel, and it never asks the CEO to make an implementation decision. If a project's detail page would require the CEO to choose a library or read code to understand it, the layout has failed the governing constraint (§1.2) and the principle in [`EXECUTIVE_USER_EXPERIENCE.md` §2.2](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#2-the-users-role).

---

## 10. Timeline Layout

The **timeline layout** renders the company's history as a chronological stream. Its **content** — which events belong on it, how they are grouped, and how they are framed — is owned by [`COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md). This section specifies its **layout contract**.

### 10.1 Layout contract

- **Reverse-chronological stream.** The newest event is first by default, with the option to reverse order ([`INFORMATION_ARCHITECTURE.md` §18](../architecture/INFORMATION_ARCHITECTURE.md#18-timeline-structure)). The vertical axis is time.
- **Grouped for readability.** Events are visually grouped (for example by day or by the request they belong to) so the stream reads as a narrative, not an undifferentiated log ([`COMPANY_TIMELINE.md` §6](../ceo-experience/COMPANY_TIMELINE.md#6-grouping-and-ordering)).
- **Each entry is a typed, plain-language event with a link.** Every entry states what happened in organizational language and links to the originating work item, so the Timeline is a launch point into detail, not a dead end.
- **Filters are layout affordances, not separate screens.** Filtering by event type, date range, or related employee narrows the same stream in place ([`INFORMATION_ARCHITECTURE.md` §18](../architecture/INFORMATION_ARCHITECTURE.md#18-timeline-structure)) rather than navigating away.
- **Read-only.** The Timeline is a read surface; the CEO does not act from it ([`COMPANY_TIMELINE.md` §1](../ceo-experience/COMPANY_TIMELINE.md#1-purpose)). Actions live in the Inbox; the layout carries no action controls beyond navigating into a referenced object.

### 10.2 The timeline archetype is reusable

The same chronological-stream shape serves any per-object history — a project's *History* facet (§9.1) and an employee's work history are local instances of the timeline archetype, scoped to one object instead of the whole company. Building the archetype once makes every history view consistent.

---

## 11. Conversation and Outcome-Input Layout

The ticket that commissioned this document calls for a "chat layout." It must be specified with care, because Engineering OS is **explicitly not an AI chat interface** and **not a code editor** ([`EXECUTIVE_USER_EXPERIENCE.md` §5.4](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#5-outcome-based-communication), [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md)). The CEO directs a company; they do not prompt a model. The "chat" surface is therefore the **outcome-input and company-conversation** surface — the place the CEO *states outcomes* and *reads the company's structured responses* — not a free-form chatbot.

### 11.1 What this layout is for

| It is for | It is not for |
|---|---|
| Stating a desired outcome in plain language ("Let users reset their password") | Prompting a model or asking it to write code |
| Reading the company's structured response (a plan to approve, a clarifying question, a status) | Open-ended conversational chit-chat with an "assistant" |
| Approving, rejecting, or requesting changes in place | Editing tasks, branches, or files |

### 11.2 Layout contract

- **A focused composer.** The CEO's input is an outcome composer: a plain-language field for the desired result, plus light structured affordances (priority, optional target repository) that match the real outcome record ([`EXECUTIVE_USER_EXPERIENCE.md` §3.1](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#3-what-the-user-manages)). The composer never asks for implementation detail.
- **A structured response stream.** The company's replies are **organizational artifacts**, not chat bubbles from a model: a plan summary the CEO can approve/reject, a clarifying question, or a status update. Each response is attributed to the company and its process — "your team planned this" — never "here is what the AI generated" ([`EXECUTIVE_USER_EXPERIENCE.md` §5.2](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#5-outcome-based-communication)).
- **Decisions are inline.** When a response carries a decision (approve a plan, clear a checkpoint), the action is taken in place within the stream, then the company resumes the real workflow — consistent with how approvals resolve in the Inbox ([`COMPANY_DASHBOARD.md` §10](../ceo-experience/COMPANY_DASHBOARD.md#10-notifications)).
- **Outcome language in, outcome language out.** Both the composer and the response stream stay in organizational language; the layout has no affordance to enter or display engineering mechanics (§2.6).

### 11.3 Relationship to the Inbox

This surface and the **Inbox** are two faces of the same conversation: the composer is where the CEO *initiates* (states a new outcome), and the Inbox is where the company *surfaces what needs a decision* (approvals, clarifications, notifications). The layout system treats outcome input as the front door and the Inbox as the decision queue; both speak the same structured, organizational language.

### 11.4 Implementation status

**Implemented today:** outcome submission as a structured record with priority and an optional target repository, and approval/decision resolution through the Inbox ([`EXECUTIVE_USER_EXPERIENCE.md` §11.1](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#11-implementation-status-summary)). **Designed / planned:** the richest form — fully natural-language outcome submission with conversational refinement — is specified but deliberately gated behind the canonical Specification, exactly as the executive-experience document states ([`EXECUTIVE_USER_EXPERIENCE.md` §5.4](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#5-outcome-based-communication)). The layout is specified so the implemented composer can grow into the conversational form without restructuring.

---

## 12. Responsive Behavior Principles

Engineering OS must remain a coherent company on any screen size. These are principles, not breakpoints — exact dimensions belong to the visual design system.

### 12.1 Principles

**12.1.1 The shell adapts; it never disappears.** On smaller viewports the chrome (§3) condenses — primary navigation may collapse into a revealable menu, the identity rail and utility region may compact — but orientation and the global affordances (active company, search, notification bell, Inbox badge, submit) remain reachable. The CEO is never stranded without a way to navigate or to see what needs them.

**12.1.2 Priority survives reflow.** When a multi-region layout reflows to a single column on a narrow screen, the §2.4 priority order is preserved: the highest-priority content (blocking decisions, the recommended action, the object header) leads. Reflow may change arrangement; it must not change rank.

**12.1.3 Content is fluid; meaning is fixed.** Sections and facets restack and resize, but no content is dropped on smaller screens. The CEO on a phone sees the same company state as the CEO on a desktop, laid out for the device — not a degraded subset. (Truncation with a "view all" path is acceptable; silently hiding signal is not.)

**12.1.4 Touch and pointer are equal citizens.** Every navigation and decision affordance is operable by touch and by pointer. No interaction depends on hover alone, since the CEO may be on a tablet or phone reviewing the company between meetings.

**12.1.5 The largest screen earns more breadth, not more noise.** Wider viewports may present sections side by side rather than stacked, but added width is used for breadth-first calm — more visible at a glance — never to surface implementation detail that smaller screens correctly omit.

### 12.2 Device intent

The product assumes the CEO's primary device is a comfortable desktop or laptop for deep review, with frequent secondary use on tablet and phone for the two highest-value mobile moments: *checking whether anything needs them* (the chrome counts plus the Dashboard's top sections) and *clearing a decision* (approving in the Inbox). The responsive design must make those two moments excellent on a small screen even before every detail surface is fully optimized for mobile.

---

## 13. Empty and Loading States

Empty and loading states are designed layouts, not fallbacks. They carry the company's promise during the moments when there is nothing — or nothing yet — to show.

### 13.1 Loading

- **Structure first, content second.** While a surface assembles its data, it shows a lightweight skeleton of its own layout — the shape of the sections to come — rather than a blank page or a lone spinner ([`COMPANY_DASHBOARD.md` §6.1](../ceo-experience/COMPANY_DASHBOARD.md#6-states-and-empty-states)). The CEO sees the building's frame immediately and the rooms fill in.
- **The shell never waits on the content.** The chrome (navigation, company indicator, attention counts) renders independent of the content region's loading, so orientation is available before the surface is.
- **No layout shift on resolve.** The skeleton matches the real layout closely enough that content replacing it does not jar the page into a new shape.

### 13.2 Empty states

Empty is meaningful, and different emptinesses mean different things. The layout system distinguishes them rather than showing one generic blank:

| Emptiness | Meaning | Designed response |
|---|---|---|
| **New company** | No requests, tasks, or events yet | A getting-started state: the team is standing by; submit the first outcome, or meet the team ([`COMPANY_DASHBOARD.md` §6.2](../ceo-experience/COMPANY_DASHBOARD.md#6-states-and-empty-states), [`FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md)). |
| **Onboarding incomplete** | No repository connected | A persistent setup affordance directing the CEO to finish setup, independent of whether work exists ([`COMPANY_DASHBOARD.md` §6.3](../ceo-experience/COMPANY_DASHBOARD.md#6-states-and-empty-states)). |
| **Established company at rest** | Work has happened; nothing is in flight now | An explicit "nothing in motion — what's next?" state with a submit path, deliberately distinct from "you haven't started" ([`COMPANY_DASHBOARD.md` §6.4](../ceo-experience/COMPANY_DASHBOARD.md#6-states-and-empty-states)). |
| **Section-level empty** | One region has nothing, but the surface does not | Omit the region when its absence is itself the signal (no Risks section means nothing is blocked); show an intentional message where absence would be ambiguous (no employee has active work) ([`COMPANY_DASHBOARD.md` §6.5](../ceo-experience/COMPANY_DASHBOARD.md#6-states-and-empty-states)). |

The governing rule: **a region that would be empty is hidden, except where its absence would be ambiguous to the CEO, in which case an intentional empty message is shown.** This rule is shared with the Dashboard specification and applies to every layout archetype.

### 13.3 Error and degraded states

When a surface cannot load, it fails inside the shell, not as a broken page: the chrome remains, the content region shows a plain-language explanation framed organizationally ("we couldn't load this right now"), and the CEO retains navigation to move elsewhere. The layout never strands the CEO on a dead screen, and an error message never exposes a stack trace, a path, or any engineering mechanic (§2.6).

---

## 14. Status, Breadcrumbs, and Wayfinding

The shell and the archetypes share a small set of cross-cutting wayfinding conventions, so position and state read consistently everywhere.

### 14.1 Status indicators

Every object carries a status indicator drawn from a consistent vocabulary across all object types — active work, completed work, blocked work, and action-required all read the same way wherever they appear ([`INFORMATION_ARCHITECTURE.md` §21](../architecture/INFORMATION_ARCHITECTURE.md#21-global-navigation-concepts)). A status indicator on a list, on a detail header, and on a timeline entry for the same object must agree. Status is always organizational ("In Review," "Blocked," "Shipped"), never a raw engineering state.

### 14.2 Breadcrumbs

Every drill-down surface shows a navigable breadcrumb path from the current view back to its parents — for example *Work › Projects › Password Reset › Review* ([`INFORMATION_ARCHITECTURE.md` §21](../architecture/INFORMATION_ARCHITECTURE.md#21-global-navigation-concepts)). Every level is a link; selecting one returns the CEO to that level. Breadcrumbs are the detail layout's primary "how did I get here / how do I go back" affordance and complement, rather than replace, the primary spine.

### 14.3 Object linking

Wherever two objects are related, the relationship is a navigable link (§9.2). This is what makes the company's information feel connected rather than siloed: from any object, the CEO can traverse the full chain — a project to its feature, a feature to its initiating goal, a release to its QA result — without losing context ([`INFORMATION_ARCHITECTURE.md` §21](../architecture/INFORMATION_ARCHITECTURE.md#21-global-navigation-concepts)). Object links and breadcrumbs together let the CEO move through the company by following meaning, not by returning to a menu each time.

### 14.4 Global search

Global search lives in the utility region of the shell (§3.1) and is reachable from every surface. It searches across the objects visible to the CEO — features, projects, employees, memory, decisions, releases — and returns typed results that each link into the appropriate detail layout. Search never exposes code content, file paths, or commit messages, and never shows raw identifiers ([`INFORMATION_ARCHITECTURE.md` §20](../architecture/INFORMATION_ARCHITECTURE.md#20-search-model)).

---

## 15. Implementation Status

This section separates what the navigation and layout system reflects **today** from what is **designed but not yet built**, in keeping with the hard project rule against representing planned capability as real.

### 15.1 Implemented today

- A persistent app shell with primary navigation across Dashboard, Company, Work, Memory, and Inbox, scoped to one company.
- Persistent attention counts in the chrome: the sidebar notification bell and the Inbox approval badge ([`COMPANY_DASHBOARD.md` §10.2](../ceo-experience/COMPANY_DASHBOARD.md#10-notifications)).
- The Dashboard layout — ranked conditional sections, recommended next action, vitals, risks, active requests, employee activity, planning and timeline sections, with loading skeleton and section-level empty states ([`COMPANY_DASHBOARD.md` §12](../ceo-experience/COMPANY_DASHBOARD.md#12-implementation-status)).
- Detail surfaces for the work hierarchy and memory, with outcome-level summaries and status.
- The Timeline as a chronological, plain-language event stream linked to originating work.
- Outcome input as a structured record, and approval/decision resolution through the Inbox.
- New-company, onboarding-incomplete, and company-at-rest empty states.

### 15.2 Designed / planned

- **Company switcher** for multi-company ownership; V1 ships the single-company passive indicator (§6.3).
- **Conversational outcome input** with natural-language refinement; the structured composer ships today (§11.4).
- A unified **CEO Control Center** consolidating decisions, alerts, and attention items that are presently distributed across Dashboard and Inbox ([`EXECUTIVE_USER_EXPERIENCE.md` §11.2](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#11-implementation-status-summary)).
- Full mobile optimization of every detail surface beyond the two priority mobile moments (§12.2).

These are documented as targets, not current behavior. The layout system is specified so each planned item slots into the existing shell and archetypes without restructuring.

---

## 16. Related Documents

- [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) — the authoritative model of what information exists, how it is grouped, and how it is navigated. This document is its layout layer; it owns the navigation philosophy, the five-section model, and the wayfinding conventions this document arranges in space.
- [`COMPANY_DASHBOARD.md`](../ceo-experience/COMPANY_DASHBOARD.md) — owns the Dashboard's content; this document owns its layout contract (§8).
- [`COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md) — owns the Timeline's content; this document owns its layout contract (§10).
- [`EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) — the experiential contract (outcomes in / outcomes out, the CEO's role, the four interaction modes) that the shell and archetypes serve.
- [`FIRST_USE_EXPERIENCE.md`](../ceo-experience/FIRST_USE_EXPERIENCE.md) — the first-run journey whose empty and getting-started states this document's layouts render (§13).
- [`PRODUCT_ALERTS.md`](../ceo-experience/PRODUCT_ALERTS.md) and [`NOTIFICATION_SYSTEM.md`](../systems/NOTIFICATION_SYSTEM.md) — the alert and notification policy behind the chrome's attention counts and the Inbox.
- [`APPROVAL_SYSTEM.md`](../systems/APPROVAL_SYSTEM.md) — the approval-checkpoint model behind the Inbox badge and inline decisions.
- [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) — product scope and principles, including the explicit non-goals (not an AI chat interface, not a code editor) that shape §11.
- [`DOMAIN_MODEL.md`](../architecture/DOMAIN_MODEL.md) — the objects that detail and list layouts render.
