import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { decryptCredentials } from "@/lib/credentials-crypto";

/** Repository metadata required for checkout. */
export interface CheckoutRepositoryInput {
  url: string;
  credentials: string | null;
}

/** Result of a successful repository checkout. */
export interface RepoCheckoutResult {
  path: string;
  cleanup: () => Promise<void>;
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
    cleanup: async () => {
      fs.rmSync(checkoutPath, { recursive: true, force: true });
    },
  };
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
