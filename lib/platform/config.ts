import "server-only";

/**
 * Typed configuration, read from the environment at request time.
 *
 * Nothing here has a fallback. A missing upstream address is a deployment
 * that disagrees with the chart, and the useful behaviour is a loud error
 * naming the variable, not a quiet default that makes the proof page lie.
 *
 * `import 'server-only'` is the enforcement, not a convention: if any of this
 * is ever imported from a Client Component the build fails rather than
 * shipping an internal hostname to a browser.
 */

function req(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `Missing required configuration: ${name}. ` +
        `In the cluster this comes from deploy/values-dev.yaml via the chart; ` +
        `locally from .env.`,
    );
  }
  return value;
}

function opt(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value === "" ? null : value;
}

function int(name: string, fallbackWhenAbsent: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallbackWhenAbsent;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, got "${raw}"`);
  }
  return parsed;
}

/** An internal service this front end is allowed to call. */
export interface Upstream {
  /** Kubernetes service name, also the DNS label and the card heading. */
  name: string;
  /** Base URL, no trailing slash. */
  url: string;
  /** One line of context for the proof page. */
  role: string;
}

export interface AppConfig {
  serviceName: string;
  environment: string;
  region: string;
  /** Per-call deadline for every upstream request. */
  upstreamTimeoutMs: number;
  upstreams: {
    backend: Upstream;
    worker: Upstream;
    mcp: Upstream;
  };
  kubernetes: {
    pod: string | null;
    namespace: string | null;
    node: string | null;
    serviceAccount: string | null;
  };
}

function base(name: string): string {
  return req(name).replace(/\/+$/, "");
}

/**
 * Built per request rather than memoised at module load. The cost is a few
 * property reads, and the gain is that a Next.js build, which evaluates
 * modules, never needs these variables to be present.
 */
export function config(): AppConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "xms-frontend",
    environment: req("ENVIRONMENT"),
    region: process.env.AWS_REGION ?? "us-east-1",
    upstreamTimeoutMs: int("UPSTREAM_TIMEOUT_MS", 8_000),
    upstreams: {
      backend: {
        name: "xms-backend",
        url: base("BACKEND_URL"),
        role: "The application interface. Owns the data the page shows.",
      },
      worker: {
        name: "xms-worker",
        url: base("WORKER_URL"),
        role: "Scheduled work. Runs on a timer, answers to no one outside.",
      },
      mcp: {
        name: "xms-mcp",
        url: base("MCP_URL"),
        role: "Tooling endpoint for developers. Reads data it does not own, and cannot change it.",
      },
    },
    kubernetes: {
      pod: opt("POD_NAME"),
      namespace: opt("POD_NAMESPACE"),
      node: opt("NODE_NAME"),
      serviceAccount: opt("SERVICE_ACCOUNT_NAME"),
    },
  };
}
