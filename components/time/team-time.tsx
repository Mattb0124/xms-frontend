"use client";

import { useMemo, useState } from "react";
import { formatDay } from "@/lib/format/date";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect } from "@/components/xms/filter-select";
import { KeyLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useListArrangement } from "@/components/xms/use-list-arrangement";
import { useMe } from "@/redux/me";
import { useTeamTimeQuery, type TimeEntry } from "@/redux/timeApi";

type TeamEntry = TimeEntry & { person_role?: string | null };

/** The windows a lead reads team time over, and the days each one spans. */
export const WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

/** The window as two dates, counting back from today inclusive. */
export function windowDates(days: number, today: Date = new Date()): { from: string; to: string } {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/** The minutes an entry actually counts for, after any adjustment. */
export function countedMinutes(entry: TeamEntry): number {
  return entry.adjusted_minutes ?? entry.minutes;
}

export function hours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

/** Total per person, most hours first, so a lead reads the week top down. */
export function perPerson(entries: readonly TeamEntry[]): { name: string; minutes: number; entries: number }[] {
  const totals = new Map<string, { name: string; minutes: number; entries: number }>();
  for (const entry of entries) {
    const row = totals.get(entry.person_name) ?? { name: entry.person_name, minutes: 0, entries: 0 };
    row.minutes += countedMinutes(entry);
    row.entries += 1;
    totals.set(entry.person_name, row);
  }
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
}

/**
 * Team time (P2.18): every entry in the window by anyone who shares an
 * assignment group with the reader.
 *
 * The route registry has always named this screen and nothing served it, so
 * "Team time" stood in the finder as a dead link and a lead correcting a
 * colleague's entry had to find it through the account.
 *
 * The group is the server's answer, not a filter here: "across your group"
 * is a fact about who is reading. It is answered to `time:adjust`, because
 * the reason to read a colleague's time is to correct it.
 */
export function TeamTime() {
  const me = useMe();
  const allowed = me.hasPermission("time:adjust");
  const [days, setDays] = useState("7");
  const window = useMemo(() => windowDates(Number(days)), [days]);
  const { data, isLoading, isError } = useTeamTimeQuery(window, { skip: !allowed });

  const authored: DenseColumn<TeamEntry>[] = useMemo(
    () => [
      { key: "person", title: "Person", width: "180px", sortValue: (row) => row.person_name },
      {
        key: "day",
        title: "Day",
        width: "120px",
        mono: true,
        sortValue: (row) => row.performed_on,
        render: (row) => formatDay(row.performed_on),
      },
      {
        key: "against",
        title: "Against",
        sortValue: (row) => row.ticket_number ?? row.bucket_label ?? "",
        render: (row) =>
          row.ticket_number ? (
            <KeyLink
              ticketKey={`CS${row.ticket_number.padStart(7, "0")}`}
              href={`/cases/CS${row.ticket_number.padStart(7, "0")}`}
            />
          ) : (
            (row.bucket_label ?? "")
          ),
      },
      { key: "activity", title: "Activity", width: "150px", sortValue: (row) => row.activity_type },
      { key: "class", title: "Billable", width: "130px", sortValue: (row) => row.billable_class },
      { key: "description", title: "Description", wrap: true, render: (row) => row.description },
      {
        key: "minutes",
        title: "Hours",
        width: "100px",
        align: "right",
        mono: true,
        sortValue: (row) => countedMinutes(row),
        render: (row) => (
          <span title={row.adjusted_minutes != null ? `Logged ${hours(row.minutes)}, adjusted` : undefined}>
            {hours(countedMinutes(row))}
          </span>
        ),
      },
    ],
    [],
  );

  const arrangement = useListArrangement("team-time", authored);
  const entries = useMemo(() => data ?? [], [data]);
  const totals = useMemo(() => perPerson(entries), [entries]);
  const all = totals.reduce((sum, row) => sum + row.minutes, 0);

  if (!allowed) {
    return (
      <EmptyBanner
        title="Not permitted"
        detail="Team time needs the time:adjust permission, which is what correcting a colleague's entry stands on."
      />
    );
  }

  if (isLoading && !data) return <Skeleton lines={8} />;
  if (isError) return <EmptyBanner title="Team time could not be read" detail="Try again in a moment." />;

  return (
    <div className="flex flex-col gap-4">
      <HeaderFilters>
        <FilterSelect label="Show" primary count={entries.length} value={days} options={WINDOWS} onChange={setDays} />
      </HeaderFilters>

      {totals.length > 0 ? (
        <Panel
          title="Who logged what"
          subtitle={`${hours(all)} across ${totals.length} people, ${window.from} to ${window.to}.`}
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
            {totals.map((row) => (
              <li key={row.name} className="text-xms-ink flex items-baseline gap-2">
                <span>{row.name}</span>
                <span className="xms-mono text-xms-body tabular-nums">{hours(row.minutes)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <DenseTable<TeamEntry>
        title="Team time"
        columns={arrangement.columns}
        display={arrangement.display}
        rows={entries}
        rowKey={(row) => row.id}
        defaultSort={{ key: "day", direction: "desc" }}
        emptyState="Nobody in your group logged time in this window. A person with no roster group sees only their own."
      />
      {arrangement.dialogue}
    </div>
  );
}
