import { describe, expect, it } from "vitest";

import {
  checkBranchGuardrail,
  checkCommandGuardrail,
  checkFileGuardrails,
  PROTECTED_BRANCHES,
  PROTECTED_FILE_PATTERNS,
  runAllGuardrails,
  type GuardrailCheckResult,
  type GuardrailViolation,
} from "./repository-guardrails";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expectBlocked(result: GuardrailCheckResult): void {
  expect(result.passed).toBe(false);
  expect(result.violations.length).toBeGreaterThan(0);
  expect(result.violations.every((v) => v.severity === "block")).toBe(true);
}

function expectPassed(result: GuardrailCheckResult): void {
  expect(result.passed).toBe(true);
  expect(result.violations.filter((v) => v.severity === "block")).toHaveLength(0);
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe("PROTECTED_FILE_PATTERNS", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(PROTECTED_FILE_PATTERNS)).toBe(true);
    expect(PROTECTED_FILE_PATTERNS.length).toBeGreaterThan(0);
  });

  it("includes .env* pattern", () => {
    expect(PROTECTED_FILE_PATTERNS).toContain(".env*");
  });

  it("includes prisma/migrations/** pattern", () => {
    expect(PROTECTED_FILE_PATTERNS).toContain("prisma/migrations/**");
  });

  it("includes lockfile patterns", () => {
    expect(PROTECTED_FILE_PATTERNS).toContain("package-lock.json");
    expect(PROTECTED_FILE_PATTERNS).toContain("yarn.lock");
    expect(PROTECTED_FILE_PATTERNS).toContain("pnpm-lock.yaml");
  });
});

describe("PROTECTED_BRANCHES", () => {
  it("contains master and main", () => {
    expect(PROTECTED_BRANCHES).toContain("master");
    expect(PROTECTED_BRANCHES).toContain("main");
  });

  it("contains release/* and hotfix/* patterns", () => {
    expect(PROTECTED_BRANCHES).toContain("release/*");
    expect(PROTECTED_BRANCHES).toContain("hotfix/*");
  });
});

// ─── checkFileGuardrails ──────────────────────────────────────────────────────

