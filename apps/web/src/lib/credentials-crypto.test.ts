import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/credentials-crypto";

// A valid 64-char hex (32-byte) key for AES-256-GCM.
const VALID_KEY = "a".repeat(64);
const OTHER_KEY = "b".repeat(64);

describe("credentials-crypto", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = previousKey;
    }
  });

  describe("encryptCredentials", () => {
    it("produces the iv:authTag:ciphertext hex structure", () => {
      const out = encryptCredentials({ apiKey: "secret" });
      const parts = out.split(":");
      expect(parts).toHaveLength(3);
      for (const part of parts) {
        expect(part).toMatch(/^[0-9a-f]+$/);
      }
      // 12-byte IV → 24 hex chars; 16-byte GCM tag → 32 hex chars.
      expect(parts[0]).toHaveLength(24);
      expect(parts[1]).toHaveLength(32);
    });

    it("ciphertext does not contain the plaintext value", () => {
      const out = encryptCredentials({ token: "super-secret-value" });
      expect(out).not.toContain("super-secret-value");
    });

    it("produces a different ciphertext each call (random IV)", () => {
      const a = encryptCredentials({ token: "x" });
      const b = encryptCredentials({ token: "x" });
      expect(a).not.toBe(b);
    });

    it("throws when the key is missing", () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      expect(() => encryptCredentials({ a: "b" })).toThrow(
        /CREDENTIALS_ENCRYPTION_KEY/
      );
    });

    it("throws when the key is not 64 hex characters", () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = "tooshort";
      expect(() => encryptCredentials({ a: "b" })).toThrow(
        /64-character hex/
      );
    });
  });

  describe("round-trip", () => {
    it("decrypts back to the original single-field object", () => {
      const original = { apiKey: "lin_api_123" };
      expect(decryptCredentials(encryptCredentials(original))).toEqual(
        original
      );
    });

    it("decrypts back to the original multi-field object", () => {
      const original = {
        accessToken: "ghp_abc",
        org: "my-org",
        teamId: "team_xyz",
      };
      expect(decryptCredentials(encryptCredentials(original))).toEqual(
        original
      );
    });

    it("round-trips an empty object", () => {
      // encrypt({}) produces ciphertext (not the literal "{}"), decrypts to {}.
      const out = encryptCredentials({});
      expect(out).toContain(":");
      expect(decryptCredentials(out)).toEqual({});
    });

    it("round-trips values containing colons, braces and unicode", () => {
      const original = {
        url: "https://hooks.slack.com/abc:def",
        json: '{"nested":true}',
        emoji: "🚀 ключ",
      };
      expect(decryptCredentials(encryptCredentials(original))).toEqual(
        original
      );
    });
  });

  describe("decryptCredentials — empty and legacy paths", () => {
    it("returns {} for an empty string", () => {
      expect(decryptCredentials("")).toEqual({});
    });

    it("returns {} for the literal '{}'", () => {
      expect(decryptCredentials("{}")).toEqual({});
    });

    it("parses legacy plaintext JSON objects transparently", () => {
      expect(decryptCredentials('{"apiKey":"legacy"}')).toEqual({
        apiKey: "legacy",
      });
    });

    it("returns {} for malformed legacy JSON starting with '{'", () => {
      expect(decryptCredentials("{not valid json")).toEqual({});
    });
  });

  describe("decryptCredentials — malformed / garbage input", () => {
    it("returns {} for a string with too few colon segments", () => {
      expect(decryptCredentials("abc:def")).toEqual({});
    });

    it("returns {} for a string with empty segments", () => {
      expect(decryptCredentials("::")).toEqual({});
    });

    it("returns {} for arbitrary non-hex garbage", () => {
      expect(decryptCredentials("garbage-without-structure")).toEqual({});
    });

    it("returns {} when the auth tag is tampered (GCM integrity fails)", () => {
      const out = encryptCredentials({ token: "secret" });
      const [iv, , ct] = out.split(":");
      const badTag = "f".repeat(32);
      expect(decryptCredentials(`${iv}:${badTag}:${ct}`)).toEqual({});
    });

    it("returns {} when decrypting with a different key", () => {
      const out = encryptCredentials({ token: "secret" });
      process.env.CREDENTIALS_ENCRYPTION_KEY = OTHER_KEY;
      expect(decryptCredentials(out)).toEqual({});
    });

    it("returns {} when the ciphertext is corrupted", () => {
      const out = encryptCredentials({ token: "secret" });
      const [iv, tag, ct] = out.split(":");
      const corrupted = ct.slice(0, -2) + (ct.endsWith("00") ? "ff" : "00");
      expect(decryptCredentials(`${iv}:${tag}:${corrupted}`)).toEqual({});
    });
  });
});
