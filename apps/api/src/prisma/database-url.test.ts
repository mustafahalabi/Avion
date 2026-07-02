import { describe, expect, it } from "vitest";

import { resolveApiDatabaseUrl } from "./database-url";

const RO_URL = "postgresql://avion_api_ro:secret@localhost:5433/avion";
const ADMIN_URL = "postgresql://postgres:postgres@localhost:5433/avion";

describe("resolveApiDatabaseUrl", () => {
  it("prefers API_DATABASE_URL when set", () => {
    const resolved = resolveApiDatabaseUrl({ API_DATABASE_URL: RO_URL, DATABASE_URL: ADMIN_URL });
    expect(resolved).toEqual({ url: RO_URL, source: "API_DATABASE_URL" });
  });

  it("falls back to DATABASE_URL when API_DATABASE_URL is absent or blank", () => {
    expect(resolveApiDatabaseUrl({ DATABASE_URL: ADMIN_URL })).toEqual({
      url: ADMIN_URL,
      source: "DATABASE_URL",
    });
    expect(resolveApiDatabaseUrl({ API_DATABASE_URL: "   ", DATABASE_URL: ADMIN_URL })).toEqual({
      url: ADMIN_URL,
      source: "DATABASE_URL",
    });
  });

  it("throws a setup-pointing error when neither is set", () => {
    expect(() => resolveApiDatabaseUrl({})).toThrow(/API_DATABASE_URL nor DATABASE_URL/);
  });
});
