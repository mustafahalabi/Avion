import { describe, expect, it } from "vitest";
import { buildTokenCloneUrl, scrubToken } from "@/lib/repository-clone";

describe("buildTokenCloneUrl", () => {
  it("injects the token into HTTPS GitHub URLs", () => {
    expect(
      buildTokenCloneUrl("https://github.com/acme/widgets", "gho_abc")
    ).toBe("https://gho_abc@github.com/acme/widgets");
  });

  it("leaves the URL untouched when there is no token", () => {
    expect(buildTokenCloneUrl("https://github.com/acme/widgets")).toBe(
      "https://github.com/acme/widgets"
    );
    expect(buildTokenCloneUrl("https://github.com/acme/widgets", null)).toBe(
      "https://github.com/acme/widgets"
    );
  });

  it("does not inject tokens into non-GitHub URLs", () => {
    expect(
      buildTokenCloneUrl("https://gitlab.com/acme/widgets", "gho_abc")
    ).toBe("https://gitlab.com/acme/widgets");
  });
});

describe("scrubToken", () => {
  it("redacts every occurrence of the token", () => {
    const text = "fatal: https://gho_secret@github.com/acme/x — gho_secret denied";
    expect(scrubToken(text, "gho_secret")).toBe(
      "fatal: https://***@github.com/acme/x — *** denied"
    );
  });

  it("returns the text unchanged when there is no token", () => {
    expect(scrubToken("nothing to redact", null)).toBe("nothing to redact");
  });
});
