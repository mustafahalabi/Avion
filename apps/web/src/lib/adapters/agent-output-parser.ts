import { execSync } from "node:child_process";

/**
 * Shared defensive parsing for agent CLI stdout.
 *
 * Every execution adapter (Claude Code, Codex, …) reports its work through the
 * same structured markdown sections, and none of them are trusted blindly: the
 * `git diff` fallback in {@link parseFilesChangedFromGit} is the honesty
 * mechanism that grounds `filesChanged` in what actually changed on disk when
 * an agent's self-report is missing or malformed.
 */

/**
 * Extracts the paragraph following a `## Result Summary` or `## Summary` heading.
 *
 * @param stdout - Combined agent stdout.
 * @returns Summary text or null when not found.
 */
export function parseResultSummary(stdout: string): string | null {
  const match = stdout.match(
    /## (?:Result Summary|Summary)\s*\n+([^\n#][^\n]*(?:\n(?![#])[^\n]+)*)/i
  );
  if (!match?.[1]) {
    return null;
  }
  const summary = match[1].trim();
  return summary.length > 0 ? summary : null;
}

/**
 * Parses file change lines from agent stdout.
 *
 * Supports `Created:` / `Modified:` / `Deleted:` prefixes, an inline
 * `Files changed: a, b` value, and plain bullets under a `Files changed:` label.
 *
 * Capture under a `Files changed:` label STOPS at the next labeled field
 * (e.g. `- Tests added: none`, `- Ready for review: Yes`), heading, or blank line,
 * and every candidate is filtered by {@link looksLikeFilePath}. This prevents the
 * agent's Implementation-Summary fields — which follow a `- Files changed:` bullet —
 * from being recorded as fake file paths (MUS-278). This is only a fallback; the
 * adapters prefer {@link parseFilesChangedFromGit} (the on-disk truth) when available.
 *
 * @param stdout - Combined agent stdout.
 * @returns Relative file paths detected in output.
 */
export function parseFilesChanged(stdout: string): string[] {
  const files = new Set<string>();
  const lines = stdout.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const prefixMatch = line.match(/^(?:Created|Modified|Deleted):\s*(.+)$/i);
    if (prefixMatch?.[1]) {
      addFileCandidate(files, prefixMatch[1]);
      continue;
    }

    const filesChanged = line.match(/^\s*[-*]?\s*Files changed:\s*(.*)$/i);
    if (filesChanged) {
      // Inline value on the same line (e.g. "- Files changed: a.ts, b.ts").
      for (const part of filesChanged[1].split(/[,;]/)) {
        addFileCandidate(files, part);
      }
      // Following plain bullets, until a labeled field / heading / blank line.
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (next.trim().length === 0) break;
        if (/^\s*#{1,6}\s/.test(next)) break;
        const bullet = next.match(/^\s*[-*]\s+(.+)$/);
        if (!bullet || isLabeledField(bullet[1])) break;
        addFileCandidate(files, bullet[1]);
      }
    }
  }

  return [...files];
}

/** True when text reads like a labeled summary field ("Tests added: none"), not a path. */
function isLabeledField(text: string): boolean {
  return /^[A-Za-z][A-Za-z ]*:\s/.test(text.trim());
}

/** Adds a trimmed, de-quoted candidate to the set when it plausibly names a file. */
function addFileCandidate(files: Set<string>, raw: string): void {
  const value = raw.trim().replace(/^[`'"]+|[`'"]+$/g, "").trim();
  if (looksLikeFilePath(value)) files.add(value);
}

/** Conservative filter: reject placeholders, labeled fields, and prose sentences. */
function looksLikeFilePath(value: string): boolean {
  if (value.length === 0 || value.length > 255) return false;
  if (["none", "n/a", "(none)", "<list>", "-"].includes(value.toLowerCase())) {
    return false;
  }
  if (isLabeledField(value)) return false;
  // Reject prose: whitespace AND sentence punctuation before a space or end.
  if (/\s/.test(value) && /[.!?](\s|$)/.test(value)) return false;
  return true;
}

/**
 * Returns the repository's working-tree changes vs HEAD — the on-disk truth for
 * what the agent changed. Uses `git status --porcelain` (including untracked new
 * files) rather than `git diff HEAD~1`: the adapter parses output BEFORE the worker
 * commits, so the agent's edits are uncommitted and diffing the previous commit
 * would report the wrong set (MUS-278).
 *
 * @param repositoryPath - Checked-out repository path.
 * @returns Changed file paths from git, or an empty array on failure (e.g. not a repo).
 */
export function parseFilesChangedFromGit(repositoryPath: string): string[] {
  try {
    const output = execSync("git status --porcelain", {
      cwd: repositoryPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const files = new Set<string>();
    for (const line of output.split("\n")) {
      if (line.trim().length === 0) continue;
      // Porcelain v1: "XY <path>" (2 status chars + space); renames as "old -> new".
      let path = line.slice(3).trim();
      const arrow = path.indexOf(" -> ");
      if (arrow >= 0) path = path.slice(arrow + 4).trim();
      if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
      if (path.length > 0) files.add(path);
    }
    return [...files];
  } catch {
    return [];
  }
}

/**
 * Extracts text between `## Validation` and the next `##` heading.
 *
 * @param stdout - Combined agent stdout.
 * @returns Validation block text or null when not found.
 */
export function parseValidationOutput(stdout: string): string | null {
  const match = stdout.match(/## Validation\s*\n([\s\S]*?)(?=\n## |\s*$)/i);
  if (!match?.[1]) {
    return null;
  }
  const block = match[1].trim();
  return block.length > 0 ? block : null;
}

