"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { AdminGate, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { CapacityTabs } from "@/components/capacity/capacity-tabs";
import { MonthSelect } from "@/components/xms/month-select";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect } from "@/components/xms/filter-select";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { varianceFilterFromSearch, varianceFilterToSearch, type VariancePageFilter } from "@/lib/capacity/filters";
import { formatSignedHours, formatVariancePercent, monthLabel } from "@/lib/capacity/vocab";
import { formatHours } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { useCapacityVarianceQuery, type VarianceLine } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListPeopleQuery } from "@/redux/rosterApi";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

// The shared table measures: 11px above and below in the header, 13 by 14 in
// a cell (hand-off section 4).
const HEAD = "text-xms-ink px-[14px] py-[11px] text-left text-[14px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-[14px] py-[13px] align-middle whitespace-nowrap";

/** Largest variances first (functional 5.6), by absolute hours; ties by name. */
export function sortByVariance(lines: VarianceLine[]): VarianceLine[] {
  return [...lines].sort(
    (a, b) =>
      Math.abs(b.variance_minutes) - Math.abs(a.variance_minutes) || a.display_name.localeCompare(b.display_name),
  );
}

/** The tone of a variance cell: ink within 10 percent, amber beyond, red past 25 percent or with nothing planned. */
export function varianceTone(
  line: Pick<VarianceLine, "variance_ratio" | "variance_minutes">,
): "calm" | "warn" | "breach" {
  if (line.variance_minutes === 0) return "calm";
  if (line.variance_ratio === null) return "breach";
  const size = Math.abs(line.variance_ratio);
  if (size > 0.25) return "breach";
  if (size > 0.1) return "warn";
  return "calm";
}

const TONE: Record<ReturnType<typeof varianceTone>, string> = {
  calm: "",
  warn: "text-[color:var(--state-needs-input-text)]",
  breach: "text-[color:var(--state-overdue-text)]",
};

function VarianceScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const searchString = search.toString();
  const filter = useMemo(() => varianceFilterFromSearch(new URLSearchParams(searchString)), [searchString]);
  const canDirectory = me.hasPermission("tickets:view");
  const report = useCapacityVarianceQuery(filter);
  const accounts = useListGrantedAccountsQuery(undefined, { skip: !canDirectory });
  const people = useListPeopleQuery({ active: "true" });
  const lines = useMemo(() => sortByVariance(report.data?.lines ?? []), [report.data]);

  const apply = (next: VariancePageFilter) => router.replace(`${pathname}${varianceFilterToSearch(next)}`);
  const accountKey = (id: string) => accounts.data?.find((row) => row.id === id)?.key ?? id.slice(0, 8);
  const accountName = (id: string) => {
    const account = accounts.data?.find((row) => row.id === id);
    return account ? `${account.key} ${account.name}` : id.slice(0, 8);
  };
  return (
    <>
      {/* The three dimensions stand on the grey strip, where the strip used to
          carry a Month pill that did nothing and chips for whatever was set,
          while the controls that set them were a row of labelled selects in
          the page body. */}
      <HeaderFilters>
        <MonthSelect primary month={filter.month} onChange={(month) => apply({ ...filter, month })} />
        <FilterSelect
          label="Account"
          value={filter.account ?? ""}
          options={(accounts.data ?? []).map((account) => ({
            value: account.id,
            label: `${account.key} ${account.name}`,
          }))}
          onChange={(value) => apply({ ...filter, account: value || undefined })}
        />
        <FilterSelect
          label="Person"
          value={filter.person ?? ""}
          options={(people.data ?? []).map((person) => ({ value: person.id, label: person.display_name }))}
          onChange={(value) => apply({ ...filter, person: value || undefined })}
        />
      </HeaderFilters>
      <HeaderAction>
        <button type="button" className={SECONDARY_BUTTON} disabled title="Export waits for an export route.">
          Export
        </button>
      </HeaderAction>
      <CapacityTabs active="variance" search={varianceFilterToSearch({ month: filter.month })} />
      <div className="flex flex-col gap-4">
        {report.isLoading && !report.data ? <Skeleton lines={8} /> : null}
        {report.isError ? (
          <EmptyBanner
            title="The report could not be loaded"
            detail="Check the month and that you are granted the accounts involved."
            action={{ label: "Retry", onClick: () => void report.refetch() }}
          />
        ) : null}
        {report.data ? (
          <Panel
            title="Planned versus actual"
            caption={`${monthLabel(report.data.month)}; planned from the allocation grid, actual from logged time in every billable class`}
            flush
          >
            <table className="w-full border-collapse text-[14px]" aria-label="Planned versus actual">
              <thead className="bg-xms-card sticky top-0 z-10">
                <tr className="border-xms-line border-b">
                  <th className={HEAD}>Person</th>
                  <th className={HEAD}>Account</th>
                  <th className={cn(HEAD, "text-right")}>Planned</th>
                  <th className={cn(HEAD, "text-right")}>Actual</th>
                  <th className={cn(HEAD, "text-right")}>Variance</th>
                  <th className={cn(HEAD, "text-right")}>Percent</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const tone = varianceTone(line);
                  return (
                    <tr
                      key={`${line.person_id}:${line.account_id}`}
                      className="border-xms-line hover:bg-xms-row-hover h-[40px] border-b"
                      data-line={`${line.person_id}:${line.account_id}`}
                      data-tone={tone}
                    >
                      <td className={CELL}>
                        <Link href={`/roster/${line.person_id}`} className="text-xms-accent font-medium">
                          {line.display_name}
                        </Link>
                      </td>
                      <td className={cn(CELL, "xms-mono")} title={accountName(line.account_id)}>
                        {accountKey(line.account_id)}
                      </td>
                      <td className={cn(CELL, "xms-mono text-right")} data-planned>
                        {formatHours(line.planned_minutes)}
                      </td>
                      <td className={cn(CELL, "xms-mono text-right")} data-actual>
                        {formatHours(line.actual_minutes)}
                      </td>
                      <td className={cn(CELL, "xms-mono text-right", TONE[tone])} data-variance>
                        {formatSignedHours(line.variance_minutes)}
                      </td>
                      <td className={cn(CELL, "xms-mono text-right", TONE[tone])} data-percent>
                        {formatVariancePercent(line.variance_ratio)}
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-xms-label px-4 py-8 text-center">
                      Nothing planned or logged for this month.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="text-xms-ink text-[14px] font-semibold" data-testid="variance-totals">
                  <td className="px-3 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="xms-mono px-3 py-2 text-right" data-total-planned>
                    {formatHours(report.data.totals.planned_minutes)}
                  </td>
                  <td className="xms-mono px-3 py-2 text-right" data-total-actual>
                    {formatHours(report.data.totals.actual_minutes)}
                  </td>
                  <td className="xms-mono px-3 py-2 text-right" data-total-variance>
                    {formatSignedHours(report.data.totals.variance_minutes)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </Panel>
        ) : null}
      </div>
    </>
  );
}

/**
 * Registered as `capacity.variance` (Capacity & Allocation functional 5.6,
 * CAP-05): planned against actual per person and account for a month,
 * largest variances first, with the month, account and person in the URL.
 * Export waits for an export route on the API.
 */
export default function CapacityVariancePage() {
  return (
    <AdminGate permission="capacity:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <VarianceScreen />
      </Suspense>
    </AdminGate>
  );
}
