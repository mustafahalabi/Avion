import { z } from "zod";

import type { DeterministicPlanningDraft } from "@/lib/planning-generator";
import { PLANNING_DRAFT_STATUSES } from "@/lib/outcome-planning";

/**
 * Version stamp applied to every draft produced from the AI planning path.
 *
 * Declared here (never in `planning-generator.ts`, which must stay AI-free) so the
 * provenance of an AI-backed draft is distinguishable from the deterministic baseline.
 */
export const AI_PLANNING_GENERATOR_VERSION = "ai-claude-v1" as const;

const nullableString = z.string().nullable().default(null);

const milestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  deliverables: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  estimatedOrder: z.number(),
});

const projectSchema = z.object({
  planItemId: z.string(),
  name: z.string(),
  description: z.string(),
  ownerRole: z.string(),
  ownerEmployeeId: nullableString,
  ownerEmployeeName: nullableString,
  milestones: z.array(milestoneSchema),
  acceptanceCriteria: z.array(z.string()),
  estimatedExecutionOrder: z.number(),
});

const featureSchema = z.object({
  planItemId: z.string(),
  projectPlanItemId: z.string(),
  milestoneId: z.string(),
  title: z.string(),
  description: z.string(),
  ownerRole: z.string(),
  ownerEmployeeId: nullableString,
  ownerEmployeeName: nullableString,
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  qaExpectations: z.array(z.string()),
  releaseRelevance: z.string(),
  estimatedExecutionOrder: z.number(),
});

const taskSchema = z.object({
  planItemId: z.string(),
  featurePlanItemId: z.string(),
  title: z.string(),
  description: z.string(),
  recommendedRole: z.string(),
  recommendedEmployeeId: nullableString,
  recommendedEmployeeName: nullableString,
  dependencies: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  definitionOfDone: z.array(z.string()),
  requiredContext: z.array(z.string()),
  reviewRequirements: z.array(z.string()),
  qaImpact: z.string(),
  estimatedExecutionOrder: z.number(),
  estimatePoints: z.number(),
});

const assignmentSchema = z.object({
  role: z.string(),
  employeeId: nullableString,
  employeeName: nullableString,
  reason: z.string(),
  taskPlanItemIds: z.array(z.string()),
});

const dependencySchema = z.object({
  id: z.string(),
  type: z.enum([
    "product",
    "technical",
    "repository",
    "data",
    "security",
    "release",
    "approval",
  ]),
  description: z.string(),
  blocks: z.array(z.string()),
  requiredBeforeOrder: z.number(),
});

const riskSchema = z.object({
  id: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
  mitigation: z.string(),
  ownerRole: z.string(),
});

const reviewPlanSchema = z.object({
  ownerRole: z.string(),
  requiredReviewers: z.array(z.string()),
  checkpoints: z.array(z.string()),
  approvalGate: z.string(),
});

const qaPlanSchema = z.object({
  ownerRole: z.string(),
  strategy: z.string(),
  requiredChecks: z.array(z.string()),
  evidenceRequired: z.array(z.string()),
});

const releasePlanSchema = z.object({
  ownerRole: z.string(),
  strategy: z.string(),
  readinessCriteria: z.array(z.string()),
  rolloutSteps: z.array(z.string()),
  rollbackPlan: z.string(),
});

const planningDraftSchema = z.object({
  generatorVersion: z.string().optional(),
  title: z.string(),
  summary: z.string(),
  status: z.enum(PLANNING_DRAFT_STATUSES),
  scope: z.array(z.string()),
  nonScope: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(riskSchema),
  dependencies: z.array(dependencySchema),
  recommendedAssignments: z.array(assignmentSchema),
  generatedProjects: z.array(projectSchema),
  generatedFeatures: z.array(featureSchema),
  generatedTasks: z.array(taskSchema),
  reviewPlan: reviewPlanSchema,
  qaPlan: qaPlanSchema,
  releasePlan: releasePlanSchema,
  openCeoQuestions: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  estimatedExecutionOrder: z.array(z.string()),
});

/** Result of attempting to parse an AI planning draft from raw model text. */
export type ParseAiPlanningDraftResult =
  | { readonly ok: true; readonly draft: DeterministicPlanningDraft }
  | { readonly ok: false; readonly error: string };

/**
 * Extracts the outermost JSON object from raw model text.
 *
 * Strips ```json / ``` code fences and any surrounding prose, returning the substring
 * from the first `{` to the last `}`.
 *
 * @param text - Raw model output.
 * @returns The candidate JSON substring, or null when no object is present.
 */
function extractJsonObject(text: string): string | null {
  const withoutFences = text.replace(/```(?:json)?/gi, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");

  if (start < 0 || end < 0 || end < start) {
    return null;
  }

  return withoutFences.slice(start, end + 1);
}

/**
 * Summarizes zod issues into a single concise error string.
 *
 * @param error - Zod validation error.
 * @returns A short human-readable description of the first few issues.
 */
function summarizeZodError(error: z.ZodError): string {
  const summary = error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

  return `Planning draft failed schema validation: ${summary}`;
}

/**
 * Parses and validates an AI-generated planning draft from raw model text.
 *
 * Extracts the JSON object (tolerating code fences and surrounding prose), validates it
 * against the {@link DeterministicPlanningDraft} schema, and stamps the
 * {@link AI_PLANNING_GENERATOR_VERSION}. Never throws — malformed or schema-violating
 * input resolves to a structured failure so callers can fall back deterministically.
 *
 * @param text - Raw model output that should contain a single planning-draft JSON object.
 * @example
 * ```ts
 * const result = parseAiPlanningDraft(completion.text);
 * if (result.ok) {
 *   useDraft(result.draft);
 * }
 * ```
 * @returns A success with the validated, version-stamped draft, or a failure with a reason.
 */
export function parseAiPlanningDraft(text: string): ParseAiPlanningDraftResult {
  const candidate = extractJsonObject(text);
  if (candidate === null) {
    return { ok: false, error: "No JSON object found in model output." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Failed to parse JSON from model output: ${reason}` };
  }

  const validated = planningDraftSchema.safeParse(parsed);
  if (!validated.success) {
    return { ok: false, error: summarizeZodError(validated.error) };
  }

  const draft: DeterministicPlanningDraft = {
    ...validated.data,
    generatorVersion: AI_PLANNING_GENERATOR_VERSION,
  };

  return { ok: true, draft };
}
