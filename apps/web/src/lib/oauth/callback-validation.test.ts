import { beforeAll, describe, expect, it } from "vitest";

import { validateOAuthCallback } from "./callback-validation";
import { createOAuthState } from "./oauth-state";

beforeAll(() => {
  process.env.OAUTH_STATE_SECRET = "0".repeat(64);
});

const SESSION = { sessionCompanyId: "cmp_1", sessionUserId: "usr_1" };

function githubState(overrides?: Partial<{ companyId: string; userId: string; returnTo: string; nonce: string }>) {
  return createOAuthState({
    provider: "github",
    companyId: overrides?.companyId ?? "cmp_1",
    userId: overrides?.userId ?? "usr_1",
    returnTo: overrides?.returnTo ?? "/onboarding",
    nonce: overrides?.nonce ?? "nonce-1",
  });
}

describe("validateOAuthCallback", () => {
  it("accepts a valid flow and re-binds to the live session", () => {
    const result = validateOAuthCallback({
      provider: "github",
      stateToken: githubState(),
      cookieNonce: "nonce-1",
      errorParam: null,
      code: "the-code",
      ...SESSION,
    });
    expect(result).toEqual({
      ok: true,
      returnTo: "/onboarding",
      companyId: "cmp_1",
      userId: "usr_1",
    });
  });

  it("rejects when no live session owns the flow", () => {
    const result = validateOAuthCallback({
      provider: "github",
      stateToken: githubState(),
      cookieNonce: "nonce-1",
      errorParam: null,
      code: "the-code",
      sessionCompanyId: null,
      sessionUserId: null,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "session_required" });
  });

  it("rejects a state whose company is not the authenticated user's", () => {
    const result = validateOAuthCallback({
      provider: "github",
      stateToken: githubState({ companyId: "cmp_evil" }),
      cookieNonce: "nonce-1",
      errorParam: null,
      code: "the-code",
      ...SESSION,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "session_mismatch" });
  });

  it("rejects a cookie-nonce mismatch", () => {
    const result = validateOAuthCallback({
      provider: "github",
      stateToken: githubState({ nonce: "nonce-1" }),
      cookieNonce: "different",
      errorParam: null,
      code: "the-code",
      ...SESSION,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_state" });
  });

  it("rejects a missing/invalid state for a non-Vercel provider", () => {
    const result = validateOAuthCallback({
      provider: "github",
      stateToken: null,
      cookieNonce: "nonce-1",
      errorParam: null,
      code: "the-code",
      ...SESSION,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_state" });
  });

  it("reports missing_code when the state is valid but no code is present", () => {
    const result = validateOAuthCallback({
      provider: "github",
      stateToken: githubState(),
      cookieNonce: "nonce-1",
      errorParam: null,
      code: null,
      ...SESSION,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "missing_code" });
  });

  it("honors a provider error only after verifying nonce", () => {
    const denied = validateOAuthCallback({
      provider: "github",
      stateToken: githubState(),
      cookieNonce: "nonce-1",
      errorParam: "access_denied",
      code: null,
      ...SESSION,
    });
    expect(denied).toMatchObject({ ok: false, errorCode: "access_denied" });

    const forged = validateOAuthCallback({
      provider: "github",
      stateToken: null,
      cookieNonce: null,
      errorParam: "access_denied",
      code: null,
      ...SESSION,
    });
    expect(forged).toMatchObject({ ok: false, errorCode: "invalid_state" });
  });
});
