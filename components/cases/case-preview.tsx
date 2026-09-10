"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CloseIcon, ICON } from "@/components/xms/icons";
import { KeyLink } from "@/components/xms/key-link";
import { PriorityPill } from "@/components/xms/priority-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { SlaValue } from "@/components/xms/sla-value";
import { StatePill } from "@/components/xms/state-pill";
import { clockSnapshot, tighterClock } from "@/lib/tickets/sla";
import { useGetTicketQuery } from "@/redux/ticketsApi";

/**
 * One case read beside the list rather than instead of it.
 *
 * A reader scanning thirty rows wants to know what one of them says without
 * losing their place, their filters and their scroll. The drawer answers that
 * and nothing more: what it is, who holds it, what the clock says and the
 * first of the thread. Opening the record is one click from here.
 */
export function CasePreview({ ticketKey, onClose }: { ticketKey: string; onClose: () => void }) {
  const { data: ticket, isLoading } = useGetTicketQuery(ticketKey);

  // Escape closes it, because a drawer that traps a reader is worse than no
  // drawer at all.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label={`Preview of ${ticketKey}`}
      className="xms-layer-drawer bg-xms-card border-xms-line fixed top-[var(--xms-finder-bar-h)] right-0 bottom-0 z-30 flex w-[380px] flex-col border-l"
    >
      <header className="border-xms-line flex items-center gap-3 border-b px-4 py-3">
        <KeyLink ticketKey={ticketKey} />
        <button
          type="button"
          aria-label="Close the preview"
          onClick={onClose}
          className="text-xms-icon hover:text-xms-accent ml-auto rounded-none"
        >
          <CloseIcon size={ICON.row} />
        </button>
      </header>

      {isLoading || !ticket ? (
        <div className="p-4">
          <Skeleton lines={6} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <p className="text-xms-ink text-[15px] leading-[1.35] font-semibold">{ticket.short_description}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StatePill state={ticket.state} label={ticket.state_label} />
            <PriorityPill priority={ticket.priority} />
            <SlaValue snapshot={clockSnapshot(tighterClock(ticket.sla))} dot verbose />
          </div>
          <dl className="flex flex-col">
            <Row label="Requester" value={ticket.requester?.display_name ?? "No contact"} />
            <Row label="Assigned to" value={ticket.assignee_name ?? "Unassigned"} />
            <Row label="Category" value={ticket.category ?? "Not set"} />
            <Row label="Configuration item" value={ticket.configuration_item_name ?? "Not set"} />
          </dl>
          {ticket.description ? (
            <div>
              <p className="xms-eyebrow">What was said</p>
              <p className="text-xms-body mt-2 text-[13px] leading-[1.45] whitespace-pre-wrap">{ticket.description}</p>
            </div>
          ) : null}
        </div>
      )}

      <footer className="border-xms-line border-t px-4 py-3">
        <Link href={`/cases/${ticketKey}`} className="xms-link">
          Open the case
        </Link>
      </footer>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-xms-line-row flex flex-col border-b py-[9px] last:border-b-0">
      <dt className="text-xms-label text-[12px] leading-[1.3]">{label}</dt>
      <dd className="text-xms-ink mt-1 text-[13px] leading-[1.3] font-medium">{value}</dd>
    </div>
  );
}
