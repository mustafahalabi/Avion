import { describe, expect, it } from "vitest";

import { isNavItemActive } from "./nav-active";

describe("isNavItemActive", () => {
  it("matches an exact path", () => {
    expect(isNavItemActive("/chat", "/chat")).toBe(true);
    expect(isNavItemActive("/memory", "/timeline")).toBe(false);
  });

  it("matches a nested path", () => {
    expect(isNavItemActive("/chat/abc123", "/chat")).toBe(true);
    expect(isNavItemActive("/work/outcomes/o1", "/work/outcomes")).toBe(true);
  });

  it("does not treat a shared prefix without a boundary as active", () => {
    // "/chatter" must not activate "/chat".
    expect(isNavItemActive("/chatter", "/chat")).toBe(false);
  });

  describe("/work special-casing", () => {
    it("is active for /work and its own detail pages", () => {
      expect(isNavItemActive("/work", "/work")).toBe(true);
      expect(isNavItemActive("/work/tasks/t1", "/work")).toBe(true);
      expect(isNavItemActive("/work/projects", "/work")).toBe(true);
    });

    it("is not active for sibling sections that have their own nav entry", () => {
      for (const sibling of [
        "/work/live",
        "/work/outcomes",
        "/work/quality",
        "/work/releases",
        "/work/workspaces",
        "/work/repositories",
      ]) {
        expect(isNavItemActive(sibling, "/work")).toBe(false);
        expect(isNavItemActive(`${sibling}/detail`, "/work")).toBe(false);
      }
    });

    it("is not active for an unrelated path", () => {
      expect(isNavItemActive("/chat", "/work")).toBe(false);
    });
  });
});
