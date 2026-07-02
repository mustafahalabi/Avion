import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Legacy route — workspaces now live at `/w/[slug]`. Resolve the slug and
 * redirect so old links keep working.
 */
export default async function LegacyWorkspaceRedirect({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const workspace = await prisma.workspace.findFirst({
    where: { id, company: { ownerId: user.id } },
    select: { slug: true },
  });
  if (!workspace) notFound();

  redirect(`/w/${workspace.slug}`);
}
