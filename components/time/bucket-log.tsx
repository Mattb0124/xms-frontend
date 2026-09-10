"use client";

import { useState } from "react";
import { INPUT } from "@/components/admin/primitives";
import { formatMinutes, LogTimeForm } from "@/components/tickets/time-tab";
import { useToast } from "@/components/xms/toast";
import { useTrack } from "@/lib/telemetry/provider";
import { useCatalogs } from "@/lib/tickets/use-catalogs";
import { cn } from "@/lib/utils";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";
import { bucketCodeLabel, useListBucketsQuery, useLogBucketTimeMutation, type Bucket } from "@/redux/timeApi";

/** The buckets a person may still log against; a retired one is refused by the API. */
function activeBuckets(buckets: Bucket[] | undefined): Bucket[] {
  return (buckets ?? []).filter((bucket) => bucket.status === "active");
}

/**
 * Non-ticket time (TB-12; Time, Contracts & Budget functional 5.3 and 5.8):
 * work that belongs to an account but to no ticket, so utilization reads
 * honestly. The bucket names the kind of work through the shared taxonomy,
 * and it carries the billable class the entry takes unless the person names
 * another, which is what decides whether the contract is burned at all.
 *
 * The activity list and the classes are the account's own catalogs as the
 * API resolves them, the same ones a ticket entry uses, so the same work
 * reads the same way whatever it hangs off.
 *
 * These are the fields alone: the form stood in a card of its own permanently
 * above the week it was about, and it now lives in the timesheet's Add entry
 * sheet beside the ticket form, which is what render 04 settled for the Time
 * tab.
 */
export function BucketLog() {
  const { data: accounts } = useListGrantedAccountsQuery();
  const [accountId, setAccountId] = useState("");
  const [bucketId, setBucketId] = useState("");
  const { data: buckets } = useListBucketsQuery(accountId, { skip: accountId === "" });
  // The catalogs are the account's, once one is chosen: a bucket entry is
  // classed by the same vocabulary a ticket entry is.
  const catalogs = useCatalogs(accountId || undefined, { skip: accountId === "" });
  const [log, logging] = useLogBucketTimeMutation();
  const { push } = useToast();
  const track = useTrack("time.log");

  const options = activeBuckets(buckets);
  const bucket = options.find((entry) => entry.id === bucketId) ?? null;
  const className = (key: string) => catalogs.billableClasses.find((entry) => entry.key === key)?.label ?? key;
  const consumes = catalogs.billableClasses.find((entry) => entry.key === bucket?.billable_class)?.consumesContract;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 text-[14px]">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Account</span>
          <select
            aria-label="Account"
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              setBucketId("");
            }}
            className={cn(INPUT, "w-[220px]")}
          >
            <option value="">Choose</option>
            {(accounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        {accountId ? (
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Bucket</span>
            <select
              aria-label="Bucket"
              value={bucketId}
              onChange={(event) => setBucketId(event.target.value)}
              className={cn(INPUT, "w-[260px]")}
            >
              <option value="">Choose</option>
              {options.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                  {entry.code ? ` (${bucketCodeLabel(entry.code)})` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {accountId && options.length === 0 ? (
        <p className="text-xms-label text-[14px]">This account has no bucket to log against.</p>
      ) : null}
      {bucket ? (
        <>
          <p className="text-xms-body text-[14px]" data-bucket-class>
            {bucket.label} is classed {className(bucket.billable_class)}, which{" "}
            {consumes === undefined
              ? "the account's catalog decides the burn for"
              : consumes
                ? "consumes the contract"
                : "does not consume the contract"}
            .
          </p>
          <LogTimeForm
            catalogs={catalogs}
            billableClass={bucket.billable_class}
            pending={logging.isLoading}
            onSubmit={async (body) => {
              const entry = await log({ accountId, bucketId: bucket.id, body }).unwrap();
              track({ minutes: entry.minutes, activity: entry.activity_type, via: "bucket" });
              push({ title: `${formatMinutes(entry.minutes)} logged on ${bucket.label}`, tone: "success" });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
