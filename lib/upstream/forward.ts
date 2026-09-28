/**
 * Header and path rules for the `/v1` proxy. No upstream address lives here,
 * so a test can import this file without pulling in server-only code.
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

/** A segment the route params must never carry into the upstream path. */
export function apiPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\")
    ) {
      return null;
    }
  }
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

/** Request headers the API needs. The browser's cookie stays on this origin. */
export function forwardRequestHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name) || name === "cookie") return;
    out.append(key, value);
  });
  return out;
}

/** Response headers the browser needs. No upstream cookie, no CORS grant. */
export function forwardResponseHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name) || name === "set-cookie" || name.startsWith("access-control-")) return;
    out.append(key, value);
  });
  return out;
}
