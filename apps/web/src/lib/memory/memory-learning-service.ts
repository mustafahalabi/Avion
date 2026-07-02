import { prisma } from "@/lib/prisma";
import { MEMORY_CATEGORIES } from "./memory-types";
import { recordCompanyMemory } from "./memory-write-service";

/**
 * A single review finding as stored in `Review.findings` (a JSON array).
 *
 * Mirrors `ReviewFinding` from the review service; redeclared locally so the learning
 * engine depends only on the persisted shape, not the review service's input contract.
 */
interface StoredReviewFinding {
  readonly severity: string;
  readonly description: string;
  readonly actionable?: boolean;
}

/** Options for {@link promoteRecurringLessons}. */
export interface PromoteRecurringLessonsOptions {
  /** Minimum number of occurrences before a finding is promoted to a standard. Defaults to 3. */
  readonly threshold?: number;
}

/** Result of a {@link promoteRecurringLessons} run. */
export interface PromoteRecurringLessonsResult {
  /** Number of new durable standards created on this run (idempotent re-runs return 0). */
  readonly promoted: number;
}

const DEFAULT_THRESHOLD = 3;
const STANDARDS_BANK_TITLE = "Engineering standards (learned)";

/** Aggregated occurrence data for a normalized finding key. */
interface FindingAggregate {
  count: number;
  /** The first-seen original severity, used for human-readable output. */
  readonly severity: string;
  /** The first-seen original (untrimmed-case) description, used for human-readable output. */
  readonly description: string;
}

/**
 * Normalizes a finding to a stable dedupe key: lowercased + trimmed description, then
 * severity, joined by "|". This collapses cosmetically-different repeats of the same lesson.
 */
function normalizeKey(description: string, severity: string): string {
  return `${description.trim().toLowerCase()}|${severity.trim().toLowerCase()}`;
}

/**
 * Derives a filesystem/source-safe slug from a normalized key, for use as the idempotency
 * `source` (`learning:<slug>`). Non-alphanumeric runs collapse to single hyphens.
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

/**
 * The learning engine: scans a company's accumulated review findings, counts how often the
 * same finding recurs, and promotes any finding that recurs at or above `threshold` into a
 * single durable engineering standard in company memory.
 *
 * Each promoted standard is written via {@link recordCompanyMemory} with a deterministic
 * `source` (`learning:<key>`), so repeated runs are idempotent and never duplicate a standard.
 * Sub-threshold findings are left untouched. Malformed `findings` JSON is skipped defensively.
 *
 * @param companyId - The company whose reviews to learn from.
 * @param options - Optional `threshold` overriding the default of 3.
 * @returns The number of standards newly created on this run.
 */
export async function promoteRecurringLessons(
  companyId: string,
  options?: PromoteRecurringLessonsOptions
): Promise<PromoteRecurringLessonsResult> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;

  const reviews = await prisma.review.findMany({
    where: { companyId },
    select: { findings: true },
  });

  const aggregates = new Map<string, FindingAggregate>();

  for (const review of reviews) {
    const findings = parseFindings(review.findings);
    for (const finding of findings) {
      if (
        typeof finding.description !== "string" ||
        typeof finding.severity !== "string"
      ) {
        continue;
      }
      const key = normalizeKey(finding.description, finding.severity);
      const existing = aggregates.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        aggregates.set(key, {
          count: 1,
          severity: finding.severity,
          description: finding.description,
        });
      }
    }
  }

  let promoted = 0;

  for (const [key, aggregate] of aggregates) {
    if (aggregate.count < threshold) {
      continue;
    }
    const content = `Recurring ${aggregate.severity} finding (${aggregate.count}×): ${aggregate.description}. Treat as a standard to check proactively.`;
    const result = await recordCompanyMemory({
      companyId,
      category: MEMORY_CATEGORIES.standards,
      bankTitle: STANDARDS_BANK_TITLE,
      content,
      source: `learning:${sanitizeKey(key)}`,
      confidence: 0.9,
    });
    if (result.created) {
      promoted += 1;
    }
  }

  return { promoted };
}

/**
 * Parses a `Review.findings` JSON string into an array of findings, returning an empty array
 * for null/empty/malformed values so a single bad review cannot break a learning run.
 */
function parseFindings(raw: string | null): StoredReviewFinding[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredReviewFinding[]) : [];
  } catch {
    return [];
  }
}
