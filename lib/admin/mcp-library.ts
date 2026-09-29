/**
 * The MCP library as the screens read it (AI Integration section 4, ADR-19).
 *
 * The operator keeps a catalog of MCP connections and turns them on account by
 * account, because a managed-services desk works several clients' estates and
 * they do not run the same systems: Axel should reach the systems of the
 * account whose ticket is open and nothing else.
 *
 * These types mirror `backend/src/domain/ai/mcp-library.ts`. The server is the
 * one that validates, as it is for every catalog; what is here exists so the
 * form can say what is wrong before a round trip, and so the list can be drawn.
 */

export type McpTransport = "streamable_http" | "stdio";

export interface McpServerDefinition {
  slug: string;
  name: string;
  description?: string;
  transport: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  /** Where the credential lives. Never the credential. */
  secret_ref?: string | null;
  /** True where the caller's own token is the authorization, as for XMS itself. */
  caller_token?: boolean;
}

export interface McpLibraryBody {
  servers?: McpServerDefinition[];
  enabled?: string[];
}

export const EMPTY_LIBRARY: McpLibraryBody = { servers: [], enabled: [] };

/** The catalog out of whatever the describe call answered, defaulting to empty. */
export function libraryOf(body: unknown): McpLibraryBody {
  if (!body || typeof body !== "object") return EMPTY_LIBRARY;
  const { servers, enabled } = body as McpLibraryBody;
  return { servers: Array.isArray(servers) ? servers : [], enabled: Array.isArray(enabled) ? enabled : [] };
}

/**
 * The connections one account gets: the operator's catalog, narrowed to what
 * that account turned on. The same rule the server applies, so the screen shows
 * what will actually happen rather than its own idea of it.
 *
 * An account that has chosen nothing follows the operator's own enabled list,
 * which is how a new client starts with the connections the operator considers
 * standard rather than with none.
 */
export function enabledSlugs(library: McpLibraryBody, override?: McpLibraryBody | null): string[] {
  return [...(override?.enabled ?? library.enabled ?? [])];
}

/** A slug an account enabled that the catalog no longer defines. Shown, not hidden. */
export function retiredSlugs(library: McpLibraryBody, chosen: string[]): string[] {
  const known = new Set((library.servers ?? []).map((server) => server.slug));
  return chosen.filter((slug) => !known.has(slug));
}

const SLUG = /^[a-z][a-z0-9-]{1,48}$/;
const SECRET_ISH = /(secret|token|password|passwd|pwd|api[-_]?key|authorization|bearer)/i;
const PLACEHOLDER_ONLY = /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/;

/**
 * What the form checks before asking the server. The server checks the same
 * things and is the authority; this exists so a typo is answered beside the
 * field rather than as a refusal after a round trip.
 */
export function problemsWith(draft: McpServerDefinition, others: McpServerDefinition[]): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!SLUG.test(draft.slug ?? "")) {
    problems.slug = "Lower-case letters, digits and hyphens, starting with a letter.";
  } else if (others.some((server) => server.slug === draft.slug)) {
    problems.slug = "Another connection already uses this name.";
  }
  if (!draft.name?.trim()) problems.name = "Give it a name people will recognize.";
  if (draft.transport === "streamable_http" && !/^https:\/\//.test(draft.url ?? "")) {
    problems.url = "Must be an https address: a tool call carries account data and the token that authorizes it.";
  }
  if (draft.transport === "stdio" && !draft.command?.trim()) {
    problems.command = "A stdio connection needs a command to run.";
  }
  for (const [key, value] of Object.entries(draft.headers ?? {})) {
    if (SECRET_ISH.test(key) && !PLACEHOLDER_ONLY.test(value)) {
      problems.headers = `${key} must be a \${PLACEHOLDER}. A credential written here would be in the version history and the audit trail; name it under "Secret reference" instead.`;
      break;
    }
  }
  return problems;
}

/** Header lines as the form edits them, `Name: value` per line. */
export function headersToText(headers: Record<string, string> | undefined): string {
  return Object.entries(headers ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export function headersFromText(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}
