FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/install-git-hooks.mjs ./scripts/install-git-hooks.mjs
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG BUILD_VERSION=dev
ARG BUILD_DATE=unknown
ENV NEXT_PUBLIC_APP_VERSION=$BUILD_VERSION
ENV NEXT_PUBLIC_BUILD_DATE=$BUILD_DATE
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /app/share-data && chown nextjs:nodejs /app/share-data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/rules ./rules

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV SHARE_STORAGE_DIR=/app/share-data

CMD ["node", "server.js"]
