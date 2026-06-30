import { prisma } from "@/lib/prisma";
import type { Workspace } from "@/generated/prisma/client";

/**
 * Shared workspace helpers — the single owner of workspace get-or-create,
 * creation (slug-collision-safe), and the counts used by the Workspaces UI.
 *
 * Before this module three call sites each hand-rolled "find or create a
 * Default workspace" (the createProject action, plan-application-service, and
 * repository-write). They now all route through `ensureDefaultWorkspace` so the
 * behaviour can never drift.
 */

/** Lowercases + kebab-cases a name into a workspace slug. */
export function slugifyWorkspaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * Returns the company's earliest workspace id, creating a "Default" one when the
 * company has none yet. This is the canonical fallback for every code path that
 * needs *a* workspace without the caller having chosen one.
 */
export async function ensureDefaultWorkspace(companyId: string): Promise<string> {
  const existing = await prisma.workspace.findFirst({
    where: { companyId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const created = await prisma.workspace.create({
    data: { companyId, name: "Default", slug: "default" },
    select: { id: true },
  });
  return created.id;
}

/** Picks a slug that doesn't collide with the company's existing workspaces. */
async function uniqueWorkspaceSlug(
  companyId: string,
  base: string
): Promise<string> {
  const root = base || "workspace";
  let candidate = root;
  let n = 1;
  // @@unique([companyId, slug]) — probe until free.
  while (
    await prisma.workspace.findFirst({
      where: { companyId, slug: candidate },
      select: { id: true },
    })
  ) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

/** Creates a workspace under the company with a collision-safe slug. */
export async function createWorkspace(
  companyId: string,
  input: { name: string; description?: string | null }
): Promise<Workspace> {
  const slug = await uniqueWorkspaceSlug(companyId, slugifyWorkspaceName(input.name));
  return prisma.workspace.create({
    data: {
      companyId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
    },
  });
}

export interface WorkspaceWithCounts {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  projectCount: number;
  repoCount: number;
  createdAt: Date;
}

/** Lists a company's workspaces with their project + repository counts. */
export async function listWorkspacesWithCounts(
  companyId: string
): Promise<WorkspaceWithCounts[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { projects: true, repositories: true } } },
  });
  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description,
    projectCount: w._count.projects,
    repoCount: w._count.repositories,
    createdAt: w.createdAt,
  }));
}
