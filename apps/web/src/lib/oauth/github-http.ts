/**
 * Shared GitHub REST constants/helpers used by both the OAuth and resource
 * modules. Header set mirrors `src/lib/github-pull-request.ts`.
 */

export const GITHUB_API_BASE = "https://api.github.com";

/** Standard authenticated GitHub REST headers for a bearer token. */
export function githubApiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** A GitHub REST error carrying the HTTP status for caller-side branching. */
export class GitHubResourceError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubResourceError";
    this.status = status;
  }
}

/**
 * Extracts the `rel="next"` URL from a GitHub `Link` response header.
 * @returns The next-page URL, or null when there is no further page.
 */
export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}
