"use client";

import Link from "next/link";
import { PRIMARY_BUTTON } from "@/components/admin/primitives";
import { formatPeriod } from "@/components/reporting/format";
import { NotablePanel, OutcomesPanel, SlaPanel, TileStrip } from "@/components/reporting/measure-panels";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useReportPackQuery } from "@/redux/reportingApi";

/**
 * One report pack (Dashboards functional 5.6): the numbers frozen at
 * generation, the notable list, the narrative versions and the PPTX
 * download through the presigned URL the API minted.
 */
export function ReportPackView({ packId }: { packId: string }) {
  const { data, isLoading, isError } = useReportPackQuery(packId);
  if (isLoading && !data) return <Skeleton lines={10} />;
  if (isError || !data) {
    return <EmptyBanner title="This pack is not available" detail="It may belong to an account you are not granted." />;
  }
  const latest = [...data.narrative_versions].sort((a, b) => b.version - a.version)[0];
  return (
    <div className="flex flex-col gap-4" data-testid="report-pack">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/accounts" className="text-xms-label hover:text-xms-ink text-[12px]">
          ← Accounts
        </Link>
        <h1 className="text-xms-ink text-[18px] font-semibold">Weekly status report</h1>
        <span className="xms-mono text-xms-label text-[12px]">
          {formatPeriod({ start: data.period_start, end: data.period_end })}
        </span>
        {data.download ? (
          <a
            href={data.download}
            target="_blank"
            rel="noopener"
            className={`${PRIMARY_BUTTON} ml-auto inline-flex items-center`}
          >
            Download PPTX
          </a>
        ) : null}
      </div>
      <TileStrip measures={data.measures} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SlaPanel measures={data.measures} />
        <OutcomesPanel measures={data.measures} />
      </div>
      <Panel title="Narrative" caption={latest ? `Version ${latest.version}, ${latest.author_kind}` : "No narrative"}>
        <p className="text-xms-ink text-[14px] whitespace-pre-wrap">{latest?.text ?? "No narrative was generated."}</p>
      </Panel>
      <NotablePanel notable={data.notable} />
    </div>
  );
}
