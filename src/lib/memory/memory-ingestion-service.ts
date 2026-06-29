import { prisma } from "@/lib/prisma";
import { MEMORY_CATEGORIES } from "./memory-types";
import { recordCompanyMemory } from "./memory-write-service";

/** Outcome of an {@link ingestCompanyMemory} run. */
export interface IngestCompanyMemoryResult {
  /** Total durable records actually created this run (sum of the per-source counts). */
  readonly written: number;
  /** Records created from completed reviews. */
  readonly reviews: number;
  /** Records created from terminal QA results. */
  readonly qa: number;
  /** Records created from shipped releases. */
  readonly releases: number;
}

/** A single parsed review finding, mirroring the shape stored by review-service. */
interface ParsedFinding {
  readonly severity: "blocker" | "non_blocker";
  readonly description: string;
  readonly actionable: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses the review `findings` JSON column into a normalized finding array.
 *
 * @param findingsJson - Raw findings column value from a Review row.
 * @returns Parsed findings; an empty array when the JSON is absent or invalid.
 */
function parseFindings(findingsJson: string | null | undefined): ParsedFinding[] {
  if (!findingsJson?.trim()) return [];
  try {
    const parsed = JSON.parse(findingsJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ParsedFinding =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ParsedFinding).description === "string" &&
        typeof (item as ParsedFinding).actionable === "boolean"
    );
  } catch {
    return [];
  }
}

/**
 * Condenses free text into a single, length-bounded line for a durable lesson.
 *
 * @param text - Raw note or release-notes text.
 * @param max - Maximum length before truncation.
 * @returns The first non-empty line, truncated with an ellipsis when long.
 */
function condense(text: string, max = 240): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0)?.trim() ?? text.trim();
  return firstLine.length > max ? `${firstLine.slice(0, max - 1)}…` : firstLine;
}

/**
 * Builds a durable review lesson from a verdict and its actionable findings.
 *
 * @param review - Review row fields needed to summarize the decision.
 * @returns A concise lesson string, or null when the review carries nothing durable.
 */
function buildReviewLesson(review: {
  verdict: string | null;
  status: string;
  notes: string | null;
  findings: string;
}): string | null {
  const findings = parseFindings(review.findings);
  const actionable = findings.filter((f) => f.actionable);
  const verdict = (review.verdict ?? review.status).replace(/_/g, " ");
  const hasNotes = Boolean(review.notes?.trim());

  // A clean approval with no notes and no action items teaches nothing durable.
  if (verdict === "approved" && !hasNotes && actionable.length === 0) {
    return null;
  }

  const parts: string[] = [`Review ${verdict}`];
  if (hasNotes) {
    parts.push(condense(review.notes!.trim()));
  }
  if (actionable.length > 0) {
    parts.push(`Action items: ${actionable.map((f) => condense(f.description, 120)).join("; ")}`);
  }
  return parts.join(" — ");
}

/**
 * Builds a durable QA lesson from pass/fail counts and notes.
 *
 * @param qa - QA result row fields needed to summarize the outcome.
 * @returns A concise lesson string, or null when there is nothing meaningful to record.
 */
function buildQaLesson(qa: {
  status: string;
  passedCount: number;
  failedCount: number;
  notes: string | null;
}): string | null {
  const total = qa.passedCount + qa.failedCount;
  const hasNotes = Boolean(qa.notes?.trim());
  if (total === 0 && !hasNotes) {
    return null;
  }

  const parts: string[] = [
    `QA ${qa.status}: ${qa.passedCount} passed, ${qa.failedCount} failed`,
  ];
  if (hasNotes) {
    parts.push(condense(qa.notes!.trim()));
  }
  return parts.join(" — ");
}

/**
 * Builds a durable release lesson from the version and release notes.
 *
 * @param release - Release row fields needed to summarize the shipment.
 * @returns A concise lesson string, or null when the release lacks a version.
 */
