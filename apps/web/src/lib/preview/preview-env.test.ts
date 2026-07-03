import { beforeAll, describe, expect, it } from "vitest";
import {
  parseEnvVars,
  encryptEnvVars,
  decryptEnvVars,
} from "./preview-env";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
});

describe("parseEnvVars", () => {
  it("parses simple KEY=VALUE lines", () => {
    const result = parseEnvVars("FOO=bar\nBAZ=qux");
    expect(result).toEqual({ ok: true, env: { FOO: "bar", BAZ: "qux" } });
  });

  it("keeps '=' inside values", () => {
    const result = parseEnvVars("DATABASE_URL=postgres://u:p@h:5432/db?x=1");
    expect(result).toMatchObject({
      ok: true,
      env: { DATABASE_URL: "postgres://u:p@h:5432/db?x=1" },
    });
  });

  it("skips blank lines and comments, tolerates 'export' and quotes", () => {
    const result = parseEnvVars(
      ["# a comment", "", "export TOKEN='secret'", 'NAME="Ada"'].join("\n")
    );
    expect(result).toEqual({ ok: true, env: { TOKEN: "secret", NAME: "Ada" } });
  });

  it("returns ok with empty env for blank input", () => {
    expect(parseEnvVars("")).toEqual({ ok: true, env: {} });
    expect(parseEnvVars(null)).toEqual({ ok: true, env: {} });
  });

  it("rejects an invalid variable name", () => {
    const result = parseEnvVars("1BAD=x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("invalid variable name");
  });

  it("rejects a line without '='", () => {
    const result = parseEnvVars("JUST_A_KEY");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("KEY=VALUE");
  });
});

describe("encryptEnvVars / decryptEnvVars", () => {
  it("round-trips an env map through encryption", () => {
    const env = { A: "1", DATABASE_URL: "postgres://x" };
    const blob = encryptEnvVars(env);
    expect(blob).not.toContain("postgres://x"); // ciphertext, not plaintext
    expect(decryptEnvVars(blob)).toEqual(env);
  });

  it("returns {} for empty/nullish stored blobs", () => {
    expect(decryptEnvVars(null)).toEqual({});
    expect(decryptEnvVars("")).toEqual({});
  });
});
