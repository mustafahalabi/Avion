import { describe, expect, it } from "vitest";

import type { DeterministicPlanningDraft } from "@/lib/planning-generator";

import {
  AI_PLANNING_GENERATOR_VERSION,
  parseAiPlanningDraft,
} from "./plan-parser";

/**
 * A draft that satisfies the zod schema. Employee ids are null so it is also
 * grounding-clean and quality-valid for reuse across tests.
 */
function validDraftObject(): DeterministicPlanningDraft {
  return {
    generatorVersion: "model-supplied-value",
    title: "Subscription Billing Planning Draft",
    summary: "Plan to deliver subscription billing end to end.",
    status: "draft",
    scope: ["Deliver subscription billing."],
    nonScope: ["Do not build invoicing dashboards."],
    assumptions: ["Stripe is the billing provider."],
    risks: [
      {
        id: "risk:1",
        severity: "high",
        description: "Billing edge cases could leak revenue.",
        mitigation: "Add contract tests around webhooks.",
        ownerRole: "Backend Engineer",
      },
    ],
    dependencies: [
      {
        id: "dependency:1",
        type: "approval",
        description: "CEO approval before execution.",
        blocks: ["feature:billing"],
        requiredBeforeOrder: 99,
      },
    ],
    recommendedAssignments: [
      {
        role: "Backend Engineer",
        employeeId: null,
        employeeName: null,
        reason: "Owns billing integrations.",
        taskPlanItemIds: ["task:webhook"],
      },
    ],
    generatedProjects: [
      {
        planItemId: "project:billing",
        name: "Subscription Billing",
        description: "Recurring billing with Stripe.",
        ownerRole: "Product Manager",
        ownerEmployeeId: null,
        ownerEmployeeName: null,
        milestones: [
          {
            id: "milestone:1",
            title: "Billing foundation",
            description: "Webhook and subscription model.",
            deliverables: ["Webhook handler"],
            acceptanceCriteria: ["Webhooks are verified and idempotent."],
            estimatedOrder: 1,
          },
        ],
        acceptanceCriteria: ["Users can subscribe successfully."],
        estimatedExecutionOrder: 1,
      },
    ],
    generatedFeatures: [
      {
        planItemId: "feature:billing",
        projectPlanItemId: "project:billing",
        milestoneId: "milestone:1",
        title: "Subscription lifecycle",
        description: "Create, update, and cancel subscriptions.",
        ownerRole: "Backend Engineer",
        ownerEmployeeId: null,
        ownerEmployeeName: null,
        dependencies: [],
        risks: ["Stripe API changes."],
        acceptanceCriteria: ["Subscriptions persist with company ownership."],
        qaExpectations: ["Verify webhook idempotency."],
        releaseRelevance: "Required for launch.",
        estimatedExecutionOrder: 1,
      },
    ],
    generatedTasks: [
      {
        planItemId: "task:webhook",
        featurePlanItemId: "feature:billing",
        title: "Implement Stripe webhook handler",
        description:
          "Implement a verified, idempotent Stripe webhook handler that updates subscription state.",
        recommendedRole: "Backend Engineer",
        recommendedEmployeeId: null,
        recommendedEmployeeName: null,
        dependencies: [],
        acceptanceCriteria: [
          "Webhook signatures are verified.",
          "Duplicate events are ignored idempotently.",
        ],
        definitionOfDone: ["Tests pass and review is approved."],
        requiredContext: ["Source Outcome and PlanningDraft identifiers."],
        reviewRequirements: ["Independent reviewer checks correctness."],
        qaImpact: "Adds webhook integration coverage.",
        estimatedExecutionOrder: 1,
        estimatePoints: 3,
      },
    ],
    reviewPlan: {
      ownerRole: "Reviewer",
      requiredReviewers: ["Reviewer"],
      checkpoints: ["Correctness and ownership review."],
      approvalGate: "Reviewer approval required.",
    },
    qaPlan: {
      ownerRole: "QA Engineer",
      strategy: "Automated and manual checks.",
      requiredChecks: ["Webhook integration tests."],
      evidenceRequired: ["Passing test output."],
    },
    releasePlan: {
      ownerRole: "Release Manager",
      strategy: "Staged rollout.",
      readinessCriteria: ["All QA checks pass."],
      rolloutSteps: ["Deploy to staging."],
      rollbackPlan: "Revert the release branch.",
    },
    openCeoQuestions: ["Which plans and prices should launch first?"],
    acceptanceCriteria: ["Billing works end to end."],
    estimatedExecutionOrder: ["task:webhook"],
  };
}

describe("parseAiPlanningDraft", () => {
  it("parses a bare JSON object and stamps the AI generator version", () => {
    const text = JSON.stringify(validDraftObject());
    const result = parseAiPlanningDraft(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.generatorVersion).toBe(AI_PLANNING_GENERATOR_VERSION);
      expect(result.draft.title).toBe("Subscription Billing Planning Draft");
      expect(result.draft.generatedTasks).toHaveLength(1);
    }
  });

  it("parses JSON wrapped in ```json code fences and surrounding prose", () => {
    const text = `Here is the plan you requested:\n\n\`\`\`json\n${JSON.stringify(
      validDraftObject()
    )}\n\`\`\`\n\nLet me know if you want changes.`;
    const result = parseAiPlanningDraft(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.generatorVersion).toBe(AI_PLANNING_GENERATOR_VERSION);
    }
  });

  it("fails when there is no JSON object in the text", () => {
    const result = parseAiPlanningDraft("I could not produce a plan.");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("No JSON object");
    }
  });

  it("fails on malformed JSON", () => {
    const result = parseAiPlanningDraft("{ not: valid json, }");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Failed to parse JSON");
    }
  });

  it("fails on schema-violating JSON (missing generatedTasks)", () => {
    const { generatedTasks: _omitted, ...rest } = validDraftObject();
    const result = parseAiPlanningDraft(JSON.stringify(rest));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("schema validation");
      expect(result.error).toContain("generatedTasks");
    }
  });

  it("preserves an explicit task kind emitted by the model", () => {
    const draft = validDraftObject();
    const payload = {
      ...draft,
      generatedTasks: [{ ...draft.generatedTasks[0], kind: "implementation" }],
    };

    const result = parseAiPlanningDraft(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.generatedTasks[0].kind).toBe("implementation");
    }
  });

  it("tolerates a task with no kind (backfilled downstream)", () => {
    // The fixture task omits kind; it must still parse so older AI outputs are valid.
    const result = parseAiPlanningDraft(JSON.stringify(validDraftObject()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.generatedTasks[0].kind).toBeUndefined();
    }
  });

  it("rejects an invalid task kind value", () => {
    const draft = validDraftObject();
    const payload = {
      ...draft,
      generatedTasks: [{ ...draft.generatedTasks[0], kind: "documentation" }],
    };

    const result = parseAiPlanningDraft(JSON.stringify(payload));
    expect(result.ok).toBe(false);
  });

  it("defaults omitted nullable employee fields to null", () => {
    const draft = validDraftObject();
    const taskWithoutEmployee = { ...draft.generatedTasks[0] } as Record<
      string,
      unknown
    >;
    delete taskWithoutEmployee.recommendedEmployeeId;
    delete taskWithoutEmployee.recommendedEmployeeName;

    const payload = {
      ...draft,
      generatedTasks: [taskWithoutEmployee],
    };

    const result = parseAiPlanningDraft(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.generatedTasks[0].recommendedEmployeeId).toBeNull();
    }
  });
});
