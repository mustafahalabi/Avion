"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import { redirect } from "next/navigation";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  status: z.enum(["planning", "active", "paused", "done", "cancelled"]).default("planning"),
});

export type CreateProjectState =
  | { errors?: { name?: string[]; description?: string[] }; message?: string }
  | undefined;

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const session = await auth();
  if (!session?.user) return { message: "Not authenticated." };

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    status: formData.get("status") || "planning",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    include: { workspaces: { select: { id: true } } },
  });
  if (!company || company.workspaces.length === 0) {
    return { message: "No workspace found." };
  }

  const workspaceId = company.workspaces[0].id;
  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      slug: `${slug}-${Date.now().toString(36)}`,
      description: parsed.data.description,
      status: parsed.data.status,
      workspaceId,
    },
  });

  redirect(`/work/projects/${project.id}`);
}

const createTaskSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(5000).trim().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  featureId: z.string().optional(),
  status: z
    .enum(["todo", "in-progress", "in-review", "done", "blocked", "cancelled"])
    .default("todo"),
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
  const session = await auth();
  if (!session?.user) return { message: "Not authenticated." };

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
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      assigneeId: parsed.data.assigneeId,
      priority: parsed.data.priority,
      featureId: parsed.data.featureId,
      status: parsed.data.status,
      companyId: company.id,
    },
  });

  redirect(`/work/projects/${projectId}`);
}

export async function updateTaskStatus(
  taskId: string,
  status: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) return;

  await prisma.task.updateMany({
    where: { id: taskId, companyId: company.id },
    data: { status },
  });
}
