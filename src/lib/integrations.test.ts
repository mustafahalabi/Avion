import { describe, expect, it } from "vitest";

import {
  INTEGRATION_PROVIDERS,
  type ProviderConfig,
} from "@/lib/integrations";

const ALLOWED_FIELD_TYPES = new Set(["text", "password"]);

describe("INTEGRATION_PROVIDERS", () => {
  it("defines the four expected providers", () => {
    expect(INTEGRATION_PROVIDERS.map((p) => p.id)).toEqual([
      "linear",
      "github",
      "slack",
      "vercel",
    ]);
  });

  it("has a unique id per provider", () => {
    const ids = INTEGRATION_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every provider non-empty name, description and category", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      expect(provider.name.length).toBeGreaterThan(0);
      expect(provider.description.length).toBeGreaterThan(0);
      expect(provider.category.length).toBeGreaterThan(0);
    }
  });

  it("gives every provider a valid https docs URL", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      expect(provider.docsUrl).toMatch(/^https:\/\//);
    }
  });

  it("gives every provider at least one field", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      expect(provider.fields.length).toBeGreaterThan(0);
    }
  });

  it("uses only allowed field types", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      for (const field of provider.fields) {
        expect(ALLOWED_FIELD_TYPES.has(field.type)).toBe(true);
      }
    }
  });

  it("has unique field keys within each provider", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      const keys = provider.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("gives every field a non-empty key and label", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      for (const field of provider.fields) {
        expect(field.key.length).toBeGreaterThan(0);
        expect(field.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("declares a boolean required flag on every field", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      for (const field of provider.fields) {
        expect(typeof field.required).toBe("boolean");
      }
    }
  });

  it("requires at least one field per provider (a primary credential)", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      expect(provider.fields.some((f) => f.required)).toBe(true);
    }
  });

  it("masks secret credentials with the password field type", () => {
    const linear = INTEGRATION_PROVIDERS.find((p) => p.id === "linear");
    const apiKey = linear?.fields.find((f) => f.key === "apiKey");
    expect(apiKey?.type).toBe("password");
    expect(apiKey?.required).toBe(true);
  });

  it("requires both an access token and an org for GitHub", () => {
    const github = INTEGRATION_PROVIDERS.find((p) => p.id === "github");
    expect(github?.fields.map((f) => f.key)).toEqual(["accessToken", "org"]);
    expect(github?.fields.every((f) => f.required)).toBe(true);
  });

  it("treats optional ids (workspaceId, teamId) as not required", () => {
    const linear = INTEGRATION_PROVIDERS.find((p) => p.id === "linear");
    const workspace = linear?.fields.find((f) => f.key === "workspaceId");
    expect(workspace?.required).toBe(false);

    const vercel = INTEGRATION_PROVIDERS.find((p) => p.id === "vercel");
    const team = vercel?.fields.find((f) => f.key === "teamId");
    expect(team?.required).toBe(false);
  });

  it("models Slack as a single required webhook url", () => {
    const slack = INTEGRATION_PROVIDERS.find((p) => p.id === "slack");
    expect(slack?.fields).toHaveLength(1);
    expect(slack?.fields[0].key).toBe("webhookUrl");
    expect(slack?.fields[0].required).toBe(true);
  });

  it("exposes ProviderConfig as the element type of the providers tuple", () => {
    // Type-level sanity: an element is assignable to ProviderConfig.
    const first: ProviderConfig = INTEGRATION_PROVIDERS[0];
    expect(first.id).toBe("linear");
  });
});
