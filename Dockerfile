# syntax=docker/dockerfile:1

################################################################################
# Build
################################################################################
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json next.config.ts ./
COPY app ./app
COPY lib ./lib

# `output: "standalone"` in next.config.ts makes this emit .next/standalone —
# a server plus only the node_modules it actually reached. There is no
# `npm prune` step because that tracing has already happened.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

################################################################################
# Runtime
################################################################################
FROM node:24-alpine AS runtime

# No RDS trust bundle here, unlike the other XMS services. This one has no
# database and no database credential, so there is nothing for it to verify a
# database certificate for.

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone server, then the static asset tree it does not inline.
# There is no public/ directory: the only static file is app/icon.svg, which
# the App Router emits into the build itself.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

RUN chown -R node:node /app
# Numeric, not a name. Kubernetes cannot verify that a named user is non-root
# from image metadata alone, so with runAsNonRoot set the kubelet refuses to
# start the container with CreateContainerConfigError. (node is uid 1000.)
USER 1000:1000

EXPOSE 3000
CMD ["node", "server.js"]
