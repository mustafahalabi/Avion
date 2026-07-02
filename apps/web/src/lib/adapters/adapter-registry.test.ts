import { describe, expect, it } from "vitest";

import { isRunnableAgentType, resolveExecutionAdapter } from "./adapter-registry";
import { ClaudeCodeAdapter } from "./claude-code-adapter";
import { CodexAdapter } from "./codex-adapter";

describe("isRunnableAgentType", () => {
  it("returns true for claude_code", () => {
    expect(isRunnableAgentType("claude_code")).toBe(true);
  });

  it("returns true for codex", () => {
    expect(isRunnableAgentType("codex")).toBe(true);
  });

  it("returns false for human (no CLI adapter by design)", () => {
    expect(isRunnableAgentType("human")).toBe(false);
  });

  it("returns false for unknown values", () => {
    expect(isRunnableAgentType("gpt_engineer")).toBe(false);
    expect(isRunnableAgentType("")).toBe(false);
  });
});

describe("resolveExecutionAdapter", () => {
  it("resolves claude_code to a ClaudeCodeAdapter", () => {
    const adapter = resolveExecutionAdapter("claude_code");
    expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
    expect(adapter.agentType).toBe("claude_code");
  });

  it("resolves codex to a CodexAdapter", () => {
    const adapter = resolveExecutionAdapter("codex");
    expect(adapter).toBeInstanceOf(CodexAdapter);
    expect(adapter.agentType).toBe("codex");
  });

  it("returns a fresh adapter instance per call", () => {
    expect(resolveExecutionAdapter("codex")).not.toBe(resolveExecutionAdapter("codex"));
  });

  it("throws an explicit error for human sessions", () => {
    expect(() => resolveExecutionAdapter("human")).toThrowError(
      'No execution adapter registered for agent type "human". ' +
        "Supported agent types: claude_code, codex."
    );
  });

  it("throws an explicit error naming the unknown agent type", () => {
    expect(() => resolveExecutionAdapter("gpt_engineer")).toThrowError(
      /No execution adapter registered for agent type "gpt_engineer"/
    );
  });
});
