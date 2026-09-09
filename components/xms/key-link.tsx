import Link from "next/link";
import { cn } from "@/lib/utils";

export interface KeyLinkProps {
  /** Display key, e.g. CS0001204 or KB000123. */
  ticketKey: string;
  href?: string;
  className?: string;
}

/**
 * A display key that links to its record. One treatment everywhere (`.xms-key`:
 * IBM Plex Mono, tabular figures, accent) so a ticket reads the same in the
 * Queue, the timesheet, a rail and the record bar.
 *
 * `.xms-link` alone cannot carry a key: its `font` shorthand sets the family,
 * which put every key in the Queue in the sans face while the record bar drew
 * the same key in mono. `.xms-key` is declared after it and wins the family,
 * size and weight; the underline and hover still come from `.xms-link`.
 *
 * For a key with no record to open, use `KeyText`. For a link that is prose
 * rather than a key (a person, an account name, a role), use `TextLink`.
 */
export function KeyLink({ ticketKey, href, className }: KeyLinkProps) {
  const target = href ?? `/cases/${ticketKey}`;
  return (
    <Link href={target} className={cn("xms-link xms-key", className)} data-key={ticketKey}>
      {ticketKey}
    </Link>
  );
}

export interface KeyTextProps {
  /** Display key, e.g. CS0001204 or KB000123. */
  ticketKey: string;
  className?: string;
}

/** The same key treatment where there is nothing to open: the record's own bar,
 * a key named inside a sentence, a key beside the name it belongs to. */
export function KeyText({ ticketKey, className }: KeyTextProps) {
  return (
    <span className={cn("xms-key", className)} data-key={ticketKey}>
      {ticketKey}
    </span>
  );
}

export interface TextLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

/** A link that is prose, not a key: a person, a role, an account name, a group.
 * Stays in the sans face, which is what `.xms-link` is for. */
export function TextLink({ href, className, children }: TextLinkProps) {
  return (
    <Link href={href} className={cn("xms-link", className)}>
      {children}
    </Link>
  );
}
