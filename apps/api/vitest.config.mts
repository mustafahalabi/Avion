import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Generated Prisma client output is not under test.
    exclude: ["src/generated/**", "node_modules/**", "dist/**"],
  },
});
