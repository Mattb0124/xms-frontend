"use client";

import { useState } from "react";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useCatalogs } from "@/lib/tickets/use-catalogs";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  BUCKET_CODES,
  bucketCodeLabel,
  useListBucketsQuery,
  usePatchBucketMutation,
  type Bucket,
  type BucketCode,
} from "@/redux/timeApi";

interface BucketDraft {
  label: string;
  code: BucketCode;
  billableClass: string;
  status: "active" | "retired";
}

function toDraft(bucket: Bucket): BucketDraft {
  return {
    label: bucket.label,
    code: (bucket.code as BucketCode) ?? "custom",
    billableClass: bucket.billable_class,
    status: bucket.status === "retired" ? "retired" : "active",
  };
}

/** Plain words for what the bucket routes refuse. */
function describeBucketError(error: unknown): string {
  const parsed = apiError(error);
  switch (parsed.code) {
    case "unknown_billable_class":
      return "That class is not in this account's catalog.";
    case "stale_version":
      return "Someone else changed this bucket. It has been reloaded; try again.";
    case "not_found":
      return "That bucket is gone, or it belongs to another account.";
    default:
      return describeError(parsed);
  }
}

function BucketRow({
  accountId,
  bucket,
  classes,
  canEdit,
}: {
  accountId: string;
  bucket: Bucket;
  classes: { key: string; label: string; consumesContract: boolean }[];
  canEdit: boolean;
}) {
  const [patch, patching] = usePatchBucketMutation();
  const { push } = useToast();
  const [draft, setDraft] = useState<BucketDraft | null>(null);
  const className = classes.find((entry) => entry.key === bucket.billable_class)?.label ?? bucket.billable_class;
  const consumes = classes.find((entry) => entry.key === bucket.billable_class)?.consumesContract;

  const save = async () => {
    if (!draft) return;
    try {
      await patch({
        accountId,
        bucketId: bucket.id,
        body: {
          version: bucket.version ?? 1,
          label: draft.label.trim(),
          code: draft.code,
          billable_class: draft.billableClass,
          status: draft.status,
        },
      }).unwrap();
      setDraft(null);
      push({ title: `${draft.label.trim()} saved`, tone: "success" });
    } catch (error) {
      push({ title: "The bucket was not saved", detail: describeBucketError(error), tone: "error" });
    }
  };

  if (draft) {
    return (
      <li className="border-xms-line border-b px-4 py-3 last:border-b-0">
        <form
          aria-label={`Edit ${bucket.label}`}
          className="flex flex-wrap items-end gap-3 text-[12px]"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Label</span>
            <input
              aria-label="Label"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              className={cn(INPUT, "w-[220px]")}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Taxonomy</span>
            <select
              aria-label="Taxonomy"
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value as BucketCode })}
              className={cn(INPUT, "w-[200px]")}
            >
              {BUCKET_CODES.map((code) => (
                <option key={code} value={code}>
                  {bucketCodeLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Billable class</span>
            <select
              aria-label="Billable class"
              value={draft.billableClass}
              onChange={(event) => setDraft({ ...draft, billableClass: event.target.value })}
              className={cn(INPUT, "w-[180px]")}
            >
              {classes.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Status</span>
            <select
              aria-label="Status"
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value as "active" | "retired" })}
              className={cn(INPUT, "w-[140px]")}
            >
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </label>
          <button type="submit" disabled={patching.isLoading} className={PRIMARY_BUTTON}>
            Save bucket
          </button>
          <button type="button" onClick={() => setDraft(null)} className={SECONDARY_BUTTON}>
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li
      className="border-xms-line flex flex-wrap items-center gap-3 border-b px-4 py-2 last:border-b-0"
      data-bucket={bucket.id}
    >
      <span className="text-xms-ink text-[13px] font-medium">{bucket.label}</span>
      <span className="xms-mono text-xms-label text-[12px]">{bucket.key}</span>
      <span className="text-xms-body text-[12px]">{bucketCodeLabel(bucket.code ?? "custom")}</span>
      <span className="text-xms-body text-[12px]" data-class>
        {className}
        {consumes === undefined ? "" : consumes ? ", consumes the contract" : ", does not consume the contract"}
      </span>
      <SignalPill
        tone={bucket.status === "active" ? "ready" : "complete"}
        label={bucket.status === "active" ? "Active" : "Retired"}
      />
      {canEdit ? (
        <button
          type="button"
          onClick={() => setDraft(toDraft(bucket))}
          className="text-xms-accent ml-auto text-[12px] hover:underline"
        >
          Edit
        </button>
      ) : null}
    </li>
  );
}

/**
 * The account's non-ticket buckets (TB-12). Reading them is `time:log`,
 * because logging is what needs the list; renaming one, moving its class or
 * its place in the shared taxonomy, and retiring it are `contracts:manage`,
 * because the class is what decides whether the time burns the contract.
 *
 * A bucket is not created here: the API takes a key on the closed pattern it
 * validates, and adding one is an onboarding step rather than a desk one.
 */
function BucketsList({ accountId, canEdit }: { accountId: string; canEdit: boolean }) {
  const { data, isLoading } = useListBucketsQuery(accountId);
  const catalogs = useCatalogs(accountId);
  if (isLoading && !data) return <Skeleton lines={3} />;
  const buckets = data ?? [];
  if (buckets.length === 0)
    return <p className="text-xms-label px-4 py-3 text-[13px]">This account has no non-ticket buckets.</p>;
  return (
    <ul className="flex flex-col" aria-label="Buckets">
      {buckets.map((bucket) => (
        <BucketRow
          key={bucket.id}
          accountId={accountId}
          bucket={bucket}
          classes={catalogs.billableClasses}
          canEdit={canEdit}
        />
      ))}
    </ul>
  );
}

export function BucketsPanel({ accountId }: { accountId: string }) {
  const me = useMe();
  const canRead = me.hasPermission("time:log");
  return (
    <Panel
      title="Non-ticket buckets"
      caption="TIME WITHOUT A TICKET"
      subtitle="Governance, QBR preparation and the rest, with the class that decides whether they burn the contract."
      flush
    >
      {canRead ? (
        <BucketsList accountId={accountId} canEdit={me.hasPermission("contracts:manage")} />
      ) : (
        <p className="text-xms-label px-4 py-3 text-[13px]">
          Reading the buckets needs the time:log permission, which this account binding does not carry.
        </p>
      )}
    </Panel>
  );
}
