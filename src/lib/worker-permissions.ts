/**
 * Worker Permission Model
 *
 * Defines the permission system for Claude Code worker agents executing tasks
 * within Engineering OS. Controls which files the worker may write and which
 * shell commands it may run, scoped to the company's autonomy level.
 *
 * This module is intentionally free of external dependencies — it is pure
 * TypeScript with no database calls or I/O. Callers (e.g. execution-session-
 * service) import and apply these permissions at the edge of the execution layer.
 */

// ─── Permission Levels ────────────────────────────────────────────────────────

/**
 * Four discrete capability tiers for the worker agent.
 *
 * - `read_only`  — Agent may read files but not write or execute commands.
 * - `suggest`    — Agent may propose changes but not apply them without approval.
 * - `execute`    — Agent may apply changes to allowed paths and run allowed commands.
 * - `full`       — Agent has maximum autonomy within the configured allow/block lists.
 */
export type PermissionLevel = "read_only" | "suggest" | "execute" | "full";

export const PERMISSION_LEVELS: readonly PermissionLevel[] = [
  "read_only",
  "suggest",
  "execute",
  "full",
] as const;

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Resolved permission profile for a worker agent in a single execution session.
 *
 * All patterns follow micromatch / minimatch glob syntax. Blocked patterns
 * always take precedence over allowed patterns.
 */
export interface WorkerPermissions {
  /** Overall capability tier for this execution. */
  readonly permissionLevel: PermissionLevel;

  /**
   * Glob patterns that the worker is allowed to write.
   *
   * @example ["src/**", "tests/**", "*.config.ts"]
   */
  readonly allowedFilePatterns: readonly string[];

  /**
   * Glob patterns that are always blocked regardless of allowedFilePatterns.
   * Block list is evaluated after the allow list and always wins.
   *
   * @example [".env*", "*.key", "prisma/migrations/**"]
   */
  readonly blockedFilePatterns: readonly string[];

  /**
   * Command prefixes or full commands the worker is allowed to run.
   *
   * @example ["npm", "npx", "git"]
   */
  readonly allowedCommands: readonly string[];

  /**
   * Command strings that are always blocked regardless of allowedCommands.
   * Block list is evaluated after the allow list and always wins.
   *
   * @example ["rm -rf", "curl", "wget"]
   */
  readonly blockedCommands: readonly string[];

  /**
   * Maximum number of files the agent may touch in a single session.
   * Writes that would exceed this count must be rejected.
   */
  readonly maxFilesPerSession: number;

  /**
   * When the number of files in a proposed change exceeds this threshold the
   * agent must pause and request explicit CEO approval before continuing.
   */
  readonly requiresApprovalAbove: number;
}

/**
 * Result returned by path and command validation functions.
 */
export interface ValidationResult {
  readonly allowed: boolean;
  readonly reason: string;
}

// ─── Default Blocked Lists ────────────────────────────────────────────────────

/**
 * File patterns that are always blocked regardless of permission level.
 * These protect secrets, credentials, and irreversible migration artefacts.
 */
const DEFAULT_BLOCKED_FILE_PATTERNS: readonly string[] = [
  ".env",
  ".env.*",
  "*.key",
  "*.pem",
  "*.p12",
  "*.pfx",
  "*.crt",
  "*.cert",
  "*.secret",
  "prisma/migrations/**",
  ".git/**",
  "node_modules/**",
] as const;

/**
 * Command prefixes and strings that are always blocked regardless of permission
 * level. These prevent destructive or network-exfiltration operations.
 */
const DEFAULT_BLOCKED_COMMANDS: readonly string[] = [
  "rm -rf",
  "rm -r",
  "curl",
  "wget",
  "ssh",
  "scp",
  "ftp",
  "nc ",
  "netcat",
  "nmap",
  "sudo",
  "su ",
  "chmod 777",
  "eval ",
  "exec ",
  "base64 -d",
] as const;

// ─── Permission Profiles ──────────────────────────────────────────────────────

/**
 * Default permission profile for "read_only" level (maps from autonomy "manual").
 *
 * The worker may not write any files or run any commands.
 */
const READ_ONLY_PERMISSIONS: WorkerPermissions = {
  permissionLevel: "read_only",
  allowedFilePatterns: [],
  blockedFilePatterns: DEFAULT_BLOCKED_FILE_PATTERNS,
  allowedCommands: [],
  blockedCommands: DEFAULT_BLOCKED_COMMANDS,
  maxFilesPerSession: 0,
  requiresApprovalAbove: 0,
};

/**
 * Default permission profile for "suggest" level (maps from autonomy "suggest").
 *
 * The worker may generate file diffs and proposed commands but not apply them.
 * allowedFilePatterns is intentionally empty — no writes until approved.
 */
const SUGGEST_PERMISSIONS: WorkerPermissions = {
  permissionLevel: "suggest",
  allowedFilePatterns: [],
  blockedFilePatterns: DEFAULT_BLOCKED_FILE_PATTERNS,
  allowedCommands: ["npx tsc --noEmit", "npm run lint", "npm run test"],
  blockedCommands: DEFAULT_BLOCKED_COMMANDS,
  maxFilesPerSession: 0,
  requiresApprovalAbove: 0,
};

