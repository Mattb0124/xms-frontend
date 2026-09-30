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

# NEXT_PUBLIC_* values are inlined into the browser bundle by `next build`, so
# they are build arguments, not runtime environment. The delivery pipeline
# passes both from the platform (clerkFrontend: true in azure-pipelines.yml):
# the Clerk publishable key of the environment's instance, from Vault, and the
# deploy target. Neither has a default. The deploy target is always required,
# because unset is read as production; the key is required everywhere but a
# developer's own machine, where a build without Clerk is the dev sign-in.
ARG NEXT_PUBLIC_DEPLOY_TARGET
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN : "${NEXT_PUBLIC_DEPLOY_TARGET:?build argument NEXT_PUBLIC_DEPLOY_TARGET is required}" \
 && if [ "$NEXT_PUBLIC_DEPLOY_TARGET" != "local" ] && [ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]; then \
      echo "build argument NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for the $NEXT_PUBLIC_DEPLOY_TARGET deploy target" >&2; \
      exit 1; \
    fi
ENV NEXT_PUBLIC_DEPLOY_TARGET=$NEXT_PUBLIC_DEPLOY_TARGET \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

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
