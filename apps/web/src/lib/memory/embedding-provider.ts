/**
 * Embedding provider seam for semantic memory recall (Goal 5c, MUS-268).
 *
 * Memory recall used to rank purely by confidence + recency — it never
 * considered how RELEVANT a lesson is to what's being planned. This module adds
 * a provider seam that turns text into a vector so recall can rank by cosine
 * similarity to the query (the outcome's request).
 *
 * The DEFAULT provider is a deterministic, dependency-free hashing embedding: it
 * needs no external API, is fully offline, and is stable across runs — so
 * semantic recall works out of the box. It captures lexical-semantic overlap
 * (documents sharing vocabulary rank closer), which is already a large step up
 * from recency. A real embedding model (Anthropic/OpenAI/local) plugs in behind
 * the same seam without touching the recall logic — see {@link resolveEmbeddingProvider}.
 *
 * pgvector is the future *scale* optimization (index + store the vectors); the
 * recall computes similarity in-app here, which is correct for the bounded
 * company-memory sets we rank today and needs no DB extension.
 */

/** Default embedding dimensionality for the hashing provider. */
export const EMBEDDING_DIM = 256;

/** A text → vector embedder. Implementations must return a fixed-length vector. */
export interface EmbeddingProvider {
  /** Stable identifier for telemetry (e.g. "deterministic-hash"). */
  readonly name: string;
  /**
   * Embeds text into a numeric vector. Same input → same output for a given
   * provider (deterministic providers), so callers may cache by content hash.
   */
  embed(text: string): Promise<number[]>;
}

/** Splits text into lowercased alphanumeric tokens (length >= 2). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/** FNV-1a 32-bit hash of a token → bucket index. */
function bucket(token: string, dim: number): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % dim;
}

/**
 * Deterministic hashing embedding: a term-frequency bag-of-words hashed into a
 * fixed-dim vector, then L2-normalized so cosine similarity is a dot product.
 * Includes adjacent bigrams so short phrases get a little word-order signal.
 *
 * @param text - Text to embed.
 * @param dim - Vector dimensionality (default {@link EMBEDDING_DIM}).
 * @returns An L2-normalized vector of length `dim`.
 */
export function hashEmbed(text: string, dim: number = EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i++) {
    vec[bucket(tokens[i], dim)] += 1;
    if (i + 1 < tokens.length) {
      vec[bucket(`${tokens[i]}_${tokens[i + 1]}`, dim)] += 1;
    }
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec; // empty/no-token text → zero vector
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

/**
 * Cosine similarity of two vectors (dot product for L2-normalized inputs).
 * Returns 0 when either is a zero vector or lengths differ.
 *
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Similarity in [-1, 1] (0 when undefined).
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** The offline, deterministic default provider. */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = "deterministic-hash";
  private readonly dim: number;

  constructor(dim: number = EMBEDDING_DIM) {
    this.dim = dim;
  }

  async embed(text: string): Promise<number[]> {
    return hashEmbed(text, this.dim);
  }
}

/**
 * Resolves the embedding provider from the environment. Defaults to the
 * deterministic hashing provider. `EOS_EMBEDDING_PROVIDER` is the seam for a real
 * model — unknown/unset values fall back to deterministic (fail-safe: recall
 * never breaks for a missing embedding API).
 *
 * @param env - Environment (defaults to `process.env`).
 * @returns The resolved provider.
 */
export function resolveEmbeddingProvider(
  env: Record<string, string | undefined> = process.env
): EmbeddingProvider {
  const kind = (env.EOS_EMBEDDING_PROVIDER ?? "").trim().toLowerCase();
  // Future real providers register here; deterministic is the safe default.
  switch (kind) {
    case "deterministic":
    case "":
    default:
      return new DeterministicEmbeddingProvider();
  }
}
