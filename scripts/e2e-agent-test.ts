import { execSync } from "node:child_process";

import {
  createExecutionSession,
  prepareExecutionSession,
} from "../src/lib/execution-session-service";
import {
  generateClaudeImplementationBrief,
  type BriefRepositoryContext,
} from "../src/lib/implementation-brief";
import { buildOutcomeCreateData } from "../src/lib/outcome-planning";
import { recordOutcomeSubmittedEvent } from "../src/lib/outcome-planning-lifecycle";
import {
  applyApprovedPlan,
  approvePlanningDraft,
} from "../src/lib/plan-application-service";
import { createOrUpdatePlanningDraftForOutcome } from "../src/lib/planning-draft-service";
import { prisma } from "../src/lib/prisma";

const SANDBOX_REPO_ID = process.env.SANDBOX_REPO_ID;
const COMPANY_ID = process.env.COMPANY_ID;
const ACTOR_ID = process.env.E2E_ACTOR_ID ?? "system";
const TEST_GOAL =
  "Add a /health endpoint that returns { status: 'ok' } and the current UTC timestamp as ISO string";

/**
 * Sleeps for the given number of milliseconds.
 *
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds repository context for brief generation from a DB record.
 *
 * @param repo - Repository row from Prisma.
 * @returns Brief repository context.
 */
function toBriefRepositoryContext(repo: {
  name: string;
  url: string | null;
  primaryLanguage: string | null;
  techStack: string;
  frameworks: string;
  importantFiles: string;
  analysisStatus: string;
}): BriefRepositoryContext {
  return {
    name: repo.name,
    url: repo.url,
    primaryLanguage: repo.primaryLanguage,
    frameworks: JSON.parse(repo.frameworks) as string[],
    techStack: JSON.parse(repo.techStack) as string[],
    importantFiles: JSON.parse(repo.importantFiles) as string[],
    analysisStatus: repo.analysisStatus,
  };
}

/**
 * Generates an implementation brief for the given task and sandbox repository.
 *
 * @param task - Task row with planning draft metadata.
 * @param repo - Sandbox repository record.
 * @returns Generated brief markdown string.
 */
async function generateBriefForTask(
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    planningDraftId: string | null;
    planItemId: string | null;
    planningDraft: { generatedTasks: string } | null;
  },
  repo: BriefRepositoryContext
): Promise<string> {
  const { brief } = generateClaudeImplementationBrief({
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description,
    priority: task.priority,
    planningDraftId: task.planningDraftId,
    planItemId: task.planItemId,
    generatedTasksJson: task.planningDraft?.generatedTasks ?? null,
    repository: repo,
    branchName: null,
    baseBranch: "master",
    linearTicketUrl: null,
  });
  return brief;
}

/**
 * End-to-end agent execution smoke test entry point.
 */
