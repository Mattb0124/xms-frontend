"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { RailCard } from "@/components/xms/rail-card";
import { StatePill } from "@/components/xms/state-pill";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { QUARANTINE_PLACEHOLDER, originLabel, scanChip } from "@/lib/attachments/scan";
import {
  UploadRefusal,
  describeRefusal,
  formatBytes,
  uploadAttachment,
  type UploadStage,
} from "@/lib/attachments/upload";
import { openExternal } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import {
  useDeleteAttachmentMutation,
  useLazyDownloadAttachmentQuery,
  useListAttachmentsQuery,
  type Attachment,
  type AttachmentVisibility,
  type ScanState,
} from "@/redux/attachmentsApi";

/** The scan chip: slate while scanning, green when clean, the overdue trio when quarantined. */
export function ScanChip({ state, portal }: { state: ScanState | UploadStage; portal?: boolean }) {
  const chip = scanChip(state, portal);
  if (chip.danger) {
    return (
      <span
        data-scan={state}
        className="inline-flex h-[20px] items-center rounded-[999px] border border-[color:var(--state-overdue-border)] bg-[color:var(--state-overdue-bg)] px-2 text-[11px] text-[color:var(--state-overdue-text)]"
      >
        {chip.label}
      </span>
    );
  }
  return <StatePill state={chip.ramp} label={chip.label} className="text-[11px]" />;
}

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  stage: UploadStage;
  percent: number;
  error?: string;
  attachment?: Attachment;
}

export interface UseUploadsOptions {
  portal?: boolean;
  visibility?: () => AttachmentVisibility;
  onDone?: (attachment: Attachment) => void;
}

/**
 * Tracks uploads for one ticket: every file goes through presign, upload
 * and confirm; the list keeps the stage and the verdict so the composer can
 * block Send while a scan is pending.
 */
