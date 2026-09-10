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
  /** The field's label; "Reason" unless the sheet records something else (an explanation, say). */
  fieldLabel?: string;
  /** The longest text the route accepts. */
  maxLength?: number;
  onConfirm: (reason: string) => void | Promise<void>;
  onClose: () => void;
}

/** A small reason sheet: the kill switch, replay, discard and the reconciliation explain all record why. */
export function ReasonDialog({
  title,
  detail,
  confirmLabel,
  required,
  danger,
  busy,
  fieldLabel = "Reason",
  maxLength = 500,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const valid = required ? trimmed.length >= 3 : true;
  return (
    <div className="bg-xms-navy-overlay/55 fixed inset-0 z-40 flex items-center justify-center p-4">
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
        {detail ? <p className="text-xms-body text-[14px]">{detail}</p> : null}
        <label className="flex flex-col gap-1 text-[14px]">
          <span className="text-xms-label">
            {fieldLabel}
            {required ? "" : " (optional)"}
          </span>
          <textarea
            aria-label={fieldLabel}
            className={cn(INPUT, "h-[80px] py-2")}
            maxLength={maxLength}
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
