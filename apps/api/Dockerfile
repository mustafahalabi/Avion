# syntax=docker/dockerfile:1
# @avion/api — NestJS realtime board backend (REST /api + Socket.IO /board).
#
# Build from the REPO ROOT (the pnpm workspace needs the root manifests):
#   docker build -f apps/api/Dockerfile -t avion-api .
#
# Multi-stage: build compiles TS (prisma generate + nest build + @avion/shared),
# prod-deps installs production-only node_modules, and the runner copies both
# while preserving the /repo layout — pnpm's node_modules symlinks are relative
# (apps/api/node_modules/* -> ../../../../node_modules/.pnpm/...), so the tree
# must live at the same relative positions it was installed at.

ARG NODE_VERSION=24

########## base: node + pnpm ##########
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.9.0
WORKDIR /repo

########## deps manifests (shared by build + prod-deps) ##########
FROM base AS manifests
# pnpm needs every workspace project's package.json to validate the lockfile,
# even for a filtered install.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

########## build: compile shared + api ##########
FROM manifests AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --filter @avion/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
# shared first (api imports its dist), then prisma generate + nest build.
RUN pnpm --filter @avion/shared build && pnpm --filter @avion/api build

########## prod-deps: production-only node_modules ##########
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prod --filter @avion/api...

########## runner ##########
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /repo

# Production dependency tree (root virtual store + per-package symlink dirs).
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
# Compiled output + the manifests node resolves against.
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json

USER node
EXPOSE 4000

# GET /api/health reports liveness + database reachability.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

WORKDIR /repo/apps/api
CMD ["node", "dist/main.js"]
