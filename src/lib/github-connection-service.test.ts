import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ServiceModule from "./github-connection-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof ServiceModule;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  dbPath = join(
    tmpdir(),
    `github-connection-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./github-connection-service");

  // Bootstrap minimal schema
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

  // Seed
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
    // ignore
  }
  delete process.env.ENGINEERING_OS_DATABASE_PATH;
  delete (globalThis as Record<string, unknown>).prisma;
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("github-connection-service", () => {
  // ── recordGitHubConnection (connect callback) ─────────────────────────────

  describe("recordGitHubConnection", () => {
    it("records an OAuth connection with account identity", async () => {
      const conn = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_test123",
        grantedScopes: ["repo", "read:org", "workflow"],
        externalAccountId: "12345",
        externalAccountName: "my-org",
        externalAccountEmail: "admin@my-org.com",
      });

      expect(conn.companyId).toBe("company-1");
      expect(conn.provider).toBe("github");
      expect(conn.connectionType).toBe("oauth");
      expect(conn.status).toBe("connected");
      expect(conn.externalAccountName).toBe("my-org");
      expect(conn.externalAccountEmail).toBe("admin@my-org.com");
      expect(conn.externalAccountId).toBe("12345");
      // token must not be stored as plaintext
      expect(conn.encryptedTokens).not.toContain("gho_test123");
      expect(conn.tokens.accessToken).toBe("gho_test123");
      expect(conn.lastConnectedAt).not.toBeNull();
    });

    it("records a manual token (PAT) connection", async () => {
      const conn = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "ghp_personaltoken",
        grantedScopes: [],
        externalAccountName: "jane",
      });

      expect(conn.connectionType).toBe("manual_token");
      expect(conn.tokens.accessToken).toBe("ghp_personaltoken");
      expect(conn.externalAccountName).toBe("jane");
    });

    it("records a GitHub App connection with installationId", async () => {
      const conn = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "github_app",
        accessToken: "ghs_installationtoken",
        installationId: "inst_789",
        externalAccountName: "my-org",
      });

      expect(conn.connectionType).toBe("github_app");
      expect(conn.tokens.accessToken).toBe("ghs_installationtoken");
      expect(conn.tokens.installationId).toBe("inst_789");
    });

    it("upserts on re-connect, preserving the same connection ID", async () => {
      const first = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "old-token",
        externalAccountName: "old-org",
      });

      const second = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "new-token",
        externalAccountName: "new-org",
        grantedScopes: ["repo"],
      });

      expect(second.id).toBe(first.id);
      expect(second.tokens.accessToken).toBe("new-token");
      expect(second.externalAccountName).toBe("new-org");
    });

    it("stores tokenExpiresAt and refreshAvailable for expiring tokens", async () => {
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      const conn = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_expiring",
        tokenExpiresAt: expiresAt,
        refreshAvailable: true,
      });

      expect(conn.tokenExpiresAt).toBeInstanceOf(Date);
      expect(conn.refreshAvailable).toBe(true);
    });

    it("allows separate connections per company", async () => {
      const c1 = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "token-c1",
      });

      const c2 = await service.recordGitHubConnection({
        companyId: "company-2",
        userId: null,
        connectionType: "oauth",
        accessToken: "token-c2",
      });

      expect(c1.id).not.toBe(c2.id);
      expect(c1.tokens.accessToken).toBe("token-c1");
      expect(c2.tokens.accessToken).toBe("token-c2");
    });
  });

  // ── getGitHubConnectionStatus ─────────────────────────────────────────────

  describe("getGitHubConnectionStatus", () => {
    it("returns disconnected status when no connection exists", async () => {
      const status = await service.getGitHubConnectionStatus("company-1");

      expect(status.connected).toBe(false);
      expect(status.connectionId).toBeNull();
      expect(status.connectionType).toBeNull();
      expect(status.accountName).toBeNull();
      expect(status.grantedScopes).toEqual([]);
      expect(status.missingScopes).toEqual([...service.GITHUB_REQUIRED_SCOPES]);
      expect(status.tokenExpired).toBe(false);
    });

    it("returns connected status with account info and scope analysis", async () => {
      await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_test",
        grantedScopes: ["repo", "read:org", "workflow"],
        externalAccountName: "my-org",
        externalAccountEmail: "admin@my-org.com",
      });

      const status = await service.getGitHubConnectionStatus("company-1");

      expect(status.connected).toBe(true);
      expect(status.connectionId).not.toBeNull();
      expect(status.connectionType).toBe("oauth");
      expect(status.accountName).toBe("my-org");
      expect(status.accountEmail).toBe("admin@my-org.com");
      expect(status.grantedScopes).toEqual(["repo", "read:org", "workflow"]);
      expect(status.missingScopes).toEqual([]);
      expect(status.tokenExpired).toBe(false);
    });

    it("reports missing scopes when partial scopes are granted", async () => {
      await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "ghp_pat",
        grantedScopes: ["repo"],
      });

      const status = await service.getGitHubConnectionStatus("company-1");

      expect(status.connected).toBe(true);
      expect(status.missingScopes).toContain("read:org");
      expect(status.missingScopes).toContain("workflow");
      expect(status.missingScopes).not.toContain("repo");
    });

    it("marks connection as not connected when token is expired", async () => {
      await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_expired",
        tokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      });

      const status = await service.getGitHubConnectionStatus("company-1");

      expect(status.tokenExpired).toBe(true);
      expect(status.connected).toBe(false);
    });

    it("does not return a connection owned by another company", async () => {
      await service.recordGitHubConnection({
        companyId: "company-2",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_other",
        externalAccountName: "other-org",
      });

      const status = await service.getGitHubConnectionStatus("company-1");
      expect(status.connected).toBe(false);
      expect(status.accountName).toBeNull();
    });
  });

  // ── disconnectGitHub ──────────────────────────────────────────────────────

  describe("disconnectGitHub", () => {
    it("disconnects an existing connection and returns true", async () => {
      const conn = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_secret",
      });

      const result = await service.disconnectGitHub("company-1", conn.id);
      expect(result).toBe(true);

      const status = await service.getGitHubConnectionStatus("company-1");
      expect(status.connected).toBe(false);
    });

    it("returns false for a non-existent connection", async () => {
      const result = await service.disconnectGitHub("company-1", "nonexistent");
      expect(result).toBe(false);
    });

    it("enforces company ownership — cannot disconnect another company's connection", async () => {
      const conn = await service.recordGitHubConnection({
        companyId: "company-2",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_secret",
      });

      const result = await service.disconnectGitHub("company-1", conn.id);
      expect(result).toBe(false);

      // Still connected in company-2
      const status = await service.getGitHubConnectionStatus("company-2");
      expect(status.connected).toBe(true);
    });

    it("clears tokens after disconnect", async () => {
      const conn = await service.recordGitHubConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "gho_secret",
      });

      await service.disconnectGitHub("company-1", conn.id);

      const status = await service.getGitHubConnectionStatus("company-1");
      expect(status.raw?.tokens).toEqual({});
    });
  });

  // ── GITHUB_SCOPE_DESCRIPTIONS ─────────────────────────────────────────────

  describe("GITHUB_SCOPE_DESCRIPTIONS", () => {
    it("has a description for every required scope", () => {
      for (const scope of service.GITHUB_REQUIRED_SCOPES) {
        expect(service.GITHUB_SCOPE_DESCRIPTIONS[scope]).toBeTruthy();
        expect(typeof service.GITHUB_SCOPE_DESCRIPTIONS[scope]).toBe("string");
      }
    });
  });
});
