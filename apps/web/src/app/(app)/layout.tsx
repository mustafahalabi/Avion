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
  const [liveNotifications, pendingApprovals, workspaces] = await Promise.all([
    loadLiveNotifications(user.id),
    company ? countPendingCheckpoints(company.id) : Promise.resolve(0),
    company ? listWorkspacesForSwitcher(company.id) : Promise.resolve([]),
  ]);
  const activeWorkspaceId = await resolveActiveWorkspaceId(workspaces);
  const navBadges: Record<string, number> = {
    // SSR seed for the bell; the provider takes over live once connected.
    "/notifications": liveNotifications.unreadNotificationCount,
    "/inbox": pendingApprovals,
    "/control-center": pendingApprovals,
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
          {children}
        </main>
      </div>
    </LiveNotificationsProvider>
  );
}
