"use client";

import { SignalPill } from "@/components/xms/signal-pill";
import { OUTCOME_LABELS, outcomeTone, reasonLabel, recipientKindLabel } from "@/lib/reporting/schedules";
import type { DeliveryOutcome } from "@/redux/reportingApi";

/**
 * The per-recipient outcome of one run: kind, address, outcome pill and the
 * reason when the run skipped somebody. Shared by the account's Report packs
 * tab and the review screen, so a reviewer reads the same list after
 * approving that the history shows afterwards.
 */
export function DeliveryList({ delivery }: { delivery: DeliveryOutcome[] }) {
  if (delivery.length === 0) return <p className="text-xms-label text-[14px]">No recipients on this schedule.</p>;
  return (
    <ul className="divide-xms-line divide-y text-[14px]" aria-label="Delivery outcomes">
      {delivery.map((row, index) => (
        <li
          key={`${row.kind}-${row.to}-${index}`}
          className="flex flex-wrap items-center gap-3 py-1.5"
          data-outcome={row.outcome}
        >
          <span className="text-xms-label w-[90px]">{recipientKindLabel(row.kind)}</span>
          <span className="xms-mono text-xms-body">{row.to || "(no address)"}</span>
          <SignalPill tone={outcomeTone(row.outcome)} label={OUTCOME_LABELS[row.outcome]} />
          {reasonLabel(row.reason) ? <span className="text-xms-label">{reasonLabel(row.reason)}</span> : null}
        </li>
      ))}
    </ul>
  );
}
