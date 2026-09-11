import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps {
  title: string;
  /**
   * The ALL-CAPS eyebrow above the title (Design System section 4). A short
   * noun phrase, never a sentence: an eyebrow is uppercase mono, and a
   * hundred characters of it shouts (frontend review finding 14). Anything
   * that explains the panel belongs in `subtitle`.
   */
  caption?: string;
  /**
   * The prototype's own `p.note`: two or three words beside the title on one
   * baseline, in the muted grey ("Backlog by age  days open", "Open by state
   * click to filter the queue"). It is not a sentence and it never wraps; a
   * sentence belongs in `subtitle`, which stands on its own line.
   */
  note?: string;
  /** The one-line explanation under the title, in sentence case. */
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Flush body for tables inside the panel (no card in card). */
  flush?: boolean;
  /**
   * The dashboard card (render 10, the prototype's own `panels` markup): 18px
   * of padding all round, no rule under the header, and 16px between the
   * header and the body. A panel standing in a grid of its peers needs no
   * rule, because the card edge already says where it starts; the ruled
   * header is for a panel whose body is a list or a table the reader scrolls.
   */
  bare?: boolean;
  className?: string;
}

/** A white card with a 15px title row; the body is padded unless flush. */
export function Panel({ title, caption, note, subtitle, actions, children, flush, bare, className }: PanelProps) {
  return (
    <section className={cn("xms-card flex flex-col", bare && "p-[18px]", className)} aria-label={title}>
      <header
        className={cn(
          "flex gap-[10px]",
          // The note sits on the title's own baseline; with no note the row
          // centres, so a control in `actions` still lines up with the title.
          note ? "items-baseline" : "items-center",
          bare ? "mb-4" : "border-xms-line border-b px-4 py-3",
        )}
      >
        <div className="min-w-0">
          {caption ? <p className="xms-caption">{caption}</p> : null}
          <h2 className="text-xms-ink text-[15px] leading-[1.3] font-semibold">{title}</h2>
          {subtitle ? <p className="text-xms-label mt-[5px] text-[14px]">{subtitle}</p> : null}
        </div>
        {note ? <span className="text-xms-muted shrink-0 text-[14px] leading-[1.3]">{note}</span> : null}
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn(bare ? undefined : flush ? "overflow-x-auto" : "p-4")}>{children}</div>
    </section>
  );
}
