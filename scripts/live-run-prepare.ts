/**
 * Live-run preparer (real GitHub + real Claude).
 *
 * Seeds dev.db with a company + your sandbox repository + a GitHub connection,
 * then creates and prepares ONE execution session pointed at the sandbox. The
 * worker (`npm run worker`) then executes it for real: clones the sandbox, runs
 * `claude -p`, commits, pushes a branch, and opens a real PR.
 *
 * Required env (put secrets in .env.live — gitignored):
 *   SANDBOX_REPO_URL  https://github.com/<you>/<sandbox>
 *   GITHUB_TOKEN      PAT with `repo` scope for that sandbox
 * Optional:
 *   GITHUB_LOGIN      your github login (for nicer PR head filter; defaults to owner)
 *   LIVE_GOAL         the change to make (defaults to adding a demo Markdown file)
 *
 * Also needs CREDENTIALS_ENCRYPTION_KEY (already in .env) and DATABASE_URL.
 *
 * Run via: `npm run live:prepare` (which sources .env + .env.live first).
 */

import { recordGitHubConnection } from "../src/lib/github-connection-service";
import { parseGitHubRepoUrl } from "../src/lib/github-pull-request";
import { generateClaudeImplementationBrief } from "../src/lib/implementation-brief";
import {
  createExecutionSession,
  prepareExecutionSession,
} from "../src/lib/execution-session-service";
import { prisma } from "../src/lib/prisma";

const COMPANY_ID = "live-run-co";
const WORKSPACE_ID = "live-run-ws";
const REPO_ID = "live-run-repo";
const USER_ID = "live-run-user";

const DEFAULT_GOAL =
  "Add a top-level Markdown file named AVION_DEMO.md containing a single " +
  "sentence stating that this change was made autonomously by Avion. " +
  "Do not modify any other files and do not install dependencies.";

async function githubDefaultBranch(
  owner: string,
  repo: string,
  token: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub repo lookup failed (${res.status}). Check SANDBOX_REPO_URL and that the token has access.`
    );
  }
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch ?? "main";
}

async function main(): Promise<void> {
  const repoUrl = requireEnv("SANDBOX_REPO_URL");
  const token = requireEnv("GITHUB_TOKEN");
  const goal = process.env.LIVE_GOAL?.trim() || DEFAULT_GOAL;

  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set (source .env first).");
  }

  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) throw new Error(`SANDBOX_REPO_URL is not a GitHub URL: ${repoUrl}`);
  const login = process.env.GITHUB_LOGIN?.trim() || parsed.owner;

  console.log(`\n🔧 Preparing live run against ${parsed.owner}/${parsed.repo}\n`);

  const baseBranch = await githubDefaultBranch(parsed.owner, parsed.repo, token);
  console.log(`   default branch: ${baseBranch}`);

  // ── Seed company + workspace + repository (idempotent) ─────────────────────
  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "live-run@local", name: "Live Run" },
  });
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: { id: COMPANY_ID, name: "Live Run Co", slug: "live-run", ownerId: USER_ID },
  });
  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: { autonomyLevel: "assist" },
    create: { companyId: COMPANY_ID, autonomyLevel: "assist" },
  });
  await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: { id: WORKSPACE_ID, companyId: COMPANY_ID, name: "Default", slug: "default" },
  });
  await prisma.repository.upsert({
    where: { id: REPO_ID },
    update: { url: repoUrl },
    create: {
      id: REPO_ID,
      workspaceId: WORKSPACE_ID,
      name: parsed.repo,
      url: repoUrl,
      primaryLanguage: "Unknown",
      analysisStatus: "complete",
    },
  });

  // ── Store the GitHub token (encrypted) as a company connection ─────────────
  await recordGitHubConnection({
    companyId: COMPANY_ID,
    userId: null,
    connectionType: "manual_token",
    accessToken: token,
    grantedScopes: ["repo"],
    externalAccountName: login,
  });
  console.log("   GitHub connection stored (token encrypted)");

  // ── One task + brief, then create + prepare the session ────────────────────
  const taskTitle = process.env.LIVE_TITLE?.trim() || "Apply the requested repository change";
  const task = await prisma.task.create({
    data: {
      companyId: COMPANY_ID,
      title: taskTitle,
      description: goal,
      status: "todo",
      priority: "low",
    },
  });

  const { brief, branchName } = generateClaudeImplementationBrief({
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description ?? null,
    priority: task.priority,
    planningDraftId: null,
    planItemId: null,
    generatedTasksJson: null,
    repository: {
      name: parsed.repo,
      url: repoUrl,
      primaryLanguage: null,
      frameworks: [],
      techStack: [],
      importantFiles: [],
      analysisStatus: "complete",
    },
    branchName: null,
    baseBranch,
    linearTicketUrl: null,
  });

  const session = await createExecutionSession({
    companyId: COMPANY_ID,
    taskId: task.id,
    repositoryId: REPO_ID,
    agentType: "claude_code",
    taskTitle: task.title,
    branchName,
    baseBranch,
  });
  const prepared = await prepareExecutionSession(COMPANY_ID, session.id, brief);
  if (prepared?.status !== "prepared") throw new Error("session did not reach prepared");

  await prisma.$disconnect();

  console.log("\n✅ Prepared. The worker will pick this up:");
  console.log(`   SESSION_ID = ${prepared.id}`);
  console.log(`   TASK_ID    = ${task.id}`);
  console.log(`   BRANCH     = ${prepared.branchName}  →  base ${baseBranch}`);
  console.log(`   REPO       = ${repoUrl}`);
  console.log("\n   Now run:  npm run live:worker\n");
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env: ${name}`);
  return v.trim();
}

main().catch((err: unknown) => {
  console.error("\n✗ live-run-prepare failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
