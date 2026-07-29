# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
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

# A self-contained migration runner, separate from the standalone server
# above. drizzle-kit (the usual migrate CLI) is a devDependency and isn't
# part of the standalone output, so this uses drizzle-orm's own migrator
# instead — it and `pg` are already production dependencies, just not
# necessarily the full unpruned package Next's tracing would keep, hence
# the explicit copy of `deps`' full node_modules here rather than reusing
# the standalone server's own trimmed-down one.
COPY --from=deps --chown=clhub:nodejs /app/node_modules ./migrate/node_modules
COPY --from=builder --chown=clhub:nodejs /app/drizzle ./migrate/drizzle
COPY --chown=clhub:nodejs docker/migrate.mjs ./migrate/migrate.mjs

USER clhub
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node migrate/migrate.mjs && node server.js"]
