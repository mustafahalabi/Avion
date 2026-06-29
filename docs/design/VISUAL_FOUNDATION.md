# Visual Foundation

**Status:** Approved
**Version:** 1.0
**Owner:** Product Manager
**Last Updated:** 2026-06-29

---

This document defines the **visual foundation** of Engineering OS — the brand attributes, visual principles, and craft direction that every interface in the product must trace back to. It exists to set a single, durable visual direction *before* any design system, component library, or screen is built, so that the product feels like one company rather than a collection of independently styled pages.

It is a design-direction document, not a design system. It does not specify final color hex values, type scales, component tokens, or pixel measurements — those belong to the design system work this document is meant to guide. It defines the *intent* a design system must satisfy: how the product should feel, what it must never look like, and the principles a designer or engineer uses to decide between two visually acceptable options.

The guiding image is precise. Opening Engineering OS should feel like walking into a **calm, elite engineering office** — quiet, confident, deeply competent — not like opening a chatbot, an issue tracker, or a generic admin dashboard. The product is the [company itself](../company/COMPANY_OPERATING_SYSTEM.md), and the company is a serious organization. The visuals must earn the trust that the [CEO](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) places in it.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Brand Attributes](#2-brand-attributes)
3. [Visual Principles](#3-visual-principles)
4. [Typography Direction](#4-typography-direction)
5. [Color Direction](#5-color-direction)
6. [Spacing and Layout Principles](#6-spacing-and-layout-principles)
7. [Iconography Principles](#7-iconography-principles)
8. [Motion Principles](#8-motion-principles)
9. [Employee Representation Principles](#9-employee-representation-principles)
10. [Anti-Patterns](#10-anti-patterns)
11. [Inspiration References](#11-inspiration-references)
12. [How to Use This Document](#12-how-to-use-this-document)
13. [Relationship to Other Documents](#13-relationship-to-other-documents)

---

## 1. Purpose and Scope

### 1.1 What this document owns

This document owns the **visual personality** of Engineering OS and the principles that protect it. It answers: what does the product look and feel like, why, and what would betray that feeling.

It is upstream of all visual craft. A design system, a component library, theming tokens, and individual screens are all *downstream* of this document and must be consistent with it. Where a future design decision is visually plausible but conflicts with the principles here, this document wins until it is formally revised.

### 1.2 What this document does not own

- **Information hierarchy and navigation.** What exists, how it is grouped, and how the CEO moves through it is owned by [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md). This document styles that structure; it does not define it.
- **What the CEO sees and why.** The experiential contract — outcome language, approval moments, attention protection — is owned by [`EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md). This document gives that experience its visual voice.
- **Final assets.** No color values, type scales, spacing tokens, icon sets, or component specifications are created here. This document is direction, not delivery.
- **Vocabulary.** The words the product uses are governed by [`COMPANY_LANGUAGE_AND_GLOSSARY.md`](../glossary/COMPANY_LANGUAGE_AND_GLOSSARY.md). This document governs how those words are *presented*, never what they mean.

### 1.3 The non-negotiable feeling

Every section below serves one outcome: the product must feel **premium, calm, technical, and trustworthy**. If a visual choice is fashionable, clever, or expressive but undermines any of those four, it is the wrong choice. These four words are the acceptance test for this entire document.

---

## 2. Brand Attributes

The brand has five core attributes. They are ordered: when two attributes pull in different directions, the earlier one wins. Every visual decision should be defensible against this list.

| # | Attribute | Means | Does **not** mean |
|---|---|---|---|
| 1 | **Premium** | The restraint and material quality of a tool built for serious work; nothing feels cheap, templated, or rushed. | Luxury ornamentation, gold accents, or decorative flourish. |
| 2 | **Calm** | Quiet surfaces, generous space, low visual noise; the product never shouts or competes for attention. | Empty, sparse, or under-informative. Calm carries dense information gracefully. |
| 3 | **Technical** | Precision, legibility, and structural honesty; the product respects that its user understands engineering. | Cold, intimidating, or jargon-heavy. Technical credibility, not technical theater. |
| 4 | **Trustworthy** | Consistency, predictability, and truthful status; the interface never overstates, never fakes, never surprises. | Conservative or boring. Trust is built through reliability, not timidity. |
| 5 | **Alive** | A sense that a real, capable organization is at work behind the surface; the product has presence and momentum. | Theatrical, animated mascots, or personified roleplay. (See [§9](#9-employee-representation-principles).) |

### 2.1 The one-sentence brand

> Engineering OS looks like the internal tooling a world-class engineering organization would build for its own CEO — calm, exact, and quietly powerful.

### 2.2 What the brand is reacting against

The brand is defined as much by what it refuses to be. Engineering OS is **not** a chatbot, **not** an AI gadget, **not** a developer toy, and **not** a generic SaaS admin panel. Its visual language must read, at a glance, as *a company* — not as a feature wrapped in a UI. This is the same inversion that governs the [executive experience](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#1-product-philosophy): the company is the product, not the model.

---

## 3. Visual Principles

These principles govern every visual decision. They are derived from the brand attributes and from the experience principles in [`EXECUTIVE_USER_EXPERIENCE.md` §9](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles). When principles conflict, the earlier one wins.

**3.1 Content is the interface.** The work — outcomes, status, decisions, memory — is the hero. Chrome, decoration, and structure recede so the substance stands forward. If a visual element is not carrying information or aiding comprehension, it is a candidate for removal.

**3.2 Restraint over expression.** The default answer to "should we add this?" is no. A premium feeling comes from what is left out. Borders, shadows, gradients, and color are spent sparingly, like a budget, and only where they earn their place by clarifying structure or directing attention.

**3.3 Hierarchy through space and weight, not lines and boxes.** Structure is communicated primarily through spacing, alignment, and typographic weight — not through heavy dividers, nested cards, or boxed-in regions. The result reads as composed, not partitioned.

**3.4 One clear focal point per view.** Echoing [IA principle 1.2](../architecture/INFORMATION_ARCHITECTURE.md#1-information-architecture-principles), each screen has a single primary subject. The visual design makes that subject unmistakable and lets everything else support it. Competing focal points are a design defect.

**3.5 Calm under density.** The product carries a real company's worth of information. Calm is not achieved by hiding data; it is achieved by organizing it. Density and calm coexist through rhythm, alignment, and consistent grouping.

**3.6 Truthful state, always.** Visual status must reflect real state and nothing more. Nothing is styled to look more finished, more certain, or more active than it is. This is the visual expression of the company's [quality-gate honesty](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles) — the interface never dresses up an in-progress run as a completed one.

**3.7 Consistency is a feature.** A pattern, once chosen, is used everywhere it applies. Predictability is part of trustworthiness; novelty for its own sake erodes it. The same object looks the same wherever it appears.

**3.8 Never expose the machine.** Consistent with [EUX 9.3](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles), the visuals never surface branches, PRs, file paths, model names, prompts, or pipeline mechanics as first-class visual objects. The runtime stays behind the curtain; the company stays in front of it.

---

## 4. Typography Direction

Typography is the single most important visual system in Engineering OS. The product is overwhelmingly text — outcomes, status, briefs, memory, decisions — and the quality of the type *is* the quality of the product. Typography carries more of the premium-and-technical feeling than color or imagery ever will.

### 4.1 Direction

- **Two typefaces, at most.** A precise, highly legible **sans-serif** for nearly everything (UI, prose, data), and a **monospace** reserved for genuinely technical, fixed-width content (identifiers, code-adjacent values, structured data). Two families is the ceiling, not the target; one excellent sans plus one mono is ideal.
- **Sans-serif character.** Choose a neutral, modern, engineering-grade sans with excellent legibility at small sizes, a tall x-height, unambiguous letterforms (clearly distinct `1`, `l`, `I`, `0`, `O`), and a full, well-hinted weight range. It should feel like precision instrumentation, not like marketing.
- **Monospace is a tool, not a theme.** Monospace signals "this is a literal, technical value." It must never be used to make the product *feel* like a terminal or a code editor. A product that looks like an IDE has failed the brand.

### 4.2 Hierarchy

- Express hierarchy through a **restrained, deliberate scale** with clear, large steps between levels — not through many neighboring sizes. A few distinct sizes used consistently outperform a continuous gradient of nearly-equal sizes.
- Lean on **weight and color** to separate primary from secondary information before reaching for size. A heavier weight or a calmer tone often does the work a larger size would do more loudly.
- Reserve the largest sizes for genuine page subjects and key numbers. Oversized type used decoratively reads as marketing and breaks the calm.

### 4.3 Legibility and rhythm

- Set comfortable line lengths for prose (long, unbroken text should not run the full width of a wide screen) and generous line height for reading passages such as briefs and memory records.
- Numbers — counts, durations, metrics — should use tabular (fixed-width) figures wherever they appear in lists, tables, or live-updating positions, so values stay aligned and do not jitter.
- Default to comfortable, never cramped. Tight tracking and small sizes used to fit more on screen trade away the premium feeling for density that calm layout should have solved instead.

### 4.4 Tone of voice in type

The words are governed by the [glossary](../glossary/COMPANY_LANGUAGE_AND_GLOSSARY.md) and the [experience contract](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md); typography presents them. Status reads as calm fact, not as exclamation. Headings are plain and confident, not promotional. The type never adds urgency, excitement, or personality that the words themselves do not carry.

---

## 5. Color Direction

Color in Engineering OS is **functional, not decorative**. It exists to communicate structure, state, and attention — never to entertain. A largely neutral product punctuated by deliberate, meaningful color reads as far more premium and trustworthy than a colorful one.

### 5.1 Direction

- **A deep neutral foundation.** The product is built on a refined neutral palette — a calm range of grays, near-blacks, and off-whites with subtle, intentional temperature. Neutrals carry the overwhelming majority of every screen. This is the quiet office, not the showroom.
- **Dark and light are both first-class.** The visual system should be designed so a dark theme and a light theme are equally considered, equally calm, and equally legible — neither an afterthought. Both express the same brand; neither is a mere inversion of the other.
- **One restrained accent.** A single, confident accent color carries primary actions and identity moments. The accent is used sparingly enough that it always means *this matters*. A product with many accent colors has no accent at all.

### 5.2 Semantic color

Color carries meaning, and that meaning is fixed and consistent everywhere. The product needs a small, stable set of semantic roles:

| Role | Communicates | Usage discipline |
|---|---|---|
| **Neutral** | Default surfaces, text, structure | The vast majority of every screen. |
| **Accent / primary** | The one most important action or identity moment | Rare; reserved so it always signals importance. |
| **Positive** | Completion, healthy state, passing gates | Confirmation, never celebration. |
| **Attention** | Needs the CEO — approvals, decisions, waiting | Reserved for genuine [attention moments](../ceo-experience/PRODUCT_ALERTS.md); not for routine activity. |
| **Caution / risk** | Degraded health, blocked work, elevated risk | Honest signal, never alarmist styling. |
| **Critical** | Incidents, failures requiring response | The loudest color the product owns; used least. |

### 5.3 Discipline

- Semantic colors mean the same thing in every surface. "Attention" must never decorate something that does not actually need the CEO — that would violate [attention protection](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles) at the visual layer.
- Color is never the *only* signal. State must also be legible through text and shape, so the product remains comprehensible to color-blind users and in any rendering condition. Accessibility is engineering, per the [company constitution](../company/COMPANY_OPERATING_SYSTEM.md#the-company-constitution); contrast and non-color redundancy are requirements, not enhancements.
- Avoid large saturated fields. Bright color belongs in small, deliberate marks — a status dot, an action, a count — not as a background wash.

---

## 6. Spacing and Layout Principles

Space is the primary tool for achieving calm. A premium, technical product is recognizable by its generous, *consistent* whitespace and its disciplined alignment far more than by any single element.

**6.1 Space is structure.** Grouping, separation, and hierarchy are communicated first through spacing — not through borders, cards, or rules. Related things sit close; unrelated things sit apart. A reader should perceive structure before noticing a single line.

**6.2 A consistent spatial rhythm.** All spacing derives from one consistent scale, so vertical and horizontal rhythm feel composed rather than arbitrary. Ad-hoc, one-off spacing values are how a product starts to feel cheap.

**6.3 Generosity over compression.** When in doubt, add space. Cramped layouts read as anxious and low-quality; breathing room reads as confident and premium. Density is achieved through organization, never through removing space.

**6.4 Strong alignment, few columns.** Content aligns to a clear, restrained grid. Strong left alignment and a small number of well-defined columns outperform complex, decorative grids. Optical alignment matters — things that should line up must actually line up.

**6.5 Calm under density (visual restatement of 3.5).** The work board, dashboard, and memory views carry a real company's information. Layout earns its keep by making dense data scannable: consistent row rhythm, clear column alignment, predictable grouping. The CEO should be able to take in a screen at a glance and drill in only when they choose — the [breadth-first, depth-on-demand](../architecture/INFORMATION_ARCHITECTURE.md#1-information-architecture-principles) model made visual.

**6.6 Restraint with containers.** Cards, panels, and boxes are used only when grouping genuinely requires a contained surface — not as the default unit of layout. A screen made entirely of nested boxes is partitioned, not composed. Prefer space and alignment; reach for a container last.

**6.7 Responsive without rearranging meaning.** Layout adapts to viewport, but the information hierarchy and focal point stay constant across sizes. The same view never tells a different story on a narrower screen.

---

## 7. Iconography Principles

Icons support comprehension; they never carry the brand on their own. In a calm, text-led product, iconography is quiet and consistent.

**7.1 One coherent icon system.** All icons come from a single family with consistent stroke weight, corner treatment, and optical sizing. Mixing icon styles is an immediate, visible quality failure.

**7.2 Line-based, precise, and restrained.** Icons are clean and geometric, matching the technical-and-precise attribute. They are functional marks, not illustrations, and never cartoonish, playful, or skeuomorphic.

**7.3 Meaning, not decoration.** An icon appears only when it speeds recognition — a status, an object type, an action. Icons placed purely for visual interest add noise and are removed. Every icon should still make sense if you covered its label, and the label should still make sense if you covered the icon.

**7.4 Icons never replace words for consequence.** Any action with real consequence — approve, reject, release — is labeled in [company language](../glossary/COMPANY_LANGUAGE_AND_GLOSSARY.md), not represented by an icon alone. Icons assist comprehension; they never gate a decision behind a guess.

**7.5 Object identity is consistent.** Where the [domain](../architecture/INFORMATION_ARCHITECTURE.md#5-object-hierarchy) has recurring object types — outcome, project, feature, task, review, release, memory — each may carry a consistent visual mark so the same object is recognizable wherever it appears. That mark is the same everywhere or it is nowhere.

---

## 8. Motion Principles

Motion in Engineering OS communicates **continuity and life**, not delight. The company runs continuously — often unattended — and tasteful motion conveys that something real is happening without ever becoming a performance.

**8.1 Motion has a job.** Every animation must serve a purpose: orient the user during a transition, draw the eye to a genuine state change, or confirm an action. Motion that exists only to impress is removed.

**8.2 Fast, soft, and quiet.** Transitions are brief and gently eased — present enough to feel intentional, short enough never to make the user wait. Nothing bounces, spins for show, or demands attention it has not earned. Calm extends to time, not only to space.

**8.3 Reflect the living company, restrained.** The sense that the company is *alive* (brand attribute 5) is conveyed through subtle, continuous signals — work advancing, status settling, fresh activity arriving — not through theatrical flourishes. A status that changes because real work progressed may settle into place softly; it never celebrates.

**8.4 State changes are legible, not dramatic.** When something genuinely changes — a gate passes, an approval lands, a run completes — motion may briefly mark it so the CEO notices. The emphasis is proportional to the event's real importance and never manufactured.

**8.5 Respect attention and preference.** Motion never blocks, never repeats distractingly, and never competes with reading. The product honors reduced-motion preferences fully — with motion minimized, nothing essential is lost. This is the visual form of [protecting the CEO's attention](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles).

---

## 9. Employee Representation Principles

Engineering OS is staffed by a real [organizational structure](../company/COMPANY_OPERATING_SYSTEM.md#organizational-model) of specialized employees. How those employees are represented visually is a defining brand decision — and the place the brand is most at risk of betraying itself. The rule is firm: **alive, never theatrical** ([EUX 9.7](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles)).

**9.1 Employees are professionals, not characters.** An employee is presented as a competent member of an organization — a name, a role, a department, a current activity — the way a real company directory or staffing view would present a teammate. They are never presented as a mascot, avatar persona, or animated character.

**9.2 No personification theater.** No cartoon faces, no emotive avatars, no "thinking" animations performing personality, no speech bubbles, no costumes, no anthropomorphic flourishes. The product must never feel like roleplay. An employee "working" is shown as a calm status — *Implementing: Payment API endpoint* — not as a character acting out labor.

**9.3 Represent work, not performance.** What the CEO sees is the employee's *contribution*: what they are doing, on which [project and feature](../architecture/INFORMATION_ARCHITECTURE.md#9-company-structure), for how long, and what they have produced. The visual weight is on the work and its state, exactly as the [dashboard's Active Work](../architecture/INFORMATION_ARCHITECTURE.md#8-dashboard-structure) section frames it.

**9.4 Quiet, consistent identity.** An employee may carry a restrained, consistent visual identity — typically initials or a simple role mark in the neutral palette, optionally tinted by department. This aids recognition across the product. It is identity, not illustration; the same employee looks the same everywhere.

**9.5 Confidence without overclaiming.** Employees communicate with [professional structure](../company/COMPANY_OPERATING_SYSTEM.md#employee-communication-protocol) — recommendation, reasoning, risks, confidence. The visual treatment matches: clear, calm, and never styled to imply more certainty, autonomy, or humanity than is real. The interface never dresses up a deterministic or stubbed step as something more than it is, consistent with [truthful state](#3-visual-principles).

**9.6 The team is felt, not staged.** The cumulative impression should be of a capable team quietly at work — the calm elite office. That impression comes from honest, consistent representation of real activity across the product, not from any single dramatized employee surface.

---

## 10. Anti-Patterns

These are explicit prohibitions. Each describes a tempting choice that would betray the brand. A design that exhibits any of these is wrong regardless of how polished it looks.

| Anti-pattern | Why it is forbidden |
|---|---|
| **Chatbot framing** — a conversational thread as the primary surface, chat bubbles, a blinking cursor as the product's identity | Engineering OS is a company, not a chat assistant. The primary surface is the company's state, not a conversation. |
| **IDE / terminal cosplay** — monospace everything, code-editor chrome, terminal-green-on-black as a theme | The CEO is not an operator of a code tool. Monospace and code surfaces are reserved technical details, never the look of the product. |
| **Generic admin dashboard** — boxed widget grids, gauge clusters, rainbow charts, "template" SaaS styling | The product must feel like bespoke internal tooling for an elite org, not an off-the-shelf admin panel. |
| **Issue-tracker mimicry** — dense ticket rows, status-label soup, raw board mechanics as the hero | The CEO sees outcomes, not tickets. Project-management chrome contradicts the [executive experience](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md). |
| **Employee theater** — avatars with faces, mascots, emotive or "typing" animations, roleplay personas | Violates [§9](#9-employee-representation-principles) and the *alive, not theatrical* principle. The fastest way to make the product feel like a toy. |
| **Decoration for its own sake** — gratuitous gradients, glows, glassmorphism, illustration, hero imagery | Premium comes from restraint. Ornament reads as marketing and erodes the calm, technical feeling. |
| **Color as entertainment** — many accent colors, large saturated fields, color without meaning | Color is functional. Decorative color destroys the semantic system and the calm neutral foundation. |
| **Motion as spectacle** — bouncing, spinning, looping, attention-grabbing animation | Motion serves continuity and confirmation. Spectacle competes with attention and breaks the calm. |
| **Exposing the machine** — branches, PR numbers, file paths, model names, pipeline status as visible UI | Violates [visual principle 3.8](#3-visual-principles) and [EUX 9.3](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md#9-experience-principles). The runtime stays invisible. |
| **Fake polish on unreal state** — styling something to look more finished, certain, or autonomous than it is | Violates [truthful state](#3-visual-principles). Trust is the brand; dishonest visuals destroy it permanently. |
| **Inconsistency** — multiple icon styles, ad-hoc spacing, the same object looking different in two places | Consistency is a feature. Visible inconsistency reads as low quality and undermines trustworthiness. |

---

## 11. Inspiration References

These references set a **quality bar**, not a visual template. The instruction is to study *why* each is excellent and meet that standard — never to copy a look. Engineering OS must look like itself.

| Reference class | What to learn from it | What **not** to take |
|---|---|---|
| **Premium developer and infrastructure tooling** (the best-in-class engineering platforms) | Calm density, restraint, semantic color discipline, type-led hierarchy, dark/light parity | Their specific palettes, layouts, or component shapes. |
| **High-end reading and writing tools** | Typographic craft, generous space, comfortable reading rhythm, quiet chrome | Editorial or document-centric framing of the whole product. |
| **Professional financial and operations terminals** | Information density handled with calm, tabular precision, trustworthy real-time state | Their coldness, complexity, or expert-operator assumptions. |
| **Considered productivity and knowledge products** | Coherent systems, predictable patterns, the feeling of a single deliberate hand | Their playfulness, illustration, or consumer-app personality. |
| **World-class internal tooling** (the bespoke tools elite orgs build for themselves) | The exact target feeling: precise, unflashy, deeply competent, built for serious work | Any specific brand identity — this product has its own. |

The synthesis to aim for: **the typographic and spatial craft of the best reading tools, the semantic restraint and dark/light rigor of the best developer platforms, and the calm density of a professional terminal — assembled into something that feels like a company, not a tool.**

---

## 12. How to Use This Document

This document is the reference a designer or engineer consults *before* making a visual decision and *to settle* a visual disagreement.

1. **Before building any UI**, read the [brand attributes](#2-brand-attributes) and [visual principles](#3-visual-principles). They are the lens for every subsequent choice.
2. **When choosing between two acceptable options**, pick the one more consistent with the ordered brand attributes — premium and calm before clever and expressive.
3. **When tempted to add something**, check it against the [anti-patterns](#10-anti-patterns) first. The default is to leave it out.
4. **When building the design system**, treat every section here as a constraint the system must satisfy. The design system turns this direction into tokens, components, and specifications; it does not get to contradict it.
5. **When this document and a visual decision conflict**, this document wins until it is formally revised through the same review that approved it.

This is a living foundation. It will be extended — not casually overridden — as the [design system](#13-relationship-to-other-documents) work it guides matures.

---

## 13. Relationship to Other Documents

- [`EXECUTIVE_USER_EXPERIENCE.md`](../ceo-experience/EXECUTIVE_USER_EXPERIENCE.md) — defines *what the CEO experiences and why*. This document gives that experience its visual voice; its experience principles are the parents of the visual principles here.
- [`INFORMATION_ARCHITECTURE.md`](../architecture/INFORMATION_ARCHITECTURE.md) — defines *what exists and how it is organized*. This document styles that structure; it never redefines it.
- [`COMPANY_DASHBOARD.md`](../ceo-experience/COMPANY_DASHBOARD.md), [`COMPANY_TIMELINE.md`](../ceo-experience/COMPANY_TIMELINE.md), [`PRODUCT_ALERTS.md`](../ceo-experience/PRODUCT_ALERTS.md) — specify individual CEO surfaces. They consume this foundation and must be consistent with it.
- [`COMPANY_OPERATING_SYSTEM.md`](../company/COMPANY_OPERATING_SYSTEM.md) — defines the company, its constitution, and its organizational model. The brand visualizes that company; the employee-representation principles trace directly to it.
- [`COMPANY_LANGUAGE_AND_GLOSSARY.md`](../glossary/COMPANY_LANGUAGE_AND_GLOSSARY.md) — owns the words. This document owns how the words are presented; it never changes their meaning.
- [`PRODUCT_REQUIREMENTS.md`](../product/PRODUCT_REQUIREMENTS.md) — owns product principles and scope. The visual foundation is downstream of those principles and consistent with them.
- **Future design system** — the next layer of work. It will translate this direction into concrete tokens, components, and specifications. This document is the brief that work answers to.
