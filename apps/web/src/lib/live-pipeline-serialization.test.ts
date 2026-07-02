import { describe, expect, it } from "vitest";

import { buildLifecycleBoard, type WorkItemInput } from "./work-lifecycle";
import type { LivePipeline } from "./live-pipeline-data";
import type { TimelineItem } from "@/components/timeline-entry";
import {
  parseLivePipeline,
  serializeLivePipeline,
} from "./live-pipeline-serialization";

const task = (over: Partial<WorkItemInput>): WorkItemInput => ({
  id: "t1",
  title: "Login screen",
  kind: "task",
  href: "/work/tasks/t1",
  updatedAt: new Date("2026-06-30T12:00:00Z"),
  ...over,
});

const streamItem = (over: Partial<TimelineItem> = {}): TimelineItem => ({
  id: "e1",
  type: "executing",
  description: "Agent pushed feat/login",
  contextLabel: "Login",
  contextHref: "/inbox/requests/r1",
  createdAt: new Date("2026-06-30T11:59:00Z"),
  ...over,
});

const pipeline = (): LivePipeline => ({
  board: buildLifecycleBoard([
    task({ id: "a", taskStatus: "in-progress", sessionStatus: "running" }),
    task({ id: "b", taskStatus: "in-review", prStatus: "open", prNumber: 12 }),
    task({ id: "c", taskStatus: "done", prStatus: "merged" }),
  ]),
  stream: [streamItem()],
});

describe("serializeLivePipeline / parseLivePipeline", () => {
  it("round-trips a pipeline, reviving Date fields as real Dates", () => {
    const original = pipeline();
    const revived = parseLivePipeline(serializeLivePipeline(original));

    // Structurally equal (Vitest compares Dates by value).
    expect(revived).toEqual(original);

    const item = revived.board.columns
      .flatMap((c) => c.items)
      .find((i) => i.id === "a")!;
    expect(item.updatedAt).toBeInstanceOf(Date);
    expect(item.updatedAt.getTime()).toBe(
      new Date("2026-06-30T12:00:00Z").getTime()
    );
    expect(revived.stream[0]!.createdAt).toBeInstanceOf(Date);
  });

  it("preserves derived board counts across the wire", () => {
    const revived = parseLivePipeline(serializeLivePipeline(pipeline()));
    expect(revived.board.activeCount).toBe(2); // building + review
    expect(revived.board.liveCount).toBe(1);
    expect(revived.board.stageCounts.done).toBe(1);
  });

  it("is deterministic — identical pipelines serialize identically", () => {
    expect(serializeLivePipeline(pipeline())).toBe(
      serializeLivePipeline(pipeline())
    );
  });

  it("changes the serialization when any item advances a stage", () => {
    const before = serializeLivePipeline(pipeline());
    const after = serializeLivePipeline({
      board: buildLifecycleBoard([
        // task "a" has moved running → in-review (building → review).
        task({ id: "a", taskStatus: "in-review", prStatus: "open" }),
        task({ id: "b", taskStatus: "in-review", prStatus: "open", prNumber: 12 }),
        task({ id: "c", taskStatus: "done", prStatus: "merged" }),
      ]),
      stream: [streamItem()],
    });
    expect(after).not.toBe(before);
  });
});
