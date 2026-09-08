"use client";

import { PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { runStatusLabel } from "@/lib/reporting/review";
import { openExternal } from "@/lib/safe-url";
import { useTrack } from "@/lib/telemetry/provider";
import { useMe } from "@/redux/me";
import { useGenerateWsrMutation, useReportRunsQuery, type ReportRun } from "@/redux/reportingApi";

/**
 * The run status on the v3 state ramp. Review before send (functional 5.8)
 * added four states a run now passes through, so the ramp carries them all
 * rather than dropping the unknown ones into the closed grey: both held
 * states wait on a person, `approved` and `sending` are on their way out, and
 * a cancelled run takes the closed vocabulary's `skipped`.
 */
const RUN_RAMP: Record<string, string> = {
  generating: "in-progress",
  ready_for_review: "awaiting-approval",
  awaiting_review: "awaiting-approval",
  approved: "in-progress",
  sending: "in-progress",
  sent: "resolved",
  skipped: "closed",
  failed: "closed",
};

export function RunStatusPill({ status }: { status: string }) {
  return <StatePill state={RUN_RAMP[status] ?? "closed"} label={runStatusLabel(status)} />;
}

/**
 * Report runs for one account (Dashboards functional 5.6, P2.20.2 cut): the
 * runs list with a status pill and a pack link, and "Generate weekly report"
 * for practice leads. The download link is the presigned URL the API minted.
 */
export function ReportsCard({ accountId }: { accountId: string }) {
  const me = useMe();
  const { push } = useToast();
  const track = useTrack("report.generate");
  const runs = useReportRunsQuery(accountId);
  const [generate, generating] = useGenerateWsrMutation();

  const onGenerate = async () => {
    try {
      const result = await generate(accountId).unwrap();
      track({ account_id: accountId, run_id: result.run_id, pack_type: "wsr" });
      push({ title: "Weekly report generated", detail: "The download opens in a new tab.", tone: "success" });
      openExternal(result.download);
    } catch (error) {
      push({ title: "Report not generated", detail: describeError(apiError(error)), tone: "error" });
    }
  };

  return (
    <Panel
      title="Reports"
      caption="Weekly status"
      flush
      actions={
        me.hasPermission("reports:view-portfolio") ? (
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={generating.isLoading}
            className={PRIMARY_BUTTON}
          >
            {generating.isLoading ? "Generating" : "Generate weekly report"}
          </button>
        ) : null
      }
    >
      {runs.isLoading ? (
        <div className="p-4">
          <Skeleton lines={3} />
        </div>
      ) : runs.data && runs.data.length > 0 ? (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-xms-line text-xms-ink border-b text-left text-[12px] font-semibold">
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Generated</th>
              <th className="px-4 py-2 text-right">Pack</th>
            </tr>
          </thead>
          <tbody>
            {runs.data.map((run: ReportRun) => (
              <tr key={run.id} className="border-xms-line border-b last:border-b-0" data-run-id={run.id}>
                <td className="xms-mono px-4 py-2">
                  {run.period_start} to {run.period_end}
                </td>
                <td className="px-4 py-2 uppercase">{run.pack_type}</td>
                <td className="px-4 py-2">
                  <RunStatusPill status={run.status} />
                </td>
                <td className="xms-mono text-xms-label px-4 py-2 text-[12px]">
                  {run.created_at.slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-4 py-2 text-right">
                  {run.pack_id_resolved ? (
                    <a href={`/reports/packs/${run.pack_id_resolved}`} className="text-xms-accent hover:underline">
                      Open pack
                    </a>
                  ) : (
                    <span className="text-xms-muted">{run.error ? "Failed" : "Pending"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xms-label px-4 py-6 text-center text-[13px]">No report runs yet.</p>
      )}
    </Panel>
  );
}
