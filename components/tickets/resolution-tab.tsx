"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/components/admin/primitives";
import { CloseDisciplineChecklist, type DisciplineItem } from "@/components/xms/close-discipline-checklist";
import { KeyLink } from "@/components/xms/key-link";
import { isNoSolutionCode, resolutionLabel, type ResolutionCode } from "@/lib/tickets/vocab";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { useTicketSolutionsQuery } from "@/redux/knowledgeApi";
import type { TicketView } from "@/redux/ticketsApi";
import { useTicketTimeQuery } from "@/redux/timeApi";

const OUTCOME: Record<string, string> = {
  resolved_by: "Resolved by",
  partially_resolved_by: "Partially resolved by",
  created_from: "Created from this ticket",
};

/**
 * What the close discipline says about this record as it stands (render 05's
 * own "CLOSE DISCIPLINE" block).
 *
 * The resolve dialog builds the same list from the draft being typed and the
 * transition's own `requires`; this builds it from what the ticket carries,
 * so the tab answers "what is still missing" without opening the dialog. It
 * is a reading of the record, never a control: the state pill stays the only
 * route through the state machine (render 05, note 1).
 */
export function recordDisciplineItems(
  ticket: TicketView,
  linkedCount: number,
  loggedMinutes: number,
  codes: ResolutionCode[],
): DisciplineItem[] {
  const waived = isNoSolutionCode(ticket.resolution.code, codes);
  const exemption = ticket.resolution.time_exemption_reason?.trim() ?? "";
  return [
    { key: "resolution_code", label: "Resolution code", done: Boolean(ticket.resolution.code) },
    { key: "notes", label: "Resolution notes", done: (ticket.resolution.notes ?? "").trim() !== "" },
    {
      key: "solution",
      label: "Solution link or new-article candidate",
      done: waived || linkedCount > 0 || Boolean(ticket.resolution.solution_candidate),
      detail: waived ? "waived by the resolution code" : undefined,
    },
    {
      key: "time",
      label: "Time logged or exemption reason",
      done: loggedMinutes > 0 || exemption !== "",
      detail: loggedMinutes > 0 ? `${loggedMinutes} min logged` : undefined,
    },
  ];
}

/** One field of the record: render 05's bold label with its value under it. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-xms-ink text-[14px] leading-[1.4] font-semibold">{label}</span>
      <span className="text-xms-body text-[14px] leading-[1.5] whitespace-pre-wrap">{children}</span>
    </div>
  );
}

/**
 * The Resolution tab: what the record says about how this ticket ended, and
 * the resolution records behind it (the evidence, never removed).
 *
 * Render 05 stacks each field's label over its value down the full width of
 * the work area and puts the close discipline under them; the tab was a
 * label-left grid at 160px, which read as a settings screen, and the
 * checklist lived only inside the resolve dialog, so an unresolved ticket's
 * tab said one sentence and nothing else. The values stay text rather than
 * taking the render's bordered boxes: a box reads as editable, and nothing
 * here is editable.
 */
export function ResolutionTab({ ticket, catalogs }: { ticket: TicketView; catalogs: DeskCatalogs }) {
  const { data } = useTicketSolutionsQuery(ticket.key);
  const { data: time } = useTicketTimeQuery(ticket.key);
  const codes = catalogs.resolutionCodes;
  const linked = data?.linked ?? [];
  const resolved = Boolean(ticket.resolution.code || ticket.resolved_at);
  const items = recordDisciplineItems(ticket, linked.length, time?.total_minutes ?? 0, codes);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {/* "Not set", not the vocabulary's own "none": every unset field on
            this tab says it the same way. */}
        <Field label="Resolution code">
          {ticket.resolution.code ? resolutionLabel(ticket.resolution.code, codes) : "Not set"}
        </Field>
        <Field label="Resolution notes">{ticket.resolution.notes || "Not written yet"}</Field>
        <Field label="Solution">
          {linked.length > 0
            ? `${linked.length} resolution record${linked.length === 1 ? "" : "s"} below`
            : ticket.resolution.solution_candidate
              ? "New-article candidate"
              : isNoSolutionCode(ticket.resolution.code, codes)
                ? "Waived by the resolution code"
                : "None"}
        </Field>
        <Field label="Time exemption">{ticket.resolution.time_exemption_reason || "Not required"}</Field>
        {resolved ? (
          <>
            <Field label="Resolved">
              <span className="xms-mono">{formatDate(ticket.resolved_at)}</span>
            </Field>
            <Field label="Reopened">
              <span className="xms-mono">{`${ticket.reopen_count} times`}</span>
            </Field>
          </>
        ) : null}
      </div>
      {!resolved ? (
        <div className="xms-card p-4">
          <CloseDisciplineChecklist items={items} />
          <p className="text-xms-label mt-2 text-[14px]">
            The close discipline runs on the resolving move, from the state control above.
          </p>
        </div>
      ) : null}
      {linked.length > 0 ? (
        <ul aria-label="Resolution records">
          {linked.map((row) => (
            <li
              key={row.id}
              className="border-xms-line-row flex items-center gap-3 border-b py-[13px] text-[14px] last:border-b-0"
            >
              <span className="text-xms-label w-[200px] shrink-0">{OUTCOME[row.outcome] ?? row.outcome}</span>
              <KeyLink ticketKey={row.display_key} href={`/knowledge/${row.display_key}`} />
              <span className="text-xms-ink min-w-0 flex-1 truncate">{row.title}</span>
              <span className="xms-mono text-xms-muted shrink-0 text-[14px]">
                {row.actor_name}, {formatDate(row.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
