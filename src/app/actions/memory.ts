"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const VALID_CATEGORIES = [
  "company",
  "architecture",
  "product",
  "security",
  "operations",
  "employee",
  "feature",
  "decision",
] as const;

const createMemorySchema = z.object({
  title: z.string().min(1).max(200).trim(),
  summary: z.string().max(2000).trim().optional(),
  category: z.enum(VALID_CATEGORIES).default("company"),
});

const addMemoryRecordSchema = z.object({
  content: z.string().min(1).max(10000).trim(),
  source: z.string().max(500).trim().optional(),
  confidence: z.coerce.number().min(0).max(1).default(1.0),
});

export type CreateMemoryState =
  | { errors?: { title?: string[]; summary?: string[] }; message?: string }
  | undefined;

export type AddRecordState =
  | { errors?: { content?: string[] }; message?: string }
  | undefined;

export async function createMemory(
  _prev: CreateMemoryState,
  formData: FormData
): Promise<CreateMemoryState> {
  const session = await auth();
  if (!session?.user) return { message: "Not authenticated." };

  const parsed = createMemorySchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary") || undefined,
    category: formData.get("category") || "company",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  const memory = await prisma.memory.create({
    data: {
      companyId: company.id,
      title: parsed.data.title,
      summary: parsed.data.summary,
      category: parsed.data.category,
    },
  });

  redirect(`/memory/${memory.id}`);
}

export async function addMemoryRecord(
  memoryId: string,
  _prev: AddRecordState,
  formData: FormData
): Promise<AddRecordState> {
  const session = await auth();
  if (!session?.user) return { message: "Not authenticated." };

  const parsed = addMemoryRecordSchema.safeParse({
    content: formData.get("content"),
    source: formData.get("source") || undefined,
    confidence: formData.get("confidence") || 1.0,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) return { message: "No company found." };

  const memory = await prisma.memory.findFirst({
    where: { id: memoryId, companyId: company.id },
  });
  if (!memory) return { message: "Memory not found." };

  await prisma.memoryRecord.create({
    data: {
      memoryId,
      content: parsed.data.content,
      source: parsed.data.source,
      confidence: parsed.data.confidence,
    },
  });

  revalidatePath(`/memory/${memoryId}`);
  return undefined;
}
