import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaSingleton } from "./prisma";
import type * as ServiceModule from "./linear-connection-service";
import { setupTestSchema, teardownTestSchema } from "./test-utils/pg-test-db";

// ─── Test Database Setup ──────────────────────────────────────────────────────

let prisma: typeof PrismaSingleton;
let schema: string;
let service: typeof ServiceModule;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  ({ prisma, schema } = await setupTestSchema("linear-connection-service"));
  service = await import("./linear-connection-service");

  // Postgres enforces foreign keys (unlike the old SQLite test tables), so seed
  // the owner User before the Companies (Company.ownerId -> User.id), and the
  // Companies before any ProviderConnection (ProviderConnection.companyId ->
  // Company.id).
  await prisma.user.create({
    data: { id: "user-1", email: "owner@example.com", role: "admin" },
  });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme Corp", slug: "acme", ownerId: "user-1" },
  });
  await prisma.company.create({
    data: { id: "company-2", name: "Other Corp", slug: "other", ownerId: "user-1" },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "ProviderConnection"`);
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("linear-connection-service", () => {
  // ── recordLinearConnection (connect callback) ──────────────────────────────

  describe("recordLinearConnection", () => {
    it("records an OAuth connection with workspace identity", async () => {
      const conn = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_oauth_abc123",
        grantedScopes: ["read", "write", "issues:create"],
        externalAccountId: "workspace-id-1",
        externalAccountName: "Acme Workspace",
        externalAccountEmail: "admin@acme.com",
      });

      expect(conn.companyId).toBe("company-1");
      expect(conn.provider).toBe("linear");
      expect(conn.connectionType).toBe("oauth");
      expect(conn.status).toBe("connected");
      expect(conn.externalAccountName).toBe("Acme Workspace");
      expect(conn.externalAccountEmail).toBe("admin@acme.com");
      expect(conn.externalAccountId).toBe("workspace-id-1");
      // token must not be stored as plaintext
      expect(conn.encryptedTokens).not.toContain("lin_oauth_abc123");
      expect(conn.tokens.accessToken).toBe("lin_oauth_abc123");
      expect(conn.lastConnectedAt).not.toBeNull();
    });

    it("records a manual API key connection", async () => {
      const conn = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "lin_api_key_secret",
        grantedScopes: [],
        externalAccountName: "My Team",
      });

      expect(conn.connectionType).toBe("manual_token");
      expect(conn.tokens.accessToken).toBe("lin_api_key_secret");
      expect(conn.externalAccountName).toBe("My Team");
    });

    it("stores defaultTeamId in the encrypted token payload", async () => {
      const conn = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_oauth_abc",
        defaultTeamId: "team-xyz",
      });

      expect(conn.tokens.defaultTeamId).toBe("team-xyz");
    });

    it("upserts on re-connect, preserving the same connection ID", async () => {
      const first = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "old-token",
        externalAccountName: "Old Workspace",
      });

      const second = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "new-token",
        externalAccountName: "New Workspace",
        grantedScopes: ["read", "write"],
      });

      expect(second.id).toBe(first.id);
      expect(second.tokens.accessToken).toBe("new-token");
      expect(second.externalAccountName).toBe("New Workspace");
    });

    it("stores tokenExpiresAt and refreshAvailable for expiring tokens", async () => {
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      const conn = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_expiring",
        tokenExpiresAt: expiresAt,
        refreshAvailable: true,
      });

      expect(conn.tokenExpiresAt).toBeInstanceOf(Date);
      expect(conn.refreshAvailable).toBe(true);
    });

    it("allows separate connections per company", async () => {
      const c1 = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "token-c1",
      });

      const c2 = await service.recordLinearConnection({
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

  // ── getLinearConnectionStatus ──────────────────────────────────────────────

  describe("getLinearConnectionStatus", () => {
    it("returns disconnected status when no connection exists", async () => {
      const status = await service.getLinearConnectionStatus("company-1");

      expect(status.connected).toBe(false);
      expect(status.connectionId).toBeNull();
      expect(status.connectionType).toBeNull();
      expect(status.accountName).toBeNull();
      expect(status.defaultTeamId).toBeNull();
      expect(status.grantedScopes).toEqual([]);
      expect(status.missingScopes).toEqual([...service.LINEAR_REQUIRED_SCOPES]);
      expect(status.tokenExpired).toBe(false);
    });

    it("returns connected status with workspace info and scope analysis", async () => {
      await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_oauth",
        grantedScopes: ["read", "write", "issues:create"],
        externalAccountName: "Acme Workspace",
        externalAccountEmail: "admin@acme.com",
        defaultTeamId: "team-abc",
      });

      const status = await service.getLinearConnectionStatus("company-1");

      expect(status.connected).toBe(true);
      expect(status.connectionId).not.toBeNull();
      expect(status.connectionType).toBe("oauth");
      expect(status.accountName).toBe("Acme Workspace");
      expect(status.accountEmail).toBe("admin@acme.com");
      expect(status.defaultTeamId).toBe("team-abc");
      expect(status.grantedScopes).toEqual(["read", "write", "issues:create"]);
      expect(status.missingScopes).toEqual([]);
      expect(status.tokenExpired).toBe(false);
    });

    it("reports missing scopes when partial scopes are granted", async () => {
      await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "lin_api_key",
        grantedScopes: ["read"],
      });

      const status = await service.getLinearConnectionStatus("company-1");

      expect(status.connected).toBe(true);
      expect(status.missingScopes).toContain("write");
      expect(status.missingScopes).toContain("issues:create");
      expect(status.missingScopes).not.toContain("read");
    });

    it("marks connection as not connected when token is expired", async () => {
      await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_expired",
        tokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      });

      const status = await service.getLinearConnectionStatus("company-1");

      expect(status.tokenExpired).toBe(true);
      expect(status.connected).toBe(false);
    });

    it("does not return a connection owned by another company", async () => {
      await service.recordLinearConnection({
        companyId: "company-2",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_other",
        externalAccountName: "Other Workspace",
      });

      const status = await service.getLinearConnectionStatus("company-1");
      expect(status.connected).toBe(false);
      expect(status.accountName).toBeNull();
    });

    it("returns null defaultTeamId when not stored", async () => {
      await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "manual_token",
        accessToken: "lin_api",
      });

      const status = await service.getLinearConnectionStatus("company-1");
      expect(status.defaultTeamId).toBeNull();
    });
  });

  // ── disconnectLinear ──────────────────────────────────────────────────────

  describe("disconnectLinear", () => {
    it("disconnects an existing connection and returns true", async () => {
      const conn = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_secret",
      });

      const result = await service.disconnectLinear("company-1", conn.id);
      expect(result).toBe(true);

      const status = await service.getLinearConnectionStatus("company-1");
      expect(status.connected).toBe(false);
    });

    it("returns false for a non-existent connection", async () => {
      const result = await service.disconnectLinear("company-1", "nonexistent");
      expect(result).toBe(false);
    });

    it("enforces company ownership — cannot disconnect another company's connection", async () => {
      const conn = await service.recordLinearConnection({
        companyId: "company-2",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_secret",
      });

      const result = await service.disconnectLinear("company-1", conn.id);
      expect(result).toBe(false);

      const status = await service.getLinearConnectionStatus("company-2");
      expect(status.connected).toBe(true);
    });

    it("clears tokens after disconnect", async () => {
      const conn = await service.recordLinearConnection({
        companyId: "company-1",
        userId: null,
        connectionType: "oauth",
        accessToken: "lin_secret",
      });

      await service.disconnectLinear("company-1", conn.id);

      const status = await service.getLinearConnectionStatus("company-1");
      expect(status.raw?.tokens).toEqual({});
    });
  });

  // ── LINEAR_SCOPE_DESCRIPTIONS ─────────────────────────────────────────────

  describe("LINEAR_SCOPE_DESCRIPTIONS", () => {
    it("has a description for every required scope", () => {
      for (const scope of service.LINEAR_REQUIRED_SCOPES) {
        expect(service.LINEAR_SCOPE_DESCRIPTIONS[scope]).toBeTruthy();
        expect(typeof service.LINEAR_SCOPE_DESCRIPTIONS[scope]).toBe("string");
      }
    });
  });
});
