import { NextRequest, NextResponse } from 'next/server';
import { createItem, listItems, UpstreamError } from '@/lib/backend';
import { parseCreateItemInput, ValidationError } from '@/lib/validate';

/**
 * The BFF's items surface.
 *
 * The browser calls this. It does not — cannot — call xms-backend, which has
 * no public gateway and whose address resolves only inside the cluster. Same
 * origin, so no CORS, no preflight, and no place for a token to live in the
 * page.
 *
 * Errors are surfaced, not smoothed over. A bad body is a 400 with the reason
 * the caller can act on; an upstream that failed is a 502 naming the service,
 * the URL and what it said. Neither case returns an empty list.
 */

export const dynamic = 'force-dynamic';

function failure(err: unknown): NextResponse {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { error: 'invalid request', detail: err.message },
      { status: 400 },
    );
  }
  if (err instanceof UpstreamError) {
    console.error(`api/items: ${err.message}`);
    return NextResponse.json(
      {
        error: 'upstream failed',
        service: err.service,
        upstreamStatus: err.status,
        detail: err.message,
      },
      { status: 502 },
    );
  }
  throw err;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get('limit');
  const limit = raw === null ? 50 : Number(raw);

  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return NextResponse.json(
      { error: 'invalid request', detail: 'limit must be an integer between 1 and 500' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await listItems(limit));
  } catch (err) {
    return failure(err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid request', detail: 'body must be valid JSON' },
      { status: 400 },
    );
  }

  try {
    // Validated before it costs a cluster round trip. The backend validates
    // again, because it owns the table and does not get to trust its callers.
    const input = parseCreateItemInput(body);
    return NextResponse.json(await createItem(input), { status: 201 });
  } catch (err) {
    return failure(err);
  }
}
