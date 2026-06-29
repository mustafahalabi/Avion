/**
 * Check Command Profile System
 *
 * Defines validation commands a worker should run against a repository to
 * verify its work (type checking, linting, testing). Profiles are auto-detected
 * from repository metadata and replace the previously hardcoded
 * STANDARD_VALIDATION_COMMANDS in implementation-brief.ts.
 */

// ─── Interfaces ────────────────────────────────────────────────────────────────

/**
 * A single shell command that validates a repository after implementation.
 */
export interface CheckCommand {
  /** Unique identifier for this command within a profile. */
  id: string;
  /** The shell command to execute. */
  command: string;
  /** Human-readable description of what this command validates. */
  description: string;
  /**
   * When true, a non-zero exit code should abort further validation and
   * prevent commit / PR creation.
   */
  failOnError: boolean;
  /** Maximum seconds to wait before treating the command as failed. */
  timeoutSeconds: number;
  /**
   * Execution order — lower values run first.
   * Commands with the same order value run in declaration order.
   */
  order: number;
}

/**
 * A named collection of validation commands suited to a particular tech stack.
 */
export interface CheckCommandProfile {
  /** Unique identifier for this profile. */
  id: string;
  /** Human-readable profile name. */
  name: string;
  /** Description of which repositories this profile targets. */
  description: string;
  /** Ordered list of commands belonging to this profile. */
  commands: CheckCommand[];
  /**
   * Framework identifiers that trigger automatic selection of this profile
   * (case-insensitive comparison against repository `frameworks` / `techStack`).
   */
  applicableFrameworks: string[];
  /**
   * Primary language identifiers that trigger automatic selection of this
   * profile (case-insensitive comparison against repository `primaryLanguage`).
   */
  applicableLanguages: string[];
}

// ─── Predefined Profiles ───────────────────────────────────────────────────────

/**
 * Profile for Next.js + TypeScript repositories.
 *
 * Matches the STANDARD_VALIDATION_COMMANDS previously hardcoded in
 * `implementation-brief.ts`.  Prisma commands are included because the
 * canonical Engineering OS monorepo uses Prisma as its ORM.
 */
export const NEXTJS_TYPESCRIPT_PROFILE: CheckCommandProfile = {
  id: "nextjs-typescript",
  name: "Next.js + TypeScript",
  description:
    "Validation profile for Next.js projects using TypeScript and Prisma.",
  applicableFrameworks: ["nextjs", "next.js", "next"],
  applicableLanguages: [],
  commands: [
    {
      id: "prisma-validate",
      command: "npx prisma validate",
      description: "Validates the Prisma schema file for syntax errors.",
      failOnError: true,
      timeoutSeconds: 30,
      order: 10,
    },
    {
      id: "prisma-format-check",
      command: "npx prisma format --check",
      description: "Checks that the Prisma schema is correctly formatted.",
      failOnError: true,
      timeoutSeconds: 30,
      order: 20,
    },
    {
      id: "prisma-generate",
      command: "npx prisma generate",
      description: "Generates the Prisma client from the current schema.",
      failOnError: true,
      timeoutSeconds: 60,
      order: 30,
    },
    {
      id: "tsc",
      command: "npx tsc --noEmit",
      description: "Runs the TypeScript compiler in type-check-only mode.",
      failOnError: true,
      timeoutSeconds: 120,
      order: 40,
    },
    {
      id: "lint",
      command: "npm run lint",
      description: "Runs ESLint across all source files.",
      failOnError: true,
      timeoutSeconds: 120,
      order: 50,
    },
    {
      id: "build",
      command: "npm run build",
      description: "Produces a production build to catch compilation errors.",
      failOnError: true,
      timeoutSeconds: 300,
      order: 60,
    },
    {
      id: "test",
      command: "npm run test",
      description: "Runs the full test suite.",
      failOnError: true,
      timeoutSeconds: 300,
      order: 70,
    },
  ],
};

/**
 * Profile for Node.js repositories without TypeScript.
 */
export const NODEJS_PROFILE: CheckCommandProfile = {
  id: "nodejs",
  name: "Node.js",
  description:
    "Validation profile for Node.js projects that do not use TypeScript.",
  applicableFrameworks: ["express", "fastify", "koa", "hapi", "nestjs", "node"],
  applicableLanguages: ["javascript"],
  commands: [
    {
      id: "lint",
      command: "npm run lint",
      description: "Runs ESLint across all source files.",
      failOnError: true,
      timeoutSeconds: 120,
      order: 10,
    },
    {
      id: "build",
      command: "npm run build",
      description: "Builds the project (if a build script exists).",
      failOnError: false,
      timeoutSeconds: 300,
      order: 20,
    },
    {
      id: "test",
      command: "npm run test",
      description: "Runs the full test suite.",
      failOnError: true,
      timeoutSeconds: 300,
      order: 30,
    },
  ],
};

/**
 * Profile for Python repositories.
 */
export const PYTHON_PROFILE: CheckCommandProfile = {
  id: "python",
  name: "Python",
  description:
    "Validation profile for Python projects using pytest and ruff/flake8.",
  applicableFrameworks: [
    "django",
    "flask",
    "fastapi",
    "starlette",
    "tornado",
    "python",
  ],
  applicableLanguages: ["python"],
  commands: [
    {
      id: "ruff-check",
      command: "ruff check .",
      description: "Runs ruff linter across the Python source tree.",
      failOnError: true,
      timeoutSeconds: 60,
      order: 10,
    },
    {
      id: "ruff-format-check",
      command: "ruff format --check .",
      description: "Checks that all Python files are correctly formatted.",
      failOnError: true,
      timeoutSeconds: 60,
      order: 20,
    },
    {
      id: "mypy",
      command: "mypy .",
      description: "Runs mypy static type checker.",
      failOnError: false,
      timeoutSeconds: 120,
      order: 30,
    },
    {
      id: "pytest",
      command: "pytest",
      description: "Runs the full pytest test suite.",
      failOnError: true,
      timeoutSeconds: 300,
      order: 40,
    },
  ],
};

