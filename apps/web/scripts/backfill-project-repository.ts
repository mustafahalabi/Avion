/**
 * One-time backfill for the new Project→Repository link (`Project.repositoryId`).
 *
 * Existing projects predate the link, so their repo was resolved at execution
 * time as "the most-recent repository in the project's workspace" (or, for
 * outcome-scoped projects, the outcome's repository). This script makes that
 * implicit choice explicit so the link drives execution going forward:
 *
 *   repositoryId := outcome.repositoryId
 *                   ?? workspace's most-recent repository
 *
 * Idempotent: only touches projects whose `repositoryId` is still null, and
 * skips any project whose workspace has no repositories (nothing to link).
 *
 * Run: `tsx scripts/backfill-project-repository.ts`
 */
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  const projects = await prisma.project.findMany({
    where: { repositoryId: null },
    select: {
      id: true,
      name: true,
      outcomeId: true,
      companyId: true,
      workspaceId: true,
    },
  });

  let linked = 0;
  let skipped = 0;

  for (const project of projects) {
    // Prefer the repo the outcome was scoped to (the CEO's real choice).
    let repositoryId: string | null = null;
    if (project.outcomeId) {
      const outcome = await prisma.outcome.findFirst({
        where: { id: project.outcomeId, companyId: project.companyId },
        select: { repositoryId: true },
      });
      repositoryId = outcome?.repositoryId ?? null;
    }

    // Otherwise fall back to the workspace's most-recent repo (the legacy
    // execution behaviour: `repositories` ordered by updatedAt desc, take 1).
    if (!repositoryId) {
      const repo = await prisma.repository.findFirst({
        where: { workspaceId: project.workspaceId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      repositoryId = repo?.id ?? null;
    }

    if (!repositoryId) {
      skipped += 1;
      continue;
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { repositoryId },
    });
    linked += 1;
  }

  console.log(
    `[backfill] projects scanned: ${projects.length} · linked: ${linked} · skipped (no repo in workspace): ${skipped}`
  );
}

main()
  .catch((err: unknown) => {
    console.error("[backfill] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
