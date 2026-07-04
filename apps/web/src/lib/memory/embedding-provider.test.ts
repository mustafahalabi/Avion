import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  DeterministicEmbeddingProvider,
  EMBEDDING_DIM,
  hashEmbed,
  resolveEmbeddingProvider,
  tokenize,
} from "./embedding-provider";

describe("tokenize", () => {
  it("lowercases and drops short/non-alphanumeric tokens", () => {
    expect(tokenize("Add a Login Screen!! (v2)")).toEqual(["add", "login", "screen", "v2"]);
  });
});

describe("hashEmbed", () => {
  it("is deterministic and L2-normalized", () => {
    const a = hashEmbed("add a login screen");
    const b = hashEmbed("add a login screen");
    expect(a).toEqual(b);
    expect(a).toHaveLength(EMBEDDING_DIM);
    const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("returns a zero vector for empty/token-less text", () => {
    expect(hashEmbed("!! ?? ,").every((v) => v === 0)).toBe(true);
  });
});

describe("cosineSimilarity", () => {
  it("ranks a related query higher than an unrelated one", () => {
    const query = hashEmbed("add authentication and a login screen");
    const related = hashEmbed("always hash passwords on the login flow");
    const unrelated = hashEmbed("optimize the image thumbnail cache");
    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated)
    );
  });

  it("is 1 for identical vectors and 0 for a zero vector", () => {
    const v = hashEmbed("payment webhook retries");
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(v, hashEmbed(""))).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });
});

describe("resolveEmbeddingProvider", () => {
  it("defaults to the deterministic provider", async () => {
    const p = resolveEmbeddingProvider({});
    expect(p.name).toBe("deterministic-hash");
    expect(await p.embed("x")).toHaveLength(EMBEDDING_DIM);
  });

  it("falls back to deterministic for an unknown provider", () => {
    expect(resolveEmbeddingProvider({ EOS_EMBEDDING_PROVIDER: "some-model" }).name).toBe(
      "deterministic-hash"
    );
  });

  it("DeterministicEmbeddingProvider honors a custom dimension", async () => {
    const p = new DeterministicEmbeddingProvider(64);
    expect(await p.embed("hello world")).toHaveLength(64);
  });
});
