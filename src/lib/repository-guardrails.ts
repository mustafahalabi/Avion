/**
 * Repository Guardrails
 *
 * Validation rules that prevent the Claude Code worker from making dangerous
 * changes to a repository. Guards cover three surfaces:
 *
 * 1. Files — patterns for sensitive or infrastructure-critical paths.
 * 2. Branches — prevents direct pushes to protected branch names.
 * 3. Commands — blocks shell commands that are destructive or irreversible.
 *
 * All checks are pure functions with no I/O and no external dependencies.
 */

import { isProtectedBranch } from "@/lib/implementation-brief";

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Glob-style patterns that are always blocked.
 *
 * Matching is performed with a simple minimatch-like algorithm that supports
 * `*` (any non-separator characters) and `**` (any characters including `/`).
 * Patterns may be anchored with a leading `/` but this is not required.
 */
export const PROTECTED_FILE_PATTERNS = [
  // Environment and secret files
  ".env*",
  "*.key",
  "*.pem",
  "*.p12",
  "*.pfx",

  // Database migration history — should never be hand-edited
  "prisma/migrations/**",

  // CI/CD pipeline definitions
  ".github/workflows/**",

  // Lockfiles — must be managed by the package manager, not edited directly
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",

  // Secret directories
  "**/secrets/**",
  "**/credentials/**",
] as const;

/**
 * Branch names (or glob patterns) that are always protected.
 *
 * Direct implementation work must never target these branches.
 */
export const PROTECTED_BRANCHES = [
  "master",
  "main",
  "release/*",
  "hotfix/*",
] as const;

// ─── Dangerous command fragments ──────────────────────────────────────────────

/**
 * Shell command fragments that are unconditionally blocked regardless of context.
 * Matching is case-insensitive substring / regex check.
 */
const BLOCKED_COMMAND_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly rule: string;
  readonly message: string;
}> = [
  {
    pattern: /rm\s+-[^\s]*r[^\s]*\s+-[^\s]*f[^\s]*|rm\s+-[^\s]*f[^\s]*\s+-[^\s]*r[^\s]*|rm\s+-rf|rm\s+-fr/i,
    rule: "no-rm-rf",
    message: "Recursive force deletion (rm -rf) is not permitted.",
  },
  {
    pattern: /git\s+push\s+.*--force(?:-with-lease)?/i,
    rule: "no-force-push",
    message: "Force-pushing to a remote branch is not permitted.",
  },
  {
    pattern: /git\s+reset\s+--hard/i,
    rule: "no-git-reset-hard",
    message: "Hard git resets are not permitted — they permanently discard history.",
  },
  {
    pattern: /DROP\s+TABLE/i,
    rule: "no-drop-table",
    message: "DROP TABLE is not permitted — use a migration to alter schema.",
  },
  {
    pattern: /DELETE\s+FROM\s+\w+\s*(?:;|$)/i,
    rule: "no-unbounded-delete",
    message: "DELETE FROM without a WHERE clause is not permitted.",
  },
];

// ─── Interfaces ────────────────────────────────────────────────────────────────

/**
 * A single rule violation produced by a guardrail check.
 */
export interface GuardrailViolation {
  /** Machine-readable rule identifier. */
  readonly rule: string;
  /**
   * `'block'` — the action must be prevented entirely.
   * `'warn'` — the action is allowed but the operator should be notified.
   */
  readonly severity: "block" | "warn";
  /** File path involved in the violation, when applicable. */
  readonly path?: string;
  /** Branch name involved in the violation, when applicable. */
  readonly branch?: string;
  /** Human-readable explanation of the violation. */
  readonly message: string;
}

/**
 * The aggregate result of one or more guardrail checks.
 */
export interface GuardrailCheckResult {
  /**
   * `true` only when there are zero `'block'`-severity violations.
   * Warn-only violations do not cause failure.
   */
  readonly passed: boolean;
  /** All violations collected during the check, ordered by discovery. */
  readonly violations: readonly GuardrailViolation[];
}

// ─── Pattern Matching ──────────────────────────────────────────────────────────

/**
 * Converts a guardrail glob pattern to a RegExp.
 *
 * Supported wildcards:
 * - `**` — matches any sequence of characters including path separators.
 * - `*`  — matches any sequence of characters except `/`.
 * - `?`  — matches any single character except `/`.
 *
 * Patterns are matched against the full normalised path (forward slashes).
 *
 * @param pattern - Glob pattern string.
 * @returns RegExp that matches the pattern.
 */
function globToRegExp(pattern: string): RegExp {
  // Normalise path separators
  const normalised = pattern.replace(/\\/g, "/");

  let regexStr = "";
  let i = 0;

  while (i < normalised.length) {
    const char = normalised[i];

    if (char === "*") {
      if (normalised[i + 1] === "*") {
        // `**` — any characters including separators
        regexStr += ".*";
        i += 2;
        // Consume trailing separator if present
        if (normalised[i] === "/") {
          i++;
        }
        continue;
      } else {
        // `*` — any non-separator characters
        regexStr += "[^/]*";
      }
    } else if (char === "?") {
      regexStr += "[^/]";
    } else if (char === ".") {
      regexStr += "\\.";
    } else if (/[+^${}()|[\]\\]/.test(char)) {
      regexStr += "\\" + char;
    } else {
      regexStr += char;
    }

    i++;
  }

  // Allow matching against the full path or just a filename segment
  return new RegExp(`(?:^|/)${regexStr}$`, "i");
}

/**
 * Returns `true` when `filePath` matches any of the provided glob patterns.
 *
 * @param filePath - Forward-slash-normalised file path to test.
 * @param patterns - Array of glob patterns to check against.
 */
