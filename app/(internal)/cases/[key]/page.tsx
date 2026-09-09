"use client";

import Link from "next/link";
import { KeyText } from "@/components/xms/key-link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminGate } from "@/components/admin/primitives";
import { HeaderFilters, HeaderSearch, HeaderSearchField } from "@/components/shell/content-header-bar";
import { StripSelect } from "@/components/xms/filter-select";
import { ActivityTab } from "@/components/tickets/activity-tab";
import { AttachmentsCard } from "@/components/tickets/attachments";
import { EmailPanel } from "@/components/tickets/email-panel";
import { ContractCard } from "@/components/tickets/contract-card";
import { ConversationTab } from "@/components/tickets/conversation-tab";
import { LinksTab } from "@/components/tickets/links-tab";
import { PropertiesPanel } from "@/components/tickets/properties-panel";
import { ResolutionTab } from "@/components/tickets/resolution-tab";
import { ScopeCard } from "@/components/tickets/scope-card";
import { ServiceLevels, WatchCard } from "@/components/tickets/sla-rail";
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
import { ChevronDownIcon, ICON, MoreIcon } from "@/components/xms/icons";
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
  // The strip is shared chrome, and the prototype draws it on the record as

  // it draws it on the Cases list. Here it states what the thread holds and what

  // to find in it, which is why the conversation card carries no toggle.

  const [shows, setShows] = useState<"all" | "replies" | "notes">("all");

  const [find, setFind] = useState("");
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
      <EmptyBanner title={`${ticketKey} is not on your accounts`} action={{ label: "Back to Cases", href: "/cases" }} />
    );
  }
  const readOnly = TERMINAL.has(ticket.state);
  const tight = tighterClock(ticket.sla);
  const requesterLine = ticket.requester
    ? `Emails the requester (${ticket.requester.email}) and the watchers`
    : "No requester email on this ticket; watchers are notified in app";

  return (
    <div className="flex flex-col" data-ticket={ticket.key}>
      {/* The record bar (v3 render 02): the key in mono beside the title as
          plain text on one line, then the pill row. The built bar wrapped the
          title in a bordered input, which reads as a form field on a page that
          is not a form, and carried a back link the render does not have: the
          sidebar and the browser are the way back. The title is still editable
          on click, through the stacked field's own text-until-clicked shape. */}
      <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
        <KeyText ticketKey={ticket.key} />
        <div className="min-w-0 max-w-[520px] flex-1">
          <RecordForm
            layout="stacked"
            className="[&_label]:sr-only [&>div]:gap-0 [&>div]:border-b-0 [&>div]:py-0 [&_button]:truncate [&_button]:text-[14px] [&_button]:leading-[1.4] [&_button]:font-normal [&_span]:truncate [&_span]:text-[14px] [&_span]:leading-[1.4] [&_span]:font-normal"
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
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <TransitionMenu ticket={ticket} />
        {/* The render (02) carries the state, the priority and the clock in
            this row and nothing else: the type is a Properties row, and a
            second coloured mark here competed with the state pill. */}
        <PriorityPill
          priority={ticket.priority}
          className="border-xms-line-strong bg-xms-card text-xms-ink xms-mono rounded-[999px] border px-[14px] py-[9px] text-[13px] leading-none font-medium"
        />
        {tight ? (
          // The chip the lists carry, in the record bar: the dot takes the
          // signal so a breached clock is red here as it is in a row, and
          // the value says what it is counting ("3h 12m left", render 02)
          // rather than standing as a bare number beside a blue dot that
          // never changed.
          <span className="border-xms-neutral-line bg-xms-neutral-bg text-xms-neutral-ink xms-mono inline-flex items-center gap-2 rounded-[999px] border px-[14px] py-[9px] text-[13px] leading-none font-medium">
            <SlaValue
              snapshot={clockSnapshot(tight)}
              dot
              verbose
              kind={tight.kind === "response" ? "Response" : "Resolution"}
              className="text-xms-neutral-ink text-[13px]"
            />
          </span>
        ) : null}
        {readOnly ? (
          <span className="aix-state-pill" data-state="complete">
            Read only: {ticket.state_label}
          </span>
        ) : null}
        {/* The more menu sits on the right of the record bar. The render puts
            Ask Axel beside it, and it is out until the Axel turn surface it
            opens is built: a control that opens an empty frame is not a
            control. */}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={more}
            onClick={() => setMore((open) => !open)}
            className="border-xms-line-strong bg-xms-card text-xms-body hover:text-xms-ink flex items-center justify-center rounded-[5px] border px-[14px] py-[11px] leading-none"
          >
            <MoreIcon size={ICON.field} />
          </button>
        </span>
      </div>
      {more ? (
        <div className="xms-card ml-auto flex w-[240px] flex-col p-1 text-[13px]" role="menu">
          <Link
            href="/cases"
            role="menuitem"
            className="hover:bg-xms-row-hover text-xms-body rounded-[4px] px-3 py-2 hover:no-underline"
          >
            Back to Cases
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
      {/* The prototype's own three columns (`proto-v3/template.pretty.html`):
          `display:flex;align-items:flex-start;gap:16px`, a 262px rail on each
          side, and `flex:1;min-width:0` for the work area. The built grid was
          320px and 300px, which took 96px off the middle column and made the
          whole screen read left-heavy. */}
      <div className="grid items-start gap-4 xl:grid-cols-[262px_minmax(0,1fr)_262px]">
        <PropertiesPanel ticket={ticket} readOnly={readOnly} />
        {/* The tabs are the card header in the render (02 to 07): there is no
            "Work area" title above them. */}
        <section className="xms-card flex min-w-0 flex-col" aria-label="Work area">
          <TabBar tabs={WORK_AREA_TABS} active={tab} onChange={setTab} />
          <div className="p-[18px]">
            {tab === "conversation" ? (
              <ConversationTab
                ticketKey={ticket.key}
                requesterLine={requesterLine}
                readOnly={readOnly}
                shows={shows}
                find={find}
              />
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
        {tab === "conversation" ? (
          <>
            <HeaderFilters>
              <StripSelect
                primary
                label="Show"
                value={shows}
                display={shows === "all" ? "Everything" : shows === "replies" ? "Public replies" : "Work notes"}
                onChange={(value) => setShows(value as "all" | "replies" | "notes")}
              >
                <option value="all">Show: Everything</option>
                <option value="replies">Show: Public replies</option>
                <option value="notes">Show: Work notes</option>
              </StripSelect>
            </HeaderFilters>
            <HeaderSearch>
              <HeaderSearchField value={find} onChange={setFind} label="Search this ticket" />
            </HeaderSearch>
          </>
        ) : null}

        <div className="flex flex-col gap-[14px]">
          <ServiceLevels
            sla={ticket.sla}
            fetchedAt={fetchedAt}
            pausedReason={ticket.state_label}
            metAt={{ response: ticket.first_response_at, resolution: ticket.resolved_at }}
          />
          {/* The prototype's rail carries three cards and no more: Service
              levels, Contract, Similar solutions, ending at 980px in its own
              markup. Scope, attachments and watching are this build's own, so
              they stand behind one disclosure underneath rather than adding a
              fourth, fifth and sixth card to a column the prototype ends. The
              requester card is gone: the property names the person and the
              composer footer names the address. */}
          <ContractCard accountId={ticket.account_id} contractId={ticket.contract_id} />
          <SolutionsRail ticketKey={ticket.key} readOnly={readOnly} />
          <details className="xms-card group p-0">
            <summary className="text-xms-body hover:text-xms-accent flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-medium">
              <ChevronDownIcon
                size={ICON.control}
                className="text-xms-ink-faint transition-transform group-open:rotate-0 -rotate-90"
              />
              More on this ticket
            </summary>
            <div className="flex flex-col gap-[14px] px-4 pb-4">
              <ScopeCard ticket={ticket} />
              <AttachmentsCard ticketKey={ticket.key} readOnly={readOnly} />
              <WatchCard ticketKey={ticket.key} watching={ticket.watching ?? true} />
            </div>
          </details>
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
