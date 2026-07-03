/**
 * Dependency-free line buffering for live agent-output streaming.
 *
 * A child process's stdout/stderr arrives in arbitrary chunks that are NOT
 * aligned to line boundaries: a single newline-terminated line can span two
 * `data` events, and one event can carry many lines plus a partial tail.
 * `createLineEmitter` reassembles those chunks into complete lines so an adapter
 * can surface one live stream event per line — WITHOUT disturbing the full
 * buffered stdout/stderr capture the stdout parsers depend on.
 *
 * It is deliberately pure and framework-free (no Node APIs, no Prisma) so it is
 * the trivially unit-testable core both execution adapters share.
 */

/** A push/flush sink that turns arbitrary chunks into complete newline-split lines. */
export interface LineEmitter {
  /**
   * Feeds a raw chunk, invoking `onLine` for each COMPLETE line it completes.
   * Any trailing partial line is retained across calls until a later `push`
   * completes it or `flush` drains it.
   */
  push(chunk: string): void;
  /** Emits any buffered trailing partial line (with no terminating newline). */
  flush(): void;
}

/**
 * Creates a line emitter that accumulates chunks and calls `onLine` once per
 * complete line, stripping the trailing newline (and a preceding `\r` so CRLF
 * streams don't leave a dangling carriage return). Empty or whitespace-only
 * lines are skipped so blank output produces no noise events.
 *
 * @param onLine - Called with each complete line, newline already removed.
 * @returns A `{ push, flush }` sink; call `flush` once the stream has ended.
 */
export function createLineEmitter(onLine: (line: string) => void): LineEmitter {
  let buffer = "";

  const emitLine = (line: string): void => {
    // Strip a trailing CR (CRLF streams) before deciding emptiness.
    const trimmed = line.replace(/\r$/, "");
    if (trimmed.trim().length === 0) return;
    onLine(trimmed);
  };

  return {
    push(chunk: string): void {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        emitLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
    },
    flush(): void {
      if (buffer.length === 0) return;
      const remainder = buffer;
      buffer = "";
      emitLine(remainder);
    },
  };
}
