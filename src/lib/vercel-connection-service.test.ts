import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ServiceModule from "./provider-connection-service";
import type * as VercelServiceModule from "./vercel-connection-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let baseService: typeof ServiceModule;
let service: typeof VercelServiceModule;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  dbPath = join(
    tmpdir(),
    `vercel-connection-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  baseService = await import("./provider-connection-service");
  service = await import("./vercel-connection-service");

  // Minimal schema bootstrap
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clerkId" TEXT,
      "name" TEXT,
      "email" TEXT NOT NULL,
      "image" TEXT,
      "role" TEXT NOT NULL DEFAULT 'member',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "logoUrl" TEXT,
      "website" TEXT,
      "industry" TEXT,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProviderConnection" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "provider" TEXT NOT NULL,
      "connectionType" TEXT NOT NULL DEFAULT 'oauth',
      "status" TEXT NOT NULL DEFAULT 'disconnected',
      "externalAccountId" TEXT,
      "externalAccountName" TEXT,
      "externalAccountEmail" TEXT,
      "scopes" TEXT NOT NULL DEFAULT '[]',
      "encryptedTokens" TEXT NOT NULL DEFAULT '{}',
      "tokenExpiresAt" DATETIME,
      "refreshAvailable" BOOLEAN NOT NULL DEFAULT false,
      "errorCode" TEXT,
      "errorMessage" TEXT,
      "lastConnectedAt" DATETIME,
      "disconnectedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ProviderConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProviderConnection_companyId_provider_userId_key" ON "ProviderConnection"("companyId", "provider", "userId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProviderConnection_companyId_provider_idx" ON "ProviderConnection"("companyId", "provider")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProviderConnection_companyId_status_idx" ON "ProviderConnection"("companyId", "status")`
  );

  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" ("id","email","role","createdAt","updatedAt")
    VALUES ('user-1','owner@example.com','admin',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-1','Acme Corp','acme','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Company" ("id","name","slug","ownerId","createdAt","updatedAt")
    VALUES ('company-2','Other Corp','other','user-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `);
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "ProviderConnection"`);
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    rmSync(dbPath, { force: true });
  } catch {
    // ignore cleanup failures
  }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("vercel-connection-service", () => {
  // ── recordVercelConnection ────────────────────────────────────────────────

  describe("recordVercelConnection", () => {
    it("records an OAuth connection with full account info", async () => {
      const conn = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_oauth_abc123",
        grantedScopes: ["deployments:read", "projects:read"],
        externalAccountName: "my-team",
        externalAccountId: "team_xyz",
        externalAccountEmail: "admin@example.com",
      });

      expect(conn.companyId).toBe("company-1");
      expect(conn.userId).toBeNull();
      expect(conn.provider).toBe("vercel");
      expect(conn.connectionType).toBe("oauth");
      expect(conn.status).toBe("connected");
      expect(conn.tokens.accessToken).toBe("vrt_oauth_abc123");
      expect(conn.externalAccountName).toBe("my-team");
      expect(conn.externalAccountId).toBe("team_xyz");
      expect(conn.externalAccountEmail).toBe("admin@example.com");
      expect(conn.lastConnectedAt).not.toBeNull();
      // tokens must be stored encrypted
      expect(conn.encryptedTokens).not.toContain("vrt_oauth_abc123");
    });

    it("stores teamId inside the token payload when provided", async () => {
      const conn = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_team_token",
        teamId: "team_abc",
      });

      expect(conn.tokens.accessToken).toBe("vrt_team_token");
      expect(conn.tokens.teamId).toBe("team_abc");
    });

    it("omits teamId from token payload when not provided", async () => {
      const conn = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "vrt_personal_token",
      });

      expect(conn.tokens.teamId).toBeUndefined();
    });

    it("records a manual token connection", async () => {
      const conn = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "vrt_personal_pat",
        externalAccountName: "jane-doe",
      });

      expect(conn.connectionType).toBe("manual_token");
      expect(conn.tokens.accessToken).toBe("vrt_personal_pat");
    });

    it("upserts — reconnecting replaces stored tokens", async () => {
      const first = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_old",
      });

      const second = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_new",
        teamId: "team_new",
      });

      expect(second.id).toBe(first.id);
      expect(second.tokens.accessToken).toBe("vrt_new");
      expect(second.tokens.teamId).toBe("team_new");
    });

    it("stores tokenExpiresAt and refreshAvailable for OAuth connections", async () => {
      const expiresAt = new Date(Date.now() + 7200 * 1000);

      const conn = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_expiring",
        tokenExpiresAt: expiresAt,
        refreshAvailable: true,
      });

      expect(conn.tokenExpiresAt).toBeInstanceOf(Date);
      expect(conn.refreshAvailable).toBe(true);
    });
  });

  // ── getVercelConnectionStatus ─────────────────────────────────────────────

  describe("getVercelConnectionStatus", () => {
    it("returns disconnected status when no connection exists", async () => {
      const status = await service.getVercelConnectionStatus("company-1");

      expect(status.connected).toBe(false);
      expect(status.connectionId).toBeNull();
      expect(status.connectionType).toBeNull();
      expect(status.accountName).toBeNull();
      expect(status.teamId).toBeNull();
      expect(status.missingScopes).toEqual([
        "deployments:read",
        "projects:read",
        "teams:read",
      ]);
    });

    it("returns connected status after recording a connection", async () => {
      await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_connected",
        grantedScopes: ["deployments:read", "projects:read", "teams:read"],
        externalAccountName: "my-team",
        externalAccountEmail: "admin@example.com",
        teamId: "team_123",
      });

      const status = await service.getVercelConnectionStatus("company-1");

      expect(status.connected).toBe(true);
      expect(status.connectionId).toBeTruthy();
      expect(status.accountName).toBe("my-team");
      expect(status.accountEmail).toBe("admin@example.com");
      expect(status.teamId).toBe("team_123");
      expect(status.grantedScopes).toEqual([
        "deployments:read",
        "projects:read",
        "teams:read",
      ]);
      expect(status.missingScopes).toEqual([]);
      expect(status.tokenExpired).toBe(false);
    });

    it("reports missing scopes when fewer than required scopes are granted", async () => {
      await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "vrt_limited",
        grantedScopes: ["deployments:read"],
      });

      const status = await service.getVercelConnectionStatus("company-1");

      expect(status.grantedScopes).toContain("deployments:read");
      expect(status.missingScopes).toContain("projects:read");
      expect(status.missingScopes).toContain("teams:read");
    });

    it("reports tokenExpired when token has passed its expiry date", async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);

      await baseService.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "vercel",
        connectionType: "oauth",
        status: "expired",
        tokens: { accessToken: "vrt_expired" },
        tokenExpiresAt: pastDate,
      });

      const status = await service.getVercelConnectionStatus("company-1");

      expect(status.tokenExpired).toBe(true);
      expect(status.connected).toBe(false);
    });

    it("does not return another company's connection status", async () => {
      await service.recordVercelConnection({
        companyId: "company-2",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_company2",
      });

      const status = await service.getVercelConnectionStatus("company-1");

      expect(status.connected).toBe(false);
      expect(status.connectionId).toBeNull();
    });
  });

  // ── disconnectVercel ──────────────────────────────────────────────────────

  describe("disconnectVercel", () => {
    it("disconnects an existing connection and returns true", async () => {
      const conn = await service.recordVercelConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_to_disconnect",
      });

      const result = await service.disconnectVercel("company-1", conn.id);
      expect(result).toBe(true);

      const status = await service.getVercelConnectionStatus("company-1");
      expect(status.connected).toBe(false);
    });

    it("returns false when connection does not exist", async () => {
      const result = await service.disconnectVercel("company-1", "nonexistent-id");
      expect(result).toBe(false);
    });

    it("enforces company ownership — cannot disconnect another company's connection", async () => {
      const conn = await service.recordVercelConnection({
        companyId: "company-2",
        userId: null,
        connectionType: "oauth",
        accessToken: "vrt_company2_secret",
      });

      const result = await service.disconnectVercel("company-1", conn.id);
      expect(result).toBe(false);

      // company-2 connection remains intact
      const status = await service.getVercelConnectionStatus("company-2");
      expect(status.connected).toBe(true);
    });
  });

  // ── constants ─────────────────────────────────────────────────────────────

  describe("VERCEL_REQUIRED_SCOPES", () => {
    it("contains the three expected scope keys", () => {
      expect(service.VERCEL_REQUIRED_SCOPES).toContain("deployments:read");
      expect(service.VERCEL_REQUIRED_SCOPES).toContain("projects:read");
      expect(service.VERCEL_REQUIRED_SCOPES).toContain("teams:read");
    });
  });

  describe("VERCEL_SCOPE_DESCRIPTIONS", () => {
    it("has a non-empty description for every required scope", () => {
      for (const scope of service.VERCEL_REQUIRED_SCOPES) {
        expect(service.VERCEL_SCOPE_DESCRIPTIONS[scope]).toBeTruthy();
      }
    });
  });
});
