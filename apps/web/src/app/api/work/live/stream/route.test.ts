import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route-level coverage for the live SSE stream (MUS-302): the auth gate, the
// notifications-only channel, and the no-company relaxation. The DB is mocked so
// this exercises the route's branching (not the loaders, which are tested
// against real Postgres elsewhere).

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const companyFindFirst = vi.fn();
const notificationFindMany = vi.fn();
const notificationCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findFirst: (...a: unknown[]) => companyFindFirst(...a) },
    notification: {
      findMany: (...a: unknown[]) => notificationFindMany(...a),
      count: (...a: unknown[]) => notificationCount(...a),
    },
  },
}));

import { GET } from "./route";

/** Reads the first SSE frame off a streaming Response, then aborts cleanly. */
async function firstFrame(
  url: string,
  ac: AbortController
): Promise<{ status: number; frame: string }> {
  const res = await GET(new Request(url, { signal: ac.signal }));
  if (!res.body) return { status: res.status, frame: "" };
  const reader = res.body.getReader();
  const { value } = await reader.read();
  const frame = new TextDecoder().decode(value);
  ac.abort(); // stop the recurring tick timer
  await reader.cancel().catch(() => {});
  return { status: res.status, frame };
}

beforeEach(() => {
  mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "u@acme.test" });
  companyFindFirst.mockResolvedValue({ id: "company-1" });
  notificationFindMany.mockResolvedValue([
    {
      id: "n1",
      title: "Decision needed",
      body: null,
      type: "decision",
      priority: "high",
      entityType: "request",
      entityId: "r1",
      actionUrl: "/inbox/requests/r1",
      createdAt: new Date("2026-07-02T12:00:00Z"),
    },
  ]);
  notificationCount.mockResolvedValue(1);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/work/live/stream", () => {
  it("401s an unauthenticated request", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/work/live/stream")
    );
    expect(res.status).toBe(401);
  });

  it("404s the full board when the caller has no company", async () => {
    companyFindFirst.mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/work/live/stream")
    );
    expect(res.status).toBe(404);
  });

  it("streams a notifications-only frame on ?only=notifications", async () => {
    const ac = new AbortController();
    const { status, frame } = await firstFrame(
      "http://localhost/api/work/live/stream?only=notifications",
      ac
    );
    expect(status).toBe(200);
    expect(frame.startsWith("data: ")).toBe(true);
    const payload = JSON.parse(frame.replace(/^data: /, "").trim());
    expect(payload.unreadNotificationCount).toBe(1);
    expect(payload.notifications[0].id).toBe("n1");
    // The board is intentionally absent from the notifications-only channel.
    expect(payload.board).toBeUndefined();
  });

  it("serves notifications even with no company (pre-onboarding)", async () => {
    companyFindFirst.mockResolvedValue(null);
    const ac = new AbortController();
    const { status, frame } = await firstFrame(
      "http://localhost/api/work/live/stream?only=notifications",
      ac
    );
    expect(status).toBe(200);
    const payload = JSON.parse(frame.replace(/^data: /, "").trim());
    expect(payload.notifications[0].id).toBe("n1");
  });
});
