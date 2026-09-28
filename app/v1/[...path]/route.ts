import { proxyApi } from "@/lib/upstream/proxy";

/**
 * Same-origin door to the API. The browser requests `/v1/...` on this host.
 * The handler forwards it to BACKEND_URL. See lib/upstream/proxy.ts.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyApi(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
