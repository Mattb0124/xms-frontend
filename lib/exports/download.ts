import { getBearerToken } from "@/lib/auth/token";
import { API_BASE_URL } from "@/redux/api";

/**
 * Authenticated file downloads. The export routes answer with an attachment
 * and need the bearer, so the file is fetched with the token and handed to
 * the browser through an object URL. Presigned downloads (report packs) do
 * not come through here: the API minted their URL and the browser opens it.
 */
export interface DownloadedFile {
  blob: Blob;
  fileName: string;
  rowCount: number | null;
}

export interface DownloadRequest {
  /** Path under the API base, or an absolute URL. */
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  fallbackName: string;
}

export class DownloadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(code ?? `download failed (${status})`);
    this.name = "DownloadError";
  }
}

/** Reads the filename from a Content-Disposition header (quoted, bare or RFC 5987). */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      return fallback;
    }
  }
  const quoted = /filename\s*=\s*"([^"]+)"/.exec(header);
  if (quoted?.[1]) return quoted[1];
  const bare = /filename\s*=\s*([^;]+)/.exec(header);
  return bare?.[1]?.trim() || fallback;
}

export async function fetchDownload(
  request: DownloadRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<DownloadedFile> {
  const token = await getBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (request.body !== undefined) headers["content-type"] = "application/json";
  const url = /^https?:\/\//.test(request.url) ? request.url : `${API_BASE_URL}${request.url}`;
  const response = await fetchImpl(url, {
    method: request.method ?? "GET",
    headers,
    credentials: "omit",
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
  if (!response.ok) {
    let code: string | null = null;
    try {
      const parsed = (await response.json()) as { code?: string };
      code = typeof parsed.code === "string" ? parsed.code : null;
    } catch {
      code = null;
    }
    throw new DownloadError(response.status, code);
  }
  const blob = await response.blob();
  const rowHeader = response.headers.get("x-row-count");
  const rowCount =
    rowHeader !== null && rowHeader !== "" && !Number.isNaN(Number(rowHeader)) ? Number(rowHeader) : null;
  return {
    blob,
    fileName: fileNameFromDisposition(response.headers.get("content-disposition"), request.fallbackName),
    rowCount,
  };
}

/** Hands a blob to the browser as a download through a short-lived object URL. */
export function saveBlob(blob: Blob, fileName: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fetches with the bearer and saves; returns the file facts for the toast. */
export async function downloadFile(request: DownloadRequest): Promise<DownloadedFile> {
  const file = await fetchDownload(request);
  saveBlob(file.blob, file.fileName);
  return file;
}
