/**
 * Planning eval harness.
 *
 * Scores planning drafts against grounding + quality properties on a set of fixtures.
 * The deterministic adapter is always evaluated. The configured provider (the AI adapter)
 * is additionally evaluated only when `EOS_PLANNING_PROVIDER=ai` is set, so this harness
 * runs and passes with no live LLM by default.
 *
 * Run with:
 *   npx tsx scripts/planning-eval.ts
 *   EOS_PLANNING_PROVIDER=ai npx tsx scripts/planning-eval.ts
 */
import { PLANNING_EVAL_CASES } from "../src/lib/planning/__fixtures__/planning-eval-cases";
import type { PlanningAdapter } from "../src/lib/planning/planning-adapter";
import { DeterministicPlanningAdapter } from "../src/lib/planning/deterministic-planning-adapter";
import {
  resolvePlanningAdapter,
  resolvePlanningProviderId,
} from "../src/lib/planning/planning-provider";
import { scorePlanningDraft, type PlanEvalCase } from "../src/lib/planning/plan-eval";

interface CaseColumnResult {
  readonly provider: string;
  readonly score: number;
  readonly max: number;
  readonly failed: boolean;
  readonly failureReason?: string;
}

/**
 * Runs a single adapter against a single case and returns its scored column.
 *
 * @param adapter - Planning adapter to evaluate.
 * @param evalCase - The case providing input and expectations.
 * @returns A scored column result, or a failure marker when generation fails.
 */
async function runColumn(
  adapter: PlanningAdapter,
  evalCase: PlanEvalCase
): Promise<CaseColumnResult> {
  const result = await adapter.generate(evalCase.input);
  if (result.status !== "success") {
    return {
      provider: adapter.provider,
      score: 0,
      max: 0,
      failed: true,
      failureReason: result.reason,
    };
  }

  const scored = scorePlanningDraft(result.draft, evalCase.input, evalCase.expect);
  return {
    provider: adapter.provider,
    score: scored.score,
    max: scored.max,
    failed: false,
  };
}

/**
 * Formats a scored column as a fixed-width cell for the console table.
 *
 * @param column - Scored column result.
 * @returns A printable cell string.
 */
function formatCell(column: CaseColumnResult): string {
  if (column.failed) {
    return "FAILED".padEnd(12);
  }
  const pct = column.max === 0 ? 0 : Math.round((column.score / column.max) * 100);
  return `${column.score}/${column.max} (${pct}%)`.padEnd(12);
}

async function main(): Promise<void> {
  const includeAi = resolvePlanningProviderId() === "ai";
  const deterministic = new DeterministicPlanningAdapter();
  const aiAdapter = includeAi ? resolvePlanningAdapter() : null;

  console.log("Planning Eval Harness");
  console.log(
    includeAi
      ? `Providers: deterministic + configured ("${aiAdapter?.provider}")`
      : "Providers: deterministic only (set EOS_PLANNING_PROVIDER=ai to also score the AI adapter)"
  );
  console.log("");

  const header = `${"Case".padEnd(28)}${"deterministic".padEnd(14)}${
    includeAi ? "ai".padEnd(14) : ""
  }`;
  console.log(header);
  console.log("-".repeat(header.length));

  let deterministicScore = 0;
  let deterministicMax = 0;
  let aiScore = 0;
  let aiMax = 0;

  for (const evalCase of PLANNING_EVAL_CASES) {
    const deterministicColumn = await runColumn(deterministic, evalCase);
    deterministicScore += deterministicColumn.score;
    deterministicMax += deterministicColumn.max;

    let aiCell = "";
    if (aiAdapter !== null) {
      const aiColumn = await runColumn(aiAdapter, evalCase);
      aiScore += aiColumn.score;
      aiMax += aiColumn.max;
      aiCell = formatCell(aiColumn);
    }

    console.log(
      `${evalCase.name.padEnd(28)}${formatCell(deterministicColumn).padEnd(14)}${aiCell}`
    );
  }

  console.log("-".repeat(header.length));
  const deterministicAggregate = `${deterministicScore}/${deterministicMax}`;
  const aiAggregate = includeAi ? `${aiScore}/${aiMax}` : "";
  console.log(
    `${"AGGREGATE".padEnd(28)}${deterministicAggregate.padEnd(14)}${aiAggregate.padEnd(14)}`
  );
  console.log("");
  console.log(
    `Deterministic passed ${deterministicScore} of ${deterministicMax} grounding checks across ${PLANNING_EVAL_CASES.length} case(s).`
  );
}

main().catch((error: unknown) => {
  console.error("planning-eval failed:", error);
  process.exitCode = 1;
});
