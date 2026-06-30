import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ServiceModule from "./provider-connection-service";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let dbPath: string;
let prisma: typeof PrismaSingleton;
let service: typeof ServiceModule;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  dbPath = join(
    tmpdir(),
    `provider-connection-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  process.env.ENGINEERING_OS_DATABASE_PATH = dbPath;
  delete (globalThis as Record<string, unknown>).prisma;

  const prismaModule = await import("./prisma");
  prisma = prismaModule.prisma;
  service = await import("./provider-connection-service");

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

  // Seed companies used across tests
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
  // Clear all ProviderConnection rows between tests for isolation
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

describe("provider-connection-service", () => {
  // ── upsertProviderConnection ──────────────────────────────────────────────

  describe("upsertProviderConnection", () => {
    it("creates a new company-level connection", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "gho_test123" },
        scopes: ["repo", "read:org"],
        externalAccountId: "12345",
        externalAccountName: "my-org",
        externalAccountEmail: "owner@example.com",
      });

      expect(conn.companyId).toBe("company-1");
      expect(conn.userId).toBeNull();
      expect(conn.provider).toBe("github");
      expect(conn.connectionType).toBe("oauth");
      expect(conn.status).toBe("connected");
      expect(conn.tokens.accessToken).toBe("gho_test123");
      expect(conn.externalAccountId).toBe("12345");
      expect(conn.externalAccountName).toBe("my-org");
      expect(conn.externalAccountEmail).toBe("owner@example.com");
      expect(conn.lastConnectedAt).not.toBeNull();
      // tokens must be stored encrypted (not plaintext)
      expect(conn.encryptedTokens).not.toContain("gho_test123");
    });

    it("creates a user-scoped connection", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: "user-1",
        provider: "linear",
        connectionType: "manual_token",
        status: "connected",
        tokens: { manualToken: "lin_api_secret" },
        scopes: [],
        externalAccountName: "my-workspace",
      });

      expect(conn.userId).toBe("user-1");
      expect(conn.provider).toBe("linear");
      expect(conn.connectionType).toBe("manual_token");
      expect(conn.tokens.manualToken).toBe("lin_api_secret");
    });

    it("updates an existing connection on re-upsert", async () => {
      const first = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "old-token" },
      });

      const second = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "new-token" },
        scopes: ["repo"],
      });

      expect(second.id).toBe(first.id); // same record updated
      expect(second.tokens.accessToken).toBe("new-token");
    });

    it("allows separate connections per company for same provider", async () => {
      const conn1 = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token-company-1" },
      });

      const conn2 = await service.upsertProviderConnection({
        companyId: "company-2",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token-company-2" },
      });

      expect(conn1.id).not.toBe(conn2.id);
      expect(conn1.tokens.accessToken).toBe("token-company-1");
      expect(conn2.tokens.accessToken).toBe("token-company-2");
    });

    it("allows company-level and user-scoped connections to coexist", async () => {
      const companyConn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "linear",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "company-level-token" },
      });

      const userConn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: "user-1",
        provider: "linear",
        connectionType: "manual_token",
        status: "connected",
        tokens: { manualToken: "user-level-token" },
      });

      expect(companyConn.id).not.toBe(userConn.id);
      expect(companyConn.userId).toBeNull();
      expect(userConn.userId).toBe("user-1");
    });

    it("sets tokenExpiresAt and refreshAvailable correctly", async () => {
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "linear",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "vrt_abc", refreshToken: "vrt_refresh" },
        tokenExpiresAt: expiresAt,
        refreshAvailable: true,
      });

      expect(conn.refreshAvailable).toBe(true);
      expect(conn.tokenExpiresAt).toBeInstanceOf(Date);
    });

    it("sets disconnectedAt when status is disconnected", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "disconnected",
        tokens: {},
      });

      expect(conn.disconnectedAt).toBeInstanceOf(Date);
      expect(conn.lastConnectedAt).toBeNull();
    });
  });

  // ── getProviderConnection ─────────────────────────────────────────────────

  describe("getProviderConnection", () => {
    it("returns null when no connection exists", async () => {
      const result = await service.getProviderConnection("company-1", "github", null);
      expect(result).toBeNull();
    });

    it("retrieves an existing company-level connection with decrypted tokens", async () => {
      await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "linear",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "lin_token_abc" },
      });

      const conn = await service.getProviderConnection("company-1", "linear", null);
      expect(conn).not.toBeNull();
      expect(conn!.tokens.accessToken).toBe("lin_token_abc");
    });

    it("does not return a connection owned by another company", async () => {
      await service.upsertProviderConnection({
        companyId: "company-2",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "secret" },
      });

      const result = await service.getProviderConnection("company-1", "github", null);
      expect(result).toBeNull();
    });
  });

  // ── listProviderConnections ───────────────────────────────────────────────

  describe("listProviderConnections", () => {
    it("returns empty array when no connections exist", async () => {
      const result = await service.listProviderConnections("company-1");
      expect(result).toEqual([]);
    });

    it("returns all connections for a company with tokens decrypted", async () => {
      await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "gh-token" },
      });

      await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "linear",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "lin-token" },
      });

      const results = await service.listProviderConnections("company-1");
      expect(results).toHaveLength(2);
      const providers = results.map((c) => c.provider).sort();
      expect(providers).toEqual(["github", "linear"]);
    });

    it("does not return connections from other companies", async () => {
      await service.upsertProviderConnection({
        companyId: "company-2",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token" },
      });

      const results = await service.listProviderConnections("company-1");
      expect(results).toHaveLength(0);
    });
  });

  // ── disconnectProviderConnection ──────────────────────────────────────────

  describe("disconnectProviderConnection", () => {
    it("marks the connection as disconnected and clears tokens", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "secret-token" },
      });

      const disconnected = await service.disconnectProviderConnection(
        "company-1",
        conn.id
      );

      expect(disconnected).not.toBeNull();
      expect(disconnected!.status).toBe("disconnected");
      expect(disconnected!.tokens).toEqual({});
      expect(disconnected!.refreshAvailable).toBe(false);
      expect(disconnected!.disconnectedAt).toBeInstanceOf(Date);
    });

    it("returns null when connection is not found", async () => {
      const result = await service.disconnectProviderConnection("company-1", "nonexistent");
      expect(result).toBeNull();
    });

    it("enforces company ownership — cannot disconnect another company's connection", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-2",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "secret" },
      });

      const result = await service.disconnectProviderConnection("company-1", conn.id);
      expect(result).toBeNull();

      // Original connection should still be connected
      const original = await service.getProviderConnection("company-2", "github", null);
      expect(original?.status).toBe("connected");
    });
  });

  // ── recordProviderConnectionError ────────────────────────────────────────

  describe("recordProviderConnectionError", () => {
    it("records error code and message on the connection", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token" },
      });

      const errored = await service.recordProviderConnectionError(
        "company-1",
        conn.id,
        "token_revoked",
        "The access token has been revoked by the provider."
      );

      expect(errored).not.toBeNull();
      expect(errored!.status).toBe("error");
      expect(errored!.errorCode).toBe("token_revoked");
      expect(errored!.errorMessage).toBe(
        "The access token has been revoked by the provider."
      );
    });

    it("returns null when connection is not found", async () => {
      const result = await service.recordProviderConnectionError(
        "company-1",
        "nonexistent",
        "err",
        "msg"
      );
      expect(result).toBeNull();
    });

    it("enforces company ownership for error recording", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-2",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token" },
      });

      const result = await service.recordProviderConnectionError(
        "company-1",
        conn.id,
        "err",
        "msg"
      );
      expect(result).toBeNull();
    });
  });

  // ── deleteProviderConnection ──────────────────────────────────────────────

  describe("deleteProviderConnection", () => {
    it("deletes an existing connection and returns true", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token" },
      });

      const deleted = await service.deleteProviderConnection("company-1", conn.id);
      expect(deleted).toBe(true);

      const after = await service.getProviderConnection("company-1", "github", null);
      expect(after).toBeNull();
    });

    it("returns false when connection is not found", async () => {
      const result = await service.deleteProviderConnection("company-1", "nonexistent");
      expect(result).toBe(false);
    });

    it("enforces company ownership on delete", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-2",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token" },
      });

      const result = await service.deleteProviderConnection("company-1", conn.id);
      expect(result).toBe(false);

      // Still exists in company-2
      const still = await service.getProviderConnection("company-2", "github", null);
      expect(still).not.toBeNull();
    });
  });

  // ── getConnectionScopes ───────────────────────────────────────────────────

  describe("getConnectionScopes", () => {
    it("returns granted scopes as an array", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token" },
        scopes: ["repo", "read:org", "workflow"],
      });

      const scopes = service.getConnectionScopes(conn);
      expect(scopes).toEqual(["repo", "read:org", "workflow"]);
    });

    it("returns empty array when no scopes stored", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "linear",
        connectionType: "oauth",
        status: "connected",
        tokens: {},
      });

      expect(service.getConnectionScopes(conn)).toEqual([]);
    });
  });

  // ── isConnectionTokenExpired ──────────────────────────────────────────────

  describe("isConnectionTokenExpired", () => {
    it("returns false when tokenExpiresAt is null (unknown / non-expiring)", async () => {
      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "github",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "token" },
        tokenExpiresAt: null,
      });

      expect(service.isConnectionTokenExpired(conn)).toBe(false);
    });

    it("returns true when tokenExpiresAt is in the past", async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);

      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "linear",
        connectionType: "oauth",
        status: "expired",
        tokens: {},
        tokenExpiresAt: pastDate,
      });

      expect(service.isConnectionTokenExpired(conn)).toBe(true);
    });

    it("returns false when tokenExpiresAt is in the future", async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);

      const conn = await service.upsertProviderConnection({
        companyId: "company-1",
        userId: null,
        provider: "linear",
        connectionType: "oauth",
        status: "connected",
        tokens: { accessToken: "fresh-token" },
        tokenExpiresAt: futureDate,
      });

      expect(service.isConnectionTokenExpired(conn)).toBe(false);
    });
  });
});
