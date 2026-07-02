import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewProjectForm, type ProjectRepoOption } from "./new-project-form";

type Props = {
  searchParams: Promise<{ repository?: string }>;
};

export default async function NewProjectPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { repository } = await searchParams;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const repoRows = await prisma.repository.findMany({
    where: { workspace: { companyId: company.id } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      workspace: { select: { name: true } },
    },
  });

  const repos: ProjectRepoOption[] = repoRows.map((r) => ({
    id: r.id,
    name: r.name,
    workspaceId: r.workspaceId,
    workspaceName: r.workspace.name,
  }));

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/projects"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">New Project</h1>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Create a project
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            A project is the primary unit of engineering execution. It targets a
            repository and lives in that repository&apos;s workspace.
          </p>
        </div>
        <NewProjectForm repos={repos} defaultRepositoryId={repository} />
      </div>
    </div>
  );
}