function buildReleaseLesson(release: {
  version: string;
  releaseNotes: string | null;
  postReleaseNotes: string | null;
}): string | null {
  if (!release.version?.trim()) {
    return null;
  }
  const parts: string[] = [`Released ${release.version.trim()}`];
  const notes = release.releaseNotes?.trim() || release.postReleaseNotes?.trim();
  if (notes) {
    parts.push(condense(notes));
  }
  return parts.join(" — ");
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Distills durable company memory from a company's completed reviews, terminal QA
 * results, and shipped releases.
 *
 * Each source is summarized into a concise lesson and appended to a category-specific
 * memory bank ("Review lessons", "QA lessons", "Release lessons"). Writes are made
 * idempotent through `recordCompanyMemory`'s source key (`review:<id>` / `qa:<id>` /
 * `release:<id>`), so the ingestion can run on every driver tick without duplicating
 * lessons. Only real stored fields are summarized — no lessons are fabricated — and
 * sources without meaningful content are skipped. Ingestion is best-effort per source:
 * a failure on one source does not abort the run.
 *
 * @param companyId - Company scope for ownership and bank routing.
 * @returns Counts of records actually created this run, in total and per source type.
 */
export async function ingestCompanyMemory(
  companyId: string
): Promise<IngestCompanyMemoryResult> {
  let reviews = 0;
  let qa = 0;
  let releases = 0;

  // ── Reviews — decided (verdict recorded) ────────────────────────────────────
  const decidedReviews = await prisma.review.findMany({
    where: { companyId, verdict: { not: null } },
    select: { id: true, verdict: true, status: true, notes: true, findings: true },
  });
  for (const review of decidedReviews) {
    const content = buildReviewLesson(review);
    if (!content) continue;
    const actionable = parseFindings(review.findings).filter((f) => f.actionable);
    const hasBlocker = actionable.some((f) => f.severity === "blocker");
    try {
      const result = await recordCompanyMemory({
        companyId,
        category: MEMORY_CATEGORIES.review,
        bankTitle: "Review lessons",
        content,
        source: `review:${review.id}`,
        confidence: hasBlocker ? 0.8 : 0.65,
      });
      if (result.created) reviews++;
    } catch {
      // Best-effort: skip this source and continue.
    }
  }

  // ── QA — terminal (passed / failed) ─────────────────────────────────────────
  const terminalQa = await prisma.qAResult.findMany({
    where: { companyId, status: { in: ["passed", "failed"] } },
    select: {
      id: true,
      status: true,
      passedCount: true,
      failedCount: true,
      notes: true,
    },
  });
  for (const result of terminalQa) {
    const content = buildQaLesson(result);
    if (!content) continue;
    try {
      const written = await recordCompanyMemory({
        companyId,
        category: MEMORY_CATEGORIES.qa,
        bankTitle: "QA lessons",
        content,
        source: `qa:${result.id}`,
        confidence: result.status === "failed" ? 0.8 : 0.6,
      });
      if (written.created) qa++;
    } catch {
      // Best-effort: skip this source and continue.
    }
  }

  // ── Releases — shipped (released status / releasedAt set) ────────────────────
  const shippedReleases = await prisma.release.findMany({
    where: {
      companyId,
      OR: [{ status: "released" }, { releasedAt: { not: null } }],
    },
    select: {
      id: true,
      version: true,
      releaseNotes: true,
      postReleaseNotes: true,
    },
  });
  for (const release of shippedReleases) {
    const content = buildReleaseLesson(release);
    if (!content) continue;
    try {
      const written = await recordCompanyMemory({
        companyId,
        category: MEMORY_CATEGORIES.release,
        bankTitle: "Release lessons",
        content,
        source: `release:${release.id}`,
        confidence: 0.6,
      });
      if (written.created) releases++;
    } catch {
      // Best-effort: skip this source and continue.
    }
  }

  return { written: reviews + qa + releases, reviews, qa, releases };
}