async function main(): Promise<void> {
  console.log("\n🏗️  Avion — End-to-End Agent Execution Smoke Test\n");

  console.log("Step 1: Checking prerequisites...");
  if (!process.env.DATABASE_URL && !process.env.ENGINEERING_OS_DATABASE_PATH) {
    throw new Error("DATABASE_URL or ENGINEERING_OS_DATABASE_PATH not set");
  }
  if (!SANDBOX_REPO_ID) throw new Error("SANDBOX_REPO_ID not set");
  if (!COMPANY_ID) throw new Error("COMPANY_ID not set");

  const repo = await prisma.repository.findFirst({ where: { id: SANDBOX_REPO_ID } });
  if (!repo) throw new Error(`Repository ${SANDBOX_REPO_ID} not found in DB`);

  try {
    execSync("claude --version", { stdio: "pipe" });
  } catch {
    throw new Error("claude CLI not installed or not in PATH");
  }

  try {
    execSync("git --version", { stdio: "pipe" });
  } catch {
    throw new Error("git not available");
  }

  console.log("✅ Prerequisites OK\n");

  console.log("Step 2: Creating outcome...");
  const title = "E2E smoke: /health endpoint";
  const { outcome } = await prisma.$transaction(async (tx) => {
    const runtimeRequest = await tx.runtimeRequest.create({
      data: {
        companyId: COMPANY_ID!,
        title,
        goal: TEST_GOAL,
        requestType: "feature",
        status: "intake",
        assignedTo: "Company",
      },
    });

    const createdOutcome = await tx.outcome.create({
      data: buildOutcomeCreateData({
        companyId: COMPANY_ID!,
        runtimeRequestId: runtimeRequest.id,
        title,
        rawRequest: TEST_GOAL,
      }),
    });

    return { outcome: createdOutcome };
  });

  await recordOutcomeSubmittedEvent({
    companyId: COMPANY_ID!,
    outcomeId: outcome.id,
    outcomeTitle: title,
    actorId: ACTOR_ID,
    source: "runtime_request",
  });

  console.log(`✅ Outcome created: ${outcome.id}\n`);

  console.log("Step 3: Generating plan...");
  const draftResponse = await createOrUpdatePlanningDraftForOutcome({
    companyId: COMPANY_ID!,
    outcomeId: outcome.id,
    actorId: ACTOR_ID,
  });
  console.log(`   Draft status: ${draftResponse.status}`);

  const approvedResult = await approvePlanningDraft({
    companyId: COMPANY_ID!,
    planningDraftId: draftResponse.planningDraftId,
    actorId: ACTOR_ID,
  });
  console.log(`✅ Plan approved: ${approvedResult.planningDraftId}\n`);

  console.log("Step 4: Applying plan...");
  const applied = await applyApprovedPlan({
    companyId: COMPANY_ID!,
    planningDraftId: approvedResult.planningDraftId,
    actorId: ACTOR_ID,
  });
  const tasks = await prisma.task.findMany({
    where: { planningDraftId: approvedResult.planningDraftId, companyId: COMPANY_ID! },
    include: { planningDraft: { select: { generatedTasks: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (tasks.length === 0) throw new Error("No tasks created after applying plan");
  console.log(`✅ Tasks created: ${applied.tasksCreated}`);
  tasks.forEach((t) => console.log(`   - ${t.title}`));
  console.log();

  console.log("Step 5: Preparing execution session...");
  const task = tasks[0]!;
  const repoContext = toBriefRepositoryContext(repo);
  const brief = await generateBriefForTask(task, repoContext);

  const session = await createExecutionSession({
    companyId: COMPANY_ID!,
    taskId: task.id,
    repositoryId: SANDBOX_REPO_ID,
    agentType: "claude_code",
    taskTitle: task.title,
    planningDraftId: approvedResult.planningDraftId,
    branchName: null,
    baseBranch: "master",
  });

  const prepared = await prepareExecutionSession(COMPANY_ID!, session.id, brief);
  if (prepared?.status !== "prepared") {
    throw new Error("Session failed to reach prepared state");
  }

  console.log(`✅ Session prepared: ${prepared.id}`);
  console.log(`   Branch: ${prepared.branchName}`);
  console.log(`   Brief length: ${brief.length} characters\n`);

  console.log("⏳ Now start the worker in another terminal:");
  console.log("   DATABASE_URL=$DATABASE_URL npm run worker\n");
  console.log(`   Waiting for session ${prepared.id} to complete (timeout: 60 min)...`);

  const deadline = Date.now() + 60 * 60 * 1000;
  let finalSession = null;
  while (Date.now() < deadline) {
    await sleep(10_000);
    const current = await prisma.executionSession.findFirst({
      where: { id: prepared.id },
    });
    process.stdout.write(".");
    if (current?.status === "completed" || current?.status === "failed") {
      finalSession = current;
      break;
    }
  }
  console.log();

  if (!finalSession) throw new Error("Session timed out after 60 minutes");

  console.log("\nStep 7: Verifying result...");
  if (finalSession.status === "failed") {
    console.error(`❌ Agent failed: ${finalSession.errorMessage}`);
    process.exit(1);
  }

  const filesChanged = JSON.parse(finalSession.filesChanged || "[]") as string[];
  if (filesChanged.length === 0) {
    throw new Error("No files changed — agent may not have done any work");
  }

  const finalTask = await prisma.task.findFirst({ where: { id: task.id } });
  if (finalTask?.status !== "in-review") {
    throw new Error(`Task not in-review, got: ${finalTask?.status}`);
  }

  const durationMin = Math.round(
    (new Date(finalSession.completedAt!).getTime() -
      new Date(finalSession.startedAt!).getTime()) /
      60000
  );
  console.log(`✅ Agent completed in ~${durationMin} minutes`);
  console.log(`   Files changed: ${filesChanged.join(", ")}`);
  if (finalSession.validationOutput) {
    console.log(`   Validation: ${finalSession.validationOutput.slice(0, 200)}`);
  }

  console.log("\nStep 8: Checking for PR...");
  if (finalSession.commitSha) {
    console.log(`✅ Commit pushed: ${finalSession.commitSha}`);
  } else {
    console.log("⚠️  No commit SHA recorded");
  }
  if (finalSession.prUrl) {
    console.log(`✅ PR opened: ${finalSession.prUrl}`);
    console.log(
      `   PR #${finalSession.prNumber ?? "?"} (status: ${finalSession.prStatus ?? "unknown"})`
    );
  } else {
    console.log(
      `⚠️  No PR URL recorded — check repo manually for branch: ${finalSession.branchName}`
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("SMOKE TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Outcome ID:    ${outcome.id}`);
  console.log(`Plan Draft ID: ${approvedResult.planningDraftId}`);
  console.log(`Task:          ${task.title} (${task.id})`);
  console.log(`Session ID:    ${finalSession.id}`);
  console.log(`Duration:      ~${durationMin} minutes`);
  console.log(`Files changed: ${filesChanged.length}`);
  console.log(`Commit SHA:    ${finalSession.commitSha ?? "not recorded"}`);
  console.log(`PR:            ${finalSession.prUrl ?? "not recorded"}`);
  console.log();
  console.log("🎉 End-to-end test PASSED");
  console.log();
  console.log("Manual checklist:");
  console.log("[ ] Sandbox repo has branch:", finalSession.branchName);
  console.log("[ ] Branch has commit by agent");
  console.log("[ ] Commit adds /health endpoint");
  console.log("[ ] PR is open against default branch");
  console.log("[ ] npm test passes in branch");
  console.log("[ ] Dashboard shows task In Review");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("\n❌ End-to-end test FAILED:", message);
  process.exit(1);
});
