import { Injectable } from "@nestjs/common";
import {
  ACTIVE_STATUSES,
  type BoardSnapshot,
  type SessionSummary,
  type StatusCount,
} from "@avion/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the full board state from the live database in a handful of batched
   * queries. Read-only; safe to call on every poll tick.
   */
  async getSnapshot(limit = 12): Promise<BoardSnapshot> {
    const [
      sessions,
      statusGroups,
      companies,
      openPullRequests,
      tasksInProgress,
      unreadNotifications,
      totalSessions,
    ] = await Promise.all([
      this.prisma.executionSession.findMany({
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      this.prisma.executionSession.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.company.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.executionSession.count({ where: { prStatus: "open" } }),
      this.prisma.task.count({
        where: { status: { in: ["in-progress", "in_progress", "in-review", "in_review"] } },
      }),
      this.prisma.notification.count({ where: { read: false } }),
      this.prisma.executionSession.count(),
    ]);

    const companyNameById = new Map(companies.map((c) => [c.id, c.name]));

    // Resolve task titles for the session feed in one batched lookup.
    const taskIds = sessions
      .map((s) => s.taskId)
      .filter((id): id is string => Boolean(id));
    const tasks = taskIds.length
      ? await this.prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true },
        })
      : [];
    const taskTitleById = new Map(tasks.map((t) => [t.id, t.title]));

    const recentSessions: SessionSummary[] = sessions.map((s) => ({
      id: s.id,
      companyId: s.companyId,
      companyName: companyNameById.get(s.companyId) ?? null,
      status: s.status,
      agentType: s.agentType,
      taskTitle: s.taskId ? taskTitleById.get(s.taskId) ?? null : null,
      prUrl: s.prUrl,
      prNumber: s.prNumber,
      prStatus: s.prStatus,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    const statusCounts: StatusCount[] = statusGroups
      .map((g) => ({ status: g.status, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    const sumStatuses = (statuses: readonly string[]): number =>
      statusCounts
        .filter((s) => statuses.includes(s.status))
        .reduce((sum, s) => sum + s.count, 0);

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        totalSessions,
        activeSessions: sumStatuses(ACTIVE_STATUSES),
        completedSessions: sumStatuses(["completed"]),
        failedSessions: sumStatuses(["failed"]),
        openPullRequests,
        tasksInProgress,
        unreadNotifications,
      },
      statusCounts,
      recentSessions,
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  async getSessions(limit = 20): Promise<SessionSummary[]> {
    const snapshot = await this.getSnapshot(limit);
    return snapshot.recentSessions;
  }
}
