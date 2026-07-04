/**
 * Effective permission resolution for the execution worker (Goal 1).
 *
 * The permission level the agent CLI actually runs at is a function of three
 * inputs: the autonomy-derived permission, an explicit operator override
 * (`WORKER_PERMISSION_MODE`), and whether the session is sandboxed. This module
 * makes that decision a pure, tested function instead of an inline ternary in
 * the worker.
 *
 * Safety policy:
 * - An explicit `WORKER_PERMISSION_MODE` override always wins — the operator
 *   asked for a specific level (this preserves the documented un-sandboxed
 *   stopgap where `.env` sets `WORKER_PERMISSION_MODE=execute`).
 * - Inside a sandbox (docker), the agent runs at its full autonomy-derived
 *   level — arbitrary shell access is safe because it is isolated.
 * - Un-sandboxed on the host, a `full` (→ `bypassPermissions`) level is CAPPED
 *   to `execute` by default, because bypassPermissions on the host is what
 *   crashed the dev server. Set `WORKER_ALLOW_UNSANDBOXED_FULL=1` to opt back
 *   into the old (dangerous) behavior.
 */

import type { PermissionLevel } from "@/lib/worker-permissions";
import type { SandboxKind } from "@/lib/adapters/sandbox-runner";

/** Inputs to the effective-permission decision. */
export interface EffectivePermissionInput {
  /** Permission derived from the company's autonomy level. */
  autonomyPermission: PermissionLevel;
  /** Explicit `WORKER_PERMISSION_MODE` override, or null when unset. */
  override: string | null;
  /** Whether the agent runs sandboxed (`docker`) or on the host (`none`). */
  sandboxKind: SandboxKind;
  /** Opt back into un-sandboxed `full` (bypassPermissions on the host). */
  allowUnsandboxedFull: boolean;
}

/** The resolved permission plus a human-readable reason for the worker log. */
export interface EffectivePermissionDecision {
  /** The permission level (or raw override string) the agent will run at. */
  level: string;
  /** True when a `full` level was downgraded for host safety. */
  capped: boolean;
  /** Explanation surfaced in worker logs and the audit trail. */
  reason: string;
}

/**
 * Resolves the permission level the agent CLI should run at for a session.
 *
 * @param input - Autonomy permission, override, sandbox kind, and the opt-out.
 * @returns The effective level with a reason (and whether it was capped).
 */
export function resolveEffectivePermissionLevel(
  input: EffectivePermissionInput
): EffectivePermissionDecision {
  const { autonomyPermission, override, sandboxKind, allowUnsandboxedFull } = input;

  // 1. An explicit operator override wins in every mode — they asked for it.
  if (override) {
    return {
      level: override,
      capped: false,
      reason: `explicit WORKER_PERMISSION_MODE override (${override})`,
    };
  }

  // 2. Sandboxed: run at full autonomy — arbitrary shell is safe when isolated.
  if (sandboxKind === "docker") {
    return {
      level: autonomyPermission,
      capped: false,
      reason: `sandboxed (docker) — running at autonomy-derived '${autonomyPermission}'`,
    };
  }

  // 3. Un-sandboxed host: cap 'full' (bypassPermissions) unless explicitly allowed.
  if (autonomyPermission === "full" && !allowUnsandboxedFull) {
    return {
      level: "execute",
      capped: true,
      reason:
        "un-sandboxed host — capped 'full'→'execute' for host safety " +
        "(set WORKER_SANDBOX=docker to run at full power, or " +
        "WORKER_ALLOW_UNSANDBOXED_FULL=1 to override)",
    };
  }

  return {
    level: autonomyPermission,
    capped: false,
    reason: `un-sandboxed host — autonomy-derived '${autonomyPermission}' is within the safe tier`,
  };
}
