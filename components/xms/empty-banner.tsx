import Link from "next/link";
import { cn } from "@/lib/utils";

export interface EmptyBannerProps {
  title: string;
  detail?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

/**
 * The card a screen shows in place of its content: nothing here yet, nothing
 * granted, nothing loaded.
 *
 * It was an ink slab, white on navy, and it was the only black block in a
 * white product: no v3 render draws one anywhere, and on a screen with
 * several of them the page read as a row of alerts rather than as a quiet
 * state. Render 11 draws the shape the prototype uses for exactly this, its
 * own "Not restyled yet" card, and this is that card: white on the card
 * hairline, 28px of padding, a 620px reading cap on the card itself (never on
 * the page, section 1d), the state at 15px on a 1.6 line and the explanation
 * at 13px in the muted grey under it.
 *
 * The action stands under the words rather than at the far right of a wide
 * band, so it is beside what it acts on.
 */
export function EmptyBanner({ title, detail, action, className }: EmptyBannerProps) {
  return (
    <div role="status" className={cn("xms-card max-w-[620px] p-[28px]", className)}>
      <p className="text-xms-ink text-[15px] leading-[1.6] font-semibold">{title}</p>
      {detail ? <p className="text-xms-muted mt-[10px] text-[14px] leading-[1.5]">{detail}</p> : null}
      {action ? (
        <p className="mt-[14px]">
          {action.href ? (
            <Link href={action.href} className="text-xms-accent text-[14px] font-medium">
              {action.label}
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className="text-xms-accent text-[14px] font-medium">
              {action.label}
            </button>
          )}
        </p>
      ) : null}
    </div>
  );
}
