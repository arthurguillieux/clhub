# syntax=docker/dockerfile:1

# Debian-based (glibc), not -alpine (musl): `sharp`'s musl prebuilds dlopen a
# specific libvips-cpp.so that isn't reliably present on Alpine, breaking
# every request that touches item/avatar photos. Slim's glibc build is the
# well-trodden path for sharp in Docker; worth the larger image on a NAS
# with plenty of disk but tight RAM (image size doesn't cost RAM, sharp's
# own runtime footprint is the same either way).
FROM node:24-slim AS base
RUN corepack enable

# --- deps: install dependencies only, so this layer caches across source changes
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder: compile the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runner: minimal runtime image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 clhub

COPY --from=builder /app/public ./public
COPY --from=builder --chown=clhub:nodejs /app/.next/standalone ./
COPY --from=builder --chown=clhub:nodejs /app/.next/static ./.next/static

# Overwrite standalone's own pruned node_modules with deps' full, ordinary
# `pnpm install` one. Two rounds of `serverExternalPackages` + relying on
# Next's file tracer to pick up sharp's native binding *and* its separate
# libvips-cpp.so still weren't enough — confirmed live on the NAS both
# times, not just in theory. A complete, normally-resolved node_modules
# sidesteps the question of what the tracer does or doesn't catch entirely.
# Costs disk, which this NAS has plenty of; costs nothing at runtime.
COPY --from=deps --chown=clhub:nodejs /app/node_modules ./node_modules

# Migration runner, run from its own folder before the server starts (see
# CMD) — Node module resolution walks up from migrate.mjs to the
# node_modules above, so drizzle-orm/pg resolve from there without a
# separate copy.
COPY --from=builder --chown=clhub:nodejs /app/drizzle ./migrate/drizzle
COPY --chown=clhub:nodejs docker/migrate.mjs ./migrate/migrate.mjs

USER clhub
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node migrate/migrate.mjs && node server.js"]
