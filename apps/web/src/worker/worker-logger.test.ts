import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workerLogger } from "./worker-logger";

let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Swallow real writes and capture the arguments instead.
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

/** Extracts the single string argument passed to a write spy. */
function lastWrite(spy: ReturnType<typeof vi.spyOn>): string {
  const call = spy.mock.calls.at(-1);
  expect(call).toBeDefined();
  return String((call as unknown[])[0]);
}

describe("workerLogger.info", () => {
  it("writes to stdout, not stderr", () => {
    workerLogger.info("hello world");

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("includes the INFO level and the message", () => {
    workerLogger.info("booting worker");

    const line = lastWrite(stdoutSpy);
    expect(line).toContain("[INFO]");
    expect(line).toContain("booting worker");
  });

  it("terminates the line with a newline", () => {
    workerLogger.info("with newline");

    expect(lastWrite(stdoutSpy).endsWith("\n")).toBe(true);
  });

  it("prefixes the line with a bracketed timestamp", () => {
    workerLogger.info("timestamped");

    // Format: [YYYY-MM-DD HH:MM:SS] [INFO]  message
    expect(lastWrite(stdoutSpy)).toMatch(
      /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\]/
    );
  });
});

describe("workerLogger.warn", () => {
  it("writes warnings to stdout with the WARN level", () => {
    workerLogger.warn("careful now");

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();
    const line = lastWrite(stdoutSpy);
    expect(line).toContain("[WARN]");
    expect(line).toContain("careful now");
  });
});

describe("workerLogger.error", () => {
  it("writes errors to stderr, not stdout", () => {
    workerLogger.error("kaboom");

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("includes the ERROR level and the message", () => {
    workerLogger.error("disk full");

    const line = lastWrite(stderrSpy);
    expect(line).toContain("[ERROR]");
    expect(line).toContain("disk full");
    expect(line.endsWith("\n")).toBe(true);
  });
});

describe("stream routing across levels", () => {
  it("routes INFO/WARN to stdout and ERROR to stderr independently", () => {
    workerLogger.info("i");
    workerLogger.warn("w");
    workerLogger.error("e");

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(lastWrite(stderrSpy)).toContain("[ERROR]");
  });

  it("handles an empty message without throwing", () => {
    expect(() => workerLogger.info("")).not.toThrow();
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(lastWrite(stdoutSpy)).toContain("[INFO]");
  });
});
