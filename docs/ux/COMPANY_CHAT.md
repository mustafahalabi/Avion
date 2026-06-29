# Company Chat

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

Company Chat is the conversational surface of Engineering OS — the place where the CEO communicates goals to the company, receives meaningful summaries back, answers the few questions the company genuinely cannot resolve on its own, and approves the small number of decisions that belong to the person accountable for the business. This document specifies *how that conversation behaves*: who may speak, what a message looks like, how messages are prioritized, and where the line sits between directing a company and prompting a model.

This is a UX specification. It does not prescribe layout, components, colors, routes, transports, or data models — those belong to the frontend and to [`TECHNICAL_ARCHITECTURE.md`](../architecture/TECHNICAL_ARCHITECTURE.md). It does not redefine the outcome-communication contract, the approval ladder, or the autonomy model — those are owned by [`EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md). This document owns one thing: the behavior of the chat surface, and the discipline that keeps it a **company conversation** rather than a **prompt console**.

The single rule that governs everything below: Company Chat must always read like a CEO talking to their organization, never like a user talking to an AI. If a message in the chat would only make sense as a prompt, an instruction to a model, or an engineering directive, it does not belong here.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Design Principles](#2-design-principles)
3. [Conversation Types](#3-conversation-types)
4. [Message Hierarchy](#4-message-hierarchy)
5. [Employee Participation Rules](#5-employee-participation-rules)
6. [Decision Requests](#6-decision-requests)
7. [Clarifying Questions](#7-clarifying-questions)
8. [Status Summaries](#8-status-summaries)
9. [Work Handoff Behavior](#9-work-handoff-behavior)
10. [Anti-Patterns](#10-anti-patterns)
11. [Success Criteria](#11-success-criteria)
12. [Relationship to Other Documents](#12-relationship-to-other-documents)

---

## 1. Purpose

Company Chat exists so the CEO can run their company in plain language. It is the primary place the CEO performs two of their four interaction modes — **outcome input** and **approvals** — and the place the company speaks back in outcome terms (see [`EXECUTIVE_USER_EXPERIENCE.md` §2.3](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#2-the-users-role)).

The chat serves four jobs, in priority order:

1. **Receive outcomes.** The CEO states what they want — "Let users reset their password" — and the company takes it from there. The chat is where intent enters the company.
2. **Surface decisions that need the CEO.** When the company reaches a point that genuinely requires the CEO's judgment — a plan to approve, a gated action to clear, a fork it should not resolve alone — the chat presents it with the context to decide in place.
3. **Ask the rare clarifying question.** When an outcome is ambiguous enough that proceeding would risk building the wrong thing, the company asks one well-formed business question rather than guessing.
4. **Report meaningful progress.** The company tells the CEO what it has accomplished and what is in motion, framed as outcomes delivered and outcomes underway — never as a log of engineering steps.

What Company Chat is **not**: it is not a code editor, not an AI chat interface, and not a command line for the runtime. Per [`PRODUCT_REQUIREMENTS.md` §14](../product/PRODUCT_REQUIREMENTS.md#14-explicit-non-goals), the CEO directs a company; they do not prompt a model and they do not write code. The chat is the conversation a CEO would have with their leadership team — concise, outcome-oriented, and free of implementation mechanics.

The chat is one expression of the company's voice, alongside the [`COMPANY_DASHBOARD.md`](../ceo-experience/COMPANY_DASHBOARD.md) (the at-a-glance state of the company) and [`PRODUCT_ALERTS.md`](../ceo-experience/PRODUCT_ALERTS.md) (the policy for what interrupts the CEO). The dashboard answers "what is the state of my company?"; alerts answer "what should push into my attention?"; Company Chat answers "what is the company saying to me, and what do I want to say back?"

---

## 2. Design Principles

These principles govern every decision about the chat surface. They derive from the product principles in [`PRODUCT_REQUIREMENTS.md` §7](../product/PRODUCT_REQUIREMENTS.md#7-product-principles) and the experience principles in [`EXECUTIVE_USER_EXPERIENCE.md` §9](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles). When they conflict, earlier principles win.

**2.1 The CEO speaks in outcomes; the company answers in outcomes.** Every message in both directions is framed as a desired result or an accomplished result. The chat never asks the CEO to phrase a request as an instruction, and the company never answers with a transcript of how the work was done.

**2.2 The runtime is invisible.** No message ever exposes a model name, a prompt, an agent, a branch, a pull request number, a CI status, a file path, a diff, a command, or an environment. If any of these would appear in a chat message, the message is malformed and must be reframed in business language.

**2.3 Protect the CEO's attention.** The chat is not a firehose. Most of what the company does generates no message at all. A message earns its place only if it requires the CEO's input or communicates a genuinely meaningful change of state. A chat that narrates routine work has failed.

**2.4 Every message that asks for something brings its own context.** When the company asks the CEO to decide or clarify, the message contains everything needed to respond without leaving the chat — what is being asked, why it matters, and what happens either way. The CEO should never have to go digging to answer.

**2.5 The company has one voice, expressed through named roles.** Messages come from the company, attributed to the employee whose responsibility the message concerns. The voice is consistent, professional, and confident — alive, not theatrical (see §5).

**2.6 The chat is a conversation, not a control panel.** The CEO acts through natural replies and a small set of explicit response actions (approve, reject, request changes, answer). The chat never asks the CEO to configure, operate, or steer execution. Configuration lives in Settings; execution lives inside the company.

**2.7 Conversation does not replace the record.** The chat is a communication surface, not the system of record. Decisions made in chat are committed to the durable work record and the [`COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md); the chat reflects them but is not their source of truth. Conversation memory is working memory and expires; organizational memory persists (see [`INFORMATION_ARCHITECTURE.md` §16](../architecture/INFORMATION_ARCHITECTURE.md#16-memory-structure)).

---

## 3. Conversation Types

Company Chat carries a small, bounded set of conversation types. Each has a distinct purpose, a distinct initiator, and a distinct expected response. The set is intentionally closed — anything that does not fit one of these types does not belong in the chat.

| Type | Initiated by | Purpose | CEO's expected action |
|---|---|---|---|
| **Outcome request** | CEO | State a desired result for the company to deliver | None — the company responds with a plan |
| **Plan proposal** | Company | Present a plan for a submitted outcome | Approve / request changes / reject |
| **Clarifying question** | Company | Resolve a genuine ambiguity before building | Answer one business question |
| **Decision request** | Company | Ask the CEO to clear a gated action or resolve a fork | Approve / reject / choose |
| **Status summary** | Company | Report meaningful progress or completion | None — informational, optionally acknowledged |
| **Direction question** | CEO | Ask the company about state, priorities, or history | None — the company answers |
| **Escalation** | Company | Surface a judgment that exceeds an employee's authority | Decide |

### 3.1 Outcome requests

The CEO's primary use of the chat. The CEO states an outcome the way they would to their team: "Add dark mode," "Make checkout faster," "Let users export their data." The CEO does not specify implementation, does not choose which employee handles it, and does not pre-decompose the work. The company acknowledges receipt and responds with a plan proposal. The full contract for how outcomes are communicated lives in [`EXECUTIVE_USER_EXPERIENCE.md` §5](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#5-outcome-based-communication); the chat is one surface for it.

### 3.2 Company-initiated conversations

The company opens a conversation only for one of four reasons: to propose a plan, to ask a clarifying question, to request a decision, or to report a meaningful status. Each is specified in its own section below. The company never opens a conversation to narrate routine progress, to confirm that it is working, or to ask the CEO an engineering question.

### 3.3 Direction questions

The CEO can ask the company about itself — "What is the team working on?", "What shipped this week?", "Why did we choose to defer the billing work?" The company answers in plain language, drawing on live company state and memory, and links to the relevant surface (Work, Timeline, Memory) for depth. Direction questions are conversational reads; they never trigger work on their own. A direction question that implies a desired change is treated as a new outcome request and gets a plan, not a silent action.

---

## 4. Message Hierarchy

Not all messages carry equal weight. The chat organizes messages into a clear hierarchy so the CEO can tell, at a glance, what merely informs them from what actually needs them. The hierarchy maps to the alert priority scale in [`PRODUCT_ALERTS.md` §4](../ceo-experience/PRODUCT_ALERTS.md#4-priority-levels).

### 4.1 The three tiers

| Tier | Meaning | Examples | Demands a response? |
|---|---|---|---|
| **Needs you** | The company is paused, waiting on the CEO | Plan proposal, decision request, clarifying question, escalation | Yes — work does not advance until answered |
| **Worth knowing** | A meaningful state change the CEO should be aware of | Outcome delivered, release shipped, work blocked | No — informational, optionally acknowledged |
| **Background** | Routine progress; ambient context | Work advancing through a normal phase | No — and usually generates no message at all |

**Needs you** messages are always visually elevated and never auto-dismiss; they remain until the CEO acts. **Worth knowing** messages inform without interrupting. **Background** activity is, by default, *not a message at all* — it is reflected in the dashboard's live activity, not pushed into the chat. The chat is reserved for messages that cross the "worth a CEO's glance" threshold.

### 4.2 Ordering and grouping

- Open **Needs you** items sort to the top and stay there until resolved, ordered by urgency then age.
- Within a single outcome, related messages group into a thread so the CEO follows one piece of work as a coherent conversation rather than scattered lines.
- A resolved **Needs you** item drops to its chronological place in the conversation once answered, carrying a record of the CEO's response.

### 4.3 One ask per message

A message that needs the CEO asks for exactly one thing. The company never bundles a plan approval, a clarifying question, and a decision into a single message. Each ask is its own message with its own response action, so the CEO can dispatch each cleanly and the record of what was asked and answered stays unambiguous.

---

## 5. Employee Participation Rules

Messages from the company are attributed to a **named employee** — the role whose responsibility the message concerns. This makes the company feel like a staffed organization rather than a single assistant, while keeping the company's voice consistent. The roster of roles is defined in [`EMPLOYEE_DIRECTORY.md`](../organization/EMPLOYEE_DIRECTORY.md); ownership of each phase of work is defined in [`RESPONSIBILITY_MATRIX.md`](../organization/RESPONSIBILITY_MATRIX.md).

### 5.1 Who speaks for what

An employee speaks in the chat only about matters within their domain. Attribution follows responsibility:

| Message concerns | Speaks in chat |
|---|---|
| A plan for an outcome | Product Manager (with Tech Lead for technical shape) |
| Technical feasibility or architectural trade-off | CTO or Tech Lead |
| A code-quality or security concern that needs a CEO decision | Reviewer or Security Engineer |
| A quality verdict gating a release | QA Engineer |
| A release going out or a deployment decision | Release Manager |
| A production incident the CEO must know about | Monitoring Engineer |

The CEO does not choose who to talk to. The CEO addresses the company; the company routes the message to the right role and replies under that role's name.

### 5.2 Participation discipline

- **One voice per ask.** A single decision or question is presented by a single employee, not debated in front of the CEO. Internal disagreement is resolved inside the company through its [decision frameworks](../decision-frameworks/) before anything reaches the chat. The CEO sees a resolved recommendation, not an argument.
- **Speak only when it clears the bar.** An employee posts to the chat only to propose a plan, ask a genuine clarifying question, request a decision, or report a meaningful status. Employees do not post to narrate their work, announce that they have started, or seek reassurance.
- **No personification beyond utility.** Employees communicate with appropriate professional confidence and a consistent style. They do not perform personality, simulate small talk, or add ceremony. The experience is "an active, capable team," not a cast of characters (see [`EXECUTIVE_USER_EXPERIENCE.md` §9.7](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles)).
- **First person, company standard.** Employees speak in the first person ("I've planned four tasks for this") in the company's communication style, consistent with feature F-03 in [`PRODUCT_REQUIREMENTS.md` §12](../product/PRODUCT_REQUIREMENTS.md#12-v1-features).

### 5.3 What employees never do in chat

Employees never expose the runtime (§2.2), never ask the CEO an implementation question (§10), and never request approval for routine work. They never surface internal coordination — handoffs between roles, task assignments, and review routing happen inside the company and appear to the CEO only as outcome-level progress.

---

## 6. Decision Requests

A **decision request** is a message in which the company pauses and asks the CEO to make a call only the CEO should make. Decision requests are the chat's most important company-initiated message type, and the discipline around them is what keeps the chat from degrading into a stream of approvals.

This document specifies how a decision request *appears and behaves in the chat*. The model of *which* decisions exist, *when* an action is gated, and *how* autonomy governs them is owned by [`EXECUTIVE_USER_EXPERIENCE.md` §6–§8](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#6-approval-moments). The chat is a surface for those moments, not their source.

### 6.1 The anatomy of a decision request

Every decision request in the chat contains, in plain language:

1. **What is being decided** — a single, specific question ("Approve the plan for password reset?", "Ship the checkout-speed release?").
2. **Why it needs the CEO** — the reason this is a CEO decision and not the company's to make.
3. **What happens if approved** — the concrete next state.
4. **What happens if rejected** — the concrete alternative, including whether work returns to a prior phase.
5. **A response action** — the explicit way to respond (approve / reject / request changes / choose), resolved in place.

A decision request that is missing the "what happens either way" framing is incomplete and must not be sent. The CEO must be able to decide from the message alone.

### 6.2 The kinds of decision the chat carries

The chat surfaces the same decision categories defined in [`EXECUTIVE_USER_EXPERIENCE.md` §7.1](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#7-decision-moments): plan acceptance, gated actions, quality verdicts, unblock/clarify, and escalations. Direction decisions ("what to build next") are CEO-initiated and arrive as outcome requests, not company-initiated decision requests.

### 6.3 Response behavior

- A decision request blocks the work it concerns until the CEO responds — the company never advances a gated action while its request is unresolved.
- The CEO's response is committed to the work record and the timeline; the chat shows the resolved decision and who made it.
- Rejecting or requesting changes returns work to the appropriate prior phase with the CEO's reason attached, so the company acts on the *why*, not just the verdict.
- Decision requests are rare by design. Their frequency should fall over a company's life as trust grows and autonomy rises (see §11 and [`EXECUTIVE_USER_EXPERIENCE.md` §8.5](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#8-trust-levels)). A chat that fills with decision requests indicates either an autonomy level set too low for the CEO's actual trust, or a company surfacing decisions it should be resolving itself.

### 6.4 What is never a decision request

The company never asks the CEO to decide an execution matter: which file to change, what to name a branch or PR, which dependency version to pin, or whether a pipeline should run. Those belong to the company. Dressing an engineering choice up as a CEO decision is a violation of the CEO experience (see §10 and [`EXECUTIVE_USER_EXPERIENCE.md` §7.3](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#7-decision-moments)).

---

## 7. Clarifying Questions

A **clarifying question** is the company asking the CEO for missing information before it proceeds. Clarifying questions are legitimate and valuable — but only when the ambiguity is real and the cost of guessing wrong is high. The discipline is to ask rarely, ask well, and ask in business terms.

### 7.1 When the company asks

The company asks a clarifying question only when **all** of the following hold:

- The outcome is genuinely ambiguous in a way that changes *what gets built*, not *how it gets built*.
- The ambiguity cannot be resolved from company memory, repository understanding, or a reasonable default the company is willing to own.
- Proceeding on the wrong interpretation would waste meaningful work or ship the wrong thing.

If the ambiguity is about implementation, the company resolves it itself using its decision frameworks — it does not ask the CEO. If a sensible default exists, the company proceeds with the default and states the assumption in its plan, rather than blocking on a question.

### 7.2 How a clarifying question is shaped

A good clarifying question is:

- **Business-framed.** "Should password reset go to email only, or also SMS?" — not "Which auth provider should I use?"
- **Singular.** One question per message. If two things are unclear, the more consequential one is asked first; the second may resolve once the first is answered.
- **Bounded where possible.** The company offers the likely options it sees, so the CEO can answer with a choice rather than an essay — while leaving room for a free-text answer.
- **Self-contained.** It carries the context needed to answer, and states what the company will assume if the CEO defers.

### 7.3 The cost of a question

Every clarifying question spends the CEO's attention, which is the product's scarcest resource (see [`EXECUTIVE_USER_EXPERIENCE.md` §9.1](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles)). A company that asks many clarifying questions is not being careful — it is offloading its judgment onto the CEO. The bar is deliberately high: when in doubt between asking and choosing a defensible default, the company chooses the default and records the assumption. Questions are a fallback, not a habit.

---

## 8. Status Summaries

A **status summary** is the company telling the CEO what it has accomplished or what is meaningfully in motion. Status summaries are how the CEO stays informed without managing, and they are where the "outcomes in, outcomes out" principle is most visible.

### 8.1 What gets summarized

The chat summarizes **outcomes and milestones**, not steps. The events worth a status summary are:

| Event | Summary frames it as |
|---|---|
| An outcome is delivered | "Password reset is live. Users can now reset via email." |
| A release ships | "Released checkout improvements — three features included." |
| Work becomes blocked | "Data export is blocked: it needs a decision on retention rules." |
| Work fails or stalls and needs attention | "The billing work stalled and needs your input to continue." |
| A meaningful planning milestone is reached | "Your team finished planning the customer portal: 6 tasks, ready to start." |

Routine phase transitions — implementation started, review passed, QA passed — do **not** generate status summaries. They are visible on the dashboard's live activity and the timeline for any CEO who wants them, but they do not push into the chat. The chat surfaces the arrival, not the journey.

### 8.2 How a summary reads

- **Outcome language, not engineering language.** A summary says what the CEO can now do or what the company achieved, never which files changed or what the agent ran.
- **Confidence-calibrated.** When a result carries a caveat — a known limitation, a follow-up the company recommends — the summary states it plainly rather than overclaiming. The company is alive, not theatrical, and it does not oversell.
- **Linked, not dumped.** A summary is short and links to the relevant surface (Work, Release, Timeline) for the CEO who wants depth. The chat carries the headline; the destination carries the detail.

### 8.3 Acknowledgment, not action

Status summaries are informational. They may be acknowledged but require no response, and the company never blocks on an unacknowledged summary. A summary that requires a decision is not a summary — it is a decision request (§6) and must be shaped as one.

---

## 9. Work Handoff Behavior

Work inside the company moves through many hands — Product Manager to Tech Lead, engineers to Reviewer, Reviewer to QA, QA to Release Manager. These **internal handoffs** are the company's business, not the CEO's. The chat's job is to make the company's progress legible without exposing its internal mechanics.

### 9.1 Internal handoffs are invisible

The CEO never sees a handoff between employees as a chat message. "Tech Lead assigned this to a Backend Engineer," "Reviewer passed this to QA," "Release Manager picked up the deployment" — none of these reach the chat. They are coordination, and coordination is exactly the burden Engineering OS removes (see [`PRODUCT_REQUIREMENTS.md` §1](../product/PRODUCT_REQUIREMENTS.md#1-product-overview)). The CEO sees progress as movement of the *outcome*, not as a relay between *roles*.

### 9.2 The CEO → company handoff

The one handoff the chat does represent is the handoff *from the CEO to the company*: the CEO states an outcome, and the company takes ownership of it. The chat marks this clearly — the company acknowledges the outcome, then returns a plan. From that point, the CEO has handed the work off and the company owns execution until it reports back. The CEO does not need to push the work forward between phases; the company advances it autonomously within the configured autonomy level.

### 9.3 The company → CEO handoff

The reverse handoff — back to the CEO — happens only at the defined moments: a plan to approve, a clarifying question, a gated decision, or a delivered outcome. These are the only points at which the company hands the conversation back. Each such handoff is one of the typed messages above, carrying its own context and response action. Between these moments, the work is the company's, and the chat stays quiet.

### 9.4 Continuity across a handoff

When work returns to the company after a CEO response — an approval, an answer, a requested change — the company resumes from where it paused, carrying the CEO's input forward. The CEO never has to re-explain context they already gave. A requested change re-enters the company with the CEO's reason attached, so the company acts on intent, not just on a verdict. Conversation context is working memory; the durable decisions it produces are committed to the company's permanent record (see §2.7).

---

## 10. Anti-Patterns

The following are failures of the chat surface. Each represents a way the chat could drift from "a CEO directing a company" toward "a user prompting a model." They are listed so they can be recognized and rejected in design and review.

### 10.1 Prompt engineering creep

**The failure:** The chat starts rewarding the CEO for phrasing requests like prompts — adding constraints, specifying steps, coaching the company on *how* to do the work to get a better result.

**Why it is fatal:** It inverts the product. The moment the CEO is optimizing wording to steer a model, they are a prompt engineer, not a CEO, and Engineering OS has become the tool it exists to replace ([`PRODUCT_REQUIREMENTS.md` §14](../product/PRODUCT_REQUIREMENTS.md#14-explicit-non-goals)).

**The correct behavior:** A plain outcome — "Add dark mode" — produces a good result. The company asks a clarifying question if it genuinely needs more; it never requires the CEO to engineer their request. Quality comes from the organization, not from the CEO's phrasing.

### 10.2 The chat as a command line

**The failure:** The CEO uses the chat to issue execution commands — "run the tests," "open a PR," "deploy to staging," "check out the branch."

**The correct behavior:** The chat carries outcomes and decisions. Execution verbs are the company's to perform, governed by autonomy and guardrails. If the CEO wants something shipped, they approve a release; they do not operate the pipeline.

### 10.3 Narration

**The failure:** Employees post a running commentary — "Starting the work now," "Halfway done," "Just finished the first task," "Moving on to the next file."

**Why it is fatal:** It violates attention protection (§2.3). A chat that narrates routine progress trains the CEO to ignore it, which means the messages that matter get ignored too.

**The correct behavior:** Routine progress lives on the dashboard and timeline. The chat speaks at outcomes and decisions, not at steps.

### 10.4 Leaking the runtime

**The failure:** A message mentions a branch, a PR number, a commit, a file path, a CI run, a model, a prompt, an agent, or an environment.

**The correct behavior:** Every message is reframed in business language. The runtime stays invisible (§2.2). If a message cannot be expressed without naming the machine, it should not be sent to the CEO at all.

### 10.5 Engineering questions to the CEO

**The failure:** The company asks the CEO an implementation question — "Which database should I use?", "Should this be a REST or GraphQL endpoint?", "What should I name this service?"

**The correct behavior:** The company answers these itself using its decision frameworks. The only questions that reach the CEO are business questions (§7). An engineering question in the chat is a defect, not a courtesy.

### 10.6 Decision spam

**The failure:** The chat fills with approval requests for low-consequence actions, conditioning the CEO to approve reflexively.

**Why it is fatal:** Reflexive approval is the same as no control at all, and it buries the rare decision that genuinely matters. It also signals an autonomy level mismatched to the CEO's real trust.

**The correct behavior:** Decision requests are rare and high-signal (§6.3). Their volume should fall as trust grows, not rise.

### 10.7 Roleplay and theater

**The failure:** Employees perform personality — banter, small talk, dramatized enthusiasm — beyond what communicates the work.

**The correct behavior:** Alive, not theatrical (§5.2). The company is a professional organization. Warmth is fine; performance is not.

---

## 11. Success Criteria

Company Chat succeeds when the CEO can run their company through plain-language conversation alone — stating outcomes, answering a rare question, clearing a rare decision — and never once feels like they are operating a tool.

### 11.1 Experience criteria

| Criterion | Target signal | Why it matters |
|---|---|---|
| CEO messages read as outcomes | The CEO states results, not instructions or constraints | Confirms the chat resists prompt-engineering drift (§10.1) |
| Company messages read as outcomes | No message exposes the runtime or narrates steps | Confirms the runtime stays invisible (§2.2) |
| Messages that need the CEO are rare and high-signal | Volume of decision requests and clarifying questions trends down over a company's life | Confirms attention is protected and trust is growing |
| Every "needs you" message is answerable in place | The CEO never leaves the chat to gather context to respond | Confirms every ask carries its own context (§2.4) |

### 11.2 Discipline criteria

| Criterion | Target signal |
|---|---|
| No engineering questions reach the CEO | Zero implementation questions in the chat |
| No execution commands accepted from the CEO | The chat carries outcomes and decisions only |
| Clarifying questions are genuinely necessary | The company chooses a defensible default over asking whenever one exists |
| Internal handoffs stay invisible | The CEO sees outcome progress, never role-to-role coordination |

### 11.3 The single sentence

Company Chat succeeds when the CEO can truthfully say: **"I talk to my company the way I'd talk to my leadership team — I say what I want, I answer the occasional question, I make the occasional call, and the work gets done."** If the CEO ever feels they are wording a prompt, narrating to a machine, or operating a pipeline, the chat has failed.

---

## 12. Relationship to Other Documents

- [`EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) — owns the outcome-communication contract, the approval and decision models, and the autonomy ladder. Company Chat is a *surface* for those; it does not redefine them.
- [`COMPANY_DASHBOARD.md`](../ceo-experience/COMPANY_DASHBOARD.md) — the at-a-glance state of the company. The dashboard shows ambient state; the chat carries the conversation. Routine progress the chat omits lives here.
- [`PRODUCT_ALERTS.md`](../ceo-experience/PRODUCT_ALERTS.md) — the policy for what interrupts the CEO and how loudly. The chat's message hierarchy (§4) maps to the alert priority scale.
- [`COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md) — the company's full browsable history. Decisions and outcomes that pass through the chat are recorded here; the chat is not the system of record.
- [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) — how information is organized and what may never reach the CEO. §2 (Navigation Philosophy) and §19 (Notifications) bound what the chat may surface.
- [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) — product scope, principles, and the non-goals (§14) that define the chat as not-a-prompt-console. Features F-02 (Goal Input) and F-03 (Employee Status Feed) are the requirements this surface helps satisfy.
- [`EMPLOYEE_DIRECTORY.md`](../organization/EMPLOYEE_DIRECTORY.md), [`RESPONSIBILITY_MATRIX.md`](../organization/RESPONSIBILITY_MATRIX.md) — who the employees are and what each owns, which determines who speaks for what in the chat (§5).
- Decision frameworks ([`PRIORITIZATION_DECISION_FRAMEWORK.md`](../decision-frameworks/PRIORITIZATION_DECISION_FRAMEWORK.md), [`ARCHITECTURE_DECISION_FRAMEWORK.md`](../decision-frameworks/ARCHITECTURE_DECISION_FRAMEWORK.md), [`SECURITY_DECISION_FRAMEWORK.md`](../decision-frameworks/SECURITY_DECISION_FRAMEWORK.md)) — how employees resolve decisions internally so the chat does not burden the CEO with them.
