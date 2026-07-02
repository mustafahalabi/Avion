import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { decryptCredentials } from "@/lib/credentials-crypto";
import {
  checkBranchGuardrail,
  checkCommandGuardrail,
  checkFileGuardrails,
} from "@/lib/repository-guardrails";
import {
  validateCommand,
  type WorkerPermissions,
} from "@/lib/worker-permissions";
import type { WorkerAuditLog } from "@/lib/worker-audit-log";

/** Repository metadata required for checkout. */
export interface CheckoutRepositoryInput {
  url: string;
  credentials: string | null;
}

/** Result of a successful repository checkout. */
export interface RepoCheckoutResult {
  path: string;
  /**
   * HEAD commit SHA at checkout time. Used after the agent runs to detect
   * whether the agent created its own commits (vs. left working-tree changes).
   */
  baseCommitSha: string;
  cleanup: () => Promise<void>;
}

/** Identity stamped on commits the worker creates on the agent's behalf. */
const WORKER_GIT_AUTHOR_NAME = "Avion Worker";
const WORKER_GIT_AUTHOR_EMAIL = "worker@engineering-os.local";

/** Input for committing and pushing the session branch after an agent run. */
export interface CommitAndPushInput {
  /** Local checkout path. */
  checkoutPath: string;
  /** Session branch to commit on and push. Must be a non-protected branch. */
  branchName: string;
  /** Deterministic commit message used when the agent left uncommitted work. */
  commitMessage: string;
  /** HEAD SHA captured at checkout time (see {@link RepoCheckoutResult}). */
  baseCommitSha: string;
}

/** Outcome of {@link commitAndPushSessionBranch}. */
export interface CommitAndPushResult {
  /** Whether a branch was pushed to origin. */
  pushed: boolean;
  /** HEAD commit SHA after the operation, or null when there were no changes. */
  commitSha: string | null;
}

/**
 * Builds an authenticated clone URL when encrypted credentials are available.
 *
 * @param url - Original repository URL.
 * @param credentials - Encrypted credentials blob or null.
 * @returns Clone URL with token injected for HTTPS GitHub repos when possible.
 */
export function buildAuthenticatedCloneUrl(
  url: string,
  credentials: string | null
): string {
  if (!credentials) {
    return url;
  }

  const creds = decryptCredentials(credentials);
  const token =
    creds.accessToken ?? creds.manualToken ?? creds.token ?? creds.githubToken;

  if (token && url.startsWith("https://github.com/")) {
    return url.replace("https://github.com/", `https://${token}@github.com/`);
  }

  return url;
}

/**
 * Checks out a repository to a session-scoped directory under baseDir.
 *
 * @param repo - Repository URL and optional encrypted credentials.
 * @param branchName - Branch to check out or create.
 * @param baseDir - Parent directory for worker checkouts.
 * @param sessionId - Session ID used as the checkout folder name.
 * @returns Checkout path and cleanup function.
 */
export async function checkoutRepository(
  repo: CheckoutRepositoryInput,
  branchName: string,
  baseDir: string,
  sessionId: string
): Promise<RepoCheckoutResult> {
  const cloneUrl = buildAuthenticatedCloneUrl(repo.url, repo.credentials);
  const checkoutPath = path.join(baseDir, sessionId);

  fs.mkdirSync(checkoutPath, { recursive: true });

  execSync(`git clone ${cloneUrl} .`, {
    cwd: checkoutPath,
    stdio: "inherit",
  });

  const branchExists = branchExistsOnRemote(checkoutPath, branchName);
  if (branchExists) {
    execSync(`git checkout ${branchName}`, { cwd: checkoutPath, stdio: "inherit" });
  } else {
    execSync(`git checkout -b ${branchName}`, { cwd: checkoutPath, stdio: "inherit" });
  }

  return {
    path: checkoutPath,
    baseCommitSha: getHeadSha(checkoutPath),
    cleanup: async () => {
      fs.rmSync(checkoutPath, { recursive: true, force: true });
    },
  };
}

/**
 * Builds a deterministic commit message for agent-produced changes.
 *
 * @param taskTitle - Title of the task being implemented.
 * @param taskId - Task identifier to reference in the message.
 * @returns Commit message of the form `feat: <title> (<taskId>)`.
 */
export function buildAgentCommitMessage(
  taskTitle: string | null,
  taskId: string | null
): string {
  const title = taskTitle?.trim() || "Apply agent changes";
  const ref = taskId ? ` (${taskId})` : "";
  return `feat: ${title}${ref}`;
}