function matchesAnyPattern(filePath: string, patterns: readonly string[]): boolean {
  const normalised = filePath.replace(/\\/g, "/").replace(/^\//, "");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalised));
}

/**
 * Returns `true` when `branchName` matches a protected branch pattern.
 *
 * Delegates to `isProtectedBranch` from `implementation-brief` for `main`,
 * `master`, and `release/*` patterns, then adds `hotfix/*` detection.
 *
 * @param branchName - Branch name to check.
 */
function isBranchProtected(branchName: string): boolean {
  if (isProtectedBranch(branchName)) return true;
  if (/^hotfix\//.test(branchName)) return true;
  return false;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Checks a list of file paths against the protected file patterns.
 *
 * Each file that matches at least one pattern produces a `'block'`-severity
 * violation. The result fails (`passed: false`) if any violations are found.
 *
 * @param filePaths - Paths of the files the agent intends to read or modify.
 * @returns Aggregated guardrail check result.
 *
 * @example
 * ```ts
 * const result = checkFileGuardrails([".env.local", "src/index.ts"]);
 * // result.passed === false (because .env.local matches ".env*")
 * // result.violations[0].rule === "protected-file"
 * // result.violations[0].path === ".env.local"
 * ```
 */
export function checkFileGuardrails(filePaths: string[]): GuardrailCheckResult {
  const violations: GuardrailViolation[] = [];

  for (const filePath of filePaths) {
    if (matchesAnyPattern(filePath, PROTECTED_FILE_PATTERNS)) {
      violations.push({
        rule: "protected-file",
        severity: "block",
        path: filePath,
        message: `File path "${filePath}" matches a protected pattern and cannot be modified by an automated agent.`,
      });
    }
  }

  return buildResult(violations);
}

/**
 * Checks whether the given branch name is a protected branch that should not
 * be used as an implementation target.
 *
 * @param branchName - Git branch name to validate.
 * @returns Guardrail check result with a single violation when blocked.
 *
 * @example
 * ```ts
 * checkBranchGuardrail("master").passed; // false
 * checkBranchGuardrail("release/v2").passed; // false
 * checkBranchGuardrail("feature/MUS-186-guardrails").passed; // true
 * ```
 */
export function checkBranchGuardrail(branchName: string): GuardrailCheckResult {
  if (!isBranchProtected(branchName)) {
    return buildResult([]);
  }

  return buildResult([
    {
      rule: "protected-branch",
      severity: "block",
      branch: branchName,
      message: `Branch "${branchName}" is protected. Implementation agents must work on a feature branch, not directly on a protected branch.`,
    },
  ]);
}

/**
 * Checks a shell command string against the list of blocked command patterns.
 *
 * Each match produces a `'block'`-severity violation.
 *
 * Note: `DELETE FROM` without a `WHERE` clause is blocked. Statements that
 * include a `WHERE` keyword are permitted.
 *
 * @param command - Raw shell command string to validate.
 * @returns Guardrail check result.
 *
 * @example
 * ```ts
 * checkCommandGuardrail("rm -rf /tmp/build").passed;     // false
 * checkCommandGuardrail("git push --force origin main").passed; // false
 * checkCommandGuardrail("git push origin feature/abc").passed;  // true
 * checkCommandGuardrail("DELETE FROM users WHERE id = 1").passed; // true
 * checkCommandGuardrail("DELETE FROM users;").passed;    // false
 * ```
 */
export function checkCommandGuardrail(command: string): GuardrailCheckResult {
  const violations: GuardrailViolation[] = [];

  for (const { pattern, rule, message } of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      violations.push({
        rule,
        severity: "block",
        message: `Command blocked — ${message} Offending command: "${command.trim()}"`,
      });
    }
  }

  return buildResult(violations);
}

/**
 * Runs all available guardrail checks and merges the violations into a single result.
 *
 * Accepts an object with optional lists of file paths, a branch name, and
 * command strings. All provided inputs are checked; missing inputs are skipped.
 *
 * The result fails (`passed: false`) if any single check produces a
 * `'block'`-severity violation.
 *
 * @param input - Inputs to validate.
 * @param input.filePaths - File paths to validate against protected patterns.
 * @param input.branchName - Branch name to validate.
 * @param input.commands - Shell commands to validate against blocked patterns.
 * @returns Merged guardrail check result.
 *
 * @example
 * ```ts
 * const result = runAllGuardrails({
 *   filePaths: ["src/index.ts", ".env"],
 *   branchName: "feature/MUS-186-guardrails",
 *   commands: ["npm run build"],
 * });
 * // result.passed === false   (.env is blocked)
 * // result.violations.length === 1
 * ```
 */
export function runAllGuardrails(input: {
  filePaths?: string[];
  branchName?: string;
  commands?: string[];
}): GuardrailCheckResult {
  const violations: GuardrailViolation[] = [];

  if (input.filePaths && input.filePaths.length > 0) {
    violations.push(...checkFileGuardrails(input.filePaths).violations);
  }

  if (input.branchName !== undefined && input.branchName !== "") {
    violations.push(...checkBranchGuardrail(input.branchName).violations);
  }

  if (input.commands && input.commands.length > 0) {
    for (const command of input.commands) {
      violations.push(...checkCommandGuardrail(command).violations);
    }
  }

  return buildResult(violations);
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Constructs a `GuardrailCheckResult` from a flat list of violations.
 *
 * The result passes only when there are no `'block'`-severity violations.
 */
function buildResult(violations: readonly GuardrailViolation[]): GuardrailCheckResult {
  const passed = violations.every((v) => v.severity !== "block");
  return { passed, violations };
}
