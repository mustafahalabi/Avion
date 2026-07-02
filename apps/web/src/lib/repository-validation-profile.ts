/**
 * Repository Validation & Environment — pure core.
 *
 * Derives an Environment Profile, a Validation Profile, and an overall readiness
 * assessment from ALREADY-INGESTED repository analysis data. This module performs
 * NO I/O (no Prisma, no filesystem): every input is passed in as a typed argument
 * by the caller (`repository-validation-service.ts`). It invents no data the
 * analyzer does not have — anything unknown is reported as an explicit unknown.
 */

import {
  formatPackageScriptCommand,
  type PackageManagerInfo,
  type ScriptInfo,
} from "@/lib/repository-analyzer";
import { detectProfile, getCommandsForRepo } from "@/lib/check-command-profile";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Substrings that, when present in an env-var name, flag it as a likely secret. */
const SECRET_NAME_MARKERS = [
  "SECRET",
  "TOKEN",
  "KEY",
  "PASSWORD",
  "PRIVATE",
  "CREDENTIAL",
] as const;

/** A single environment variable referenced by the repository. */
export interface EnvVarReference {
  /** Variable name (e.g. `STRIPE_SECRET_KEY`). */
  readonly name: string;
  /** True when the name heuristically looks like a secret. */
  readonly isSecret: boolean;
}

/**
 * Environment requirements derived from analysis evidence.
 *
 * When the analyzer captured no environment signal at all,
 * `evidenceAvailable` is false and the caller should treat the environment as
 * unknown rather than as "undocumented".
 */
export interface EnvironmentProfile {
  /** Env vars referenced in code / config, classified by secret-likeness. */
  readonly referencedEnvVars: readonly EnvVarReference[];
  /** Keys documented in a committed `.env.example` (or equivalent). */
  readonly documentedKeys: readonly string[];
  /** Names of referenced vars that look like secrets. */
  readonly secretReferences: readonly string[];
  /** True when a `.env.example` (or documented key set) was detected. */
  readonly hasEnvExample: boolean;
  /** True when the environment is considered documented. */
  readonly documented: boolean;
  /** True when ANY environment evidence was available to assess. */
  readonly evidenceAvailable: boolean;
}

/** A validation command detected from the repository's package scripts. */
export interface DetectedValidationCommand {
  /** Category of the command. */
  readonly kind: "lint" | "typecheck" | "test" | "build";
  /** Suggested shell command to run, formatted for the package manager. */
  readonly command: string;
  /** The underlying `package.json` script body that evidences the command. */
  readonly script: string;
}

/** Detected lint / typecheck / test / build capabilities for the repository. */
export interface ValidationProfile {
  /** Detected check-command profile id (e.g. `nextjs-typescript`). */
  readonly profileId: string;
  /** Human-readable profile name. */
  readonly profileName: string;
  /** Detected validation commands, in run order. */
  readonly commands: readonly DetectedValidationCommand[];
  /** Canonical worker validation commands for the detected profile. */
  readonly profileCommands: readonly string[];
  readonly hasLint: boolean;
  readonly hasTypecheck: boolean;
  readonly hasTest: boolean;
  readonly hasBuild: boolean;
}

