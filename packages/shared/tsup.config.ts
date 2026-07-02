import { defineConfig } from "tsup";

// Emit both ESM (for Next.js / @avion/web) and CJS (for the CommonJS NestJS
// build in @avion/api), plus type declarations. The package is contract-only
// (types + a few const maps), so the runtime footprint is tiny.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // tsup's declaration (dts) pipeline injects the now-deprecated `baseUrl`
  // compiler option, which raises TS5101 under TypeScript 6 (and TS 7 removes
  // baseUrl entirely). Our own tsconfig sets no baseUrl — this comes from the
  // upstream dts build — so acknowledge the deprecation, scoped to the dts
  // compile only (not the tsconfig used for editor/typecheck).
  // TODO(MUS-275): remove once tsup/rollup-plugin-dts stops injecting baseUrl.
  dts: {
    compilerOptions: {
      ignoreDeprecations: "6.0",
    },
  },
  clean: true,
  sourcemap: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
