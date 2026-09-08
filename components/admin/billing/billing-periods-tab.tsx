"use client";

import { useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { currentMonth } from "@/lib/capacity/vocab";
import { downloadFile, DownloadError } from "@/lib/exports/download";
import { useTrack } from "@/lib/telemetry/provider";
import {
  allowedActions,
  BILLING_STATUS,
  BILLING_TRANSITIONS,
  billingError,
  billingPeriodBody,
  canExport,
  checksumPrefix,
  describeBillingError,
  periodLabel,
} from "@/lib/time/billing";
import { formatHours, formatMoney } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";
import { useMe } from "@/redux/me";
import {
  billingExportPath,
  billingExportTags,
  useBillingExportsQuery,
  useBillingPeriodsQuery,
  useCreateBillingPeriodMutation,
  useTransitionBillingPeriodMutation,
  type BillingAction,
  type BillingExportFormat,
  type BillingPeriod,
} from "@/redux/timeApi";

const HEAD = "text-xms-ink px-3 py-2 text-left text-[12px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 py-2 align-top text-[13px]";
const SMALL = "h-[26px] px-2 text-[12px]";

export function BillingStatusPill({ status }: { status: BillingPeriod["status"] }) {
  const { label, tone } = BILLING_STATUS[status];
  return <SignalPill tone={tone} label={label} />;
}

/** The finance files produced for one period, newest first, with the checksum prefix and the delivery state. */
export function BillingExportsList({ accountId, periodId }: { accountId: string; periodId: string }) {
  const { data, isLoading, isError } = useBillingExportsQuery({ accountId, periodId });
  if (isLoading && !data) return <Skeleton lines={2} />;
  if (isError) return <p className="text-xms-muted text-[12px]">The export records could not be loaded.</p>;
  if (!data || data.length === 0) return <p className="text-xms-label text-[12px]">No finance file produced yet.</p>;
  return (
    <ul className="divide-xms-line divide-y text-[12px]" aria-label="Finance files">
      {data.map((record) => (
        <li key={record.id} className="flex flex-wrap items-center gap-3 py-1.5" data-export={record.id}>
          <span className="text-xms-ink font-medium">{record.format.toUpperCase()}</span>
          <span className="xms-mono text-xms-body">
            {record.row_count} row{record.row_count === 1 ? "" : "s"}
          </span>
          <span className="xms-mono text-xms-label" title={record.checksum} data-checksum>
            {checksumPrefix(record.checksum)}
          </span>
          <span className="xms-mono text-xms-label">{record.produced_at.slice(0, 16).replace("T", " ")}</span>
          <span className="text-xms-label ml-auto">
            {record.delivered_at ? `Delivered ${record.delivered_at.slice(0, 10)}` : "Not delivered"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Who moved the period, by name as the server resolved it ("System" for the automatic lock), with the day. */
export function PeriodPeople({ period }: { period: BillingPeriod }) {
  const moves: { key: string; label: string; name: string | null; at: string | null }[] = [
    { key: "submitted", label: "Submitted by", name: period.submitted_by_name, at: period.submitted_at },
    { key: "approved", label: "Approved by", name: period.approved_by_name, at: period.approved_at },
    { key: "locked", label: "Locked by", name: period.locked_by_name, at: period.locked_at },
  ].filter((move) => move.name !== null);
  if (moves.length === 0) return null;
  return (
    <span className="flex flex-col gap-0.5" data-period-people>
      {moves.map((move) => (
        <span key={move.key} className="text-xms-label text-[11px]" data-by={move.key}>
          {move.label} <span className="text-xms-body">{move.name}</span>
          {move.at ? <span className="xms-mono"> {move.at.slice(0, 10)}</span> : null}
        </span>
      ))}
    </span>
  );
}

function SummaryCell({ period }: { period: BillingPeriod }) {
  const summary = period.summary;
  if (!summary) return <span className="text-xms-label text-[12px]">Not summarized yet</span>;
  const classes = Object.entries(summary.by_class);
  return (
    <div className="flex flex-col gap-1" data-summary>
      <span className="text-xms-ink">
        <span className="xms-mono" data-summary-hours>
          {formatHours(summary.minutes)}
        </span>
        , <span className="xms-mono" data-summary-amount>{formatMoney(summary.amount)}</span>
        <span className="text-xms-label text-[12px]">
          {" "}
          from {summary.entries} entr{summary.entries === 1 ? "y" : "ies"}
          {summary.adjustments > 0 ? ` and ${summary.adjustments} adjustment${summary.adjustments === 1 ? "" : "s"}` : ""}
        </span>
      </span>
      {classes.length > 0 ? (
        <span className="text-xms-label text-[12px]">
          {classes.map(([key, value]) => `${key} ${formatHours(value.minutes)} (${formatMoney(value.amount)})`).join(", ")}
        </span>
      ) : null}
      {summary.unrated_minutes > 0 ? (
        <span className="text-[12px] text-[color:var(--state-needs-input-text)]" data-unrated>
          {formatHours(summary.unrated_minutes)} carry no rate
        </span>
      ) : null}
    </div>
  );
}

/**
 * Billing periods on the account record (Time & Budget functional 5.7,
 * TB-14): one per calendar month with its state, the summary figures the
 * server kept at submit and lock, the moves the state and the viewer's
 * permissions allow (Submit and Reopen under contracts:manage; Approve
 * and Lock under time:lock-period), the finance file as CSV or Excel for
 * a locked period fetched with the bearer, and the export records with
 * their checksums. Reading needs contracts:view, the permission the API
 * puts on /v1/accounts/:id/billing-periods; fails closed.
 */
export function BillingPeriodsTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("contracts:view");
  const canLock = me.hasPermission("time:lock-period");
  const { data, isLoading, isError } = useBillingPeriodsQuery(accountId, { skip: !allowed });
  const [create, { isLoading: creating }] = useCreateBillingPeriodMutation();
  const [transition, { isLoading: moving }] = useTransitionBillingPeriodMutation();
  const dispatch = useAppDispatch();
  const { push } = useToast();
  const trackMove = useTrack("billing.period.transition");
  const trackExport = useTrack("export.run");
  const [month, setMonth] = useState(() => currentMonth());
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  if (!allowed) {
    return (
      <Panel title="Billing periods" caption="Needs the contracts:view permission">
        <p className="text-xms-label text-[13px]">You can see this account but not its billing periods.</p>
      </Panel>
    );
  }

  const move = async (period: BillingPeriod, action: BillingAction) => {
    try {
      const after = await transition({ accountId, periodId: period.id, action, version: period.version }).unwrap();
      trackMove({ account_id: accountId, period_id: period.id, action, to: after.status });
      push({ title: `Period ${BILLING_STATUS[after.status].label.toLowerCase()}`, detail: periodLabel(after), tone: "success" });
    } catch (caught) {
      const error = billingError(caught);
      push({
        title: error.code === "stale_version" || error.code === "invalid_transition" ? "Reloaded" : "Not moved",
        detail: describeBillingError(error),
        tone: "error",
      });
    }
  };

  const exportFile = async (period: BillingPeriod, format: BillingExportFormat) => {
    setExporting(`${period.id}:${format}`);
    try {
      const file = await downloadFile({
        url: billingExportPath(accountId, period.id, format),
        fallbackName: `finance-${period.starts_on.slice(0, 7)}.${format}`,
      });
      trackExport({ kind: "finance", format, rows: file.rowCount ?? -1, period_id: period.id });
      push({
        title: file.rowCount === null ? "Finance file ready" : `Exported ${file.rowCount} row${file.rowCount === 1 ? "" : "s"}`,
        detail: file.fileName,
        tone: "success",
      });
      dispatch(xmsApi.util.invalidateTags(billingExportTags(accountId, period.id)));
    } catch (caught) {
      const detail =
        caught instanceof DownloadError
          ? describeBillingError(billingError({ status: caught.status, data: { code: caught.code ?? "error" } }))
          : "The export failed.";
      push({ title: "Export not produced", detail, tone: "error" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="billing-periods">
      {canLock ? (
        <Panel title="New period" caption="One billing period per calendar month">
          <form
            className="flex flex-wrap items-end gap-3"
            aria-label="New billing period"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const period = await create({ accountId, body: billingPeriodBody(month) }).unwrap();
                push({ title: "Period created", detail: periodLabel(period), tone: "success" });
              } catch (caught) {
                push({ title: "Not created", detail: describeBillingError(billingError(caught)), tone: "error" });
              }
            }}
          >
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-xms-label">Month</span>
              <input
                type="month"
                aria-label="Period month"
                required
                className={cn(INPUT, "xms-mono h-[30px] w-[160px] text-[12px]")}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
            <button type="submit" className={cn(PRIMARY_BUTTON, "h-[30px]")} disabled={creating || !month}>
              New period
            </button>
          </form>
        </Panel>
      ) : null}
      <Panel title="Billing periods" caption="Open, submitted, approved, locked, exported" flush>
        {isLoading && !data ? (
          <div className="p-4">
            <Skeleton lines={3} />
          </div>
        ) : null}
        {isError ? <p className="text-xms-muted p-4 text-[13px]">The billing periods could not be loaded.</p> : null}
        {data ? (
          <table className="w-full border-collapse" aria-label="Billing periods">
            <thead className="bg-xms-card">
              <tr className="border-xms-line border-b">
                <th className={HEAD}>Period</th>
                <th className={HEAD}>Status</th>
                <th className={HEAD}>Summary</th>
                <th className={HEAD}>Checksum</th>
                <th className={cn(HEAD, "text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((period) => {
                const actions = allowedActions(period.status, me.hasPermission);
                const exportable = canLock && canExport(period.status);
                const expanded = open === period.id;
                return (
                  <tr
                    key={period.id}
                    className="border-xms-line border-b align-top"
                    data-period={period.id}
                    data-status={period.status}
                  >
                    <td className={CELL}>
                      <span className="flex flex-col">
                        <span className="text-xms-ink font-medium">{periodLabel(period)}</span>
                        <span className="xms-mono text-xms-label text-[11px]">
                          {period.starts_on} to {period.ends_on}
                        </span>
                      </span>
                    </td>
                    <td className={CELL}>
                      <span className="flex flex-col gap-1">
                        <span>
                          <BillingStatusPill status={period.status} />
                        </span>
                        {period.status === "approved" && period.auto_lock_at ? (
                          <span className="text-xms-label text-[11px]">
                            Locks on its own {period.auto_lock_at.slice(0, 10)}
                          </span>
                        ) : null}
                        <PeriodPeople period={period} />
                      </span>
                    </td>
                    <td className={CELL}>
                      <SummaryCell period={period} />
                    </td>
                    <td className={cn(CELL, "xms-mono text-xms-label text-[12px]")} title={period.checksum ?? undefined}>
                      {checksumPrefix(period.checksum)}
                    </td>
                    <td className={cn(CELL, "text-right")}>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        {actions.map((action) =>
                          action === "lock" || action === "approve" ? (
                            <ConfirmButton
                              key={action}
                              label={BILLING_TRANSITIONS[action].label}
                              disabled={moving}
                              className={SMALL}
                              onConfirm={() => move(period, action)}
                            />
                          ) : (
                            <button
                              key={action}
                              type="button"
                              className={cn(SECONDARY_BUTTON, SMALL)}
                              disabled={moving}
                              onClick={() => void move(period, action)}
                            >
                              {BILLING_TRANSITIONS[action].label}
                            </button>
                          ),
                        )}
                        {exportable ? (
                          <>
                            <button
                              type="button"
                              className={cn(SECONDARY_BUTTON, SMALL)}
                              disabled={exporting !== null}
                              onClick={() => void exportFile(period, "csv")}
                            >
                              {exporting === `${period.id}:csv` ? "Exporting" : "CSV"}
                            </button>
                            <button
                              type="button"
                              className={cn(SECONDARY_BUTTON, SMALL)}
                              disabled={exporting !== null}
                              onClick={() => void exportFile(period, "xlsx")}
                            >
                              {exporting === `${period.id}:xlsx` ? "Exporting" : "Excel"}
                            </button>
                            <button
                              type="button"
                              className={cn(SECONDARY_BUTTON, SMALL)}
                              aria-expanded={expanded}
                              aria-controls={`exports-${period.id}`}
                              onClick={() => setOpen(expanded ? null : period.id)}
                            >
                              {expanded ? "Hide exports" : "Exports"}
                            </button>
                          </>
                        ) : null}
                      </div>
                      {expanded ? (
                        <div id={`exports-${period.id}`} className="mt-2 text-left">
                          <BillingExportsList accountId={accountId} periodId={period.id} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-xms-label px-4 py-8 text-center text-[13px]">
                    No billing period yet.{canLock ? " Create one for the month above." : ""}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </Panel>
    </div>
  );
}
