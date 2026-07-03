import { describe, expect, it } from "vitest";

import type { OutcomePlanningInput } from "@/lib/planning-generator";

import { buildPlanningPrompt } from "./planning-prompt";

const INPUT: OutcomePlanningInput = {
  companyId: "company_1",
  outcomeId: "outcome_1",
  title: "Build subscription billing",
  rawRequest: "Build subscription billing with Stripe",
  brief: "Recurring revenue for the product.",
  businessValue: "Unlocks recurring revenue.",
  successCriteria: ["Users can subscribe", "Invoices are generated"],
  constraints: ["PCI compliance required"],
  employees: [
    {
      id: "emp_1",
      name: "Ada Lovelace",
      title: "Staff Engineer",
      roleName: "Backend Engineer",
      responsibilities: "APIs, persistence, billing integrations.",
    },
  ],
  repositories: [
    {
      id: "repo_1",
      name: "billing-app",
      description: null,
      primaryLanguage: "TypeScript",
      techStack: ["Node.js"],
      frameworks: ["Next.js"],
      dependencies: ["stripe"],
      importantFiles: ["src/app/api/webhooks/route.ts"],
      analysisStatus: "analyzed",
      analysisNotes: "App Router with API routes.",
      latestChangeSummary: "Added webhook handler.",
      latestChangeImpactLevel: "medium",
      latestChangeAffectedAreas: ["api"],
      latestChangeRecommendedActions: ["Add tests"],
    },
  ],
};

describe("buildPlanningPrompt", () => {
  it("includes the outcome title in the user prompt", () => {
    const { prompt } = buildPlanningPrompt(INPUT);
    expect(prompt).toContain("Build subscription billing");
  });

  it("grounds the prompt in an employee name from the roster", () => {
    const { prompt } = buildPlanningPrompt(INPUT);
    expect(prompt).toContain("Ada Lovelace");
    expect(prompt).toContain("emp_1");
  });

  it("grounds the prompt in a detected repository framework", () => {
    const { prompt } = buildPlanningPrompt(INPUT);
    expect(prompt).toContain("Next.js");
  });

  it("references an importantFile from the repository intelligence", () => {
    const { prompt } = buildPlanningPrompt(INPUT);
    expect(prompt).toContain("src/app/api/webhooks/route.ts");
  });

  it("instructs the model to return a single JSON object matching the schema", () => {
    const { system } = buildPlanningPrompt(INPUT);
    expect(system).toContain("SINGLE JSON object");
    expect(system).toContain("DeterministicPlanningDraft");
  });

  it("requires an explicit task kind and discourages documentation-only tasks", () => {
    const { system, prompt } = buildPlanningPrompt(INPUT);
    expect(system).toContain("TASK DISCIPLINE");
    expect(system).toContain('"kind": "implementation"');
    expect(system).toContain('or "analysis"');
    // Must steer planning content into plan fields rather than standalone doc tasks.
    expect(system).toContain("belongs in scope, assumptions");
    expect(prompt).toContain("real implementation tasks");
  });

  it("notes the missing roster when no employees are provided", () => {
    const { prompt } = buildPlanningPrompt({ ...INPUT, employees: [] });
    expect(prompt).toContain("No employees are available");
  });

  it("includes company memory (lessons learned) when provided", () => {
    const { prompt } = buildPlanningPrompt({
      ...INPUT,
      companyMemory: [
        {
          id: "mem_1",
          category: "standards",
          bankTitle: "Engineering standards (learned)",
          content: "Always add idempotency keys to Stripe webhook handlers.",
          source: "learning:stripe-idempotency",
          confidence: 0.9,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
    });
    expect(prompt).toContain("Company memory");
    expect(prompt).toContain(
      "Always add idempotency keys to Stripe webhook handlers."
    );
  });

  it("notes the absence of company memory when none is provided", () => {
    const { prompt } = buildPlanningPrompt(INPUT);
    expect(prompt).toContain("no prior company memory yet");
  });

  it("injects company culture guidance when a culture is configured (MUS-288)", () => {
    const { prompt } = buildPlanningPrompt({
      ...INPUT,
      cultureProfile: "enterprise",
    });
    expect(prompt).toContain("## Company culture");
    expect(prompt).toContain("Enterprise");
    expect(prompt).toContain("Reflect the company culture");
  });

  it("notes a neutral culture when none is configured", () => {
    const { prompt } = buildPlanningPrompt(INPUT);
    expect(prompt).toContain("no specific culture configured");
  });
});
