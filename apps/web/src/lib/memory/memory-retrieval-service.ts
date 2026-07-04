import { prisma } from "@/lib/prisma";
import {
  PLANNING_MEMORY_CATEGORIES,
  type CompanyMemoryItem,
} from "./memory-types";
import {
  cosineSimilarity,
  resolveEmbeddingProvider,
  type EmbeddingProvider,
} from "./embedding-provider";

/** Input for {@link getRelevantCompanyMemory}. */
export interface GetRelevantCompanyMemoryInput {
  readonly companyId: string;
  /** Restrict to these bank categories; defaults to the planning-relevant set. */
  readonly categories?: readonly string[];
  /** Maximum records to return; defaults to 20. */
  readonly limit?: number;
  /**
   * When provided, recall is SEMANTIC (Goal 5c): candidates are ranked by
   * embedding cosine similarity to this query (typically the outcome's request)
   * instead of pure recency, so the most RELEVANT lessons surface. Omit for the
   * original confidence/recency ordering.
   */
  readonly query?: string;
  /** Injected embedding provider (tests); defaults to the env-resolved one. */
  readonly embeddingProvider?: EmbeddingProvider;
}

const DEFAULT_LIMIT = 20;

/**
 * Candidate pool size for semantic recall — the most-recent N records are
 * embedded and re-ranked by relevance, then the top `limit` are returned. Bounds
 * how many records are embedded per recall.
 */
const SEMANTIC_CANDIDATE_POOL = 200;

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
  const limit = input.limit ?? DEFAULT_LIMIT;
  const query = input.query?.trim();

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
    // Semantic recall re-ranks a larger candidate pool; keyword recall takes
    // exactly `limit` as before (unchanged behavior).
    take: query ? SEMANTIC_CANDIDATE_POOL : limit,
  });

  const toItem = (record: (typeof records)[number]): CompanyMemoryItem => ({
    id: record.id,
    category: record.memory.category,
    bankTitle: record.memory.title,
    content: record.content,
    source: record.source,
    confidence: record.confidence,
    createdAt: record.createdAt,
  });

  if (!query) {
    return records.map(toItem);
  }

  // Semantic ranking (Goal 5c): embed the query + each candidate and rank by
  // cosine similarity, tie-broken by the original confidence/recency order.
  const provider = input.embeddingProvider ?? resolveEmbeddingProvider();
  const queryVec = await provider.embed(query);
  const scored = await Promise.all(
    records.map(async (record, index) => ({
      record,
      index,
      score: cosineSimilarity(queryVec, await provider.embed(record.content)),
    }))
  );
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index; // stable fallback to confidence/recency order
  });
  return scored.slice(0, limit).map((s) => toItem(s.record));
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
