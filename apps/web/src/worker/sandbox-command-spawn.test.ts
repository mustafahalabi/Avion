import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DockerSandboxRunner,
  NoneSandboxRunner,
} from "@/lib/adapters/sandbox-runner";
import { createSandboxedCommandSpawn } from "./sandbox-command-spawn";

const mockSpawn = vi.fn();

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => mockSpawn(...args),
  };
});

interface MockChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

describe("createSandboxedCommandSpawn", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("with the none runner, runs /bin/sh -c in the checkout (unchanged behavior)", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const spawn = createSandboxedCommandSpawn(new NoneSandboxRunner());
    const promise = spawn("npm ci", "/co", 5000);

    expect(mockSpawn).toHaveBeenCalledWith(
      "/bin/sh",
      ["-c", "npm ci"],
      expect.objectContaining({ cwd: "/co", stdio: ["ignore", "pipe", "pipe"] })
    );

    child.stdout.write("ok");
    child.emit("close", 0);
    const result = await promise;
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("ok");
    expect(result.timedOut).toBe(false);
  });

  it("with the docker runner, runs the command inside a container", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const spawn = createSandboxedCommandSpawn(
      new DockerSandboxRunner({ image: "img" }, {})
    );
    const promise = spawn("npm run build", "/co", 5000);

    const [command, args, opts] = mockSpawn.mock.calls[0];
    expect(command).toBe("docker");
    expect(args).toContain("/co:/workspace");
    const imageIdx = (args as string[]).indexOf("img");
    expect((args as string[]).slice(imageIdx)).toEqual([
      "img",
      "/bin/sh",
      "-c",
      "npm run build",
    ]);
    // cwd is undefined for docker (the container -w owns the workdir).
    expect((opts as { cwd?: string }).cwd).toBeUndefined();

    child.emit("close", 0);
    await promise;
  });

  it("reports a non-zero exit and captures combined output", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const spawn = createSandboxedCommandSpawn(new NoneSandboxRunner());
    const promise = spawn("false", "/co", 5000);
    child.stderr.write("boom");
    child.emit("close", 1);

    const result = await promise;
    expect(result.exitCode).toBe(1);
    expect(result.output).toBe("boom");
  });

  it("kills the process and flags timeout when it overruns", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const spawn = createSandboxedCommandSpawn(new NoneSandboxRunner());
    const promise = spawn("sleep 100", "/co", 1000);

    vi.advanceTimersByTime(1000);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    child.emit("close", null);

    const result = await promise;
    expect(result.timedOut).toBe(true);
  });
});
