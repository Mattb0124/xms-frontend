"use client";

import { useState } from "react";
import { INPUT, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { ticketKeyOf } from "@/components/time/timesheet";
import { KeyLink } from "@/components/xms/key-link";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import type { DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { formatAmount, formatHours } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { useBudgetEntriesQuery, type BudgetContractSummary, type BudgetPeriod } from "@/redux/timeApi";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface BudgetEntriesListProps {
  accountId: string;
  contract: BudgetContractSummary;
  period: BudgetPeriod;
  catalogs: DeskCatalogs;
}

/**
 * The drill-through under a budget card (Time & Budget 5.5): the entries
 * behind the consumed figure, filtered by person, activity and billable
 * class over a date range that defaults to the period, with the server's
 * total minutes and amount. The filters travel to the API; nothing is
 * filtered in the browser. Export waits for an export route.
 */
export function BudgetEntriesList({ accountId, contract, period, catalogs }: BudgetEntriesListProps) {
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [activity, setActivity] = useState("");
  const [billableClass, setBillableClass] = useState("");
  const [from, setFrom] = useState(period.starts_on);
  const [to, setTo] = useState(period.ends_on);
  const valid = DATE.test(from) && DATE.test(to) && from <= to;
  const { data, isLoading, isError } = useBudgetEntriesQuery(
    {
      accountId,
      contract: contract.id,
      person: person?.id,
      activity: activity || undefined,
      class: billableClass || undefined,
      from,
      to,
    },
    { skip: !valid },
  );

  // The people to pick from: whoever appears in the current list, plus the one already chosen.
  const people = new Map<string, string>();
  if (person) people.set(person.id, person.name);
  for (const entry of data?.entries ?? []) if (entry.person_id) people.set(entry.person_id, entry.person_name);

  const select = cn(INPUT, "h-[28px] text-[12px]");

  return (
    <div className="border-xms-line flex flex-col gap-3 border-t pt-3" data-testid="budget-entries">
      <div className="flex flex-wrap items-end gap-2 text-[12px]" role="group" aria-label="Entry filters">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Person</span>
          <select
            aria-label="Person"
            className={cn(select, "w-[160px]")}
            value={person?.id ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              setPerson(id ? { id, name: people.get(id) ?? id } : null);
            }}
          >
            <option value="">All people</option>
            {[...people.entries()].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Activity</span>
          <select
            aria-label="Activity"
            className={cn(select, "w-[180px]")}
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
          >
            <option value="">All activities</option>
            {catalogs.activityTypes.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Billable class</span>
          <select
            aria-label="Billable class"
            className={cn(select, "w-[150px]")}
            value={billableClass}
            onChange={(event) => setBillableClass(event.target.value)}
          >
            <option value="">All classes</option>
            {catalogs.billableClasses.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">From</span>
          <input
            aria-label="Entries from"
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className={cn(select, "xms-mono w-[140px]")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">To</span>
          <input
            aria-label="Entries to"
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className={cn(select, "xms-mono w-[140px]")}
          />
        </label>
        <button
          type="button"
          className={cn(SECONDARY_BUTTON, "ml-auto h-[28px] text-[12px]")}
          disabled
          title="Export is not available yet; the export route is still to come."
        >
          Export
        </button>
      </div>
      {!valid ? <p className="text-xms-label text-[12px]">Choose a range where From is not after To.</p> : null}
      {isLoading && !data ? <Skeleton lines={3} /> : null}
      {isError ? <p className="text-xms-muted text-[12px]">The entries could not be loaded.</p> : null}
      {data ? (
        <div className="overflow-auto">
          <table className="w-full border-collapse text-[13px]" aria-label={`Entries on ${contract.key}`}>
            <thead>
              <tr className="border-xms-line text-xms-ink border-b text-left text-[12px] font-semibold">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Ticket or bucket</th>
                <th className="px-3 py-2">Activity</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => {
                const key = ticketKeyOf(entry.ticket_number);
                const activityLabel =
                  catalogs.activityTypes.find((item) => item.key === entry.activity_type)?.label ?? entry.activity_type;
                const classLabel =
                  catalogs.billableClasses.find((item) => item.key === entry.billable_class)?.label ??
                  entry.billable_class;
                return (
                  <tr
                    key={entry.id}
                    className="border-xms-line hover:bg-xms-row-hover h-[36px] border-b"
                    data-entry={entry.id}
                  >
                    <td className="xms-mono text-xms-ink px-3">{entry.performed_on}</td>
                    <td className="text-xms-ink px-3">{entry.person_name}</td>
                    <td className="px-3">
                      {key ? (
                        <KeyLink ticketKey={key} />
                      ) : (
                        <span className="text-xms-ink">{entry.bucket_label ?? "Bucket"}</span>
                      )}
                    </td>
                    <td className="text-xms-ink px-3">{activityLabel}</td>
                    <td className="text-xms-body px-3">
                      {classLabel}
                      {entry.over_budget ? (
                        <span className="ml-2 inline-flex">
                          <SignalPill tone="overdue" label="Over budget" />
                        </span>
                      ) : null}
                    </td>
                    <td className="xms-mono text-xms-ink px-3 text-right">
                      {formatHours(entry.adjusted_minutes ?? entry.minutes)}
                    </td>
                    <td className="xms-mono text-xms-body px-3 text-right text-[12px]" data-amount>
                      {entry.amount === null ? (
                        <span className="text-xms-muted">unrated</span>
                      ) : (
                        formatAmount(entry.amount, contract.currency)
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-xms-label px-3 py-4 text-center">
                    No entries match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="text-xms-ink text-[12px] font-semibold">
                <td colSpan={5} className="px-3 py-2">
                  Total
                </td>
                <td className="xms-mono px-3 py-2 text-right" data-testid="entries-total-hours">
                  {formatHours(data.total_minutes)}
                </td>
                <td className="xms-mono px-3 py-2 text-right" data-testid="entries-total-amount">
                  {formatAmount(data.total_amount, contract.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}
