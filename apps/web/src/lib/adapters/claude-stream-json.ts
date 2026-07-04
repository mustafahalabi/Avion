/**
 * Parser for the Claude CLI `--output-format stream-json` event stream (Goal 3).
 *
 * Running the executor with `stream-json --verbose` gives us BOTH a live feed AND
 * real usage: the CLI emits newline-delimited JSON — `system` init/hook events, a
 * series of `assistant` message events (text + tool_use content blocks), and a
 * final `result` event carrying `result` (the assistant's final text),
 * `total_cost_usd`, and a `usage` block. This module folds that stream into:
 *   - live {@link StreamJsonEvent}s (text / tool / raw) for the humanized feed,
 *   - the reconstructed final text (fed to the existing stdout parsers), and
 *   - the real {@link AgentUsage}.
 *
 * Pure and tolerant: a line that is not valid JSON is surfaced as a `raw` event
 * and otherwise ignored, so a stray log line can never break a run.
 */

import { parseClaudeResultUsage, type AgentUsage } from "./agent-usage";

/** A live event distilled from a stream-json line, for the agent-output feed. */
export interface StreamJsonEvent {
  readonly type: "text" | "tool" | "raw";
  readonly label: string;
  readonly detail?: string | null;
}

/** The folded outcome after the stream ends. */
export interface StreamJsonResult {
  /** Reconstructed final assistant text (result.result, else accumulated text). */
  readonly text: string;
  /** Real usage from the final result event, or null when none was seen. */
  readonly usage: AgentUsage | null;
  /** True when the final result event flagged an error. */
  readonly isError: boolean;
  /** Whether a terminal `result` event was observed. */
  readonly sawResult: boolean;
}

/** Describes a tool_use content block as a short human label. */
function describeTool(block: Record<string, unknown>): string {
  const name = typeof block.name === "string" ? block.name : "tool";
  const input = (block.input ?? {}) as Record<string, unknown>;
  const target =
    (typeof input.file_path === "string" && input.file_path) ||
    (typeof input.path === "string" && input.path) ||
    (typeof input.command === "string" && input.command) ||
    (typeof input.pattern === "string" && input.pattern) ||
    "";
  return target ? `${name}: ${target}` : name;
}

/**
 * Creates a stateful fold over a Claude stream-json line stream.
 *
 * @param onEvent - Called for each distilled live event (best-effort feed).
 * @returns `push(line)` to feed one complete JSONL line, and `result()` to read
 *   the folded text/usage once the process closes.
 */
export function createClaudeStreamJsonParser(
  onEvent: (event: StreamJsonEvent) => void
): { push: (line: string) => void; result: () => StreamJsonResult } {
  let accumulatedText = "";
  let finalText: string | null = null;
  let usage: AgentUsage | null = null;
  let isError = false;
  let sawResult = false;

  const emit = (event: StreamJsonEvent): void => {
    try {
      onEvent(event);
    } catch {
      // Best-effort feed — never let a handler break parsing.
    }
  };

  const push = (rawLine: string): void => {
    const line = rawLine.trim();
    if (line.length === 0) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      emit({ type: "raw", label: line, detail: line });
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const event = parsed as Record<string, unknown>;

    if (event.type === "assistant") {
      const message = event.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (Array.isArray(content)) {
        for (const raw of content) {
          if (!raw || typeof raw !== "object") continue;
          const block = raw as Record<string, unknown>;
          if (block.type === "text" && typeof block.text === "string") {
            accumulatedText += (accumulatedText ? "\n" : "") + block.text;
            emit({ type: "text", label: block.text, detail: block.text });
          } else if (block.type === "tool_use") {
            emit({ type: "tool", label: describeTool(block), detail: null });
          }
        }
      }
      return;
    }

    if (event.type === "result") {
      sawResult = true;
      if (typeof event.result === "string") finalText = event.result;
      isError = event.is_error === true;
      const parsedUsage = parseClaudeResultUsage(event);
      if (parsedUsage) usage = parsedUsage;
      return;
    }
    // system / user / other events carry no feed or usage value here.
  };

  const result = (): StreamJsonResult => ({
    text: finalText ?? accumulatedText,
    usage,
    isError,
    sawResult,
  });

  return { push, result };
}
