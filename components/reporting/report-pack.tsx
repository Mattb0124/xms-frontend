"use client";

import { DELIVERY_LINK_NOTE } from "@/lib/reporting/links";
import { useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { formatPeriod } from "@/components/reporting/format";
import { NotablePanel, OutcomesPanel, SlaPanel, TileStrip } from "@/components/reporting/measure-panels";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { EXTERNAL_REL, openExternal, safeHref } from "@/lib/safe-url";
import { useLazyReportPackQuery, useReportPackQuery } from "@/redux/reportingApi";

/**
 * One report pack (Dashboards functional 5.6): the numbers frozen at
 * generation, the notable list, the narrative versions and the two
 * renditions through the presigned URLs the API mints.
 */
export function ReportPackView({ packId }: { packId: string }) {
  const { data, isLoading, isError } = useReportPackQuery({ id: packId });
  if (isLoading && !data) return <Skeleton lines={10} />;
  if (isError || !data) {
    return <EmptyBanner title="This pack is not available" detail="It may belong to an account you are not granted." />;
  }
  const latest = [...data.narrative_versions].sort((a, b) => b.version - a.version)[0];
  return (
    <div className="flex flex-col gap-4" data-testid="report-pack">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xms-ink text-[18px] font-semibold">Weekly status report</h1>
        <span className="xms-mono text-xms-label text-[12px]">
          {formatPeriod({ start: data.period_start, end: data.period_end })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <PdfDownload packId={packId} />
          <PackDownload url={data.download} />
        </div>
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

/**
 * The presigned PPTX link. The URL is server-supplied, so it is validated
 * before it reaches an href, and it carries noreferrer as well as noopener so
 * the presigned path does not leak in a Referer (security review findings 26
 * and 38).
 */
function PackDownload({ url }: { url: string | null | undefined }) {
  const href = safeHref(url);
  if (href === null) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel={EXTERNAL_REL}
      title={DELIVERY_LINK_NOTE}
      className={`${PRIMARY_BUTTON} inline-flex items-center`}
    >
      Download PPTX
    </a>
  );
}

/**
 * The PDF rendition of the same pack. The pack route mints one presigned link
 * per request and writes a `data.export.produced` event for it, so the PDF is
 * asked for when somebody wants the file rather than on every view of the
 * screen, and opened through `openExternal` with no opener and no referrer.
 */
function PdfDownload({ packId }: { packId: string }) {
  const [fetchPack, { isFetching }] = useLazyReportPackQuery();
  const { push } = useToast();
  const [missing, setMissing] = useState(false);

  const open = async () => {
    try {
      const pack = await fetchPack({ id: packId, format: "pdf" }).unwrap();
      if (!openExternal(pack.download)) {
        setMissing(true);
        push({ title: "No PDF for this pack", detail: "It was generated before the PDF rendition.", tone: "error" });
      }
    } catch (error) {
      push({ title: "The PDF could not be opened", detail: describeError(apiError(error)), tone: "error" });
    }
  };

  return (
    <button
      type="button"
      className={`${SECONDARY_BUTTON} inline-flex items-center`}
      onClick={() => void open()}
      disabled={isFetching || missing}
    >
      {isFetching ? "Opening" : "Download PDF"}
    </button>
  );
}
