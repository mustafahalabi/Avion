import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/worker/worker-logger", () => ({
  workerLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/worker/preview-config", () => ({
  PREVIEW_CONFIG: {
    PREVIEW_HOST: "127.0.0.1",
    PREVIEW_BASE_DIR: "/tmp/eos-preview-test",
    PREVIEW_INSTALL_TIMEOUT_SECONDS: 60,
    PREVIEW_PORT_RANGE_START: 4100,
    PREVIEW_PORT_RANGE_END: 4199,
    PREVIEW_LOG_MAX_CHARS: 200_000,
    PREVIEW_STOP_GRACE_MS: 10,
    PREVIEW_MAX_LIFETIME_SECONDS: 3600,
    PREVIEW_MAX_CONCURRENT: 1,
  },
}));

const mockDb = vi.hoisted(() => ({
  finalizePreview: vi.fn().mockResolvedValue({}),
  markPreviewInstalling: vi.fn().mockResolvedValue({}),
  markPreviewRunning: vi.fn().mockResolvedValue({}),
  markPreviewStopping: vi.fn().mockResolvedValue({}),
  setPreviewLogs: vi.fn().mockResolvedValue({}),
  loadPreviewSession: vi.fn().mockResolvedValue({ desiredState: "running", expiresAt: null }),
  killProcessGroup: vi.fn().mockReturnValue(true),
  truncatePreviewLogs: (logs: string) => logs,
  loadRepositoryForPreview: vi.fn(),
  occupiedPorts: vi.fn().mockResolvedValue(new Set()),
}));
vi.mock("@/lib/preview/preview-service-db", () => mockDb);

import {
  startPreview,
  stopPreview,
  type PreviewRegistry,
  type ActivePreview,
} from "./preview-runner";

// ─── Fakes ────────────────────────────────────────────────────────────────────

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  pid = 4242;
  exitCode: number | null = null;
  kill = vi.fn();
}

const SESSION = {
  id: "prev-1",
  companyId: "co-1",
  repositoryId: "repo-1",
  envVars: null,
} as never;

function makeDeps(overrides: Record<string, unknown> = {}) {
  const child = new FakeChild();
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const deps = {
    loadRepo: vi.fn().mockResolvedValue({ url: "https://github.com/a/b", credentials: null }),
    checkout: vi.fn().mockResolvedValue({ path: "/tmp/co", branch: "main", baseCommitSha: "sha", cleanup }),
    resolve: vi.fn().mockReturnValue({ ok: true, command: "pnpm dev", packageManager: "pnpm", scriptKey: "dev", framework: "next" }),
    install: vi.fn().mockResolvedValue({ attempted: true, ok: true, command: "pnpm install", summary: "installed", output: "" }),
    getOccupiedPorts: vi.fn().mockResolvedValue(new Set()),
    allocatePort: vi.fn().mockResolvedValue(4100),
    spawn: vi.fn().mockReturnValue(child),
    ...overrides,
  };
  return { deps, child, cleanup };
}

