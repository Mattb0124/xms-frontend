"use client";

import { useState } from "react";
import { DANGER_BUTTON, formatDate, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { RailCard } from "@/components/xms/rail-card";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import {
  actorLabel,
  allowanceLabel,
  decisionBlockedReason,
  decisionBody,
  describeScopeError,
  flagBody,
  isFlagged,
  scopeError,
  scopeLabel,
  scopeTone,
  validateDecision,
  validateFlag,
  withdrawBody,
} from "@/lib/tickets/scope";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useDecideTicketScopeMutation,
  useFlagTicketScopeMutation,
  type TicketScope,
  type TicketView,
} from "@/redux/ticketsApi";

const LABEL = "text-xms-label text-[11px]";

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className={LABEL}>{label}</span>
      <span className="text-xms-body text-[13px] whitespace-pre-wrap">{children}</span>
    </div>
  );
}

/** What the record already knows: the flag, who raised it and why, and the answer. */
export function ScopeState({ scope }: { scope: TicketScope }) {
  const flaggedBy = actorLabel(scope.flagged_by_name, scope.flagged_by);
  const decidedBy = actorLabel(scope.decided_by_name, scope.decided_by);
  return (
    <div className="flex flex-col gap-2" data-scope={scope.out_of_scope}>
      <SignalPill tone={scopeTone(scope.out_of_scope)} label={scopeLabel(scope.out_of_scope)} />
      {scope.reason ? <Line label="Reason">{scope.reason}</Line> : null}
      {flaggedBy ? (
        <Line label="Flagged by">
          {flaggedBy}
          {scope.flagged_at ? ` on ${formatDate(scope.flagged_at)}` : ""}
        </Line>
      ) : null}
      {scope.decision ? (
        <>
          <Line label="Decision">{scope.decision === "approve" ? "Approved" : "Declined"}</Line>
          {scope.note ? <Line label="Note">{scope.note}</Line> : null}
          <Line label="Allowance">{allowanceLabel(scope.overage_allowance_minutes)}</Line>
          {decidedBy ? (
            <Line label="Decided by">
              {decidedBy}
              {scope.decided_at ? ` on ${formatDate(scope.decided_at)}` : ""}
            </Line>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * The Scope card on the ticket record's rail (TM-11, Ticket Management
 * functional 5.1 and technical 3.3).
 *
 * It shows the flag, its reason, who raised it and when, and the decision
 * with its note, its allowance and who decided. Under `tickets:work` it
 * offers "Flag out of scope", which will not send without a reason, and
 * "Withdraw flag" while nothing has been decided. Under
 * `tickets:approve-scope` it offers Approve, with an optional allowance in
 * minutes and an optional note, and Decline, which says why; both are
 * hidden from the person who raised the flag, in the words the API refuses
 * them with, because approval is the account's commercial answer and not
 * the flagger's own.
 *
 * Every refusal the two routes answer with is worded here; the record is
 * read again either way, since a refusal means the browser's copy is behind.
 */
export function ScopeCard({ ticket }: { ticket: TicketView }) {
  const me = useMe();
  const { push } = useToast();
  const [flag, { isLoading: flagging }] = useFlagTicketScopeMutation();
  const [decide, { isLoading: deciding }] = useDecideTicketScopeMutation();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [allowance, setAllowance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);

  const scope = ticket.scope;
  // An API that does not answer with the block has no flag to show; the
  // card is not drawn at all rather than drawn as "in scope" it never read.
  if (!scope) return null;

  const canWork = me.hasPermission("tickets:work");
  const canDecide = me.hasPermission("tickets:approve-scope");
  const flagged = isFlagged(scope);
  const blocked = decisionBlockedReason(scope, me.principal?.userId);
  const busy = flagging || deciding;

  const refuse = (caught: unknown) => {
    const worded = describeScopeError(scopeError(caught));
    setError(worded);
    push({ title: "Not saved", detail: worded, tone: "error" });
  };

  const raise = async () => {
    const invalid = validateFlag(reason);
    if (invalid) return setError(invalid);
    setError(null);
    try {
      await flag({ key: ticket.key, body: flagBody(ticket.version, reason) }).unwrap();
      setReason("");
      setFlagOpen(false);
    } catch (caught) {
      refuse(caught);
    }
  };

  const withdraw = async () => {
    setError(null);
    try {
      await flag({ key: ticket.key, body: withdrawBody(ticket.version) }).unwrap();
    } catch (caught) {
      refuse(caught);
    }
  };

  const answer = async (decision: "approve" | "decline") => {
    const invalid = validateDecision(decision, note, allowance);
    if (invalid) return setError(invalid);
    setError(null);
    try {
      await decide({ key: ticket.key, body: decisionBody(ticket.version, decision, note, allowance) }).unwrap();
      setNote("");
      setAllowance("");
    } catch (caught) {
      refuse(caught);
    }
  };

  return (
    <RailCard caption="Scope">
      <div className="flex flex-col gap-3" data-testid="ticket-scope">
        <ScopeState scope={scope} />

        {canWork && !flagged ? (
          <div className="flex flex-col gap-2">
            {flagOpen ? (
              <>
                <label className={LABEL} htmlFor={`scope-reason-${ticket.key}`}>
                  Why is this work outside the contract?
                </label>
                <textarea
                  id={`scope-reason-${ticket.key}`}
                  rows={3}
                  maxLength={2000}
                  className={cn(INPUT, "h-auto py-1 text-[13px]")}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <p className="text-xms-label text-[11px]">
                  The account&apos;s contract managers are told, and they decide it.
                </p>
                <div className="flex gap-2">
                  <button type="button" className={PRIMARY_BUTTON} onClick={raise} disabled={busy}>
                    Flag out of scope
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    onClick={() => {
                      setFlagOpen(false);
                      setError(null);
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setFlagOpen(true)} disabled={busy}>
                Flag out of scope
              </button>
            )}
          </div>
        ) : null}

        {canWork && flagged ? (
          <button type="button" className={SECONDARY_BUTTON} onClick={withdraw} disabled={busy}>
            Withdraw flag
          </button>
        ) : null}

        {canDecide && flagged ? (
          blocked ? (
            <p className="text-xms-label text-[12px]" data-decision-blocked>
              {blocked}
            </p>
          ) : (
            <div className="flex flex-col gap-2" data-testid="scope-decision">
              <label className={LABEL} htmlFor={`scope-allowance-${ticket.key}`}>
                Allowance in minutes (optional)
              </label>
              <input
                id={`scope-allowance-${ticket.key}`}
                inputMode="numeric"
                className={cn(INPUT, "xms-mono text-[13px]")}
                value={allowance}
                onChange={(event) => setAllowance(event.target.value)}
              />
              <p className="text-xms-label text-[11px]">
                Added to the contract period the ticket bills against, so the time logged on it is inside budget. Leave
                it empty to approve with no extra budget.
              </p>
              <label className={LABEL} htmlFor={`scope-note-${ticket.key}`}>
                Note (required to decline)
              </label>
              <textarea
                id={`scope-note-${ticket.key}`}
                rows={2}
                maxLength={2000}
                className={cn(INPUT, "h-auto py-1 text-[13px]")}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" className={PRIMARY_BUTTON} onClick={() => answer("approve")} disabled={busy}>
                  Approve
                </button>
                <button type="button" className={DANGER_BUTTON} onClick={() => answer("decline")} disabled={busy}>
                  Decline
                </button>
              </div>
            </div>
          )
        ) : null}

        {!canWork && !canDecide ? (
          <p className="text-xms-label text-[12px]">Flagging and deciding scope are not yours to do on this ticket.</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
            {error}
          </p>
        ) : null}
      </div>
    </RailCard>
  );
}
