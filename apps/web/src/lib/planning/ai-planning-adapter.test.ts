import { describe, expect, it, vi } from "vitest";

import type {
  DeterministicPlanningDraft,
  OutcomePlanningInput,
  PlanningGenerationResult,
} from "@/lib/planning-generator";
import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from "@/lib/llm/llm-client";

import type { PlanningAdapter } from "./planning-adapter";
import { AiPlanningAdapter } from "./ai-planning-adapter";

const INPUT: OutcomePlanningInput = {
  companyId: "company_1",
  outcomeId: "outcome_1",
  title: "Build subscription billing",
  rawRequest: "Build subscription billing with Stripe",
  brief: null,
  businessValue: null,
  successCriteria: [],
  constraints: [],
  employees: [
    {
      id: "emp_1",
      name: "Ada",
      title: null,
      roleName: "Backend Engineer",
      responsibilities: null,
    },
  ],
  repositories: [],
};

function validDraft(): DeterministicPlanningDraft {
  return {
    generatorVersion: "model-value",
    title: "Billing Planning Draft",
    summary: "Plan to deliver billing.",
    status: "draft",
    scope: ["Deliver billing."],
    nonScope: ["No dashboards."],
    assumptions: ["Stripe is the provider."],
    risks: [
      {
        id: "risk:1",
        severity: "high",
        description: "Revenue leak risk.",
        mitigation: "Add tests.",
        ownerRole: "Backend Engineer",
      },
    ],
    dependencies: [
      {
        id: "dependency:1",
        type: "approval",
        description: "CEO approval.",
        blocks: ["feature:1"],
        requiredBeforeOrder: 99,
      },
    ],
    recommendedAssignments: [],
    generatedProjects: [
      {
        planItemId: "project:1",
        name: "Billing",
        description: "Recurring billing.",
        ownerRole: "Product Manager",
        ownerEmployeeId: null,
        ownerEmployeeName: null,
        milestones: [
          {
            id: "milestone:1",
            title: "Foundation",
            description: "Webhook model.",
            deliverables: ["Webhook"],
            acceptanceCriteria: ["Webhooks verified."],
            estimatedOrder: 1,
          },
        ],
        acceptanceCriteria: ["Users can subscribe."],
        estimatedExecutionOrder: 1,
      },
    ],
    generatedFeatures: [
      {
        planItemId: "feature:1",
        projectPlanItemId: "project:1",
        milestoneId: "milestone:1",
        title: "Lifecycle",
        description: "Subscription lifecycle.",
        ownerRole: "Backend Engineer",
        ownerEmployeeId: null,
        ownerEmployeeName: null,
        dependencies: [],
        risks: ["Stripe changes."],
        acceptanceCriteria: ["Subscriptions persist."],
        qaExpectations: ["Idempotency."],
        releaseRelevance: "Required.",
        estimatedExecutionOrder: 1,
      },
    ],
    generatedTasks: [
      {
        planItemId: "task:1",
        featurePlanItemId: "feature:1",
        title: "Implement webhook handler",
        description:
          "Implement a verified, idempotent Stripe webhook handler updating subscription state.",
        recommendedRole: "Backend Engineer",
        recommendedEmployeeId: null,
        recommendedEmployeeName: null,
        dependencies: [],
        acceptanceCriteria: ["Signatures verified.", "Duplicates ignored."],
        definitionOfDone: ["Tests pass."],
        requiredContext: ["Source Outcome identifiers."],
        reviewRequirements: ["Reviewer checks correctness."],
        qaImpact: "Adds coverage.",
        estimatedExecutionOrder: 1,
        estimatePoints: 3,
      },
    ],
    reviewPlan: {
      ownerRole: "Reviewer",
      requiredReviewers: ["Reviewer"],
      checkpoints: ["Correctness review."],
      approvalGate: "Reviewer approval.",
    },
    qaPlan: {
      ownerRole: "QA Engineer",
      strategy: "Automated checks.",
      requiredChecks: ["Integration tests."],
      evidenceRequired: ["Test output."],
    },
    releasePlan: {
      ownerRole: "Release Manager",
      strategy: "Staged rollout.",
      readinessCriteria: ["QA passes."],
      rolloutSteps: ["Deploy staging."],
      rollbackPlan: "Revert.",
    },
    openCeoQuestions: ["Which plans launch first?"],
    acceptanceCriteria: ["Billing works."],
    estimatedExecutionOrder: ["task:1"],
  };
}