export function useUploads(ticketKey: string | undefined, options: UseUploadsOptions = {}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const counter = useRef(0);
  const update = (id: string, patch: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const add = useCallback(
    async (files: FileList | File[]) => {
      if (!ticketKey) return;
      for (const file of Array.from(files)) {
        const id = `u${(counter.current += 1)}`;
        setItems((current) => [...current, { id, name: file.name, size: file.size, stage: "presigning", percent: 0 }]);
        try {
          const attachment = await uploadAttachment(ticketKey, file, {
            portal: options.portal,
            visibility: options.visibility?.(),
            onProgress: (progress) => update(id, { stage: progress.stage, percent: progress.percent }),
          });
          update(id, {
            attachment,
            stage:
              attachment.scan_state === "clean"
                ? "clean"
                : attachment.scan_state === "quarantined"
                  ? "quarantined"
                  : "scanning",
          });
          options.onDone?.(attachment);
        } catch (error) {
          const refusal = error instanceof UploadRefusal ? error : new UploadRefusal("error");
          update(id, { stage: "failed", error: describeRefusal(refusal) });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticketKey, options.portal],
  );

  const remove = (id: string) => setItems((current) => current.filter((item) => item.id !== id));
  const clear = () => setItems([]);
  const scanning = items.some((item) => ["presigning", "uploading", "scanning"].includes(item.stage));
  return { items, add, remove, clear, scanning };
}

/** Drop zone plus file picker; the parent owns the uploads. */
export function DropZone({
  onFiles,
  disabled,
  label = "Drop files here or choose",
  portal,
}: {
  onFiles: (files: FileList | File[]) => void;
  disabled?: boolean;
  label?: string;
  portal?: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      data-over={over}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled && event.dataTransfer.files.length > 0) onFiles(event.dataTransfer.files);
      }}
      className={cn(
        "border-xms-line text-xms-label flex items-center gap-2 rounded-[6px] border border-dashed px-3 py-2 text-[12px]",
        over && "border-xms-accent bg-xms-accent-tint",
        disabled && "opacity-50",
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={cn("xms-link ml-auto", portal && "text-[14px]")}
      >
        {portal ? "Add a file" : "Choose file"}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        aria-label="Attach files"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

/** The in-progress and just-finished uploads with their stage chips. */
export function UploadList({
  items,
  onRemove,
  portal,
}: {
  items: UploadItem[];
  onRemove?: (id: string) => void;
  portal?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1" aria-label="Uploads">
      {items.map((item) => (
        <li key={item.id} data-stage={item.stage} className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-xms-ink truncate">{item.name}</span>
          <span className="xms-mono text-xms-label">{formatBytes(item.size)}</span>
          <ScanChip state={item.stage} portal={portal} />
          {item.stage === "uploading" ? (
            <span
              className="bg-xms-line relative h-[4px] w-[80px] overflow-hidden rounded-[2px]"
              role="progressbar"
              aria-valuenow={item.percent}
            >
              <span className="bg-xms-accent absolute inset-y-0 left-0" style={{ width: `${item.percent}%` }} />
            </span>
          ) : null}
          {item.stage === "quarantined" ? (
            <span className="text-xms-label">{portal ? "" : QUARANTINE_PLACEHOLDER}</span>
          ) : null}
          {item.error ? (
            <span role="alert" className="text-[color:var(--state-overdue-text)]">
              {item.error}
            </span>
          ) : null}
          {onRemove && (item.stage === "failed" || item.stage === "clean" || item.stage === "quarantined") ? (
            <button type="button" onClick={() => onRemove(item.id)} className="text-xms-label ml-auto hover:underline">
              Dismiss
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Scanning acknowledgement: the composer may send with a pending scan only when this is ticked. */
export function ScanAcknowledgement({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="text-xms-label flex items-center gap-2 text-[12px]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />A file is still
      being scanned; send anyway and let the placeholder stand until the verdict.
    </label>
  );
}

function VisibilityChip({ visibility }: { visibility: AttachmentVisibility }) {
  return (
    <span
      className={cn(
        "rounded-[999px] px-2 py-[1px] text-[11px]",
        visibility === "internal" ? "bg-xms-navy text-white" : "bg-xms-accent-tint text-xms-accent",
      )}
    >
      {visibility === "internal" ? "Internal" : "Client visible"}
    </span>
  );
}

/** One attachment row on the desk: chips, download when clean, delete for internal users. */
export function AttachmentRow({
  attachment,
  onDownload,
  onDelete,
  portal,
}: {
  attachment: Attachment;
  onDownload?: (attachment: Attachment) => void;
  onDelete?: (attachment: Attachment) => void;
  portal?: boolean;
}) {
  const quarantined = attachment.scan_state === "quarantined";
  return (
    <li data-attachment={attachment.id} data-scan={attachment.scan_state} className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-xms-ink truncate font-medium">{attachment.file_name}</span>
        <span className="xms-mono text-xms-label">{formatBytes(Number(attachment.size_bytes))}</span>
        <ScanChip state={attachment.scan_state} portal={portal} />
        {!portal ? (
          <>
            <span className="bg-xms-tint text-xms-label rounded-[999px] px-2 py-[1px] text-[11px]">
              {originLabel(attachment.origin)}
            </span>
            <VisibilityChip visibility={attachment.visibility} />
          </>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {onDownload ? (
            <button
              type="button"
              disabled={attachment.scan_state !== "clean"}
              onClick={() => onDownload(attachment)}
              className="xms-link disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" onClick={() => onDelete(attachment)} className="text-xms-label hover:underline">
              Delete
            </button>
          ) : null}
        </span>
      </div>
      {quarantined ? <p className="text-xms-label text-[12px]">{QUARANTINE_PLACEHOLDER}</p> : null}
      {!portal ? (
        <p className="text-xms-label text-[11px]">by {attachment.uploaded_by_name || attachment.uploaded_by}</p>
      ) : null}
    </li>
  );
}

/** Opens the presigned URL the API mints after its RLS-protected read. */
export function useOpenDownload(portal?: boolean) {
  const [download] = useLazyDownloadAttachmentQuery();
  const { push } = useToast();
  return useCallback(
    async (attachment: Attachment) => {
      try {
        const result = await download({ id: attachment.id, portal }).unwrap();
        openExternal(result.url);
      } catch (error) {
        const parsed = apiError(error);
        push({
          title: "Not available",
          detail:
            parsed.code === "scan_pending"
              ? "The file is still being scanned."
              : parsed.code === "quarantined"
                ? QUARANTINE_PLACEHOLDER
                : describeError(parsed),
          tone: "error",
        });
      }
    },
    [download, portal, push],
  );
}

/** The rail card listing every attachment on the ticket. */
export function AttachmentsCard({
  ticketKey,
  readOnly,
  extra,
}: {
  ticketKey: string;
  readOnly?: boolean;
  extra?: ReactNode;
}) {
  const { data, isLoading } = useListAttachmentsQuery({ key: ticketKey });
  const [remove] = useDeleteAttachmentMutation();
  const open = useOpenDownload();
  const { push } = useToast();
  const rows = data ?? [];
  return (
    <RailCard caption={`Attachments${rows.length > 0 ? ` (${rows.length})` : ""}`}>
      {isLoading ? <p className="text-xms-muted">Loading files.</p> : null}
      {!isLoading && rows.length === 0 ? <p className="text-xms-muted">No files on this ticket.</p> : null}
      <ul className="divide-xms-line divide-y">
        {rows.map((attachment) => (
          <AttachmentRow
            key={attachment.id}
            attachment={attachment}
            onDownload={open}
            onDelete={
              readOnly
                ? undefined
                : (target) =>
                    remove({ id: target.id, key: ticketKey })
                      .unwrap()
                      .catch((error) =>
                        push({ title: "Not deleted", detail: describeError(apiError(error)), tone: "error" }),
                      )
            }
          />
        ))}
      </ul>
      {extra}
    </RailCard>
  );
}
