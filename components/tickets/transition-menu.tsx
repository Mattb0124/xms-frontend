"use client";

import { useCallback, useRef, useState } from "react";
import { formatDate, INPUT } from "@/components/admin/primitives";
import { ResolveForm, toResolutionBody } from "@/components/tickets/resolve-form";
import { ICON, ChevronDownIcon } from "@/components/xms/icons";
import { StatePill } from "@/components/xms/state-pill";
import {
  CHANGE_REASON_REQUIRED,
  changeWindowDetail,
  changeWindowTitle,
  OVERRIDE_PERMISSION,
  type ChangeWindowRefusal,
} from "@/lib/tickets/change-window";
import type { TransitionError } from "@/lib/tickets/transition-errors";
import { useTransition } from "@/lib/tickets/use-transition";
import { useCatalogs } from "@/lib/tickets/use-catalogs";
import { useTicketSolutionsQuery } from "@/redux/knowledgeApi";
import { useMe } from "@/redux/me";
import { useTicketTimeQuery } from "@/redux/timeApi";
import { PAUSE_REASONS, type PauseReason } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import {
  useGetTransitionsQuery,
  type AllowedTransition,
  type TicketView,
  type TransitionBody,
} from "@/redux/ticketsApi";

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
  const me = useMe();
  const { data } = useGetTransitionsQuery(ticket.key);
  const canOverride = me.hasPermission(OVERRIDE_PERMISSION);
  // The body the server last refused, so the sheet can send the same move
  // again with the reason added rather than reconstructing it.
  const attempted = useRef<{ body: TransitionBody; target: AllowedTransition } | null>(null);
  const [windowSheet, setWindowSheet] = useState<{ target: AllowedTransition; refusal: ChangeWindowRefusal } | null>(
    null,
  );
  const [windowReason, setWindowReason] = useState("");
  const [windowProblem, setWindowProblem] = useState<string | null>(null);

  /**
   * The window rules refused this move (TM-18). A freeze or a clash on the
   * same configuration item is a warning anyone may acknowledge with a
   * reason; being outside the window is an override, and only the holder of
   * `tickets:override-change-window` is offered the box, because offering it
   * to anybody else would only earn a second refusal. A move that already
   * carried a reason and was refused again is left to the toast.
   */
  const onRefused = useCallback(
    (error: TransitionError) => {
      const refusal = error.changeWindow;
      const pending = attempted.current;
      if (!refusal || !pending || pending.body.change_window_reason) return false;
      if (refusal.kind === "override" && !canOverride) return false;
      setWindowSheet({ target: pending.target, refusal });
      setWindowReason("");
      setWindowProblem(null);
      return true;
    },
    [canOverride],
  );

  const { transition, pending } = useTransition(ticket.key, onRefused);
  const catalogs = useCatalogs(ticket.account_id);
  const { data: time } = useTicketTimeQuery(ticket.key);
  const { data: rail } = useTicketSolutionsQuery(ticket.key);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [pauseReason, setPauseReason] = useState<PauseReason>("awaiting_client");
  const [pauseNote, setPauseNote] = useState("");
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const terminal = TERMINAL_CONFIRM.has(ticket.state);

  /** Every move goes through here, so the refusal handler always knows what was tried. */
  const run = (body: TransitionBody, target: AllowedTransition) => {
    attempted.current = { body, target };
    return transition(body, target.label);
  };

  const choose = (target: AllowedTransition) => {
    setOpen(false);
    setServerMissing([]);
    setWindowSheet(null);
    if (target.requires.includes("pause_reason")) setSheet({ kind: "pause", target });
    else if (target.requires.includes("resolution") || target.requires.includes("time_logged"))
      setSheet({ kind: "resolve", target });
    else if (target.reopen || TERMINAL_CONFIRM.has(target.to)) setSheet({ kind: "confirm", target });
    else void run({ version: ticket.version, to: target.to }, target);
  };

  const finish = async (body: TransitionBody, target: AllowedTransition) => {
    const view = await run(body, target);
    if (view) setSheet({ kind: "none" });
  };

  /** The same move again, this time with the reason the audit will carry. */
  const carryWindow = async () => {
    const reason = windowReason.trim();
    if (reason === "") {
      setWindowProblem(CHANGE_REASON_REQUIRED);
      return;
    }
    const pending = attempted.current;
    if (!pending) return;
    const view = await run({ ...pending.body, change_window_reason: reason }, pending.target);
    if (view) {
      setWindowSheet(null);
      setSheet({ kind: "none" });
    }
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
        className="inline-flex disabled:cursor-default"
      >
        {/* The record bar's state pill carries the chevron inside itself in the
            render (02), and stands at 32px rather than at a list row's height. */}
        <StatePill
          state={ticket.state}
          label={ticket.state_label}
          className="h-[32px] gap-[6px] px-[14px] text-[13px] font-semibold"
          trailing={terminal ? undefined : <ChevronDownIcon size={ICON.glyph} className="opacity-70" />}
        />
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
              sheet.target,
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
            codes={catalogs.resolutionCodes}
            loggedMinutes={time?.total_minutes ?? 0}
            suggested={rail?.articles ?? []}
            pending={pending}
            serverMissing={serverMissing}
            onCancel={() => setSheet({ kind: "none" })}
            onSubmit={async (draft) => {
              const view = await run(
                { version: ticket.version, to: sheet.target.to, resolution: toResolutionBody(draft) },
                sheet.target,
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
              onClick={() => void finish({ version: ticket.version, to: sheet.target.to }, sheet.target)}
              className="bg-xms-accent h-[32px] rounded-[4px] px-3 font-medium text-white disabled:opacity-50"
            >
              {sheet.target.reopen ? "Reopen" : `Move to ${sheet.target.label}`}
            </button>
          </div>
        </div>
      ) : null}
      {windowSheet ? (
        <ChangeWindowSheet
          refusal={windowSheet.refusal}
          target={windowSheet.target}
          reason={windowReason}
          onReasonChange={setWindowReason}
          problem={windowProblem}
          pending={pending}
          onCancel={() => setWindowSheet(null)}
          onCarry={() => void carryWindow()}
        />
      ) : null}
    </div>
  );
}

