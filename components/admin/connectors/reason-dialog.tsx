"use client";

import { useState } from "react";
import { DANGER_BUTTON, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

export interface ReasonDialogProps {
  title: string;
  detail?: string;
  confirmLabel: string;
  /** Required reasons need at least three characters (the API's minimum). */
  required?: boolean;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
  onClose: () => void;
}

/** A small reason sheet: the kill switch, replay and discard all record why. */
export function ReasonDialog({
  title,
  detail,
  confirmLabel,
  required,
  danger,
  busy,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const valid = required ? trimmed.length >= 3 : true;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-xms-navy-overlay p-4">
      <form
        role="dialog"
        aria-label={title}
        aria-modal="true"
        className="xms-card flex w-full max-w-[440px] flex-col gap-3 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid) return;
          await onConfirm(trimmed);
        }}
      >
        <h2 className="text-xms-ink text-[15px] font-semibold">{title}</h2>
        {detail ? <p className="text-xms-body text-[13px]">{detail}</p> : null}
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Reason{required ? "" : " (optional)"}</span>
          <textarea
            aria-label="Reason"
            className={cn(INPUT, "h-[80px] py-2")}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={danger ? DANGER_BUTTON : PRIMARY_BUTTON} disabled={!valid || busy}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
