import { defineConfig } from "tsup";

// Emit both ESM (for Next.js / @avion/web) and CJS (for the CommonJS NestJS
// build in @avion/api), plus type declarations. The package is contract-only
// (types + a few const maps), so the runtime footprint is tiny.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
