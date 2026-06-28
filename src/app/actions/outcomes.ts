"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

// ─── Submit Outcome ───────────────────────────────────────────────────────────

const submitOutcomeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Outcome must be at least 5 characters.")
    .max(300, "Outcome title must be 300 characters or fewer."),
  rawRequest: z
    .string()
    .trim()
    .min(10, "Please describe the outcome in at least 10 characters.")
    .max(5000, "Description must be 5,000 characters or fewer."),
  repositoryId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .default("medium"),
});

export type SubmitOutcomeState =
  | undefined
  | {
      errors?: {
        title?: string[];
        rawRequest?: string[];
        repositoryId?: string[];
        priority?: string[];
      };
      message?: string;
    };

/**
 * Creates a company-scoped Outcome without generating work records.
 * Redirects to the outcome detail page on success.
 */
export async function submitOutcome(
  _prev: SubmitOutcomeState,
  formData: FormData
): Promise<SubmitOutcomeState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Not authenticated." };

  const parsed = submitOutcomeSchema.safeParse({
    title: formData.get("title"),
    rawRequest: formData.get("rawRequest"),
    repositoryId: formData.get("repositoryId"),
    priority: formData.get("priority") || "medium",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  // Validate repository ownership if supplied
  if (parsed.data.repositoryId) {
    const repo = await prisma.repository.findFirst({
      where: {
        id: parsed.data.repositoryId,
        workspace: { companyId: company.id },
      },
      select: { id: true },
    });
    if (!repo) return { errors: { repositoryId: ["Repository not found."] } };
  }

  const outcome = await prisma.outcome.create({
    data: {
      companyId: company.id,
      title: parsed.data.title,
      rawRequest: parsed.data.rawRequest,
      repositoryId: parsed.data.repositoryId ?? null,
      priority: parsed.data.priority,
      status: "proposed",
    },
    select: { id: true },
  });

  revalidatePath("/work/projects");
  revalidatePath("/dashboard");

  redirect(`/work/outcomes/${outcome.id}`);
}
