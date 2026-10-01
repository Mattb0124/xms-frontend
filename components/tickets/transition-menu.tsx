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
  useGetTimeGateQuery,
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

/** The sheet that collects what a move requires, or none when it can be sent as it stands. */
function sheetFor(target: AllowedTransition): Sheet {
  if (target.requires.includes("pause_reason")) return { kind: "pause", target };
  if (target.requires.includes("resolution") || target.requires.includes("time_logged")) {
    return { kind: "resolve", target };
  }
  if (target.reopen || TERMINAL_CONFIRM.has(target.to)) return { kind: "confirm", target };
  return { kind: "none" };
}

interface Attempt {
  body: TransitionBody;
  target: AllowedTransition;
}

interface WindowRefused {
  target: AllowedTransition;
  refusal: ChangeWindowRefusal;
}

/**
 * Every move the menu sends, and the change window refusal (TM-18) one of
 * them may earn: the refusal the sheet shows, the reason it collects, and
 * the same move sent again with that reason.
 */
function useWindowedTransition(ticketKey: string, canOverride: boolean) {
  // The body the server last refused, so the sheet can send the same move
  // again with the reason added rather than reconstructing it.
  const attempted = useRef<Attempt | null>(null);
  const [refused, setRefused] = useState<WindowRefused | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

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
      const last = attempted.current;
      if (!refusal || !last || last.body.change_window_reason) return false;
      if (refusal.kind === "override" && !canOverride) return false;
      setRefused({ target: last.target, refusal });
      setReason("");
      setProblem(null);
      return true;
    },
    [canOverride],
  );

  const { transition, pending } = useTransition(ticketKey, onRefused);

  /** Every move goes through here, so the refusal handler always knows what was tried. */
  const run = (body: TransitionBody, target: AllowedTransition) => {
    attempted.current = { body, target };
    return transition(body, target.label);
  };

  /** The same move again, this time with the reason the audit will carry. Resolves to whether it moved. */
  const carry = async (): Promise<boolean> => {
    const trimmed = reason.trim();
    if (trimmed === "") {
      setProblem(CHANGE_REASON_REQUIRED);
      return false;
    }
    const last = attempted.current;
    if (!last) return false;
    const view = await run({ ...last.body, change_window_reason: trimmed }, last.target);
    if (view) setRefused(null);
    return Boolean(view);
  };

  return { run, pending, refused, reason, setReason, problem, dismiss: () => setRefused(null), carry };
}

export interface TransitionListProps {
  transitions: AllowedTransition[] | undefined;
  onChoose: (target: AllowedTransition) => void;
}

function TransitionList({ transitions, onChoose }: TransitionListProps) {
  return (
    <ul role="menu" className="xms-card xms-enter-pop absolute top-full left-0 z-20 mt-1 min-w-[220px] py-1 text-body">
      {(transitions ?? []).map((target) => (
        <li key={target.to} role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => onChoose(target)}
            className="hover:bg-xms-control-hover flex w-full items-center gap-2 px-3 py-1.5 text-left"
          >
            <StatePill state={target.to} label={target.label} />
            {target.requires.length > 0 ? <span className="text-xms-label ml-auto text-body">needs input</span> : null}
          </button>
        </li>
      ))}
      {transitions && transitions.length === 0 ? (
        <li className="text-xms-label px-3 py-1.5">No moves from here</li>
      ) : null}
    </ul>
  );
}

interface PauseDraft {
  reason: PauseReason;
  note: string;
}

