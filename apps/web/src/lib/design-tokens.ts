/**
 * Design Tokens
 *
 * Typed constants for Tailwind CSS utility classes derived from the
 * visual design system defined in globals.css.  Import these instead
 * of writing status/priority color strings ad-hoc so every consumer
 * stays in sync when the palette changes.
 */

// ─── Status colors ────────────────────────────────────────────────────────────

export const STATUS_COLORS = {
  todo:        "text-muted-foreground",
  in_progress: "text-info-500",
  in_review:   "text-warning-500",
  done:        "text-success-500",
  failed:      "text-danger-500",
  blocked:     "text-danger-600",
  cancelled:   "text-muted-foreground",
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

/** Returns the Tailwind text-color class for a given issue status slug. */
export function getStatusColor(status: string): string {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  return key in STATUS_COLORS
    ? STATUS_COLORS[key as StatusKey]
    : "text-muted-foreground";
}

// ─── Status background colors (for badges/chips) ──────────────────────────────

export const STATUS_BG_COLORS = {
  todo:        "bg-neutral-800 text-neutral-300 border-neutral-700",
  in_progress: "bg-info-950 text-info-400 border-info-800",
  in_review:   "bg-warning-950 text-warning-400 border-warning-800",
  done:        "bg-success-950 text-success-400 border-success-800",
  failed:      "bg-danger-950 text-danger-400 border-danger-800",
  blocked:     "bg-danger-950 text-danger-500 border-danger-700",
  cancelled:   "bg-neutral-900 text-neutral-500 border-neutral-800",
} as const;

export type StatusBgKey = keyof typeof STATUS_BG_COLORS;

/** Returns combined Tailwind bg/text/border classes for a status badge. */
export function getStatusBadgeClasses(status: string): string {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  return key in STATUS_BG_COLORS
    ? STATUS_BG_COLORS[key as StatusBgKey]
    : STATUS_BG_COLORS.todo;
}

// ─── Priority colors ──────────────────────────────────────────────────────────

export const PRIORITY_COLORS = {
  urgent: "text-danger-500",
  high:   "text-warning-500",
  medium: "text-info-500",
  low:    "text-muted-foreground",
  none:   "text-muted-foreground",
} as const;

export type PriorityKey = keyof typeof PRIORITY_COLORS;

/** Returns the Tailwind text-color class for a given issue priority label. */
export function getPriorityColor(priority: string): string {
  const key = priority.toLowerCase();
  return key in PRIORITY_COLORS
    ? PRIORITY_COLORS[key as PriorityKey]
    : "text-muted-foreground";
}

// ─── Priority background colors (for badges) ──────────────────────────────────

export const PRIORITY_BG_COLORS = {
  urgent: "bg-danger-950 text-danger-400 border-danger-800",
  high:   "bg-warning-950 text-warning-400 border-warning-800",
  medium: "bg-info-950 text-info-400 border-info-800",
  low:    "bg-neutral-800 text-neutral-400 border-neutral-700",
  none:   "bg-neutral-900 text-neutral-500 border-neutral-800",
} as const;

export type PriorityBgKey = keyof typeof PRIORITY_BG_COLORS;

/** Returns combined Tailwind bg/text/border classes for a priority badge. */
export function getPriorityBadgeClasses(priority: string): string {
  const key = priority.toLowerCase();
  return key in PRIORITY_BG_COLORS
    ? PRIORITY_BG_COLORS[key as PriorityBgKey]
    : PRIORITY_BG_COLORS.none;
}

// ─── Surface tokens ───────────────────────────────────────────────────────────

/** Tailwind background classes for the three surface elevation levels. */
export const SURFACE = {
  base:    "bg-surface-base",
  raised:  "bg-surface-raised",
  overlay: "bg-surface-overlay",
} as const;

// ─── Brand accent ─────────────────────────────────────────────────────────────

export const BRAND = {
  text:       "text-brand-500",
  textHover:  "hover:text-brand-400",
  bg:         "bg-brand-500",
  bgHover:    "hover:bg-brand-600",
  border:     "border-brand-500",
  ring:       "ring-brand-500",
} as const;

// ─── Radius tokens ────────────────────────────────────────────────────────────

export const RADIUS = {
  card:  "rounded-card",
  badge: "rounded-badge",
  chip:  "rounded-chip",
} as const;

// ─── Shadow tokens ────────────────────────────────────────────────────────────

export const SHADOW = {
  card:     "shadow-card",
  elevated: "shadow-elevated",
} as const;
