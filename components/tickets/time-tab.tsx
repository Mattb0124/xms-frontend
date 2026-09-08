"use client";

import { useEffect, useState } from "react";
import { INPUT, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { AfterHoursBadge } from "@/components/time/after-hours-badge";
import { EntryAmount, OverBudgetPill } from "@/components/time/entry-amount";
import { ICON, CloseIcon } from "@/components/xms/icons";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { isStartTime, startTimeLabel, type HandlingRule } from "@/lib/time/after-hours";
import { overageBlockedMessage } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useListAccountContractsQuery } from "@/redux/ticketsApi";
import { useLogTicketTimeMutation, useTicketTimeQuery, type LogTimeBody, type TimeEntry } from "@/redux/timeApi";

export const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export interface LogTimeDraft {
  performedOn: string;
  /** HH:MM, 24-hour, local to the account calendar's zone; empty when not given. */
  performedStart: string;
  minutes: string;
  activityType: string;
  billableClass: string;
  description: string;
  /** The person's own statement; only sent when no start time lets the calendar judge. */
  afterHours: boolean;
}

/**
 * `billableClass` overrides the class the first activity would carry: a
 * bucket names its own (TB-12), and non-ticket work is internal unless the
 * account says otherwise, so the bucket's class is the one the form opens on.
 */
export function emptyDraft(catalogs: DeskCatalogs, billableClass?: string): LogTimeDraft {
  const first = catalogs.activityTypes[0];
  return {
    performedOn: today(),
    performedStart: "",
    minutes: "",
    activityType: first?.key ?? "",
    billableClass: billableClass ?? first?.billableClass ?? "",
    description: "",
    afterHours: false,
  };
}

export function validateDraft(draft: LogTimeDraft): string | null {
  const minutes = Number(draft.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0) return "Minutes must be a whole number above zero.";
  if (minutes > 1440) return "One entry cannot exceed a day.";
  if (draft.performedOn > today()) return "The date cannot be in the future.";
  if (draft.performedStart && !isStartTime(draft.performedStart)) return "Start time must be HH:MM, 24-hour.";
  if (!draft.activityType) return "Choose an activity.";
  return null;
}

/**
 * The POST body (TB-13): a start time travels as performed_start and the
 * calendar judges the class; without one, the person's own after-hours
 * statement travels as after_hours.
 */
export function toLogTimeBody(draft: LogTimeDraft): LogTimeBody {
  const start = draft.performedStart.trim();
  return {
    performed_on: draft.performedOn,
    minutes: Number(draft.minutes),
    activity_type: draft.activityType,
    billable_class: draft.billableClass || undefined,
    description: draft.description.trim() || undefined,
    after_hours: start ? undefined : draft.afterHours || undefined,
    performed_start: start || undefined,
  };
}

export interface LogTimeFormProps {
  catalogs: DeskCatalogs;
  onSubmit: (body: LogTimeBody) => Promise<void>;
  pending?: boolean;
  /** The class the form opens on, where something other than the activity decides it (a bucket, TB-12). */
  billableClass?: string;
}

