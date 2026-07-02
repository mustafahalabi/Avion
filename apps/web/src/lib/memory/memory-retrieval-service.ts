import { prisma } from "@/lib/prisma";
import {
  PLANNING_MEMORY_CATEGORIES,
  type CompanyMemoryItem,
} from "./memory-types";

/** Input for {@link getRelevantCompanyMemory}. */
export interface GetRelevantCompanyMemoryInput {
  readonly companyId: string;
  /** Restrict to these bank categories; defaults to the planning-relevant set. */
  readonly categories?: readonly string[];
  /** Maximum records to return; defaults to 20. */
  readonly limit?: number;
}

const DEFAULT_LIMIT = 20;

/**
 * Retrieves the most relevant durable memory for a company, highest-confidence and most
 * recent first. Defaults to the planning-relevant categories (standards, learnings, review,
 * QA, release) so promoted standards surface ahead of raw lessons.
 *
 * @param input - Company scope, optional category filter, and limit.
 * @returns Ranked company memory items.
 */
export async function getRelevantCompanyMemory(
  input: GetRelevantCompanyMemoryInput
): Promise<CompanyMemoryItem[]> {
  const categories =
    input.categories && input.categories.length > 0
      ? [...input.categories]
      : [...PLANNING_MEMORY_CATEGORIES];

  const records = await prisma.memoryRecord.findMany({
    where: {
      memory: { companyId: input.companyId, category: { in: categories } },
    },
    select: {
      id: true,
      content: true,
      source: true,
      confidence: true,
      createdAt: true,
      memory: { select: { category: true, title: true } },
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: input.limit ?? DEFAULT_LIMIT,
  });

  return records.map((record) => ({
    id: record.id,
    category: record.memory.category,
    bankTitle: record.memory.title,
    content: record.content,
    source: record.source,
    confidence: record.confidence,
    createdAt: record.createdAt,
  }));
}

/**
 * Renders company memory as a compact, prompt-friendly "lessons learned" block.
 *
 * @param items - Retrieved company memory.
 * @returns A newline-joined bullet list, or an empty string when there is nothing to add.
 */
export function formatMemoryForPrompt(
  items: readonly CompanyMemoryItem[]
): string {
  if (items.length === 0) {
    return "";
  }
  return items
    .map((item) => `- [${item.category}] ${item.content}`)
    .join("\n");
}
