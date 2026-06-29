import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { decryptCredentials } from "@/lib/credentials-crypto";
import { checkBranchGuardrail } from "@/lib/repository-guardrails";

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
const WORKER_GIT_AUTHOR_NAME = "Engineering OS Worker";
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
