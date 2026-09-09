"use client";

import { ICON, CloseIcon, SparkleIcon } from "@/components/xms/icons";
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
      className="xms-layer-drawer bg-xms-card border-xms-line-region sticky flex shrink-0 flex-col border-l"
      style={{
        width: "var(--xms-axel-panel-w)",
        top: "var(--xms-finder-bar-h)",
        height: "calc(100vh - var(--xms-finder-bar-h))",
      }}
    >
      {/* 56px, the finder bar's own height, so the panel's title sits on the
          same line as the toolbar's. It was 44px, which put the name a
          half-line above every other heading on the screen. */}
      <header className="border-xms-line flex h-[var(--xms-finder-bar-h)] shrink-0 items-center gap-[10px] border-b px-4">
        <SparkleIcon size={ICON.row} className="text-xms-label" />
        <span className="text-xms-ink text-[15px] leading-none font-semibold">Axel</span>
        <span className="xms-mono text-xms-muted text-[12px] leading-none">{context}</span>
        <button
          type="button"
          aria-label="Close Axel"
          onClick={onClose}
          className="text-xms-label hover:text-xms-ink ml-auto"
        >
          <CloseIcon size={ICON.tool} />
        </button>
      </header>
      {/* The body stands on the quietest ground in the product, so a white
          suggestion card reads as a card rather than as part of the panel. */}
      <div className="bg-xms-quiet-bg flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {children ?? (
          <p className="text-xms-body text-[14px] leading-[1.55]">
            Suggestions and tool calls appear here while Axel is working on this screen.
          </p>
        )}
      </div>
      <div className="border-xms-line shrink-0 border-t p-4">
        <label className="sr-only" htmlFor="axel-ask">
          Ask about this screen
        </label>
        {/* 64px on the control edge, at the render's own 14px and 12px of
            padding. The radius is the system's 4px control radius rather than
            the prototype's one-off 5px, which appears nowhere else. */}
        <textarea
          id="axel-ask"
          placeholder="Ask about this ticket..."
          className="border-xms-line-strong bg-xms-card text-xms-ink placeholder:text-xms-muted h-16 w-full resize-none rounded-[var(--xms-radius-control)] border p-3 text-[14px] outline-none"
        />
        <p className="text-xms-muted mt-[9px] text-[12px] leading-[1.5]">
          Nothing applies without a click. Every accept, edit and reject lands in Activity.
        </p>
      </div>
    </aside>
  );
}