/** The compact Log time form (Time & Budget 5.2): minutes with quick chips, date, start time, activity with the class defaulted. */
export function LogTimeForm({ catalogs, onSubmit, pending, billableClass }: LogTimeFormProps) {
  const [draft, setDraft] = useState<LogTimeDraft>(() => emptyDraft(catalogs, billableClass));
  const [error, setError] = useState<string | null>(null);
  const [seenLoaded, setSeenLoaded] = useState(catalogs.loaded);
  const [seenClass, setSeenClass] = useState(billableClass);
  // Once the real catalog lands, re-default the activity and class from it.
  if (seenLoaded !== catalogs.loaded) {
    setSeenLoaded(catalogs.loaded);
    if (!draft.minutes && !draft.description) setDraft(emptyDraft(catalogs, billableClass));
  }
  // A different bucket carries a different class, so an untouched form takes it.
  if (seenClass !== billableClass) {
    setSeenClass(billableClass);
    if (!draft.minutes && !draft.description) setDraft(emptyDraft(catalogs, billableClass));
  }

  const chooseActivity = (key: string) => {
    const activity = catalogs.activityTypes.find((entry) => entry.key === key);
    setDraft({ ...draft, activityType: key, billableClass: activity?.billableClass ?? draft.billableClass });
  };
  const hasStart = draft.performedStart.trim() !== "";

  return (
    <form
      aria-label="Log time"
      className="flex flex-col gap-3 text-[12px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const problem = validateDraft(draft);
        setError(problem);
        if (problem) return;
        try {
          await onSubmit(toLogTimeBody(draft));
          setDraft({ ...emptyDraft(catalogs, billableClass), performedOn: draft.performedOn });
        } catch (caught) {
          const parsed = apiError(caught);
          setError(
            overageBlockedMessage(caught) ??
              (parsed.code === "billing_period_locked"
                ? "That date is inside a locked billing period."
                : parsed.code === "future_date"
                  ? "The date cannot be in the future."
                  : parsed.code === "ticket_closed"
                    ? "The ticket is closed; time stays reportable but cannot be added."
                    : parsed.code === "bucket_retired"
                      ? "That bucket has been retired, so no more time can be logged against it."
                      : describeError(parsed)),
          );
        }
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Minutes</span>
          <input
            aria-label="Minutes"
            inputMode="numeric"
            value={draft.minutes}
            onChange={(event) => setDraft({ ...draft, minutes: event.target.value })}
            className={`${INPUT} xms-mono w-[90px]`}
          />
        </label>
        <div className="flex gap-1" role="group" aria-label="Quick minutes">
          {QUICK_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setDraft({ ...draft, minutes: String(minutes) })}
              className={cn(
                "border-xms-line h-[28px] rounded-[999px] border px-2 text-[12px]",
                draft.minutes === String(minutes)
                  ? "bg-xms-accent border-xms-accent text-white"
                  : "text-xms-body hover:bg-xms-tint",
              )}
            >
              {formatMinutes(minutes)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Date</span>
          <input
            aria-label="Date performed"
            type="date"
            max={today()}
            value={draft.performedOn}
            onChange={(event) => setDraft({ ...draft, performedOn: event.target.value })}
            className={`${INPUT} xms-mono w-[150px]`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Start time</span>
          <input
            aria-label="Start time"
            type="time"
            step={60}
            placeholder="HH:MM"
            value={draft.performedStart}
            onChange={(event) => setDraft({ ...draft, performedStart: event.target.value })}
            className={`${INPUT} xms-mono w-[110px]`}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Activity</span>
          <select
            aria-label="Activity"
            value={draft.activityType}
            onChange={(event) => chooseActivity(event.target.value)}
            className={`${INPUT} w-[220px]`}
          >
            {catalogs.activityTypes.map((activity) => (
              <option key={activity.key} value={activity.key}>
                {activity.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Billable class</span>
          <select
            aria-label="Billable class"
            value={draft.billableClass}
            onChange={(event) => setDraft({ ...draft, billableClass: event.target.value })}
            className={`${INPUT} w-[170px]`}
          >
            {catalogs.billableClasses.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {hasStart ? (
          <p className="text-xms-label pb-2" data-after-hours-note>
            The account calendar decides the after-hours class from the start time.
          </p>
        ) : (
          <label className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              aria-label="I did this work after hours"
              checked={draft.afterHours}
              onChange={(event) => setDraft({ ...draft, afterHours: event.target.checked })}
            />
            <span className="text-xms-ink">I did this work after hours</span>
          </label>
        )}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xms-label">Description</span>
        <input
          aria-label="Description"
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          placeholder="What was done"
          className={INPUT}
        />
      </label>
      {error ? (
        <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          Log time
        </button>
      </div>
    </form>
  );
}

/** Decimal hours, as render 04 reads them: 3.25, 1.00, 0.50, 2.00. */
export function decimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

function EntryRow({ entry, catalogs, rule }: { entry: TimeEntry; catalogs: DeskCatalogs; rule?: HandlingRule | null }) {
  const adjusted = entry.adjusted_minutes ?? entry.minutes;
  const changed = adjusted !== entry.minutes;
  const activity =
    catalogs.activityTypes.find((item) => item.key === entry.activity_type)?.label ?? entry.activity_type;
  const billable =
    catalogs.billableClasses.find((item) => item.key === entry.billable_class)?.label ?? entry.billable_class;
  const start = startTimeLabel(entry.performed_start);
  return (
    // Render 04's row: who, what, the class as a pill, the hours in mono on
    // the right. The date is a quiet mono suffix on the name, because a
    // timesheet entry without its day cannot be checked, and the description
    // continues the activity, which is how the render's own rows read
    // ("Rework, linked adjustment").
    <li
      className="border-xms-line-row flex items-center gap-3 border-b px-[14px] py-3 last:border-b-0"
      data-entry={entry.id}
    >
      <span className="flex w-[150px] shrink-0 items-baseline gap-2">
        <span className="text-xms-ink truncate text-[13px] font-medium">{entry.person_name}</span>
        <span className="xms-mono text-xms-muted shrink-0 text-[11px]" data-performed-on>
          {entry.performed_on.slice(5)}
          {start ? <span data-start>{` ${start}`}</span> : null}
        </span>
      </span>
      <span className="text-xms-body min-w-0 flex-1 truncate text-[13px]">
        {activity}
        {entry.description ? (
          <>
            {", "}
            <span className="text-xms-muted">{entry.description}</span>
          </>
        ) : null}
      </span>
      <AfterHoursBadge entry={entry} rule={rule} className="inline-flex shrink-0 items-center gap-1.5" />
      {entry.over_budget ? (
        <span className="shrink-0" data-over-budget>
          <OverBudgetPill entry={entry} />
        </span>
      ) : null}
      <span className="text-xms-muted shrink-0 text-[12px]">
        <EntryAmount entry={entry} />
      </span>
      <span className="xms-chip-pill shrink-0">{billable}</span>
      <span className="xms-mono text-xms-ink w-[56px] shrink-0 text-right text-[13px] font-semibold">
        {changed ? (
          <>
            <span className="text-xms-muted line-through">{decimalHours(entry.minutes)}</span>{" "}
            <span data-adjusted>{decimalHours(adjusted)}</span>
          </>
        ) : (
          decimalHours(entry.minutes)
        )}
      </span>
    </li>
  );
}

/**
 * The Time tab (render 04): a card headed "Time on this ticket" with the
 * entries under it and their total at the foot, and an Add entry control that
 * opens the log form.
 *
 * The form used to stand open above the list, permanently, so the tab opened
 * on eight fields and a row of chips and the entries it was about were below
 * the fold. Render 04 opens on the entries; logging is a thing you go and do.
 * Every field the form had is still in it, because each one maps to the API.
 */
export function TimeTab({
  ticketKey,
  catalogs,
  readOnly,
  accountId,
  contractId,
}: {
  ticketKey: string;
  catalogs: DeskCatalogs;
  readOnly?: boolean;
  accountId?: string;
  contractId?: string;
}) {
  const { data, isLoading } = useTicketTimeQuery(ticketKey);
  const me = useMe();
  // The contracts route is behind contracts:view, which a consultant logging
  // time does not hold; without it the after-hours badge shows the class
  // alone rather than the contract's handling, and nothing is asked for.
  const canReadContracts = me.hasPermission("contracts:view");
  const contracts = useListAccountContractsQuery(accountId ?? "", { skip: !accountId || !canReadContracts });
  const rule = contracts.data?.find((contract) => contract.id === contractId) ?? null;
  const [log, logging] = useLogTicketTimeMutation();
  const { push } = useToast();
  const track = useTrack("time.log");
  const canLog = me.hasPermission("time:log") && !readOnly;
  const [adding, setAdding] = useState(false);

  // "shortcut t · under five seconds to log" (render 04). It is ignored while
  // the reader is typing, so t in the reply box is still a letter.
  useEffect(() => {
    if (!canLog) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "t") {
        event.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canLog]);

  const submit = async (body: LogTimeBody) => {
    const entry = await log({ ticketKey, body }).unwrap();
    track({ minutes: entry.minutes, activity: entry.activity_type, after_hours_class: entry.after_hours_class });
    push({ title: `${formatMinutes(entry.minutes)} logged on ${ticketKey}`, tone: "success" });
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="xms-card overflow-hidden" aria-label="Time on this ticket">
        <header className="border-xms-line bg-xms-quiet-bg flex items-center gap-[10px] border-b px-[14px] py-[13px]">
          <h3 className="text-xms-ink text-[14px] leading-[1.3] font-semibold">Time on this ticket</h3>
          {canLog ? (
            <span className="text-xms-muted text-[12px] leading-none">shortcut t · under five seconds to log</span>
          ) : null}
          <span className="flex-1" />
          {canLog ? (
            <button type="button" onClick={() => setAdding(true)} className={PRIMARY_BUTTON}>
              Add entry
            </button>
          ) : null}
        </header>
        {isLoading || !data ? (
          <div className="p-[14px]">
            <Skeleton lines={3} />
          </div>
        ) : (
          <>
            <ul aria-label="Time entries">
              {data.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} catalogs={catalogs} rule={rule} />
              ))}
            </ul>
            {data.entries.length === 0 ? (
              <p className="text-xms-label px-[14px] py-6 text-center text-[13px]">
                No time logged on this ticket yet.
              </p>
            ) : (
              <div className="bg-xms-quiet-bg flex items-center px-[14px] py-[13px]">
                <span className="text-xms-ink flex-1 text-[13px] font-semibold">Total</span>
                <span className="xms-mono text-xms-ink text-[13px] font-semibold" data-testid="time-total">
                  {`${decimalHours(data.total_minutes)} h`}
                </span>
              </div>
            )}
          </>
        )}
      </section>
      {adding ? (
        <div className="bg-xms-overlay-scrim fixed inset-0 z-40 flex items-start justify-center overflow-auto p-6">
          <div role="dialog" aria-modal="true" aria-label="Log time" className="xms-card w-full max-w-[640px] p-4">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-xms-ink flex-1 text-[15px] font-semibold">{`Log time on ${ticketKey}`}</h3>
              <button
                type="button"
                onClick={() => setAdding(false)}
                aria-label="Close"
                className="text-xms-label hover:text-xms-ink"
              >
                <CloseIcon size={ICON.tool} />
              </button>
            </div>
            <LogTimeForm catalogs={catalogs} pending={logging.isLoading} onSubmit={submit} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
