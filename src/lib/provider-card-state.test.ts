import { describe, expect, it } from "vitest";
import { computeProviderCardState, PROVIDER_DEFS } from "./provider-card-state";
import type { ProviderConnectionSnapshot } from "./provider-card-state";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConnection(
  overrides: Partial<ProviderConnectionSnapshot> = {}
): ProviderConnectionSnapshot {
  return {
    id: "conn-1",
    status: "connected",
    externalAccountName: "my-org",
    externalAccountEmail: "admin@my-org.com",
    lastConnectedAt: new Date("2026-06-28T10:00:00Z"),
    errorMessage: null,
    tokenExpiresAt: null,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("computeProviderCardState", () => {
  // ── Null / no connection ───────────────────────────────────────────────────

  describe("no connection (null)", () => {
    it("returns disconnected state", () => {
      const state = computeProviderCardState(null);
      expect(state.cardStatus).toBe("disconnected");
      expect(state.statusLabel).toBe("Not connected");
      expect(state.isConnected).toBe(false);
    });

    it("returns null for all identity fields", () => {
      const state = computeProviderCardState(null);
      expect(state.connectionId).toBeNull();
      expect(state.accountName).toBeNull();
      expect(state.accountEmail).toBeNull();
      expect(state.lastConnectedAt).toBeNull();
      expect(state.errorMessage).toBeNull();
    });
  });

  // ── Connected ──────────────────────────────────────────────────────────────

  describe("connected status", () => {
    it("returns connected state", () => {
      const state = computeProviderCardState(makeConnection({ status: "connected" }));
      expect(state.cardStatus).toBe("connected");
      expect(state.statusLabel).toBe("Connected");
      expect(state.isConnected).toBe(true);
    });

    it("surfaces account name and email", () => {
      const state = computeProviderCardState(
        makeConnection({ status: "connected", externalAccountName: "Acme", externalAccountEmail: "admin@acme.com" })
      );
      expect(state.accountName).toBe("Acme");
      expect(state.accountEmail).toBe("admin@acme.com");
    });

    it("surfaces connectionId and lastConnectedAt", () => {
      const connectedAt = new Date("2026-06-28T10:00:00Z");
      const state = computeProviderCardState(
        makeConnection({ status: "connected", id: "conn-abc", lastConnectedAt: connectedAt })
      );
      expect(state.connectionId).toBe("conn-abc");
      expect(state.lastConnectedAt).toEqual(connectedAt);
    });

    it("handles null account identity gracefully", () => {
      const state = computeProviderCardState(
        makeConnection({ status: "connected", externalAccountName: null, externalAccountEmail: null })
      );
      expect(state.isConnected).toBe(true);
      expect(state.accountName).toBeNull();
      expect(state.accountEmail).toBeNull();
    });
  });

  // ── Expired ───────────────────────────────────────────────────────────────

  describe("expired token", () => {
    it("marks connected-but-expired token as expired, not connected", () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      const state = computeProviderCardState(
        makeConnection({ status: "connected", tokenExpiresAt: pastDate })
      );
      expect(state.cardStatus).toBe("expired");
      expect(state.statusLabel).toBe("Token expired");
      expect(state.isConnected).toBe(false);
    });

    it("keeps connected when tokenExpiresAt is in the future", () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);
      const state = computeProviderCardState(
        makeConnection({ status: "connected", tokenExpiresAt: futureDate })
      );
      expect(state.cardStatus).toBe("connected");
      expect(state.isConnected).toBe(true);
    });

    it("maps database status expired to expired card state", () => {
      const state = computeProviderCardState(makeConnection({ status: "expired" }));
      expect(state.cardStatus).toBe("expired");
      expect(state.isConnected).toBe(false);
    });
  });

  // ── Error ─────────────────────────────────────────────────────────────────

  describe("error status", () => {
    it("returns error state with error message", () => {
      const state = computeProviderCardState(
        makeConnection({ status: "error", errorMessage: "Token was revoked by provider." })
      );
      expect(state.cardStatus).toBe("error");
      expect(state.statusLabel).toBe("Connection error");
      expect(state.errorMessage).toBe("Token was revoked by provider.");
      expect(state.isConnected).toBe(false);
    });

    it("handles error with null errorMessage", () => {
      const state = computeProviderCardState(makeConnection({ status: "error", errorMessage: null }));
      expect(state.cardStatus).toBe("error");
      expect(state.errorMessage).toBeNull();
    });
  });

  // ── Needs reauth ──────────────────────────────────────────────────────────

  describe("needs_reauth status", () => {
    it("returns needs_reauth state", () => {
      const state = computeProviderCardState(makeConnection({ status: "needs_reauth" }));
      expect(state.cardStatus).toBe("needs_reauth");
      expect(state.statusLabel).toBe("Needs attention");
      expect(state.isConnected).toBe(false);
    });

    it("maps revoked status to needs_reauth", () => {
      const state = computeProviderCardState(makeConnection({ status: "revoked" }));
      expect(state.cardStatus).toBe("needs_reauth");
      expect(state.statusLabel).toBe("Access revoked");
      expect(state.isConnected).toBe(false);
    });
  });

  // ── Disconnected ──────────────────────────────────────────────────────────

  describe("disconnected status", () => {
    it("returns disconnected state from database disconnected status", () => {
      const state = computeProviderCardState(makeConnection({ status: "disconnected" }));
      expect(state.cardStatus).toBe("disconnected");
      expect(state.isConnected).toBe(false);
    });

    it("returns disconnected for unknown status", () => {
      const state = computeProviderCardState(makeConnection({ status: "unknown_future_status" }));
      expect(state.cardStatus).toBe("disconnected");
      expect(state.isConnected).toBe(false);
    });
  });
});

// ─── PROVIDER_DEFS ────────────────────────────────────────────────────────────

describe("PROVIDER_DEFS", () => {
  it("includes github, linear, and vercel", () => {
    const ids = PROVIDER_DEFS.map((p) => p.id);
    expect(ids).toContain("github");
    expect(ids).toContain("linear");
    expect(ids).toContain("vercel");
  });

  it("every provider has required fields", () => {
    for (const p of PROVIDER_DEFS) {
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.requiredScopeSummary).toBeTruthy();
      expect(p.docsUrl).toBeTruthy();
      expect(p.tokenFieldLabel).toBeTruthy();
      expect(p.tokenFieldPlaceholder).toBeTruthy();
    }
  });
});
