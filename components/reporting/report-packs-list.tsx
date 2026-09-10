"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect } from "@/components/xms/filter-select";
import { KeyLink } from "@/components/xms/key-link";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useListArrangement } from "@/components/xms/use-list-arrangement";
import { requestedByLabel } from "@/lib/reporting/schedules";
import { reviewMoment, reviewPill, runStatusLabel } from "@/lib/reporting/review";
import { useMe } from "@/redux/me";
import { useScheduleRunsQuery, type ScheduleRun } from "@/redux/reportingApi";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

/** The statuses a run passes through, in the order it passes through them. */
const STATUSES = [
  "queued",
  "running",
  "ready_for_review",
  "awaiting_review",
  "approved",
  "sending",
  "sent",
  "failed",
  "skipped",
];

/** "WSR" and "QBR" read better in capitals than as the keys they are. */
export function packTypeLabel(type: string): string {
  return type.length <= 4 ? type.toUpperCase() : type.replace(/_/g, " ");
}

/** "1 to 7 September 2026" from the two dates the run carries. */
export function periodLabel(start: string, end: string): string {
  return `${start} to ${end}`;
}

/**
 * The report packs list (DR-08): every run of every schedule on the accounts
 * this reader is granted, newest first.
 *
 * The screen the route registry has always promised and nobody built, so
 * "Report packs" sat in the finder as a dead link. A run opens its review
 * screen, which is where the pack is read and the decision is taken; this
 * only says what has run, what it is waiting on, and what became of it.
 *
 * It reads `/v1/reporting/runs`, which the API answers to `reports:manage`,
 * so that is what the screen gates on. The registry said
 * `reports:view-portfolio`, which would have shown the screen to a reader
 * the API then refused.
 */
export function ReportPacksList() {
  const router = useRouter();
  const me = useMe();
  const allowed = me.hasPermission("reports:manage");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState("");
  const accounts = useListGrantedAccountsQuery(undefined, { skip: !allowed });
  const { data, isLoading, isError } = useScheduleRunsQuery(
    { status: status || undefined, account: account || undefined },
    { skip: !allowed },
  );

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((entry) => [entry.id, entry.name])),
    [accounts.data],
  );

  const authored: DenseColumn<ScheduleRun>[] = useMemo(
    () => [
      {
        key: "pack",
        title: "Pack",
        width: "90px",
        sortValue: (row) => row.pack_type,
        render: (row) => packTypeLabel(row.pack_type),
      },
      {
        key: "account",
        title: "Account",
        sortValue: (row) => accountsById.get(row.account_id) ?? "",
        render: (row) => accountsById.get(row.account_id) ?? "Not granted to you",
      },
      {
        key: "period",
        title: "Period",
        width: "210px",
        mono: true,
        sortValue: (row) => row.period_start,
        render: (row) => periodLabel(row.period_start, row.period_end),
      },
      {
        key: "status",
        title: "Status",
        width: "170px",
        sortValue: (row) => row.status,
        render: (row) => {
          const pill = reviewPill(row.status);
          return pill ? <SignalPill tone={pill.tone} label={pill.label} /> : runStatusLabel(row.status);
        },
      },
      {
        key: "delivery",
        title: "Delivered to",
        wrap: true,
        render: (row) => {
          if (!row.delivery || row.delivery.length === 0) return <span className="text-xms-label">Nobody yet</span>;
          const reached = row.delivery.filter((entry) => entry.outcome !== "skipped").length;
          return `${reached} of ${row.delivery.length}`;
        },
      },
      {
        key: "error",
        title: "Problem",
        wrap: true,
        render: (row) => (row.error ? <span className="text-[color:var(--state-overdue-text)]">{row.error}</span> : ""),
      },
      {
        key: "by",
        title: "Requested",
        width: "180px",
        mono: true,
        sortValue: (row) => row.created_at,
        render: (row) => `${requestedByLabel(row.requested_by)}, ${reviewMoment(row.created_at)}`,
      },
      {
        key: "open",
        title: "",
        width: "90px",
        render: (row) => <KeyLink ticketKey="Open" href={`/reports/runs/${row.id}`} />,
      },
    ],
    [accountsById],
  );

  const arrangement = useListArrangement("report-packs", authored);

  if (!allowed) {
    return (
      <EmptyBanner
        title="Not permitted"
        detail="Report packs need the reports:manage permission, which is the one the runs themselves are answered to."
      />
    );
  }

  if (isLoading && !data) return <Skeleton lines={8} />;

  return (
    <>
      <HeaderFilters>
        <FilterSelect
          label="Show"
          primary
          count={data?.length}
          value={status}
          options={STATUSES.map((entry) => ({ value: entry, label: runStatusLabel(entry) }))}
          onChange={setStatus}
        />
        <FilterSelect
          label="Account"
          value={account}
          options={(accounts.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }))}
          onChange={setAccount}
        />
      </HeaderFilters>

      {isError ? (
        <EmptyBanner title="The runs could not be read" detail="Check that you are granted these accounts." />
      ) : (
        <DenseTable<ScheduleRun>
          title="Report packs"
          columns={arrangement.columns}
          display={arrangement.display}
          rows={data ?? []}
          rowKey={(row) => row.id}
          defaultSort={{ key: "by", direction: "desc" }}
          onRowClick={(row) => router.push(`/reports/runs/${row.id}`)}
          emptyState="No run yet. A schedule produces one, or you can run one now from an account's Report packs tab."
        />
      )}
      {arrangement.dialogue}
    </>
  );
}
