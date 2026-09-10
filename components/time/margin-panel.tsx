"use client";

import { useMemo, useState } from "react";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { StripSelect } from "@/components/xms/filter-select";
import { useMe } from "@/redux/me";
import { useAccountProfitabilityQuery, type MarginLine } from "@/redux/profitabilityApi";

/** The month a window names, and the first and last day of it. */
export function monthWindow(month: string): { from: string; to: string } {
  const [year, index] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: last };
}

/** The last twelve months, newest first, as values a select can carry. */
export function recentMonths(now: Date = new Date(), count = 12): string[] {
  const months: string[] = [];
  for (let back = 0; back < count; back += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

export function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Money, or a plain word where the figure could not be read. */
export function money(value: number | null, currency: string | undefined): string {
  if (value === null) return "Not known";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency ?? "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(value);
}

export function hours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

/**
 * What could not be weighed, in a sentence, so a reader knows whether to
 * believe the number above it. A margin computed over half the time worked
 * is not wrong, but it is not the whole account either.
 */
export function caveat(line: MarginLine): string {
  const parts: string[] = [];
  if (line.minutes_without_cost > 0)
    parts.push(`${hours(line.minutes_without_cost)} by people with no cost rate on file`);
  if (line.minutes_without_rate > 0) parts.push(`${hours(line.minutes_without_rate)} carrying no bill rate`);
  if (parts.length === 0) return "";
  return `Not weighed: ${parts.join(", and ")}.`;
}

/**
 * Account profitability (TB-16): what the month's work billed at, what it
 * cost, and what is left, with the roles and the people behind it.
 *
 * It stands on `finance:view-margin` rather than on the `contracts:view`
 * that opens the rest of the Budget tab, so a delivery lead reading the
 * contract position is not shown what their colleagues are paid. Without the
 * permission the panel is not drawn at all.
 *
 * Worst first, in both breakdowns. A reader opens this to find what is
 * losing money, not to admire what is not.
 */
export function AccountMarginPanel({ accountId }: { accountId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("finance:view-margin");
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const window = monthWindow(month);
  const { data, isLoading, isError } = useAccountProfitabilityQuery({ accountId, ...window }, { skip: !allowed });

  if (!allowed) return null;

  const currency = data?.currencies[0];
  const mixed = (data?.currencies.length ?? 0) > 1;

  const columns: DenseColumn<MarginLine>[] = [
    { key: "label", title: "", sortValue: (row) => row.label, render: (row) => row.label },
    { key: "hours", title: "Hours", width: "90px", align: "right", mono: true, render: (row) => hours(row.minutes) },
    {
      key: "revenue",
      title: "Billed",
      width: "120px",
      align: "right",
      mono: true,
      sortValue: (row) => row.revenue,
      render: (row) => money(row.revenue, currency),
    },
    {
      key: "cost",
      title: "Cost",
      width: "120px",
      align: "right",
      mono: true,
      sortValue: (row) => row.cost,
      render: (row) => money(row.cost, currency),
    },
    {
      key: "margin",
      title: "Margin",
      width: "120px",
      align: "right",
      mono: true,
      sortValue: (row) => row.margin,
      render: (row) => (
        <span className={row.margin !== null && row.margin < 0 ? "text-[color:var(--state-overdue-text)]" : undefined}>
          {money(row.margin, currency)}
        </span>
      ),
    },
    {
      key: "percent",
      title: "Share",
      width: "90px",
      align: "right",
      mono: true,
      sortValue: (row) => row.margin_percent,
      render: (row) => (row.margin_percent === null ? "" : `${row.margin_percent}%`),
    },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="account-margin">
      <Panel
        title="Margin"
        subtitle="What the month's work billed at, what it cost, and what is left."
        actions={
          <StripSelect ariaLabel="Month" value={month} display={monthLabel(month)} onChange={setMonth} size="lg">
            {months.map((entry) => (
              <option key={entry} value={entry}>
                {monthLabel(entry)}
              </option>
            ))}
          </StripSelect>
        }
      >
        {isLoading && !data ? <Skeleton lines={3} /> : null}
        {isError ? <p className="text-xms-body text-[13px]">The margin could not be read.</p> : null}
        {data ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-2">
              <span
                className={`xms-mono text-[30px] leading-none font-semibold tabular-nums ${
                  data.total.margin !== null && data.total.margin < 0
                    ? "text-[color:var(--state-overdue-text)]"
                    : "text-xms-ink"
                }`}
              >
                {money(data.total.margin, currency)}
              </span>
              <span className="text-xms-body text-[13px]">
                {money(data.total.revenue, currency)} billed against {money(data.total.cost, currency)} of cost over{" "}
                {hours(data.total.minutes)}
                {data.total.margin_percent === null ? "." : `, keeping ${data.total.margin_percent}%.`}
              </span>
            </div>
            {caveat(data.total) ? <p className="text-xms-label text-[12px]">{caveat(data.total)}</p> : null}
            {mixed ? (
              <p className="text-xms-label text-[12px]">
                More than one currency is in play here ({data.currencies.join(", ")}), so these figures do not add up.
              </p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {data && data.by_role.length > 0 ? (
        <DenseTable<MarginLine>
          title="By role"
          columns={columns}
          rows={data.by_role}
          rowKey={(row) => row.key}
          emptyState="No time in this month."
        />
      ) : null}

      {data && data.by_person.length > 0 ? (
        <DenseTable<MarginLine>
          title="By person"
          columns={columns}
          rows={data.by_person}
          rowKey={(row) => row.key}
          emptyState="No time in this month."
        />
      ) : null}
    </div>
  );
}
