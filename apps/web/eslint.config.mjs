import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The Electron shell (shelved, MUS-267) is CommonJS Node code — `require()`
    // is idiomatic there, not a TS-import mistake. Don't flag it.
    files: ["electron/**/*.js", "electron/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Underscore-prefixed args/vars are an intentional "unused on purpose"
    // convention (e.g. a stub's `_request`); don't warn on them.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // The React-Compiler-era hook rules are advisory: they flag intentional,
    // working patterns (a render-time live-timer anchor, the canonical
    // "latest ref" update, a reset-on-dependency-change effect). Keep them
    // VISIBLE as warnings so new violations still surface in review, but don't
    // fail the build on these pre-existing, tested usages. The load-bearing hook
    // rules (rules-of-hooks, exhaustive-deps) stay at their defaults.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
