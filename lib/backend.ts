import 'server-only';

import { config, Upstream } from './config';
import { CreateItemInput, Item, PlatformIdentity } from './types';

/**
 * The one place that knows how to reach the internal services.
 *
 * Everything in this file runs on the server. The addresses it dials —
 * xms-backend.xms.svc.cluster.local and friends — resolve inside the cluster
 * and nowhere else, so a browser could not use them even if it learned them.
 * `import 'server-only'` turns that from an intention into a build error.
 *
 * The error policy is deliberate and is NOT uniform across the app:
 *
 *   here                  loud. A non-2xx upstream throws `UpstreamError`
 *                         carrying the service, the URL, the status and the
 *                         body. No empty arrays, no nulls, no "best effort".
 *
 *   /api/platform         the single exception, and only there. That route
 *                         catches per upstream so one dead service cannot
 *                         blank the diagnostic page. See its own comment.
 *
 * ---------------------------------------------------------------------------
 * WHERE AUTHENTICATION GOES
 * ---------------------------------------------------------------------------
 * There is no authentication yet, and this is the question the team asks
 * first, so here is the answer in advance.
 *
 * This service is the only public surface, which makes it the only place a
 * session can be established or checked. The internal services are not
 * exposed, so they never see a browser cookie and never validate one; they
 * trust the identity this service asserts on their behalf. That is the whole
 * reason the BFF is worth having.
 *
 * Two edits, both inside this file, and nothing else in the app changes:
 *
 *   1. Check the session. In `callUpstream`, before the fetch:
 *
 *          const session = await auth();            // Clerk, NextAuth, ...
 *          if (!session?.userId) {
 *            throw new UnauthorizedError('no session');
 *          }
 *
 *      Callers already handle a thrown error, so an expired session becomes a
 *      401 from the BFF rather than a silent empty page. Route handlers map
 *      `UnauthorizedError` to a 401 and Server Components let it hit the
 *      nearest error boundary.
 *
 *   2. Forward the identity. Still in `callUpstream`, on `headers`:
 *
 *          'x-xms-user-id':  session.userId,
 *          'x-xms-user-org': session.orgId ?? '',
 *          'x-xms-actor':    'xms-frontend',
 *
 *      The upstream reads these instead of parsing a token. It may trust them
 *      because nothing but this service can reach it: the Service has no
 *      public gateway, and a NetworkPolicy should pin the source to this
 *      deployment's pods so the trust is enforced rather than assumed.
 *
 * What must NOT happen: putting the session token itself into these headers,
 * or handing the browser a token and letting it call an upstream directly.
 * Both re-export the blast radius the BFF exists to contain.
 * ---------------------------------------------------------------------------
 */

/** A named, loud failure. Every field is something an operator needs. */
export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    readonly url: string,
    readonly status: number | null,
    readonly detail: string,
  ) {
    super(
      status === null
        ? `${service} is unreachable at ${url} — ${detail}`
        : `${service} answered HTTP ${status} for ${url} — ${detail}`,
    );
    this.name = 'UpstreamError';
  }
}

interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

/**
 * One request to one internal service. Everything else in this file is a
 * typed wrapper around this function, so the timeout, the error shape and
 * (later) the session check exist exactly once.
 */
async function callUpstream<T>(
  upstream: Upstream,
  path: string,
  options: CallOptions = {},
): Promise<T> {
  const url = `${upstream.url}${path}`;
  const { upstreamTimeoutMs } = config();

  // -- session check goes here; see the header comment ----------------------

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        // -- forwarded user identity goes here; see the header comment ------
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // This is live infrastructure evidence and a list of rows a user just
      // changed. Neither is ever served from a cache.
      cache: 'no-store',
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch (cause) {
    const detail =
      cause instanceof Error && cause.name === 'TimeoutError'
        ? `no response within ${upstreamTimeoutMs}ms`
        : cause instanceof Error
          ? cause.message
          : String(cause);
    throw new UpstreamError(upstream.name, url, null, detail);
  }

  if (!response.ok) {
    // The body is where a Nest exception filter puts the reason. Dropping it
    // would turn a fixable message into a bare status code.
    const detail = (await response.text().catch(() => '')) || '(empty body)';
    throw new UpstreamError(upstream.name, url, response.status, detail.slice(0, 2_000));
  }

  return (await response.json()) as T;
}

/* ---------------------------------------------------------------- items -- */

export async function listItems(limit = 50): Promise<Item[]> {
  const { backend } = config().upstreams;
  const items = await callUpstream<Item[]>(backend, `/items?limit=${limit}`);
  if (!Array.isArray(items)) {
    throw new UpstreamError(
      backend.name,
      `${backend.url}/items`,
      200,
      `expected an array of items, got ${typeof items}`,
    );
  }
  return items;
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const { backend } = config().upstreams;
  return callUpstream<Item>(backend, '/items', { method: 'POST', body: input });
}

/* ------------------------------------------------------------- identity -- */

/**
 * `GET /platform/identity` on any XMS service. Throws like everything else
 * here; only /api/platform is allowed to soften that, and it does so itself.
 */
export function serviceIdentity(upstream: Upstream): Promise<PlatformIdentity> {
  return callUpstream<PlatformIdentity>(upstream, '/platform/identity');
}
