"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { evaluateOutcomeCompletionForTask } from "@/lib/outcome-completion-service";
import { evaluateTaskStatusChange } from "@/lib/task-status-gate";
import { z } from "zod";
import { redirect } from "next/navigation";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  status: z.enum(["planning", "active", "paused", "done", "cancelled"]).default("planning"),
  // A project must target a repository — the autonomous loop runs in exactly one
  // repo, and the project's workspace is inferred from the chosen repository.
  repositoryId: z.string().min(1, "Select a repository for this project."),
});

export type CreateProjectState =
  | {
      errors?: {
        name?: string[];
        description?: string[];
        repositoryId?: string[];
      };
      message?: string;
    }
  | undefined;

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    status: formData.get("status") || "planning",
    repositoryId: formData.get("repositoryId") || "",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  // Validate the repository belongs to this company, and inherit its workspace so
  // the project always lives alongside the repo it targets (no cross-company leak,
  // no orphaned-workspace projects).
  const repository = await prisma.repository.findFirst({
    where: { id: parsed.data.repositoryId, workspace: { companyId: company.id } },
    select: { id: true, workspaceId: true },
  });
  if (!repository) {
    return { errors: { repositoryId: ["Repository not found."] } };
  }

  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      slug: `${slug}-${Date.now().toString(36)}`,
      companyId: company.id,
      description: parsed.data.description,
      status: parsed.data.status,
      workspaceId: repository.workspaceId,
      repositoryId: repository.id,
    },
  });

  redirect(`/work/projects/${project.id}`);
}

// Statuses a task may be *created* with. `done` and `in-review` are excluded on
// purpose: a brand-new task has no Review or QAResult, so creating it there
// would bypass the acceptance gate ("no task is done without an approved review
// AND a passing QA"). They're rejected in `createTask` with the gate's reason
// (MUS-296).
const CREATION_TASK_STATUSES = [
  "todo",
  "in-progress",
  "blocked",
  "cancelled",
] as const;

const createTaskSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(5000).trim().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  featureId: z.string().optional(),
  status: z.enum(CREATION_TASK_STATUSES).default("todo"),
});

export type CreateTaskState =
  | {
      errors?: {
        title?: string[];
        description?: string[];
        priority?: string[];
      };
      message?: string;
    }
  | undefined;

export async function createTask(
  projectId: string,
  _prev: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  // A task created directly at `done`/`in-review` would skip the acceptance
  // gate — no review or QA can exist for a task that doesn't exist yet. Reject
  // both with the same voice `updateTaskStatus` uses, before validation (MUS-296).
  const requestedStatus = String(formData.get("status") ?? "todo");
  if (requestedStatus === "done") {
    return {
      message:
        "A task cannot be created as done without an approved review and a passing QA result. Run the review and QA gates first.",
    };
  }
  if (requestedStatus === "in-review") {
    return {
      message:
        "A task cannot be created directly in review — it must be implemented before it can be reviewed.",
    };
  }

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    assigneeId: formData.get("assigneeId") || undefined,
    priority: formData.get("priority") || "medium",
    featureId: formData.get("featureId") || undefined,
    status: formData.get("status") || "todo",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { workspaces: { select: { id: true } } },
  });
  if (!company) return { message: "No company found." };

  // Validate the project belongs to this user's workspace
  const workspaceIds = company.workspaces.map((w) => w.id);
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: { in: workspaceIds } },
    select: { id: true },
  });
  if (!project) return { message: "Project not found." };

  // If a featureId is provided, verify it belongs to this project
  if (parsed.data.featureId) {
    const feature = await prisma.feature.findFirst({
      where: { id: parsed.data.featureId, projectId: project.id },
      select: { id: true },
    });
    if (!feature) return { message: "Feature not found." };
  }

  // Validate assignee belongs to this company — prevents cross-company injection
  if (parsed.data.assigneeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: parsed.data.assigneeId, companyId: company.id },
      select: { id: true },
    });
    if (!employee) return { message: "Assignee not found in this company." };
  }

  await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      assigneeId: parsed.data.assigneeId,
      priority: parsed.data.priority,
      featureId: parsed.data.featureId,
      status: parsed.data.status,
      companyId: company.id,
      projectId: project.id,
    },
  });

  redirect(`/work/projects/${projectId}`);
}

export type UpdateTaskStatusResult = { error?: string };

export async function updateTaskStatus(
  taskId: string,
  status: string
): Promise<UpdateTaskStatusResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { error: "No company found." };

  // Boundary gate: reject unknown statuses, and route `done` through the same
  // acceptance evidence the automated loop requires (approved review + passed
  // QA) — the dropdown must not bypass the product's core invariant.
  const gate = await evaluateTaskStatusChange(company.id, taskId, status);
  if (!gate.allowed) {
    return { error: gate.reason ?? "Status change not allowed." };
  }

  await prisma.task.updateMany({
    where: { id: taskId, companyId: company.id },
    data: { status },
  });

  // Outcome lifecycle (MUS-259): a gated manual `done` may have finished the
  // outcome's last open task. Best-effort.
  if (status === "done") {
    try {
      await evaluateOutcomeCompletionForTask(company.id, taskId);
    } catch {
      // Outcome completion is best-effort.
    }
  }
  return {};
}
