# syntax=docker/dockerfile:1
ARG NODE_VERSION=22-alpine

# --- deps: install dependencies only (better layer caching) ---
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: build the Next.js standalone output ---
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, and
# app/api/password-reset/route.ts constructs a ConvexHttpClient at module
# scope, so `next build` fails without a non-empty NEXT_PUBLIC_CONVEX_URL.
# Pass the real deployment URL as a build arg for a deployable image; the
# placeholder below only exists so the image still builds without one.
ARG NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud
ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}

# Drives the dev banner, noindex robots meta, and prod-only Clarity analytics
# (utils/env.ts) — CI sets this per branch (develop -> development, main ->
# production). Also build-time-baked, same reasoning as above.
ARG NEXT_PUBLIC_APP_ENV=development
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}

ARG NEXT_PUBLIC_CLARITY_PROJECT_ID=""
ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=${NEXT_PUBLIC_CLARITY_PROJECT_ID}

# Short commit SHA shown in the footer (utils/version.ts) — dev builds only;
# CI passes an empty string for prod so the footer stays clean there.
ARG NEXT_PUBLIC_APP_COMMIT=""
ENV NEXT_PUBLIC_APP_COMMIT=${NEXT_PUBLIC_APP_COMMIT}

RUN npm run build

# --- runner: minimal production image ---
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder --chown=node:node /app/public ./public

RUN mkdir .next && chown node:node .next

# Reduced image size via output file tracing: https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/healthz || exit 1

CMD ["node", "server.js"]
