"use client";

import { Panel } from "@/components/xms/panel";
import {
  archiveLine,
  chainSummary,
  digestLabel,
  momentLabel,
  retentionLines,
  spanLine,
  verificationLine,
  type VerdictTone,
} from "@/lib/reporting/integrity";
import { cn } from "@/lib/utils";
import { useSecurityIntegrityQuery } from "@/redux/reportingApi";

const TONE_CLASS: Record<VerdictTone, string> = {
  good: "text-[color:var(--state-complete-text)]",
  warn: "text-[color:var(--state-needs-input-text)]",
  breach: "text-[color:var(--state-overdue-text)] font-semibold",
};

function Verdict({ tone, children }: { tone: VerdictTone; children: string }) {
  return (
    <span className={cn("text-[12px]", TONE_CLASS[tone])} data-tone={tone}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="xms-caption">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, detail, right }: { label: string; detail?: string; right?: React.ReactNode }) {
  return (
    <li className="border-xms-line flex flex-wrap items-center gap-3 border-b py-2 text-[13px] last:border-b-0">
      <span className="xms-mono text-xms-ink">{label}</span>
      {detail ? <span className="text-xms-label text-[12px]">{detail}</span> : null}
      {right ? <span className="ml-auto">{right}</span> : null}
    </li>
  );
}

/**
 * The integrity panel of the Security screen (Audit & Analytics 7.1 and
 * section 6, backend cecce62). It replaces the placeholder that said the
 * digest job was not scheduled: the chain per stream with its last digest and
 * its last verification and whether that verification matched, the archive in
 * cold storage, the events this reader can see per stream with the oldest and
 * newest of them, and the retention policy.
 *
 * Two things it will not do. A stream that has never been verified is not
 * reported as passing: it reads as never verified, because an unchecked chain
 * proves nothing. And the retention months are printed as the declared policy
 * they are, with the API's own `detach_job_built` saying in plain words that
 * the job which would enforce them is not built, so the screen cannot present
 * a promise as a measurement.
 *
 * Whatever block the API did not answer is left out rather than drawn empty,
 * and an API that does not serve the route at all draws no panel: an empty
 * integrity panel would read as "nothing is protecting these events".
 */
export function IntegrityPanel() {
  const { data } = useSecurityIntegrityQuery();
  if (!data) return null;
  const { chain, archive, streams, retention } = data;
  if (!chain && !archive && !streams && !retention) return null;
  const summary = chain ? chainSummary(chain) : null;

  return (
    <Panel
      title="Integrity"
      caption="Digest chain, archive and retention"
      subtitle="The present, not the window: what the chain has attested, what is in cold storage, and how long events are kept."
      className="lg:col-span-2"
    >
      <div className="flex flex-col gap-4" data-testid="integrity-panel">
        {chain ? (
          <Section title="Digest chain">
            {summary ? <Verdict tone={summary.tone}>{summary.text}</Verdict> : null}
            <ul className="flex flex-col">
              {chain.streams.length === 0 ? (
                <li className="text-xms-label py-2 text-[13px]">No stream has been digested yet.</li>
              ) : null}
              {chain.streams.map((row) => {
                const verdict = verificationLine(row);
                return (
                  <Row
                    key={row.stream}
                    label={row.stream}
                    detail={`through ${momentLabel(row.last_day, "no day")}, ${row.row_count} rows, ${digestLabel(row.digest)}`}
                    right={<Verdict tone={verdict.tone}>{verdict.text}</Verdict>}
                  />
                );
              })}
            </ul>
          </Section>
        ) : null}

        {archive ? (
          <Section title="Archive">
            <ul className="flex flex-col">
              {archive.streams.length === 0 ? (
                <li className="text-xms-label py-2 text-[13px]">Nothing has been exported to cold storage yet.</li>
              ) : null}
              {archive.streams.map((row) => (
                <Row
                  key={row.stream}
                  label={row.stream}
                  detail={`through ${momentLabel(row.last_day, "no day")}, ${archiveLine(row)}`}
                  right={
                    <span className="xms-mono text-xms-label text-[12px]">
                      last export {momentLabel(row.last_run_at)}
                    </span>
                  }
                />
              ))}
            </ul>
          </Section>
        ) : null}

        {streams ? (
          <Section title="Events you can see">
            <ul className="flex flex-col">
              {streams.map((span) => (
                <Row
                  key={span.stream}
                  label={span.stream}
                  detail={spanLine(span)}
                  right={<span className="xms-mono text-xms-ink text-[13px] font-semibold">{span.n}</span>}
                />
              ))}
            </ul>
          </Section>
        ) : null}

        {retention ? (
          <Section title="Retention">
            <ul className="text-xms-body flex flex-col gap-1 text-[13px]">
              {retentionLines(retention).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </Panel>
  );
}
