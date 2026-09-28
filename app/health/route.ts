import { NextResponse } from "next/server";

/**
 * Liveness and readiness, as the chart's probes expect at /health.
 *
 * This deliberately does NOT check the upstreams. This service is useful
 * while they are down, /platform is at its most useful precisely then, so
 * making its readiness depend on theirs would pull the front end out of the
 * load balancer at the moment an operator needs it, and would turn one
 * service's outage into two.
 *
 * It reports that this process is up and serving. That is the only claim it
 * is in a position to make.
 */

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok",
    service: process.env.SERVICE_NAME ?? "xms-frontend",
  });
}
