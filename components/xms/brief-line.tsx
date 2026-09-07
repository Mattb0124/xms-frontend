"use client";

import { useState } from "react";
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
    <div className={cn("xms-ai flex items-center gap-3 px-4 py-2 text-[13px]", className)} role="status">
      <span className="xms-caption text-xms-ai-accent">Axel</span>
      <span className="text-xms-ink">{text}</span>
      <button
        type="button"
        aria-label="Dismiss brief"
        onClick={() => {
          setHidden(true);
          onDismiss?.();
        }}
        className="text-xms-muted hover:text-xms-ink ml-auto text-[14px] leading-none"
      >
        ×
      </button>
    </div>
  );
}
