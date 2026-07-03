import { describe, expect, it } from "vitest";
import {
  resolveDevCommand,
  detectPreviewFramework,
} from "./preview-command-resolver";
import type { PackageManagerInfo } from "@/lib/repository-analyzer";

const pm = (name: PackageManagerInfo["name"]): PackageManagerInfo => ({
  name,
  version: null,
  workspaces: [],
});

describe("detectPreviewFramework", () => {
  it("detects next, vite, cra, generic", () => {
    expect(detectPreviewFramework({ dependencies: { next: "16" } })).toBe("next");
    expect(detectPreviewFramework({ devDependencies: { vite: "5" } })).toBe("vite");
    expect(detectPreviewFramework({ dependencies: { "react-scripts": "5" } })).toBe("cra");
    expect(detectPreviewFramework({ dependencies: { express: "4" } })).toBe("generic");
    expect(detectPreviewFramework(null)).toBe("generic");
  });
});

describe("resolveDevCommand", () => {
  it("prefers dev over start and formats for the package manager", () => {
    const result = resolveDevCommand({
      repoPath: "/x",
      readPackageJson: () => ({
        scripts: { dev: "next dev", start: "next start" },
        dependencies: { next: "16" },
      }),
      detectPm: () => pm("pnpm"),
    });
    expect(result).toEqual({
      ok: true,
      command: "pnpm dev",
      packageManager: "pnpm",
      scriptKey: "dev",
      framework: "next",
    });
  });

  it("falls back to start when there is no dev script (npm formatting)", () => {
    const result = resolveDevCommand({
      repoPath: "/x",
      readPackageJson: () => ({ scripts: { start: "node server.js" } }),
      detectPm: () => pm("npm"),
    });
    expect(result).toMatchObject({
      ok: true,
      command: "npm run start",
      scriptKey: "start",
      framework: "generic",
    });
  });

  it("errors when neither dev nor start exists", () => {
    const result = resolveDevCommand({
      repoPath: "/x",
      readPackageJson: () => ({ scripts: { build: "tsc" } }),
      detectPm: () => pm("npm"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("dev");
  });

  it("falls back to snapshot scripts when the checkout package.json is unreadable", () => {
    const result = resolveDevCommand({
      repoPath: "/x",
      readPackageJson: () => null,
      snapshotScripts: { dev: "next dev", build: null, test: null, lint: null, typecheck: null },
    });
    expect(result).toMatchObject({ ok: true, command: "npm run dev", scriptKey: "dev" });
  });

  it("errors when there is no package.json and no snapshot fallback", () => {
    const result = resolveDevCommand({ repoPath: "/x", readPackageJson: () => null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No package.json");
  });
});
