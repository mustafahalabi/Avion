/**
 * Local self-driving dogfood (no external services).
 *
 * Proves the autonomous loop end-to-end against REAL code paths, a REAL temp
 * database, and a REAL git remote (a local bare repo) — exercising:
 *
 *   driver tick → auto-prepare session (MUS-210)
 *     → checkout repo + pre-push guardrail gate (MUS-213)
 *     → commit & push the branch to origin (MUS-207)
 *     → ingest result + commit metadata (MUS-209)
 *     → auto-advance review → QA → done by autonomy (MUS-212)
 *     → continuous driver re-tick (MUS-211)
 *
 * The ONLY things stubbed (because they need your accounts/credentials and cost
 * money) are the AI agent step (`claude -p`, replaced by a deterministic file
 * write) and the GitHub PR API (`openOrReusePullRequest`, skipped — the local
 * "origin" is a bare git repo, not GitHub). Everything else is the production
 * code. For the fully-real run see scripts/DOGFOOD.md.
 *
 * Run: `npm run dogfood:local`
 */

import { Client } from "pg";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ─── Isolated scratch space + disposable DB schema (set BEFORE app imports) ─────

const ROOT = process.cwd();
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "eos-dogfood-"));
const ORIGIN = path.join(WORK, "origin.git"); // bare "remote"
const SEED_REPO = path.join(WORK, "seed");
const WORKER_BASE = path.join(WORK, "worker-checkouts");

// Run against a throwaway PostgreSQL schema on the configured database so the
// dogfood never touches real data. Defaults to a local Docker Postgres; point
// DOGFOOD_DATABASE_URL / DATABASE_URL at any reachable Postgres.
const BASE_URL =
  process.env.DOGFOOD_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/avion";
const SCHEMA = `dogfood_${Date.now()}`;

function baseNoSchema(base: string): string {
  const u = new URL(base);
  u.searchParams.delete("schema");
  return u.toString();
}
function urlWithSchema(base: string, schema: string): string {
  const u = new URL(base);
  u.searchParams.delete("schema");
  u.searchParams.set("schema", schema);
  return u.toString();
}

process.env.DATABASE_URL = urlWithSchema(BASE_URL, SCHEMA);

const COMPANY_ID = "dogfood-co";

function step(msg: string): void {
  console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`);
}
function ok(msg: string): void {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}
function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

/** Concatenated DDL of every migration (sorted) — the full current schema. */
function migrationDdl(): string {
  const dir = path.join(ROOT, "prisma", "migrations");
  const dirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const parts: string[] = [];
  for (const d of dirs) {
    try {
      parts.push(fs.readFileSync(path.join(dir, d, "migration.sql"), "utf8"));
    } catch {
      /* directory without a migration.sql — skip */
    }
  }
  if (parts.length === 0) {
    throw new Error(`No migration SQL found under ${dir}`);
  }
  return parts.join("\n");
}

/** Creates a disposable PostgreSQL schema and applies the real migration DDL. */
async function buildSchema(): Promise<void> {
  const admin = new Client({ connectionString: baseNoSchema(BASE_URL) });
  await admin.connect();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await admin.query(`CREATE SCHEMA "${SCHEMA}"`);
    await admin.query(`SET search_path TO "${SCHEMA}"`);
    await admin.query(migrationDdl());
  } finally {
    await admin.end();
  }
}

/** Drops the disposable schema. Best-effort. */
async function dropSchema(): Promise<void> {
  try {
    const admin = new Client({ connectionString: baseNoSchema(BASE_URL) });
    await admin.connect();
    await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await admin.end();
  } catch {
    /* ignore */
  }
}

/** Creates a bare "origin" repo with one seed commit on master. */
function buildOrigin(): string {
  fs.mkdirSync(ORIGIN, { recursive: true });
  git("init --bare --initial-branch=master", ORIGIN);

  fs.mkdirSync(SEED_REPO, { recursive: true });
  git("init --initial-branch=master", SEED_REPO);
  fs.writeFileSync(path.join(SEED_REPO, "README.md"), "# Dogfood sandbox\n");
  git("add -A", SEED_REPO);
  git(`-c user.name=Seed -c user.email=seed@local commit -m "chore: seed"`, SEED_REPO);
  git(`remote add origin file://${ORIGIN}`, SEED_REPO);
  git("push origin master", SEED_REPO);
  return `file://${ORIGIN}`;
}

