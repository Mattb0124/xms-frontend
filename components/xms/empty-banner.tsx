import Link from "next/link";
import { cn } from "@/lib/utils";

export interface EmptyBannerProps {
  title: string;
  detail?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

/** Ink banner for empty and setup states ("Set up a contract to start taking tickets"). */
export function EmptyBanner({ title, detail, action, className }: EmptyBannerProps) {
  return (
    <div
      role="status"
      className={cn("bg-xms-navy flex items-center gap-4 rounded-[6px] px-5 py-4 text-white", className)}
    >
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        {detail ? <p className="text-[12px] opacity-80">{detail}</p> : null}
      </div>
      {action ? (
        action.href ? (
          <Link href={action.href} className="ml-auto text-[13px] font-medium text-white underline">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="ml-auto text-[13px] font-medium underline">
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
