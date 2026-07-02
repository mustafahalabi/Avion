import { describe, expect, it, vi } from "vitest";

import { BoardService } from "./board.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuthContext } from "../auth/auth.service";

const SCOPE: AuthContext = { userId: "user-1", companyIds: ["company-1", "company-2"] };

const SESSION_ROW = {
  id: "ses-1",
  companyId: "company-1",
  taskId: "task-1",
  status: "running",
  agentType: "claude_code",
  prUrl: null,
  prNumber: null,
  prStatus: null,
  createdAt: new Date("2026-07-01T00:00:00Z"),
  updatedAt: new Date("2026-07-01T00:05:00Z"),
};

function makePrisma() {
  return {
    executionSession: {
      findMany: vi.fn().mockResolvedValue([SESSION_ROW]),
      groupBy: vi.fn().mockResolvedValue([{ status: "running", _count: { _all: 1 } }]),
      count: vi.fn().mockResolvedValue(1),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([{ id: "company-1", name: "Acme" }]),
    },
    task: {
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([{ id: "task-1", title: "Feature X" }]),
    },
    notification: {
      count: vi.fn().mockResolvedValue(3),
    },
  };
}

describe("BoardService.getSnapshot — company scoping", () => {
  it("bounds every query to the caller's companies and user", async () => {
    const prisma = makePrisma();
    const service = new BoardService(prisma as unknown as PrismaService);

    const snapshot = await service.getSnapshot(SCOPE);

    const companyIn = { in: ["company-1", "company-2"] };

    expect(prisma.executionSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: companyIn } })
    );
    expect(prisma.executionSession.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: companyIn } })
    );
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: companyIn } })
    );
    // Both session counts (open PRs + total) are company-bounded.
    for (const call of prisma.executionSession.count.mock.calls) {
      expect(call[0].where.companyId).toEqual(companyIn);
    }
    expect(prisma.task.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: companyIn }),
      })
    );
    // The task-title lookup is also company-bounded (no cross-company titles).
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: companyIn }),
      })
    );
    // Notifications are per-user, never global.
    expect(prisma.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", read: false } })
    );

    expect(snapshot.recentSessions).toHaveLength(1);
    expect(snapshot.recentSessions[0].companyName).toBe("Acme");
    expect(snapshot.recentSessions[0].taskTitle).toBe("Feature X");
    expect(snapshot.metrics.unreadNotifications).toBe(3);
  });

  it("returns an empty board (and runs no queries) for a caller with no companies", async () => {
    const prisma = makePrisma();
    const service = new BoardService(prisma as unknown as PrismaService);

    const snapshot = await service.getSnapshot({ userId: "user-1", companyIds: [] });

    expect(snapshot.recentSessions).toEqual([]);
    expect(snapshot.companies).toEqual([]);
    expect(snapshot.metrics.totalSessions).toBe(0);
    expect(snapshot.metrics.unreadNotifications).toBe(0);
    expect(prisma.executionSession.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.count).not.toHaveBeenCalled();
  });
});
