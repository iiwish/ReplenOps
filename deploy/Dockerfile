FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl libpcre2-8-0 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin replenops

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,target=/root/.npm \
  npm ci --ignore-scripts --no-audit --no-fund --prefer-offline
RUN npm rebuild --foreground-scripts

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS migrator
COPY deploy/migrator/package.json deploy/migrator/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --no-audit --no-fund --prefer-offline
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN node node_modules/prisma/build/index.js generate
COPY --chown=replenops:nodejs prisma/migrations ./prisma/migrations
COPY --chown=replenops:nodejs \
  prisma/seed.ts \
  prisma/demo-seed.ts \
  prisma/demo-verify.ts \
  prisma/seed-config.ts \
  prisma/bootstrap-admin.ts \
  prisma/bootstrap-admin-core.ts \
  ./prisma/
USER replenops
CMD ["npm", "run", "db:prepare"]

FROM migrator AS demo-seeder
CMD ["node", "node_modules/tsx/dist/cli.mjs", "prisma/demo-seed.ts"]

FROM migrator AS release-migrator
USER root
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
USER replenops
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=builder --chown=replenops:nodejs /app/.next/standalone ./
COPY --from=builder --chown=replenops:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=replenops:nodejs /app/public ./public

USER replenops
EXPOSE 3000
CMD ["node", "server.js"]
