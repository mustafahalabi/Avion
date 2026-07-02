/**
 * Client-safe (no prisma import) deterministic workspace badge colours. Keeps
 * the same workspace tinted consistently across the projects list, repositories
 * list, and the workspaces index without storing a colour on the model.
 */

const PALETTE = [
  "bg-neutral-950 text-neutral-300 border-neutral-900",
  "bg-blue-950 text-blue-300 border-blue-900",
  "bg-emerald-950 text-emerald-300 border-emerald-900",
  "bg-amber-950 text-amber-300 border-amber-900",
  "bg-rose-950 text-rose-300 border-rose-900",
  "bg-cyan-950 text-cyan-300 border-cyan-900",
  "bg-neutral-950 text-neutral-300 border-neutral-900",
  "bg-teal-950 text-teal-300 border-teal-900",
] as const;

/** Stable hash → palette entry so a workspace's badge colour never changes. */
export function workspaceBadgeClasses(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
