/**
 * Untrusted-URL handling (security review findings 26 and 38).
 *
 * An `href`, a `window.open` target or a download name built from a string
 * the API returned is untrusted, however far away the service that first
 * accepted it: a connector instance base URL, a presigned download, an
 * external record link. A DTO three services away is not a client-side
 * control, and with `'unsafe-inline'` still in script-src the CSP would not
 * stop a `javascript:` href either. Every such value goes through here first.
 */

/** What may reach an href or window.open: an ordinary web URL, nothing else. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** The rel every link that leaves the application must carry. */
export const EXTERNAL_REL = "noopener noreferrer";

/**
 * The URL if it is safe to navigate to, otherwise null.
 *
 * Accepts an absolute `http:` or `https:` URL, or a path under the
 * application. Refuses everything else, including `javascript:`, `data:`,
 * `blob:`, `vbscript:` and a protocol-relative `//host`, which leaves the
 * application while looking like a path.
 */
export function safeHref(candidate: string | null | undefined): string | null {
  if (typeof candidate !== "string") return null;
  const value = candidate.trim();
  if (value === "") return null;
  if (value.startsWith("/")) {
    // "//host" is protocol-relative; some browsers also read "/\" that way.
    return /^\/(?![/\\])/.test(value) ? value : null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null;
}

/** True when the href leaves the application, so it needs a target and a rel. */
export function isExternalHref(href: string): boolean {
  return /^https?:/i.test(href);
}

/**
 * Opens a validated URL in a new tab with no opener and no referrer.
 * Returns false, having opened nothing, when the URL is not safe.
 */
export function openExternal(
  candidate: string | null | undefined,
  win: Pick<Window, "open"> | undefined = typeof window === "undefined" ? undefined : window,
): boolean {
  const href = safeHref(candidate);
  if (href === null || !win) return false;
  win.open(href, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * C0 and C1 control characters, and the bidi marks and overrides that let
 * "annual-report-fdp.exe" read as "annual-report-exe.pdf" in a save dialog.
 * Written as code points rather than a regular expression class so the
 * characters themselves never appear in this file.
 */
function isUnsafeNameCharacter(code: number): boolean {
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  if (code === 0x200e || code === 0x200f) return true;
  if (code >= 0x202a && code <= 0x202e) return true;
  return code >= 0x2066 && code <= 0x2069;
}

const PATH_CHARACTERS = /[\\/:*?"<>|]+/g;
const MAX_FILE_NAME = 120;

/**
 * A filename fit for `a.download`. The name arrives in a Content-Disposition
 * header, so it is server-supplied: path separators, control characters and
 * bidi overrides are removed, leading dots are dropped so it can be neither a
 * traversal nor a hidden file, and the length is capped. Browsers sanitise
 * `download` themselves; this is the layer that does not depend on that.
 */
export function safeFileName(candidate: string | null | undefined, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  const cleaned = [...candidate]
    .filter((character) => !isUnsafeNameCharacter(character.codePointAt(0) ?? 0))
    .join("")
    .replace(PATH_CHARACTERS, "_")
    // After the separators are gone, so "../../etc/passwd" cannot keep a
    // leading "..", and so the result is never a hidden file.
    .replace(/^[._\s]+/, "")
    .trim()
    .slice(0, MAX_FILE_NAME);
  return cleaned === "" ? fallback : cleaned;
}
