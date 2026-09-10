"use client";

import { formatStamp } from "@/components/tickets/conversation-tab";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { openExternal } from "@/lib/safe-url";
import {
  useGetTicketEmailQuery,
  useLazyGetInboundRawQuery,
  type DeliveryState,
  type Disposition,
  type InboundMessage,
  type MatchedBy,
  type OutboundMessage,
} from "@/redux/emailApi";

export function matchedByCopy(matchedBy: MatchedBy | null, disposition: Disposition): string {
  if (disposition === "created") return "Created this ticket";
  switch (matchedBy) {
    case "plus_token":
      return "Matched by the reply address";
    case "in_reply_to":
      return "Matched by In-Reply-To";
    case "references":
      return "Matched by the References chain";
    case "subject_key":
      return "Matched by the subject key";
    default:
      return "No thread match";
  }
}

export function dispositionCopy(disposition: Disposition): string {
  switch (disposition) {
    case "created":
      return "New ticket";
    case "appended":
      return "Appended as a reply";
    case "quarantined":
      return "Quarantined";
    case "suppressed":
      return "Suppressed";
    default:
      return "Rejected";
  }
}

export function kindCopy(kind: string): string {
  switch (kind) {
    case "acknowledgement":
      return "Acknowledgement";
    case "public_comment":
      return "Reply";
    case "resolved":
      return "Resolution notice";
    default:
      return kind.replace(/_/g, " ");
  }
}

function deliveryRamp(state: DeliveryState | null): string {
  switch (state) {
    case "delivered":
      return "resolved";
    case "sent":
      return "in-progress";
    case "queued":
      return "new";
    case "bounced":
    case "complained":
    case "failed":
      return "awaiting-client";
    default:
      return "closed";
  }
}

function LoopChips({ signals }: { signals: string[] }) {
  if (signals.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {signals.map((signal) => (
        <span key={signal} className="bg-xms-tint text-xms-label rounded-[999px] px-2 py-[1px] text-[14px]">
          {signal.replace(/_/g, " ")}
        </span>
      ))}
    </span>
  );
}

export function InboundRow({ row, onViewRaw }: { row: InboundMessage; onViewRaw: (row: InboundMessage) => void }) {
  return (
    <li className="flex flex-col gap-1 py-2 text-[14px]" data-inbound={row.id} data-disposition={row.disposition}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="xms-mono text-xms-label w-[110px] shrink-0 text-[14px]">{formatStamp(row.received_at)}</span>
        <span className="text-xms-ink font-medium">{row.from_name || row.from_address}</span>
        <span className="xms-mono text-xms-label text-[14px]">{row.from_address}</span>
        <span className="text-xms-body">{row.subject || "(no subject)"}</span>
        <button
          type="button"
          onClick={() => onViewRaw(row)}
          className="text-xms-accent ml-auto text-[14px] hover:underline"
        >
          View raw
        </button>
      </div>
      <div className="text-xms-label flex flex-wrap items-center gap-2 text-[14px]">
        <span>{dispositionCopy(row.disposition)}</span>
        <span>·</span>
        <span>{matchedByCopy(row.matched_by, row.disposition)}</span>
        {row.attachment_count > 0 ? (
          <span>
            · {row.attachment_count} attachment{row.attachment_count === 1 ? "" : "s"}
          </span>
        ) : null}
        <LoopChips signals={row.loop_signals} />
      </div>
    </li>
  );
}

export function OutboundRow({ row }: { row: OutboundMessage }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-[14px]" data-outbound={row.id}>
      <span className="xms-mono text-xms-label w-[110px] shrink-0 text-[14px]">{formatStamp(row.created_at)}</span>
      <span className="text-xms-ink font-medium">{kindCopy(row.kind)}</span>
      <span className="text-xms-label">to</span>
      <span className="xms-mono text-xms-label text-[14px]">{row.to_addresses.join(", ")}</span>
      <span className="text-xms-body truncate">{row.subject}</span>
      <StatePill state={deliveryRamp(row.state)} label={row.state ?? "unknown"} className="ml-auto" />
    </li>
  );
}

/** The Email tab: inbound messages with their disposition and match, outbound messages with their delivery state. */
export function EmailPanel({ ticketKey }: { ticketKey: string }) {
  const { data, isLoading } = useGetTicketEmailQuery(ticketKey);
  const [getRaw] = useLazyGetInboundRawQuery();
  const { push } = useToast();
  if (isLoading) return <Skeleton lines={4} />;
  const inbound = data?.inbound ?? [];
  const outbound = data?.outbound ?? [];
  const viewRaw = async (row: InboundMessage) => {
    try {
      const result = await getRaw(row.id).unwrap();
      openExternal(result.url);
    } catch (error) {
      push({ title: "Not available", detail: describeError(apiError(error)), tone: "error" });
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Inbound email">
        <p className="xms-caption mb-1">Inbound ({inbound.length})</p>
        {inbound.length === 0 ? <p className="text-xms-label text-[14px]">No email received on this ticket.</p> : null}
        <ul className="divide-xms-line divide-y">
          {inbound.map((row) => (
            <InboundRow key={row.id} row={row} onViewRaw={viewRaw} />
          ))}
        </ul>
      </section>
      <section aria-label="Outbound email">
        <p className="xms-caption mb-1">Outbound ({outbound.length})</p>
        {outbound.length === 0 ? <p className="text-xms-label text-[14px]">Nothing sent yet.</p> : null}
        <ul className="divide-xms-line divide-y">
          {outbound.map((row) => (
            <OutboundRow key={row.id} row={row} />
          ))}
        </ul>
      </section>
    </div>
  );
}
