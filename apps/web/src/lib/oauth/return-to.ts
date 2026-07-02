/**
 * Open-redirect-safe sanitizer for the post-OAuth-callback redirect target.
 *
 * The `returnTo` value travels through the OAuth round-trip and is therefore
 * attacker-influenceable. We never trust it: only a same-origin relative path
 * that begins with a single slash and matches a known prefix is allowed; every
 * other shape collapses to a safe default.
 *
 * Pure — no I/O, safe to unit-test.
 */

/** Path prefixes a post-OAuth redirect is permitted to land on. */
const ALLOWED_PREFIXES = [
  "/onboarding",
  "/integrations",
  "/connections",
  "/work",
  "/control-center",
] as const;

/** Fallback when the requested target is missing or unsafe. */
export const DEFAULT_RETURN_TO = "/integrations";

/** True when the string contains any ASCII control char (incl. tab/newline/DEL). */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Returns a safe relative path to redirect to after an OAuth flow completes.
 *
 * Rejects (→ default) anything that is not a single-leading-slash relative path
 * on the allowlist: absolute URLs, protocol-relative `//host`, backslash tricks
 * (`/\host`), any scheme (`javascript:`/`data:` via the `:` check), encoded
 * variants (decoded once), control characters, and off-allowlist paths.
 *
 * @param raw - Untrusted candidate path (e.g. a query-string value)
 * @returns A safe relative path; `DEFAULT_RETURN_TO` when `raw` is unsafe
 *
 * @example
 * sanitizeReturnTo("/onboarding?step=2"); // "/onboarding?step=2"
 * sanitizeReturnTo("//evil.com");          // "/integrations"
 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_RETURN_TO;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return DEFAULT_RETURN_TO;
  }

  // Must be a relative path with exactly one leading slash.
  if (!decoded.startsWith("/")) return DEFAULT_RETURN_TO;
  if (decoded.startsWith("//")) return DEFAULT_RETURN_TO;
  // Backslashes are normalized to forward slashes by some browsers.
  if (decoded.includes("\\")) return DEFAULT_RETURN_TO;
  // A colon implies a scheme (javascript:, data:) — relative paths never need one.
  if (decoded.includes(":")) return DEFAULT_RETURN_TO;
  // No control characters (tab/newline can split URLs in some parsers).
  if (hasControlChar(decoded)) return DEFAULT_RETURN_TO;

  // Compare against the allowlist using the path only (ignore ?query / #hash).
  const path = decoded.split(/[?#]/)[0];
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );

  return allowed ? decoded : DEFAULT_RETURN_TO;
}