/**
 * The change window sheet (TM-18). It names what is in the way, in the
 * server's own terms, and takes the reason that carries the move: an
 * acknowledgement of a freeze or a clash, or an override of the window
 * itself. Either way the reason lands on the audit, because a window nobody
 * can cross is not a window and a crossing nobody recorded is not a
 * decision.
 */
function ChangeWindowSheet({
  refusal,
  target,
  reason,
  onReasonChange,
  problem,
  pending,
  onCancel,
  onCarry,
}: {
  refusal: ChangeWindowRefusal;
  target: AllowedTransition;
  reason: string;
  onReasonChange: (value: string) => void;
  problem: string | null;
  pending: boolean;
  onCancel: () => void;
  onCarry: () => void;
}) {
  const acknowledging = refusal.kind === "acknowledge";
  return (
    <form
      aria-label={`Change window for ${target.label}`}
      className="xms-card absolute top-full left-0 z-20 mt-1 flex w-[420px] flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onCarry();
      }}
    >
      <p className="xms-caption">{acknowledging ? "Acknowledge the warning" : "Override the change window"}</p>
      <p className="text-xms-ink text-[13px]">{changeWindowTitle(refusal)}</p>
      <p className="text-xms-body text-[12px]">{changeWindowDetail(refusal)}</p>
      {refusal.starts_at && refusal.ends_at ? (
        <p className="xms-mono text-xms-label text-[12px]" data-window-span>
          {formatDate(refusal.starts_at)} to {formatDate(refusal.ends_at)}
          {refusal.at ? `, and it is now ${formatDate(refusal.at)}` : ""}
        </p>
      ) : null}
      {refusal.freeze ? (
        <p className="xms-mono text-xms-label text-[12px]" data-freeze-span>
          Freeze {formatDate(refusal.freeze.starts_at)} to {formatDate(refusal.freeze.ends_at)}
        </p>
      ) : null}
      {refusal.conflicts.length > 0 ? (
        <ul className="text-xms-body text-[12px]" data-conflicts>
          {refusal.conflicts.map((conflict) => (
            <li key={conflict.key}>
              <span className="xms-mono">{conflict.key}</span>
              {conflict.group_name ? ` in ${conflict.group_name}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-xms-label">Reason</span>
        <input
          aria-label="Change window reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          className={INPUT}
        />
      </label>
      {problem ? (
        <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-xms-line text-xms-body h-[32px] rounded-[4px] border px-3 text-[13px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-xms-accent h-[32px] rounded-[4px] px-3 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {acknowledging ? "Acknowledge and move" : "Override and move"}
        </button>
      </div>
    </form>
  );
}
