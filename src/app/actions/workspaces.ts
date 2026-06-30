"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { createWorkspace } from "@/lib/workspace-service";
import { z } from "zod";
import { redirect } from "next/navigation";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(1000).trim().optional(),
});

export type CreateWorkspaceState =
  | { errors?: { name?: string[]; description?: string[] }; message?: string }
  | undefined;

export async function createWorkspaceAction(
  _prev: CreateWorkspaceState,
  formData: FormData
): Promise<CreateWorkspaceState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  const workspace = await createWorkspace(company.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });

  redirect(`/work/workspaces/${workspace.id}`);
}