export interface PauseSheetProps {
  target: AllowedTransition;
  draft: PauseDraft;
  onChange: (draft: PauseDraft) => void;
  pending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function PauseSheet({ target, draft, onChange, pending, onCancel, onSubmit }: PauseSheetProps) {
  return (
    <form
      aria-label={`Move to ${target.label}`}
      className="xms-card absolute top-full left-0 z-20 mt-1 flex w-[340px] flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="xms-caption">Pause the SLA clocks</p>
      <label className="flex flex-col gap-1 text-body">
        <span className="text-xms-label">Reason</span>
        <select
          aria-label="Pause reason"
          value={draft.reason}
          onChange={(event) => onChange({ ...draft, reason: event.target.value as PauseReason })}
          className={INPUT}
        >
          {PAUSE_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-body">
        <span className="text-xms-label">Note (optional)</span>
        <input
          aria-label="Pause note"
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          className={INPUT}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-xms-line text-xms-body h-[32px] rounded-control border px-3 text-body"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-xms-accent h-[32px] rounded-control px-3 text-body font-medium text-white disabled:opacity-50"
        >
          Move to {target.label}
        </button>
      </div>
    </form>
  );
}

export interface ConfirmSheetProps {
  ticketKey: string;
  target: AllowedTransition;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmSheet({ ticketKey, target, pending, onCancel, onConfirm }: ConfirmSheetProps) {
  return (
    <div
      role="dialog"
      aria-label={`Confirm ${target.label}`}
      className="xms-card absolute top-full left-0 z-20 mt-1 flex w-[340px] flex-col gap-3 p-4 text-body"
    >
      <p className="text-xms-ink">
        {target.reopen
          ? "Reopen this ticket? The breach latches and the original due times stay."
          : `Move ${ticketKey} to ${target.label}?`}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-xms-line text-xms-body h-[32px] rounded-control border px-3"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="bg-xms-accent h-[32px] rounded-control px-3 font-medium text-white disabled:opacity-50"
        >
          {target.reopen ? "Reopen" : `Move to ${target.label}`}
        </button>
      </div>
    </div>
  );
}

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
  const moves = useWindowedTransition(ticket.key, me.hasPermission(OVERRIDE_PERMISSION));
  const catalogs = useCatalogs(ticket.account_id);
  const { data: time } = useTicketTimeQuery(ticket.key);
  const { data: rail } = useTicketSolutionsQuery(ticket.key);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  // The gate's own terms (TB-02): which exemptions this account accepts and
  // how much resolution note it wants. Asked for only while the sheet is
  // open, since a reader browsing the record does not need it.
  const { data: gate } = useGetTimeGateQuery(ticket.key, { skip: sheet.kind !== "resolve" });
  const [pause, setPause] = useState<PauseDraft>({ reason: "awaiting_client", note: "" });
  const terminal = TERMINAL_CONFIRM.has(ticket.state);
  const closeSheet = () => setSheet({ kind: "none" });

  const choose = (target: AllowedTransition) => {
    setOpen(false);
    moves.dismiss();
    const next = sheetFor(target);
    if (next.kind === "none") void moves.run({ version: ticket.version, to: target.to }, target);
    else setSheet(next);
  };

  const finish = async (body: TransitionBody, target: AllowedTransition) => {
    const view = await moves.run(body, target);
    if (view) closeSheet();
  };

  const carryWindow = async () => {
    if (await moves.carry()) closeSheet();
  };

  return (
    <div className={cn("relative inline-flex flex-col", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`State ${ticket.state_label}, change`}
        disabled={terminal || moves.pending}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex disabled:cursor-default"
      >
        {/* The record bar's state pill carries the chevron inside itself in the
            render (02), and stands at 32px rather than at a list row's height. */}
        <StatePill
          state={ticket.state}
          label={ticket.state_label}
          // The prototype's own state pill in the record bar: 600 13px on 1,
          // 9px by 14px, an 8px gap and a 15px chevron in the label grey.
          className="gap-2 px-[14px] py-[9px] text-body leading-none font-semibold"
          trailing={terminal ? undefined : <ChevronDownIcon size={ICON.action} className="text-xms-label" />}
        />
      </button>
      {open ? <TransitionList transitions={data?.transitions} onChoose={choose} /> : null}
      {sheet.kind === "pause" ? (
        <PauseSheet
          target={sheet.target}
          draft={pause}
          onChange={setPause}
          pending={moves.pending}
          onCancel={closeSheet}
          onSubmit={() =>
            void finish(
              {
                version: ticket.version,
                to: sheet.target.to,
                pause_reason: pause.reason,
                note: pause.note || undefined,
              },
              sheet.target,
            )
          }
        />
      ) : null}
      {sheet.kind === "resolve" ? (
        <div className="xms-card absolute top-full left-0 z-20 mt-1 w-[420px] p-4">
          <ResolveForm
            requires={sheet.target.requires}
            targetLabel={sheet.target.label}
            codes={catalogs.resolutionCodes}
            loggedMinutes={gate?.logged_minutes ?? time?.total_minutes ?? 0}
            exemptionReasons={gate?.exemption_reasons}
            minNotesChars={gate?.min_resolution_notes_chars}
            suggested={rail?.articles ?? []}
            pending={moves.pending}
            onCancel={closeSheet}
            onSubmit={(draft) =>
              finish(
                { version: ticket.version, to: sheet.target.to, resolution: toResolutionBody(draft) },
                sheet.target,
              )
            }
          />
        </div>
      ) : null}
      {sheet.kind === "confirm" ? (
        <ConfirmSheet
          ticketKey={ticket.key}
          target={sheet.target}
          pending={moves.pending}
          onCancel={closeSheet}
          onConfirm={() => void finish({ version: ticket.version, to: sheet.target.to }, sheet.target)}
        />
      ) : null}
      {moves.refused ? (
        <ChangeWindowSheet
          refusal={moves.refused.refusal}
          target={moves.refused.target}
          reason={moves.reason}
          onReasonChange={moves.setReason}
          problem={moves.problem}
          pending={moves.pending}
          onCancel={moves.dismiss}
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
      <p className="text-xms-ink text-body">{changeWindowTitle(refusal)}</p>
      <p className="text-xms-body text-body">{changeWindowDetail(refusal)}</p>
      {refusal.starts_at && refusal.ends_at ? (
        <p className="xms-mono text-xms-label text-body" data-window-span>
          {formatDate(refusal.starts_at)} to {formatDate(refusal.ends_at)}
          {refusal.at ? `, and it is now ${formatDate(refusal.at)}` : ""}
        </p>
      ) : null}
      {refusal.freeze ? (
        <p className="xms-mono text-xms-label text-body" data-freeze-span>
          Freeze {formatDate(refusal.freeze.starts_at)} to {formatDate(refusal.freeze.ends_at)}
        </p>
      ) : null}
      {refusal.conflicts.length > 0 ? (
        <ul className="text-xms-body text-body" data-conflicts>
          {refusal.conflicts.map((conflict) => (
            <li key={conflict.key}>
              <span className="xms-mono">{conflict.key}</span>
              {conflict.group_name ? ` in ${conflict.group_name}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <label className="flex flex-col gap-1 text-body">
        <span className="text-xms-label">Reason</span>
        <input
          aria-label="Change window reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          className={INPUT}
        />
      </label>
      {problem ? (
        <p role="alert" className="text-body text-[color:var(--state-overdue-text)]">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-xms-line text-xms-body h-[32px] rounded-control border px-3 text-body"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-xms-accent h-[32px] rounded-control px-3 text-body font-medium text-white disabled:opacity-50"
        >
          {acknowledging ? "Acknowledge and move" : "Override and move"}
        </button>
      </div>
    </form>
  );
}
