import { describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service";
import type { PrismaService } from "../prisma/prisma.service";

function makePrisma(overrides?: {
  user?: { id: string } | null;
  companies?: { id: string }[];
}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(overrides?.user ?? null),
    },
    company: {
      findMany: vi.fn().mockResolvedValue(overrides?.companies ?? []),
    },
  } as unknown as PrismaService;
}

function makeService(
  prisma: PrismaService,
  verifier?: AuthService["verifyJwt"]
): AuthService {
  const service = new AuthService(prisma);
  if (verifier) service.verifyJwt = verifier;
  return service;
}

describe("AuthService.authenticate", () => {
  it("rejects a missing token without calling the verifier", async () => {
    const verifier = vi.fn();
    const service = makeService(makePrisma(), verifier);

    expect(await service.authenticate(null)).toBeNull();
    expect(await service.authenticate(undefined)).toBeNull();
    expect(await service.authenticate("")).toBeNull();
    expect(verifier).not.toHaveBeenCalled();
  });

  it("resolves a valid token to the user's company scope", async () => {
    const prisma = makePrisma({
      user: { id: "user-1" },
      companies: [{ id: "company-1" }, { id: "company-2" }],
    });
    const service = makeService(prisma, async () => ({ sub: "clerk_abc" }));

    const auth = await service.authenticate("valid-token");

    expect(auth).toEqual({ userId: "user-1", companyIds: ["company-1", "company-2"] });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkId: "clerk_abc" } })
    );
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "user-1" } })
    );
  });

  it("rejects a token whose Clerk user has no database user (fails closed)", async () => {
    const service = makeService(
      makePrisma({ user: null }),
      async () => ({ sub: "clerk_unknown" })
    );

    expect(await service.authenticate("valid-token")).toBeNull();
  });

  it("rejects when verification throws (bad signature, expired, no secret key)", async () => {
    const service = makeService(makePrisma(), async () => {
      throw new Error("invalid token");
    });

    expect(await service.authenticate("garbage")).toBeNull();
  });

  it("rejects a verified payload without a subject", async () => {
    const service = makeService(makePrisma(), async () => ({}));

    expect(await service.authenticate("token-without-sub")).toBeNull();
  });
});

describe("AuthService.bearerFromHeader", () => {
  it("extracts the token from a Bearer header (case-insensitive)", () => {
    expect(AuthService.bearerFromHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(AuthService.bearerFromHeader("bearer xyz")).toBe("xyz");
  });

  it("returns null for absent or malformed headers", () => {
    expect(AuthService.bearerFromHeader(undefined)).toBeNull();
    expect(AuthService.bearerFromHeader(null)).toBeNull();
    expect(AuthService.bearerFromHeader("")).toBeNull();
    expect(AuthService.bearerFromHeader("Basic dXNlcjpwYXNz")).toBeNull();
    expect(AuthService.bearerFromHeader("Bearer")).toBeNull();
  });
});
