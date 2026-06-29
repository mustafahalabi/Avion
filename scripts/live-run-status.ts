/**
 * Prints the status of the most recent live-run execution session — used to
 * watch the worker drive it to a real PR. Run: `npm run live:status`.
 */
import { prisma } from "../src/lib/prisma";

const COMPANY_ID = "live-run-co";

async function main(): Promise<void> {
  const session = await prisma.executionSession.findFirst({
    where: { companyId: COMPANY_ID },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    console.log("No live-run session found — run `npm run live:prepare` first.");
    return;
  }
  const task = session.taskId
    ? await prisma.task.findFirst({ where: { id: session.taskId }, select: { status: true, title: true } })
    : null;

  console.log("─".repeat(48));
  console.log("  LIVE RUN STATUS");
  console.log("─".repeat(48));
  console.log(`  session     ${session.id}`);
  console.log(`  status      ${session.status}`);
  console.log(`  branch      ${session.branchName ?? "—"} → ${session.baseBranch ?? "—"}`);
  console.log(`  commit      ${session.commitSha ?? "—"}`);
  console.log(`  PR          ${session.prUrl ?? "—"}${session.prNumber ? ` (#${session.prNumber}, ${session.prStatus ?? "?"})` : ""}`);
  console.log(`  task        ${task ? `${task.title} → ${task.status}` : "—"}`);
  if (session.errorMessage) console.log(`  error       ${session.errorMessage}`);
  console.log("─".repeat(48));

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error("live-run-status failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
