import { ClaudeCodeAdapter } from "@/lib/adapters/claude-code-adapter";
import type { PermissionLevel } from "@/lib/adapters/execution-adapter";
import {
  ingestAgentExecutionResult,
  type PrStatus,
} from "@/lib/execution-session-service";
import {
  buildPullRequestBody,
  buildPullRequestTitle,
  openOrReusePullRequest,
  parseGitHubRepoUrl,
} from "@/lib/github-pull-request";
import { prisma } from "@/lib/prisma";
import { getProviderConnection } from "@/lib/provider-connection-service";
import { createWorkerAuditLog } from "@/lib/worker-audit-log";
import { getWorkerPermissions } from "@/lib/worker-permissions";

import {
  buildAgentCommitMessage,
  checkoutRepository,
  commitAndPushSessionBranch,
  evaluatePrePushGuardrails,
  recordPrePushViolations,
  summarizePrePushBlock,
} from "./repo-manager";
import { claimNextSession, releaseSession } from "./session-claimer";
import { validateConfig, WORKER_CONFIG } from "./worker-config";
import { workerLogger } from "./worker-logger";

let isShuttingDown = false;
let activeCleanup: (() => Promise<void>) | null = null;

/**
 * Sleeps for the given number of milliseconds.
 *
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gracefully stops the worker and cleans up any active checkout.
 */
async function handleShutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  workerLogger.info("Shutting down gracefully...");
  if (activeCleanup) {
    await activeCleanup();
  }
  process.exit(0);
}

/**
 * Processes a claimed execution session end-to-end.
 *
 * @param sessionId - Claimed session ID.
 */