/**
 * Default permission profile for "execute" level (maps from autonomy "assist").
 *
 * The worker may write source files and test files and run standard validation
 * commands. Approval is required for large change sets.
 */
const EXECUTE_PERMISSIONS: WorkerPermissions = {
  permissionLevel: "execute",
  allowedFilePatterns: [
    "src/**",
    "tests/**",
    "__tests__/**",
    "*.config.ts",
    "*.config.js",
    "*.config.mjs",
    "*.config.cjs",
    "package.json",
    "tsconfig*.json",
    ".eslintrc*",
    ".prettierrc*",
    "vitest.config.*",
    "jest.config.*",
  ],
  blockedFilePatterns: DEFAULT_BLOCKED_FILE_PATTERNS,
  allowedCommands: [
    "npm",
    "npx",
    "git add",
    "git commit",
    "git checkout",
    "git pull",
    "git push",
    "git status",
    "git diff",
    "git log",
    "git branch",
    "git stash",
    "node",
  ],
  blockedCommands: DEFAULT_BLOCKED_COMMANDS,
  maxFilesPerSession: 50,
  requiresApprovalAbove: 20,
};

/**
 * Default permission profile for "full" level (maps from autonomy "delegate" or
 * "autonomous").
 *
 * The worker has maximum allowed autonomy: broader file access, all standard
 * toolchain commands, and a higher approval threshold.
 */
const FULL_PERMISSIONS: WorkerPermissions = {
  permissionLevel: "full",
  allowedFilePatterns: [
    "src/**",
    "tests/**",
    "__tests__/**",
    "docs/**",
    "public/**",
    "*.config.ts",
    "*.config.js",
    "*.config.mjs",
    "*.config.cjs",
    "package.json",
    "package-lock.json",
    "tsconfig*.json",
    ".eslintrc*",
    ".prettierrc*",
    "vitest.config.*",
    "jest.config.*",
    "next.config.*",
    "tailwind.config.*",
    "postcss.config.*",
    "Dockerfile",
    "docker-compose*.yml",
    ".github/workflows/**",
  ],
  blockedFilePatterns: DEFAULT_BLOCKED_FILE_PATTERNS,
  allowedCommands: [
    "npm",
    "npx",
    "pnpm",
    "yarn",
    "git add",
    "git commit",
    "git checkout",
    "git pull",
    "git push",
    "git status",
    "git diff",
    "git log",
    "git branch",
    "git stash",
    "git merge",
    "git rebase",
    "git tag",
    "gh",
    "node",
    "ts-node",
    "tsc",
    "eslint",
    "prettier",
    "vitest",
    "jest",
    "docker",
    "docker-compose",
  ],
  blockedCommands: DEFAULT_BLOCKED_COMMANDS,
  maxFilesPerSession: 100,
  requiresApprovalAbove: 40,
};

// ─── Autonomy Level Mapping ───────────────────────────────────────────────────

/**
 * Supported autonomy level strings from CompanySettings.
 */
export type AutonomyLevel = "manual" | "suggest" | "assist" | "delegate" | "autonomous";

export const AUTONOMY_LEVELS: readonly AutonomyLevel[] = [
  "manual",
  "suggest",
  "assist",
  "delegate",
  "autonomous",
] as const;

/**
 * Maps a CompanySettings autonomy level to the corresponding worker permission
 * profile.
 *
 * | Autonomy    | Permission Level |
 * |-------------|-----------------|
 * | manual      | read_only       |
 * | suggest     | suggest         |
 * | assist      | execute         |
 * | delegate    | full            |
 * | autonomous  | full            |
 *
 * Unknown autonomy level strings fall back to `read_only` for safety.
 *
 * @param autonomyLevel - Value from CompanySettings.autonomyLevel.
 * @returns Resolved WorkerPermissions profile for the given level.
 *
 * @example
 * ```ts
 * const permissions = getWorkerPermissions("assist");
 * // → EXECUTE_PERMISSIONS (permissionLevel: "execute")
 * ```
 */
export function getWorkerPermissions(autonomyLevel: string): WorkerPermissions {
  switch (autonomyLevel) {
    case "manual":
      return READ_ONLY_PERMISSIONS;
    case "suggest":
      return SUGGEST_PERMISSIONS;
    case "assist":
      return EXECUTE_PERMISSIONS;
    case "delegate":
    case "autonomous":
      return FULL_PERMISSIONS;
    default:
      // Unknown level → safest profile
      return READ_ONLY_PERMISSIONS;
  }
}

// ─── Glob Matching ────────────────────────────────────────────────────────────

