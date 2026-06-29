import { describe, expect, it } from "vitest";

import {
  assessRepositoryValidation,
  buildEnvironmentProfile,
  buildValidationProfile,
  looksLikeSecret,
  type RepositoryValidationInput,
} from "./repository-validation-profile";
import type { ScriptInfo } from "./repository-analyzer";

const FULL_SCRIPTS: ScriptInfo = {
  dev: "next dev",
  build: "next build",
  test: "vitest run",
  lint: "next lint",
  typecheck: "tsc --noEmit",
};

const EMPTY_SCRIPTS: ScriptInfo = {
  dev: null,
  build: null,
  test: null,
  lint: null,
  typecheck: null,
};

function baseInput(
  overrides: Partial<RepositoryValidationInput> = {}
): RepositoryValidationInput {
  return {
    scripts: FULL_SCRIPTS,
    packageManager: "npm",
    primaryLanguage: "TypeScript",
    frameworks: ["Next.js (App Router)"],
    techStack: ["Prisma"],
    hasAnalysis: true,
    hasPackageManifest: true,
    ...overrides,
  };
}

describe("looksLikeSecret", () => {
  it("flags names containing secret markers", () => {
    expect(looksLikeSecret("STRIPE_SECRET_KEY")).toBe(true);
    expect(looksLikeSecret("GITHUB_TOKEN")).toBe(true);
    expect(looksLikeSecret("DB_PASSWORD")).toBe(true);
    expect(looksLikeSecret("JWT_PRIVATE_KEY")).toBe(true);
    expect(looksLikeSecret("AWS_CREDENTIAL")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(looksLikeSecret("clerk_secret")).toBe(true);
  });

  it("does not flag plain configuration names", () => {
    expect(looksLikeSecret("PORT")).toBe(false);
    expect(looksLikeSecret("NODE_ENV")).toBe(false);
    expect(looksLikeSecret("NEXT_PUBLIC_APP_URL")).toBe(false);
  });
});

describe("buildValidationProfile", () => {
  it("detects lint/typecheck/test/build from a scripts object", () => {
    const profile = buildValidationProfile({
      scripts: FULL_SCRIPTS,
      packageManager: "npm",
      primaryLanguage: "TypeScript",
      frameworks: ["Next.js (App Router)"],
      techStack: ["Prisma"],
    });

    expect(profile.hasLint).toBe(true);
    expect(profile.hasTypecheck).toBe(true);
    expect(profile.hasTest).toBe(true);
    expect(profile.hasBuild).toBe(true);
    expect(profile.profileId).toBe("nextjs-typescript");
    expect(profile.commands.map((c) => c.kind)).toEqual([
      "typecheck",
      "lint",
      "test",
      "build",
    ]);
  });

  it("formats commands for the detected package manager", () => {
    const profile = buildValidationProfile({
      scripts: FULL_SCRIPTS,
      packageManager: "pnpm",
      primaryLanguage: "TypeScript",
      frameworks: ["Next.js (App Router)"],
      techStack: [],
    });
    const test = profile.commands.find((c) => c.kind === "test");
    expect(test?.command).toBe("pnpm test");
    expect(test?.script).toBe("vitest run");
  });

  it("detects nothing when no scripts are present", () => {
    const profile = buildValidationProfile({
      scripts: EMPTY_SCRIPTS,
      packageManager: null,
      primaryLanguage: null,
      frameworks: [],
      techStack: [],
    });
    expect(profile.commands).toHaveLength(0);
    expect(profile.hasTest).toBe(false);
    // Falls back to the generic profile with its canonical commands.
    expect(profile.profileId).toBe("generic");
    expect(profile.profileCommands.length).toBeGreaterThan(0);
  });
});

describe("buildEnvironmentProfile", () => {
  it("classifies referenced vars and marks documented when an example is present", () => {
    const env = buildEnvironmentProfile({
      referencedEnvVars: ["DATABASE_URL", "STRIPE_SECRET_KEY"],
      documentedKeys: ["DATABASE_URL", "STRIPE_SECRET_KEY"],
      hasEnvExample: true,
    });

    expect(env.evidenceAvailable).toBe(true);
    expect(env.documented).toBe(true);
    expect(env.hasEnvExample).toBe(true);
    expect(env.secretReferences).toEqual(["STRIPE_SECRET_KEY"]);
    expect(
      env.referencedEnvVars.find((v) => v.name === "DATABASE_URL")?.isSecret
    ).toBe(false);
  });

  it("reports no evidence when nothing was captured", () => {
    const env = buildEnvironmentProfile({});
    expect(env.evidenceAvailable).toBe(false);
    expect(env.documented).toBe(false);
    expect(env.referencedEnvVars).toHaveLength(0);
  });

  it("treats referenced vars without an example as undocumented but evidenced", () => {
    const env = buildEnvironmentProfile({
      referencedEnvVars: ["API_TOKEN"],
    });
    expect(env.evidenceAvailable).toBe(true);
    expect(env.documented).toBe(false);
    expect(env.secretReferences).toEqual(["API_TOKEN"]);
  });
});

describe("assessRepositoryValidation", () => {
  it("returns ready when validation commands exist and env is documented", () => {
    const result = assessRepositoryValidation(
      baseInput({
        referencedEnvVars: ["DATABASE_URL", "CLERK_SECRET_KEY"],
        documentedKeys: ["DATABASE_URL", "CLERK_SECRET_KEY"],
        hasEnvExample: true,
      })
    );
    expect(result.readiness).toBe("ready");
    expect(result.missing).toHaveLength(0);
  });

  it("returns ready when env evidence is unknown but validation is complete", () => {
    const result = assessRepositoryValidation(baseInput());
    expect(result.readiness).toBe("ready");
    expect(result.unknowns.some((u) => u.includes("Environment"))).toBe(true);
  });

  it("returns partial when secrets are referenced but undocumented", () => {
    const result = assessRepositoryValidation(
      baseInput({
        referencedEnvVars: ["STRIPE_SECRET_KEY"],
        documentedKeys: [],
        hasEnvExample: false,
      })
    );
    expect(result.readiness).toBe("partial");
    expect(
      result.missing.some((m) => m.includes("secret environment reference"))
    ).toBe(true);
  });

  it("returns partial when only a subset of validation commands exist", () => {
    const result = assessRepositoryValidation(
      baseInput({
        scripts: { ...EMPTY_SCRIPTS, test: "vitest run" },
      })
    );
    expect(result.readiness).toBe("partial");
    expect(result.missing).toContain("No typecheck script detected.");
  });

  it("returns blocked when no validation commands exist", () => {
    const result = assessRepositoryValidation(
      baseInput({ scripts: EMPTY_SCRIPTS })
    );
    expect(result.readiness).toBe("blocked");
  });

  it("returns blocked when no manifest is present", () => {
    const result = assessRepositoryValidation(
      baseInput({ hasPackageManifest: false })
    );
    expect(result.readiness).toBe("blocked");
    expect(
      result.missing.some((m) => m.includes("package.json manifest"))
    ).toBe(true);
  });

  it("returns blocked when no analysis snapshot exists", () => {
    const result = assessRepositoryValidation(
      baseInput({ hasAnalysis: false })
    );
    expect(result.readiness).toBe("blocked");
    expect(result.missing).toEqual(["Repository analysis has not been run."]);
  });
});
