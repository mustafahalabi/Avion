import { describe, expect, it } from "vitest";

import { REQUEST_ROUTING } from "@/lib/request-routing";

describe("REQUEST_ROUTING", () => {
  it("routes each request type to its documented owner", () => {
    expect(REQUEST_ROUTING).toEqual({
      feature: "Product Manager",
      bug: "Tech Lead",
      architecture: "CTO",
      security: "Security Lead",
      documentation: "Technical Writer",
      configuration: "DevOps Lead",
      performance: "Tech Lead",
      question: "Company",
    });
  });

  it("routes a feature request to the Product Manager", () => {
    expect(REQUEST_ROUTING.feature).toBe("Product Manager");
  });

  it("routes bug and performance to the same owner (Tech Lead)", () => {
    expect(REQUEST_ROUTING.bug).toBe("Tech Lead");
    expect(REQUEST_ROUTING.performance).toBe("Tech Lead");
    expect(REQUEST_ROUTING.bug).toBe(REQUEST_ROUTING.performance);
  });

  it("escalates architecture decisions to the CTO", () => {
    expect(REQUEST_ROUTING.architecture).toBe("CTO");
  });

  it("routes security to the Security Lead", () => {
    expect(REQUEST_ROUTING.security).toBe("Security Lead");
  });

  it("routes documentation to the Technical Writer", () => {
    expect(REQUEST_ROUTING.documentation).toBe("Technical Writer");
  });

  it("routes configuration to the DevOps Lead", () => {
    expect(REQUEST_ROUTING.configuration).toBe("DevOps Lead");
  });

  it("falls back generic questions to the Company", () => {
    expect(REQUEST_ROUTING.question).toBe("Company");
  });

  it("exposes exactly the eight known request types", () => {
    expect(Object.keys(REQUEST_ROUTING).sort()).toEqual(
      [
        "architecture",
        "bug",
        "configuration",
        "documentation",
        "feature",
        "performance",
        "question",
        "security",
      ].sort()
    );
  });

  it("returns undefined for unknown request types", () => {
    expect(REQUEST_ROUTING["unknown-type"]).toBeUndefined();
    expect(REQUEST_ROUTING[""]).toBeUndefined();
  });

  it("assigns a non-empty string owner to every type", () => {
    for (const owner of Object.values(REQUEST_ROUTING)) {
      expect(typeof owner).toBe("string");
      expect(owner.length).toBeGreaterThan(0);
    }
  });
});
