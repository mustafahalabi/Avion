import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock prisma (only notification.create is used) ─────────────────────────────

const mockNotificationCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockNotificationCreate(...args),
    },
  },
}));

import { notify, notifyInTx } from "./notify";

beforeEach(() => {
  vi.clearAllMocks();
  mockNotificationCreate.mockResolvedValue({ id: "notif-1" });
});

describe("notify", () => {
  it("creates a notification with all fields passed through", async () => {
    await notify({
      userId: "user-1",
      companyId: "company-1",
      title: "Deploy succeeded",
      body: "v1.2.3 is live",
      type: "progress",
      priority: "high",
      entityType: "release",
      entityId: "rel-9",
      actionUrl: "/releases/rel-9",
    });

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        companyId: "company-1",
        title: "Deploy succeeded",
        body: "v1.2.3 is live",
        type: "progress",
        priority: "high",
        entityType: "release",
        entityId: "rel-9",
        actionUrl: "/releases/rel-9",
      },
    });
  });

  it("defaults type to 'info' and priority to 'medium' when omitted", async () => {
    await notify({ userId: "user-1", title: "Hello" });

    const payload = mockNotificationCreate.mock.calls[0][0].data;
    expect(payload.type).toBe("info");
    expect(payload.priority).toBe("medium");
  });

  it("passes optional fields through as undefined when not provided", async () => {
    await notify({ userId: "user-1", title: "Hello" });

    const payload = mockNotificationCreate.mock.calls[0][0].data;
    expect(payload.companyId).toBeUndefined();
    expect(payload.body).toBeUndefined();
    expect(payload.entityType).toBeUndefined();
    expect(payload.entityId).toBeUndefined();
    expect(payload.actionUrl).toBeUndefined();
  });

  it("honors an explicit type and priority instead of defaults", async () => {
    await notify({
      userId: "user-1",
      title: "Blocked",
      type: "blocker",
      priority: "urgent",
    });

    const payload = mockNotificationCreate.mock.calls[0][0].data;
    expect(payload.type).toBe("blocker");
    expect(payload.priority).toBe("urgent");
  });

  it("returns the created notification record", async () => {
    mockNotificationCreate.mockResolvedValue({ id: "notif-42" });

    const result = await notify({ userId: "user-1", title: "Hi" });

    expect(result).toEqual({ id: "notif-42" });
  });

  it("always maps userId and title verbatim", async () => {
    await notify({ userId: "u-xyz", title: "Specific title" });

    const payload = mockNotificationCreate.mock.calls[0][0].data;
    expect(payload.userId).toBe("u-xyz");
    expect(payload.title).toBe("Specific title");
  });
});

describe("notifyInTx", () => {
  function makeTx() {
    const create = vi.fn().mockResolvedValue({ id: "tx-notif-1" });
    const tx = { notification: { create: (...a: unknown[]) => create(...a) } };
    return { tx, create };
  }

  it("writes through the provided tx client, not the global prisma client", async () => {
    const { tx, create } = makeTx();

    await notifyInTx(tx as Parameters<typeof notifyInTx>[0], {
      userId: "user-1",
      title: "In transaction",
    });

    expect(create).toHaveBeenCalledTimes(1);
    // The global prisma.notification.create must never be touched.
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("applies the same defaults inside a transaction", async () => {
    const { tx, create } = makeTx();

    await notifyInTx(tx as Parameters<typeof notifyInTx>[0], {
      userId: "user-1",
      title: "In transaction",
    });

    const payload = create.mock.calls[0][0].data;
    expect(payload.type).toBe("info");
    expect(payload.priority).toBe("medium");
  });

  it("forwards the full payload to the tx client", async () => {
    const { tx, create } = makeTx();

    await notifyInTx(tx as Parameters<typeof notifyInTx>[0], {
      userId: "user-2",
      companyId: "company-2",
      title: "Decision needed",
      body: "Pick an approach",
      type: "decision",
      priority: "low",
      entityType: "task",
      entityId: "task-7",
      actionUrl: "/tasks/task-7",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        companyId: "company-2",
        title: "Decision needed",
        body: "Pick an approach",
        type: "decision",
        priority: "low",
        entityType: "task",
        entityId: "task-7",
        actionUrl: "/tasks/task-7",
      },
    });
  });

  it("returns the record created by the tx client", async () => {
    const { tx } = makeTx();

    const result = await notifyInTx(tx as Parameters<typeof notifyInTx>[0], {
      userId: "user-1",
      title: "Hi",
    });

    expect(result).toEqual({ id: "tx-notif-1" });
  });
});
