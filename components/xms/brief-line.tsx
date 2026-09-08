"use client";

import { useState } from "react";
import { SparkleIcon } from "@/components/xms/icons";
import { cn } from "@/lib/utils";

export interface BriefLineProps {
  text: string;
  /** Persisted dismissal is the caller's job; this only hides for the session. */
  onDismiss?: () => void;
  className?: string;
}

/** The dismissible Axel brief line on My work: AI-origin, so it sits on the violet family. */
export function BriefLine({ text, onDismiss, className }: BriefLineProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className={cn("xms-ai flex items-center gap-3 px-5 py-3 text-[14px]", className)} role="status">
      <SparkleIcon size={17} className="text-xms-ai-accent shrink-0" />
      <span className="text-xms-ink">{text}</span>
      {/* The render (08) words the control rather than drawing a cross. */}
      <button
        type="button"
        aria-label="Dismiss brief"
        onClick={() => {
          setHidden(true);
          onDismiss?.();
        }}
        className="border-xms-line bg-xms-card text-xms-body hover:text-xms-ink ml-auto h-[32px] shrink-0 rounded-[6px] border px-3 text-[13px]"
      >
        Dismiss
      </button>
    </div>
  );
}
