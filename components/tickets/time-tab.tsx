"use client";

import { useState } from "react";
import { INPUT, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
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
  minutes: string;
  activityType: string;
  billableClass: string;
  description: string;
  afterHours: boolean;
}

export function emptyDraft(catalogs: DeskCatalogs): LogTimeDraft {
  const first = catalogs.activityTypes[0];
  return {
    performedOn: today(),
    minutes: "",
    activityType: first?.key ?? "",
    billableClass: first?.billableClass ?? "",
    description: "",
    afterHours: false,
  };
}

export function validateDraft(draft: LogTimeDraft): string | null {
  const minutes = Number(draft.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0) return "Minutes must be a whole number above zero.";
  if (minutes > 1440) return "One entry cannot exceed a day.";
  if (draft.performedOn > today()) return "The date cannot be in the future.";
  if (!draft.activityType) return "Choose an activity.";
  return null;
}

export function toLogTimeBody(draft: LogTimeDraft): LogTimeBody {
  return {
    performed_on: draft.performedOn,
    minutes: Number(draft.minutes),
    activity_type: draft.activityType,
    billable_class: draft.billableClass || undefined,
    description: draft.description.trim() || undefined,
    after_hours: draft.afterHours || undefined,
  };
}

export interface LogTimeFormProps {
  catalogs: DeskCatalogs;
  onSubmit: (body: LogTimeBody) => Promise<void>;
  pending?: boolean;
}

/** The compact Log time form (Time & Budget 5.2): minutes with quick chips, date, activity with the class defaulted. */
export function LogTimeForm({ catalogs, onSubmit, pending }: LogTimeFormProps) {
  const [draft, setDraft] = useState<LogTimeDraft>(() => emptyDraft(catalogs));
  const [error, setError] = useState<string | null>(null);
  const [seenLoaded, setSeenLoaded] = useState(catalogs.loaded);
  // Once the real catalog lands, re-default the activity and class from it.
  if (seenLoaded !== catalogs.loaded) {
    setSeenLoaded(catalogs.loaded);
    if (!draft.minutes && !draft.description) setDraft(emptyDraft(catalogs));
  }

  const chooseActivity = (key: string) => {
    const activity = catalogs.activityTypes.find((entry) => entry.key === key);
    setDraft({ ...draft, activityType: key, billableClass: activity?.billableClass ?? draft.billableClass });
  };

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
          setDraft({ ...emptyDraft(catalogs), performedOn: draft.performedOn });
        } catch (caught) {
          const parsed = apiError(caught);
          setError(
            parsed.code === "billing_period_locked"
              ? "That date is inside a locked billing period."
              : parsed.code === "future_date"
                ? "The date cannot be in the future."
                : parsed.code === "ticket_closed"
                  ? "The ticket is closed; time stays reportable but cannot be added."
                  : describeError(parsed),
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
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            aria-label="After hours"
            checked={draft.afterHours}
            onChange={(event) => setDraft({ ...draft, afterHours: event.target.checked })}
          />
          <span className="text-xms-ink">After hours</span>
        </label>
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

function EntryRow({ entry, catalogs }: { entry: TimeEntry; catalogs: DeskCatalogs }) {
  const adjusted = entry.adjusted_minutes ?? entry.minutes;
  const changed = adjusted !== entry.minutes;
  const activity =
    catalogs.activityTypes.find((item) => item.key === entry.activity_type)?.label ?? entry.activity_type;
  const billable =
    catalogs.billableClasses.find((item) => item.key === entry.billable_class)?.label ?? entry.billable_class;
  return (
    <tr className="border-xms-line hover:bg-xms-row-hover h-[40px] border-b" data-entry={entry.id}>
      <td className="xms-mono text-xms-ink px-3">{entry.performed_on}</td>
      <td className="text-xms-ink px-3">{entry.person_name}</td>
      <td className="text-xms-ink px-3">{activity}</td>
      <td className="text-xms-body px-3">{billable}</td>
      <td className="xms-mono px-3 text-right">
        {changed ? (
          <>
            <span className="text-xms-muted line-through">{formatMinutes(entry.minutes)}</span>{" "}
            <span className="text-xms-ink" data-adjusted>
              {formatMinutes(adjusted)}
            </span>
          </>
        ) : (
          <span className="text-xms-ink">{formatMinutes(entry.minutes)}</span>
        )}
      </td>
      <td className="text-xms-body max-w-[280px] truncate px-3">
        {entry.after_hours ? <span className="text-xms-label mr-1 text-[11px]">After hours</span> : null}
        {entry.description}
      </td>
    </tr>
  );
}

/** The Time tab: the entries with adjustments, the total, and the Log time form. */
export function TimeTab({
  ticketKey,
  catalogs,
  readOnly,
}: {
  ticketKey: string;
  catalogs: DeskCatalogs;
  readOnly?: boolean;
}) {
  const { data, isLoading } = useTicketTimeQuery(ticketKey);
  const [log, logging] = useLogTicketTimeMutation();
  const me = useMe();
  const { push } = useToast();
  const track = useTrack("time.log");
  const canLog = me.hasPermission("time:log");

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && canLog ? (
        <LogTimeForm
          catalogs={catalogs}
          pending={logging.isLoading}
          onSubmit={async (body) => {
            const entry = await log({ ticketKey, body }).unwrap();
            track({ minutes: entry.minutes, activity: entry.activity_type });
            push({ title: `${formatMinutes(entry.minutes)} logged on ${ticketKey}`, tone: "success" });
          }}
        />
      ) : null}
      {isLoading || !data ? (
        <Skeleton lines={3} />
      ) : (
        <div className="overflow-auto">
          <table className="w-full border-collapse text-[13px]" aria-label="Time entries">
            <thead>
              <tr className="border-xms-line text-xms-ink border-b text-left text-[12px] font-semibold">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Activity</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2 text-right">Minutes</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} catalogs={catalogs} />
              ))}
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-xms-label px-3 py-4 text-center">
                    No time logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="text-xms-ink text-[12px] font-semibold">
                <td colSpan={4} className="px-3 py-2">
                  Total
                </td>
                <td className="xms-mono px-3 py-2 text-right" data-testid="time-total">
                  {formatMinutes(data.total_minutes)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
