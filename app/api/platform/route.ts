import { NextResponse } from 'next/server';
import { collectPlatformSnapshot } from '@/lib/platform';

/**
 * The aggregate identity document behind /platform.
 *
 * One request in, four server-side calls out: this service's own identity
 * plus GET /platform/identity on the backend, the worker and the MCP server,
 * all over cluster DNS. The browser makes exactly one request, to this
 * origin, and that is the property the page exists to demonstrate.
 *
 * Per-upstream failures are tolerated here and only here — the tolerance
 * lives in collectPlatformSnapshot, with the reasoning next to it. The route
 * itself still fails loudly: if the snapshot cannot be assembled at all, that
 * is a bug in this service and it returns a 500 rather than a partial
 * document pretending to be whole.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const snapshot = await collectPlatformSnapshot();
  return NextResponse.json(snapshot, {
    headers: { 'cache-control': 'no-store' },
  });
}
