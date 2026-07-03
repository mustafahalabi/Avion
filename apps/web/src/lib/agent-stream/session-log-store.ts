/**
 * Persistence for the live agent-output stream (`SessionLogChunk` rows).
 *
 * Server-only (imports Prisma). The worker appends events here as the agent
 * runs; the SSE endpoint tails them by cursor. Writes are best-effort by
 * contract — a logging failure must never fail the actual execution — so every
 * function here swallows/normalizes errors at the call site rather than throwing
 * into the hot path.
 */

import { prisma } from "@/lib/prisma";
import {
  AGENT_STREAM_DETAIL_MAX,
  AGENT_STREAM_LABEL_MAX,
  type AgentStreamEvent,
} from "./types";

/** Truncates a string to a max length, appending an ellipsis marker if cut. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Appends a batch of already-sequenced events for a session.
 *
 * `skipDuplicates` + the `[sessionId, seq]` unique constraint make this
 * idempotent, so a retried flush can't create duplicate rows. Fields are
 * truncated defensively so one huge line can't bloat a row.
 *
 * @param sessionId - Owning ExecutionSession id.
 * @param companyId - Denormalized for cheap company-scoped reads/cleanup.
 * @param events - Events carrying their monotonic per-session `seq`.
 */
export async function appendSessionLogEvents(
  sessionId: string,
  companyId: string,
  events: AgentStreamEvent[]
): Promise<void> {
  if (events.length === 0) return;
  await prisma.sessionLogChunk.createMany({
    data: events.map((e) => ({
      sessionId,
      companyId,
      seq: e.seq,
      type: e.type,
      label: truncate(e.label, AGENT_STREAM_LABEL_MAX),
      detail: e.detail == null ? null : truncate(e.detail, AGENT_STREAM_DETAIL_MAX),
      atMs: e.atMs,
    })),
    skipDuplicates: true,
  });
}

/**
 * Reads events for a session with `seq` strictly greater than `afterSeq`.
 *
 * @param sessionId - Owning ExecutionSession id.
 * @param afterSeq - Cursor; pass 0 for the full stream from the start.
 * @param limit - Max rows to return per read (SSE pages through in order).
 * @returns Events ascending by seq.
 */
export async function readSessionLogEvents(
  sessionId: string,
  afterSeq: number,
  limit = 200
): Promise<AgentStreamEvent[]> {
  const rows = await prisma.sessionLogChunk.findMany({
    where: { sessionId, seq: { gt: afterSeq } },
    orderBy: { seq: "asc" },
    take: limit,
    select: { seq: true, type: true, label: true, detail: true, atMs: true },
  });
  return rows.map((r) => ({
    seq: r.seq,
    type: r.type as AgentStreamEvent["type"],
    label: r.label,
    detail: r.detail,
    atMs: r.atMs,
  }));
}

/** Minimal session facts the SSE endpoint needs for scoping + stop-detection. */
export interface SessionStreamMeta {
  companyId: string;
  status: string;
}

/**
 * Resolves the company + status for a session, or null if it doesn't exist.
 *
 * The SSE route uses this to (a) authorize the caller against the session's
 * company and (b) know when the session has gone terminal so it can close.
 */
export async function getSessionStreamMeta(
  sessionId: string
): Promise<SessionStreamMeta | null> {
  const session = await prisma.executionSession.findUnique({
    where: { id: sessionId },
    select: { companyId: true, status: true },
  });
  if (!session) return null;
  return { companyId: session.companyId, status: session.status };
}
