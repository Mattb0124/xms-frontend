import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RailCardProps {
  caption: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Related-info rail card: 11px caption, 16px padding (Wireframes v2 section 4). */
export function RailCard({ caption, children, action, className }: RailCardProps) {
  return (
    <section className={cn("xms-card p-4", className)} aria-label={caption}>
      <header className="mb-2 flex items-center">
        <p className="xms-caption">{caption}</p>
        {action ? <span className="ml-auto text-[12px]">{action}</span> : null}
      </header>
      <div className="text-xms-body text-[13px]">{children}</div>
    </section>
  );
}
