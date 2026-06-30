import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Provider } from "@/lib/provider-connection-service";

/**
 * Stateless, HMAC-signed CSRF state for the OAuth round-trip.
 *
 * There is no server-side session store, so the OAuth `state` is a signed,
 * self-contained token: `base64url(JSON payload) + "." + base64url(HMAC-SHA256)`.
 * The signature guarantees integrity (no tampering with companyId/returnTo); a
 * companion per-provider nonce cookie (double-submit) binds the callback to the
 * browser that started the flow. The `returnTo` lives INSIDE the signed payload
 * so it can't be swapped at callback time.
 *
 * The signing key is a DEDICATED `OAUTH_STATE_SECRET` — never the
 * `CREDENTIALS_ENCRYPTION_KEY` (which protects stored access tokens at rest).
 * Keeping them separate avoids coupling an encryption key with a public-facing
 * MAC oracle.
 *
 * Pure (aside from reading env + crypto) — safe to unit-test.
 */

/** Lifetime of a state token; mirrors the nonce cookie maxAge. */
export const STATE_TTL_MS = 600_000; // 10 minutes

export interface OAuthStatePayload {
  provider: Provider;
  companyId: string;
  userId: string;
  /** Sanitized relative redirect target for after the callback. */
  returnTo: string;
  /** Random value also stored in an httpOnly cookie for double-submit CSRF. */
  nonce: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
}

/**
 * Reads and validates the dedicated OAuth state signing secret.
 * Mirrors the validation style of `credentials-crypto.ts#getKey`.
 */
function getStateSecret(): Buffer {
  const hex = process.env.OAUTH_STATE_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "OAUTH_STATE_SECRET must be set to a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"require('crypto').randomBytes(32).toString('hex')\""
    );
  }
  return Buffer.from(hex, "hex");
}

/** HMAC-SHA256 over `data`, returned base64url-encoded. */
function sign(data: string): string {
  return createHmac("sha256", getStateSecret()).update(data).digest("base64url");
}

/** Generates a random hex nonce for the double-submit cookie. */
export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Constant-time string equality with an explicit length guard.
 * `timingSafeEqual` throws on length mismatch, so we check length first and
 * only then compare — returning false on any mismatch without early-exit leaks.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Builds a signed state token for the authorize redirect.
 *
 * @param input - Payload fields (`exp` defaults to now + STATE_TTL_MS)
 * @returns `body.signature` token suitable for the OAuth `state` param
 */
export function createOAuthState(
  input: Omit<OAuthStatePayload, "exp"> & { exp?: number }
): string {
  const payload: OAuthStatePayload = {
    ...input,
    exp: input.exp ?? Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Verifies a state token's signature, expiry, and provider binding.
 *
 * @param token - The `state` value returned on the callback
 * @param expectedProvider - The provider whose callback this is
 * @returns The decoded payload, or `null` if invalid/expired/mismatched
 */
export function verifyOAuthState(
  token: string | null | undefined,
  expectedProvider: Provider
): OAuthStatePayload | null {
  if (!token || typeof token !== "string") return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  // Constant-time signature check first — reject tampered tokens before parsing.
  if (!timingSafeEqualStr(signature, sign(body))) return null;

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  if (payload.provider !== expectedProvider) return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.nonce !== "string" || !payload.nonce) return null;
  if (typeof payload.companyId !== "string" || !payload.companyId) return null;
  if (typeof payload.userId !== "string" || !payload.userId) return null;

  return payload;
}
