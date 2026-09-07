"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminGate, formatDate } from "@/components/admin/primitives";
import { ActivityTab } from "@/components/tickets/activity-tab";
import { ConversationTab } from "@/components/tickets/conversation-tab";
import { LinksTab } from "@/components/tickets/links-tab";
import { PropertiesPanel } from "@/components/tickets/properties-panel";
import { RequesterCard, ServiceLevels, WatchCard } from "@/components/tickets/sla-rail";
import { TransitionMenu } from "@/components/tickets/transition-menu";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { PriorityPill } from "@/components/xms/priority-pill";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { SlaValue } from "@/components/xms/sla-value";
import { TabBar } from "@/components/xms/tab-bar";
import { useToast } from "@/components/xms/toast";
import { TypeBar } from "@/components/xms/type-bar";
import { apiError, describeError } from "@/lib/admin/api-error";
import { clockSnapshot, tighterClock } from "@/lib/tickets/sla";
import { RESOLUTION_CODES } from "@/lib/tickets/vocab";
import { useGetTicketQuery, usePatchTicketMutation, type TicketView } from "@/redux/ticketsApi";

const TABS = [
  { key: "conversation", label: "Conversation" },
  { key: "activity", label: "Activity" },
  { key: "links", label: "Links" },
  { key: "resolution", label: "Resolution" },
];

const TERMINAL = new Set(["closed", "cancelled", "rejected"]);

function ResolutionTab({ ticket }: { ticket: TicketView }) {
  const code = RESOLUTION_CODES.find((entry) => entry.key === ticket.resolution.code);
  if (!ticket.resolution.code && !ticket.resolved_at) {
    return (
      <p className="text-xms-label text-[13px]">Not resolved yet. The close discipline runs on the resolving move.</p>
    );
  }
  return (
    <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-[13px]">
      <dt className="text-xms-label">Resolution code</dt>
      <dd className="text-xms-ink">{code?.label ?? ticket.resolution.code ?? "none"}</dd>
      <dt className="text-xms-label">Notes</dt>
      <dd className="text-xms-ink whitespace-pre-wrap">{ticket.resolution.notes ?? ""}</dd>
      <dt className="text-xms-label">Solution</dt>
      <dd className="text-xms-ink">
        {ticket.resolution.solution_article_id
          ? `Article ${ticket.resolution.solution_article_id}`
          : ticket.resolution.solution_candidate
            ? "New-article candidate"
            : code?.noSolution
              ? "Waived by the resolution code"
              : "none"}
      </dd>
      <dt className="text-xms-label">Time exemption</dt>
      <dd className="text-xms-ink">{ticket.resolution.time_exemption_reason ?? "none"}</dd>
      <dt className="text-xms-label">Resolved</dt>
      <dd className="xms-mono text-xms-ink">{formatDate(ticket.resolved_at)}</dd>
      <dt className="text-xms-label">Reopened</dt>
      <dd className="xms-mono text-xms-ink">{ticket.reopen_count} times</dd>
    </dl>
  );
}

/** The ticket record (User Experience 3.4, Wireframes v3): record bar, properties, tabbed work area, rail. */
function TicketRecord({ ticketKey }: { ticketKey: string }) {
  const {
    data: ticket,
    isLoading,
    isError,
    fulfilledTimeStamp,
  } = useGetTicketQuery(ticketKey, { refetchOnFocus: true, pollingInterval: 60_000 });
  const [patch] = usePatchTicketMutation();
  const { push } = useToast();
  const [tab, setTab] = useState("conversation");
  const fetchedAt = useMemo(
    () => (fulfilledTimeStamp ? new Date(fulfilledTimeStamp) : undefined),
    [fulfilledTimeStamp],
  );

  if (isLoading) return <Skeleton lines={10} />;
  if (isError || !ticket) {
    return (
      <EmptyBanner
        title={`${ticketKey} is not on your accounts`}
        action={{ label: "Back to the Queue", href: "/tickets" }}
      />
    );
  }
  const readOnly = TERMINAL.has(ticket.state);
  const tight = tighterClock(ticket.sla);
  const requesterLine = ticket.requester
    ? `Emails the requester (${ticket.requester.email}) and the watchers`
    : "No requester email on this ticket; watchers are notified in app";

  return (
    <div className="flex flex-col gap-4" data-ticket={ticket.key}>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/tickets" className="text-xms-label hover:text-xms-ink text-[12px]">
          ← Queue
        </Link>
        <span className="xms-mono text-xms-accent text-[13px] font-medium">{ticket.key}</span>
        <div className="min-w-[280px] flex-1">
          <RecordForm
            columns={1}
            fields={[{ key: "short_description", label: "Title", value: ticket.short_description, readOnly }]}
            onCommit={async (_key, value) => {
              await patch({ key: ticket.key, body: { version: ticket.version, short_description: value } }).unwrap();
            }}
            onRollback={(_key, _restored, error) =>
              push({ title: "Not saved", detail: describeError(apiError(error)), tone: "error" })
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <TransitionMenu ticket={ticket} />
        <PriorityPill priority={ticket.priority} />
        <TypeBar type={ticket.type} />
        {tight ? (
          <span className="border-xms-line bg-xms-card inline-flex h-[28px] items-center gap-2 rounded-[999px] border px-3 text-[12px]">
            <span className="text-xms-label">{tight.kind === "response" ? "Response" : "Resolution"}</span>
            <SlaValue snapshot={clockSnapshot(tight)} />
          </span>
        ) : null}
        {readOnly ? (
          <span className="aix-state-pill" data-state="complete">
            Read only: {ticket.state_label}
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-[300px_1fr_280px]">
        <PropertiesPanel ticket={ticket} readOnly={readOnly} />
        <Panel title="Work area" flush>
          <div className="px-4 pt-2">
            <TabBar tabs={TABS} active={tab} onChange={setTab} />
          </div>
          <div className="p-4">
            {tab === "conversation" ? (
              <ConversationTab ticketKey={ticket.key} requesterLine={requesterLine} readOnly={readOnly} />
            ) : null}
            {tab === "activity" ? <ActivityTab ticketKey={ticket.key} /> : null}
            {tab === "links" ? <LinksTab ticketKey={ticket.key} readOnly={readOnly} /> : null}
            {tab === "resolution" ? <ResolutionTab ticket={ticket} /> : null}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <ServiceLevels sla={ticket.sla} fetchedAt={fetchedAt} />
          <RequesterCard ticket={ticket} />
          <WatchCard ticketKey={ticket.key} />
        </div>
      </div>
    </div>
  );
}

export default function TicketPage() {
  const params = useParams<{ key: string }>();
  const key = String(params.key ?? "").toUpperCase();
  return (
    <AdminGate permission="tickets:view">
      <TicketRecord ticketKey={key} />
    </AdminGate>
  );
}