/**
 * Commits any working-tree changes the agent left and pushes the session branch.
 *
 * Guardrails enforced here (defense in depth — see MUS-206):
 * - Refuses to operate on a protected branch (`main`, `master`, `release/*`,
 *   `hotfix/*`) by throwing before any git mutation.
 * - Never force-pushes; the push is a plain fast-forward `git push origin`.
 * - No-ops cleanly when the agent produced zero changes: no commit, no push,
 *   and a `null` commit SHA is returned.
 *
 * If the agent already committed its work, no new commit is created but the
 * branch is still pushed and the current HEAD SHA is returned.
 *
 * @param input - Checkout path, branch, commit message, and base SHA.
 * @returns Whether a push occurred and the resulting commit SHA (or null).
 * @throws Error when `branchName` is a protected branch.
 */
export function commitAndPushSessionBranch(
  input: CommitAndPushInput
): CommitAndPushResult {
  const { checkoutPath, branchName, commitMessage, baseCommitSha } = input;

  // Safety gate: never commit to or push a protected branch.
  const guardrail = checkBranchGuardrail(branchName);
  if (!guardrail.passed) {
    const reason =
      guardrail.violations[0]?.message ?? `Branch "${branchName}" is protected.`;
    throw new Error(`Refusing to push agent changes: ${reason}`);
  }

  // Stage and commit anything the agent left uncommitted in the working tree.
  const hadWorkingChanges = hasUncommittedChanges(checkoutPath);
  if (hadWorkingChanges) {
    execSync("git add -A", { cwd: checkoutPath, stdio: "inherit" });
    execSync(
      `git -c user.name="${WORKER_GIT_AUTHOR_NAME}" -c user.email="${WORKER_GIT_AUTHOR_EMAIL}" commit -F -`,
      {
        cwd: checkoutPath,
        input: commitMessage,
        stdio: ["pipe", "inherit", "inherit"],
      }
    );
  }

  const headSha = getHeadSha(checkoutPath);
  const agentCommitted = headSha !== baseCommitSha;

  // No-op cleanly when the agent produced zero changes.
  if (!hadWorkingChanges && !agentCommitted) {
    return { pushed: false, commitSha: null };
  }

  // Push the branch to origin. Never force-push.
  execSync(`git push origin ${branchName}`, { cwd: checkoutPath, stdio: "inherit" });

  return { pushed: true, commitSha: headSha };
}

/**
 * Returns true when the working tree has staged or unstaged changes.
 *
 * @param checkoutPath - Local repository path.
 * @returns Whether `git status --porcelain` reports any changes.
 */