async function main(): Promise<void> {
  console.log("\n🐕 Avion — Local Self-Driving Dogfood\n" + "─".repeat(54));

  step("Setup: disposable Postgres schema (real schema) + local git origin");
  await buildSchema();
  const repoUrl = buildOrigin();
  ok(`disposable schema: ${SCHEMA} on ${baseNoSchema(BASE_URL)}`);
  ok(`origin (bare git): ${ORIGIN}`);

  // Import app modules AFTER env is set so prisma binds to the temp DB.
  const { prisma } = await import("../src/lib/prisma");
  const { autoPrepareNextExecutionSession } = await import(
    "../src/lib/auto-execution-service"
  );
  const { runDriverTickForCompany, summarizeDriverTick } = await import(
    "../src/lib/execution-driver-service"
  );
  const {
    checkoutRepository,
    evaluatePrePushGuardrails,
    commitAndPushSessionBranch,
    buildAgentCommitMessage,
  } = await import("../src/worker/repo-manager");
  const { getWorkerPermissions } = await import("../src/lib/worker-permissions");
  const { ingestAgentExecutionResult } = await import(
    "../src/lib/execution-session-service"
  );
  const { advanceTaskGates } = await import("../src/lib/gate-advancement-service");

  step("Seed: company at AUTONOMOUS + repo + approved plan + one todo task");
  await prisma.user.create({
    data: { id: "dogfood-user", email: "ceo@dogfood.local", name: "CEO" },
  });
  await prisma.company.create({
    data: { id: COMPANY_ID, name: "Dogfood Co", slug: "dogfood", ownerId: "dogfood-user" },
  });
  await prisma.companySettings.create({
    data: { companyId: COMPANY_ID, autonomyLevel: "autonomous" },
  });
  await prisma.workspace.create({
    data: { id: "ws-1", companyId: COMPANY_ID, name: "Default", slug: "default" },
  });
  await prisma.repository.create({
    data: {
      id: "repo-1",
      workspaceId: "ws-1",
      name: "sandbox",
      url: repoUrl,
      primaryLanguage: "TypeScript",
      analysisStatus: "complete",
    },
  });
  await prisma.project.create({
    data: { id: "proj-1", companyId: COMPANY_ID, workspaceId: "ws-1", name: "Health", slug: "health" },
  });
  const runtimeRequest = await prisma.runtimeRequest.create({
    data: { companyId: COMPANY_ID, title: "Add /health endpoint", goal: "Add a /health endpoint", status: "intake", assignedTo: "Company" },
  });
  const outcome = await prisma.outcome.create({
    data: { companyId: COMPANY_ID, runtimeRequestId: runtimeRequest.id, title: "Add /health endpoint", rawRequest: "Add a /health endpoint" },
  });
  const draft = await prisma.planningDraft.create({
    data: { companyId: COMPANY_ID, outcomeId: outcome.id, title: "Plan: /health", status: "approved", approvedAt: new Date() },
  });
  const task = await prisma.task.create({
    data: {
      id: "task-1",
      companyId: COMPANY_ID,
      projectId: "proj-1",
      planningDraftId: draft.id,
      planItemId: "task:health",
      title: "Add /health endpoint",
      description: "Return { status: 'ok' }",
      status: "todo",
    },
  });
  ok(`task ${task.id} "${task.title}" is todo under an approved plan`);

  // ── 1. Driver enqueues the next task (no UI) ──────────────────────────────
  step("1. Driver tick → auto-prepare the next executable task (MUS-210/211)");
  const tick1 = await runDriverTickForCompany(COMPANY_ID);
  console.log(`  ${summarizeDriverTick(tick1)}`);
  const prepared = await prisma.executionSession.findFirst({
    where: { companyId: COMPANY_ID, taskId: task.id, status: "prepared" },
  });
  assert(prepared, "a prepared session should exist after the driver tick");
  assert(prepared.branchName, "the prepared session should have a branch name");
  assert(prepared.repositoryId === "repo-1", "session should resolve the repository");
  ok(`prepared session ${prepared.id} on branch ${prepared.branchName}`);

  // ── 2. Worker: checkout + guardrail gate + commit/push (agent step stubbed) ─
  step("2. Worker: checkout, guardrail gate, commit & push (MUS-213/207)");
  const checkout = await checkoutRepository(
    { url: repoUrl, credentials: null },
    prepared.branchName,
    WORKER_BASE,
    prepared.id
  );
  ok(`checked out ${prepared.branchName} (base ${checkout.baseCommitSha.slice(0, 7)})`);

  // —— stubbed agent: deterministic edit in place of `claude -p` ——
  fs.mkdirSync(path.join(checkout.path, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(checkout.path, "src", "health.ts"),
    "export const health = () => ({ status: 'ok', time: new Date().toISOString() });\n"
  );
  ok("agent (stubbed) wrote src/health.ts");

  const guard = evaluatePrePushGuardrails({
    checkoutPath: checkout.path,
    branchName: prepared.branchName,
    permissions: getWorkerPermissions("autonomous"),
  });
  assert(guard.passed, `guardrail gate must pass for a clean src/ edit: ${JSON.stringify(guard.violations)}`);
  ok(`guardrail gate PASSED (evaluated ${guard.changedFiles.join(", ")})`);

  const push = commitAndPushSessionBranch({
    checkoutPath: checkout.path,
    branchName: prepared.branchName,
    commitMessage: buildAgentCommitMessage(task.title, task.id),
    baseCommitSha: checkout.baseCommitSha,
  });
  assert(push.pushed && push.commitSha, "the session branch should be pushed with a commit");
  ok(`pushed ${prepared.branchName} @ ${push.commitSha!.slice(0, 7)} to origin`);

  // verify the branch + commit really landed on the (local) origin
  const remoteSha = git(`--git-dir=${ORIGIN} rev-parse ${prepared.branchName}`, ROOT);
  assert(remoteSha === push.commitSha, "origin must hold the agent's commit");
  ok(`origin confirms branch ${prepared.branchName} @ ${remoteSha.slice(0, 7)}`);
  await checkout.cleanup();

  // ── 3. Ingest result + commit metadata ───────────────────────────────────
  step("3. Ingest agent result + commit metadata → task in-review (MUS-209)");
  await ingestAgentExecutionResult({
    companyId: COMPANY_ID,
    sessionId: prepared.id,
    status: "completed",
    resultSummary: "Added /health endpoint.",
    filesChanged: ["src/health.ts"],
    validationOutput: "tsc, lint, test all pass (simulated)",
    errorMessage: null,
    commitSha: push.commitSha,
  });
  const afterIngest = await prisma.task.findUnique({ where: { id: task.id }, select: { status: true } });
  assert(afterIngest?.status === "in-review", "task should move to in-review");
  ok("session completed; task → in-review (PR step skipped: local origin is not GitHub)");

  // ── 4. Auto-advance the gates by autonomy ─────────────────────────────────
  step("4. Auto-advance review → QA → done (MUS-212)");
  const gate = await advanceTaskGates(COMPANY_ID, task.id);
  console.log(`  gate result: ${gate.status} — ${gate.reason}`);
  assert(gate.status === "completed", "autonomous gates should complete review + QA");

  const finalTask = await prisma.task.findUnique({ where: { id: task.id }, select: { status: true } });
  const review = await prisma.review.findFirst({ where: { companyId: COMPANY_ID, entityId: task.id } });
  const qa = await prisma.qAResult.findFirst({ where: { companyId: COMPANY_ID, entityId: task.id } });
  assert(finalTask?.status === "done", "task should be done");
  assert(review?.status === "approved", "review must be approved (gate not skipped)");
  assert(qa?.status === "passed", "QA must be passed (gate not skipped)");
  ok("review APPROVED, QA PASSED, task DONE — no gate skipped");

  // ── 5. Driver re-tick is a stable no-op (nothing left) ────────────────────
  step("5. Driver re-tick → nothing left to do (stable, idempotent — MUS-211)");
  const tick2 = await runDriverTickForCompany(COMPANY_ID);
  console.log(`  ${summarizeDriverTick(tick2)}`);
  const prepedAfter = await prisma.executionSession.count({
    where: { companyId: COMPANY_ID, status: { in: ["queued", "prepared", "running"] } },
  });
  assert(prepedAfter === 0, "no live sessions should remain");
  ok("driver idle — the one task self-drove to done");

  await prisma.$disconnect();
  console.log("\n" + "─".repeat(54));
  console.log("\x1b[32m🎉 SELF-DRIVING LOOP VERIFIED end-to-end (local).\x1b[0m");
  console.log("   plan → auto-prepare → guardrail gate → commit+push →");
  console.log("   ingest → review → QA → done — with no manual clicks.\n");
}

main()
  .catch((err: unknown) => {
    console.error("\n\x1b[31m✗ Dogfood failed:\x1b[0m", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await dropSchema();
    try {
      fs.rmSync(WORK, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
