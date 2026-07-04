import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "./prisma";
import type * as SteeringModule from "./mid-flight-steering";
// Pure module (no Prisma) — safe to import statically without loading the DB
// singleton before setupTestSchema re-scopes it.
import { selectSteerableTask } from "./mid-flight-steering-select";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

const at = (iso: string) => new Date(iso);

describe("selectSteerableTask (pure)", () => {
  it("prefers the most in-flight task, tie-broken by recency", () => {
    const chosen = selectSteerableTask([
      { id: "t1", title: "todo one", status: "todo", updatedAt: at("2026-07-04T10:00:00Z") },
      { id: "t2", title: "building", status: "in-progress", updatedAt: at("2026-07-04T09:00:00Z") },
      { id: "t3", title: "reviewing", status: "in-review", updatedAt: at("2026-07-04T11:00:00Z") },
    ]);
    expect(chosen?.id).toBe("t2"); // in-progress beats in-review/todo
  });

  it("tie-breaks same-status tasks by most recently updated", () => {
    const chosen = selectSteerableTask([
      { id: "a", title: "a", status: "in-progress", updatedAt: at("2026-07-04T09:00:00Z") },
      { id: "b", title: "b", status: "in-progress", updatedAt: at("2026-07-04T12:00:00Z") },
    ]);
    expect(chosen?.id).toBe("b");
  });

  it("never steers done/cancelled/blocked work (respects the resurrection guard)", () => {
    expect(
      selectSteerableTask([
        { id: "d", title: "done", status: "done", updatedAt: at("2026-07-04T12:00:00Z") },
        { id: "c", title: "cancelled", status: "cancelled", updatedAt: at("2026-07-04T12:00:00Z") },
        { id: "x", title: "blocked", status: "blocked", updatedAt: at("2026-07-04T12:00:00Z") },
      ])
    ).toBeNull();
  });

  it("returns null when there are no tasks", () => {
    expect(selectSteerableTask([])).toBeNull();
  });
});

describe("routeSteeringToInFlightWork (integration)", () => {
  let prisma: typeof PrismaSingleton;
  let schema: string;
  let steering: typeof SteeringModule;

  beforeAll(async () => {
    ({ prisma, schema } = await setupTestSchema("mid-flight-steering"));
    steering = await import("./mid-flight-steering");
    await prisma.user.create({ data: { id: "user-1", email: "o@acme.test" } });
    await prisma.company.create({
      data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
    });
  });

  afterEach(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "ChangeRequest"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Review"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEntry"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Outcome"`);
  });

  afterAll(async () => {
    await teardownTestSchema(prisma, schema);
  });

  async function seedOutcomeWithTask(status: string) {
    const outcome = await prisma.outcome.create({
      data: { companyId: "company-1", title: "Login", rawRequest: "add login", status: "in_delivery" },
    });
    const task = await prisma.task.create({
      data: { companyId: "company-1", title: "Build login", status, outcomeId: outcome.id },
    });
    return { outcomeId: outcome.id, taskId: task.id };
  }

  it("opens a steering change request on the active task", async () => {
    const { outcomeId, taskId } = await seedOutcomeWithTask("in-progress");

    const result = await steering.routeSteeringToInFlightWork({
      companyId: "company-1",
      outcomeId,
      content: "Make the button blue instead",
      actorId: "user-1",
    });

    expect(result.steered).toBe(true);
    expect(result.taskId).toBe(taskId);

    const openCrs = await prisma.changeRequest.count({
      where: { resolved: false, review: { entityId: taskId } },
    });
    expect(openCrs).toBe(1);
  });

  it("does NOT steer when only done work exists", async () => {
    const { outcomeId } = await seedOutcomeWithTask("done");
    const result = await steering.routeSteeringToInFlightWork({
      companyId: "company-1",
      outcomeId,
      content: "change it",
      actorId: "user-1",
    });
    expect(result.steered).toBe(false);
    const crs = await prisma.changeRequest.count({ where: {} });
    expect(crs).toBe(0);
  });

  it("dedups — a second steer does not open a second open change request", async () => {
    const { outcomeId, taskId } = await seedOutcomeWithTask("in-progress");
    await steering.routeSteeringToInFlightWork({
      companyId: "company-1",
      outcomeId,
      content: "first steer",
      actorId: "user-1",
    });
    await steering.routeSteeringToInFlightWork({
      companyId: "company-1",
      outcomeId,
      content: "second steer",
      actorId: "user-1",
    });

    const openCrs = await prisma.changeRequest.count({
      where: { resolved: false, review: { entityId: taskId } },
    });
    expect(openCrs).toBe(1);
  });
});
