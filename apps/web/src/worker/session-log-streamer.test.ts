import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appendSessionLogEvents } from "@/lib/agent-stream/session-log-store";
import {
  AGENT_STREAM_MAX_EVENTS_PER_SESSION,
  type AgentStreamEvent,
} from "@/lib/agent-stream/types";

import { createSessionLogStreamer } from "./session-log-streamer";
import { workerLogger } from "./worker-logger";

// The streamer's only side effect is this store call; mock it so the test can
// observe batches without a database and script a rejection.
vi.mock("@/lib/agent-stream/session-log-store", () => ({
  appendSessionLogEvents: vi.fn(async () => {}),
}));

const appendMock = vi.mocked(appendSessionLogEvents);

/** Flattens every event passed to the store across all flush calls. */
function persistedEvents(): AgentStreamEvent[] {
  return appendMock.mock.calls.flatMap((call) => call[2]);
}

beforeEach(() => {
  appendMock.mockReset();
  appendMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createSessionLogStreamer", () => {
  it("assigns a monotonic seq from 1 and flushes the buffered batch", async () => {
    const streamer = createSessionLogStreamer({
      sessionId: "sess-1",
      companyId: "co-1",
    });

    streamer.handler({ type: "status", label: "Agent started", atMs: 0 });
    streamer.handler({ type: "text", label: "Editing file", atMs: 10 });
    streamer.handler({ type: "result", label: "Done", atMs: 20 });

    await streamer.flush();
    await streamer.stop();

    expect(appendMock).toHaveBeenCalledTimes(1);
    const [sessionId, companyId, events] = appendMock.mock.calls[0];
    expect(sessionId).toBe("sess-1");
    expect(companyId).toBe("co-1");
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(events[1]).toMatchObject({ type: "text", label: "Editing file", atMs: 10 });
  });

  it("does not write when nothing was buffered", async () => {
    const streamer = createSessionLogStreamer({ sessionId: "s", companyId: "c" });

    await streamer.flush();
    await streamer.stop();

    expect(appendMock).not.toHaveBeenCalled();
  });

  it("drains the buffer on the periodic timer", async () => {
    vi.useFakeTimers();
    const streamer = createSessionLogStreamer({
      sessionId: "s",
      companyId: "c",
      flushIntervalMs: 750,
    });

    streamer.handler({ type: "text", label: "line", atMs: 5 });
    expect(appendMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(750);

    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock.mock.calls[0][2].map((e) => e.seq)).toEqual([1]);

    await streamer.stop();
  });

  it("coalesces overlapping flushes into a single store write", async () => {
    let resolveWrite: (() => void) | undefined;
    appendMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        })
    );

    const streamer = createSessionLogStreamer({ sessionId: "s", companyId: "c" });
    streamer.handler({ type: "text", label: "a", atMs: 0 });

    const first = streamer.flush();
    const second = streamer.flush(); // in-flight: must not open a second write

    expect(appendMock).toHaveBeenCalledTimes(1);
    resolveWrite?.();
    await Promise.all([first, second]);

    await streamer.stop();
  });

  it("flushes remaining events on stop() even without an explicit flush", async () => {
    const streamer = createSessionLogStreamer({ sessionId: "s", companyId: "c" });

    streamer.handler({ type: "text", label: "tail", atMs: 1 });
    await streamer.stop();

    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(persistedEvents().map((e) => e.seq)).toEqual([1]);
  });

  it("emits one truncation marker at the cap and then drops further events", async () => {
    const streamer = createSessionLogStreamer({ sessionId: "s", companyId: "c" });

    for (let i = 0; i < AGENT_STREAM_MAX_EVENTS_PER_SESSION + 25; i += 1) {
      streamer.handler({ type: "text", label: `line ${i}`, atMs: i });
    }

    await streamer.flush();
    await streamer.stop();

    const events = persistedEvents();
    // cap real events + exactly one synthetic truncation marker
    expect(events).toHaveLength(AGENT_STREAM_MAX_EVENTS_PER_SESSION + 1);
    // seq stays strictly monotonic from 1 across the whole stream
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));

    const marker = events[events.length - 1];
    expect(marker.type).toBe("status");
    expect(marker.label).toContain("truncated");
    expect(marker.seq).toBe(AGENT_STREAM_MAX_EVENTS_PER_SESSION + 1);
  });

  it("never throws out of handler/flush/stop when the store rejects", async () => {
    appendMock.mockRejectedValue(new Error("db unavailable"));
    const errorSpy = vi
      .spyOn(workerLogger, "error")
      .mockImplementation(() => undefined);

    const streamer = createSessionLogStreamer({ sessionId: "s", companyId: "c" });

    expect(() =>
      streamer.handler({ type: "text", label: "x", atMs: 0 })
    ).not.toThrow();
    await expect(streamer.flush()).resolves.toBeUndefined();
    await expect(streamer.stop()).resolves.toBeUndefined();

    // The failed batch is logged and dropped, not retried forever or rethrown.
    expect(errorSpy).toHaveBeenCalled();
  });
});