/** Overall readiness assessment combining environment + validation signals. */
export interface RepositoryValidationAssessment {
  readonly readiness: "ready" | "partial" | "blocked";
  readonly environment: EnvironmentProfile;
  readonly validation: ValidationProfile;
  readonly missing: readonly string[];
  readonly unknowns: readonly string[];
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

/** Inputs needed to build the validation profile. */
export interface ValidationProfileInput {
  /** Parsed package scripts from the latest snapshot, or null when absent. */
  readonly scripts: ScriptInfo | null;
  /** Detected package manager name, or null when unknown. */
  readonly packageManager: PackageManagerInfo["name"] | null;
  readonly primaryLanguage: string | null;
  readonly frameworks: readonly string[];
  readonly techStack: readonly string[];
}

/** Inputs needed to build the environment profile. */
export interface EnvironmentProfileInput {
  /** Env vars referenced in code/config; `undefined`/`null` means not captured. */
  readonly referencedEnvVars?: readonly string[] | null;
  /** Keys documented in `.env.example`; `undefined`/`null` means not captured. */
  readonly documentedKeys?: readonly string[] | null;
  /** Whether a `.env.example` file was detected; `undefined`/`null` = unknown. */
  readonly hasEnvExample?: boolean | null;
}

/** Full input to {@link assessRepositoryValidation}. */
export interface RepositoryValidationInput
  extends ValidationProfileInput,
    EnvironmentProfileInput {
  /** Whether a repository analysis snapshot exists at all. */
  readonly hasAnalysis: boolean;
  /** Whether a `package.json` manifest was detected. */
  readonly hasPackageManifest: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Heuristically decides whether an environment variable name looks like a secret.
 *
 * Matches (case-insensitively) any of: SECRET, TOKEN, KEY, PASSWORD, PRIVATE,
 * CREDENTIAL. This is intentionally a heuristic, not an authoritative classifier.
 *
 * @param name - Environment variable name.
 * @returns True when the name resembles a secret reference.
 *
 * @example
 * looksLikeSecret("STRIPE_SECRET_KEY"); // → true
 * looksLikeSecret("PORT");              // → false
 */
export function looksLikeSecret(name: string): boolean {
  const upper = name.toUpperCase();
  return SECRET_NAME_MARKERS.some((marker) => upper.includes(marker));
}

function dedupeSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}

// ─── Environment Profile ──────────────────────────────────────────────────────

/**
 * Builds an environment profile from already-parsed analysis evidence.
 * Reads nothing; classifies only what the caller provides.
 *
 * @param input - Env-var references, documented keys, and `.env.example` evidence.
 * @returns Structured environment profile with explicit evidence flags.
 */
export function buildEnvironmentProfile(
  input: EnvironmentProfileInput
): EnvironmentProfile {
  const referencedNames = dedupeSorted(input.referencedEnvVars ?? []);
  const documentedKeys = dedupeSorted(input.documentedKeys ?? []);

  const referencedEnvVars: readonly EnvVarReference[] = referencedNames.map(
    (name) => ({ name, isSecret: looksLikeSecret(name) })
  );
  const secretReferences = referencedEnvVars
    .filter((reference) => reference.isSecret)
    .map((reference) => reference.name);

  const hasEnvExample = input.hasEnvExample === true || documentedKeys.length > 0;

  const evidenceAvailable =
    input.hasEnvExample !== undefined && input.hasEnvExample !== null
      ? true
      : referencedNames.length > 0 ||
        documentedKeys.length > 0 ||
        (input.referencedEnvVars !== undefined &&
          input.referencedEnvVars !== null) ||
        (input.documentedKeys !== undefined && input.documentedKeys !== null);

  return {
    referencedEnvVars,
    documentedKeys,
    secretReferences,
    hasEnvExample,
    documented: hasEnvExample,
    evidenceAvailable,
  };
}

// ─── Validation Profile ───────────────────────────────────────────────────────

/**
 * Builds a validation profile from package scripts and repository metadata.
 *
 * Reuses {@link detectProfile} / {@link getCommandsForRepo} for the canonical
 * worker command set and {@link formatPackageScriptCommand} for the per-package
 * manager script invocations. A capability is "detected" only when the matching
 * package script is actually present in the snapshot.
 *
 * @param input - Parsed scripts plus framework / language metadata.
 * @returns Detected validation capabilities and commands.
 */
export function buildValidationProfile(
  input: ValidationProfileInput
): ValidationProfile {
  const packageManager: PackageManagerInfo["name"] =
    input.packageManager ?? "npm";
  // The repository analyzer stores framework names with qualifiers, e.g.
  // "Next.js (App Router)" (see repository-analyzer FrameworkInfo.name). detectProfile
  // matches framework tokens exactly (case-insensitive), so we also expose the base
  // name ("Next.js") to keep detection working against real analyzer output.
  const expandNames = (names: readonly string[] | undefined): string[] => {
    if (!names) return [];
    const out = new Set<string>();
    for (const name of names) {
      out.add(name);
      const base = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (base) out.add(base);
    }
    return [...out];
  };
  const repoMetadata = {
    primaryLanguage: input.primaryLanguage,
    frameworks: expandNames(input.frameworks),
    techStack: expandNames(input.techStack),
  };
  const profile = detectProfile(repoMetadata);

  const commands: DetectedValidationCommand[] = [];
  const addCommand = (
    kind: DetectedValidationCommand["kind"],
    script: string | null
  ): void => {
    if (script && script.length > 0) {
      commands.push({
        kind,
        command: formatPackageScriptCommand(packageManager, kind),
        script,
      });
    }
  };

  const scripts = input.scripts;
  if (scripts) {
    addCommand("typecheck", scripts.typecheck);
    addCommand("lint", scripts.lint);
    addCommand("test", scripts.test);
    addCommand("build", scripts.build);
  }

  const has = (kind: DetectedValidationCommand["kind"]): boolean =>
    commands.some((command) => command.kind === kind);

  return {
    profileId: profile.id,
    profileName: profile.name,
    commands,
    profileCommands: getCommandsForRepo(repoMetadata).map((c) => c.command),
    hasLint: has("lint"),
    hasTypecheck: has("typecheck"),
    hasTest: has("test"),
    hasBuild: has("build"),
  };
}

// ─── Assessment ───────────────────────────────────────────────────────────────

/**
 * Assesses repository validation readiness from already-parsed analysis inputs.
 *
 * Readiness is derived from whether validation commands exist and whether the
 * environment is documented:
 * - `blocked` — no analysis, no manifest, or no validation commands at all.
 * - `ready` — a test command plus at least one of typecheck/lint/build, with no
 *   undocumented secret references and no documented-but-required env gap.
 * - `partial` — some signal exists but the above bar is not fully met.
 *
 * @param input - Parsed validation + environment inputs.
 * @returns The structured readiness assessment with explicit missing/unknown lists.
 */
export function assessRepositoryValidation(
  input: RepositoryValidationInput
): RepositoryValidationAssessment {
  const validation = buildValidationProfile(input);
  const environment = buildEnvironmentProfile(input);

  const missing: string[] = [];
  const unknowns: string[] = [];

  if (!input.hasAnalysis) {
    return {
      readiness: "blocked",
      environment,
      validation,
      missing: ["Repository analysis has not been run."],
      unknowns: [
        "No repository analysis snapshot exists yet — run analysis to assess validation readiness.",
      ],
    };
  }

  if (!input.hasPackageManifest) {
    missing.push(
      "No package.json manifest detected — validation commands cannot be determined."
    );
  }
  if (!validation.hasTest) missing.push("No test script detected.");
  if (!validation.hasTypecheck) missing.push("No typecheck script detected.");
  if (!validation.hasLint) missing.push("No lint script detected.");
  if (!validation.hasBuild) missing.push("No build script detected.");

  // ── Environment evaluation ──────────────────────────────────────────────────
  const undocumentedSecrets = environment.secretReferences.filter(
    (name) => !environment.documentedKeys.includes(name)
  );

  if (!environment.evidenceAvailable) {
    unknowns.push(
      "Environment requirements are unknown — analysis captured no .env.example or referenced environment variables."
    );
  } else {
    if (
      environment.referencedEnvVars.length > 0 &&
      !environment.documented
    ) {
      missing.push(
        "Referenced environment variables are not documented in a .env.example file."
      );
    }
    if (undocumentedSecrets.length > 0) {
      missing.push(
        `${undocumentedSecrets.length} secret environment reference(s) are not documented.`
      );
    }
  }

  // ── Readiness derivation ────────────────────────────────────────────────────
  const hasAnyValidation = validation.commands.length > 0;
  const hasCoreValidation =
    validation.hasTest &&
    (validation.hasTypecheck || validation.hasLint || validation.hasBuild);
  const environmentBlocks =
    environment.evidenceAvailable &&
    environment.referencedEnvVars.length > 0 &&
    !environment.documented;

  let readiness: RepositoryValidationAssessment["readiness"];
  if (!input.hasPackageManifest || !hasAnyValidation) {
    readiness = "blocked";
  } else if (
    hasCoreValidation &&
    !environmentBlocks &&
    undocumentedSecrets.length === 0
  ) {
    readiness = "ready";
  } else {
    readiness = "partial";
  }

  return { readiness, environment, validation, missing, unknowns };
}
