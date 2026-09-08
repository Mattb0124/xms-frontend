"use client";

import Link from "next/link";
import { useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { defaultCsatRange, distributionRows, formatAverage, isDay, respondentLabel, scoreTone } from "@/lib/reporting/csat";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useAccountCsatQuery, type AccountCsat } from "@/redux/reportingApi";

const HEAD = "text-xms-ink px-3 py-2 text-left text-[12px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 py-2 align-top text-[13px]";

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-xms-line flex flex-col gap-1 rounded-[6px] border px-4 py-3" aria-label={label}>
      <span className="text-xms-label text-[12px]">{label}</span>
      <span className="text-xms-ink text-[20px] font-semibold" data-value>
        {value}
      </span>
      {detail ? <span className="text-xms-label text-[12px]">{detail}</span> : null}
    </div>
  );
}

/** Five bars from very satisfied down, each with its count in words and figures. */
export function DistributionBars({ summary }: { summary: AccountCsat["summary"] }) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Score distribution">
      {distributionRows(summary).map((row) => (
        <li
          key={row.score}
          className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-[13px]"
          data-score={row.score}
          data-count={row.count}
          data-percent={row.percent}
        >
          <span className="text-xms-body">
            <span className="xms-mono text-xms-ink mr-2">{row.score}</span>
            {row.label}
          </span>
          <span className="bg-xms-tint block h-2 rounded-[2px]" aria-hidden="true">
            <span className="bg-xms-accent block h-2 rounded-[2px]" style={{ width: `${row.percent}%` }} />
          </span>
          <span className="xms-mono text-xms-ink text-right">{row.count}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Satisfaction on the account dashboard (Client Portal functional 5.7, the
 * operator's per-account results; tickets:view, fails closed): the average,
 * the distribution as five bars, the low-score count, the surveys sent and
 * answered, and the responses with score, ticket, comment, respondent and
 * date over a date range sent as the API names it.
 */
export function AccountCsatView({ accountId }: { accountId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("tickets:view");
  const [range, setRange] = useState(() => defaultCsatRange());
  const valid = isDay(range.from) && isDay(range.to);
  const { data, isLoading, isError } = useAccountCsatQuery(
    { accountId, from: range.from, to: range.to },
    { skip: !allowed || !valid },
  );

  if (!allowed) {
    return (
      <Panel title="Satisfaction" caption="Needs the tickets:view permission">
        <p className="text-xms-label text-[13px]">You can see this account but not its satisfaction scores.</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-csat">
      <Panel
        title="Satisfaction"
        caption="CSAT on ticket close"
        actions={
          <form className="flex items-center gap-2 text-[12px]" aria-label="Date range" onSubmit={(event) => event.preventDefault()}>
            <label className="text-xms-label flex items-center gap-1">
              From
              <input
                type="date"
                aria-label="From"
                className={cn(INPUT, "xms-mono h-[28px] w-[140px] text-[12px]")}
                value={range.from}
                onChange={(event) => setRange({ ...range, from: event.target.value })}
              />
            </label>
            <label className="text-xms-label flex items-center gap-1">
              To
              <input
                type="date"
                aria-label="To"
                className={cn(INPUT, "xms-mono h-[28px] w-[140px] text-[12px]")}
                value={range.to}
                onChange={(event) => setRange({ ...range, to: event.target.value })}
              />
            </label>
          </form>
        }
      >
        {isLoading && !data ? <Skeleton lines={4} /> : null}
        {isError ? <p className="text-xms-muted text-[13px]">The satisfaction scores could not be loaded.</p> : null}
        {data ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Average score" value={formatAverage(data.summary.average)} />
              <Figure label="Responses in range" value={String(data.summary.responses)} detail={`${data.from} to ${data.to}`} />
              <Figure label="Low scores" value={String(data.summary.low)} detail="Scores of 1 or 2" />
              <Figure
                label="Surveys"
                value={`${data.surveys.sent} sent, ${data.surveys.answered} answered`}
                detail={data.surveys.suppressed > 0 ? `${data.surveys.suppressed} suppressed` : undefined}
              />
            </div>
            <DistributionBars summary={data.summary} />
          </div>
        ) : null}
      </Panel>
      <Panel title="Responses" caption="Newest first" flush>
        {data ? (
          <table className="w-full border-collapse" aria-label="Survey responses">
            <thead className="bg-xms-card">
              <tr className="border-xms-line border-b">
                <th className={HEAD}>Score</th>
                <th className={HEAD}>Ticket</th>
                <th className={HEAD}>Comment</th>
                <th className={HEAD}>Respondent</th>
                <th className={HEAD}>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.responses.map((response) => (
                <tr key={response.id} className="border-xms-line border-b" data-response={response.id}>
                  <td className={CELL}>
                    <SignalPill tone={scoreTone(response.score)} label={`${response.score} of 5`} />
                  </td>
                  <td className={cn(CELL, "xms-mono")}>
                    {response.ticket_key ? (
                      <Link href={`/tickets/${response.ticket_key}`} className="text-xms-accent hover:underline">
                        {response.ticket_key}
                      </Link>
                    ) : (
                      <span className="text-xms-muted">Not a ticket</span>
                    )}
                  </td>
                  <td className={CELL}>
                    {response.comment ? (
                      <span className="whitespace-pre-wrap">{response.comment}</span>
                    ) : (
                      <span className="text-xms-muted">No comment</span>
                    )}
                  </td>
                  <td className={CELL}>{respondentLabel(response)}</td>
                  <td className={cn(CELL, "xms-mono text-xms-label text-[12px]")}>{response.created_at.slice(0, 10)}</td>
                </tr>
              ))}
              {data.responses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-xms-label px-4 py-8 text-center text-[13px]">
                    No responses in this range.
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
