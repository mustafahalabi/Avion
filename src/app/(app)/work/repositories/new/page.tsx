import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getGitHubConnectionStatus } from "@/lib/github-connection-service";
import {
  listGitHubRepositories,
  type GitHubRepoSummary,
} from "@/lib/github-repository-list";
import { AddRepositoryForm } from "./add-repository-form";

type Props = {
  searchParams: Promise<{ workspace?: string }>;
};

export default async function NewRepositoryPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { workspace: workspaceParam } = await searchParams;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });

  const workspaces = company
    ? await prisma.workspace.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      })
    : [];

  // When GitHub is connected, fetch the account's repositories so the CEO can
  // pick from a list instead of hand-typing the URL. Best-effort: a failed
  // fetch (revoked token, rate limit) falls back to manual entry.
  let githubConnected = false;
  let githubRepos: GitHubRepoSummary[] = [];
  let githubError: string | null = null;

  if (company) {
    const status = await getGitHubConnectionStatus(company.id);
    githubConnected = status.connected;
    const token = status.raw?.tokens.accessToken;
    if (status.connected && token) {
      try {
        githubRepos = await listGitHubRepositories({ token });
      } catch {
        githubError =
          "Couldn't load your GitHub repositories. You can still add one manually below.";
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/repositories"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Repositories
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">
          Add Repository
        </h1>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Connect a repository
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Add your codebase so Avion can understand your technology
            stack and support planning.
          </p>
        </div>
        <AddRepositoryForm
          githubConnected={githubConnected}
          githubRepos={githubRepos}
          githubError={githubError}
          workspaces={workspaces}
          defaultWorkspaceId={workspaceParam}
        />
      </div>
    </div>
  );
}
