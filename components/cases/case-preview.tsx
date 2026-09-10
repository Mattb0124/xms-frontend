"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatDate } from "@/components/admin/primitives";
import { CloseIcon, ICON } from "@/components/xms/icons";
import { PriorityPill } from "@/components/xms/priority-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { channelLabel } from "@/components/tickets/ticket-columns";
import { useGetTicketQuery } from "@/redux/ticketsApi";
import type { GrantedAccount } from "@/redux/ticketsApi";

/** Where the card opens: the mark that was pressed, in viewport coordinates. */
export interface PreviewAnchor {
  top: number;
  left: number;
  bottom: number;
}

const CARD_WIDTH = 720;
const GUTTER = 12;

/**
 * One case read where the reader is standing, after the record popover our
 * consultants already know: a titled card that opens beside the row, two
 * columns of the fields a case is identified by, the sentence across the
 * foot, and one button to open the record properly.
 *
 * Every field is read-only. This is a card for recognizing a case, not for
 * changing one: a change belongs on the record, where it is audited and the
 * clock knows about it. That is why the boxes are drawn as fields but carry
 * no cursor and no edit.
 *
 * It is positioned against the mark that opened it and clamped to the
 * viewport, so a row near the bottom of a long list opens a card that is
 * still wholly on screen.
 */
export function CasePreview({
  ticketKey,
  anchor,
  accounts,
  onClose,
}: {
  ticketKey: string;
  anchor: PreviewAnchor | null;
  /** Named here rather than fetched again: the list already holds them. */
  accounts?: Map<string, GrantedAccount>;
  onClose: () => void;
}) {
  const { data: ticket, isLoading } = useGetTicketQuery(ticketKey);
  const card = useRef<HTMLDivElement>(null);

  // Escape closes it, and so does a click anywhere else: a card that follows
  // the pointer around the list is worse than no card at all.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDown = (event: MouseEvent) => {
      if (!card.current) return;
      if (!card.current.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Deferred a tick, so the very click that opened the card does not close it.
    const id = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const style = anchor ? placeCard(anchor) : { top: 120, left: GUTTER };

  return (
    <div
      ref={card}
      role="dialog"
      aria-label={`Case ${ticketKey}`}
      style={{ ...style, width: CARD_WIDTH }}
      className="xms-layer-drawer bg-xms-card border-xms-line fixed z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-[6px] border"
    >
      <header className="border-xms-line flex items-center gap-3 border-b px-4 py-[10px]">
        <h2 className="text-xms-ink text-[15px] leading-[1.3] font-semibold">Case</h2>
        {/* The one action on the card, so it reads in the action colour. */}
        <Link
          href={`/cases/${ticketKey}`}
          className="border-xms-accent text-xms-accent hover:bg-xms-control-hover ml-auto inline-flex h-[32px] items-center rounded-[4px] border px-3 text-[13px] font-medium hover:no-underline"
        >
          Open record
        </Link>
        <button
          type="button"
          aria-label="Close the preview"
          onClick={onClose}
          className="text-xms-icon hover:text-xms-accent rounded-none"
        >
          <CloseIcon size={ICON.row} />
        </button>
      </header>

      {isLoading || !ticket ? (
        <div className="p-4">
          <Skeleton lines={6} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-[10px]">
            <Field label="Number" value={ticket.key} mono />
            <Field label="Opened" value={formatDate(ticket.created_at)} mono />
            <Field label="Contact" value={ticket.requester?.display_name ?? ""} />
            <Field label="Opened by" value={ticket.created_by_name} />
            <Field label="Company" value={accounts?.get(ticket.account_id)?.name ?? ""} />
            <Field label="Updated" value={formatDate(ticket.updated_at)} mono />
            <Field label="Configuration item" value={ticket.configuration_item_name ?? ""} />
            <Field label="Channel" value={channelLabel(ticket.source)} />
            <Field label="Category" value={ticket.category ?? ""} />
            <Field label="Priority" node={<PriorityPill priority={ticket.priority} />} />
            <Field label="State" node={<StatePill state={ticket.state} label={ticket.state_label} />} />
            <Field label="Assigned to" value={ticket.assignee_name ?? ""} />
          </div>
          <Field label="Short description" value={ticket.short_description} wide />
        </div>
      )}
    </div>
  );
}

/**
 * Beside the mark, and wholly on screen.
 *
 * The card prefers to hang below the mark and to the right of it, which is
 * where the eye already is. Where either edge would run past the viewport it
 * is pushed back inside, and where there is more room above than below it
 * opens upward instead.
 */
export function placeCard(
  anchor: PreviewAnchor,
  viewport: { width: number; height: number } = {
    width: typeof window === "undefined" ? 1500 : window.innerWidth,
    height: typeof window === "undefined" ? 1000 : window.innerHeight,
  },
): { top: number; left: number } {
  const left = Math.max(GUTTER, Math.min(anchor.left, viewport.width - CARD_WIDTH - GUTTER));
  const below = viewport.height - anchor.bottom;
  const height = Math.min(viewport.height * 0.7, 520);
  const top =
    below >= height + GUTTER || below >= anchor.top ? anchor.bottom + 6 : Math.max(GUTTER, anchor.top - height - 6);
  return { top, left };
}

/**
 * One read-only field: the label beside a drawn box, the way the reference
 * shows a record. The box takes the field treatment, so it reads as a value
 * that was filled in rather than as one waiting to be.
 */
function Field({
  label,
  value,
  node,
  mono,
  wide,
}: {
  label: string;
  value?: string;
  node?: React.ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "grid grid-cols-[150px_minmax(0,1fr)] items-start gap-3"
          : "grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3"
      }
    >
      <span className="text-xms-label text-right text-[12px] leading-[1.3]">{label}</span>
      <span
        className={`xms-field border-xms-line text-xms-ink flex min-h-[30px] items-center rounded-[4px] border px-[9px] py-[5px] text-[13px] ${
          mono ? "xms-mono" : ""
        } ${wide ? "whitespace-pre-wrap" : "truncate"}`}
      >
        {node ?? (value === "" ? <span className="text-xms-label">Not set</span> : value)}
      </span>
    </div>
  );
}
