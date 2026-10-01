"use client";

import { SignalPill } from "@/components/xms/signal-pill";
import { OUTCOME_LABELS, outcomeTone, reasonLabel, recipientKindLabel } from "@/lib/reporting/schedules";
import type { DeliveryOutcome } from "@/redux/reportingApi";

/**
 * Each row keyed by the recipient it names. A schedule may list the same
 * recipient twice, or two with no address, so a repeat carries its count.
 */
function keyedByRecipient(delivery: DeliveryOutcome[]): Array<{ key: string; row: DeliveryOutcome }> {
  const seen = new Map<string, number>();
  return delivery.map((row) => {
    const recipient = `${row.kind}-${row.to}`;
    const repeats = seen.get(recipient) ?? 0;
    seen.set(recipient, repeats + 1);
    return { key: repeats === 0 ? recipient : `${recipient}-${repeats}`, row };
  });
}

/**
 * The per-recipient outcome of one run: kind, address, outcome pill and the
 * reason when the run skipped somebody. Shared by the account's Report packs
 * tab and the review screen, so a reviewer reads the same list after
 * approving that the history shows afterwards.
 */
export function DeliveryList({ delivery }: { delivery: DeliveryOutcome[] }) {
  if (delivery.length === 0) return <p className="text-xms-label text-body">No recipients on this schedule.</p>;
  return (
    <ul className="divide-xms-line divide-y text-body" aria-label="Delivery outcomes">
      {keyedByRecipient(delivery).map(({ key, row }) => (
        <li key={key} className="flex flex-wrap items-center gap-3 py-1.5" data-outcome={row.outcome}>
          <span className="text-xms-label w-[90px]">{recipientKindLabel(row.kind)}</span>
          <span className="xms-mono text-xms-body">{row.to || "(no address)"}</span>
          <SignalPill tone={outcomeTone(row.outcome)} label={OUTCOME_LABELS[row.outcome]} />
          {reasonLabel(row.reason) ? <span className="text-xms-label">{reasonLabel(row.reason)}</span> : null}
        </li>
      ))}
    </ul>
  );
}
