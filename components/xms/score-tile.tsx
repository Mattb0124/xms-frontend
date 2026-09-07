import Link from "next/link";
import { cn } from "@/lib/utils";

export type TileTone = "neutral" | "warn" | "breach" | "good";

const TONE_CLASS: Record<TileTone, string> = {
  neutral: "text-xms-ink",
  warn: "text-[color:var(--state-needs-input-text)]",
  breach: "text-[color:var(--state-overdue-text)]",
  good: "text-[color:var(--state-complete-text)]",
};

export interface ScoreTileProps {
  label: string;
  value: string | number;
  detail?: string;
  tone?: TileTone;
  /** Every tile links into the Queue with a matching condition set. */
  href?: string;
  className?: string;
}

export function ScoreTile({ label, value, detail, tone = "neutral", href, className }: ScoreTileProps) {
  const body = (
    <>
      <p className="xms-caption">{label}</p>
      <p className={cn("xms-mono mt-1 text-[24px] leading-none font-semibold", TONE_CLASS[tone])} data-tone={tone}>
        {value}
      </p>
      {detail ? <p className="text-xms-label mt-2 text-[12px]">{detail}</p> : null}
    </>
  );
  const classes = cn("xms-card block p-4", href && "hover:border-xms-accent-border", className);
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