/**
 * Minimal glob matcher that handles the patterns used in this module.
 *
 * Supports:
 * - Exact match: `package.json`
 * - Prefix wildcard: `.env.*`  →  `.env.` + any suffix
 * - Directory wildcard: `src/**`  →  any path starting with `src/`
 * - Extension wildcard: `*.key`  →  any file ending with `.key`
 * - Double star: `prisma/migrations/**`
 *
 * This avoids pulling in a full glob library (micromatch) which is a runtime
 * dependency. The patterns used in this module are predictable and bounded.
 *
 * @internal
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  // Exact match fast path
  if (pattern === filePath) return true;

  // Convert glob pattern to a regex.
  // Critical ordering: replace ** BEFORE escaping metacharacters, and expand
  // the ** placeholder AFTER handling single *, so the `.*` produced by **
  // is never caught by the single-* replacement rule.
  const DS = "\x00DS\x00"; // placeholder for **; null bytes cannot appear in file paths

  const regexStr = pattern
    // Step 1: replace ** with placeholder before any other processing
    .replace(/\*\*/g, DS)
    // Step 2: escape regex metacharacters (. + ^ $ { } ( ) | [ ] \)
    // * is intentionally excluded — it is handled in step 3
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    // Step 3: single * → match any characters within one path segment
    .replace(/\*/g, "[^/]*")
    // Step 4: expand ** placeholder → match anything (including path separators)
    .replace(new RegExp(DS, "g"), ".*");

  try {
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(filePath);
  } catch {
    return false;
  }
}

/**
 * Returns true when `filePath` matches at least one pattern in the list.
 *
 * @param filePath - Relative file path to test.
 * @param patterns - Glob patterns to test against.
 * @returns True when any pattern matches.
 *
 * @internal
 */
function matchesAnyPattern(filePath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

// ─── Validation Functions ─────────────────────────────────────────────────────

/**
 * Validates whether a worker agent is allowed to write to a given file path
 * under the provided permission profile.
 *
 * Evaluation order:
 * 1. `read_only` or `suggest` level — no writes ever allowed.
 * 2. Blocked patterns — always wins, regardless of allowed patterns.
 * 3. Allowed patterns — path must match at least one.
 *
 * @param path - Relative file path the worker wants to write (e.g. `src/lib/foo.ts`).
 * @param permissions - Resolved worker permission profile.
 * @returns `{ allowed: boolean; reason: string }` — reason explains the decision.
 *
 * @example
 * ```ts
 * const result = validateFileAccess("src/lib/foo.ts", permissions);
 * if (!result.allowed) throw new Error(result.reason);
 * ```
 */
export function validateFileAccess(
  path: string,
  permissions: WorkerPermissions
): ValidationResult {
  // read_only and suggest levels cannot write files
  if (
    permissions.permissionLevel === "read_only" ||
    permissions.permissionLevel === "suggest"
  ) {
    return {
      allowed: false,
      reason: `Permission level "${permissions.permissionLevel}" does not allow file writes.`,
    };
  }

  // Block list always wins
  if (matchesAnyPattern(path, permissions.blockedFilePatterns)) {
    return {
      allowed: false,
      reason: `File path "${path}" matches a blocked pattern and cannot be written.`,
    };
  }

  // Must match at least one allowed pattern
  if (!matchesAnyPattern(path, permissions.allowedFilePatterns)) {
    return {
      allowed: false,
      reason: `File path "${path}" does not match any allowed file pattern.`,
    };
  }

  return {
    allowed: true,
    reason: `File path "${path}" is permitted by the current permission profile.`,
  };
}

/**
 * Validates whether a worker agent is allowed to run a given shell command
 * under the provided permission profile.
 *
 * Evaluation order:
 * 1. `read_only` level — no commands ever allowed.
 * 2. Blocked command strings — if the command contains any blocked string, it
 *    is denied.
 * 3. Allowed command prefixes — the command must start with at least one
 *    allowed prefix (exact match or `prefix ` / `prefix\t`).
 *
 * @param command - Full command string the worker wants to execute (e.g. `npm run test`).
 * @param permissions - Resolved worker permission profile.
 * @returns `{ allowed: boolean; reason: string }` — reason explains the decision.
 *
 * @example
 * ```ts
 * const result = validateCommand("npm run test", permissions);
 * if (!result.allowed) throw new Error(result.reason);
 * ```
 */
export function validateCommand(
  command: string,
  permissions: WorkerPermissions
): ValidationResult {
  const trimmed = command.trim();

  // read_only level cannot run any commands
  if (permissions.permissionLevel === "read_only") {
    return {
      allowed: false,
      reason: `Permission level "read_only" does not allow command execution.`,
    };
  }

  // Block list always wins — check whether any blocked string appears in the command
  const matchedBlock = permissions.blockedCommands.find((blocked) =>
    trimmed.includes(blocked)
  );
  if (matchedBlock !== undefined) {
    return {
      allowed: false,
      reason: `Command contains blocked string "${matchedBlock}" and cannot be executed.`,
    };
  }

  // Must start with at least one allowed command prefix
  const isAllowed = permissions.allowedCommands.some(
    (allowed) =>
      trimmed === allowed ||
      trimmed.startsWith(`${allowed} `) ||
      trimmed.startsWith(`${allowed}\t`)
  );

  if (!isAllowed) {
    return {
      allowed: false,
      reason: `Command "${trimmed}" does not match any allowed command prefix.`,
    };
  }

  return {
    allowed: true,
    reason: `Command "${trimmed}" is permitted by the current permission profile.`,
  };
}
