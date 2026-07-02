/**
 * Pure active-route matching for the sidebar (MUS-305).
 *
 * Extracted from the sidebar so the non-trivial `/work` special-casing — where
 * `/work` must not light up for its sibling sections (`/work/live`,
 * `/work/outcomes`, …) that have their own nav entries — is unit-testable.
 */

/** Sibling `/work/*` sections that have their own top-level nav entry. */
const WORK_SIBLING_PREFIXES: readonly string[] = [
  "/work/live",
  "/work/outcomes",
  "/work/quality",
  "/work/releases",
  "/work/workspaces",
  "/work/repositories",
];

/**
 * Whether a nav item's `href` is the active route for the current `pathname`.
 *
 * An item is active on an exact match or when the pathname is nested under it
 * (`href + "/"`). `/work` is special: it stays active for its own detail pages
 * but not for the sibling sections that have their own nav entries.
 *
 * @param pathname - The current path.
 * @param href - The nav item's href.
 * @returns True when the item should render as active.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/work") {
    if (pathname === "/work") return true;
    if (!pathname.startsWith("/work/")) return false;
    return !WORK_SIBLING_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }
  return pathname === href || pathname.startsWith(href + "/");
}
