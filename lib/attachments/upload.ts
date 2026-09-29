import { getBearerToken } from "@/lib/auth/token";
import { API_BASE_URL } from "@/redux/api";
import type { Attachment, AttachmentVisibility, PresignResponse } from "@/redux/attachmentsApi";

/**
 * The presigned upload link lives three minutes (the API's
 * `UPLOAD_LINK_SECONDS`). Nothing here counts it down: the store refuses an
 * expired signature with a bare 403 and the reader is told to choose the
 * file again.
 *
 * The upload flow (Security section 6): presign with the API (allowlist and
 * account size cap enforced there), send the bytes to the minted URL (PUT
 * raw body for the local store, POST form for S3), confirm so the scan
 * runs. The verdict comes back on the confirmed row; nothing is downloadable
 * until it is clean.
 */
export type UploadStage = "presigning" | "uploading" | "scanning" | "clean" | "quarantined" | "failed";

export interface UploadProgress {
  stage: UploadStage;
  /** 0 to 100 during the upload stage. */
  percent: number;
}

export interface UploadOptions {
  portal?: boolean;
  visibility?: AttachmentVisibility;
  onProgress?: (progress: UploadProgress) => void;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export class UploadRefusal extends Error {
  constructor(
    readonly code: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(`upload refused: ${code}`);
  }
}

export function describeRefusal(refusal: UploadRefusal): string {
  switch (refusal.code) {
    case "unsupported_type":
      return "That file type is not accepted.";
    case "too_large": {
      const max = Number(refusal.detail?.max_bytes ?? 0);
      return max > 0 ? `The file is larger than the ${formatBytes(max)} limit.` : "The file is too large.";
    }
    case "ticket_closed":
      return "This ticket is closed; files cannot be added.";
    case "upload_missing":
    case "size_mismatch":
      return "The upload did not complete. Try again.";
    // The link is minted for three minutes. A large file on a slow line can
    // outlive it, and choosing the file again mints a fresh one.
    case "upload_expired":
      return "The upload link had expired before the file finished. Choose the file again.";
    case "network":
      return "The file could not be uploaded.";
    default:
      return `The upload was refused (${refusal.code}).`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getBearerToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function readError(response: Response): Promise<UploadRefusal> {
  try {
    const body = (await response.json()) as { code?: string } & Record<string, unknown>;
    return new UploadRefusal(typeof body.code === "string" ? body.code : "error", body);
  } catch {
    return new UploadRefusal("error");
  }
}

/** Presigns, uploads and confirms one file; resolves with the confirmed row. */
export async function uploadAttachment(
  ticketKey: string,
  file: File,
  options: UploadOptions = {},
): Promise<Attachment> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = `${API_BASE_URL}/v1${options.portal ? "/portal" : ""}`;
  const report = (stage: UploadStage, percent: number) => options.onProgress?.({ stage, percent });
  const contentType = file.type || "application/octet-stream";

  report("presigning", 0);
  const presign = await fetchImpl(`${base}/tickets/${ticketKey}/attachments/presign`, {
    method: "POST",
    headers: { ...(await authHeaders()), "content-type": "application/json" },
    body: JSON.stringify({ file_name: file.name, content_type: contentType, size_bytes: file.size }),
  }).catch(() => {
    throw new UploadRefusal("network");
  });
  if (!presign.ok) throw await readError(presign);
  const { attachment, upload } = (await presign.json()) as PresignResponse;

  report("uploading", 0);
  let sent: Response;
  try {
    if (upload.method === "PUT") {
      sent = await fetchImpl(upload.url, { method: "PUT", headers: { "content-type": contentType }, body: file });
    } else {
      const form = new FormData();
      for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
      form.append("file", file);
      sent = await fetchImpl(upload.url, { method: "POST", body: form });
    }
  } catch {
    throw new UploadRefusal("network");
  }
  if (!sent.ok) {
    // The store refuses an expired signature with a 403 and no typed body,
    // so the status is the only signal there is.
    if (sent.status === 403) throw new UploadRefusal("upload_expired", { status: sent.status });
    throw new UploadRefusal("upload_failed", { status: sent.status });
  }
  report("uploading", 100);

  report("scanning", 100);
  const confirm = await fetchImpl(`${base}/tickets/${ticketKey}/attachments/${attachment.id}/confirm`, {
    method: "POST",
    headers: { ...(await authHeaders()), "content-type": "application/json" },
    body: JSON.stringify(options.visibility && !options.portal ? { visibility: options.visibility } : {}),
  }).catch(() => {
    throw new UploadRefusal("network");
  });
  if (!confirm.ok) throw await readError(confirm);
  const confirmed = (await confirm.json()) as Attachment;
  report(
    confirmed.scan_state === "quarantined" ? "quarantined" : confirmed.scan_state === "clean" ? "clean" : "scanning",
    100,
  );
  return confirmed;
}
