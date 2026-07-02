import type { Provider } from "@/lib/provider-connection-service";
import { timingSafeEqualStr, verifyOAuthState } from "./oauth-state";
import { DEFAULT_RETURN_TO, sanitizeReturnTo } from "./return-to";

/**
 * Pure decision logic for the OAuth callback — kept separate from the route
 * handler so every CSRF / session-rebind / error branch is unit-testable.
 *
 * Security model enforced here:
 *  - state signature + expiry + provider binding (via verifyOAuthState)
 *  - cookie-nonce double-submit (constant-time compare)
 *  - session re-bind: the signed companyId/userId MUST match the live session
 *  - returnTo is taken from the signed state and re-sanitized
 *  - provider error params are only honored after state/cookie verification
 */

export interface CallbackValidationInput {
  provider: Provider;
  stateToken: string | null;
  cookieNonce: string | null;
  errorParam: string | null;
  code: string | null;
  /** Company id resolved from the LIVE Clerk session (authoritative). */
  sessionCompanyId: string | null;
  /** User id resolved from the LIVE Clerk session (authoritative). */
  sessionUserId: string | null;
}

export type CallbackValidation =
  | { ok: false; errorCode: string; returnTo: string }
  | { ok: true; returnTo: string; companyId: string; userId: string };

/** Maps a provider error param onto a small allowlist of safe codes. */
function safeErrorCode(errorParam: string): string {
  return errorParam === "access_denied" ? "access_denied" : "denied";
}

export function validateOAuthCallback(
  input: CallbackValidationInput
): CallbackValidation {
  // A live, owning session is mandatory (defends a lapsed-session round-trip).
  if (!input.sessionCompanyId || !input.sessionUserId) {
    return { ok: false, errorCode: "session_required", returnTo: DEFAULT_RETURN_TO };
  }

  const payload = verifyOAuthState(input.stateToken, input.provider);
  const returnTo = payload ? sanitizeReturnTo(payload.returnTo) : DEFAULT_RETURN_TO;
  const nonceMatches =
    !!payload &&
    !!input.cookieNonce &&
    timingSafeEqualStr(input.cookieNonce, payload.nonce);

  // Provider-reported error (e.g. user denied). Only honor it after we've
  // confirmed the callback is genuinely ours (signed state + nonce match).
  if (input.errorParam) {
    if (!nonceMatches) {
      return { ok: false, errorCode: "invalid_state", returnTo };
    }
    return { ok: false, errorCode: safeErrorCode(input.errorParam), returnTo };
  }

  // No valid signed state.
  if (!payload) {
    return { ok: false, errorCode: "invalid_state", returnTo: DEFAULT_RETURN_TO };
  }

  // Double-submit cookie nonce must match the signed nonce.
  if (!nonceMatches) {
    return { ok: false, errorCode: "invalid_state", returnTo };
  }

  // Session re-bind: the signed identity must match the live session.
  if (
    payload.companyId !== input.sessionCompanyId ||
    payload.userId !== input.sessionUserId
  ) {
    return { ok: false, errorCode: "session_mismatch", returnTo };
  }

  if (!input.code) {
    return { ok: false, errorCode: "missing_code", returnTo };
  }

  return {
    ok: true,
    returnTo,
    companyId: input.sessionCompanyId,
    userId: input.sessionUserId,
  };
}
