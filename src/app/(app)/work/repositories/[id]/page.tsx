import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Legacy route — repository detail now lives at
 * `/w/[slug]/repositories/[repoId]`. Resolve the repo's workspace and forward.
 */
export default async function LegacyRepositoryRedirect({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const repo = await prisma.repository.findFirst({
    where: { id, workspace: { company: { ownerId: user.id } } },
    select: { id: true, workspace: { select: { slug: true } } },
  });
  if (!repo) notFound();

  redirect(`/w/${repo.workspace.slug}/repositories/${repo.id}`);
}
