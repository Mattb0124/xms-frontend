"use client";

import { useState } from "react";
import { formatDay } from "@/lib/format/date";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  usePersonCostRatesQuery,
  useRemovePersonCostRateMutation,
  useSetPersonCostRateMutation,
  type CostRate,
} from "@/redux/profitabilityApi";

/** A rate is a number with at most two decimals, and never negative. */
export function costRateProblem(value: string, effectiveFrom: string): string | null {
  if (effectiveFrom === "") return "A rate needs the day it starts applying.";
  const parsed = Number(value);
  if (value.trim() === "" || Number.isNaN(parsed)) return "A rate is a number.";
  if (parsed < 0) return "A rate cannot be negative.";
  if (Math.round(parsed * 100) !== parsed * 100) return "A rate goes to the cent, no further.";
  return null;
}

/**
 * What this person costs per hour, from a date (TB-16).
 *
 * Effective-dated for the same reason a rate card is: a margin for last
 * March computed at this March's cost is not a margin, it is a guess, and
 * this is money. The rate in force on a day is the latest one on or before
 * it, so the list reads newest first and the row at the bottom is where the
 * history starts.
 *
 * The tab is drawn only for a reader holding `finance:view-margin`, and the
 * form only for one holding `finance:manage-cost`.
 */
export function CostRatesTab({ personId }: { personId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("finance:view-margin");
  const canEdit = me.hasPermission("finance:manage-cost");
  const { data, isLoading } = usePersonCostRatesQuery(personId, { skip: !allowed });
  const [save, saving] = useSetPersonCostRateMutation();
  const [remove] = useRemovePersonCostRateMutation();
  const { push } = useToast();

  const [from, setFrom] = useState("");
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  if (!allowed) {
    return (
      <EmptyBanner
        title="Not permitted"
        detail="Cost rates need the finance:view-margin permission. Seeing the roster is not the same as seeing what people are paid."
      />
    );
  }

  const columns: DenseColumn<CostRate>[] = [
    {
      key: "from",
      title: "From",
      width: "130px",
      mono: true,
      sortValue: (row) => row.effective_from,
      render: (row) => formatDay(row.effective_from),
    },
    {
      key: "rate",
      title: "Per hour",
      width: "130px",
      align: "right",
      mono: true,
      sortValue: (row) => row.cost_rate,
      render: (row) =>
        new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: row.currency,
          currencyDisplay: "narrowSymbol",
        }).format(row.cost_rate),
    },
    { key: "note", title: "Note", wrap: true, render: (row) => row.note },
    { key: "by", title: "Set", width: "170px", mono: true, render: (row) => formatDate(row.created_at) },
    ...(canEdit
      ? [
          {
            key: "actions",
            title: "",
            width: "110px",
            render: (row: CostRate) => (
              <ConfirmButton
                label="Remove"
                danger
                onConfirm={async () => {
                  try {
                    await remove({ personId, id: row.id }).unwrap();
                    push({ title: "Rate removed", tone: "success" });
                  } catch (caught) {
                    push({ title: "It was not removed", detail: describeError(apiError(caught)), tone: "error" });
                  }
                }}
              />
            ),
          },
        ]
      : []),
  ];

  if (isLoading && !data) return <Skeleton lines={4} />;

  return (
    <div className="flex flex-col gap-4">
      <DenseTable<CostRate>
        title="Cost rates"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        emptyState="No cost rate on file. Until there is one, this person's time is left out of every margin."
      />

      {canEdit ? (
        <Panel
          title="Set a rate"
          subtitle="It applies from the day you name until a later one replaces it. Naming a day that already has a rate corrects it."
        >
          <form
            className="flex flex-wrap items-end gap-3 text-[14px]"
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              const found = costRateProblem(rate, from);
              setProblem(found);
              if (found) return;
              try {
                await save({
                  personId,
                  body: { effective_from: from, cost_rate: Number(rate), note: note.trim() || undefined },
                }).unwrap();
                push({ title: "Rate saved", tone: "success" });
                setRate("");
                setNote("");
              } catch (caught) {
                setProblem(describeError(apiError(caught)));
              }
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">From</span>
              <input
                aria-label="From"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className={cn(INPUT, "xms-mono w-[180px]")}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Cost per hour</span>
              <input
                aria-label="Cost per hour"
                inputMode="decimal"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                placeholder="85.00"
                className={cn(INPUT, "xms-mono w-[160px]")}
              />
            </label>
            <label className="flex min-w-[240px] flex-1 flex-col gap-1">
              <span className="text-xms-label">Note</span>
              <input
                aria-label="Note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Why it changed"
                maxLength={500}
                className={cn(INPUT, "max-w-none")}
              />
            </label>
            <button type="submit" disabled={saving.isLoading} className={PRIMARY_BUTTON}>
              Save rate
            </button>
          </form>
          {problem ? <p className="mt-2 text-[14px] text-[color:var(--state-overdue-text)]">{problem}</p> : null}
        </Panel>
      ) : null}
    </div>
  );
}
