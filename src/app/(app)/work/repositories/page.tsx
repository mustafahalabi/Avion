import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { resolveActiveWorkspaceId } from "@/lib/active-workspace";

/**
 * Legacy route — repositories now live inside a workspace at
 * `/w/[slug]/repositories`. Forward to the active workspace's list.
 */
export default async function LegacyRepositoriesRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const workspaces = await prisma.workspace.findMany({
    where: { companyId: company.id },
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
  });
  if (workspaces.length === 0) redirect("/work/workspaces");

  const activeId = await resolveActiveWorkspaceId(workspaces);
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]!;
  redirect(`/w/${active.slug}/repositories`);
}
