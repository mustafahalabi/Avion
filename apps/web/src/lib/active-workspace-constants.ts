// Pure constants shared by the server resolver (active-workspace.ts) and the
// client cookie writer (active-workspace-cookie.ts). Kept import-free so the
// client module never transitively pulls in `next/headers` / prisma.

/** Cookie recording which workspace the shell is scoped to. */
export const ACTIVE_WORKSPACE_COOKIE = "avion-active-workspace";

/** One year — the active workspace is a sticky preference, not a session value. */
export const ACTIVE_WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
