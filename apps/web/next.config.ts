import type { NextConfig } from "next";
import path from "node:path";

// When building for the Electron desktop app we emit a self-contained
// standalone server (`.next/standalone/server.js`) that the Electron main
// process boots on localhost. The flag keeps normal `next build` / Vercel
// deploys completely unchanged — standalone output is opt-in via the build
// script (`scripts/build-electron.mjs` sets EOS_ELECTRON_BUILD=1).
//
// The production container image (apps/web/Dockerfile, MUS-269) reuses the
// same standalone output via AVION_STANDALONE=1 — also opt-in, so `next dev`,
// plain `next build`, and Vercel deploys stay unchanged.
const isElectronBuild = process.env.EOS_ELECTRON_BUILD === "1";
const isStandaloneBuild = isElectronBuild || process.env.AVION_STANDALONE === "1";

// `next dev/build` run with cwd = apps/web. In the pnpm monorepo the real
// packages live in <repo-root>/node_modules/.pnpm and are symlinked into
// apps/web/node_modules, so both Turbopack and file-tracing must use the REPO
// ROOT as the project root to resolve them. Next also requires turbopack.root
// and outputFileTracingRoot to be identical — derive both from one value.
const appRoot = process.cwd();
const monorepoRoot = path.join(appRoot, "..", "..");

const nextConfig: NextConfig = {
  ...(isStandaloneBuild ? { output: "standalone" } : {}),
  // Transpile the workspace contract package shared with the NestJS backend
  // (@avion/api). Inlining it into the route bundles also keeps the Electron
  // standalone output self-contained without extra file-tracing config.
  transpilePackages: ["@avion/shared"],
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  // Keep the PostgreSQL driver and its Prisma adapter external so they are
  // required at runtime rather than bundled into the standalone server.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // Keep non-runtime files out of the standalone trace. Paths are relative to
  // outputFileTracingRoot (the monorepo root), so app files are prefixed with
  // apps/web/; repo-root docs stay unprefixed.
  outputFileTracingExcludes: {
    "**": [
      "apps/web/build/**",
      "apps/web/release/**",
      "docs/**",
      "specification/**",
      "linear-notebooklm-context/**",
      "apps/web/scripts/**",
      "apps/web/electron/**",
      "apps/web/assets/**",
      "**/*.tsbuildinfo",
      "**/*.md",
      "**/.env*",
      "apps/web/prisma/*.db",
      "apps/web/prisma/*.db-journal",
      // Plaintext app source — the compiled server runs from .next/. Over-tracing
      // (a dynamic fs read) otherwise drags it all in. Keep src/generated.
      "apps/web/src/app/**",
      "apps/web/src/components/**",
      "apps/web/src/hooks/**",
      "apps/web/src/lib/**",
      "apps/web/src/worker/**",
      "apps/web/src/proxy.ts",
    ],
  },
};

export default nextConfig;
