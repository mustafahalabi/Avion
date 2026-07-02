import { beforeAll, describe, expect, it } from "vitest";

import {
  createOAuthState,
  generateNonce,
  timingSafeEqualStr,
  verifyOAuthState,
} from "./oauth-state";

const BASE = {
  provider: "github" as const,
  companyId: "cmp_123",
  userId: "usr_123",
  returnTo: "/onboarding",
  nonce: "abc123",
};

beforeAll(() => {
  process.env.OAUTH_STATE_SECRET = "0".repeat(64);
});

describe("createOAuthState / verifyOAuthState", () => {
  it("round-trips a valid token", () => {
    const token = createOAuthState(BASE);
    const payload = verifyOAuthState(token, "github");
    expect(payload).not.toBeNull();
    expect(payload?.companyId).toBe("cmp_123");
    expect(payload?.userId).toBe("usr_123");
    expect(payload?.returnTo).toBe("/onboarding");
    expect(payload?.nonce).toBe("abc123");
  });

  it("rejects an expired token", () => {
    const token = createOAuthState({ ...BASE, exp: Date.now() - 1000 });
    expect(verifyOAuthState(token, "github")).toBeNull();
  });

  it("rejects a provider mismatch", () => {
    const token = createOAuthState(BASE);
    expect(verifyOAuthState(token, "linear")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createOAuthState(BASE);
    const [body, sig] = token.split(".");
    const decoded = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    );
    decoded.companyId = "cmp_evil";
    const forgedBody = Buffer.from(JSON.stringify(decoded), "utf8").toString(
      "base64url"
    );
    expect(verifyOAuthState(`${forgedBody}.${sig}`, "github")).toBeNull();
  });

  it("rejects a tampered (and length-mismatched) signature", () => {
    const token = createOAuthState(BASE);
    const [body] = token.split(".");
    expect(verifyOAuthState(`${body}.deadbeef`, "github")).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyOAuthState("", "github")).toBeNull();
    expect(verifyOAuthState("nodot", "github")).toBeNull();
    expect(verifyOAuthState(".onlysig", "github")).toBeNull();
    expect(verifyOAuthState("onlybody.", "github")).toBeNull();
    expect(verifyOAuthState(null, "github")).toBeNull();
  });
});

describe("timingSafeEqualStr (cookie nonce double-submit)", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqualStr("nonce-xyz", "nonce-xyz")).toBe(true);
  });

  it("returns false for unequal or length-mismatched strings", () => {
    expect(timingSafeEqualStr("nonce-xyz", "nonce-abc")).toBe(false);
    expect(timingSafeEqualStr("short", "longer-value")).toBe(false);
    expect(timingSafeEqualStr("", "x")).toBe(false);
  });
});

describe("generateNonce", () => {
  it("produces distinct 32-char hex nonces", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
