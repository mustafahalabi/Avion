import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ACTIVE_WORKSPACE_COOKIE } from "./active-workspace-constants";

// Re-export so existing server-side importers keep working; the canonical
// definitions live in the import-free constants module.
export {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_MAX_AGE,
} from "./active-workspace-constants";

export type SwitcherRepo = { id: string; name: string };
export type SwitcherProject = {
  id: string;
  name: string;
  slug: string;
  status: string;
};
export type SwitcherWorkspace = {
  id: string;
  name: string;
  slug: string;
  repositories: SwitcherRepo[];
  projects: SwitcherProject[];
};

/** Workspaces (with their repos + projects) for the sidebar context switcher. */
export async function listWorkspacesForSwitcher(
  companyId: string
): Promise<SwitcherWorkspace[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    include: {
      repositories: {
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
      },
      projects: {
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    repositories: w.repositories,
    projects: w.projects,
  }));
}

/**
 * Resolve the active workspace id: the cookie when it still points at a real
 * workspace, else the company's first workspace. Null when there are none.
 */
export async function resolveActiveWorkspaceId(
  workspaces: readonly { id: string }[]
): Promise<string | null> {
  if (workspaces.length === 0) return null;
  const store = await cookies();
  const cookieId = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (cookieId && workspaces.some((w) => w.id === cookieId)) return cookieId;
  return workspaces[0]!.id;
}
