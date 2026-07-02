/**
 * Pure surfacing logic for the app-wide live notification channel.
 *
 * The client provider streams the caller's unread notifications and must decide,
 * on each frame, which ones to raise as a transient toast. This is kept pure (no
 * React, no timers, no DOM) so the dedup rules are unit-testable in isolation:
 *
 *   - Only "needs-you" types (decision / blocker / alert) toast; the rest just
 *     update the unread indicator silently.
 *   - Each notification toasts at most once — a `seen` set is threaded across
 *     frames, seeded on mount with whatever the CEO was already shown on the
 *     server render, so a reconnect or re-render never re-toasts old events.
 */

import type { LiveNotification } from "./live-pipeline-data";

/** Notification types urgent enough to interrupt with a toast. */
export const TOASTABLE_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  "decision",
  "blocker",
  "alert",
]);

/** Whether a notification type should raise a toast (vs. only bump the badge). */
export function isToastableNotification(type: string): boolean {
  return TOASTABLE_NOTIFICATION_TYPES.has(type);
}

export interface SurfacingResult {
  /** Newly-seen toastable notifications to raise this frame, newest first. */
  readonly toasts: readonly LiveNotification[];
  /** The updated seen-id set to thread into the next frame. */
  readonly seenIds: ReadonlySet<string>;
}

/**
 * Given the incoming unread notifications and the ids already surfaced, returns
 * the toasts to raise now and the next seen-id set.
 *
 * Every incoming id is recorded as seen (so it's considered exactly once), but
 * only not-yet-seen *toastable* ones are returned as toasts.
 *
 * @param incoming - Unread notifications from the latest frame (newest first).
 * @param seenIds - Ids already surfaced (seed on mount from the server render).
 * @returns The toasts to raise and the updated seen-id set.
 */
export function surfaceNotifications(
  incoming: readonly LiveNotification[],
  seenIds: ReadonlySet<string>
): SurfacingResult {
  const nextSeen = new Set(seenIds);
  const toasts: LiveNotification[] = [];
  for (const n of incoming) {
    if (nextSeen.has(n.id)) continue;
    nextSeen.add(n.id);
    if (isToastableNotification(n.type)) toasts.push(n);
  }
  return { toasts, seenIds: nextSeen };
}
