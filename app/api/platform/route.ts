import { NextResponse } from "next/server";
import { collectPlatformSnapshot } from "@/lib/platform/snapshot";
import { toPublicSnapshot } from "@/lib/platform/public-view";

/**
 * The machine-readable version of /platform.
 *
 * One request in, several server-side calls out: this service's own identity
 * plus the identity endpoint of each internal service, over the cluster's own
 * network. The browser makes exactly one request, to this origin, and that is
 * the property the page exists to demonstrate.
 *
 * It returns the same redacted document the page renders, through the same
 * function. That matters: this endpoint is public and unauthenticated, and if
 * it served the raw snapshot it would hand out the account number, the role
 * names, the cluster addresses and the database endpoint that the HTML is
 * careful to leave out. One redaction, one place, no way for the two to
 * disagree.
 *
 * Per-upstream failures are tolerated inside collectPlatformSnapshot and only
 * there, because a diagnostic page that renders nothing when one service is
 * down is useless exactly when it is needed. The route itself still fails
 * loudly: if the snapshot cannot be assembled at all, that is a bug here and
 * it returns a 500 rather than a partial document pretending to be whole.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const snapshot = toPublicSnapshot(await collectPlatformSnapshot());
  return NextResponse.json(snapshot, {
    headers: { "cache-control": "no-store" },
  });
}
