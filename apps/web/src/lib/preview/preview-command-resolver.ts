import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  detectPackageManager,
  formatPackageScriptCommand,
  type PackageManagerInfo,
  type ScriptInfo,
} from "@/lib/repository-analyzer";
import type { PreviewFramework } from "@/lib/preview/preview-port";

/**
 * Resolves how to start a repository's dev server from a checkout: which script
 * to run (`dev` preferred, else `start`), the package manager, and the framework
 * kind (so the port can be forwarded correctly). Reads the checkout's real
 * `package.json` — running `<pm> run dev` gets npm-lifecycle + local
 * `node_modules/.bin` resolution right, unlike executing the raw script value.
 */

export interface ResolvedDevCommand {
  /** Base command WITHOUT port args — the runner appends framework port flags. */
  command: string;
  packageManager: PackageManagerInfo["name"];
  scriptKey: "dev" | "start";
  framework: PreviewFramework;
}

export type ResolveDevCommandResult =
  | ({ ok: true } & ResolvedDevCommand)
  | { ok: false; error: string };

/** Default reader — parses `<repoPath>/package.json`, or null when absent/invalid. */
function defaultReadPackageJson(repoPath: string): Record<string, unknown> | null {
  const file = join(repoPath, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Classifies the framework from a package.json's combined dependencies. */
export function detectPreviewFramework(
  pkg: Record<string, unknown> | null
): PreviewFramework {
  if (!pkg) return "generic";
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  if (deps.next) return "next";
  if (deps.vite) return "vite";
  if (deps["react-scripts"]) return "cra";
  return "generic";
}

export function resolveDevCommand(input: {
  repoPath: string;
  /** Latest analysis snapshot scripts — a weak fallback if the checkout is unreadable. */
  snapshotScripts?: ScriptInfo | null;
  readPackageJson?: (repoPath: string) => Record<string, unknown> | null;
  detectPm?: (repoPath: string) => PackageManagerInfo;
}): ResolveDevCommandResult {
  const readPackageJson = input.readPackageJson ?? defaultReadPackageJson;
  const detectPm = input.detectPm ?? detectPackageManager;

  const pkg = readPackageJson(input.repoPath);

  if (pkg) {
    const scripts =
      pkg.scripts && typeof pkg.scripts === "object"
        ? (pkg.scripts as Record<string, unknown>)
        : {};
    const hasDev = typeof scripts.dev === "string" && scripts.dev.length > 0;
    const hasStart = typeof scripts.start === "string" && scripts.start.length > 0;
    const scriptKey: "dev" | "start" | null = hasDev
      ? "dev"
      : hasStart
        ? "start"
        : null;

    if (!scriptKey) {
      return {
        ok: false,
        error: "No \"dev\" or \"start\" script found in package.json.",
      };
    }

    const pm = detectPm(input.repoPath).name;
    return {
      ok: true,
      command: formatPackageScriptCommand(pm, scriptKey),
      packageManager: pm,
      scriptKey,
      framework: detectPreviewFramework(pkg),
    };
  }

  // Checkout package.json unreadable — best-effort fallback to the snapshot's
  // recorded dev/start script (we can't know the PM/framework, so assume npm).
  if (input.snapshotScripts?.dev) {
    return {
      ok: true,
      command: formatPackageScriptCommand("npm", "dev"),
      packageManager: "npm",
      scriptKey: "dev",
      framework: "generic",
    };
  }

  return {
    ok: false,
    error: "No package.json found in the repository; cannot start a dev server.",
  };
}
