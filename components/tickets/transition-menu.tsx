"use client";

import { useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { ResolveForm, toResolutionBody } from "@/components/tickets/resolve-form";
import { StatePill } from "@/components/xms/state-pill";
import { useTransition } from "@/lib/tickets/use-transition";
import { PAUSE_REASONS, type PauseReason } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import { useGetTransitionsQuery, type AllowedTransition, type TicketView } from "@/redux/ticketsApi";

type Sheet =
  | { kind: "none" }
  | { kind: "pause"; target: AllowedTransition }
  | { kind: "resolve"; target: AllowedTransition }
  | { kind: "confirm"; target: AllowedTransition };

const TERMINAL_CONFIRM = new Set(["closed", "cancelled", "rejected"]);

/**
 * The state pill is the only route through the state machine (User
 * Experience section 6): its menu lists the allowed next states from the
 * API and collects the required inputs in an inline sheet, never a modal
 * wizard. Pausing states ask for the reason; resolving states show the
 * close discipline; closing, cancelling and reopening confirm.
 */
export function TransitionMenu({ ticket, className }: { ticket: TicketView; className?: string }) {
  const { data } = useGetTransitionsQuery(ticket.key);
  const { transition, pending } = useTransition(ticket.key);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [pauseReason, setPauseReason] = useState<PauseReason>("awaiting_client");
  const [pauseNote, setPauseNote] = useState("");
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const terminal = TERMINAL_CONFIRM.has(ticket.state);

  const choose = (target: AllowedTransition) => {
    setOpen(false);
    setServerMissing([]);
    if (target.requires.includes("pause_reason")) setSheet({ kind: "pause", target });
    else if (target.requires.includes("resolution") || target.requires.includes("time_logged"))
      setSheet({ kind: "resolve", target });
    else if (target.reopen || TERMINAL_CONFIRM.has(target.to)) setSheet({ kind: "confirm", target });
    else void transition({ version: ticket.version, to: target.to }, target.label);
  };

  const finish = async (body: Parameters<typeof transition>[0], label: string) => {
    const view = await transition(body, label);
    if (view) setSheet({ kind: "none" });
  };

  return (
    <div className={cn("relative inline-flex flex-col", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`State ${ticket.state_label}, change`}
        disabled={terminal || pending}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 disabled:cursor-default"
      >
        <StatePill state={ticket.state} label={ticket.state_label} />
        {!terminal ? (
          <span aria-hidden className="text-xms-muted text-[10px]">
            ▾
          </span>
        ) : null}
      </button>
      {open ? (
        <ul role="menu" className="xms-card absolute top-full left-0 z-20 mt-1 min-w-[220px] py-1 text-[13px]">
          {(data?.transitions ?? []).map((target) => (
            <li key={target.to} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => choose(target)}
                className="hover:bg-xms-tint flex w-full items-center gap-2 px-3 py-1.5 text-left"
              >
                <StatePill state={target.to} label={target.label} />
                {target.requires.length > 0 ? (
                  <span className="text-xms-label ml-auto text-[11px]">needs input</span>
                ) : null}
              </button>
            </li>
          ))}
          {data && data.transitions.length === 0 ? (
            <li className="text-xms-label px-3 py-1.5">No moves from here</li>
          ) : null}
        </ul>
      ) : null}
      {sheet.kind === "pause" ? (
        <form
          aria-label={`Move to ${sheet.target.label}`}
          className="xms-card absolute top-full left-0 z-20 mt-1 flex w-[340px] flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void finish(
              { version: ticket.version, to: sheet.target.to, pause_reason: pauseReason, note: pauseNote || undefined },
              sheet.target.label,
            );
          }}
        >
          <p className="xms-caption">Pause the SLA clocks</p>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Reason</span>
            <select
              aria-label="Pause reason"
              value={pauseReason}
              onChange={(event) => setPauseReason(event.target.value as PauseReason)}
              className={INPUT}
            >
              {PAUSE_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Note (optional)</span>
            <input
              aria-label="Pause note"
              value={pauseNote}
              onChange={(event) => setPauseNote(event.target.value)}
              className={INPUT}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSheet({ kind: "none" })}
              className="border-xms-line text-xms-body h-[32px] rounded-[4px] border px-3 text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-xms-accent h-[32px] rounded-[4px] px-3 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Move to {sheet.target.label}
            </button>
          </div>
        </form>
      ) : null}
      {sheet.kind === "resolve" ? (
        <div className="xms-card absolute top-full left-0 z-20 mt-1 w-[420px] p-4">
          <ResolveForm
            requires={sheet.target.requires}
            targetLabel={sheet.target.label}
            pending={pending}
            serverMissing={serverMissing}
            onCancel={() => setSheet({ kind: "none" })}
            onSubmit={async (draft) => {
              const view = await transition(
                { version: ticket.version, to: sheet.target.to, resolution: toResolutionBody(draft) },
                sheet.target.label,
              );
              if (view) setSheet({ kind: "none" });
              else setServerMissing([]);
            }}
          />
        </div>
      ) : null}
      {sheet.kind === "confirm" ? (
        <div
          role="dialog"
          aria-label={`Confirm ${sheet.target.label}`}
          className="xms-card absolute top-full left-0 z-20 mt-1 flex w-[340px] flex-col gap-3 p-4 text-[13px]"
        >
          <p className="text-xms-ink">
            {sheet.target.reopen
              ? "Reopen this ticket? The breach latches and the original due times stay."
              : `Move ${ticket.key} to ${sheet.target.label}?`}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSheet({ kind: "none" })}
              className="border-xms-line text-xms-body h-[32px] rounded-[4px] border px-3"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void finish({ version: ticket.version, to: sheet.target.to }, sheet.target.label)}
              className="bg-xms-accent h-[32px] rounded-[4px] px-3 font-medium text-white disabled:opacity-50"
            >
              {sheet.target.reopen ? "Reopen" : `Move to ${sheet.target.label}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
