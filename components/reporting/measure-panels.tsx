import { AGE_BUCKETS, formatHours, formatPercent } from "@/components/reporting/format";
import { KeyLink } from "@/components/xms/key-link";
import { MeterBar } from "@/components/xms/meter-bar";
import { Panel } from "@/components/xms/panel";
import { PriorityPill, type Priority } from "@/components/xms/priority-pill";
import { ScoreTile } from "@/components/xms/score-tile";
import { StatePill } from "@/components/xms/state-pill";
import { cn } from "@/lib/utils";
import type { Measures, Notable } from "@/redux/reportingApi";

/**
 * The measure panels shared by the Operations and Account dashboards
 * (Dashboards functional 5.3, Operations wireframe). Each panel renders
 * only when its measure is present, so the client view (the portal subset)
 * reuses the same pieces and simply shows fewer of them.
 */
/** Attainment at or above this is met; below it is a breach of the commitment. */
export const SLA_TARGET_PERCENT = 90;

export interface QueueLinks {
  /** Base Queue URL for the scope, e.g. `/tickets` or `/tickets?account_id=x`. */
  base: string;
}

function queueHref(links: QueueLinks | undefined, view?: string): string | undefined {
  if (!links) return undefined;
  if (!view) return links.base;
  return links.base.includes("?") ? `${links.base}&view=${view}` : `${links.base}?view=${view}`;
}

export function TileStrip({ measures, links }: { measures: Partial<Measures>; links?: QueueLinks }) {
  const tiles: Array<{
    key: keyof Measures;
    label: string;
    view?: string;
    tone?: (n: number) => "neutral" | "warn" | "breach" | "good";
  }> = [
    { key: "open_tickets", label: "Open" },
    { key: "breached_now", label: "Breached", view: "breached", tone: (n) => (n > 0 ? "breach" : "good") },
    { key: "at_risk_now", label: "At risk", tone: (n) => (n > 0 ? "warn" : "neutral") },
    { key: "unassigned_now", label: "Unassigned", view: "unassigned", tone: (n) => (n > 0 ? "warn" : "neutral") },
    { key: "volume_created", label: "Created" },
    { key: "volume_resolved", label: "Resolved" },
  ];
  const present = tiles.filter((tile) => typeof measures[tile.key] === "number");
  if (present.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="tile-strip">
      {present.map((tile) => {
        const value = measures[tile.key] as number;
        return (
          <ScoreTile
            key={tile.key}
            label={tile.label}
            value={value}
            tone={tile.tone ? tile.tone(value) : "neutral"}
            href={queueHref(links, tile.view)}
          />
        );
      })}
    </div>
  );
}