/**
 * Generic fallback profile used when no language / framework is recognised.
 */
export const GENERIC_PROFILE: CheckCommandProfile = {
  id: "generic",
  name: "Generic",
  description:
    "Minimal fallback profile for repositories whose stack is unknown.",
  applicableFrameworks: [],
  applicableLanguages: [],
  commands: [
    {
      id: "build",
      command: "npm run build",
      description: "Builds the project.",
      failOnError: false,
      timeoutSeconds: 300,
      order: 10,
    },
    {
      id: "test",
      command: "npm run test",
      description: "Runs the test suite.",
      failOnError: false,
      timeoutSeconds: 300,
      order: 20,
    },
  ],
};

/**
 * Ordered list of all known profiles, from most specific to least specific.
 * `detectProfile` iterates this list and returns the first match.
 */
const ALL_PROFILES: CheckCommandProfile[] = [
  NEXTJS_TYPESCRIPT_PROFILE,
  PYTHON_PROFILE,
  NODEJS_PROFILE,
  // GENERIC_PROFILE is the explicit fallback — not included here.
];

// ─── Detection ─────────────────────────────────────────────────────────────────

/**
 * Repository metadata subset used for profile detection.
 */
export interface RepoMetadata {
  primaryLanguage?: string | null;
  frameworks?: readonly string[] | null;
  techStack?: readonly string[] | null;
}

/**
 * Normalises a string for comparison: lower-case, trim whitespace.
 */
function normalise(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Returns true when `haystack` contains any of the `needles` (case-insensitive).
 */
function containsAny(haystack: string[], needles: string[]): boolean {
  const normalisedHaystack = haystack.map(normalise);
  return needles.some((needle) => normalisedHaystack.includes(normalise(needle)));
}

/**
 * Auto-detects the most appropriate `CheckCommandProfile` for a repository
 * based on its metadata.
 *
 * Detection priority (highest to lowest):
 * 1. Framework match — `frameworks` or `techStack` arrays are checked first
 *    because they carry the most specific signal (e.g. "nextjs" is more
 *    informative than "typescript").
 * 2. Language match — `primaryLanguage` is consulted when no framework matches.
 * 3. Generic fallback — returned when nothing matches.
 *
 * All comparisons are case-insensitive.
 *
 * @param repo - Partial repository metadata from the database.
 * @returns The most appropriate profile, or `GENERIC_PROFILE` as a fallback.
 *
 * @example
 * ```ts
 * detectProfile({ primaryLanguage: "TypeScript", frameworks: ["nextjs"] });
 * // → NEXTJS_TYPESCRIPT_PROFILE
 *
 * detectProfile({ primaryLanguage: "Python", frameworks: [] });
 * // → PYTHON_PROFILE
 *
 * detectProfile({});
 * // → GENERIC_PROFILE
 * ```
 */
export function detectProfile(repo: RepoMetadata): CheckCommandProfile {
  const allFrameworks = [
    ...(repo.frameworks ?? []),
    ...(repo.techStack ?? []),
  ].filter(Boolean) as string[];

  // 1. Framework-first pass
  for (const profile of ALL_PROFILES) {
    if (
      profile.applicableFrameworks.length > 0 &&
      containsAny(allFrameworks, profile.applicableFrameworks)
    ) {
      return profile;
    }
  }

  // 2. Language pass
  const language = repo.primaryLanguage ?? "";
  if (language) {
    for (const profile of ALL_PROFILES) {
      if (containsAny([language], profile.applicableLanguages)) {
        return profile;
      }
    }
  }

  // 3. Fallback
  return GENERIC_PROFILE;
}

// ─── Convenience Helpers ───────────────────────────────────────────────────────

/**
 * Returns the ordered validation commands for a repository, auto-detecting the
 * appropriate profile from its metadata.
 *
 * Commands are sorted by `order` ascending, then by declaration order for ties.
 *
 * @param repo - Partial repository metadata from the database.
 * @returns Sorted array of `CheckCommand` objects.
 *
 * @example
 * ```ts
 * const commands = getCommandsForRepo({ primaryLanguage: "TypeScript", frameworks: ["nextjs"] });
 * commands.map(c => c.command);
 * // → ["npx prisma validate", "npx prisma format --check", ...]
 * ```
 */
export function getCommandsForRepo(repo: RepoMetadata): CheckCommand[] {
  const profile = detectProfile(repo);
  return [...profile.commands].sort((a, b) => a.order - b.order);
}

/**
 * Formats a list of `CheckCommand` objects as a Markdown ordered list for
 * injection into implementation briefs.
 *
 * Each item includes the command in an inline code span followed by the
 * description in parentheses.
 *
 * @param commands - The commands to format.
 * @returns A Markdown string, or a placeholder message when the list is empty.
 *
 * @example
 * ```ts
 * formatCommandsForBrief([
 *   { id: "tsc", command: "npx tsc --noEmit", description: "Type check", ... },
 * ]);
 * // → "1. `npx tsc --noEmit` — Type check"
 * ```
 */
export function formatCommandsForBrief(commands: CheckCommand[]): string {
  if (commands.length === 0) {
    return "_(no validation commands configured)_";
  }

  return commands
    .map((cmd, index) => `${index + 1}. \`${cmd.command}\` — ${cmd.description}`)
    .join("\n");
}
