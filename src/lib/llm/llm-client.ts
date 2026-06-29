/**
 * Provider-independent LLM abstraction.
 *
 * Engineering OS depends on this interface, never on a concrete model or vendor SDK,
 * honoring the "everything is replaceable" principle (LLMs, providers, runtimes are
 * infrastructure, not product identity). The first implementation shells out to the
 * Claude CLI; future implementations (API clients, local models, other CLIs) can be
 * substituted without touching planning logic.
 */

/** A single text-completion request. */
export interface LlmCompletionRequest {
  /** Optional system prompt establishing role and output contract. */
  readonly system?: string;
  /** User prompt carrying the grounded task and data. */
  readonly prompt: string;
  /** Hard wall-clock budget in seconds; the client must abort and fail past this. */
  readonly timeoutSeconds?: number;
}

/** A successful completion. */
export interface LlmCompletionSuccess {
  readonly ok: true;
  /** Raw model text output (callers extract/validate any structured payload). */
  readonly text: string;
  readonly durationMs: number;
}

/** A failed completion (timeout, non-zero exit, transport error). */
export interface LlmCompletionFailure {
  readonly ok: false;
  readonly error: string;
  readonly durationMs: number;
}

export type LlmCompletion = LlmCompletionSuccess | LlmCompletionFailure;

/** Provider-independent text completion. */
export interface LlmClient {
  /** Stable identifier for telemetry/audit (e.g. "claude-cli"). */
  readonly provider: string;

  /**
   * Runs a single completion.
   *
   * @param request - System/user prompt and timeout budget.
   * @returns A success with the raw text, or a structured failure. Implementations
   * should never throw for expected failure modes (timeout, non-zero exit) — they
   * return {@link LlmCompletionFailure} so callers can fall back deterministically.
   */
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
}
