import { resolveExecutionAdapter } from "@/lib/adapters/adapter-registry";
import type {
  ExecutionAdapter,
  PermissionLevel,
} from "@/lib/adapters/execution-adapter";
import { getCommandsForRepo } from "@/lib/check-command-profile";
import {
  runValidationCommands,
  serializeValidationChecksMarker,
  type RunValidationResult,
} from "@/lib/validation-runner";
import {
  classifyAgentRunForIngestion,
  ingestAgentExecutionResult,
  reapStaleRunningSessions,
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
  ensureDependenciesInstalled,
  summarizeDependencyInstall,
} from "./dependency-installer";
import { createHeartbeat } from "./heartbeat";
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
 * Parses a JSON string array column (e.g. repository.frameworks) into a string[].
 *
 * @param value - JSON string or null.
 * @returns Parsed string array, or [] on any parse failure.
 */
function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Joins existing validation output with an additional block.
 *
 * @param existing - Prior validation output (agent-reported), or null.
 * @param addition - Block to append.
 * @returns Combined output.
 */
function appendValidation(existing: string | null, addition: string): string {
  return [existing, addition].filter(Boolean).join("\n\n");
}

/**
 * Renders a {@link RunValidationResult} as a readable markdown block for the PR body and QA gate.
 *
 * @param validation - The validation run result.
 * @returns A markdown summary of each command's outcome.
 */
function summarizeValidation(validation: RunValidationResult): string {
  const lines = validation.results.map((r) =>
    r.skipped
      ? `- [skipped] ${r.kind}: ${r.command}${r.skipReason ? ` (${r.skipReason})` : ""}`
      : `- [${r.passed ? "pass" : "fail"}] ${r.kind}: ${r.command} (exit ${r.exitCode})`
  );
  return `## Validation commands (allPassed: ${validation.allPassed})\n${lines.join("\n")}`;
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

  // Adapter selection (MUS-264): the session's agentType picks the provider.
  // An unknown type is an explicit pre-flight failure — the session is
  // ingested as failed, the worker keeps polling.
  let adapter: ExecutionAdapter;
  try {
    adapter = resolveExecutionAdapter(fullSession.agentType);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    workerLogger.error(message);
    await releaseSession(fullSession.id, "failed", message);
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

    workerLogger.info(
      `Running ${adapter.agentType} agent (permission: ${permissionLevel}, timeout: ${WORKER_CONFIG.WORKER_SESSION_TIMEOUT_SECONDS}s)`
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

    // ── Run the repository's real validation commands (close-the-loop) ────────
    // The QA gate derives its automated verdict from these results, so a fresh
    // clone first gets its dependencies installed (bounded, permission-guarded)
    // instead of silently skipping every check. Never crashes the worker.
    let combinedValidationOutput: string | null = result.validationOutput;
    if (result.success) {
      try {
        const commands = getCommandsForRepo({
          primaryLanguage: repo.primaryLanguage ?? undefined,
          frameworks: parseJsonArray(repo.frameworks),
          techStack: parseJsonArray(repo.techStack),
        });
        if (commands.length === 0) {
          // No validation commands detected for this repository profile.
        } else {
          const install = await ensureDependenciesInstalled({
            repoPath: checkout.path,
            permissions,
            timeoutSeconds: WORKER_CONFIG.WORKER_INSTALL_TIMEOUT_SECONDS,
          });
          if (install.attempted || !install.ok) {
            combinedValidationOutput = appendValidation(
              combinedValidationOutput,
              summarizeDependencyInstall(install)
            );
            workerLogger.info(install.summary);
          }
          if (install.ok) {
            const validation = await runValidationCommands({
              repoPath: checkout.path,
              commands,
              timeoutSeconds: WORKER_CONFIG.WORKER_SESSION_TIMEOUT_SECONDS,
              permissions,
            });
            combinedValidationOutput = appendValidation(
              combinedValidationOutput,
              summarizeValidation(validation)
            );
            // Machine-readable block the QA gate parses back for its verdict.
            combinedValidationOutput = appendValidation(
              combinedValidationOutput,
              serializeValidationChecksMarker(validation.results)
            );
            workerLogger.info(
              `Ran ${validation.results.length} validation command(s): allPassed=${validation.allPassed}`
            );
          } else {
            combinedValidationOutput = appendValidation(
              combinedValidationOutput,
              "## Validation commands\nSkipped: dependency install did not succeed."
            );
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        workerLogger.info(`Validation run skipped: ${message}`);
      }
    }

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
        // Evaluate what the agent committed since checkout, not just the working
        // tree — a bypassPermissions run commits its own edits (MUS-281).
        baseCommitSha: checkout.baseCommitSha,
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
            // Omit to auto-resolve the repo's real default branch (main vs master).
            base: fullSession.baseBranch ?? undefined,
            title: buildPullRequestTitle(fullSession.task?.title ?? null),
            body: buildPullRequestBody({
              taskTitle: fullSession.task?.title ?? branchName,
              summary: result.resultSummary,
              filesChanged: result.filesChanged,
              validationOutput: combinedValidationOutput,
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

    // No-op detection (MUS-252): an agent that claims success without a commit
    // must not advance the task — ingest the run as failed so the retry policy
    // (bounded, with backoff) owns what happens next.
    const classification = classifyAgentRunForIngestion({
      agentSuccess: result.success,
      commitSha,
      // A commit with no PR (open failed / 422 against a wrong base / missing
      // token) must not advance the task to review/done (MUS-282).
      prOpenFailed: commitSha !== null && prError !== null,
    });
    if (classification.noOp) {
      workerLogger.error(classification.noOpReason ?? "No-op agent run.");
    }

    const combinedError =
      [result.errorMessage, prError, classification.noOpReason]
        .filter(Boolean)
        .join(" | ") || null;

    const outcome = await ingestAgentExecutionResult({
      companyId: fullSession.companyId,
      sessionId: fullSession.id,
      status: classification.status,
      resultSummary: result.resultSummary,
      filesChanged: result.filesChanged,
      validationOutput: combinedValidationOutput,
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
  // Liveness signal (MUS-269): touch the heartbeat file once per iteration so
  // container HEALTHCHECKs can assert freshness. Note a running session can
  // legitimately hold one iteration for up to WORKER_SESSION_TIMEOUT_SECONDS —
  // liveness checks must allow for that (see docs/DEPLOYMENT.md).
  const heartbeat = createHeartbeat("worker", process.env.WORKER_HEARTBEAT_FILE);

  while (!isShuttingDown) {
    heartbeat.beat();

    // Crash recovery (MUS-280): release any session left `running` past the
    // session timeout by a worker that died mid-run, so an orphan can't stall the
    // driver (findLiveSessionForTask + concurrency) for its task forever.
    try {
      const reaped = await reapStaleRunningSessions({
        timeoutSeconds: WORKER_CONFIG.WORKER_SESSION_TIMEOUT_SECONDS,
      });
      if (reaped > 0) {
        workerLogger.info(`Reaped ${reaped} stale running session(s) (crash recovery).`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      workerLogger.error(`Stale-session reaper failed: ${message}`);
    }

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
