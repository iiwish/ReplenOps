FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin replenops

COPY --from=builder --chown=replenops:nodejs /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=replenops:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=replenops:nodejs /app/.next ./.next
COPY --from=builder --chown=replenops:nodejs /app/public ./public
COPY --from=builder --chown=replenops:nodejs /app/prisma ./prisma

USER replenops
EXPOSE 3000
CMD ["npm", "run", "start"]
