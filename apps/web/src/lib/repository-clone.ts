/**
 * Repository clone helper for on-demand analysis.
 *
 * The repository analyzer ({@link analyzeRepositoryPath}) reads a repository off
 * the local filesystem. To analyze a repo straight from GitHub we shallow-clone
 * it into a temp directory, hand that path to the analyzer, then delete it.
 *
 * Token-injected HTTPS clone mirrors the execution worker's
 * `buildAuthenticatedCloneUrl`, but takes a plain (already-decrypted) token so
 * the server action can reuse the stored GitHub OAuth credential.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** A temp checkout plus a cleanup that removes it. */
export interface RepositoryCloneResult {
  /** Absolute path to the cloned working tree. */
  readonly path: string;
  /** Removes the temp checkout. Safe to call more than once. */
  readonly cleanup: () => void;
}

export interface CloneRepositoryInput {
  /** Repository URL (HTTPS GitHub URLs get the token injected). */
  readonly url: string;
  /** GitHub access token for private repos; omit for public ones. */
  readonly token?: string | null;
  /** Clone timeout in milliseconds. Defaults to 120s. */
  readonly timeoutMs?: number;
}

/**
 * Builds an HTTPS clone URL with the token injected for GitHub repos.
 *
 * @param url - Repository URL.
 * @param token - Access token, or null/undefined for public repos.
 * @returns Clone URL, with `https://TOKEN@github.com/...` when applicable.
 */
export function buildTokenCloneUrl(url: string, token?: string | null): string {
  if (token && url.startsWith("https://github.com/")) {
    return url.replace("https://github.com/", `https://${token}@github.com/`);
  }
  return url;
}

/**
 * Removes a token from a string so it never leaks into stored error notes.
 *
 * @param text - Text that may contain the token (e.g. a git error echoing the URL).
 * @param token - Token to redact, or null/undefined.
 * @returns Text with the token replaced by `***`.
 */
export function scrubToken(text: string, token?: string | null): string {
  if (!token) return text;
  return text.split(token).join("***");
}

/**
 * Shallow-clones a repository into a fresh temp directory.
 *
 * @param input - Repository URL, optional token, optional timeout.
 * @returns The checkout path and a cleanup function.
 * @throws When `git clone` fails (message has the token redacted).
 */
export async function cloneRepositoryToTempDir(
  input: CloneRepositoryInput
): Promise<RepositoryCloneResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-analyze-"));
  const cloneUrl = buildTokenCloneUrl(input.url, input.token);

  try {
    execFileSync(
      "git",
      ["clone", "--depth", "1", "--no-tags", "--quiet", cloneUrl, dir],
      {
        stdio: "pipe",
        timeout: input.timeoutMs ?? 120_000,
        maxBuffer: 32 * 1024 * 1024,
      }
    );
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    const raw =
      err instanceof Error
        ? // execFileSync surfaces git's stderr on the error's `stderr` field.
          ((err as { stderr?: Buffer }).stderr?.toString().trim() || err.message)
        : "git clone failed.";
    throw new Error(`Failed to clone repository: ${scrubToken(raw, input.token)}`);
  }

  return {
    path: dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
