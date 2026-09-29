/**
 * The last request id the browser saw on an API response. The telemetry
 * client attaches it to the next event so a click and its API call share one
 * id in the unified view (Audit & Analytics section 5.2).
 */
let lastRequestId: string | null = null;

export function rememberRequestId(id: string): void {
  lastRequestId = id;
}

export function currentRequestId(): string | null {
  return lastRequestId;
}
