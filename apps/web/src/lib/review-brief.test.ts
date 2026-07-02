import { describe, expect, it } from "vitest";
import {
  generateReviewBrief,
  type ReviewBriefInput,
  type ReviewBriefTask,
  type ReviewBriefSession,
} from "./review-brief";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_TASK: ReviewBriefTask = {
  id: "MUS-150",
  title: "Ingest agent execution result",
  description: "Record the result of an external agent execution attempt.",
  acceptanceCriteria: [
    "Session status transitions to completed, failed, or needs_clarification.",
    "Task status is updated when a session completes.",
    "Timeline events are created.",
  ],
};

const FULL_SESSION: ReviewBriefSession = {
  resultSummary: "Implemented ingestAgentExecutionResult with full status transitions.",
  filesChanged: [
    "src/lib/execution-session-service.ts",
    "src/lib/execution-session-service.test.ts",
  ],
  validationOutput: "✅ tsc --noEmit: OK\n✅ lint: OK\n✅ test: 42/42 passed",
  branchName: "feature/MUS-150-ingest-agent-execution-result",
  baseBranch: "master",
  commitSha: "abc1234def5678",
  prUrl: "https://github.com/org/repo/pull/5",
  prNumber: 5,
  prStatus: "open",
};

const FULL_INPUT: ReviewBriefInput = { task: FULL_TASK, session: FULL_SESSION };

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("generateReviewBrief", () => {
  // ── Header ──────────────────────────────────────────────────────────────────

  it("includes the task title in the header", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("Ingest agent execution result");
  });

  it("includes the task ID in the header", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("MUS-150");
  });

  // ── Task scope ──────────────────────────────────────────────────────────────

  it("includes the task scope section", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("## Task Scope");
  });

  it("includes the task description when present", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("Record the result of an external agent execution attempt.");
  });

  it("omits the description block when description is null", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      task: { ...FULL_TASK, description: null },
    });
    expect(brief).not.toContain("**Description:**");
  });

  // ── Acceptance criteria ─────────────────────────────────────────────────────

  it("includes all acceptance criteria", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("Session status transitions to completed");
    expect(brief).toContain("Task status is updated");
    expect(brief).toContain("Timeline events are created.");
  });

  it("warns when acceptance criteria are empty", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      task: { ...FULL_TASK, acceptanceCriteria: [] },
    });
    expect(brief).toContain("⚠️");
    expect(brief).toContain("No acceptance criteria recorded");
  });

  // ── Implementation summary ──────────────────────────────────────────────────

  it("includes the implementation summary section", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("## Implementation Summary");
    expect(brief).toContain("Implemented ingestAgentExecutionResult");
  });

  it("warns when result summary is null", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      session: { ...FULL_SESSION, resultSummary: null },
    });
    expect(brief).toContain("No implementation summary was recorded");
  });

  // ── Branch & PR ─────────────────────────────────────────────────────────────

  it("includes the branch name in the brief", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("feature/MUS-150-ingest-agent-execution-result");
  });

  it("includes the base branch", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("master");
  });

  it("includes the commit SHA", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("abc1234def5678");
  });

  it("includes the PR URL", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("https://github.com/org/repo/pull/5");
  });

  it("shows not-recorded placeholder when branchName is null", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      session: { ...FULL_SESSION, branchName: null },
    });
    expect(brief).toContain("_(not recorded)_");
  });

  it("shows not-opened placeholder when prUrl is null", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      session: { ...FULL_SESSION, prUrl: null },
    });
    expect(brief).toContain("_(not opened yet)_");
  });

  // ── Files changed ───────────────────────────────────────────────────────────

  it("lists all changed files", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("src/lib/execution-session-service.ts");
    expect(brief).toContain("src/lib/execution-session-service.test.ts");
  });

  it("warns when no files are recorded", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      session: { ...FULL_SESSION, filesChanged: [] },
    });
    expect(brief).toContain("No files were recorded as changed");
  });

  // ── Validation results ──────────────────────────────────────────────────────

  it("includes validation output in a code block", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("✅ tsc --noEmit: OK");
    expect(brief).toContain("```");
  });

  it("warns when validation output is null", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      session: { ...FULL_SESSION, validationOutput: null },
    });
    expect(brief).toContain("No validation output was recorded");
  });

  // ── Review checklist ────────────────────────────────────────────────────────

  it("includes the review checklist section", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("## Review Checklist");
  });

  it("generates a checkbox for each acceptance criterion", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("- [ ] Session status transitions to completed");
    expect(brief).toContain("- [ ] Task status is updated");
    expect(brief).toContain("- [ ] Timeline events are created.");
  });

  it("includes quality gate checkboxes", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("- [ ] No unrelated refactors");
    expect(brief).toContain("- [ ] No placeholder, stub, or fake behavior");
    expect(brief).toContain("- [ ] No failing validation commands");
    expect(brief).toContain("- [ ] Code follows existing architecture");
    expect(brief).toContain("- [ ] Security invariants");
  });

  // ── Review decision ─────────────────────────────────────────────────────────

  it("includes a required review decision section", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("## Review Decision Required");
  });

  it("requires a decision of APPROVED or CHANGES_REQUESTED", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("APPROVED");
    expect(brief).toContain("CHANGES_REQUESTED");
  });

  it("asks for BLOCKER and NON-BLOCKER classifications in findings", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("BLOCKER");
    expect(brief).toContain("NON-BLOCKER");
  });

  // ── Reviewer instructions ───────────────────────────────────────────────────

  it("forbids approving unrelated refactors", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("**Do NOT** approve changes that modify files outside this ticket");
  });

  it("forbids approving fake behavior", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("placeholder or fake behavior");
  });

  it("forbids approving failing validation", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("**Do NOT** approve changes with failing validation");
  });

  it("instructs the reviewer to record a decision in Avion", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief).toContain("Record Review Result");
  });

  // ── Structure ────────────────────────────────────────────────────────────────

  it("all required sections are present", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    const requiredSections = [
      "## Task Scope",
      "## Acceptance Criteria",
      "## Implementation Summary",
      "## Branch & Pull Request",
      "## Files Changed",
      "## Validation Results",
      "## Review Checklist",
      "## Review Decision Required",
      "## Reviewer Instructions",
    ];
    requiredSections.forEach((section) => {
      expect(brief).toContain(section);
    });
  });

  it("returns a non-empty string", () => {
    const brief = generateReviewBrief(FULL_INPUT);
    expect(brief.length).toBeGreaterThan(100);
  });

  // ── Company memory (MUS-258) ────────────────────────────────────────────────

  it("renders company standards & lessons for the reviewer when memory is provided", () => {
    const brief = generateReviewBrief({
      ...FULL_INPUT,
      memory: [
        { category: "standards", content: "Never expose decrypted tokens to the client." },
      ],
    });

    expect(brief).toContain("## Company Standards & Lessons");
    expect(brief).toContain("**[standards]** Never expose decrypted tokens to the client.");
    expect(brief).toContain("blocker");
  });

  it("omits the memory section when no memory is provided", () => {
    expect(generateReviewBrief(FULL_INPUT)).not.toContain("Company Standards & Lessons");
    expect(generateReviewBrief({ ...FULL_INPUT, memory: [] })).not.toContain(
      "Company Standards & Lessons"
    );
  });
});
