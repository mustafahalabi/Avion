import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import { ClerkAuthGuard, type GuardedRequest } from "./clerk-auth.guard";
import type { AuthService } from "./auth.service";

function contextFor(request: GuardedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeGuard(authenticate: ReturnType<typeof vi.fn>): ClerkAuthGuard {
  return new ClerkAuthGuard({ authenticate } as unknown as AuthService);
}

describe("ClerkAuthGuard", () => {
  it("rejects a request without an Authorization header", async () => {
    const authenticate = vi.fn().mockResolvedValue(null);
    const guard = makeGuard(authenticate);

    await expect(
      guard.canActivate(contextFor({ headers: {} }))
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).toHaveBeenCalledWith(null);
  });

  it("rejects a request whose token does not authenticate", async () => {
    const authenticate = vi.fn().mockResolvedValue(null);
    const guard = makeGuard(authenticate);

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: "Bearer bad-token" } })
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).toHaveBeenCalledWith("bad-token");
  });

  it("allows an authenticated request and attaches the caller's scope", async () => {
    const auth = { userId: "user-1", companyIds: ["company-1"] };
    const authenticate = vi.fn().mockResolvedValue(auth);
    const guard = makeGuard(authenticate);
    const request: GuardedRequest = {
      headers: { authorization: "Bearer good-token" },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.auth).toEqual(auth);
  });
});
