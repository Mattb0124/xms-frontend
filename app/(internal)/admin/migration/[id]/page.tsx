"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BatchProperties, CountsStrip, LogTab, RunProgress } from "@/components/admin/migration/batch-summary";
import { BatchStatusPill } from "@/components/admin/migration/pills";
import { ReconciliationTab } from "@/components/admin/migration/reconciliation-tab";
import { RecordsTab } from "@/components/admin/migration/records-tab";
import { AdminGate, ConfirmButton, RecordBar, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { useToast } from "@/components/xms/toast";
import { describeMigrationError, migrationError } from "@/lib/migration/errors";
import { isRunnable, isRunning, objectKindLabel, runBlockedReason } from "@/lib/migration/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { useGetBatchQuery, useRunBatchMutation } from "@/redux/migrationApi";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

/**
 * The screen itself, mounted only once the reader holds the permission,
 * so the queries below are never sent by someone the API would refuse
 * (review finding 25).
 */
function AdminMigrationBatchPageBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const batch = useGetBatchQuery(id);
  const running = batch.data ? isRunning(batch.data.status) : false;
  // Running batches poll every ten seconds, otherwise no polling (technical section 6).
  const { refetch } = batch;
  useEffect(() => {
    if (!running) return;
    const handle = window.setInterval(() => void refetch(), 10_000);
    return () => window.clearInterval(handle);
  }, [running, refetch]);
  const accounts = useListGrantedAccountsQuery();
  const [run, runState] = useRunBatchMutation();
  const { push } = useToast();
  const track = useTrack("migration.batch.run");
  const [tab, setTab] = useState("records");
  const data = batch.data;
  const accountName = accounts.data?.find((account) => account.id === data?.account_id)?.name;

  const onRun = async () => {
    if (!data) return;
    try {
      const result = await run(id).unwrap();
      track({ batch_id: id, dry_run: result.dry_run, status: result.status, errors: result.counts.errors });
      push({
        title: result.status === "failed" ? "Run failed" : "Run finished",
        detail:
          result.status === "failed"
            ? (result.error ?? "See the log.")
            : `${result.counts.extracted} extracted, ${result.counts.loaded} loaded, ${result.counts.updated} updated, ${result.counts.unmatched} unmatched, ${result.counts.errors} errors.`,
        tone: result.status === "failed" ? "error" : "success",
      });
    } catch (caught) {
      push({ title: "Not run", detail: describeMigrationError(migrationError(caught)), tone: "error" });
    }
  };

  const blocked = data ? runBlockedReason(data) : null;
  const runDisabled = !data || !isRunnable(data.status) || runState.isLoading;
  const tabs = [
    { key: "records", label: "Records", count: data ? data.counts.extracted : undefined },
    { key: "log", label: "Log", count: data ? data.log.length : undefined },
    { key: "reconciliation", label: "Reconciliation" },
  ];
  const rerun = data
    ? `/admin/migration/new?account_id=${data.account_id}&instance_id=${String(data.source_ref.instance_id ?? "")}&opened_from=${String(data.source_range.opened_from ?? "")}&opened_to=${String(data.source_range.opened_to ?? "")}&supersedes=${data.id}`
    : "/admin/migration/new";

  return (
    <>
      {batch.isLoading ? <Skeleton lines={2} className="mb-4 max-w-sm" /> : null}
      {!batch.isLoading && (batch.isError || !data) ? (
        <EmptyBanner
          title="This batch is not on your accounts"
          action={{ label: "Back to Migration", href: "/admin/migration" }}
        />
      ) : null}
      {data ? (
        <>
          <RecordBar
            backHref="/admin/migration"
            backLabel="Migration"
            keyText={data.id.slice(0, 8)}
            title={`${objectKindLabel(data.object_kind)} from ${String(data.source_ref.instance_name ?? "the source")}`}
            pill={<BatchStatusPill status={data.status} title={data.error ?? undefined} />}
            actions={
              <>
                {!isRunnable(data.status) && !running ? (
                  <Link href={rerun} className={`${SECONDARY_BUTTON} inline-flex items-center hover:no-underline`}>
                    Run again as a new batch
                  </Link>
                ) : null}
                <span title={blocked ?? undefined} data-run-blocked={blocked ? "true" : undefined}>
                  <ConfirmButton
                    label={data.dry_run ? "Run dry run" : "Run"}
                    confirmLabel={data.dry_run ? "Confirm dry run" : "Confirm real run"}
                    onConfirm={onRun}
                    disabled={runDisabled}
                    danger={!data.dry_run}
                  />
                </span>
              </>
            }
          />
          {blocked ? <p className="text-xms-label mb-3 text-[12px]">{blocked}</p> : null}
          <div className="mb-4 flex flex-col gap-4">
            <RunProgress batch={data} />
            <CountsStrip batch={data} />
            <BatchProperties batch={data} accountName={accountName} />
          </div>
          <TabBar tabs={tabs} active={tab} onChange={setTab} className="mb-4" />
          {tab === "records" ? <RecordsTab batchId={data.id} /> : null}
          {tab === "log" ? <LogTab batch={data} /> : null}
          {tab === "reconciliation" ? <ReconciliationTab accountId={data.account_id} batchId={data.id} /> : null}
        </>
      ) : null}
    </>
  );
}

/** Registered as `admin.migration.batch`: properties, counts, Run, then Records, Log and Reconciliation. */
export default function AdminMigrationBatchPage() {
  return (
    <AdminGate permission="admin:migration">
      <AdminMigrationBatchPageBody />
    </AdminGate>
  );
}