/** Sentinel result returned by the stub fallback so callers can detect fallback use. */
const FALLBACK_RESULT: PlanningGenerationResult = {
  status: "failed",
  reason: "fallback-was-called",
  openCeoQuestions: [],
};

function stubFallback() {
  const generate = vi.fn(
    async (): Promise<PlanningGenerationResult> => FALLBACK_RESULT
  );
  const adapter: PlanningAdapter = { provider: "deterministic", generate };
  return { adapter, generate };
}

function stubLlm(completion: LlmCompletion): LlmClient {
  return {
    provider: "stub",
    complete: async (_request: LlmCompletionRequest): Promise<LlmCompletion> =>
      completion,
  };
}

describe("AiPlanningAdapter", () => {
  it("exposes the ai-claude provider", () => {
    const adapter = new AiPlanningAdapter({
      llm: stubLlm({ ok: true, text: "{}", durationMs: 1 }),
      fallback: stubFallback().adapter,
    });
    expect(adapter.provider).toBe("ai-claude");
  });

  it("returns the AI draft when the LLM yields a valid, grounded plan", async () => {
    const fallback = stubFallback();
    const adapter = new AiPlanningAdapter({
      llm: stubLlm({
        ok: true,
        text: JSON.stringify(validDraft()),
        durationMs: 5,
      }),
      fallback: fallback.adapter,
    });

    const result = await adapter.generate(INPUT);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.draft.generatorVersion).toBe("ai-claude-v1");
      expect(result.draft.title).toBe("Billing Planning Draft");
    }
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it("falls back when the LLM completion fails", async () => {
    const fallback = stubFallback();
    const adapter = new AiPlanningAdapter({
      llm: stubLlm({ ok: false, error: "timeout", durationMs: 5 }),
      fallback: fallback.adapter,
    });

    const result = await adapter.generate(INPUT);

    expect(result).toBe(FALLBACK_RESULT);
    expect(fallback.generate).toHaveBeenCalledWith(INPUT);
  });

  it("falls back when the LLM text is unparseable", async () => {
    const fallback = stubFallback();
    const adapter = new AiPlanningAdapter({
      llm: stubLlm({ ok: true, text: "sorry, no plan", durationMs: 5 }),
      fallback: fallback.adapter,
    });

    const result = await adapter.generate(INPUT);

    expect(result).toBe(FALLBACK_RESULT);
    expect(fallback.generate).toHaveBeenCalledTimes(1);
  });

  it("falls back when the parsed draft fails quality validation", async () => {
    const draft = validDraft();
    const lowQuality: DeterministicPlanningDraft = {
      ...draft,
      generatedTasks: [
        { ...draft.generatedTasks[0], description: "too short" },
      ],
    };
    const fallback = stubFallback();
    const adapter = new AiPlanningAdapter({
      llm: stubLlm({
        ok: true,
        text: JSON.stringify(lowQuality),
        durationMs: 5,
      }),
      fallback: fallback.adapter,
    });

    const result = await adapter.generate(INPUT);

    expect(result).toBe(FALLBACK_RESULT);
    expect(fallback.generate).toHaveBeenCalledTimes(1);
  });

  it("falls back when the draft assigns a non-roster employee", async () => {
    const draft = validDraft();
    const fabricated: DeterministicPlanningDraft = {
      ...draft,
      generatedTasks: [
        { ...draft.generatedTasks[0], recommendedEmployeeId: "ghost_99" },
      ],
    };
    const fallback = stubFallback();
    const adapter = new AiPlanningAdapter({
      llm: stubLlm({
        ok: true,
        text: JSON.stringify(fabricated),
        durationMs: 5,
      }),
      fallback: fallback.adapter,
    });

    const result = await adapter.generate(INPUT);

    expect(result).toBe(FALLBACK_RESULT);
    expect(fallback.generate).toHaveBeenCalledTimes(1);
  });
});
