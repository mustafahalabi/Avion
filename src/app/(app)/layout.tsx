import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { countPendingCheckpoints } from "@/lib/approval-checkpoints";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/nav/sidebar";
import { UserMenu } from "@/components/nav/user-menu";
import { BrandSplash } from "@/components/brand";
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
  const [unreadNotifications, pendingApprovals, workspaces] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    company ? countPendingCheckpoints(company.id) : Promise.resolve(0),
    company ? listWorkspacesForSwitcher(company.id) : Promise.resolve([]),
  ]);
  const activeWorkspaceId = await resolveActiveWorkspaceId(workspaces);
  const navBadges: Record<string, number> = {
    "/notifications": unreadNotifications,
    "/inbox": pendingApprovals,
    "/control-center": pendingApprovals,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Avion launch splash — plays once per session, then fades to the app. */}
      <BrandSplash />
      <div className="relative flex flex-col">
        <Sidebar
          badges={navBadges}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
        <div className="absolute bottom-0 left-0 right-0 h-12 border-t border-neutral-800 flex items-center px-2">
          <UserMenu user={user} />
        </div>
      </div>

      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
