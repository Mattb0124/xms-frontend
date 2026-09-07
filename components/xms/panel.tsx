import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps {
  title: string;
  caption?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Flush body for tables inside the panel (no card in card). */
  flush?: boolean;
  className?: string;
}

/** A white card with a 15px title row; the body is padded unless flush. */
export function Panel({ title, caption, actions, children, flush, className }: PanelProps) {
  return (
    <section className={cn("xms-card flex flex-col", className)} aria-label={title}>
      <header className="border-xms-line flex items-center gap-3 border-b px-4 py-3">
        <div>
          {caption ? <p className="xms-caption">{caption}</p> : null}
          <h2 className="text-xms-ink text-[15px] font-semibold">{title}</h2>
        </div>
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn(flush ? "overflow-x-auto" : "p-4")}>{children}</div>
    </section>
  );
}
