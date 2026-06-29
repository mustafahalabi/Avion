import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Several suites are real-SQLite integration tests that bootstrap tables in
    // `beforeAll` and run many queries. Under parallel file execution the
    // machine can be heavily loaded, so the default 5s/10s timeouts produced
    // transient timeouts that were never real failures. Give DB-backed work
    // generous headroom — genuine failures still fail fast via assertions.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    // better-sqlite3 is a native addon; the `forks` pool is the most stable for
    // many short-lived database connections opened across worker processes.
    pool: "forks",
  },
});
