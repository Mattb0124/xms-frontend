"use client";

import { useMemo, useState } from "react";
import { AdminGate, ConfirmButton, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { formatStamp } from "@/components/tickets/conversation-tab";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { StripSelect } from "@/components/xms/filter-select";
import { Panel } from "@/components/xms/panel";
import { StatePill } from "@/components/xms/state-pill";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import {
  useDecideQuarantineMutation,
  useListQuarantineQuery,
  type QuarantineDecision,
  type QuarantineItem,
  type QuarantineReason,
} from "@/redux/emailApi";

export function reasonCopy(reason: QuarantineReason): string {
  switch (reason) {
    case "unknown_sender":
      return "Unknown sender";
    case "suspicious_content":
      return "Suspicious content";
    case "scan_quarantined":
      return "Malware scan";
    default:
      return "Unsupported content";
  }
}

export function decisionCopy(decision: QuarantineDecision | null): string {
  switch (decision) {
    case "create_contact_and_ticket":
      return "Contact and ticket created";
    case "create_ticket_once":
      return "Ticket created once";
    case "discard":
      return "Discarded";
    case "mark_spam":
      return "Marked as spam";
    default:
      return "Open";
  }
}

const COLUMNS: DenseColumn<QuarantineItem>[] = [
  {
    key: "received",
    title: "Received",
    sortValue: (row) => row.received_at,
    render: (row) => formatStamp(row.received_at),
    mono: true,
    width: "150px",
  },
  {
    key: "from",
    title: "From",
    sortValue: (row) => row.from_address,
    render: (row) => (
      <span className="flex flex-col">
        <span className="text-xms-ink">{row.from_name || row.from_address}</span>
        <span className="xms-mono text-xms-label text-[11px]">{row.from_address}</span>
      </span>
    ),
  },
  { key: "subject", title: "Subject", sortValue: (row) => row.subject, render: (row) => row.subject || "(no subject)" },
  {
    key: "reason",
    title: "Reason",
    sortValue: (row) => row.reason,
    render: (row) => (
      <StatePill state={row.reason === "scan_quarantined" ? "awaiting-client" : "new"} label={reasonCopy(row.reason)} />
    ),
    width: "160px",
  },
];

const DECIDED_COLUMNS: DenseColumn<QuarantineItem>[] = [
  ...COLUMNS,
  {
    key: "decision",
    title: "Decision",
    sortValue: (row) => row.decision ?? "",
    render: (row) => decisionCopy(row.decision),
    width: "200px",
  },
];

/** The reviewer drawer: the stripped body and the four decisions (Email Intake functional 5.6). */
export function QuarantineDecisionPanel({
  item,
  onDecide,
  deciding,
  onClose,
}: {
  item: QuarantineItem;
  onDecide: (decision: QuarantineDecision) => void;
  deciding?: boolean;
  onClose: () => void;
}) {
  return (
    <Panel
      title={item.subject || "(no subject)"}
      caption={`${item.from_name || item.from_address} · ${formatStamp(item.received_at)}`}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xms-label text-[12px]">
          {reasonCopy(item.reason)}. <span className="xms-mono">{item.from_address}</span>
        </p>
        <pre className="text-xms-body bg-xms-tint max-h-[320px] overflow-auto rounded-[6px] p-3 text-[13px] whitespace-pre-wrap">
          {item.stripped_body_text || "(empty message)"}
        </pre>
        {item.state === "open" ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Decision">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={deciding}
              onClick={() => onDecide("create_contact_and_ticket")}
            >
              Create contact and ticket
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={deciding}
              onClick={() => onDecide("create_ticket_once")}
            >
              Create ticket once
            </button>
            <ConfirmButton label="Discard" onConfirm={() => onDecide("discard")} disabled={deciding} danger />
            <ConfirmButton label="Mark spam" onConfirm={() => onDecide("mark_spam")} disabled={deciding} danger />
          </div>
        ) : (
          <p className="text-xms-label text-[13px]">
            {decisionCopy(item.decision)}
            {item.resulting_ticket_id ? " (a ticket was created)" : ""}
          </p>
        )}
        <button type="button" onClick={onClose} className="text-xms-label self-start text-[12px] hover:underline">
          Close
        </button>
      </div>
    </Panel>
  );
}

function QuarantineScreen() {
  const [showDecided, setShowDecided] = useState(false);
  const { data, isLoading } = useListQuarantineQuery(
    { state: showDecided ? "decided" : "open" },
    { pollingInterval: 60_000 },
  );
  const [decide, { isLoading: deciding }] = useDecideQuarantineMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { push } = useToast();
  const track = useTrack("quarantine.decide");
  const rows = useMemo(() => data ?? [], [data]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const onDecide = async (decision: QuarantineDecision) => {
    if (!selected) return;
    try {
      const result = await decide({ id: selected.id, decision }).unwrap();
      track({ decision, reason: selected.reason });
      push({
        title: decisionCopy(decision),
        detail: result.ticket_key ? `${result.ticket_key} created.` : undefined,
        tone: "success",
      });
      setSelectedId(null);
    } catch (error) {
      const parsed = apiError(error);
      push({
        title: "Not decided",
        detail: parsed.code === "already_decided" ? "Someone already decided this item." : describeError(parsed),
        tone: "error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Quarantine</h1>
      {/* The screen's one dimension, on the strip, where every other screen
          keeps its own. It was a checkbox and a "Queue ->" link on a page
          title row under the toolbar, so the screen was named twice, the
          shell's own row of controls stood empty, and the one control that
          changes what the list holds was a tick box no other screen has. */}
      <HeaderFilters>
        <StripSelect
          primary
          label="Show"
          value={showDecided ? "decided" : "open"}
          display={showDecided ? "decided" : `awaiting review (${rows.length})`}
          onChange={(value) => {
            setShowDecided(value === "decided");
            setSelectedId(null);
          }}
        >
          <option value="open">Show: awaiting review</option>
          <option value="decided">Show: decided</option>
        </StripSelect>
      </HeaderFilters>
      <div className={cn("grid gap-4", selected && "xl:grid-cols-[1fr_420px]")}>
        <DenseTable
          title={showDecided ? "Decided" : "Awaiting review"}
          subtitle={
            showDecided
              ? "what was decided, and what each decision created"
              : "email from senders we do not know yet, and files the scan blocked"
          }
          columns={showDecided ? DECIDED_COLUMNS : COLUMNS}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isLoading}
          onRowClick={(row) => setSelectedId(row.id)}
          // One empty statement, in the card, where the rows would be. It
          // used to have two: an ink banner above the card saying the same
          // thing in different words, and this line inside it.
          emptyState={
            showDecided ? "Nothing decided yet." : "Nothing to review: every inbound email matched a known contact."
          }
        />
        {selected ? (
          <QuarantineDecisionPanel
            item={selected}
            onDecide={onDecide}
            deciding={deciding}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function QuarantinePage() {
  return (
    <AdminGate permission="tickets:work">
      <QuarantineScreen />
    </AdminGate>
  );
}
