import { describe, expect, it } from "vitest";

import { DEFAULT_RETURN_TO, sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("passes through allowlisted relative paths (with query)", () => {
    expect(sanitizeReturnTo("/onboarding?step=2")).toBe("/onboarding?step=2");
    expect(sanitizeReturnTo("/integrations")).toBe("/integrations");
    expect(sanitizeReturnTo("/connections")).toBe("/connections");
    expect(sanitizeReturnTo("/work/repositories/new")).toBe(
      "/work/repositories/new"
    );
  });

  it("falls back to the default for missing input", () => {
    expect(sanitizeReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("")).toBe(DEFAULT_RETURN_TO);
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(sanitizeReturnTo("//evil.com")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("https://evil.com")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("http://evil.com")).toBe(DEFAULT_RETURN_TO);
  });

  it("rejects backslash and encoded-slash tricks", () => {
    expect(sanitizeReturnTo("/\\evil.com")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("/%2F%2Fevil.com")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("%2F%2Fevil.com")).toBe(DEFAULT_RETURN_TO);
  });

  it("rejects scheme-bearing and control-character payloads", () => {
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("/\tjavascript:alert(1)")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("/onboarding\nSet-Cookie:x")).toBe(
      DEFAULT_RETURN_TO
    );
  });

  it("rejects off-allowlist relative paths", () => {
    expect(sanitizeReturnTo("/admin")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("/")).toBe(DEFAULT_RETURN_TO);
    // A path that only shares a prefix string but not a segment boundary.
    expect(sanitizeReturnTo("/workshop")).toBe(DEFAULT_RETURN_TO);
  });
});
