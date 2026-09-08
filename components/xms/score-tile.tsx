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
      {/* The render (08, 10) puts the caption on the same baseline as the
          number, not on a line under it: "218  +12 this week". */}
      <p className="mt-[10px] flex items-baseline gap-2">
        <span className={cn("xms-mono text-[26px] leading-none font-semibold", TONE_CLASS[tone])} data-tone={tone}>
          {value}
        </span>
        {detail ? <span className="text-xms-label text-[13px]">{detail}</span> : null}
      </p>
    </>
  );
  const classes = cn("xms-card block px-5 py-4", href && "hover:border-xms-accent-border", className);
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
