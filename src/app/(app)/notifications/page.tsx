import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Bell, CheckCircle2, AlertCircle, Info, Zap, ShieldAlert, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MarkAllReadButton } from "./mark-all-read-button";
import { MarkReadButton } from "./mark-read-button";

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-950/20" },
  warning: { icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-950/20" },
  alert: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-950/20" },
  decision: { icon: Zap, color: "text-amber-400", bg: "bg-amber-950/20" },
  progress: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-950/20" },
  blocker: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-950/20" },
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-neutral-600",
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-neutral-100">Notifications</h1>
          {unread.length > 0 && (
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-300">
              {unread.length}
            </span>
          )}
        </div>
        {unread.length > 0 && <MarkAllReadButton />}
      </header>

      <div className="flex flex-col gap-6 p-6 max-w-2xl">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-14 text-center">
            <Bell className="h-5 w-5 text-neutral-700" />
            <div>
              <p className="text-sm font-medium text-neutral-500">
                No notifications
              </p>
              <p className="mt-0.5 text-xs text-neutral-700">
                Notifications appear here when requests advance, decisions are
                needed, or blockers arise.
              </p>
            </div>
          </div>
        ) : (
          <>
            {unread.length > 0 && (
              <section>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  Unread ({unread.length})
                </div>
                <NotificationList notifications={unread} />
              </section>
            )}

            {read.length > 0 && (
              <section>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  Earlier
                </div>
                <NotificationList notifications={read} dimmed />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NotificationList({
  notifications,
  dimmed = false,
}: {
  notifications: {
    id: string;
    title: string;
    body: string | null;
    type: string;
    priority: string;
    actionUrl: string | null;
    read: boolean;
    createdAt: Date;
  }[];
  dimmed?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {notifications.map((n) => {
        const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG["info"];
        const Icon = cfg.icon;
        const dot = PRIORITY_DOT[n.priority] ?? PRIORITY_DOT["medium"];

        const inner = (
          <div
            className={cn(
              "group flex items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors",
              dimmed
                ? "border-neutral-800 bg-neutral-900/50"
                : "border-neutral-800 bg-neutral-900 hover:border-neutral-700 hover:bg-neutral-800"
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                cfg.bg
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    dimmed ? "text-neutral-500" : "text-neutral-200"
                  )}
                >
                  {n.title}
                </p>
                {!n.read && (
                  <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
                )}
              </div>
              {n.body && (
                <p
                  className={cn(
                    "mt-0.5 text-xs leading-relaxed",
                    dimmed ? "text-neutral-700" : "text-neutral-500"
                  )}
                >
                  {n.body}
                </p>
              )}
              <p className="mt-1 text-[11px] text-neutral-700">
                {new Date(n.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {!n.read && <MarkReadButton notificationId={n.id} />}
          </div>
        );

        return n.actionUrl ? (
          <Link key={n.id} href={n.actionUrl}>
            {inner}
          </Link>
        ) : (
          <div key={n.id}>{inner}</div>
        );
      })}
    </div>
  );
}
