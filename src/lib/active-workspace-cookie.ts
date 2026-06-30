"use client";

import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_MAX_AGE,
} from "./active-workspace-constants";

/** Persist the active workspace client-side so the server shell can read it. */
export function writeActiveWorkspaceCookie(workspaceId: string): void {
  document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${workspaceId};path=/;max-age=${ACTIVE_WORKSPACE_COOKIE_MAX_AGE};samesite=lax`;
}
