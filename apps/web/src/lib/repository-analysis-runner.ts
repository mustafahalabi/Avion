import { prisma } from "@/lib/prisma";
import { getGitHubConnectionStatus } from "@/lib/github-connection-service";
import {
  cloneRepositoryToTempDir,
  type RepositoryCloneResult,
} from "@/lib/repository-clone";

/**
 * Session-free core of repository analysis, shared by the manual "Analyze"
 * action and the automatic on-connect trigger.
 *
 * Clones the repository (using the company's stored GitHub token for private
 * repos) into a temp directory, runs the analyzer against that checkout, then
 * deletes it. Clone failures are recorded on the repository so they surface in
 * the same "analysis notes" area as analyzer failures. Never throws — designed
 * to be safe to run in a fire-and-forget `after()` callback.
 */
export interface RunRepositoryAnalysisResult {
  /** "skipped" | "failed" | the snapshot status ("completed" | "failed"). */
  status: string;
  snapshotId?: string;
  message: string;
}

export async function runRepositoryAnalysis(input: {
  repositoryId: string;
  companyId: string;
}): Promise<RunRepositoryAnalysisResult> {
  const { repositoryId, companyId } = input;

  const repository = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { companyId } },
    select: { id: true, url: true },
  });
  if (!repository) {
    return { status: "skipped", message: "Repository not found." };
  }
  if (!repository.url) {
    // No URL to clone — leave the repo `pending` (not `failed`) so a URL can be
    // added later and analysis retried. This is a no-op, not an error.
    return {
      status: "skipped",
      message: "Repository has no URL; skipping analysis.",
    };
  }

  const connection = await getGitHubConnectionStatus(companyId);
  const token = connection.raw?.tokens.accessToken ?? null;

  let clone: RepositoryCloneResult | null = null;
  try {
    clone = await cloneRepositoryToTempDir({ url: repository.url, token });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to clone repository.";
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { analysisStatus: "failed", analysisNotes: message },
    });
    return { status: "failed", message };
  }

  try {
    const { createRepositoryAnalysisSnapshot } = await import(
      "@/lib/repository-snapshot-service"
    );
    const snapshot = await createRepositoryAnalysisSnapshot({
      repositoryId,
      companyId,
      localPath: clone.path,
    });
    return {
      status: snapshot.status,
      snapshotId: snapshot.id,
      message:
        snapshot.status === "failed"
          ? snapshot.error ?? "Repository analysis failed."
          : "Repository analysis complete.",
    };
  } catch (err) {
    // Defensive: the snapshot service records its own `failed` status on
    // analyzer errors, but guard against an unexpected throw so an `after()`
    // caller never surfaces an unhandled rejection.
    const message =
      err instanceof Error ? err.message : "Repository analysis failed.";
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { analysisStatus: "failed", analysisNotes: message },
    });
    return { status: "failed", message };
  } finally {
    clone.cleanup();
  }
}
