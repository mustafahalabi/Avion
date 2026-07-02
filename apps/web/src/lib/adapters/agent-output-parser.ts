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
 * Supports `Created:`, `Modified:`, `Deleted:` prefixes and bullet lists
 * under a `Files changed:` heading.
 *
 * @param stdout - Combined agent stdout.
 * @returns Relative file paths detected in output.
 */
export function parseFilesChanged(stdout: string): string[] {
  const files = new Set<string>();

  for (const line of stdout.split("\n")) {
    const prefixMatch = line.match(/^(?:Created|Modified|Deleted):\s*(.+)$/i);
    if (prefixMatch?.[1]) {
      files.add(prefixMatch[1].trim());
      continue;
    }

    const bulletMatch = line.match(/^\s*-\s+(.+)$/);
    if (bulletMatch?.[1] && isUnderFilesChangedSection(stdout, line)) {
      files.add(bulletMatch[1].trim());
    }
  }

  return [...files];
}

/**
 * Falls back to `git diff --name-only HEAD~1` when stdout parsing finds nothing.
 *
 * @param repositoryPath - Checked-out repository path.
 * @returns Changed file paths from git, or empty array on failure.
 */
export function parseFilesChangedFromGit(repositoryPath: string): string[] {
  try {
    const output = execSync("git diff --name-only HEAD~1", {
      cwd: repositoryPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
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

/**
 * Returns true when a bullet line appears after a `Files changed:` heading.
 *
 * @param stdout - Full stdout text.
 * @param line - The bullet line being evaluated.
 * @returns Whether the line is within a files-changed section.
 */
function isUnderFilesChangedSection(stdout: string, line: string): boolean {
  const lineIndex = stdout.indexOf(line);
  if (lineIndex < 0) {
    return false;
  }
  const preceding = stdout.slice(0, lineIndex);
  const filesChangedIndex = preceding.lastIndexOf("Files changed:");
  if (filesChangedIndex < 0) {
    return false;
  }
  const sectionBetween = preceding.slice(filesChangedIndex);
  return !sectionBetween.includes("\n## ");
}
