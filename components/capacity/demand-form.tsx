"use client";

import { useState } from "react";
import { INPUT, InlineError, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { DEMAND_SOURCE, demandSubject, isMonth, monthLabel } from "@/lib/capacity/vocab";
import { ROLE_OPTIONS } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { formatHours } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { useAddDemandMutation, type CreateDemandBody } from "@/redux/capacityApi";
import type { GrantedAccount } from "@/redux/ticketsApi";

/** The form as the screen holds it; numbers stay text until they are sent. */
export interface DemandDraft {
  source: "pipeline" | "project";
  /** An account id, or empty for a prospect. */
  accountId: string;
  prospect: string;
  /** "YYYY-MM". */
  month: string;
  hours: string;
  /** Percent text ("50"); only sent for pipeline. */
  probability: string;
  role: string;
  note: string;
}

export function emptyDemandDraft(month: string): DemandDraft {
  return { source: "pipeline", accountId: "", prospect: "", month, hours: "", probability: "50", role: "", note: "" };
}

/** Why the draft cannot be sent yet, in the screen's words; null when it can. The server checks again. */
export function validateDemand(draft: DemandDraft): string | null {
  if (!draft.accountId && draft.prospect.trim() === "") return "Name an account or a prospect.";
  if (!isMonth(draft.month)) return "The month must be written as YYYY-MM.";
  const hours = Number(draft.hours);
  if (draft.hours.trim() === "" || !Number.isFinite(hours) || hours < 0) return "Hours must be a number of 0 or more.";
  if (draft.source === "pipeline") {
    const percent = Number(draft.probability);
    if (draft.probability.trim() === "" || !Number.isFinite(percent) || percent < 1 || percent > 100)
      return "The probability is a whole percentage from 1 to 100.";
  }
  return null;
}

/**
 * The POST body (CAP-08): the account id or the prospect name (never
 * both), the probability as a fraction only for pipeline demand, and the
 * role and note only when given.
 */
export function demandBody(draft: DemandDraft): CreateDemandBody {
  return {
    source: draft.source,
    ...(draft.accountId ? { account_id: draft.accountId } : { prospect_name: draft.prospect.trim() }),
    month: draft.month,
    hours: Number(draft.hours),
    ...(draft.source === "pipeline" ? { probability: Math.round(Number(draft.probability)) / 100 } : {}),
    ...(draft.role ? { role: draft.role } : {}),
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
  };
}

const CONTROL = cn(INPUT, "h-[30px] text-[12px]");

export interface AddDemandFormProps {
  /** The granted accounts (tickets:view); without them only a prospect can be named. */
  accounts?: GrantedAccount[];
  /** "YYYY-MM": the form opens on this month. */
  defaultMonth: string;
}

/**
 * Enter one demand line by hand (functional 5.7): the source, an account
 * or a prospect, the month, the hours, the probability (pipeline only),
 * the role and a note. subject_required and the other refusals come back
 * in the screen's words; the list and the month view reload on success.
 */
export function AddDemandForm({ accounts, defaultMonth }: AddDemandFormProps) {
  const [draft, setDraft] = useState<DemandDraft>(() => emptyDemandDraft(defaultMonth));
  const [problem, setProblem] = useState<string | null>(null);
  const [add, { isLoading }] = useAddDemandMutation();
  const { push } = useToast();
  const track = useTrack("capacity.demand.add");
  const set = (next: Partial<DemandDraft>) => setDraft({ ...draft, ...next });

  const submit = async () => {
    const invalid = validateDemand(draft);
    setProblem(invalid);
    if (invalid) return;
    try {
      const row = await add(demandBody(draft)).unwrap();
      track({ source: row.source, month: row.period_month, hours: row.hours });
      push({
        title: "Demand added",
        detail: `${demandSubject(row)}, ${DEMAND_SOURCE[row.source].label.toLowerCase()} ${formatHours(row.hours * 60)} in ${monthLabel(row.period_month)}.`,
        tone: "success",
      });
      setDraft(emptyDemandDraft(draft.month));
    } catch (caught) {
      setProblem(describeCapacityError(capacityError(caught)));
    }
  };

  return (
    <Panel title="Add demand" caption="Pipeline hours weighted by their probability; project hours as committed">
      <form
        className="flex flex-col gap-3 text-[12px]"
        aria-label="Add demand"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Source</span>
            <select
              aria-label="Source"
              className={cn(CONTROL, "w-[130px]")}
              value={draft.source}
              onChange={(event) => set({ source: event.target.value as DemandDraft["source"] })}
            >
              <option value="pipeline">Pipeline</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Account</span>
            <select
              aria-label="Account"
              className={cn(CONTROL, "w-[220px]")}
              value={draft.accountId}
              disabled={!accounts}
              onChange={(event) => set({ accountId: event.target.value, prospect: event.target.value ? "" : draft.prospect })}
            >
              <option value="">{accounts ? "No account (a prospect)" : "Accounts need tickets:view"}</option>
              {(accounts ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.key} {account.name}
                </option>
              ))}
            </select>
          </label>
          {draft.accountId ? null : (
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Prospect</span>
              <input
                aria-label="Prospect"
                className={cn(CONTROL, "w-[220px]")}
                value={draft.prospect}
                maxLength={160}
                placeholder="Acme Corp"
                onChange={(event) => set({ prospect: event.target.value })}
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Month</span>
            <input
              type="month"
              aria-label="Demand month"
              className={cn(CONTROL, "xms-mono w-[160px]")}
              value={draft.month}
              onChange={(event) => set({ month: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Hours</span>
            <input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              aria-label="Hours"
              className={cn(CONTROL, "xms-mono w-[100px] text-right")}
              value={draft.hours}
              onChange={(event) => set({ hours: event.target.value })}
            />
          </label>
          {draft.source === "pipeline" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Probability (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                inputMode="numeric"
                aria-label="Probability"
                className={cn(CONTROL, "xms-mono w-[100px] text-right")}
                value={draft.probability}
                onChange={(event) => set({ probability: event.target.value })}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Role</span>
            <select
              aria-label="Role"
              className={cn(CONTROL, "w-[180px]")}
              value={draft.role}
              onChange={(event) => set({ role: event.target.value })}
            >
              <option value="">Any role</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="text-xms-label">Note</span>
            <input
              aria-label="Note"
              className={CONTROL}
              value={draft.note}
              maxLength={200}
              onChange={(event) => set({ note: event.target.value })}
            />
          </label>
          <button type="submit" className={cn(PRIMARY_BUTTON, "h-[30px]")} disabled={isLoading}>
            Add demand
          </button>
        </div>
        <InlineError message={problem} />
      </form>
    </Panel>
  );
}
