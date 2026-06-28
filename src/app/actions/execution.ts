"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/current-user";
import {
  generateClaudeImplementationBrief,
  type BriefRepositoryContext,
} from "@/lib/implementation-brief";
import {
  createExecutionSession,
  ingestAgentExecutionResult,
  prepareExecutionSession,
} from "@/lib/execution-session-service";
import { parseJsonStringArray } from "@/lib/planning-generator";
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
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, companyId: company.id },
    include: {
      planningDraft: {
        select: {
          id: true,
          generatedTasks: true,
        },
      },
      project: {
        include: {
          workspace: {
            include: {
              repositories: {
                take: 1,
                orderBy: { updatedAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!task) return { message: "Task not found." };

  const repo = extractRepositoryContext(task);

  const { brief, branchName } = generateClaudeImplementationBrief({
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description ?? null,
    priority: task.priority,
    planningDraftId: task.planningDraftId ?? null,
    planItemId: task.planItemId ?? null,
    generatedTasksJson: task.planningDraft?.generatedTasks ?? null,
    repository: repo,
    branchName: null,
    baseBranch: "master",
    linearTicketUrl: null,
  });

  const session = await createExecutionSession({
    companyId: company.id,
    taskId: task.id,
    projectId: task.projectId ?? null,
    repositoryId: repo ? extractRepositoryId(task) : null,
    planningDraftId: task.planningDraftId ?? null,
    agentType: "claude_code",
  });

  const prepared = await prepareExecutionSession(company.id, session.id, brief);
  if (!prepared) return { message: "Failed to prepare execution session." };

  revalidatePath(`/work/tasks/${task.id}`);

  return {
    brief,
    branchName,
    sessionId: session.id,
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts a BriefRepositoryContext from a task's project workspace repository.
 *
 * @param task - Task row with included project and workspace context.
 * @returns Repository context when available, null otherwise.
 */
function extractRepositoryContext(
  task: TaskWithProjectAndWorkspace
): BriefRepositoryContext | null {
  const repositories = task.project?.workspace?.repositories;
  if (!repositories || repositories.length === 0) return null;

  const repo = repositories[0];

  return {
    name: repo.name,
    url: repo.url ?? null,
    primaryLanguage: repo.primaryLanguage ?? null,
    frameworks: parseJsonStringArray(repo.frameworks),
    techStack: parseJsonStringArray(repo.techStack),
    importantFiles: parseJsonStringArray(repo.importantFiles),
    analysisStatus: repo.analysisStatus,
  };
}

/**
 * Extracts the repository ID from the task's project workspace.
 *
 * @param task - Task row with included project and workspace context.
 * @returns Repository ID when available, null otherwise.
 */
function extractRepositoryId(task: TaskWithProjectAndWorkspace): string | null {
  const repositories = task.project?.workspace?.repositories;
  if (!repositories || repositories.length === 0) return null;
  return repositories[0].id;
}

// ─── Local Types ───────────────────────────────────────────────────────────────

interface RepositoryRow {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly primaryLanguage: string | null;
  readonly frameworks: string;
  readonly techStack: string;
  readonly importantFiles: string;
  readonly analysisStatus: string;
}

interface WorkspaceRow {
  readonly repositories: readonly RepositoryRow[];
}

interface ProjectWithWorkspace {
  readonly workspace: WorkspaceRow | null;
}

interface TaskWithProjectAndWorkspace {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly priority: string;
  readonly projectId: string | null;
  readonly planningDraftId: string | null;
  readonly planItemId: string | null;
  readonly planningDraft: {
    readonly id: string;
    readonly generatedTasks: string;
  } | null;
  readonly project: ProjectWithWorkspace | null;
}
