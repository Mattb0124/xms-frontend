"use client";

import { useRef, useState } from "react";
import { PORTAL_SECONDARY } from "@/components/portal/primitives";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { PORTAL_QUARANTINE_PLACEHOLDER, scanChip } from "@/lib/attachments/scan";
import {
  UploadRefusal,
  describeRefusal,
  formatBytes,
  uploadAttachment,
  type UploadStage,
} from "@/lib/attachments/upload";
import { formatDateTime } from "@/lib/portal/client-language";
import { cn } from "@/lib/utils";
import { useLazyDownloadAttachmentQuery, useListAttachmentsQuery, type Attachment } from "@/redux/attachmentsApi";

/**
 * Portal attachments in client language (Client Portal functional 5.5): the
 * clean public files with a download, an upload control, and the scan states
 * as "Checking file", "Ready" and "Blocked by security scan". Renders the
 * portal view model only.
 */
export function PortalScanChip({ state }: { state: UploadStage | Attachment["scan_state"] }) {
  const chip = scanChip(state, true);
  return (
    <span
      data-scan={state}
      className={cn(
        "inline-flex h-[22px] items-center rounded-[999px] border px-2 text-[12px]",
        chip.danger
          ? "border-[color:var(--state-overdue-border)] bg-[color:var(--state-overdue-bg)] text-[color:var(--state-overdue-text)]"
          : chip.ramp === "resolved"
            ? "border-[color:var(--state-complete-border)] bg-[color:var(--state-complete-bg)] text-[color:var(--state-complete-text)]"
            : "border-xms-line bg-xms-tint text-xms-label",
      )}
    >
      {chip.label}
    </span>
  );
}

export interface PortalUploadItem {
  id: string;
  name: string;
  size: number;
  stage: UploadStage;
  error?: string;
}

/** Runs the uploads for a request; queued files wait until the request exists. */
export function usePortalUploads(requestKey: string | undefined) {
  const [items, setItems] = useState<PortalUploadItem[]>([]);
  const counter = useRef(0);
  const update = (id: string, patch: Partial<PortalUploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const add = async (files: FileList | File[], key = requestKey) => {
    if (!key) return;
    for (const file of Array.from(files)) {
      const id = `p${(counter.current += 1)}`;
      setItems((current) => [...current, { id, name: file.name, size: file.size, stage: "presigning" }]);
      try {
        const attachment = await uploadAttachment(key, file, {
          portal: true,
          onProgress: (progress) => update(id, { stage: progress.stage }),
        });
        update(id, {
          stage:
            attachment.scan_state === "clean"
              ? "clean"
              : attachment.scan_state === "quarantined"
                ? "quarantined"
                : "scanning",
        });
      } catch (error) {
        update(id, {
          stage: "failed",
          error: describeRefusal(error instanceof UploadRefusal ? error : new UploadRefusal("error")),
        });
      }
    }
  };
  const busy = items.some((item) => ["presigning", "uploading", "scanning"].includes(item.stage));
  return { items, add, busy };
}

export function PortalUploadControl({
  onFiles,
  disabled,
  items,
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  items: PortalUploadItem[];
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button type="button" className={PORTAL_SECONDARY} disabled={disabled} onClick={() => input.current?.click()}>
          Add a file
        </button>
        <span className="text-xms-label text-[13px]">Screenshots, logs and documents up to 25 MB.</span>
        <input
          ref={input}
          type="file"
          multiple
          aria-label="Add a file"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Files being added">
          {items.map((item) => (
            <li key={item.id} data-stage={item.stage} className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-xms-ink">{item.name}</span>
              <span className="xms-mono text-xms-label text-[12px]">{formatBytes(item.size)}</span>
              <PortalScanChip state={item.stage} />
              {item.stage === "quarantined" ? (
                <span className="text-xms-label">{PORTAL_QUARANTINE_PLACEHOLDER}</span>
              ) : null}
              {item.error ? (
                <span role="alert" className="text-[color:var(--state-overdue-text)]">
                  {item.error}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Public, clean files on the request with a download each. */
export function PortalAttachmentList({ requestKey }: { requestKey: string }) {
  const { data } = useListAttachmentsQuery({ key: requestKey, portal: true });
  const [download] = useLazyDownloadAttachmentQuery();
  const { push } = useToast();
  const rows = data ?? [];
  if (rows.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Files">
      {rows.map((attachment) => (
        <li key={attachment.id} className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-xms-ink">{attachment.file_name}</span>
          <span className="xms-mono text-xms-label text-[12px]">{formatBytes(Number(attachment.size_bytes))}</span>
          <PortalScanChip state={attachment.scan_state} />
          <time dateTime={attachment.created_at} className="text-xms-label text-[12px]">
            {formatDateTime(attachment.created_at)}
          </time>
          <button
            type="button"
            className="text-xms-accent ml-auto text-[14px] hover:underline"
            onClick={() =>
              download({ id: attachment.id, portal: true })
                .unwrap()
                .then((result) => window.open(result.url, "_blank", "noopener"))
                .catch((error) =>
                  push({ title: "Not available", detail: describeError(apiError(error)), tone: "error" }),
                )
            }
          >
            Download
          </button>
        </li>
      ))}
    </ul>
  );
}
