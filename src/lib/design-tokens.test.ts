import { describe, expect, it } from "vitest";

import {
  BRAND,
  getPriorityBadgeClasses,
  getPriorityColor,
  getStatusBadgeClasses,
  getStatusColor,
  PRIORITY_BG_COLORS,
  PRIORITY_COLORS,
  RADIUS,
  SHADOW,
  STATUS_BG_COLORS,
  STATUS_COLORS,
  SURFACE,
} from "@/lib/design-tokens";

describe("getStatusColor", () => {
  it("returns the mapped color for every known status key", () => {
    for (const key of Object.keys(STATUS_COLORS) as Array<
      keyof typeof STATUS_COLORS
    >) {
      expect(getStatusColor(key)).toBe(STATUS_COLORS[key]);
    }
  });

  it("normalizes casing", () => {
    expect(getStatusColor("DONE")).toBe(STATUS_COLORS.done);
    expect(getStatusColor("In_Progress")).toBe(STATUS_COLORS.in_progress);
  });

  it("normalizes spaces to underscores", () => {
    expect(getStatusColor("in progress")).toBe(STATUS_COLORS.in_progress);
    expect(getStatusColor("In Review")).toBe(STATUS_COLORS.in_review);
  });

  it("collapses multiple spaces into single underscores", () => {
    expect(getStatusColor("in   review")).toBe(STATUS_COLORS.in_review);
  });

  it("falls back to muted foreground for unknown statuses", () => {
    expect(getStatusColor("nonsense")).toBe("text-muted-foreground");
    expect(getStatusColor("")).toBe("text-muted-foreground");
  });
});

describe("getStatusBadgeClasses", () => {
  it("returns combined badge classes for every known status", () => {
    for (const key of Object.keys(STATUS_BG_COLORS) as Array<
      keyof typeof STATUS_BG_COLORS
    >) {
      expect(getStatusBadgeClasses(key)).toBe(STATUS_BG_COLORS[key]);
    }
  });

  it("normalizes spaces and casing", () => {
    expect(getStatusBadgeClasses("In Progress")).toBe(
      STATUS_BG_COLORS.in_progress
    );
  });

  it("falls back to the 'todo' badge for unknown statuses", () => {
    expect(getStatusBadgeClasses("nope")).toBe(STATUS_BG_COLORS.todo);
    expect(getStatusBadgeClasses("")).toBe(STATUS_BG_COLORS.todo);
  });

  it("returns classes containing bg, text and border utilities", () => {
    const classes = getStatusBadgeClasses("done");
    expect(classes).toMatch(/\bbg-/);
    expect(classes).toMatch(/\btext-/);
    expect(classes).toMatch(/\bborder-/);
  });
});

describe("getPriorityColor", () => {
  it("returns the mapped color for every known priority", () => {
    for (const key of Object.keys(PRIORITY_COLORS) as Array<
      keyof typeof PRIORITY_COLORS
    >) {
      expect(getPriorityColor(key)).toBe(PRIORITY_COLORS[key]);
    }
  });

  it("normalizes casing", () => {
    expect(getPriorityColor("URGENT")).toBe(PRIORITY_COLORS.urgent);
    expect(getPriorityColor("High")).toBe(PRIORITY_COLORS.high);
  });

  it("does not transform spaces (priority labels are single words)", () => {
    // Unlike statuses, getPriorityColor only lowercases — a spaced input is unknown.
    expect(getPriorityColor("very high")).toBe("text-muted-foreground");
  });

  it("falls back to muted foreground for unknown priorities", () => {
    expect(getPriorityColor("critical")).toBe("text-muted-foreground");
    expect(getPriorityColor("")).toBe("text-muted-foreground");
  });

  it("maps low and none to the same muted color", () => {
    expect(getPriorityColor("low")).toBe(getPriorityColor("none"));
  });
});

describe("getPriorityBadgeClasses", () => {
  it("returns combined badge classes for every known priority", () => {
    for (const key of Object.keys(PRIORITY_BG_COLORS) as Array<
      keyof typeof PRIORITY_BG_COLORS
    >) {
      expect(getPriorityBadgeClasses(key)).toBe(PRIORITY_BG_COLORS[key]);
    }
  });

  it("normalizes casing", () => {
    expect(getPriorityBadgeClasses("Medium")).toBe(PRIORITY_BG_COLORS.medium);
  });

  it("falls back to the 'none' badge for unknown priorities", () => {
    expect(getPriorityBadgeClasses("whatever")).toBe(PRIORITY_BG_COLORS.none);
    expect(getPriorityBadgeClasses("")).toBe(PRIORITY_BG_COLORS.none);
  });

  it("returns classes containing bg, text and border utilities", () => {
    const classes = getPriorityBadgeClasses("urgent");
    expect(classes).toMatch(/\bbg-/);
    expect(classes).toMatch(/\btext-/);
    expect(classes).toMatch(/\bborder-/);
  });
});

describe("token maps", () => {
  it("STATUS_COLORS and STATUS_BG_COLORS share the same keys", () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual(
      Object.keys(STATUS_BG_COLORS).sort()
    );
  });

  it("PRIORITY_COLORS and PRIORITY_BG_COLORS share the same keys", () => {
    expect(Object.keys(PRIORITY_COLORS).sort()).toEqual(
      Object.keys(PRIORITY_BG_COLORS).sort()
    );
  });

  it("exposes the three surface elevation levels", () => {
    expect(SURFACE).toEqual({
      base: "bg-surface-base",
      raised: "bg-surface-raised",
      overlay: "bg-surface-overlay",
    });
  });

  it("exposes brand accent tokens", () => {
    expect(BRAND.text).toBe("text-brand-500");
    expect(BRAND.bgHover).toBe("hover:bg-brand-600");
    expect(BRAND.ring).toBe("ring-brand-500");
  });

  it("exposes radius and shadow tokens", () => {
    expect(RADIUS).toEqual({
      card: "rounded-card",
      badge: "rounded-badge",
      chip: "rounded-chip",
    });
    expect(SHADOW).toEqual({
      card: "shadow-card",
      elevated: "shadow-elevated",
    });
  });
});
