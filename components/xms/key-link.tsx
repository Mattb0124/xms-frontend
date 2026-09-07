import Link from "next/link";
import { cn } from "@/lib/utils";

export interface KeyLinkProps {
  /** Display key, e.g. CS0001204 or KB000123. */
  ticketKey: string;
  href?: string;
  className?: string;
}

/** Mono blue key link (Wireframes v2 section 4: keys in IBM Plex Mono). */
export function KeyLink({ ticketKey, href, className }: KeyLinkProps) {
  const target = href ?? `/tickets/${ticketKey}`;
  return (
    <Link
      href={target}
      className={cn("xms-mono text-xms-accent text-[13px] font-medium", className)}
      data-key={ticketKey}
    >
      {ticketKey}
    </Link>
  );
}