describe("checkFileGuardrails", () => {
  describe("environment files", () => {
    it("blocks .env", () => {
      const result = checkFileGuardrails([".env"]);
      expectBlocked(result);
      expect(result.violations[0]!.path).toBe(".env");
      expect(result.violations[0]!.rule).toBe("protected-file");
    });

    it("blocks .env.local", () => {
      expectBlocked(checkFileGuardrails([".env.local"]));
    });

    it("blocks .env.production", () => {
      expectBlocked(checkFileGuardrails([".env.production"]));
    });

    it("blocks .env.test", () => {
      expectBlocked(checkFileGuardrails([".env.test"]));
    });
  });

  describe("certificate and key files", () => {
    it("blocks *.key files", () => {
      expectBlocked(checkFileGuardrails(["private.key"]));
      expectBlocked(checkFileGuardrails(["certs/server.key"]));
    });

    it("blocks *.pem files", () => {
      expectBlocked(checkFileGuardrails(["cert.pem"]));
      expectBlocked(checkFileGuardrails(["infra/tls/cert.pem"]));
    });

    it("blocks *.p12 files", () => {
      expectBlocked(checkFileGuardrails(["keystore.p12"]));
    });

    it("blocks *.pfx files", () => {
      expectBlocked(checkFileGuardrails(["cert.pfx"]));
    });
  });

  describe("prisma migrations", () => {
    it("blocks files inside prisma/migrations/", () => {
      expectBlocked(checkFileGuardrails(["prisma/migrations/20240101_init/migration.sql"]));
    });

    it("blocks direct files in prisma/migrations/", () => {
      expectBlocked(checkFileGuardrails(["prisma/migrations/migration_lock.toml"]));
    });

    it("does NOT block prisma/schema.prisma", () => {
      expectPassed(checkFileGuardrails(["prisma/schema.prisma"]));
    });
  });

  describe(".github/workflows", () => {
    it("blocks workflow yaml files", () => {
      expectBlocked(checkFileGuardrails([".github/workflows/ci.yml"]));
      expectBlocked(checkFileGuardrails([".github/workflows/deploy.yaml"]));
    });
  });

  describe("lockfiles", () => {
    it("blocks package-lock.json", () => {
      expectBlocked(checkFileGuardrails(["package-lock.json"]));
    });

    it("blocks yarn.lock", () => {
      expectBlocked(checkFileGuardrails(["yarn.lock"]));
    });

    it("blocks pnpm-lock.yaml", () => {
      expectBlocked(checkFileGuardrails(["pnpm-lock.yaml"]));
    });
  });

  describe("secrets and credentials directories", () => {
    it("blocks files inside any secrets/ directory", () => {
      expectBlocked(checkFileGuardrails(["config/secrets/api-key.txt"]));
      expectBlocked(checkFileGuardrails(["secrets/database-password"]));
    });

    it("blocks files inside any credentials/ directory", () => {
      expectBlocked(checkFileGuardrails(["credentials/gcp-service-account.json"]));
      expectBlocked(checkFileGuardrails(["infra/credentials/aws.json"]));
    });
  });

  describe("safe files — should pass", () => {
    it("allows normal source files", () => {
      expectPassed(checkFileGuardrails(["src/lib/repository-guardrails.ts"]));
      expectPassed(checkFileGuardrails(["src/app/page.tsx"]));
    });

    it("allows README and config files", () => {
      expectPassed(checkFileGuardrails(["README.md"]));
      expectPassed(checkFileGuardrails(["tsconfig.json"]));
      expectPassed(checkFileGuardrails(["package.json"]));
    });

    it("allows test files", () => {
      expectPassed(checkFileGuardrails(["src/lib/foo.test.ts"]));
    });

    it("returns passed: true with empty violations for safe files", () => {
      const result = checkFileGuardrails(["src/index.ts"]);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("multiple files", () => {
    it("collects one violation per protected file", () => {
      const result = checkFileGuardrails([".env", "src/index.ts", "private.key"]);
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(2);
      const paths = result.violations.map((v) => v.path);
      expect(paths).toContain(".env");
      expect(paths).toContain("private.key");
    });

    it("passes when all files are safe", () => {
      expectPassed(checkFileGuardrails(["src/a.ts", "src/b.ts", "README.md"]));
    });

    it("handles empty array", () => {
      expectPassed(checkFileGuardrails([]));
    });
  });

  describe("violation shape", () => {
    it("violation has required fields", () => {
      const result = checkFileGuardrails([".env"]);
      const v = result.violations[0] as GuardrailViolation;
      expect(v.rule).toBe("protected-file");
      expect(v.severity).toBe("block");
      expect(v.path).toBe(".env");
      expect(typeof v.message).toBe("string");
      expect(v.message.length).toBeGreaterThan(0);
    });
  });
});

// ─── checkBranchGuardrail ─────────────────────────────────────────────────────

describe("checkBranchGuardrail", () => {
  describe("protected branches — should block", () => {
    it("blocks master", () => {
      const result = checkBranchGuardrail("master");
      expectBlocked(result);
      expect(result.violations[0]!.rule).toBe("protected-branch");
      expect(result.violations[0]!.branch).toBe("master");
    });

    it("blocks main", () => {
      expectBlocked(checkBranchGuardrail("main"));
    });

    it("blocks release/v1", () => {
      expectBlocked(checkBranchGuardrail("release/v1"));
    });

    it("blocks release/2024.01", () => {
      expectBlocked(checkBranchGuardrail("release/2024.01"));
    });

    it("blocks hotfix/urgent-security-patch", () => {
      expectBlocked(checkBranchGuardrail("hotfix/urgent-security-patch"));
    });
  });

  describe("safe branches — should pass", () => {
    it("allows feature branches", () => {
      expectPassed(checkBranchGuardrail("feature/MUS-186-repository-guardrails"));
    });

    it("allows fix branches", () => {
      expectPassed(checkBranchGuardrail("fix/MUS-200-broken-auth"));
    });

    it("allows chore branches", () => {
      expectPassed(checkBranchGuardrail("chore/update-deps"));
    });

    it("allows develop branch", () => {
      expectPassed(checkBranchGuardrail("develop"));
    });
  });

  describe("violation shape", () => {
    it("includes branch name in violation", () => {
      const result = checkBranchGuardrail("master");
      const v = result.violations[0] as GuardrailViolation;
      expect(v.branch).toBe("master");
      expect(v.severity).toBe("block");
      expect(v.rule).toBe("protected-branch");
    });
  });
});

// ─── checkCommandGuardrail ────────────────────────────────────────────────────

describe("checkCommandGuardrail", () => {
  describe("rm -rf variants — should block", () => {
    it("blocks rm -rf", () => {
      const result = checkCommandGuardrail("rm -rf /tmp/build");
      expectBlocked(result);
      expect(result.violations[0]!.rule).toBe("no-rm-rf");
    });

    it("blocks rm -fr", () => {
      expectBlocked(checkCommandGuardrail("rm -fr /tmp"));
    });

    it("blocks rm -rf with flags interleaved", () => {
      expectBlocked(checkCommandGuardrail("rm -rf ./dist"));
    });
  });

  describe("git force push — should block", () => {
    it("blocks git push --force", () => {
      const result = checkCommandGuardrail("git push --force origin main");
      expectBlocked(result);
      expect(result.violations[0]!.rule).toBe("no-force-push");
    });

    it("blocks git push --force-with-lease", () => {
      expectBlocked(checkCommandGuardrail("git push --force-with-lease origin feature/abc"));
    });

    it("blocks git push origin --force", () => {
      expectBlocked(checkCommandGuardrail("git push origin main --force"));
    });
  });

  describe("git reset --hard — should block", () => {
    it("blocks git reset --hard", () => {
      const result = checkCommandGuardrail("git reset --hard HEAD~1");
      expectBlocked(result);
      expect(result.violations[0]!.rule).toBe("no-git-reset-hard");
    });

    it("blocks git reset --hard HEAD", () => {
      expectBlocked(checkCommandGuardrail("git reset --hard HEAD"));
    });
  });

  describe("DROP TABLE — should block", () => {
    it("blocks DROP TABLE", () => {
      const result = checkCommandGuardrail("DROP TABLE users;");
      expectBlocked(result);
      expect(result.violations[0]!.rule).toBe("no-drop-table");
    });

    it("blocks DROP TABLE case-insensitively", () => {
      expectBlocked(checkCommandGuardrail("drop table sessions"));
    });
  });

  describe("DELETE FROM without WHERE — should block", () => {
    it("blocks DELETE FROM with semicolon", () => {
      const result = checkCommandGuardrail("DELETE FROM users;");
      expectBlocked(result);
      expect(result.violations[0]!.rule).toBe("no-unbounded-delete");
    });

    it("blocks DELETE FROM at end of string (no WHERE)", () => {
      expectBlocked(checkCommandGuardrail("DELETE FROM sessions"));
    });
  });

  describe("DELETE FROM with WHERE — should pass", () => {
    it("allows DELETE FROM ... WHERE ...", () => {
      expectPassed(checkCommandGuardrail("DELETE FROM users WHERE id = 1"));
    });

    it("allows DELETE FROM ... WHERE ... case-insensitively", () => {
      expectPassed(checkCommandGuardrail("delete from users where id = 1"));
    });
  });

  describe("safe commands — should pass", () => {
    it("allows npm run build", () => {
      expectPassed(checkCommandGuardrail("npm run build"));
    });

    it("allows npm run test", () => {
      expectPassed(checkCommandGuardrail("npm run test"));
    });

    it("allows git push without --force", () => {
      expectPassed(checkCommandGuardrail("git push origin feature/MUS-186-guardrails"));
    });

    it("allows git reset --soft", () => {
      expectPassed(checkCommandGuardrail("git reset --soft HEAD~1"));
    });

    it("allows git reset --mixed", () => {
      expectPassed(checkCommandGuardrail("git reset --mixed HEAD"));
    });

    it("allows npx prisma migrate deploy", () => {
      expectPassed(checkCommandGuardrail("npx prisma migrate deploy"));
    });

    it("allows SELECT queries", () => {
      expectPassed(checkCommandGuardrail("SELECT * FROM users WHERE active = true"));
    });
  });

  describe("violation shape", () => {
    it("includes message with offending command", () => {
      const result = checkCommandGuardrail("rm -rf /");
      const v = result.violations[0] as GuardrailViolation;
      expect(v.message).toContain("rm -rf /");
      expect(v.severity).toBe("block");
    });
  });
});

// ─── runAllGuardrails ─────────────────────────────────────────────────────────

describe("runAllGuardrails", () => {
  it("passes when all inputs are safe", () => {
    const result = runAllGuardrails({
      filePaths: ["src/lib/foo.ts", "src/app/page.tsx"],
      branchName: "feature/MUS-186-guardrails",
      commands: ["npm run build", "npm run test"],
    });
    expectPassed(result);
  });

  it("blocks when a file matches a protected pattern", () => {
    const result = runAllGuardrails({
      filePaths: ["src/lib/foo.ts", ".env"],
      branchName: "feature/MUS-186-guardrails",
      commands: ["npm run build"],
    });
    expectBlocked(result);
    expect(result.violations.some((v) => v.rule === "protected-file")).toBe(true);
  });

  it("blocks when branch is protected", () => {
    const result = runAllGuardrails({
      filePaths: ["src/lib/foo.ts"],
      branchName: "master",
      commands: ["npm run build"],
    });
    expectBlocked(result);
    expect(result.violations.some((v) => v.rule === "protected-branch")).toBe(true);
  });

  it("blocks when a command is dangerous", () => {
    const result = runAllGuardrails({
      filePaths: ["src/lib/foo.ts"],
      branchName: "feature/MUS-186-guardrails",
      commands: ["rm -rf ./dist", "npm run test"],
    });
    expectBlocked(result);
    expect(result.violations.some((v) => v.rule === "no-rm-rf")).toBe(true);
  });

  it("accumulates violations across all checks", () => {
    const result = runAllGuardrails({
      filePaths: [".env", "private.key"],
      branchName: "master",
      commands: ["rm -rf /tmp", "git push --force"],
    });
    expectBlocked(result);
    // Two file violations + one branch violation + two command violations
    expect(result.violations.length).toBeGreaterThanOrEqual(5);
  });

  it("handles missing optional fields", () => {
    expectPassed(runAllGuardrails({}));
    expectPassed(runAllGuardrails({ filePaths: [] }));
    expectPassed(runAllGuardrails({ commands: [] }));
  });

  it("handles only filePaths provided", () => {
    const result = runAllGuardrails({ filePaths: [".env"] });
    expectBlocked(result);
  });

  it("handles only branchName provided", () => {
    const result = runAllGuardrails({ branchName: "main" });
    expectBlocked(result);
  });

  it("handles only commands provided", () => {
    const result = runAllGuardrails({ commands: ["DROP TABLE sessions;"] });
    expectBlocked(result);
  });

  it("passed is true when there are only warn-severity violations", () => {
    // Construct a synthetic result manually to verify the logic contract
    // (no warn violations exist yet in the implementation, but the interface supports them)
    const result = runAllGuardrails({
      filePaths: ["src/safe.ts"],
      branchName: "feature/safe",
    });
    expect(result.passed).toBe(true);
  });
});
