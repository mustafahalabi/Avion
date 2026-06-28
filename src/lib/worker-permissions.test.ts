import { describe, expect, it } from "vitest";

import {
  AUTONOMY_LEVELS,
  PERMISSION_LEVELS,
  getWorkerPermissions,
  validateCommand,
  validateFileAccess,
  type AutonomyLevel,
  type PermissionLevel,
  type ValidationResult,
  type WorkerPermissions,
} from "./worker-permissions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal WorkerPermissions for ad-hoc testing. */
function makePermissions(
  overrides: Partial<WorkerPermissions> = {}
): WorkerPermissions {
  return {
    permissionLevel: "execute",
    allowedFilePatterns: ["src/**", "tests/**"],
    blockedFilePatterns: [".env", ".env.*", "*.key", "prisma/migrations/**"],
    allowedCommands: ["npm", "npx", "git add"],
    blockedCommands: ["rm -rf", "curl", "wget"],
    maxFilesPerSession: 50,
    requiresApprovalAbove: 20,
    ...overrides,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe("PERMISSION_LEVELS", () => {
  it("exports the four expected levels in order", () => {
    expect(PERMISSION_LEVELS).toEqual(["read_only", "suggest", "execute", "full"]);
  });
});

describe("AUTONOMY_LEVELS", () => {
  it("exports the five expected autonomy levels in order", () => {
    expect(AUTONOMY_LEVELS).toEqual([
      "manual",
      "suggest",
      "assist",
      "delegate",
      "autonomous",
    ]);
  });
});

// ─── getWorkerPermissions ─────────────────────────────────────────────────────

describe("getWorkerPermissions", () => {
  it("maps 'manual' to read_only", () => {
    const p = getWorkerPermissions("manual");
    expect(p.permissionLevel).toBe<PermissionLevel>("read_only");
  });

  it("maps 'suggest' to suggest", () => {
    const p = getWorkerPermissions("suggest");
    expect(p.permissionLevel).toBe<PermissionLevel>("suggest");
  });

  it("maps 'assist' to execute", () => {
    const p = getWorkerPermissions("assist");
    expect(p.permissionLevel).toBe<PermissionLevel>("execute");
  });

  it("maps 'delegate' to full", () => {
    const p = getWorkerPermissions("delegate");
    expect(p.permissionLevel).toBe<PermissionLevel>("full");
  });

  it("maps 'autonomous' to full", () => {
    const p = getWorkerPermissions("autonomous");
    expect(p.permissionLevel).toBe<PermissionLevel>("full");
  });

  it("falls back to read_only for unknown autonomy level", () => {
    const p = getWorkerPermissions("unknown-level");
    expect(p.permissionLevel).toBe<PermissionLevel>("read_only");
  });

  it("falls back to read_only for empty string", () => {
    const p = getWorkerPermissions("");
    expect(p.permissionLevel).toBe<PermissionLevel>("read_only");
  });

  it("covers all known autonomy levels without throwing", () => {
    for (const level of AUTONOMY_LEVELS as readonly AutonomyLevel[]) {
      expect(() => getWorkerPermissions(level)).not.toThrow();
    }
  });

  describe("read_only profile (manual)", () => {
    it("has empty allowedFilePatterns", () => {
      expect(getWorkerPermissions("manual").allowedFilePatterns).toHaveLength(0);
    });

    it("has empty allowedCommands", () => {
      expect(getWorkerPermissions("manual").allowedCommands).toHaveLength(0);
    });

    it("has maxFilesPerSession of 0", () => {
      expect(getWorkerPermissions("manual").maxFilesPerSession).toBe(0);
    });

    it("has requiresApprovalAbove of 0", () => {
      expect(getWorkerPermissions("manual").requiresApprovalAbove).toBe(0);
    });

    it("blocks default secrets patterns", () => {
      const p = getWorkerPermissions("manual");
      expect(p.blockedFilePatterns).toContain(".env");
      expect(p.blockedFilePatterns).toContain("*.key");
      expect(p.blockedFilePatterns).toContain("prisma/migrations/**");
    });
  });

  describe("suggest profile", () => {
    it("has empty allowedFilePatterns (no writes)", () => {
      expect(getWorkerPermissions("suggest").allowedFilePatterns).toHaveLength(0);
    });

    it("allows read-only validation commands", () => {
      const p = getWorkerPermissions("suggest");
      expect(p.allowedCommands).toContain("npm run lint");
      expect(p.allowedCommands).toContain("npx tsc --noEmit");
    });
  });

  describe("execute profile (assist)", () => {
    it("allows src/** writes", () => {
      const p = getWorkerPermissions("assist");
      expect(p.allowedFilePatterns).toContain("src/**");
    });

    it("allows tests/** writes", () => {
      const p = getWorkerPermissions("assist");
      expect(p.allowedFilePatterns).toContain("tests/**");
    });

    it("allows npm and npx commands", () => {
      const p = getWorkerPermissions("assist");
      expect(p.allowedCommands).toContain("npm");
      expect(p.allowedCommands).toContain("npx");
    });

    it("has a positive maxFilesPerSession", () => {
      expect(getWorkerPermissions("assist").maxFilesPerSession).toBeGreaterThan(0);
    });

    it("has requiresApprovalAbove less than maxFilesPerSession", () => {
      const p = getWorkerPermissions("assist");
      expect(p.requiresApprovalAbove).toBeLessThan(p.maxFilesPerSession);
    });
  });

  describe("full profile (delegate / autonomous)", () => {
    it("allows docs/** writes", () => {
      const p = getWorkerPermissions("delegate");
      expect(p.allowedFilePatterns).toContain("docs/**");
    });

    it("allows gh command", () => {
      const p = getWorkerPermissions("delegate");
      expect(p.allowedCommands).toContain("gh");
    });

    it("has a higher maxFilesPerSession than execute profile", () => {
      const execute = getWorkerPermissions("assist");
      const full = getWorkerPermissions("delegate");
      expect(full.maxFilesPerSession).toBeGreaterThan(execute.maxFilesPerSession);
    });

    it("returns the same profile for delegate and autonomous", () => {
      const delegate = getWorkerPermissions("delegate");
      const autonomous = getWorkerPermissions("autonomous");
      expect(delegate).toBe(autonomous); // same object reference (shared constant)
    });
  });
});

// ─── validateFileAccess ───────────────────────────────────────────────────────

describe("validateFileAccess", () => {
  // ── read_only level ──────────────────────────────────────────────────────────

  describe("read_only permission level", () => {
    const readOnly = makePermissions({
      permissionLevel: "read_only",
      allowedFilePatterns: ["src/**"],
    });

    it("blocks any file write", () => {
      const result = validateFileAccess("src/lib/foo.ts", readOnly);
      expect(result.allowed).toBe(false);
    });

    it("includes permission level in reason", () => {
      const result = validateFileAccess("src/lib/foo.ts", readOnly);
      expect(result.reason).toContain("read_only");
    });
  });

  // ── suggest level ────────────────────────────────────────────────────────────

  describe("suggest permission level", () => {
    const suggest = makePermissions({
      permissionLevel: "suggest",
      allowedFilePatterns: ["src/**"],
    });

    it("blocks any file write", () => {
      const result = validateFileAccess("src/lib/foo.ts", suggest);
      expect(result.allowed).toBe(false);
    });

    it("includes permission level in reason", () => {
      const result = validateFileAccess("src/lib/foo.ts", suggest);
      expect(result.reason).toContain("suggest");
    });
  });

  // ── execute / full levels ─────────────────────────────────────────────────

  describe("execute permission level — allowed paths", () => {
    const perms = makePermissions();

    it("allows src/ file", () => {
      expect(validateFileAccess("src/lib/foo.ts", perms).allowed).toBe(true);
    });

    it("allows deeply nested src/ file", () => {
      expect(validateFileAccess("src/app/actions/my-action.ts", perms).allowed).toBe(true);
    });

    it("allows tests/ file", () => {
      expect(validateFileAccess("tests/unit/bar.test.ts", perms).allowed).toBe(true);
    });
  });

  describe("execute permission level — blocked paths win over allowed", () => {
    const perms = makePermissions({
      allowedFilePatterns: ["src/**", ".env*"],
      blockedFilePatterns: [".env", ".env.*"],
    });

    it("blocks .env even when .env* is in allowedFilePatterns", () => {
      expect(validateFileAccess(".env", perms).allowed).toBe(false);
    });

    it("blocks .env.local", () => {
      expect(validateFileAccess(".env.local", perms).allowed).toBe(false);
    });

    it("includes 'blocked pattern' in reason", () => {
      const result = validateFileAccess(".env", perms);
      expect(result.reason).toContain("blocked pattern");
    });
  });

  describe("execute permission level — paths not in allowed list", () => {
    const perms = makePermissions();

    it("blocks a file outside allowed patterns", () => {
      expect(validateFileAccess("random-root-file.txt", perms).allowed).toBe(false);
    });

    it("blocks prisma migration file", () => {
      expect(
        validateFileAccess("prisma/migrations/20240101_init/migration.sql", perms).allowed
      ).toBe(false);
    });

    it("includes 'does not match any allowed' in reason when not blocked but not allowed", () => {
      const result = validateFileAccess("random-root-file.txt", perms);
      expect(result.reason).toContain("does not match any allowed");
    });
  });

  describe("glob pattern matching — blocked list", () => {
    const perms = getWorkerPermissions("assist");

    it("blocks .env (exact)", () => {
      expect(validateFileAccess(".env", perms).allowed).toBe(false);
    });

    it("blocks .env.production (wildcard .env.*)", () => {
      expect(validateFileAccess(".env.production", perms).allowed).toBe(false);
    });

    it("blocks secrets.key (*.key wildcard)", () => {
      expect(validateFileAccess("secrets.key", perms).allowed).toBe(false);
    });

    it("blocks server.pem (*.pem wildcard)", () => {
      expect(validateFileAccess("server.pem", perms).allowed).toBe(false);
    });

    it("blocks prisma/migrations/init/migration.sql (**)", () => {
      expect(
        validateFileAccess("prisma/migrations/init/migration.sql", perms).allowed
      ).toBe(false);
    });

    it("blocks node_modules/some-pkg/index.js (**)", () => {
      expect(validateFileAccess("node_modules/some-pkg/index.js", perms).allowed).toBe(false);
    });
  });

  describe("glob pattern matching — allowed list (execute profile)", () => {
    const perms = getWorkerPermissions("assist");

    it("allows src/lib/worker-permissions.ts", () => {
      expect(validateFileAccess("src/lib/worker-permissions.ts", perms).allowed).toBe(true);
    });

    it("allows package.json (exact)", () => {
      expect(validateFileAccess("package.json", perms).allowed).toBe(true);
    });

    it("allows vitest.config.ts (vitest.config.*)", () => {
      expect(validateFileAccess("vitest.config.ts", perms).allowed).toBe(true);
    });

    it("allows tsconfig.build.json (tsconfig*.json)", () => {
      expect(validateFileAccess("tsconfig.build.json", perms).allowed).toBe(true);
    });
  });

  describe("allowed returns true with correct reason", () => {
    const perms = makePermissions();

    it("includes 'permitted' in reason when allowed", () => {
      const result = validateFileAccess("src/foo.ts", perms);
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain("permitted");
    });
  });
});

// ─── validateCommand ──────────────────────────────────────────────────────────

describe("validateCommand", () => {
  // ── read_only level ──────────────────────────────────────────────────────────

  describe("read_only permission level", () => {
    const readOnly = makePermissions({
      permissionLevel: "read_only",
      allowedCommands: ["npm"],
    });

    it("blocks all commands", () => {
      expect(validateCommand("npm run test", readOnly).allowed).toBe(false);
    });

    it("includes 'read_only' in reason", () => {
      expect(validateCommand("npm run test", readOnly).reason).toContain("read_only");
    });
  });

  // ── suggest level allows a subset ────────────────────────────────────────────

  describe("suggest permission level", () => {
    const suggest = getWorkerPermissions("suggest");

    it("allows npx tsc --noEmit (exact match)", () => {
      expect(validateCommand("npx tsc --noEmit", suggest).allowed).toBe(true);
    });

    it("allows npm run lint (exact match)", () => {
      expect(validateCommand("npm run lint", suggest).allowed).toBe(true);
    });

    it("blocks npm install (not in allowed list)", () => {
      expect(validateCommand("npm install", suggest).allowed).toBe(false);
    });
  });

  // ── execute / full: blocked list ─────────────────────────────────────────────

  describe("blocked commands take precedence", () => {
    const perms = makePermissions({
      allowedCommands: ["npm", "rm"],
      blockedCommands: ["rm -rf", "curl"],
    });

    it("blocks rm -rf even when rm is in allowedCommands", () => {
      expect(validateCommand("rm -rf /", perms).allowed).toBe(false);
    });

    it("includes blocked string in reason", () => {
      const result = validateCommand("rm -rf /", perms);
      expect(result.reason).toContain("rm -rf");
    });

    it("blocks curl even mid-command", () => {
      expect(validateCommand("bash -c 'curl evil.com'", perms).allowed).toBe(false);
    });
  });

  // ── execute profile: allowed commands ────────────────────────────────────────

  describe("execute profile allowed commands", () => {
    const perms = getWorkerPermissions("assist");

    it("allows 'npm run test'", () => {
      expect(validateCommand("npm run test", perms).allowed).toBe(true);
    });

    it("allows 'npx prisma generate'", () => {
      expect(validateCommand("npx prisma generate", perms).allowed).toBe(true);
    });

    it("allows 'git add src/lib/foo.ts'", () => {
      expect(validateCommand("git add src/lib/foo.ts", perms).allowed).toBe(true);
    });

    it("allows 'node scripts/seed.js'", () => {
      expect(validateCommand("node scripts/seed.js", perms).allowed).toBe(true);
    });
  });

  // ── execute profile: disallowed commands ─────────────────────────────────────

  describe("execute profile disallowed commands", () => {
    const perms = getWorkerPermissions("assist");

    it("blocks 'gh pr create' (gh not in execute allowed list)", () => {
      expect(validateCommand("gh pr create", perms).allowed).toBe(false);
    });

    it("blocks 'docker build .'", () => {
      expect(validateCommand("docker build .", perms).allowed).toBe(false);
    });

    it("blocks 'curl https://evil.com'", () => {
      expect(validateCommand("curl https://evil.com", perms).allowed).toBe(false);
    });

    it("blocks 'rm -rf node_modules'", () => {
      expect(validateCommand("rm -rf node_modules", perms).allowed).toBe(false);
    });

    it("blocks 'sudo npm install'", () => {
      expect(validateCommand("sudo npm install", perms).allowed).toBe(false);
    });

    it("blocks 'wget https://example.com'", () => {
      expect(validateCommand("wget https://example.com", perms).allowed).toBe(false);
    });
  });

  // ── full profile: broader command set ────────────────────────────────────────

  describe("full profile (delegate) additional commands", () => {
    const perms = getWorkerPermissions("delegate");

    it("allows 'gh pr create'", () => {
      expect(validateCommand("gh pr create", perms).allowed).toBe(true);
    });

    it("allows 'docker build .'", () => {
      expect(validateCommand("docker build .", perms).allowed).toBe(true);
    });

    it("allows 'vitest run'", () => {
      expect(validateCommand("vitest run", perms).allowed).toBe(true);
    });

    it("still blocks curl in full profile", () => {
      expect(validateCommand("curl https://evil.com", perms).allowed).toBe(false);
    });

    it("still blocks rm -rf in full profile", () => {
      expect(validateCommand("rm -rf /", perms).allowed).toBe(false);
    });

    it("still blocks sudo in full profile", () => {
      expect(validateCommand("sudo apt-get install", perms).allowed).toBe(false);
    });
  });

  // ── edge cases ───────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    const perms = makePermissions();

    it("trims leading/trailing whitespace before evaluation", () => {
      expect(validateCommand("  npm run test  ", perms).allowed).toBe(true);
    });

    it("blocks empty command string", () => {
      expect(validateCommand("", perms).allowed).toBe(false);
    });

    it("blocks whitespace-only command string", () => {
      expect(validateCommand("   ", perms).allowed).toBe(false);
    });

    it("returns allowed:true with 'permitted' in reason for a valid command", () => {
      const result: ValidationResult = validateCommand("npm run build", perms);
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain("permitted");
    });
  });
});
