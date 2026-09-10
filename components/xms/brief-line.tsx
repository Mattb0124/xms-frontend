"use client";

import { useState } from "react";
import { ICON, SparkleIcon } from "@/components/xms/icons";
import { cn } from "@/lib/utils";

export interface BriefLineProps {
  text: string;
  /** Persisted dismissal is the caller's job; this only hides for the session. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * The dismissible Axel brief line on My work (render 08): a sparkle, one
 * sentence and a worded Dismiss, on the note block's quiet grey rather than
 * the violet family. The hand-off's section 2f says the desk's Axel surfaces
 * run on greys by request, and the render draws this line grey, so the violet
 * stays for AI content that has to be told apart from human content beside it.
 */
export function BriefLine({ text, onDismiss, className }: BriefLineProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className={cn("xms-note flex items-center gap-3 px-[18px] py-4", className)} role="status">
      <SparkleIcon size={ICON.field} className="text-xms-label shrink-0" />
      <span className="flex-1 text-[14px] leading-[1.55]">{text}</span>
      {/* The render (08) words the control rather than drawing a cross. */}
      <button
        type="button"
        aria-label="Dismiss brief"
        onClick={() => {
          setHidden(true);
          onDismiss?.();
        }}
        className="border-xms-note-line bg-xms-card text-xms-body hover:text-xms-ink shrink-0 rounded-[var(--xms-radius-control)] border px-[14px] py-[10px] text-[14px] font-medium"
      >
        Dismiss
      </button>
    </div>
  );
}
