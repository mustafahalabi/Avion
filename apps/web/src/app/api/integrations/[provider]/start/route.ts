import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import {
  OAUTH_NONCE_COOKIE_PATH,
  buildAuthorizeUrl,
  getOAuthRedirectUri,
  isOAuthProvider,
  isProviderOAuthConfigured,
  oauthNonceCookieName,
} from "@/lib/oauth/oauth-config";
import {
  STATE_TTL_MS,
  createOAuthState,
  generateNonce,
} from "@/lib/oauth/oauth-state";
import { sanitizeReturnTo } from "@/lib/oauth/return-to";

/**
 * Begins the OAuth flow for a provider:
 *  - validates the provider + that it's configured (fails closed otherwise)
 *  - resolves the company from the LIVE Clerk session (getCurrentUser → ownerId)
 *  - mints a signed state (carrying a sanitized returnTo) + an httpOnly nonce
 *    cookie (double-submit CSRF), then 302s to the provider authorize URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) {
    return new NextResponse(null, { status: 404 });
  }

  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!isProviderOAuthConfigured(provider)) {
    return redirectTo(request, returnTo, { error: "not_configured" });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.nextUrl.origin));
  }
  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) {
    return redirectTo(request, returnTo, { error: "no_company" });
  }

  const redirectUri = getOAuthRedirectUri(provider);
  if (!redirectUri) {
    return redirectTo(request, returnTo, { error: "not_configured" });
  }

  const nonce = generateNonce();
  const state = createOAuthState({
    provider,
    companyId: company.id,
    userId: user.id,
    returnTo,
    nonce,
  });

  const authorizeUrl = buildAuthorizeUrl(provider, { state, redirectUri });
  const res = NextResponse.redirect(authorizeUrl);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.cookies.set(oauthNonceCookieName(provider), nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: OAUTH_NONCE_COOKIE_PATH,
    maxAge: STATE_TTL_MS / 1000,
  });
  return res;
}

/** Builds a same-origin redirect to a relative path with extra query params. */
function redirectTo(
  request: NextRequest,
  returnTo: string,
  params: Record<string, string>
): NextResponse {
  const url = new URL(returnTo, request.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = NextResponse.redirect(url);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
