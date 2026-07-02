/**
 * Shared types for the compounding-memory subsystem.
 *
 * Memory is durable, company-scoped organizational knowledge stored over the existing
 * Prisma Memory (bank) + MemoryRecord models. Records are written automatically from
 * company signals (reviews, QA, releases) and retrieved into the planner's context so
 * plans improve as the company learns. The subsystem is schema-free: it uses
 * MemoryRecord.source for idempotent provenance and MemoryRecord.confidence for signal
 * strength.
 */

/** Canonical memory categories (the Memory bank's `category`). */
export const MEMORY_CATEGORIES = {
  /** Distilled lessons captured from company signals. */
  learnings: "learnings",
  /** Recurring lessons promoted to durable company practice. */
  standards: "standards",
  /** Lessons sourced from code reviews. */
  review: "review",
  /** Lessons sourced from QA results. */
  qa: "qa",
  /** Lessons sourced from releases. */
  release: "release",
  /** General seeded company memory. */
  company: "company",
} as const;

export type MemoryCategory =
  (typeof MEMORY_CATEGORIES)[keyof typeof MEMORY_CATEGORIES];

/** The categories surfaced to the planner as "lessons learned", most useful first. */
export const PLANNING_MEMORY_CATEGORIES: readonly string[] = [
  MEMORY_CATEGORIES.standards,
  MEMORY_CATEGORIES.learnings,
  MEMORY_CATEGORIES.review,
  MEMORY_CATEGORIES.qa,
  MEMORY_CATEGORIES.release,
];

/** A single durable memory record with its bank context, suitable for retrieval/display/prompting. */
export interface CompanyMemoryItem {
  readonly id: string;
  /** The owning bank's category (e.g. "standards", "review"). */
  readonly category: string;
  /** The owning bank's title. */
  readonly bankTitle: string;
  /** The durable lesson text. */
  readonly content: string;
  /** Provenance, e.g. "review:<id>" | "qa:<id>" | "release:<id>" | "learning:<hash>"; null for manual entries. */
  readonly source: string | null;
  /** Signal strength in [0,1]; promoted standards carry higher confidence. */
  readonly confidence: number;
  readonly createdAt: Date;
}

/** Input for {@link import("./memory-write-service").recordCompanyMemory}. */
export interface RecordCompanyMemoryInput {
  readonly companyId: string;
  /** Target bank category (one of MEMORY_CATEGORIES). */
  readonly category: string;
  /** Target bank title (find-or-create key together with companyId + category). */
  readonly bankTitle: string;
  readonly content: string;
  /** Provenance used for idempotency; when set, a duplicate record for the same source is skipped. */
  readonly source?: string | null;
  /** Defaults to 1.0. */
  readonly confidence?: number;
  /** Bank tags applied only when the bank is first created. */
  readonly tags?: readonly string[];
}
