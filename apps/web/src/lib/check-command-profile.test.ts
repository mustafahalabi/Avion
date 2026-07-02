import { describe, expect, it } from "vitest";
import {
  type CheckCommand,
  type CheckCommandProfile,
  GENERIC_PROFILE,
  NEXTJS_TYPESCRIPT_PROFILE,
  NODEJS_PROFILE,
  PYTHON_PROFILE,
  detectProfile,
  formatCommandsForBrief,
  getCommandsForRepo,
} from "./check-command-profile";

// ─── Profile Shape Invariants ──────────────────────────────────────────────────

describe("profile shape", () => {
  const profiles: CheckCommandProfile[] = [
    NEXTJS_TYPESCRIPT_PROFILE,
    NODEJS_PROFILE,
    PYTHON_PROFILE,
    GENERIC_PROFILE,
  ];

  it.each(profiles)("$name has a non-empty id", (profile) => {
    expect(profile.id.length).toBeGreaterThan(0);
  });

  it.each(profiles)("$name has at least one command", (profile) => {
    expect(profile.commands.length).toBeGreaterThan(0);
  });

  it.each(profiles)("$name commands have unique ids", (profile) => {
    const ids = profile.commands.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(profiles)("$name commands have positive timeoutSeconds", (profile) => {
    for (const cmd of profile.commands) {
      expect(cmd.timeoutSeconds).toBeGreaterThan(0);
    }
  });

  it.each(profiles)("$name commands have non-empty command strings", (profile) => {
    for (const cmd of profile.commands) {
      expect(cmd.command.trim().length).toBeGreaterThan(0);
    }
  });
});

// ─── NEXTJS_TYPESCRIPT_PROFILE ─────────────────────────────────────────────────

describe("NEXTJS_TYPESCRIPT_PROFILE", () => {
  it("includes all STANDARD_VALIDATION_COMMANDS from implementation-brief.ts", () => {
    const commands = NEXTJS_TYPESCRIPT_PROFILE.commands.map((c) => c.command);
    expect(commands).toContain("npx prisma validate");
    expect(commands).toContain("npx prisma format --check");
    expect(commands).toContain("npx prisma generate");
    expect(commands).toContain("npx tsc --noEmit");
    expect(commands).toContain("npm run lint");
    expect(commands).toContain("npm run build");
    expect(commands).toContain("npm run test");
  });

  it("has exactly 7 commands matching the original hardcoded list", () => {
    expect(NEXTJS_TYPESCRIPT_PROFILE.commands).toHaveLength(7);
  });

  it("has all commands with failOnError: true", () => {
    for (const cmd of NEXTJS_TYPESCRIPT_PROFILE.commands) {
      expect(cmd.failOnError).toBe(true);
    }
  });

  it("has commands in ascending order values", () => {
    const orders = NEXTJS_TYPESCRIPT_PROFILE.commands.map((c) => c.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });
});

// ─── NODEJS_PROFILE ────────────────────────────────────────────────────────────

describe("NODEJS_PROFILE", () => {
  it("includes lint, build, and test commands", () => {
    const commands = NODEJS_PROFILE.commands.map((c) => c.command);
    expect(commands).toContain("npm run lint");
    expect(commands).toContain("npm run build");
    expect(commands).toContain("npm run test");
  });

  it("does not include TypeScript or Prisma commands", () => {
    const commands = NODEJS_PROFILE.commands.map((c) => c.command);
    expect(commands.some((c) => c.includes("tsc"))).toBe(false);
    expect(commands.some((c) => c.includes("prisma"))).toBe(false);
  });

  it("has build with failOnError: false (build script may not exist in all Node projects)", () => {
    const build = NODEJS_PROFILE.commands.find((c) => c.id === "build");
    expect(build?.failOnError).toBe(false);
  });
});

// ─── PYTHON_PROFILE ────────────────────────────────────────────────────────────

describe("PYTHON_PROFILE", () => {
  it("includes ruff, mypy, and pytest commands", () => {
    const commands = PYTHON_PROFILE.commands.map((c) => c.command);
    expect(commands).toContain("ruff check .");
    expect(commands).toContain("ruff format --check .");
    expect(commands).toContain("mypy .");
    expect(commands).toContain("pytest");
  });

  it("has mypy with failOnError: false (type stubs may be missing)", () => {
    const mypy = PYTHON_PROFILE.commands.find((c) => c.id === "mypy");
    expect(mypy?.failOnError).toBe(false);
  });

  it("runs ruff before pytest", () => {
    const ruff = PYTHON_PROFILE.commands.find((c) => c.id === "ruff-check");
    const pytest = PYTHON_PROFILE.commands.find((c) => c.id === "pytest");
    expect(ruff!.order).toBeLessThan(pytest!.order);
  });
});

// ─── GENERIC_PROFILE ───────────────────────────────────────────────────────────

describe("GENERIC_PROFILE", () => {
  it("has empty applicableFrameworks and applicableLanguages", () => {
    expect(GENERIC_PROFILE.applicableFrameworks).toHaveLength(0);
    expect(GENERIC_PROFILE.applicableLanguages).toHaveLength(0);
  });

  it("includes build and test commands", () => {
    const commands = GENERIC_PROFILE.commands.map((c) => c.command);
    expect(commands).toContain("npm run build");
    expect(commands).toContain("npm run test");
  });

  it("has npm run test with failOnError: false so non-Node repos do not hard-fail", () => {
    const testCmd = GENERIC_PROFILE.commands.find((c) => c.id === "test");
    expect(testCmd?.failOnError).toBe(false);
  });
});

// ─── detectProfile ─────────────────────────────────────────────────────────────

describe("detectProfile", () => {
  describe("Next.js detection", () => {
    it("detects via frameworks: ['nextjs']", () => {
      const profile = detectProfile({ frameworks: ["nextjs"] });
      expect(profile.id).toBe("nextjs-typescript");
    });

    it("detects via frameworks: ['Next.js'] (case-insensitive)", () => {
      const profile = detectProfile({ frameworks: ["Next.js"] });
      expect(profile.id).toBe("nextjs-typescript");
    });

    it("detects via techStack: ['next']", () => {
      const profile = detectProfile({ techStack: ["next"] });
      expect(profile.id).toBe("nextjs-typescript");
    });

    it("detects via mixed frameworks and techStack", () => {
      const profile = detectProfile({
        primaryLanguage: "TypeScript",
        frameworks: ["react"],
        techStack: ["nextjs", "prisma"],
      });
      expect(profile.id).toBe("nextjs-typescript");
    });

    it("prefers Next.js profile even when language is TypeScript only", () => {
      // Framework match wins over language match
      const profile = detectProfile({
        primaryLanguage: "TypeScript",
        frameworks: ["nextjs"],
      });
      expect(profile.id).toBe("nextjs-typescript");
    });
  });

  describe("Node.js detection", () => {
    it("detects via frameworks: ['express']", () => {
      const profile = detectProfile({ frameworks: ["express"] });
      expect(profile.id).toBe("nodejs");
    });

    it("detects via frameworks: ['fastify']", () => {
      const profile = detectProfile({ frameworks: ["fastify"] });
      expect(profile.id).toBe("nodejs");
    });

    it("detects via primaryLanguage: 'JavaScript'", () => {
      const profile = detectProfile({ primaryLanguage: "JavaScript" });
      expect(profile.id).toBe("nodejs");
    });

    it("detects via primaryLanguage: 'javascript' (lower-case)", () => {
      const profile = detectProfile({ primaryLanguage: "javascript" });
      expect(profile.id).toBe("nodejs");
    });
  });

  describe("Python detection", () => {
    it("detects via frameworks: ['django']", () => {
      const profile = detectProfile({ frameworks: ["django"] });
      expect(profile.id).toBe("python");
    });

    it("detects via frameworks: ['fastapi']", () => {
      const profile = detectProfile({ frameworks: ["fastapi"] });
      expect(profile.id).toBe("python");
    });

    it("detects via primaryLanguage: 'Python'", () => {
      const profile = detectProfile({ primaryLanguage: "Python" });
      expect(profile.id).toBe("python");
    });

    it("detects via primaryLanguage: 'python' (lower-case)", () => {
      const profile = detectProfile({ primaryLanguage: "python" });
      expect(profile.id).toBe("python");
    });
  });

  describe("Generic fallback", () => {
    it("returns GENERIC_PROFILE when repo is empty object", () => {
      const profile = detectProfile({});
      expect(profile.id).toBe("generic");
    });

    it("returns GENERIC_PROFILE when primaryLanguage is null", () => {
      const profile = detectProfile({ primaryLanguage: null });
      expect(profile.id).toBe("generic");
    });

    it("returns GENERIC_PROFILE when frameworks and techStack are empty arrays", () => {
      const profile = detectProfile({ frameworks: [], techStack: [] });
      expect(profile.id).toBe("generic");
    });

    it("returns GENERIC_PROFILE for an unknown language", () => {
      const profile = detectProfile({ primaryLanguage: "Rust" });
      expect(profile.id).toBe("generic");
    });

    it("returns GENERIC_PROFILE for an unknown framework", () => {
      const profile = detectProfile({ frameworks: ["rails"] });
      expect(profile.id).toBe("generic");
    });
  });

  describe("framework takes priority over language", () => {
    it("picks Next.js profile when framework is nextjs even if language not listed", () => {
      const profile = detectProfile({
        primaryLanguage: "Python", // contradictory — framework wins
        frameworks: ["nextjs"],
      });
      expect(profile.id).toBe("nextjs-typescript");
    });
  });

  describe("TypeScript-only (no Next.js framework) does not match nextjs-typescript profile", () => {
    it("returns GENERIC_PROFILE for a plain TypeScript repo with no framework", () => {
      const profile = detectProfile({ primaryLanguage: "TypeScript" });
      expect(profile.id).toBe("generic");
    });

    it("returns GENERIC_PROFILE for TypeScript with unrecognised frameworks", () => {
      const profile = detectProfile({
        primaryLanguage: "TypeScript",
        frameworks: ["angular"],
      });
      expect(profile.id).toBe("generic");
    });
  });

  describe("Python profile is checked before Node.js profile", () => {
    it("returns python profile for a python framework, not nodejs", () => {
      const profile = detectProfile({ frameworks: ["fastapi"] });
      expect(profile.id).toBe("python");
    });

    it("prefers Python over Node when both python and node appear in techStack", () => {
      // 'python' is in PYTHON_PROFILE.applicableFrameworks and 'node' is in
      // NODEJS_PROFILE.applicableFrameworks.  PYTHON_PROFILE must be checked
      // first so that repos with mixed stacks resolve correctly.
      const profile = detectProfile({
        frameworks: ["django"],
        techStack: ["node"],
      });
      expect(profile.id).toBe("python");
    });
  });
});

// ─── getCommandsForRepo ────────────────────────────────────────────────────────

describe("getCommandsForRepo", () => {
  it("returns commands sorted by order ascending", () => {
    const commands = getCommandsForRepo({ frameworks: ["nextjs"] });
    const orders = commands.map((c) => c.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it("returns Next.js commands for a Next.js repo", () => {
    const commands = getCommandsForRepo({ frameworks: ["nextjs"] });
    const ids = commands.map((c) => c.id);
    expect(ids).toContain("prisma-validate");
    expect(ids).toContain("tsc");
    expect(ids).toContain("test");
  });

  it("returns Python commands for a Python repo", () => {
    const commands = getCommandsForRepo({ primaryLanguage: "Python" });
    const ids = commands.map((c) => c.id);
    expect(ids).toContain("ruff-check");
    expect(ids).toContain("pytest");
  });

  it("returns generic commands for unknown repo", () => {
    const commands = getCommandsForRepo({});
    const ids = commands.map((c) => c.id);
    expect(ids).toContain("build");
    expect(ids).toContain("test");
  });

  it("does not mutate the profile's commands array", () => {
    const original = [...NEXTJS_TYPESCRIPT_PROFILE.commands];
    getCommandsForRepo({ frameworks: ["nextjs"] });
    expect(NEXTJS_TYPESCRIPT_PROFILE.commands).toEqual(original);
  });
});

// ─── formatCommandsForBrief ────────────────────────────────────────────────────

describe("formatCommandsForBrief", () => {
  it("returns placeholder for empty command list", () => {
    expect(formatCommandsForBrief([])).toBe(
      "_(no validation commands configured)_"
    );
  });

  it("formats a single command as a numbered markdown item", () => {
    const cmd: CheckCommand = {
      id: "tsc",
      command: "npx tsc --noEmit",
      description: "Type check",
      failOnError: true,
      timeoutSeconds: 120,
      order: 10,
    };
    const result = formatCommandsForBrief([cmd]);
    expect(result).toBe("1. `npx tsc --noEmit` — Type check");
  });

  it("numbers multiple commands sequentially", () => {
    const commands: CheckCommand[] = [
      {
        id: "a",
        command: "cmd-a",
        description: "Command A",
        failOnError: true,
        timeoutSeconds: 30,
        order: 10,
      },
      {
        id: "b",
        command: "cmd-b",
        description: "Command B",
        failOnError: true,
        timeoutSeconds: 30,
        order: 20,
      },
    ];
    const result = formatCommandsForBrief(commands);
    expect(result).toBe("1. `cmd-a` — Command A\n2. `cmd-b` — Command B");
  });

  it("includes all Next.js profile commands when formatted", () => {
    const commands = getCommandsForRepo({ frameworks: ["nextjs"] });
    const result = formatCommandsForBrief(commands);
    expect(result).toContain("`npx prisma validate`");
    expect(result).toContain("`npx tsc --noEmit`");
    expect(result).toContain("`npm run test`");
    // Verify it's a numbered list
    expect(result).toMatch(/^1\./);
  });

  it("uses em dash separator between command and description", () => {
    const cmd: CheckCommand = {
      id: "x",
      command: "some-cmd",
      description: "Some description",
      failOnError: false,
      timeoutSeconds: 30,
      order: 1,
    };
    expect(formatCommandsForBrief([cmd])).toContain(" — ");
  });
});
