// ─── Types ────────────────────────────────────────────────────────────────────

export type QaCheckCategory =
  | "functional"
  | "regression"
  | "security"
  | "performance"
  | "ux"
  | "validation"
  | "files";

export interface QaCheckItem {
  readonly id: string;
  readonly category: QaCheckCategory;
  readonly label: string;
  readonly passed: boolean;
}

export interface QaChecklistInput {
  /** Acceptance criteria for the task (one string per criterion). */
  readonly acceptanceCriteria: readonly string[];
  /** Reviewer notes from the approved review. */
  readonly reviewNotes: string | null;
  /** Structured findings from the approved review. */
  readonly reviewFindings: readonly { severity: string; description: string }[];
  /** Relative file paths modified during implementation. */
  readonly filesChanged: readonly string[];
  /** Validation commands that must pass (e.g. tsc, lint, test). */
  readonly validationCommands: readonly string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UI_PATH_PATTERNS = [
  /\.tsx$/,
  /\.css$/,
  /\.module\.(css|scss)$/,
  /\/(app|components|pages|ui)\//,
];

const STANDARD_REGRESSION_CHECKS: readonly string[] = [
  "No regressions in existing functionality",
  "All existing tests continue to pass",
];

const STANDARD_SECURITY_CHECKS: readonly string[] = [
  "No new security vulnerabilities introduced",
  "Company ownership boundaries preserved",
  "No sensitive data exposed in logs or responses",
];

const STANDARD_PERFORMANCE_CHECKS: readonly string[] = [
  "No unintended performance regressions",
];

const UI_CHECKS: readonly string[] = [
  "UI changes render correctly",
  "No layout regressions visible",
  "Accessible to keyboard and screen reader users where applicable",
];

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generates a structured QA checklist from task and review data.
 *
 * Category breakdown:
 * - functional: one check per acceptance criterion
 * - validation: one check per validation command
 * - files: single check that only expected files were modified
 * - regression: standard regression checks (always included)
 * - security: standard security checks (always included)
 * - performance: standard performance check (always included)
 * - ux: UI-specific checks (only when UI files are detected)
 *
 * All items start with `passed: false`.
 * This function is pure — it performs no database access or I/O.
 */
export function generateQaChecklist(input: QaChecklistInput): readonly QaCheckItem[] {
  const items: QaCheckItem[] = [];
  let seq = 0;

  function item(category: QaCheckCategory, label: string): QaCheckItem {
    return { id: `qa-${category}-${++seq}`, category, label, passed: false };
  }

  // ── Functional: one check per acceptance criterion ──────────────────────────
  for (const criterion of input.acceptanceCriteria) {
    const text = criterion.trim();
    if (text) {
      items.push(item("functional", `AC met: ${text}`));
    }
  }

  if (input.acceptanceCriteria.length === 0) {
    items.push(item("functional", "Verify implementation matches task requirements"));
  }

  // ── Validation: one check per command ──────────────────────────────────────
  for (const cmd of input.validationCommands) {
    const text = cmd.trim();
    if (text) {
      items.push(item("validation", `Validation passes: ${text}`));
    }
  }

  // ── Files: single check ────────────────────────────────────────────────────
  if (input.filesChanged.length > 0) {
    items.push(
      item(
        "files",
        `Only expected files modified (${input.filesChanged.length} file${input.filesChanged.length !== 1 ? "s" : ""})`
      )
    );
  }

  // ── Regression ────────────────────────────────────────────────────────────
  for (const label of STANDARD_REGRESSION_CHECKS) {
    items.push(item("regression", label));
  }

  // ── Security ──────────────────────────────────────────────────────────────
  for (const label of STANDARD_SECURITY_CHECKS) {
    items.push(item("security", label));
  }

  // ── Performance ───────────────────────────────────────────────────────────
  for (const label of STANDARD_PERFORMANCE_CHECKS) {
    items.push(item("performance", label));
  }

  // ── UX: only when UI files detected ───────────────────────────────────────
  const hasUiFiles = input.filesChanged.some((f) =>
    UI_PATH_PATTERNS.some((p) => p.test(f))
  );
  if (hasUiFiles) {
    for (const label of UI_CHECKS) {
      items.push(item("ux", label));
    }
  }

  return items;
}

/**
 * Serializes a checklist to the JSON format stored in QAResult.checks.
 * Compatible with the existing `{ label: string; passed: boolean }[]` reader.
 */
export function serializeChecklist(items: readonly QaCheckItem[]): string {
  return JSON.stringify(items);
}

/**
 * Counts passed and failed items in a checklist.
 */
export function countChecklist(items: readonly QaCheckItem[]): {
  passed: number;
  failed: number;
  total: number;
} {
  const passed = items.filter((i) => i.passed).length;
  const total = items.length;
  return { passed, failed: total - passed, total };
}
