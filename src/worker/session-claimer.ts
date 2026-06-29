import type { ExecutionSession } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Finds and atomically claims the oldest prepared execution session.
 *
 * @param companyId - Optional company filter for multi-tenant workers.
 * @returns Claimed session or null when none are available or claim lost a race.
 */
export async function claimNextSession(
  companyId?: string
): Promise<ExecutionSession | null> {
  const session = await prisma.executionSession.findFirst({
    where: {
      status: "prepared",
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (!session) {
    return null;
  }

  const claim = await prisma.executionSession.updateMany({
    where: { id: session.id, status: "prepared" },
    data: { status: "running", startedAt: new Date() },
  });

  if (claim.count === 0) {
    return null;
  }

  return prisma.executionSession.findFirst({ where: { id: session.id } });
}

/**
 * Marks a session as failed — used when the worker crashes mid-run.
 *
 * @param sessionId - Execution session ID.
 * @param status - Terminal status to set (typically `failed`).
 * @param errorMessage - Optional failure reason.
 */
export async function releaseSession(
  sessionId: string,
  status: "failed",
  errorMessage?: string
): Promise<void> {
  await prisma.executionSession.update({
    where: { id: sessionId },
    data: {
      status,
      errorMessage: errorMessage ?? null,
      completedAt: new Date(),
    },
  });
}
