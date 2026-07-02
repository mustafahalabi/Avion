import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    executionSession: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { claimNextSession, releaseSession } from "./session-claimer";

const PREPARED_SESSION = {
  id: "ses-1",
  status: "prepared",
  companyId: "company-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const RUNNING_SESSION = {
  ...PREPARED_SESSION,
  status: "running",
  startedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimNextSession", () => {
  it("claims the oldest prepared session and returns the running row", async () => {
    mockFindFirst
      .mockResolvedValueOnce(PREPARED_SESSION) // initial lookup
      .mockResolvedValueOnce(RUNNING_SESSION); // re-read after claim
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await claimNextSession();

    expect(result).toEqual(RUNNING_SESSION);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
  });

  it("looks up prepared sessions ordered by createdAt ascending", async () => {
    mockFindFirst
      .mockResolvedValueOnce(PREPARED_SESSION)
      .mockResolvedValueOnce(RUNNING_SESSION);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await claimNextSession();

    expect(mockFindFirst).toHaveBeenNthCalledWith(1, {
      where: { status: "prepared" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("applies the companyId filter when provided", async () => {
    mockFindFirst
      .mockResolvedValueOnce(PREPARED_SESSION)
      .mockResolvedValueOnce(RUNNING_SESSION);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await claimNextSession("company-1");

    expect(mockFindFirst).toHaveBeenNthCalledWith(1, {
      where: { status: "prepared", companyId: "company-1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns null when no prepared session is available", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await claimNextSession();

    expect(result).toBeNull();
    // No claim attempt is made when nothing was found.
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it("returns null when the claim loses the race (updateMany count 0)", async () => {
    mockFindFirst.mockResolvedValueOnce(PREPARED_SESSION);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await claimNextSession();

    expect(result).toBeNull();
    // It never re-reads the row because the claim failed.
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it("claims atomically by id and the still-prepared status", async () => {
    mockFindFirst
      .mockResolvedValueOnce(PREPARED_SESSION)
      .mockResolvedValueOnce(RUNNING_SESSION);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await claimNextSession();

    const updateArgs = mockUpdateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "ses-1", status: "prepared" });
    expect(updateArgs.data.status).toBe("running");
    expect(updateArgs.data.startedAt).toBeInstanceOf(Date);
  });

  it("re-reads the claimed session by its id", async () => {
    mockFindFirst
      .mockResolvedValueOnce(PREPARED_SESSION)
      .mockResolvedValueOnce(RUNNING_SESSION);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await claimNextSession();

    expect(mockFindFirst).toHaveBeenNthCalledWith(2, {
      where: { id: "ses-1" },
    });
  });
});

describe("releaseSession", () => {
  it("updates the session to the failed status with the message", async () => {
    mockUpdate.mockResolvedValue({});

    await releaseSession("ses-9", "failed", "worker crashed");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0];
    expect(args.where).toEqual({ id: "ses-9" });
    expect(args.data.status).toBe("failed");
    expect(args.data.errorMessage).toBe("worker crashed");
    expect(args.data.completedAt).toBeInstanceOf(Date);
  });

  it("stores null when no error message is provided", async () => {
    mockUpdate.mockResolvedValue({});

    await releaseSession("ses-10", "failed");

    const args = mockUpdate.mock.calls[0][0];
    expect(args.data.errorMessage).toBeNull();
  });

  it("resolves to void (no return value)", async () => {
    mockUpdate.mockResolvedValue({});

    const result = await releaseSession("ses-11", "failed", "boom");

    expect(result).toBeUndefined();
  });
});