async function processSession(sessionId: string): Promise<void> {
  const fullSession = await prisma.executionSession.findFirst({
    where: { id: sessionId },
    include: {
      task: true,
      repository: true,
      company: { include: { settings: true } },
    },
  });

  if (!fullSession) {
    workerLogger.error(`Session ${sessionId} not found after claim`);
    return;
  }

  workerLogger.info(
    `Claimed session ${fullSession.id} (task: ${fullSession.taskId ?? "no task"})`
  );

  const autonomyLevel = fullSession.company?.settings?.autonomyLevel ?? "assist";
  const permissions = getWorkerPermissions(autonomyLevel);
  const permissionLevel: PermissionLevel = WORKER_CONFIG.WORKER_PERMISSION_MODE_OVERRIDE
    ? (WORKER_CONFIG.WORKER_PERMISSION_MODE_OVERRIDE as PermissionLevel)
    : permissions.permissionLevel;

  const repo = fullSession.repository;
  if (!repo?.url) {
    await releaseSession(fullSession.id, "failed", "No repository URL on session");
    return;
  }

  if (!fullSession.taskBrief) {
    await releaseSession(fullSession.id, "failed", "No task brief on session");
    return;
  }

  let cleanup: (() => Promise<void>) | null = null;
  const startTime = Date.now();

  try {
    workerLogger.info(`Checking out repo: ${repo.url}`);

    const githubConnection = await getProviderConnection(fullSession.companyId, "github");
    const checkout = await checkoutRepository(
      {
        url: repo.url,
        credentials: githubConnection?.encryptedTokens ?? null,
      },
      fullSession.branchName ?? "main",
      WORKER_CONFIG.WORKER_REPO_BASE_DIR,
      fullSession.id
    );
    cleanup = checkout.cleanup;
    activeCleanup = cleanup;

    const adapter = new ClaudeCodeAdapter();
    workerLogger.info(
      `Running claude -p (permission: ${permissionLevel}, timeout: ${WORKER_CONFIG.WORKER_SESSION_TIMEOUT_SECONDS}s)`
    );

    const result = await adapter.run(fullSession.taskBrief, {
      repositoryPath: checkout.path,
      branchName: fullSession.branchName ?? "main",
      permissionLevel,
      timeoutSeconds: WORKER_CONFIG.WORKER_SESSION_TIMEOUT_SECONDS,
      sessionId: fullSession.id,
    });

    const durationMs = Date.now() - startTime;
    workerLogger.info(
      `Agent ${result.success ? "completed" : "failed"} in ${durationMs}ms. Files changed: ${result.filesChanged.length}`
    );

    // Pre-push guardrail gate (MUS-213): enforce protected paths, protected
    // branches, and denied/dangerous git commands BEFORE any commit/push. This
    // is enforced independently of the agent's claude -p permission mode — a
    // bypassPermissions run still cannot push protected paths or branches.
    const auditLog = createWorkerAuditLog(fullSession.id);
    let commitSha: string | null = null;
    const branchName = fullSession.branchName ?? "main";

    if (result.success) {
      const guard = evaluatePrePushGuardrails({
        checkoutPath: checkout.path,
        branchName,
        permissions,
      });

      if (!guard.passed) {
        recordPrePushViolations(auditLog, guard);
        const reason = summarizePrePushBlock(guard);
        auditLog.log("session_failed", { reason }, "error", "system");
        workerLogger.error(reason);
        workerLogger.info(auditLog.getSummary());
        await prisma.executionSession.update({
          where: { id: fullSession.id },
          data: { validationOutput: auditLog.serialize() },
        });
        await releaseSession(fullSession.id, "failed", reason);
        return;
      }

      const pushResult = commitAndPushSessionBranch({
        checkoutPath: checkout.path,
        branchName,
        commitMessage: buildAgentCommitMessage(
          fullSession.task?.title ?? null,
          fullSession.taskId
        ),
        baseCommitSha: checkout.baseCommitSha,
      });
      commitSha = pushResult.commitSha;
      workerLogger.info(
        pushResult.pushed
          ? `Pushed branch ${branchName} @ ${commitSha}`
          : `No agent changes to push for branch ${branchName}`
      );
    }

    // Open (or reuse) a pull request for the pushed branch. Only when there is
    // a commit to review. A PR failure is recorded on the session, not dropped.
    let prUrl: string | null = null;
    let prNumber: number | null = null;
    let prStatus: PrStatus | null = null;
    let prError: string | null = null;

    if (commitSha) {
      const parsedRepo = parseGitHubRepoUrl(repo.url);
      const githubToken =
        githubConnection?.tokens.accessToken ??
        githubConnection?.tokens.manualToken ??
        null;

      if (!parsedRepo) {
        prError = `Could not parse GitHub owner/repo from URL "${repo.url}".`;
        workerLogger.error(prError);
      } else if (!githubToken) {
        prError = "No GitHub token available to open a pull request.";
        workerLogger.error(prError);
      } else {
        try {
          const pr = await openOrReusePullRequest({
            token: githubToken,
            owner: parsedRepo.owner,
            repo: parsedRepo.repo,
            head: branchName,
            base: fullSession.baseBranch ?? "master",
            title: buildPullRequestTitle(fullSession.task?.title ?? null),
            body: buildPullRequestBody({
              taskTitle: fullSession.task?.title ?? branchName,
              summary: result.resultSummary,
              filesChanged: result.filesChanged,
              validationOutput: result.validationOutput,
            }),
          });
          prUrl = pr.prUrl;
          prNumber = pr.prNumber;
          prStatus = pr.prStatus;
          workerLogger.info(
            `${pr.reused ? "Reused" : "Opened"} PR #${pr.prNumber}: ${pr.prUrl}`
          );
        } catch (err: unknown) {
          prError = err instanceof Error ? err.message : String(err);
          workerLogger.error(`Failed to open pull request: ${prError}`);
        }
      }
    }

    const combinedError =
      [result.errorMessage, prError].filter(Boolean).join(" | ") || null;

    const outcome = await ingestAgentExecutionResult({
      companyId: fullSession.companyId,
      sessionId: fullSession.id,
      status: result.success ? "completed" : "failed",
      resultSummary: result.resultSummary,
      filesChanged: result.filesChanged,
      validationOutput: result.validationOutput,
      errorMessage: combinedError,
      commitSha,
      prUrl,
      prNumber,
      prStatus,
    });

    workerLogger.info(
      `Result ingested. Task status: ${outcome.newTaskStatus ?? "unchanged"}`
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    workerLogger.error(`Session ${fullSession.id} failed: ${message}`);
    await releaseSession(fullSession.id, "failed", message);
  } finally {
    if (cleanup) {
      await cleanup();
    }
    activeCleanup = null;
    workerLogger.info(
      `Cleaned up ${WORKER_CONFIG.WORKER_REPO_BASE_DIR}/${fullSession.id}`
    );
  }
}

/**
 * Polls for prepared sessions and executes them until shutdown.
 */
async function startPollingLoop(): Promise<void> {
  while (!isShuttingDown) {
    const session = await claimNextSession();

    if (!session) {
      workerLogger.info("No sessions queued. Waiting...");
      await sleep(WORKER_CONFIG.WORKER_POLL_INTERVAL_MS);
      continue;
    }

    await processSession(session.id);
  }
}

/**
 * Worker entry point.
 */
async function main(): Promise<void> {
  validateConfig();
  workerLogger.info(
    `Worker started. Polling every ${WORKER_CONFIG.WORKER_POLL_INTERVAL_MS}ms.`
  );

  process.on("SIGINT", () => {
    void handleShutdown();
  });
  process.on("SIGTERM", () => {
    void handleShutdown();
  });

  await startPollingLoop();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  workerLogger.error(`Worker crashed: ${message}`);
  process.exit(1);
});
