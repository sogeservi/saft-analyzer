FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/install-git-hooks.mjs ./scripts/install-git-hooks.mjs
RUN npm ci
COPY . .
ARG BUILD_VERSION=dev
ARG BUILD_DATE=unknown
ENV NEXT_PUBLIC_APP_VERSION=$BUILD_VERSION
ENV NEXT_PUBLIC_BUILD_DATE=$BUILD_DATE
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
