/**
 * Company culture → engineering guidance.
 *
 * `CompanySettings.cultureProfile` is a CEO-chosen culture (Startup / Enterprise
 * / Design First / Performance First). This module turns that choice into
 * concrete, actionable guidance that is injected into BOTH the AI planning
 * prompt and the execution brief the coding agent reads — so two companies with
 * different cultures actually produce materially different plans and
 * implementations (MUS-288). Previously the picker was inert.
 *
 * Pure + dependency-free so it's shared by the planner, the brief builder, and
 * their tests. An unknown/empty culture yields `null` (no guidance section).
 */

/** Concrete guidance derived from a company culture. */
export interface CultureGuidance {
  /** The stored culture value (e.g. "security-first"). */
  readonly value: string;
  /** Human-readable label (e.g. "Enterprise"). */
  readonly label: string;
  /** One-line planner directive (how to bias the work breakdown). */
  readonly summary: string;
  /** Actionable directives for the implementation brief. */
  readonly directives: readonly string[];
}

const CULTURE_GUIDANCE: Readonly<Record<string, CultureGuidance>> = {
  startup: {
    value: "startup",
    label: "Startup",
    summary:
      "Move fast and keep it simple — favor the smallest change that meets the outcome.",
    directives: [
      "Prefer the smallest change that satisfies the acceptance criteria — avoid over-engineering, speculative abstraction, and gold-plating.",
      "Bias to shipping: pragmatic, readable code over exhaustive handling of edge cases the outcome does not require.",
    ],
  },
  enterprise: {
    value: "enterprise",
    label: "Enterprise",
    summary:
      "Favor rigor — thorough validation, security, error handling, and documentation.",
    directives: [
      "Validate inputs and enforce authorization on any new or changed access path.",
      "Handle errors explicitly and update documentation for behavior you change.",
      "Prefer explicit, well-tested, maintainable code over cleverness.",
    ],
  },
  "design-first": {
    value: "design-first",
    label: "Design First",
    summary:
      "Prioritize user experience — accessibility, responsiveness, and UI polish.",
    directives: [
      "Prioritize UX in any UI you touch: accessible (a11y), responsive, and consistent with existing design patterns.",
      "Handle loading, empty, and error states explicitly rather than leaving them implicit.",
    ],
  },
  "performance-first": {
    value: "performance-first",
    label: "Performance First",
    summary:
      "Prioritize efficiency — avoid needless work, N+1 queries, and wasteful renders.",
    directives: [
      "Avoid N+1 queries and unnecessary work on hot paths; prefer efficient data access.",
      "Be mindful of allocations and re-renders, and call out any performance-sensitive change you make.",
    ],
  },
};

/**
 * Resolves the guidance for a company culture value.
 *
 * @param culture - `CompanySettings.cultureProfile` (may be null/unknown).
 * @returns The culture's guidance, or `null` when unset or unrecognized.
 */
export function getCultureGuidance(
  culture: string | null | undefined
): CultureGuidance | null {
  if (!culture) return null;
  return CULTURE_GUIDANCE[culture] ?? null;
}