function hasUncommittedChanges(checkoutPath: string): boolean {
  const output = execSync("git status --porcelain", {
    cwd: checkoutPath,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return output.trim().length > 0;
}

/**
 * Resolves the current HEAD commit SHA.
 *
 * @param checkoutPath - Local repository path.
 * @returns Full HEAD commit SHA.
 */
function getHeadSha(checkoutPath: string): string {
  return execSync("git rev-parse HEAD", {
    cwd: checkoutPath,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

// ─── Pre-push guardrail enforcement (MUS-213) ────────────────────────────────

/** A single blocking or warning reason produced by the pre-push gate. */
export interface PrePushViolation {
  /** Machine-readable rule identifier. */
  readonly rule: string;
  /** `block` prevents the push; `warn` is advisory. */
  readonly severity: "block" | "warn";
  /** Human-readable explanation. */
  readonly message: string;
  /** Offending file path, when the violation is path-based. */
  readonly path?: string;
  /** Offending branch, when the violation is branch-based. */
  readonly branch?: string;
  /** Offending command, when the violation is command-based. */
  readonly command?: string;
}

/** Aggregate result of the pre-push guardrail evaluation. */
export interface PrePushGuardResult {
  /** True only when there are zero `block`-severity violations. */
  readonly passed: boolean;
  /** Files the agent changed in the working tree (the evaluated set). */
  readonly changedFiles: string[];
  /** All violations discovered, in evaluation order. */
  readonly violations: PrePushViolation[];
}

/** Input for {@link evaluatePrePushGuardrails}. */
export interface PrePushGuardInput {
  /** Local checkout path. */
  readonly checkoutPath: string;
  /** Session branch that would be pushed. */
  readonly branchName: string;
  /** Resolved worker permission profile (autonomy-derived, not agent mode). */
  readonly permissions: WorkerPermissions;
  /**
   * Canonical git commands the worker intends to run. Defaults to the
   * add/commit/push sequence used by {@link commitAndPushSessionBranch}.
   */
  readonly intendedCommands?: readonly string[];
}

/**
 * Canonical git commands the worker runs to persist agent work. Used for
 * command guardrail / permission evaluation (config `-c` flags are omitted —
 * they do not change the command's identity for safety purposes).
 */
export function defaultIntendedGitCommands(branchName: string): string[] {
  return ["git add -A", "git commit", `git push origin ${branchName}`];
}

/**
 * Hard gate run *before* any commit/push. Evaluates the agent's changed file
 * set, the target branch, and the intended git commands against the
 * Engineering-OS guardrails (`repository-guardrails`) and the worker permission
 * profile (`worker-permissions`).
 *
 * This is enforced independently of the agent's own `claude -p` permission mode
 * (including `bypassPermissions`): a profile that lets the agent edit freely
 * still cannot push protected paths, push to a protected branch, or run a
 * denied/dangerous git command.
 *
 * @param input - Checkout path, branch, permission profile, and commands.
 * @returns Pass/fail with the evaluated file set and all violations.
 */
export function evaluatePrePushGuardrails(
  input: PrePushGuardInput
): PrePushGuardResult {
  const changedFiles = getChangedFiles(input.checkoutPath);
  const violations: PrePushViolation[] = [];

  // Protected paths (repository-guardrails) — absolute, profile-independent.
  for (const v of checkFileGuardrails(changedFiles).violations) {
    violations.push({
      rule: v.rule,
      severity: v.severity,
      message: v.message,
      path: v.path,
    });
  }

  // Protected branch (repository-guardrails) — never push to master/release/etc.
  for (const v of checkBranchGuardrail(input.branchName).violations) {
    violations.push({
      rule: v.rule,
      severity: v.severity,
      message: v.message,
      branch: v.branch,
    });
  }

  // Intended git commands: dangerous-command + allow/deny permission checks.
  const commands =
    input.intendedCommands ?? defaultIntendedGitCommands(input.branchName);
  for (const command of commands) {
    for (const v of checkCommandGuardrail(command).violations) {
      violations.push({
        rule: v.rule,
        severity: v.severity,
        message: v.message,
        command,
      });
    }

    const permission = validateCommand(command, input.permissions);
    if (!permission.allowed) {
      violations.push({
        rule: "command-not-permitted",
        severity: "block",
        message: permission.reason,
        command,
      });
    }
  }

  const passed = violations.every((v) => v.severity !== "block");
  return { passed, changedFiles, violations };
}

/**
 * Records every blocking pre-push violation into the worker audit log.
 *
 * Command violations are logged as `command_blocked`; path/branch violations as
 * `guardrail_triggered`. All blocks are recorded at `error` severity.
 *
 * @param auditLog - Audit log for the current session.
 * @param result - Pre-push guard result to record.
 */
export function recordPrePushViolations(
  auditLog: WorkerAuditLog,
  result: PrePushGuardResult
): void {
  for (const v of result.violations) {
    if (v.severity !== "block") continue;
    if (v.command !== undefined) {
      auditLog.log(
        "command_blocked",
        { rule: v.rule, command: v.command, message: v.message },
        "error",
        "system"
      );
    } else {
      auditLog.log(
        "guardrail_triggered",
        { rule: v.rule, path: v.path, branch: v.branch, message: v.message },
        "error",
        "system"
      );
    }
  }
}

/**
 * Builds a concise, human-readable summary of the blocking violations,
 * suitable for the session's error message.
 *
 * @param result - Pre-push guard result.
 * @returns Single-line reason listing offending paths/branches/commands.
 */
export function summarizePrePushBlock(result: PrePushGuardResult): string {
  const blocks = result.violations.filter((v) => v.severity === "block");
  const details = blocks
    .map((v) => v.path ?? v.branch ?? v.command ?? v.rule)
    .join(", ");
  return `Push blocked by ${blocks.length} guardrail violation${
    blocks.length === 1 ? "" : "s"
  }: ${details}`;
}

/**
 * Returns the relative paths of all files changed in the working tree
 * (staged, unstaged, and untracked), resolving renames to their new path.
 *
 * @param checkoutPath - Local repository path.
 * @returns Changed file paths.
 */
function getChangedFiles(checkoutPath: string): string[] {
  const output = execSync("git status --porcelain", {
    cwd: checkoutPath,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  const files: string[] = [];
  for (const rawLine of output.split("\n")) {
    if (rawLine.trim().length === 0) continue;
    // Porcelain v1: two status chars + a space, then the path.
    const pathPart = rawLine.slice(3);
    const renameIdx = pathPart.indexOf(" -> ");
    files.push(renameIdx >= 0 ? pathPart.slice(renameIdx + 4) : pathPart);
  }
  return files;
}

/**
 * Returns true when the branch exists on the remote origin.
 *
 * @param checkoutPath - Local repository path.
 * @param branchName - Branch name to probe.
 * @returns Whether origin has the branch.
 */
function branchExistsOnRemote(checkoutPath: string, branchName: string): boolean {
  try {
    const output = execSync(`git ls-remote --heads origin ${branchName}`, {
      cwd: checkoutPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}
