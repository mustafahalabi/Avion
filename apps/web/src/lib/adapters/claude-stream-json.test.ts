import { describe, expect, it, vi } from "vitest";

import { createClaudeStreamJsonParser, type StreamJsonEvent } from "./claude-stream-json";

function feed(lines: string[]): {
  events: StreamJsonEvent[];
  result: ReturnType<ReturnType<typeof createClaudeStreamJsonParser>["result"]>;
} {
  const events: StreamJsonEvent[] = [];
  const parser = createClaudeStreamJsonParser((e) => events.push(e));
  for (const line of lines) parser.push(line);
  return { events, result: parser.result() };
}

describe("createClaudeStreamJsonParser", () => {
  it("emits text + tool events and reconstructs the final result text", () => {
    const { events, result } = feed([
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Let me edit that." },
            { type: "tool_use", name: "Edit", input: { file_path: "src/a.ts" } },
          ],
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "## Summary\n\nDone.",
        total_cost_usd: 0.2,
        usage: { input_tokens: 10, output_tokens: 3 },
      }),
    ]);

    expect(events).toEqual([
      { type: "text", label: "Let me edit that.", detail: "Let me edit that." },
      { type: "tool", label: "Edit: src/a.ts", detail: null },
    ]);
    expect(result.text).toBe("## Summary\n\nDone.");
    expect(result.sawResult).toBe(true);
    expect(result.isError).toBe(false);
    expect(result.usage?.costUsd).toBe(0.2);
  });

  it("falls back to accumulated assistant text when no result.result is present", () => {
    const { result } = feed([
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "part one" }] },
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "part two" }] },
      }),
    ]);
    expect(result.text).toBe("part one\npart two");
    expect(result.sawResult).toBe(false);
    expect(result.usage).toBeNull();
  });

  it("flags an error result", () => {
    const { result } = feed([
      JSON.stringify({
        type: "result",
        subtype: "error",
        is_error: true,
        result: "boom",
      }),
    ]);
    expect(result.isError).toBe(true);
    expect(result.text).toBe("boom");
  });

  it("surfaces a non-JSON line as a raw event without throwing", () => {
    const { events, result } = feed(["not json at all", ""]);
    expect(events).toEqual([{ type: "raw", label: "not json at all", detail: "not json at all" }]);
    expect(result.sawResult).toBe(false);
  });

  it("never lets a throwing handler break parsing", () => {
    const parser = createClaudeStreamJsonParser(
      vi.fn(() => {
        throw new Error("handler blew up");
      })
    );
    expect(() =>
      parser.push(
        JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "x" }] } })
      )
    ).not.toThrow();
  });
});