export function SlaPanel({ measures }: { measures: Partial<Measures> }) {
  const response = measures.sla_response_attainment;
  const resolution = measures.sla_resolution_attainment;
  if (!response && !resolution) return null;
  return (
    <Panel title="SLA attainment" caption="Period">
      <div className="flex flex-col gap-4">
        {[
          { label: "Response", ratio: response },
          { label: "Resolution", ratio: resolution },
        ]
          .filter((row) => row.ratio)
          .map((row) => (
            <div key={row.label} className="flex flex-col gap-1" data-testid={`sla-${row.label.toLowerCase()}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-xms-label text-[12px]">{row.label}</span>
                <span className="xms-mono text-xms-ink text-[13px] font-semibold">
                  {formatPercent(row.ratio)}
                  <span className="text-xms-muted ml-2 text-[11px] font-normal">
                    {row.ratio!.numerator} of {row.ratio!.denominator}
                  </span>
                </span>
              </div>
              <MeterBar
                percent={row.ratio!.value ?? 0}
                // Attainment is a higher-is-better measure: at or above target
                // it is met and drawn on the complete trio, never amber
                // (frontend review finding 11).
                met={row.ratio!.value !== null && row.ratio!.value >= SLA_TARGET_PERCENT}
                breached={row.ratio!.value !== null && row.ratio!.value < SLA_TARGET_PERCENT}
                className="w-full"
              />
            </div>
          ))}
      </div>
    </Panel>
  );
}

export function OutcomesPanel({ measures }: { measures: Partial<Measures> }) {
  const hasMttr = measures.mttr_minutes !== undefined;
  const hasReopen = measures.reopen_rate !== undefined;
  const hasOldest = measures.oldest_open_days !== undefined;
  if (!hasMttr && !hasReopen && !hasOldest) return null;
  return (
    <Panel title="Outcomes" caption="Period">
      <dl className="grid grid-cols-3 gap-4">
        {hasMttr ? (
          <div>
            <dt className="xms-caption">Mean time to resolve</dt>
            <dd className="xms-mono text-xms-ink mt-1 text-[24px] font-semibold">
              {formatHours(measures.mttr_minutes)}
            </dd>
          </div>
        ) : null}
        {hasReopen ? (
          <div>
            <dt className="xms-caption">Reopen rate</dt>
            <dd className="xms-mono text-xms-ink mt-1 text-[24px] font-semibold">
              {formatPercent(measures.reopen_rate, { fraction: true })}
            </dd>
          </div>
        ) : null}
        {hasOldest ? (
          <div>
            <dt className="xms-caption">Oldest open</dt>
            <dd className="xms-mono text-xms-ink mt-1 text-[24px] font-semibold">{measures.oldest_open_days}d</dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

export function BacklogPanel({ measures }: { measures: Partial<Measures> }) {
  const backlog = measures.backlog_by_age;
  if (!backlog) return null;
  const max = Math.max(1, ...AGE_BUCKETS.map((bucket) => backlog[bucket.key] ?? 0));
  return (
    <Panel title="Backlog by age" caption="Days open">
      <div className="flex h-[140px] items-end gap-3" role="img" aria-label="Backlog by age">
        {AGE_BUCKETS.map((bucket) => {
          const count = backlog[bucket.key] ?? 0;
          return (
            <div key={bucket.key} className="flex flex-1 flex-col items-center gap-1" data-bucket={bucket.key}>
              <span className="xms-mono text-xms-ink text-[12px]">{count}</span>
              <div
                className="bg-xms-accent w-full rounded-t-[3px]"
                style={{ height: `${Math.max(4, Math.round((count / max) * 100))}px` }}
                data-testid={`backlog-${bucket.key}`}
              />
              <span className="xms-mono text-xms-muted text-[11px]">{bucket.label}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function BreakdownPanel({
  title,
  values,
  linkBase,
  param,
  labelOf,
}: {
  title: string;
  values: Record<string, number> | undefined;
  linkBase?: string;
  param?: string;
  /** Names a key; pass the vocabulary so one label is used on every screen. */
  labelOf?: (key: string) => string;
}) {
  if (!values) return null;
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <Panel title={title} caption="Open">
      <ul className="flex flex-col gap-2">
        {entries.map(([key, count]) => {
          const label = labelOf ? labelOf(key) : key.replace(/_/g, " ");
          const href =
            linkBase && param
              ? `${linkBase}${linkBase.includes("?") ? "&" : "?"}${param}=${encodeURIComponent(key)}`
              : undefined;
          return (
            <li key={key} className="flex items-center gap-3 text-[13px]">
              {href ? (
                <a href={href} className="text-xms-ink w-[120px] capitalize hover:underline">
                  {label}
                </a>
              ) : (
                <span className="text-xms-ink w-[120px] capitalize">{label}</span>
              )}
              <div className="bg-xms-tint h-2 flex-1 overflow-hidden rounded-[999px]">
                <div className="bg-xms-accent h-full rounded-[999px]" style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className="xms-mono text-xms-ink w-8 text-right">{count}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function asPriority(value: string): Priority {
  return value === "p1" || value === "p2" || value === "p3" ? value : "p4";
}

export function NotablePanel({ notable }: { notable: Notable[] | undefined }) {
  if (!notable) return null;
  return (
    <Panel title="Notable tickets" caption="P1, P2 and breaches" flush>
      {notable.length === 0 ? (
        <p className="text-xms-label px-4 py-6 text-center text-[13px]">Nothing notable this period.</p>
      ) : (
        <ul data-testid="notable-list">
          {notable.map((ticket) => (
            <li
              key={ticket.key}
              className={cn(
                "border-xms-line flex items-center gap-3 border-b px-4 py-2 text-[13px] last:border-b-0",
                ticket.breached && "bg-[color:var(--state-overdue-bg)]",
              )}
              data-breached={ticket.breached ? "true" : undefined}
            >
              <KeyLink ticketKey={ticket.key} />
              <span className="text-xms-ink flex-1 truncate">{ticket.title}</span>
              <PriorityPill priority={asPriority(ticket.priority)} />
              <StatePill state={ticket.state} />
              <span className="xms-mono text-xms-label w-10 text-right text-[12px]">{ticket.age_days}d</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ConsumptionPanel({ measures }: { measures: Partial<Measures> }) {
  if (measures.consumption_minutes === undefined && measures.time_logged_minutes === undefined) return null;
  return (
    <Panel title="Time" caption="Period">
      <dl className="grid grid-cols-2 gap-4">
        {measures.consumption_minutes !== undefined ? (
          <div>
            <dt className="xms-caption">Consumed against contract</dt>
            <dd className="xms-mono text-xms-ink mt-1 text-[24px] font-semibold">
              {formatHours(measures.consumption_minutes)}
            </dd>
          </div>
        ) : null}
        {measures.time_logged_minutes !== undefined ? (
          <div>
            <dt className="xms-caption">Logged</dt>
            <dd className="xms-mono text-xms-ink mt-1 text-[24px] font-semibold">
              {formatHours(measures.time_logged_minutes)}
            </dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

/** One synthesis line written from the measures, never by Axel (DR-01). */
export function synthesisLine(measures: Partial<Measures>, accounts?: number): string {
  const parts: string[] = [];
  const resolution = measures.sla_resolution_attainment;
  if (resolution && resolution.value !== null) {
    parts.push(
      `Resolution attainment ${formatPercent(resolution)}${accounts !== undefined ? ` across ${accounts} account${accounts === 1 ? "" : "s"}` : ""}`,
    );
  }
  if (typeof measures.breached_now === "number") parts.push(`${measures.breached_now} breached now`);
  if (typeof measures.at_risk_now === "number") parts.push(`${measures.at_risk_now} at risk`);
  if (typeof measures.unassigned_now === "number") parts.push(`${measures.unassigned_now} unassigned`);
  return parts.length > 0 ? `${parts.join(", ")}.` : "No activity in this period.";
}
