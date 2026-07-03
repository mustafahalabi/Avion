import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { countPendingCheckpoints } from "@/lib/approval-checkpoints";
import { prisma } from "@/lib/prisma";
import { loadLiveNotifications } from "@/lib/live-pipeline-data";
import { Sidebar } from "@/components/nav/sidebar";
import { UserMenu } from "@/components/nav/user-menu";
import { BrandSplash } from "@/components/brand";
import { LiveNotificationsProvider } from "@/components/notifications/live-notifications-provider";
import {
  LiveActivityBar,
  type LiveActivitySummary,
} from "@/components/live/live-activity-bar";
import {
  listWorkspacesForSwitcher,
  resolveActiveWorkspaceId,
} from "@/lib/active-workspace";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Sidebar badges: unread notifications (bell) and pending approvals (inbox).
  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  const [
    liveNotifications,
    pendingApprovals,
    workspaces,
    runningCount,
    runningSessions,
  ] = await Promise.all([
    loadLiveNotifications(user.id),
    company ? countPendingCheckpoints(company.id) : Promise.resolve(0),
    company ? listWorkspacesForSwitcher(company.id) : Promise.resolve([]),
    company
      ? prisma.executionSession.count({
          where: { companyId: company.id, status: "running" },
        })
      : Promise.resolve(0),
    company
      ? prisma.executionSession.findMany({
          where: { companyId: company.id, status: "running" },
          orderBy: { startedAt: "asc" },
          take: 6,
          select: {
            agentType: true,
            startedAt: true,
            task: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const activeWorkspaceId = await resolveActiveWorkspaceId(workspaces);
  const navBadges: Record<string, number> = {
    // SSR seed for the bell; the provider takes over live once connected.
    "/notifications": liveNotifications.unreadNotificationCount,
    "/inbox": pendingApprovals,
    "/work/live": runningCount,
  };

  // Persistent activity band: the oldest running agent, seeded server-side; its
  // timer ticks client-side, the count refreshes on navigation.
  const oldest = runningSessions[0];
  const activitySummary: LiveActivitySummary = {
    count: runningCount,
    oldestStartedAt: oldest?.startedAt ? oldest.startedAt.toISOString() : null,
    title: oldest?.task?.title ?? null,
    agentType: oldest?.agentType ?? null,
    pendingApprovals,
  };

  return (
    <LiveNotificationsProvider
      initialNotifications={liveNotifications.notifications}
      initialUnreadCount={liveNotifications.unreadNotificationCount}
    >
      <div className="av-root flex h-screen overflow-hidden" data-theme="dark">
        {/* Avion launch splash — plays once per session, then fades to the app. */}
        <BrandSplash />
        <div className="relative flex flex-col">
          <Sidebar
            badges={navBadges}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-12 flex items-center px-2"
            style={{
              borderTop: "1.5px solid var(--av-bd)",
              background: "var(--av-surface)",
            }}
          >
            <UserMenu user={user} />
          </div>
        </div>

        <main
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: "var(--av-bg)" }}
        >
          <LiveActivityBar summary={activitySummary} />
          {children}
        </main>
      </div>
    </LiveNotificationsProvider>
  );
}
