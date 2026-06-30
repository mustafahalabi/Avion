import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Legacy route — project detail now lives at `/w/[slug]/projects/[projectId]`.
 * Resolve the project's workspace and forward.
 */
export default async function LegacyProjectRedirect({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const project = await prisma.project.findFirst({
    where: { id, company: { ownerId: user.id } },
    select: { id: true, workspace: { select: { slug: true } } },
  });
  if (!project) notFound();

  redirect(`/w/${project.workspace.slug}/projects/${project.id}`);
}
