"use client";

import { CloseIcon, SparkleIcon } from "@/components/xms/icons";
import type { ReactNode } from "react";

export interface AxelPanelProps {
  /** "desk" on a list screen, the ticket key on a record (Wireframes v2 section 2). */
  context: string;
  onClose: () => void;
  children?: ReactNode;
}

/**
 * The Axel panel frame (v3 render 15): docked right at 340px, pushing the
 * content rather than overlaying it, with the sparkle header, the context word
 * beside the name, the ask field and the standing footer rule.
 *
 * Only the frame is built. The suggestion cards, tool-call rows and withheld
 * notices the render shows are held until the Axel turn surface lands, so the
 * body says so rather than drawing a shape with nothing behind it.
 */
export function AxelPanel({ context, onClose, children }: AxelPanelProps) {
  return (
    <aside
      aria-label={`Axel, ${context}`}
      data-testid="axel-panel"
      className="bg-xms-card border-xms-line sticky flex shrink-0 flex-col border-l"
      style={{
        width: "var(--xms-axel-panel-w)",
        top: "var(--xms-finder-bar-h)",
        height: "calc(100vh - var(--xms-finder-bar-h))",
      }}
    >
      <header className="border-xms-line flex h-[44px] shrink-0 items-center gap-2 border-b px-4">
        <SparkleIcon size={16} className="text-xms-ai-accent" />
        <span className="text-xms-ink text-[15px] font-semibold">Axel</span>
        <span className="text-xms-muted text-[13px]">{context}</span>
        <button
          type="button"
          aria-label="Close Axel"
          onClick={onClose}
          className="text-xms-muted hover:text-xms-ink ml-auto"
        >
          <CloseIcon size={16} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {children ?? (
          <p className="text-xms-muted text-[13px]">
            Suggestions and tool calls appear here while Axel is working on this screen.
          </p>
        )}
      </div>
      <div className="border-xms-line shrink-0 border-t p-3">
        <label className="sr-only" htmlFor="axel-ask">
          Ask about this screen
        </label>
        <textarea
          id="axel-ask"
          rows={2}
          placeholder="Ask about this ticket..."
          className="border-xms-line bg-xms-card text-xms-ink w-full resize-none rounded-[6px] border px-3 py-2 text-[13px] outline-none"
        />
        <p className="text-xms-muted mt-2 text-[12px]">
          Nothing applies without a click. Every accept, edit and reject lands in Activity.
        </p>
      </div>
    </aside>
  );
}
