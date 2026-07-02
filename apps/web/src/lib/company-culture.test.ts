import { describe, expect, it } from "vitest";

import { getCultureGuidance } from "./company-culture";

describe("getCultureGuidance", () => {
  it("returns guidance for each configured culture", () => {
    for (const culture of [
      "startup",
      "enterprise",
      "design-first",
      "performance-first",
    ]) {
      const guidance = getCultureGuidance(culture);
      expect(guidance).not.toBeNull();
      expect(guidance?.value).toBe(culture);
      expect(guidance?.label.length).toBeGreaterThan(0);
      expect(guidance?.directives.length).toBeGreaterThan(0);
    }
  });

  it("gives materially different directives per culture", () => {
    const enterprise = getCultureGuidance("enterprise")?.directives.join(" ") ?? "";
    const design = getCultureGuidance("design-first")?.directives.join(" ") ?? "";
    expect(enterprise).not.toBe(design);
    expect(enterprise.toLowerCase()).toMatch(/valid|security|authoriz/);
    expect(design.toLowerCase()).toMatch(/a11y|accessib|ux|design/);
  });

  it("returns null for unset or unrecognized cultures", () => {
    expect(getCultureGuidance(null)).toBeNull();
    expect(getCultureGuidance(undefined)).toBeNull();
    expect(getCultureGuidance("")).toBeNull();
    expect(getCultureGuidance("not-a-culture")).toBeNull();
  });
});
