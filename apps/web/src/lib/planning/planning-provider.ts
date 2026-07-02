import { AiPlanningAdapter } from "./ai-planning-adapter";
import { DeterministicPlanningAdapter } from "./deterministic-planning-adapter";
import type { PlanningAdapter } from "./planning-adapter";
import { ClaudeCliLlmClient } from "@/lib/llm/claude-cli-client";

/** Supported planning providers. */
export type PlanningProviderId = "deterministic" | "ai";

/** Every provider id a per-company override may store (null means "env default"). */
export const PLANNING_PROVIDER_IDS: readonly PlanningProviderId[] = [
  "deterministic",
  "ai",
];

/**
 * Narrows an arbitrary string (e.g. a stored CompanySettings override or form value)
 * to a supported {@link PlanningProviderId}.
 *
 * @param value - Candidate provider id.
 * @returns True when the value names a supported planning provider.
 */
export function isPlanningProviderId(value: string): value is PlanningProviderId {
  return (PLANNING_PROVIDER_IDS as readonly string[]).includes(value);
}

export interface ResolvePlanningAdapterOptions {
  /**
   * Explicit provider override (e.g. a future per-company setting). When omitted, the
   * resolver reads the `EOS_PLANNING_PROVIDER` environment variable, then defaults to
   * deterministic. Keeps existing behavior unchanged until a company/operator opts in.
   */
  readonly provider?: string | null;
}

/**
 * Resolves the configured planning provider id, defaulting to deterministic.
 *
 * @param options - Optional explicit override.
 * @returns "ai" only when explicitly configured; otherwise "deterministic".
 */
export function resolvePlanningProviderId(
  options?: ResolvePlanningAdapterOptions
): PlanningProviderId {
  const raw = (
    options?.provider ??
    process.env.EOS_PLANNING_PROVIDER ??
    "deterministic"
  )
    .toString()
    .trim()
    .toLowerCase();
  return raw === "ai" ? "ai" : "deterministic";
}

/**
 * Resolves the {@link PlanningAdapter} to use for a generation.
 *
 * Deterministic by default. The AI adapter (which itself falls back to deterministic on any
 * failure) is returned only when explicitly configured via `EOS_PLANNING_PROVIDER=ai` or an
 * override, so default behavior and the full test suite are unaffected until opted in.
 *
 * @param options - Optional explicit provider override.
 * @returns A ready-to-use planning adapter.
 */
export function resolvePlanningAdapter(
  options?: ResolvePlanningAdapterOptions
): PlanningAdapter {
  const id = resolvePlanningProviderId(options);
  if (id === "ai") {
    return createAiPlanningAdapter();
  }
  return new DeterministicPlanningAdapter();
}

/**
 * Builds the AI planning adapter with its production dependencies (Claude CLI LLM client),
 * wrapping the deterministic adapter as its fallback. Only constructed when the AI provider
 * is explicitly selected; the adapter itself falls back to deterministic on any failure.
 */
function createAiPlanningAdapter(): PlanningAdapter {
  return new AiPlanningAdapter({
    llm: new ClaudeCliLlmClient(),
    fallback: new DeterministicPlanningAdapter(),
  });
}
