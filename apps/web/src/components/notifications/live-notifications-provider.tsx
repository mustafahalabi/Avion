"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ShieldAlert,
  Zap,
  X,
  type LucideIcon,
} from "lucide-react";

import type { LiveNotification } from "@/lib/live-pipeline-data";
import { parseLiveNotifications } from "@/lib/live-pipeline-serialization";
import { surfaceNotifications } from "@/lib/live-notification-surfacing";

/**
 * App-wide live notifications channel.
 *
 * Opens a single SSE connection to the notifications-only stream
 * (`/api/work/live/stream?only=notifications`) and, on every frame:
 *   - refreshes the unread list + true unread count (drives the live sidebar
 *     badge via {@link useLiveNotifications} — updates with no page load), and
 *   - raises a transient toast for each *new* decision / blocker / alert
 *     (dedup + type filtering handled by the pure {@link surfaceNotifications}).
 *
 * The connection lifecycle mirrors `useLivePipeline`: the browser auto-retries
 * transient drops, we reconnect terminal closes / `fatal` events with backoff,
 * and we pause while the tab is hidden.
 */

export interface LiveNotificationsValue {
  /** True unread count — the live sidebar/bell badge. */
  readonly unreadCount: number;
  /** Recent unread notifications, newest first (capped by the stream). */
  readonly notifications: readonly LiveNotification[];
}

const LiveNotificationsContext = createContext<LiveNotificationsValue | null>(
  null
);

/** Live unread notifications, or `null` when rendered outside the provider. */
export function useLiveNotifications(): LiveNotificationsValue | null {
  return useContext(LiveNotificationsContext);
}

const STREAM_HREF = "/api/work/live/stream?only=notifications";
const BASE_RECONNECT_MS = 1500;
const MAX_RECONNECT_MS = 30_000;
/** How long a toast stays up before auto-dismissing. */
const TOAST_TTL_MS = 9000;

const TOAST_ICON: Record<string, LucideIcon> = {
  decision: Zap,
  blocker: ShieldAlert,
  alert: AlertCircle,
};

/** Accent color per priority — mirrors the notifications page priority dots. */
const PRIORITY_ACCENT: Record<string, string> = {
  urgent: "#f87171",
  high: "#fbbf24",
  medium: "#60a5fa",
  low: "#a3a3a3",
};

export function LiveNotificationsProvider({
  initialNotifications,
  initialUnreadCount,
  children,
}: {
  initialNotifications: readonly LiveNotification[];
  initialUnreadCount: number;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] =
    useState<readonly LiveNotification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [toasts, setToasts] = useState<readonly LiveNotification[]>([]);

  // Ids already surfaced — seeded with what the server render already showed, so
  // pre-existing unread events never re-toast on connect/reconnect.
  const seenRef = useRef<ReadonlySet<string>>(
    new Set(initialNotifications.map((n) => n.id))
  );
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismissToast = (id: string): void => {
    const timer = dismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const timers = dismissTimers.current;

    const raiseToasts = (fresh: readonly LiveNotification[]): void => {
      if (fresh.length === 0) return;
      setToasts((prev) => {
        const knownIds = new Set(prev.map((t) => t.id));
        const additions = fresh.filter((t) => !knownIds.has(t.id));
        return additions.length ? [...prev, ...additions] : prev;
      });
      for (const t of fresh) {
        if (timers.has(t.id)) continue;
        const timer = setTimeout(() => {
          timers.delete(t.id);
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
        }, TOAST_TTL_MS);
        timers.set(t.id, timer);
      }
    };

    let source: EventSource | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = BASE_RECONNECT_MS;

    const clearReconnect = (): void => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const close = (): void => {
      if (source) {
        source.close();
        source = null;
      }
    };

    const applyFrame = (raw: string): void => {
      const payload = parseLiveNotifications(raw);
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadNotificationCount);
      const { toasts: fresh, seenIds } = surfaceNotifications(
        payload.notifications,
        seenRef.current
      );
      seenRef.current = seenIds;
      raiseToasts(fresh);
    };

    const open = (): void => {
      if (stopped || source) return;
      clearReconnect();
      const es = new EventSource(STREAM_HREF);
      source = es;
      es.onopen = () => {
        if (!stopped) retryDelay = BASE_RECONNECT_MS;
      };
      es.onmessage = (event) => {
        if (stopped) return;
        try {
          applyFrame(event.data);
          retryDelay = BASE_RECONNECT_MS;
        } catch {
          // Ignore a malformed frame; the next push recovers.
        }
      };
      es.onerror = () => {
        if (stopped) return;
        if (es.readyState === EventSource.CLOSED) scheduleReconnect();
      };
      es.addEventListener("fatal", () => {
        if (!stopped) scheduleReconnect();
      });
    };

    const scheduleReconnect = (): void => {
      if (stopped || reconnectTimer) return;
      close();
      const delay = retryDelay;
      retryDelay = Math.min(retryDelay * 2, MAX_RECONNECT_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        open();
      }, delay);
    };

    const sync = (): void => {
      if (document.hidden) {
        clearReconnect();
        close();
      } else {
        open();
      }
    };

    sync();
    document.addEventListener("visibilitychange", sync);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", sync);
      clearReconnect();
      close();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return (
    <LiveNotificationsContext.Provider value={{ unreadCount, notifications }}>
      {children}
      <NotificationToastStack toasts={toasts} onDismiss={dismissToast} />
    </LiveNotificationsContext.Provider>
  );
}

function NotificationToastStack({
  toasts,
  onDismiss,
}: {
  toasts: readonly LiveNotification[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[130] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      role="region"
      aria-label="Live notifications"
    >
      {toasts.map((t) => (
        <NotificationToast key={t.id} notification={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: LiveNotification;
  onDismiss: (id: string) => void;
}) {
  const Icon = TOAST_ICON[notification.type] ?? Zap;
  const accent = PRIORITY_ACCENT[notification.priority] ?? PRIORITY_ACCENT.medium;

  const body = (
    <div
      className="pointer-events-auto flex items-start gap-3 border bg-[var(--av-surface)] px-4 py-3 shadow-[6px_6px_0_var(--av-shadow)]"
      style={{ borderColor: "var(--av-bd)" }}
    >
      <div
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${accent}22`, color: accent }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--av-text)]">
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--av-muted)]">
            {notification.body}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="pointer-events-auto -mr-1 -mt-1 shrink-0 rounded p-1 text-[var(--av-muted)] hover:text-[var(--av-text)]"
        onClick={(e) => {
          // Don't follow the toast's link when dismissing.
          e.preventDefault();
          e.stopPropagation();
          onDismiss(notification.id);
        }}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );

  return notification.actionUrl ? (
    <Link
      href={notification.actionUrl}
      className="pointer-events-auto block"
      onClick={() => onDismiss(notification.id)}
    >
      {body}
    </Link>
  ) : (
    body
  );
}
