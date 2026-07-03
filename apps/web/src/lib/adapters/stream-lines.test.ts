import { describe, expect, it } from "vitest";

import { createLineEmitter } from "./stream-lines";

/** Drives an emitter over a sequence of chunks and returns the emitted lines. */
function collect(chunks: string[], flush = true): string[] {
  const lines: string[] = [];
  const emitter = createLineEmitter((line) => lines.push(line));
  for (const chunk of chunks) emitter.push(chunk);
  if (flush) emitter.flush();
  return lines;
}

describe("createLineEmitter", () => {
  it("emits one line per newline-terminated line, without the newline", () => {
    expect(collect(["alpha\nbeta\ngamma\n"])).toEqual(["alpha", "beta", "gamma"]);
  });

  it("buffers a partial line across chunks that are not line-aligned", () => {
    // "beta" is split across three pushes; it must only emit once completed.
    const lines: string[] = [];
    const emitter = createLineEmitter((line) => lines.push(line));

    emitter.push("alpha\nbe");
    expect(lines).toEqual(["alpha"]);
    emitter.push("t");
    expect(lines).toEqual(["alpha"]);
    emitter.push("a\ngamma");
    expect(lines).toEqual(["alpha", "beta"]);

    emitter.flush();
    expect(lines).toEqual(["alpha", "beta", "gamma"]);
  });

  it("flush emits a trailing partial line with no terminating newline", () => {
    expect(collect(["only-a-partial"])).toEqual(["only-a-partial"]);
  });

  it("flush emits nothing when the buffer is empty", () => {
    expect(collect(["done\n"])).toEqual(["done"]);
  });

  it("splits multiple lines within a single chunk", () => {
    expect(collect(["a\nb\nc", "\nd\n"])).toEqual(["a", "b", "c", "d"]);
  });

  it("skips empty and whitespace-only lines", () => {
    expect(collect(["a\n\n  \nb\n\t\n"])).toEqual(["a", "b"]);
  });

  it("skips a whitespace-only trailing partial line on flush", () => {
    expect(collect(["a\n   "])).toEqual(["a"]);
  });

  it("strips a trailing carriage return from CRLF streams", () => {
    expect(collect(["a\r\nb\r\n"])).toEqual(["a", "b"]);
  });
});
