import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RepositoryValidationAssessment,
} from "@/lib/repository-validation-profile";
import type { RepositoryValidationView } from "@/lib/repository-validation-service";

// ─── Mock the DB-backed validation view. The gate's mapping logic is pure and
//     driven entirely by the shape returned here. ──────────────────────────────

const mockGetRepositoryValidationView = vi.fn();
vi.mock("@/lib/repository-validation-service", () => ({
  getRepositoryValidationView: (...args: unknown[]) =>
    mockGetRepositoryValidationView(...args),
}));

import { assessExecutionReadiness } from "./repository-readiness-gate";

/** Builds a minimal but type-correct assessment for the given readiness. */
function makeAssessment(
  readiness: RepositoryValidationAssessment["readiness"],
  overrides: Partial<RepositoryValidationAssessment> = {}
): RepositoryValidationAssessment {
  return {
    readiness,
    environment: {
      referencedEnvVars: [],
      documentedKeys: [],
      secretReferences: [],
      hasEnvExample: false,
      documented: false,
      evidenceAvailable: false,
    },
    validation: {
      profileId: "generic",
      profileName: "Generic",
      commands: [],
      profileCommands: [],
      hasLint: false,
      hasTypecheck: false,
      hasTest: false,
      hasBuild: false,
    },
    missing: [],
    unknowns: [],
    ...overrides,
  };
}

/** Builds a RepositoryValidationView wrapping the given assessment. */
function makeView(
  assessment: RepositoryValidationAssessment,
  overrides: Partial<RepositoryValidationView> = {}
): RepositoryValidationView {
  return {
    assessment,
    snapshotId: "snap-1",
    snapshotStatus: "completed",
    analyzedAt: new Date("2026-01-01T00:00:00Z"),
    hasAnalysis: true,
    missingData: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assessExecutionReadiness", () => {
  it("skips the gate when no repository is attached (null repositoryId)", async () => {
    const result = await assessExecutionReadiness({
      companyId: "company-1",
      repositoryId: null,
    });

    expect(result.ready).toBe(true);
    expect(result.readiness).toBe("unknown");
    expect(result.reasons).toEqual([
      "No repository attached to this task; skipping readiness gate.",
    ]);
    expect(mockGetRepositoryValidationView).not.toHaveBeenCalled();
  });

  it("does not block when the repository is not found for the company", async () => {
    mockGetRepositoryValidationView.mockResolvedValue(null);

    const result = await assessExecutionReadiness({
      companyId: "company-1",
      repositoryId: "repo-missing",
    });

    expect(result.ready).toBe(true);
    expect(result.readiness).toBe("unknown");
    expect(result.reasons[0]).toContain("repo-missing");
    expect(mockGetRepositoryValidationView).toHaveBeenCalledWith({
      repositoryId: "repo-missing",
      companyId: "company-1",
    });
  });

  it("treats a repository without analysis as unknown and does not block", async () => {
    // The underlying assessment reports `blocked` when no analysis has run,
    // but the gate must surface this as a soft `unknown`, not a hard block.
    mockGetRepositoryValidationView.mockResolvedValue(
      makeView(
        makeAssessment("blocked", {
          missing: ["Repository analysis has not been run."],
          unknowns: ["No repository analysis snapshot exists yet — run analysis."],
        }),
        {
          hasAnalysis: false,
          missingData: ["No repository analysis snapshot exists yet."],
        }
      )
    );

    const result = await assessExecutionReadiness({
      companyId: "company-1",
      repositoryId: "repo-1",
    });

    expect(result.ready).toBe(true);
    expect(result.readiness).toBe("unknown");
    expect(result.reasons).toContain("No repository analysis snapshot exists yet.");
  });

  it("blocks execution on a blocked assessment and surfaces its reasons", async () => {
    mockGetRepositoryValidationView.mockResolvedValue(
      makeView(
        makeAssessment("blocked", {
          missing: [
            "No package.json manifest detected — validation commands cannot be determined.",
          ],
          unknowns: ["Environment requirements are unknown."],
        })
      )
    );

    const result = await assessExecutionReadiness({
      companyId: "company-1",
      repositoryId: "repo-1",
    });

    expect(result.ready).toBe(false);
    expect(result.readiness).toBe("blocked");
    expect(result.reasons).toEqual([
      "No package.json manifest detected — validation commands cannot be determined.",
      "Environment requirements are unknown.",
    ]);
  });

  it("allows execution on a ready assessment", async () => {
    mockGetRepositoryValidationView.mockResolvedValue(
      makeView(makeAssessment("ready"))
    );

    const result = await assessExecutionReadiness({
      companyId: "company-1",
      repositoryId: "repo-1",
    });

    expect(result.ready).toBe(true);
    expect(result.readiness).toBe("ready");
    expect(result.reasons).toEqual([]);
  });

  it("allows execution on a partial assessment while surfacing gaps", async () => {
    mockGetRepositoryValidationView.mockResolvedValue(
      makeView(
        makeAssessment("partial", {
          missing: ["No test script detected."],
        })
      )
    );

    const result = await assessExecutionReadiness({
      companyId: "company-1",
      repositoryId: "repo-1",
    });

    expect(result.ready).toBe(true);
    expect(result.readiness).toBe("partial");
    expect(result.reasons).toEqual(["No test script detected."]);
  });
});
