FROM node:26-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl libpcre2-8-0 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,target=/root/.npm \
  npm ci --ignore-scripts --no-audit --no-fund --prefer-offline
RUN npm rebuild --foreground-scripts

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM dependencies AS migrator
RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin replenops
COPY --chown=replenops:nodejs prisma ./prisma
USER replenops
CMD ["npm", "run", "db:prepare"]

FROM migrator AS release-migrator
USER root
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
USER replenops
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM node:26-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl libpcre2-8-0 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin replenops \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=builder --chown=replenops:nodejs /app/.next/standalone ./
COPY --from=builder --chown=replenops:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=replenops:nodejs /app/public ./public

USER replenops
EXPOSE 3000
CMD ["node", "server.js"]
