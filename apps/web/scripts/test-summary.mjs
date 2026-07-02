#!/usr/bin/env node
/**
 * Test summary — runs the full vitest suite and prints the sum of test cases.
 *
 * Usage: `npm run test:count`
 *
 * Emits the total number of test files and test cases (plus pass/fail/skip
 * counts) by reading vitest's JSON reporter output, so there is a single
 * authoritative "sum of test cases" for the repository.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const OUTPUT_FILE = ".vitest-summary.json";

function run() {
  try {
    execFileSync(
      "npx",
      ["vitest", "run", "--reporter=json", `--outputFile=${OUTPUT_FILE}`],
      { stdio: ["ignore", "ignore", "inherit"] }
    );
  } catch {
    // vitest exits non-zero when tests fail; the report is still written.
  }

  let report;
  try {
    report = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
  } catch (err) {
    console.error("Could not read vitest report:", err.message);
    process.exit(1);
  } finally {
    rmSync(OUTPUT_FILE, { force: true });
  }

  const files = Array.isArray(report.testResults) ? report.testResults.length : 0;
  const suites = report.numTotalTestSuites ?? 0;
  const total = report.numTotalTests ?? 0;
  const passed = report.numPassedTests ?? 0;
  const failed = report.numFailedTests ?? 0;
  const pending = report.numPendingTests ?? 0;

  const line = "─".repeat(40);
  console.log(line);
  console.log("  TEST SUMMARY");
  console.log(line);
  console.log(`  Test files:   ${files}`);
  console.log(`  Test suites:  ${suites}`);
  console.log(`  Test cases:   ${total}`);
  console.log(`  Passed:       ${passed}`);
  console.log(`  Failed:       ${failed}`);
  console.log(`  Pending:      ${pending}`);
  console.log(line);

  process.exit(failed > 0 ? 1 : 0);
}

run();
