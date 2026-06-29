import { prisma } from "@/lib/prisma";
import type { RecordCompanyMemoryInput } from "./memory-types";

/** Result of a {@link recordCompanyMemory} write. */
export interface RecordCompanyMemoryResult {
  /** False when an existing record with the same source was found (idempotent skip). */
  readonly created: boolean;
  readonly recordId: string;
  readonly memoryId: string;
}

/**
 * Appends a durable memory record to a company memory bank, creating the bank on first use.
 *
 * The bank is keyed by (companyId, category, title). When `source` is provided the write is
 * idempotent: if a record with that source already exists in the company's memory, no new
 * record is created and the existing one is returned. This lets ingestion run repeatedly
 * (e.g. on every driver tick) without duplicating lessons.
 *
 * @param input - Target bank, content, and optional provenance/confidence.
 * @returns Whether a record was created plus the record and bank ids.
 */
export async function recordCompanyMemory(
  input: RecordCompanyMemoryInput
): Promise<RecordCompanyMemoryResult> {
  if (input.source) {
    const existing = await prisma.memoryRecord.findFirst({
      where: { source: input.source, memory: { companyId: input.companyId } },
      select: { id: true, memoryId: true },
    });
    if (existing) {
      return { created: false, recordId: existing.id, memoryId: existing.memoryId };
    }
  }

  const memoryId = await findOrCreateBank(input);

  const record = await prisma.memoryRecord.create({
    data: {
      memoryId,
      content: input.content,
      source: input.source ?? null,
      confidence: input.confidence ?? 1.0,
    },
    select: { id: true, memoryId: true },
  });

  return { created: true, recordId: record.id, memoryId: record.memoryId };
}

/**
 * Finds the company memory bank for (companyId, category, title), creating it if absent.
 *
 * @param input - Carries companyId, category, bankTitle, and tags (applied only on create).
 * @returns The bank id.
 */
async function findOrCreateBank(
  input: RecordCompanyMemoryInput
): Promise<string> {
  const existing = await prisma.memory.findFirst({
    where: {
      companyId: input.companyId,
      category: input.category,
      title: input.bankTitle,
    },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const created = await prisma.memory.create({
    data: {
      companyId: input.companyId,
      title: input.bankTitle,
      category: input.category,
      tags: JSON.stringify(input.tags ?? []),
    },
    select: { id: true },
  });
  return created.id;
}
