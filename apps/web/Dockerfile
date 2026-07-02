# syntax=docker/dockerfile:1
# @avion/web — the Next.js 16 platform, built as a standalone server.
#
# Build from the REPO ROOT (the pnpm workspace needs the root manifests):
#   docker build -f apps/web/Dockerfile -t avion-web .
#
# Standalone output is opt-in via AVION_STANDALONE=1 (next.config.ts) so the
# dev flow / plain `next build` stay unchanged. Because outputFileTracingRoot
# is the monorepo root, the standalone tree mirrors it: the server entrypoint
# lands at .next/standalone/apps/web/server.js.
#
# IMPORTANT — NEXT_PUBLIC_* values are INLINED at build time. An image built
# without NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_API_URL cannot have
# them injected at runtime. Pass them as --build-arg for a real deployment:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
#     -t avion-web .
# See docs/DEPLOYMENT.md for the full matrix.

ARG NODE_VERSION=24

########## base: node + pnpm ##########
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.9.0
WORKDIR /repo

########## build ##########
FROM base AS build
# pnpm needs every workspace project's package.json to validate the lockfile.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --filter @avion/web...

COPY packages/shared packages/shared
COPY apps/web apps/web

# Build-time public config (inlined into the client bundles by next build).
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/onboarding"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL \
    AVION_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1

# shared dist first (transpilePackages resolves its exports), then prisma
# client, then the standalone Next build. next build's page-data collection
# imports src/lib/prisma.ts, which throws if DATABASE_URL is UNSET — but pg
# pools connect lazily, so a placeholder string satisfies the build without
# any database being reachable. The real URL is runtime-only.
RUN pnpm --filter @avion/shared build && \
    pnpm --filter @avion/web exec prisma generate && \
    DATABASE_URL="postgresql://build:build@build-placeholder:5432/build" \
      pnpm --filter @avion/web build

########## runner ##########
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

# The standalone tree mirrors the monorepo root: node_modules + apps/web/…
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

# The root route redirects into the app; any HTTP response (< 500) means the
# server is up. /api routes require auth, so probe / instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/', { redirect: 'manual' }).then((r) => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

WORKDIR /repo/apps/web
CMD ["node", "server.js"]
