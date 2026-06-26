"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const REQUEST_TYPES = [
  "feature",
  "bug",
  "architecture",
  "security",
  "documentation",
  "configuration",
  "performance",
  "question",
] as const;

const ROUTING: Record<string, string> = {
  feature: "Product Manager",
  bug: "Tech Lead",
  architecture: "CTO",
  security: "Security Engineer",
  documentation: "Technical Writer",
  configuration: "CTO",
  performance: "Monitoring Engineer",
  question: "CTO",
};

const submitRequestSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  goal: z.string().min(1).max(5000).trim(),
  requestType: z.enum(REQUEST_TYPES).default("feature"),
});

export type SubmitRequestState =
  | { errors?: { title?: string[]; goal?: string[] }; message?: string; id?: string }
  | undefined;

export async function submitRequest(
  _prev: SubmitRequestState,
  formData: FormData
): Promise<SubmitRequestState> {
  const session = await auth();
  if (!session?.user) return { message: "Not authenticated." };

  const parsed = submitRequestSchema.safeParse({
    title: formData.get("title"),
    goal: formData.get("goal"),
    requestType: formData.get("requestType") || "feature",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  const request = await prisma.runtimeRequest.create({
    data: {
      companyId: company.id,
      title: parsed.data.title,
      goal: parsed.data.goal,
      requestType: parsed.data.requestType,
      status: "intake",
      assignedTo: ROUTING[parsed.data.requestType] ?? "CTO",
    },
  });

  await prisma.runtimeEvent.create({
    data: {
      requestId: request.id,
      type: "intake",
      description: `Request received and routed to ${request.assignedTo}.`,
      actor: "System",
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  return { id: request.id };
}

export async function advanceRequestStatus(
  requestId: string,
  newStatus: string,
  description: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) return;

  const request = await prisma.runtimeRequest.findFirst({
    where: { id: requestId, companyId: company.id },
  });
  if (!request) return;

  await prisma.runtimeRequest.update({
    where: { id: requestId },
    data: { status: newStatus, updatedAt: new Date() },
  });

  await prisma.runtimeEvent.create({
    data: {
      requestId,
      type: newStatus,
      description,
      actor: "CEO",
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
}
