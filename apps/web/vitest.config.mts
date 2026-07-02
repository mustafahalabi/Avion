import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Don't collect tests from build artifacts. The Electron build (`npm run
    // dist`) copies a full snapshot of `src/` — including its test files — into
    // `release/`; collecting those stale duplicates breaks `npm run test`. Keep
    // Vitest's defaults too.
    exclude: [...configDefaults.exclude, "release/**", "dist/**"],
    // Several suites are real-PostgreSQL integration tests that provision a
    // per-suite schema in `beforeAll` and run many queries. Under parallel file
    // execution the machine (and the DB) can be heavily loaded, so the default
    // 5s/10s timeouts produced transient timeouts that were never real failures.
    // Give DB-backed work generous headroom — genuine failures still fail fast.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    // `forks` is LOAD-BEARING for correctness, not just stability: the test DB
    // harness (src/lib/test-utils/pg-test-db.ts) isolates each suite by mutating
    // `process.env.DATABASE_URL` to a unique `?schema=…`, which only works when
    // every test FILE runs in its own process. Switching to the `threads` pool
    // would share one process.env across suites and silently break isolation.
    pool: "forks",
  },
});
