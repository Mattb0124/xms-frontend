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
import {
  useBudgetEntriesQuery,
  type BudgetContractSummary,
  type BudgetEntries,
  type BudgetEntry,
  type BudgetPeriod,
} from "@/redux/timeApi";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FILTER_CONTROL = cn(INPUT, "h-[28px] text-body");

export interface BudgetEntriesListProps {
  accountId: string;
  contract: BudgetContractSummary;
  period: BudgetPeriod;
  catalogs: DeskCatalogs;
}

interface EntryFilter {
  person: { id: string; name: string } | null;
  activity: string;
  billableClass: string;
  from: string;
  to: string;
}

function isRange(from: string, to: string): boolean {
  return DATE.test(from) && DATE.test(to) && from <= to;
}

/** The people to pick from: whoever appears in the current list, plus the one already chosen. */
function pickablePeople(chosen: EntryFilter["person"], entries: BudgetEntry[]): Map<string, string> {
  const people = new Map<string, string>();
  if (chosen) people.set(chosen.id, chosen.name);
  for (const entry of entries) if (entry.person_id) people.set(entry.person_id, entry.person_name);
  return people;
}

export interface LabeledSelectProps {
  label: string;
  /** The empty choice, which sends no filter. */
  allLabel: string;
  width: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function LabeledSelect({ label, allLabel, width, value, options, onChange }: LabeledSelectProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xms-label">{label}</span>
      <select
        aria-label={label}
        className={cn(FILTER_CONTROL, width)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface EntryFiltersProps {
  filter: EntryFilter;
  /** Person id to name. */
  people: Map<string, string>;
  catalogs: DeskCatalogs;
  onChange: (patch: Partial<EntryFilter>) => void;
}

function EntryFilters({ filter, people, catalogs, onChange }: EntryFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-2 text-body" role="group" aria-label="Entry filters">
      <LabeledSelect
        label="Person"
        allLabel="All people"
        width="w-[160px]"
        value={filter.person?.id ?? ""}
        options={[...people.entries()].map(([id, name]) => ({ value: id, label: name }))}
        onChange={(id) => onChange({ person: id ? { id, name: people.get(id) ?? id } : null })}
      />
      <LabeledSelect
        label="Activity"
        allLabel="All activities"
        width="w-[180px]"
        value={filter.activity}
        options={catalogs.activityTypes.map((item) => ({ value: item.key, label: item.label }))}
        onChange={(activity) => onChange({ activity })}
      />
      <LabeledSelect
        label="Billable class"
        allLabel="All classes"
        width="w-[150px]"
        value={filter.billableClass}
        options={catalogs.billableClasses.map((item) => ({ value: item.key, label: item.label }))}
        onChange={(billableClass) => onChange({ billableClass })}
      />
      <label className="flex flex-col gap-1">
        <span className="text-xms-label">From</span>
        <input
          aria-label="Entries from"
          type="date"
          value={filter.from}
          max={filter.to}
          onChange={(event) => onChange({ from: event.target.value })}
          className={cn(FILTER_CONTROL, "xms-mono w-[140px]")}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xms-label">To</span>
        <input
          aria-label="Entries to"
          type="date"
          value={filter.to}
          min={filter.from}
          onChange={(event) => onChange({ to: event.target.value })}
          className={cn(FILTER_CONTROL, "xms-mono w-[140px]")}
        />
      </label>
      <button
        type="button"
        className={cn(SECONDARY_BUTTON, "ml-auto h-[28px] text-body")}
        disabled
        title="Export is not available yet; the export route is still to come."
      >
        Export
      </button>
    </div>
  );
}

export interface EntryRowProps {
  entry: BudgetEntry;
  currency: string;
  catalogs: DeskCatalogs;
}

function EntryRow({ entry, currency, catalogs }: EntryRowProps) {
  const key = ticketKeyOf(entry.ticket_number);
  const activityLabel =
    catalogs.activityTypes.find((item) => item.key === entry.activity_type)?.label ?? entry.activity_type;
  const classLabel =
    catalogs.billableClasses.find((item) => item.key === entry.billable_class)?.label ?? entry.billable_class;
  return (
    <tr className="border-xms-line hover:bg-xms-row-hover h-[36px] border-b" data-entry={entry.id}>
      <td className="xms-mono text-xms-ink px-3">{entry.performed_on}</td>
      <td className="text-xms-ink px-3">{entry.person_name}</td>
      <td className="px-3">
        {key ? <KeyLink ticketKey={key} /> : <span className="text-xms-ink">{entry.bucket_label ?? "Bucket"}</span>}
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
      <td className="xms-mono text-xms-ink px-3 text-right">{formatHours(entry.adjusted_minutes ?? entry.minutes)}</td>
      <td className="xms-mono text-xms-body px-3 text-right text-body" data-amount>
        {entry.amount === null ? <span className="text-xms-muted">unrated</span> : formatAmount(entry.amount, currency)}
      </td>
    </tr>
  );
}

export interface EntriesTableProps {
  data: BudgetEntries;
  contract: BudgetContractSummary;
  catalogs: DeskCatalogs;
}

function EntriesTable({ data, contract, catalogs }: EntriesTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-body" aria-label={`Entries on ${contract.key}`}>
        <thead>
          <tr className="border-xms-line text-xms-ink border-b text-left text-body font-semibold">
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
          {data.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} currency={contract.currency} catalogs={catalogs} />
          ))}
          {data.entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-xms-label px-3 py-4 text-center">
                No entries match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="text-xms-ink text-body font-semibold">
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
  );
}

/**
 * The drill-through under a budget card (Time & Budget 5.5): the entries
 * behind the consumed figure, filtered by person, activity and billable
 * class over a date range that defaults to the period, with the server's
 * total minutes and amount. The filters travel to the API; nothing is
 * filtered in the browser. Export waits for an export route.
 */
export function BudgetEntriesList({ accountId, contract, period, catalogs }: BudgetEntriesListProps) {
  const [filter, setFilter] = useState<EntryFilter>(() => ({
    person: null,
    activity: "",
    billableClass: "",
    from: period.starts_on,
    to: period.ends_on,
  }));
  const valid = isRange(filter.from, filter.to);
  const { data, isLoading, isError } = useBudgetEntriesQuery(
    {
      accountId,
      contract: contract.id,
      person: filter.person?.id,
      activity: filter.activity || undefined,
      class: filter.billableClass || undefined,
      from: filter.from,
      to: filter.to,
    },
    { skip: !valid },
  );
  const people = pickablePeople(filter.person, data?.entries ?? []);

  return (
    <div className="border-xms-line flex flex-col gap-3 border-t pt-3" data-testid="budget-entries">
      <EntryFilters
        filter={filter}
        people={people}
        catalogs={catalogs}
        onChange={(patch) => setFilter((current) => ({ ...current, ...patch }))}
      />
      {!valid ? <p className="text-xms-label text-body">Choose a range where From is not after To.</p> : null}
      {isLoading && !data ? <Skeleton lines={3} /> : null}
      {isError ? <p className="text-xms-muted text-body">The entries could not be loaded.</p> : null}
      {data ? <EntriesTable data={data} contract={contract} catalogs={catalogs} /> : null}
    </div>
  );
}
