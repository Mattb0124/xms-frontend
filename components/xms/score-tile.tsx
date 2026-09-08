import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ScoreTileProps {
  label: string;
  value: string | number;
  detail?: string;
  /**
   * Operations puts the caption beside the number on the same baseline
   * ("218  +12 this week", render 10); My work puts it on the line under it
   * ("11" over "across 3 accounts", render 08).
   */
  detailBeside?: boolean;
  /** Every tile links into the Queue with a matching condition set. */
  href?: string;
  /**
   * Narrow the list under the tile instead of navigating (render 08's own
   * note 1: "scorecards filter the list below on click rather than navigating
   * away"). A tile with an `onClick` is a toggle, not a link.
   */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

/**
 * A scorecard tile (renders 08 and 10): an eyebrow, a mono number and a grey
 * sub-line, on the card's own 16px padding.
 *
 * The number is always ink. It carried a tone, so a Breached count of zero
 * was drawn in the "good" green and an At risk count of zero in amber, which
 * read as a signal where there was none: green is a state, amber is a clock,
 * and neither is a count. Both renders draw every number in ink, and the
 * signal lives in the row the tile filters to.
 */
export function ScoreTile({ label, value, detail, detailBeside, href, onClick, selected, className }: ScoreTileProps) {
  const body = (
    <>
      <p className="xms-caption">{label}</p>
      <p className={cn(detailBeside ? "mt-[10px] flex items-baseline gap-[10px]" : "mt-[9px]")}>
        <span
          className={cn(
            "xms-mono text-xms-ink block text-[26px] font-medium",
            detailBeside ? "leading-[1.1]" : "leading-[1.15]",
          )}
        >
          {value}
        </span>
        {detail && detailBeside ? <span className="text-xms-muted text-[13px] leading-none">{detail}</span> : null}
      </p>
      {detail && !detailBeside ? <p className="text-xms-muted mt-[4px] text-[12px] leading-[1.4]">{detail}</p> : null}
    </>
  );
  const classes = cn(
    // The prototype pads a My work tile 16px and a dashboard tile 18px, and
    // the dashboard tile is exactly the one carrying its detail beside the
    // number, so the two go together rather than needing a second prop.
    "xms-card block text-left",
    detailBeside ? "p-[18px]" : "p-4",
    (href || onClick) && "hover:border-xms-accent-border",
    selected && "border-xms-accent bg-xms-nav-wash",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={Boolean(selected)} className={classes}>
        {body}
      </button>
    );
  }
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
