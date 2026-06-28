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
  prepareExecutionSession,
} from "@/lib/execution-session-service";
import { parseJsonStringArray } from "@/lib/planning-generator";
import { prisma } from "@/lib/prisma";

// ─── Schemas ───────────────────────────────────────────────────────────────────

const generateTaskBriefSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
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

// ─── Local Type ────────────────────────────────────────────────────────────────

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
