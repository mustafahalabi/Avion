import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import {
  OAUTH_NONCE_COOKIE_PATH,
  getOAuthProviderConfig,
  getOAuthRedirectUri,
  isOAuthProvider,
  oauthNonceCookieName,
  type OAuthProvider,
} from "@/lib/oauth/oauth-config";
import { validateOAuthCallback } from "@/lib/oauth/callback-validation";
import { exchangeGitHubCode, fetchGitHubIdentity } from "@/lib/oauth/github-oauth";
import { exchangeLinearCode, fetchLinearIdentity } from "@/lib/oauth/linear-oauth";
import { recordGitHubConnection } from "@/lib/github-connection-service";
import { recordLinearConnection } from "@/lib/linear-connection-service";

/**
 * Completes the OAuth flow:
 *  - validates state + cookie nonce + re-binds to the live Clerk session
 *  - exchanges the code for tokens SERVER-SIDE, resolves identity
 *  - records the connection via the typed record* services (connectionType "oauth")
 *  - clears the single-use nonce cookie and 302s to a clean returnTo
 *
 * No token/code is ever placed in a redirect URL; Referrer-Policy: no-referrer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) {
    return new NextResponse(null, { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const cookieName = oauthNonceCookieName(provider);
  const cookieNonce = request.cookies.get(cookieName)?.value ?? null;

  const user = await getCurrentUser();
  const company = user
    ? await prisma.company.findFirst({
        where: { ownerId: user.id },
        select: { id: true },
      })
    : null;

  const validation = validateOAuthCallback({
    provider,
    stateToken: sp.get("state"),
    cookieNonce,
    errorParam: sp.get("error"),
    code: sp.get("code"),
    sessionCompanyId: company?.id ?? null,
    sessionUserId: user?.id ?? null,
  });

  if (!validation.ok) {
    return finish(request, cookieName, validation.returnTo, {
      error: validation.errorCode,
    });
  }

  try {
    await recordConnection(provider, sp.get("code") as string, validation.companyId);
  } catch {
    // Never log the code/token; surface a generic, allowlisted error code.
    return finish(request, cookieName, validation.returnTo, {
      error: "exchange_failed",
    });
  }

  return finish(request, cookieName, validation.returnTo, { connected: provider });
}

/**
 * Exchanges the code and persists the connection for one provider.
 * Reads client credentials + redirect URI from server-side config.
 */
async function recordConnection(
  provider: OAuthProvider,
  code: string,
  companyId: string
): Promise<void> {
  const config = getOAuthProviderConfig(provider);
  const redirectUri = getOAuthRedirectUri(provider);
  if (!config.clientId || !config.clientSecret || !redirectUri) {
    throw new Error("Provider is not configured.");
  }
  const exchange = {
    code,
    redirectUri,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  };

  if (provider === "github") {
    const token = await exchangeGitHubCode(exchange);
    const identity = await fetchGitHubIdentity(token.accessToken);
    await recordGitHubConnection({
      companyId,
      userId: null,
      connectionType: "oauth",
      accessToken: token.accessToken,
      grantedScopes: token.scopes,
      refreshAvailable: false,
      externalAccountId: identity.externalAccountId,
      externalAccountName: identity.externalAccountName,
      externalAccountEmail: identity.externalAccountEmail,
    });
    return;
  }

  // linear
  const token = await exchangeLinearCode(exchange);
  const identity = await fetchLinearIdentity(token.accessToken);
  await recordLinearConnection({
    companyId,
    userId: null,
    connectionType: "oauth",
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    tokenExpiresAt: token.expiresAt,
    refreshAvailable: token.refreshAvailable,
    grantedScopes: token.scopes,
    externalAccountId: identity.externalAccountId,
    externalAccountName: identity.externalAccountName,
    externalAccountEmail: identity.externalAccountEmail,
  });
}

/**
 * Clears the single-use nonce cookie and redirects to a clean same-origin URL.
 */
function finish(
  request: NextRequest,
  cookieName: string,
  returnTo: string,
  params: Record<string, string>
): NextResponse {
  const url = new URL(returnTo, request.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = NextResponse.redirect(url);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: OAUTH_NONCE_COOKIE_PATH,
    maxAge: 0,
  });
  return res;
}