const tick = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.loadPreviewSession.mockResolvedValue({ desiredState: "running", expiresAt: null });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("startPreview", () => {
  it("runs the happy path and registers a running preview", async () => {
    const registry: PreviewRegistry = new Map();
    const { deps, child } = makeDeps();

    await startPreview({ session: SESSION, registry, deps });

    expect(registry.has("prev-1")).toBe(true);
    expect(mockDb.markPreviewInstalling).toHaveBeenCalledWith("prev-1", {
      branch: "main",
      packageManager: "pnpm",
    });
    // Next.js framework → port forwarded via -p, appended to the command.
    expect(deps.spawn).toHaveBeenCalledWith(
      "pnpm dev -- -p 4100 -H 127.0.0.1",
      expect.objectContaining({ cwd: "/tmp/co" })
    );
    expect(mockDb.markPreviewRunning).toHaveBeenCalledWith("prev-1", {
      pid: 4242,
      port: 4100,
      previewUrl: "http://127.0.0.1:4100",
      command: "pnpm dev -- -p 4100 -H 127.0.0.1",
    });

    // stdout streams into the buffer.
    child.stdout.emit("data", Buffer.from("ready on 4100"));
    const active = registry.get("prev-1") as ActivePreview;
    expect(active.getLogs()).toContain("ready on 4100");
  });

  it("marks failed and cleans up when there is no dev script", async () => {
    const registry: PreviewRegistry = new Map();
    const { deps, cleanup } = makeDeps({
      resolve: vi.fn().mockReturnValue({ ok: false, error: "No dev script" }),
    });

    await startPreview({ session: SESSION, registry, deps });

    expect(deps.spawn).not.toHaveBeenCalled();
    expect(mockDb.finalizePreview).toHaveBeenCalledWith("prev-1", "failed", { errorMessage: "No dev script" });
    expect(cleanup).toHaveBeenCalled();
    expect(registry.has("prev-1")).toBe(false);
  });

  it("marks failed when the clone throws", async () => {
    const registry: PreviewRegistry = new Map();
    const { deps } = makeDeps({
      checkout: vi.fn().mockRejectedValue(new Error("auth denied")),
    });

    await startPreview({ session: SESSION, registry, deps });

    expect(mockDb.finalizePreview).toHaveBeenCalledWith(
      "prev-1",
      "failed",
      expect.objectContaining({ errorMessage: expect.stringContaining("auth denied") })
    );
  });

  it("marks failed when dependency install fails", async () => {
    const registry: PreviewRegistry = new Map();
    const { deps } = makeDeps({
      install: vi.fn().mockResolvedValue({ attempted: true, ok: false, command: "pnpm install", summary: "install failed", output: "boom" }),
    });

    await startPreview({ session: SESSION, registry, deps });

    expect(deps.spawn).not.toHaveBeenCalled();
    expect(mockDb.finalizePreview).toHaveBeenCalledWith(
      "prev-1",
      "failed",
      expect.objectContaining({ errorMessage: "install failed" })
    );
  });

  it("aborts before spawn when Stop is requested during install", async () => {
    const registry: PreviewRegistry = new Map();
    mockDb.loadPreviewSession.mockResolvedValue({ desiredState: "stopped", expiresAt: null });
    const { deps } = makeDeps();

    await startPreview({ session: SESSION, registry, deps });

    expect(deps.spawn).not.toHaveBeenCalled();
    expect(mockDb.finalizePreview).toHaveBeenCalledWith(
      "prev-1",
      "stopped",
      expect.objectContaining({ errorMessage: expect.stringContaining("Stopped before") })
    );
  });

  it("finalizes as crashed when the child exits unexpectedly", async () => {
    const registry: PreviewRegistry = new Map();
    const { deps, child } = makeDeps();
    await startPreview({ session: SESSION, registry, deps });

    child.exitCode = 1;
    child.emit("exit", 1, null);
    await tick();

    expect(mockDb.finalizePreview).toHaveBeenCalledWith(
      "prev-1",
      "crashed",
      expect.objectContaining({ errorMessage: expect.stringContaining("exited unexpectedly") })
    );
    expect(registry.has("prev-1")).toBe(false);
  });
});

describe("stopPreview", () => {
  it("SIGTERMs the group and finalizes as stopped on exit", async () => {
    const registry: PreviewRegistry = new Map();
    const { deps, child } = makeDeps();
    await startPreview({ session: SESSION, registry, deps });

    const active = registry.get("prev-1") as ActivePreview;
    await stopPreview(active, { reason: "Stopped by request.", terminalStatus: "stopped" });

    expect(mockDb.markPreviewStopping).toHaveBeenCalledWith("prev-1");
    expect(mockDb.killProcessGroup).toHaveBeenCalledWith(4242, "SIGTERM");

    // The child then exits from the signal → finalize as the requested status.
    child.exitCode = 0;
    child.emit("exit", 0, "SIGTERM");
    await tick();

    expect(mockDb.finalizePreview).toHaveBeenCalledWith(
      "prev-1",
      "stopped",
      expect.objectContaining({ errorMessage: "Stopped by request." })
    );
  });
});
