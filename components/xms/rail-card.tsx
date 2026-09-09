import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RailCardProps {
  caption: string;
  children: ReactNode;
  action?: ReactNode;
  /**
   * The prototype stands its Similar solutions card on the note ground with a
   * leading glyph, and every other rail card on white. "note" is that card.
   */
  tone?: "card" | "note";
  /** A 15px glyph before the caption, which only the note card carries. */
  glyph?: ReactNode;
  className?: string;
}

/**
 * A rail card, measured off `proto-v3/template.pretty.html`: 16px of padding
 * on a 6px radius with a hairline edge and no shadow, and 13px between the
 * caption and the first line. The built card left 8px there.
 */
export function RailCard({ caption, children, action, tone = "card", glyph, className }: RailCardProps) {
  const note = tone === "note";
  return (
    <section
      className={cn("p-4", note ? "bg-xms-note-bg border-xms-note-line rounded-[6px] border" : "xms-card", className)}
      aria-label={caption}
    >
      <header className="mb-[13px] flex items-center gap-2">
        {glyph}
        <p className={cn("xms-caption", note && "text-xms-body")}>{caption}</p>
        {action ? <span className="ml-auto text-[12px]">{action}</span> : null}
      </header>
      <div className="text-xms-body text-[13px]">{children}</div>
    </section>
  );
}
