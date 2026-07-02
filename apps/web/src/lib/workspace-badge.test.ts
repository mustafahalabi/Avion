import { describe, expect, it } from "vitest";

import { workspaceBadgeClasses } from "@/lib/workspace-badge";

describe("workspaceBadgeClasses", () => {
  it("is deterministic for the same seed", () => {
    expect(workspaceBadgeClasses("ws-123")).toBe(workspaceBadgeClasses("ws-123"));
  });

  it("returns a non-empty tailwind class string", () => {
    const classes = workspaceBadgeClasses("ws-abc");
    expect(classes).toMatch(/bg-\w+-950/);
    expect(classes).toMatch(/border-\w+-900/);
  });

  it("varies across different seeds (not all identical)", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const distinct = new Set(seeds.map(workspaceBadgeClasses));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
