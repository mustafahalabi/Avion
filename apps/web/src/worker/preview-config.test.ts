import { afterEach, describe, expect, it } from "vitest";
import { isPreviewEnabled } from "./preview-config";

afterEach(() => {
  delete process.env.PREVIEW_DISABLED;
});

describe("isPreviewEnabled", () => {
  it("is on by default (no flag needed)", () => {
    delete process.env.PREVIEW_DISABLED;
    expect(isPreviewEnabled()).toBe(true);
  });

  it("is off only when PREVIEW_DISABLED=true", () => {
    process.env.PREVIEW_DISABLED = "true";
    expect(isPreviewEnabled()).toBe(false);
  });

  it("stays on for any other value", () => {
    process.env.PREVIEW_DISABLED = "false";
    expect(isPreviewEnabled()).toBe(true);
  });
});
