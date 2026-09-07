"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { NewBatchForm } from "@/components/admin/migration/new-batch-form";
import { AdminGate, RecordBar } from "@/components/admin/primitives";
import { Skeleton } from "@/components/xms/skeleton";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

function NewBatchScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const accounts = useListGrantedAccountsQuery();
  const initial = {
    account_id: search.get("account_id") ?? undefined,
    instance_id: search.get("instance_id") ?? undefined,
    opened_from: search.get("opened_from") ?? undefined,
    opened_to: search.get("opened_to") ?? undefined,
    supersedes_batch_id: search.get("supersedes") ?? undefined,
  };
  return (
    <>
      <RecordBar backHref="/admin/migration" backLabel="Migration" title="New batch" />
      {accounts.isLoading ? <Skeleton lines={6} className="max-w-md" /> : null}
      {!accounts.isLoading ? (
        <NewBatchForm
          accounts={(accounts.data ?? []).map((account) => ({ id: account.id, name: account.name }))}
          initial={initial}
          onCreated={(batch) => router.push(`/admin/migration/${batch.id}`)}
          onCancel={() => router.push("/admin/migration")}
        />
      ) : null}
    </>
  );
}

/** Registered as `admin.migration.new`: the full-screen batch form (Data Migration functional 5.2). */
export default function AdminMigrationNewPage() {
  return (
    <AdminGate permission="admin:migration">
      <Suspense fallback={<Skeleton lines={6} />}>
        <NewBatchScreen />
      </Suspense>
    </AdminGate>
  );
}
