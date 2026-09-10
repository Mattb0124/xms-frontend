"use client";

import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { formatDay } from "@/lib/format/date";
import { MeterBar } from "@/components/xms/meter-bar";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { HEALTH_LABEL, HEALTH_MEANING, HEALTH_TONE } from "@/lib/health/bands";
import { useAccountHealthQuery, type HealthFactor } from "@/redux/reportingApi";

/**
 * Word the raw inputs behind a factor, so a reader never has to take the
 * number on trust. Every sentence names the counts the server actually
 * measured, in the reader's language rather than the field names.
 */
export function whyLine(factor: HealthFactor): string {
  const detail = factor.detail;
  const n = (key: string): number | null => (typeof detail[key] === "number" ? (detail[key] as number) : null);
  switch (factor.key) {
    case "sla_resolution": {
      const met = n("met");
      const due = n("due");
      if (due === null || due === 0) return "No resolution target came due in the window.";
      return `${met ?? 0} of ${due} resolution targets met.`;
    }
    case "csat": {
      const responses = n("responses");
      const mean = n("mean_score");
      if (!responses) return "Nobody has answered a survey in the window.";
      return `${mean} out of 5 across ${responses} ${responses === 1 ? "response" : "responses"}.`;
    }
    case "budget": {
      const consumed = n("percent_consumed");
      const elapsed = n("percent_elapsed");
      if (consumed === null || elapsed === null) return "No contract period is open.";
      const ahead = Math.round(consumed - elapsed);
      if (ahead > 0) return `${consumed}% of the hours used ${ahead} points ahead of the calendar.`;
      return `${consumed}% of the hours used against ${elapsed}% of the period.`;
    }
    case "reopen_rate": {
      const resolved = n("resolved");
      const reopened = n("reopened");
      if (!resolved) return "Nothing was resolved in the window.";
      return `${reopened ?? 0} of ${resolved} resolved cases came back.`;
    }
    case "engagement": {
      const enabled = detail.portal_enabled === true;
      const signins = n("portal_signins") ?? 0;
      const sent = n("surveys_sent") ?? 0;
      const answered = n("surveys_answered") ?? 0;
      const parts: string[] = [];
      if (enabled) parts.push(`${signins} portal ${signins === 1 ? "sign-in" : "sign-ins"}`);
      if (sent > 0) parts.push(`${answered} of ${sent} surveys answered`);
      if (parts.length === 0) return "The portal is off and no survey has been sent, so this is not judged.";
      return `${parts.join(", ")}.`;
    }
    default:
      return "";
  }
}

const COLUMNS: DenseColumn<HealthFactor>[] = [
  { key: "label", title: "Factor", sortValue: (row) => row.label, width: "200px" },
  {
    key: "score",
    title: "Reading",
    width: "180px",
    sortValue: (row) => row.score,
    // The bar reads at a glance and the number reads exactly; a factor with
    // nothing to measure says so rather than drawing an empty bar at zero.
    render: (row) =>
      row.score === null ? (
        <span className="text-xms-label">Not measured</span>
      ) : (
        <span className="flex items-center gap-[10px]">
          <MeterBar percent={row.score} met={row.score >= 80} className="w-[92px]" />
          <span className="xms-mono text-xms-ink text-[13px] tabular-nums">{row.score}</span>
        </span>
      ),
  },
  {
    key: "weight",
    title: "Weight",
    width: "88px",
    align: "right",
    mono: true,
    sortValue: (row) => row.weight,
    render: (row) => `${row.weight}`,
  },
  {
    key: "contribution",
    title: "Points",
    width: "88px",
    align: "right",
    mono: true,
    sortValue: (row) => row.contribution,
    // Where a factor drops out the others carry its weight, so the points a
    // factor puts in are not its weight times its reading.
    render: (row) => (row.score === null ? <span className="text-xms-label">none</span> : `${row.contribution}`),
  },
  { key: "why", title: "Why", wrap: true, render: (row) => whyLine(row) },
];

/**
 * The account health score with its reasons (DR-09).
 *
 * A single number about a client relationship is only worth showing beside
 * the reasons for it, so the score never stands alone: the five factors are
 * always drawn under it, each with its weight, its own reading and the
 * counts the server measured. A reader who disagrees with the number can
 * see exactly which factor to argue with.
 *
 * Nothing here is stored. The server composes the score on every read over
 * the SLA attainment, CSAT, budget position, reopen rate and engagement it
 * already measures, so this screen has no state of its own to go stale.
 */
export function AccountHealthTab({ id }: { id: string }) {
  const { data, isLoading, isError } = useAccountHealthQuery({ id });

  if (isLoading && !data) return <Skeleton lines={6} />;
  if (isError || !data) {
    return (
      <Panel title="Health">
        <p className="text-xms-body text-[13px]">
          The score could not be read. It is composed on request, so try again.
        </p>
      </Panel>
    );
  }

  const measured =
    data.measured_weight === 100
      ? "on all 100 points of signal"
      : `on ${data.measured_weight} of 100 points of signal, the rest having nothing to measure`;

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Health"
        subtitle={`Composed on read over the ${data.window.days} days to ${formatDay(data.window.end)}.`}
      >
        <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-2">
          <span className="xms-mono text-xms-ink text-[34px] leading-none font-semibold tabular-nums">
            {data.score ?? "--"}
          </span>
          <SignalPill tone={HEALTH_TONE[data.band]} label={HEALTH_LABEL[data.band]} />
          <span className="text-xms-body text-[13px]">
            {HEALTH_MEANING[data.band]} Scored {measured}.
          </span>
        </div>
      </Panel>

      <DenseTable<HealthFactor>
        title="What the score stands on"
        columns={COLUMNS}
        rows={data.factors}
        rowKey={(row) => row.key}
        emptyState="No factors were returned."
      />
    </div>
  );
}
