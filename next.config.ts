import type { NextConfig } from "next";
import path from "node:path";

// When building for the Electron desktop app we emit a self-contained
// standalone server (`.next/standalone/server.js`) that the Electron main
// process boots on localhost. The flag keeps normal `next build` / Vercel
// deploys completely unchanged — standalone output is opt-in via the build
// script (`scripts/build-electron.mjs` sets EOS_ELECTRON_BUILD=1).
const isElectronBuild = process.env.EOS_ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isElectronBuild ? { output: "standalone" } : {}),
  // Pin the file-tracing root to this project so the standalone output traces
  // dependencies relative to the repo (avoids the multi-lockfile root guess).
  outputFileTracingRoot: path.join(process.cwd()),
  // Keep the PostgreSQL driver and its Prisma adapter external so they are
  // required at runtime rather than bundled into the standalone server.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // Keep non-runtime files out of the standalone trace. This trims installer
  // size and avoids tracing the Electron build's own `build/` staging dir back
  // into itself. Secrets / dev databases are additionally pruned by
  // scripts/build-electron.mjs as a hard guarantee.
  outputFileTracingExcludes: {
    "**": [
      "build/**",
      "release/**",
      "docs/**",
      "specification/**",
      "scripts/**",
      "electron/**",
      "assets/**",
      "linear-notebooklm-context/**",
      "**/*.tsbuildinfo",
      "**/*.md",
      ".env*",
      "prisma/*.db",
      "prisma/*.db-journal",
      // Plaintext app source — the compiled server runs from .next/. Over-tracing
      // (a dynamic fs read) otherwise drags it all in. Keep src/generated.
      "src/app/**",
      "src/components/**",
      "src/hooks/**",
      "src/lib/**",
      "src/worker/**",
      "src/proxy.ts",
    ],
  },
};

export default nextConfig;
