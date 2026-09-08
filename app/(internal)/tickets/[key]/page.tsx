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
import { PriorityPill } from "@/components/xms/priority-pill";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { SlaValue } from "@/components/xms/sla-value";
import { MoreIcon } from "@/components/xms/icons";
import { TabBar } from "@/components/xms/tab-bar";
import { useToast } from "@/components/xms/toast";
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
  const [more, setMore] = useState(false);
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
    <div className="flex flex-col gap-5" data-ticket={ticket.key}>
      {/* The record bar (v3 render 02): the key in mono beside the title as
          plain text on one line, then the pill row. The built bar wrapped the
          title in a bordered input, which reads as a form field on a page that
          is not a form, and carried a back link the render does not have: the
          sidebar and the browser are the way back. The title is still editable
          on click, through the stacked field's own text-until-clicked shape. */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="xms-mono text-xms-accent text-[13px] font-medium">{ticket.key}</span>
        <div className="min-w-[280px] flex-1">
          <RecordForm
            layout="stacked"
            className="[&_label]:sr-only [&>div]:border-b-0 [&>div]:px-0 [&>div]:py-0 [&_button]:text-[15px] [&_button]:font-medium"
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
      <div className="flex flex-wrap items-center gap-2">
        <TransitionMenu ticket={ticket} />
        {/* The render (02) carries the state, the priority and the clock in
            this row and nothing else: the type is a Properties row, and a
            second coloured mark here competed with the state pill. */}
        <PriorityPill priority={ticket.priority} className="h-[32px] rounded-[999px] px-[14px] text-[13px]" />
        {tight ? (
          <span className="border-xms-line bg-xms-card inline-flex h-[32px] items-center gap-2 rounded-[999px] border px-[14px] text-[13px]">
            <span aria-hidden data-clock-dot className="bg-xms-accent h-[7px] w-[7px] shrink-0 rounded-[999px]" />
            <span className="text-xms-body">{tight.kind === "response" ? "Response" : "Resolution"}</span>
            <SlaValue snapshot={clockSnapshot(tight)} />
          </span>
        ) : null}
        {readOnly ? (
          <span className="aix-state-pill" data-state="complete">
            Read only: {ticket.state_label}
          </span>
        ) : null}
        {/* Ask Axel and the more menu sit on the right of the record bar
            (render 02). Ask Axel opens the shell's own Axel panel; the panel
            body is held, so it opens the frame and nothing more. */}
        <span className="ml-auto flex items-center gap-2">
          <Link
            href={`/tickets/${ticket.key}?axel=1`}
            className="border-xms-line bg-xms-card text-xms-ink hover:border-xms-accent hover:text-xms-accent inline-flex h-[32px] items-center rounded-[6px] border px-3 text-[13px] font-medium hover:no-underline"
          >
            Ask Axel
          </Link>
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={more}
            onClick={() => setMore((open) => !open)}
            className="border-xms-line bg-xms-card text-xms-label hover:text-xms-ink flex h-[32px] w-[38px] items-center justify-center rounded-[6px] border"
          >
            <MoreIcon size={16} />
          </button>
        </span>
      </div>
      {more ? (
        <div className="xms-card ml-auto flex w-[240px] flex-col p-1 text-[13px]" role="menu">
          <Link
            href="/tickets"
            role="menuitem"
            className="hover:bg-xms-row-hover text-xms-body rounded-[4px] px-3 py-2 hover:no-underline"
          >
            Back to the Queue
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              push({ title: "Link copied", tone: "success" });
              setMore(false);
            }}
            className="hover:bg-xms-row-hover text-xms-body rounded-[4px] px-3 py-2 text-left"
          >
            Copy link to this ticket
          </button>
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[320px_1fr_300px]">
        <PropertiesPanel ticket={ticket} readOnly={readOnly} />
        {/* The tabs are the card header in the render (02 to 07): there is no
            "Work area" title above them. */}
        <section className="xms-card flex min-w-0 flex-col" aria-label="Work area">
          <TabBar tabs={WORK_AREA_TABS} active={tab} onChange={setTab} className="px-3 pt-1" />
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
            {tab === "sync" ? <SyncCard ticketId={ticket.id} flush /> : null}
          </div>
        </section>
        <div className="flex flex-col gap-5">
          <ServiceLevels sla={ticket.sla} fetchedAt={fetchedAt} pausedReason={ticket.state_label} />
          <ScopeCard ticket={ticket} />
          <AttachmentsCard ticketKey={ticket.key} readOnly={readOnly} />
          <SolutionsRail ticketKey={ticket.key} readOnly={readOnly} />
          <ContractCard accountId={ticket.account_id} contractId={ticket.contract_id} />
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
