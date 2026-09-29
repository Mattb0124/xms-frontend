# syntax=docker/dockerfile:1

################################################################################
# Build
################################################################################
FROM node:24-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# output: "standalone" in next.config.ts emits .next/standalone, a server plus
# only the node_modules it actually reached.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

################################################################################
# Runtime
################################################################################
FROM node:24-alpine AS runtime

# No RDS trust bundle. This service has no database and no database credential.

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN chown -R node:node /app
# Numeric, not a name. With runAsNonRoot the kubelet refuses a named user it
# cannot verify from image metadata alone. node is uid 1000.
USER 1000:1000

EXPOSE 3000
CMD ["node", "server.js"]
