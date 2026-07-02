/**
 * Release readiness gate.
 *
 * `markReleased` previously flipped a release to released/deployed
 * unconditionally. This module evaluates the release checklist so a release
 * can only be marked released when every checklist item is actually checked.
 */

/** One checklist entry as stored in `Release.checklist` (a JSON array). */
export interface ReleaseChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
}

/** Result of evaluating a release checklist for release readiness. */
export interface ReleaseReadiness {
  /** True when every checklist item is checked (and the JSON was readable). */
  readonly ready: boolean;
  /** Labels of unchecked items, for a truthful error message. */
  readonly missing: readonly string[];
}

/**
 * Parses a stored release checklist JSON into typed items.
 *
 * @param checklistJson - Raw `Release.checklist` column value.
 * @returns Valid checklist items; invalid/unreadable input yields [].
 */
export function parseReleaseChecklist(
  checklistJson: string | null | undefined
): ReleaseChecklistItem[] {
  if (!checklistJson) return [];
  try {
    const parsed = JSON.parse(checklistJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ReleaseChecklistItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ReleaseChecklistItem).id === "string" &&
        typeof (item as ReleaseChecklistItem).label === "string" &&
        typeof (item as ReleaseChecklistItem).checked === "boolean"
    );
  } catch {
    return [];
  }
}

/**
 * Evaluates whether a release may be marked released.
 *
 * An empty (or unreadable) checklist is NOT ready — a release with no
 * verifiable checklist must not silently pass the gate.
 *
 * @param checklistJson - Raw `Release.checklist` column value.
 * @returns Readiness plus the unchecked item labels.
 *
 * @example
 * ```ts
 * const readiness = assessReleaseReadiness(release.checklist);
 * if (!readiness.ready) return { error: `Unchecked: ${readiness.missing.join(", ")}` };
 * ```
 */
export function assessReleaseReadiness(
  checklistJson: string | null | undefined
): ReleaseReadiness {
  const items = parseReleaseChecklist(checklistJson);
  if (items.length === 0) {
    return { ready: false, missing: ["release checklist is missing or empty"] };
  }
  const missing = items.filter((item) => !item.checked).map((item) => item.label);
  return { ready: missing.length === 0, missing };
}
