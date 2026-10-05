import "server-only";

import { apiPath, forwardRequestHeaders, forwardResponseHeaders } from "@/lib/upstream/forward";

/**
 * The product's path to xms-backend.
 *
 * The browser calls this origin (`/v1/...`). This module is the only place
 * that reads BACKEND_URL, and `server-only` makes importing it from a Client
 * Component a build error. The address is a Helm value, read per request,
 * never a NEXT_PUBLIC_ variable and never a build argument.
 *
 * The bearer is still forwarded. The API validates that token itself today,
 * so dropping it would sign everybody out. The session cookie is not
 * forwarded, and the upstream address is not returned to the browser. When
 * the API trusts an identity asserted by this service, the forward of the
 * bearer goes away and the check moves to the comment marked in
 * lib/platform/client.ts. Do not add CORS to paper over a browser that has
 * started calling the API directly.
 */

function backendUrl(): string {
  const value = process.env.BACKEND_URL;
  if (value === undefined || value === "") {
    throw new Error(
      "Missing required configuration: BACKEND_URL. " +
        "In the cluster this comes from deploy/values-dev.yaml via the chart; locally from .env.local.",
    );
  }
  return value.replace(/\/+$/, "");
}

/**
 * Forward one `/v1` request. The body is streamed both ways, so an Axel turn
 * and a file download are not buffered into a string. A transport failure
 * answers 502 with a code and no upstream address.
 */
export async function proxyApi(request: Request, segments: string[]): Promise<Response> {
  const path = apiPath(segments);
  if (path === null) {
    return Response.json({ code: "not_found" }, { status: 404 });
  }
  const incoming = new URL(request.url);
  const target = `${backendUrl()}/v1/${path}${incoming.search}`;
  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: forwardRequestHeaders(request.headers),
    redirect: "manual",
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.error(`upstream unreachable for /v1/${path}: ${detail}`);
    return Response.json({ code: "upstream_unreachable" }, { status: 502 });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: forwardResponseHeaders(response.headers),
  });
}
