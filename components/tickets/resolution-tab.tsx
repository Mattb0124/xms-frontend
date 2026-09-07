"use client";

import { formatDate } from "@/components/admin/primitives";
import { KeyLink } from "@/components/xms/key-link";
import { isNoSolutionCode, resolutionLabel } from "@/lib/tickets/vocab";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { useTicketSolutionsQuery } from "@/redux/knowledgeApi";
import type { TicketView } from "@/redux/ticketsApi";

const OUTCOME: Record<string, string> = {
  resolved_by: "Resolved by",
  partially_resolved_by: "Partially resolved by",
  created_from: "Created from this ticket",
};

/** The Resolution tab: the resolution summary and the resolution records (the evidence, never removed). */
export function ResolutionTab({ ticket, catalogs }: { ticket: TicketView; catalogs: DeskCatalogs }) {
  const { data } = useTicketSolutionsQuery(ticket.key);
  const codes = catalogs.resolutionCodes;
  const linked = data?.linked ?? [];
  if (!ticket.resolution.code && !ticket.resolved_at && linked.length === 0) {
    return (
      <p className="text-xms-label text-[13px]">Not resolved yet. The close discipline runs on the resolving move.</p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-[13px]">
        <dt className="text-xms-label">Resolution code</dt>
        <dd className="text-xms-ink">{resolutionLabel(ticket.resolution.code, codes)}</dd>
        <dt className="text-xms-label">Notes</dt>
        <dd className="text-xms-ink whitespace-pre-wrap">{ticket.resolution.notes ?? ""}</dd>
        <dt className="text-xms-label">Solution</dt>
        <dd className="text-xms-ink">
          {linked.length > 0
            ? `${linked.length} resolution record${linked.length === 1 ? "" : "s"} below`
            : ticket.resolution.solution_candidate
              ? "New-article candidate"
              : isNoSolutionCode(ticket.resolution.code, codes)
                ? "Waived by the resolution code"
                : "none"}
        </dd>
        <dt className="text-xms-label">Time exemption</dt>
        <dd className="text-xms-ink">{ticket.resolution.time_exemption_reason ?? "none"}</dd>
        <dt className="text-xms-label">Resolved</dt>
        <dd className="xms-mono text-xms-ink">{formatDate(ticket.resolved_at)}</dd>
        <dt className="text-xms-label">Reopened</dt>
        <dd className="xms-mono text-xms-ink">{ticket.reopen_count} times</dd>
      </dl>
      {linked.length > 0 ? (
        <ul className="divide-xms-line divide-y" aria-label="Resolution records">
          {linked.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2 text-[13px]">
              <span className="text-xms-label w-[200px]">{OUTCOME[row.outcome] ?? row.outcome}</span>
              <KeyLink ticketKey={row.display_key} href={`/knowledge/${row.display_key}`} />
              <span className="text-xms-ink truncate">{row.title}</span>
              <span className="xms-mono text-xms-label ml-auto text-[12px]">
                {row.actor_name}, {formatDate(row.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
