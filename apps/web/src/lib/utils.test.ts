import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("returns an empty string when given no arguments", () => {
    expect(cn()).toBe("");
  });

  it("passes a single class through unchanged", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("joins multiple string arguments with a single space", () => {
    expect(cn("px-2", "py-1", "font-bold")).toBe("px-2 py-1 font-bold");
  });

  it("ignores falsy values (false, null, undefined, empty string, 0)", () => {
    expect(cn("a", false, null, undefined, "", 0, "b")).toBe("a b");
  });

  it("resolves conditional object syntax keeping truthy keys only", () => {
    expect(cn({ active: true, disabled: false, hidden: undefined })).toBe(
      "active"
    );
  });

  it("flattens nested arrays of class values", () => {
    expect(cn(["px-2", ["py-1", "font-bold"]], "text-sm")).toBe(
      "px-2 py-1 font-bold text-sm"
    );
  });

  it("merges conflicting tailwind utilities keeping the last one (twMerge)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges conflicting text colors keeping the last", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("does not merge unrelated utilities", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("applies tailwind merge across conditional inputs", () => {
    const result = cn("p-2", { "p-4": true });
    expect(result).toBe("p-4");
  });

  it("keeps a non-conflicting class when a conditional is false", () => {
    expect(cn("p-2", { "p-4": false })).toBe("p-2");
  });

  it("handles a mix of strings, arrays, and objects together", () => {
    const result = cn(
      "base",
      ["flex", { "items-center": true, "justify-end": false }],
      undefined,
      "gap-2"
    );
    expect(result).toBe("base flex items-center gap-2");
  });

  it("collapses duplicate identical classes via tailwind-merge", () => {
    // twMerge dedupes exact-conflicting utilities; identical repeats collapse.
    expect(cn("block", "block")).toBe("block");
  });

  it("returns empty string when all inputs are falsy", () => {
    expect(cn(false, null, undefined, "", 0)).toBe("");
  });

  it("resolves responsive variants independently of base utility conflicts", () => {
    // base px-2 conflicts with px-4, but md:px-8 is a different variant scope.
    expect(cn("px-2", "px-4", "md:px-8")).toBe("px-4 md:px-8");
  });
});
