"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminGate } from "@/components/admin/primitives";
import { ActivityTab } from "@/components/tickets/activity-tab";
import { AttachmentsCard } from "@/components/tickets/attachments";
import { EmailPanel } from "@/components/tickets/email-panel";
import { ContractCard } from "@/components/tickets/contract-card";
import { ConversationTab } from "@/components/tickets/conversation-tab";
import { LinksTab } from "@/components/tickets/links-tab";
import { PropertiesPanel } from "@/components/tickets/properties-panel";
import { ResolutionTab } from "@/components/tickets/resolution-tab";
import { ScopeCard } from "@/components/tickets/scope-card";
import { RequesterCard, ServiceLevels, WatchCard } from "@/components/tickets/sla-rail";
import { SolutionsRail } from "@/components/tickets/solutions-rail";
import { SyncCard } from "@/components/tickets/sync-card";
import { TimeTab } from "@/components/tickets/time-tab";
import { TransitionMenu } from "@/components/tickets/transition-menu";
import { WORK_AREA_TABS } from "@/components/tickets/work-area-tabs";
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
import { useCatalogs } from "@/lib/tickets/use-catalogs";
import { useGetTicketQuery, usePatchTicketMutation } from "@/redux/ticketsApi";

const TERMINAL = new Set(["closed", "cancelled", "rejected"]);

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
  // One catalogs call, once the account is known: asking before the ticket
  // arrives fetched the bare catalogs and then the account's (finding 24).
  const catalogs = useCatalogs(ticket?.account_id, { skip: !ticket });
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
      <div className="grid gap-4 xl:grid-cols-[320px_1fr_300px]">
        <PropertiesPanel ticket={ticket} readOnly={readOnly} />
        <Panel title="Work area" flush>
          <div className="px-4 pt-2">
            <TabBar tabs={WORK_AREA_TABS} active={tab} onChange={setTab} />
          </div>
          <div className="p-4">
            {tab === "conversation" ? (
              <ConversationTab ticketKey={ticket.key} requesterLine={requesterLine} readOnly={readOnly} />
            ) : null}
            {tab === "activity" ? <ActivityTab ticketKey={ticket.key} /> : null}
            {tab === "email" ? <EmailPanel ticketKey={ticket.key} /> : null}
            {tab === "time" ? (
              <TimeTab
                ticketKey={ticket.key}
                catalogs={catalogs}
                readOnly={readOnly}
                accountId={ticket.account_id}
                contractId={ticket.contract_id}
              />
            ) : null}
            {tab === "links" ? <LinksTab ticketKey={ticket.key} readOnly={readOnly} /> : null}
            {tab === "resolution" ? <ResolutionTab ticket={ticket} catalogs={catalogs} /> : null}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <ServiceLevels sla={ticket.sla} fetchedAt={fetchedAt} pausedReason={ticket.state_label} />
          <ScopeCard ticket={ticket} />
          <AttachmentsCard ticketKey={ticket.key} readOnly={readOnly} />
          <SolutionsRail ticketKey={ticket.key} readOnly={readOnly} />
          <ContractCard accountId={ticket.account_id} contractId={ticket.contract_id} />
          <SyncCard ticketId={ticket.id} />
          <RequesterCard ticket={ticket} />
          <WatchCard ticketKey={ticket.key} watching={ticket.watching ?? true} />
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
