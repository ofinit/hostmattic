# ==============================================================================
# Hostmattic Production Dockerfile for Coolify PaaS
# Multi-stage standalone Next.js build with PostgreSQL Prisma support
# ==============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy DATABASE_URL during build so prisma generate succeeds
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output and public assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# Liveness, not readiness.
#
# This asks one question: is this container still serving HTTP? It passes on
# any 200 from /api/health and deliberately does NOT fail when that response
# says "degraded" because the database is unreachable.
#
# Restarting the app cannot fix a database outage, and an orchestrator that
# keeps killing the container over one would also take down every page that
# does not need the database - the marketing site, the domain search, the
# login form. A database fault belongs in the response body and the logs,
# where it is visible without destroying what still works.
#
# The grep is there so a proxy's own error page cannot pass as the app.
# start-period covers Prisma generation and the first compile on boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health | grep -q '"service":"hostmattic-web"' || exit 1

CMD ["node", "server.js"]
