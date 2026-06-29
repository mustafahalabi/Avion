"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prepareExecutionSessionForTask } from "@/lib/auto-execution-service";
import { evaluateAutonomyCheckpoint } from "@/lib/autonomy-policy";
import { getCurrentUser } from "@/lib/current-user";
import {
  ingestAgentExecutionResult,
  type MergeStatus,
  type PrStatus,
} from "@/lib/execution-session-service";
import { prisma } from "@/lib/prisma";

// ─── Schemas ───────────────────────────────────────────────────────────────────

const generateTaskBriefSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
});

const ingestResultSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required."),
  status: z.enum(["completed", "failed", "needs_clarification"]).refine(
    (v) => ["completed", "failed", "needs_clarification"].includes(v),
    { message: "Status must be completed, failed, or needs_clarification." }
  ),
  resultSummary: z.string().max(5000).trim().optional(),
  filesChanged: z.string().max(10000).trim().optional(),
  validationOutput: z.string().max(20000).trim().optional(),
  errorMessage: z.string().max(2000).trim().optional(),
  commitSha: z.string().max(64).trim().optional(),
  prUrl: z.string().max(500).trim().optional(),
  prNumber: z.coerce.number().int().positive().optional(),
  prStatus: z.enum(["open", "draft", "merged", "closed"]).optional(),
  mergeStatus: z.enum(["pending", "merged", "conflicts"]).optional(),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GenerateTaskBriefState =
  | {
      readonly brief?: string;
      readonly branchName?: string;
      readonly sessionId?: string;
      readonly message?: string;
      readonly errors?: {
        readonly taskId?: readonly string[];
      };
    }
  | undefined;

export type IngestExecutionResultState =
  | {
      readonly success?: boolean;
      readonly newTaskStatus?: string | null;
      readonly taskStatusChanged?: boolean;
      readonly message?: string;
      readonly errors?: {
        readonly sessionId?: readonly string[];
        readonly status?: readonly string[];
        readonly resultSummary?: readonly string[];
        readonly filesChanged?: readonly string[];
        readonly validationOutput?: readonly string[];
        readonly errorMessage?: readonly string[];
      };
    }
  | undefined;

// ─── Actions ───────────────────────────────────────────────────────────────────

/**
 * Generates an agent-safe Claude Code implementation brief for a task.
 *
 * Creates an ExecutionSession in the "prepared" state and attaches the
 * generated brief. Returns the brief text so the UI can expose a copy action.
 *
 * @param _prev - Previous action state supplied by `useActionState`.
 * @param formData - Form data containing `taskId`.
 * @returns Action state with the generated brief text, branch name, and session ID.
 * @example
 * ```tsx
 * <form action={generateTaskBrief}>
 *   <input type="hidden" name="taskId" value={task.id} />
 *   <button type="submit">Generate Brief</button>
 * </form>
 * ```
 */
export async function generateTaskBrief(
  _prev: GenerateTaskBriefState,
  formData: FormData
): Promise<GenerateTaskBriefState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const parsed = generateTaskBriefSchema.safeParse({
    taskId: formData.get("taskId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true, settings: { select: { autonomyLevel: true } } },
  });
  if (!company) return { message: "No company found." };

  // Consult the single autonomy policy that the autonomous driver (MUS-205)
  // also consults, so the manual and driven paths authorize identically. A
  // CEO-initiated brief generation is the human-supplied approval for the
  // create_session checkpoint; we only refuse if the level denies it outright.
  const authorization = evaluateAutonomyCheckpoint({
    level: company.settings?.autonomyLevel,
    action: "create_session",
    context: { taskId: parsed.data.taskId, summary: "Prepare execution session for task" },
    hasApproval: true,
  });
  if (authorization.type === "blocked") {
    return { message: authorization.decision.reason };
  }

  // Shared, non-UI preparation core — the same path the autonomous driver uses,
  // so manual and automated session creation never diverge.
  const result = await prepareExecutionSessionForTask(
    company.id,
    parsed.data.taskId
  );
  if ("error" in result) {
    return { message: result.error };
  }

  revalidatePath(`/work/tasks/${parsed.data.taskId}`);

  return {
    brief: result.brief,
    branchName: result.branchName,
    sessionId: result.sessionId,
  };
}

/**
 * Records the result of an external agent execution run back into Engineering OS.
 *
 * The session transitions to the reported status; completed sessions move the
 * linked task to "in-review". Failed or needs-clarification sessions leave the
 * task actionable ("todo"). Review/QA gates are never bypassed.
 *
 * @param _prev - Previous action state supplied by `useActionState`.
 * @param formData - Form data with sessionId, status, resultSummary, filesChanged,
 *   validationOutput, and errorMessage.
 * @returns Action state with success flag and new task status.
 * @example
 * ```tsx
 * <form action={ingestExecutionResult}>
 *   <input type="hidden" name="sessionId" value={session.id} />
 *   <select name="status">…</select>
 * </form>
 * ```
 */
export async function ingestExecutionResult(
  _prev: IngestExecutionResultState,
  formData: FormData
): Promise<IngestExecutionResultState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const parsed = ingestResultSchema.safeParse({
    sessionId: formData.get("sessionId"),
    status: formData.get("status"),
    resultSummary: formData.get("resultSummary") || undefined,
    filesChanged: formData.get("filesChanged") || undefined,
    validationOutput: formData.get("validationOutput") || undefined,
    errorMessage: formData.get("errorMessage") || undefined,
    commitSha: formData.get("commitSha") || undefined,
    prUrl: formData.get("prUrl") || undefined,
    prNumber: formData.get("prNumber") || undefined,
    prStatus: formData.get("prStatus") || undefined,
    mergeStatus: formData.get("mergeStatus") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  try {
    const outcome = await ingestAgentExecutionResult({
      companyId: company.id,
      sessionId: parsed.data.sessionId,
      status: parsed.data.status,
      resultSummary: parsed.data.resultSummary ?? null,
      filesChanged: parsed.data.filesChanged ?? "",
      validationOutput: parsed.data.validationOutput ?? null,
      errorMessage: parsed.data.errorMessage ?? null,
      commitSha: parsed.data.commitSha ?? null,
      prUrl: parsed.data.prUrl || null,
      prNumber: parsed.data.prNumber ?? null,
      prStatus: (parsed.data.prStatus as PrStatus | undefined) ?? null,
      mergeStatus: (parsed.data.mergeStatus as MergeStatus | undefined) ?? null,
    });

    if (outcome.session.taskId) {
      revalidatePath(`/work/tasks/${outcome.session.taskId}`);
    }

    return {
      success: true,
      newTaskStatus: outcome.newTaskStatus,
      taskStatusChanged: outcome.taskStatusChanged,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record execution result.";
    return { message };
  }
}
