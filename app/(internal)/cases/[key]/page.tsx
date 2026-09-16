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
import { CaseForm } from "@/components/tickets/case-form";
import { EmailPanel } from "@/components/tickets/email-panel";
import { ContractCard } from "@/components/tickets/contract-card";
import { ConversationTab } from "@/components/tickets/conversation-tab";
import { LinksTab } from "@/components/tickets/links-tab";
import { ResolutionTab } from "@/components/tickets/resolution-tab";
import { ParticipantsCard } from "@/components/tickets/participants-card";
import { NOTES_TABS, RELATED_TABS } from "@/components/tickets/record-tabs";
import { ScopeCard } from "@/components/tickets/scope-card";
import { FollowButton } from "@/components/tickets/sla-rail";
import { SlaTable } from "@/components/tickets/sla-table";
import { SolutionsRail } from "@/components/tickets/solutions-rail";
import { SyncCard } from "@/components/tickets/sync-card";
import { TimeTab } from "@/components/tickets/time-tab";
import { TransitionMenu } from "@/components/tickets/transition-menu";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { SlaValue } from "@/components/xms/sla-value";
import { ICON, MoreIcon } from "@/components/xms/icons";
import { TabBar } from "@/components/xms/tab-bar";
import { useToast } from "@/components/xms/toast";
import { clockDisplay, clockSnapshot, tighterClock, type ClockView } from "@/lib/tickets/sla";
import { useCatalogs } from "@/lib/tickets/use-catalogs";
import { useGetTicketQuery } from "@/redux/ticketsApi";

const TERMINAL = new Set(["closed", "cancelled", "rejected"]);

/**
 * The ticket record, laid out the ServiceNow way (Matt's direction
 * 2026-09-15 from the CSM case form the team works in today): the record bar
 * with the key and the actions, the two-column form, the Notes card with the
 * conversation and the closure information, and the Related lists card with
 * the SLAs first. It supersedes the v3 render's three-column page for this
 * screen; the tokens, the pills, the tab row and the parts themselves are
 * unchanged, only where they sit.
 */
function TicketRecord({ ticketKey }: { ticketKey: string }) {
  const {
    data: ticket,
    isLoading,
    isError,
    fulfilledTimeStamp,
  } = useGetTicketQuery(ticketKey, { refetchOnFocus: true, pollingInterval: 60_000 });
  const { push } = useToast();
  const [notesTab, setNotesTab] = useState("notes");
  const [relatedTab, setRelatedTab] = useState("slas");
  const [more, setMore] = useState(false);
  // The strip is shared chrome, and it states what the thread holds and what
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
  // The same signal the chip's own words use. `clock.breached` is the
  // server's latched flag and is not set on every clock that is past due.
  const tightBreached = tight ? clockDisplay(tight).tone === "breach" : false;
  const requesterLine = ticket.requester
    ? `Emails the requester (${ticket.requester.email}) and the watchers`
    : "No requester email on this ticket; watchers are notified in app";
  const clocks = [ticket.sla.response, ticket.sla.resolution].filter((clock): clock is ClockView => Boolean(clock));
  // ServiceNow counts its related lists in the tab ("SLAs (4)"); the one
  // count this screen already holds without another read is the clocks.
  const relatedTabs = RELATED_TABS.map((tab) => (tab.key === "slas" ? { ...tab, count: clocks.length } : tab));

  return (
    <div className="flex flex-col gap-6" data-ticket={ticket.key}>
      {/* The record bar: "Case" and the key on the left, the actions on the
          right, as ServiceNow's form header reads. The title is a row of the
          form below (Short description), where ServiceNow keeps it. */}
      <div className="flex flex-wrap items-center gap-[10px]">
        <span className="text-xms-label text-body">Case</span>
        <KeyText ticketKey={ticket.key} className="text-lead font-semibold" />
        {readOnly ? (
          <span className="aix-state-pill" data-state="complete">
            Read only: {ticket.state_label}
          </span>
        ) : null}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {tight ? (
            // The chip the lists carry. A breached clock takes the overdue
            // trio and a size above the body, so it reads before the actions
            // rather than beside them; a running clock keeps the neutral chip.
            <span
              className={
                tightBreached
                  ? "xms-breach-pill"
                  : "border-xms-neutral-line bg-xms-neutral-bg text-xms-neutral-ink xms-mono inline-flex items-center gap-2 rounded-pill border px-[14px] py-[9px] text-body leading-none font-medium"
              }
              data-breached={tightBreached ? "true" : undefined}
            >
              <SlaValue
                snapshot={clockSnapshot(tight)}
                dot={!tightBreached}
                verbose
                kind={tight.kind === "response" ? "Response" : "Resolution"}
                className={tightBreached ? "text-inherit" : "text-xms-neutral-ink text-body"}
              />
            </span>
          ) : null}
          <FollowButton ticketKey={ticket.key} watching={ticket.watching ?? true} />
          <TransitionMenu ticket={ticket} />
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={more}
            onClick={() => setMore((open) => !open)}
            className="border-xms-line-strong bg-xms-card text-xms-body hover:text-xms-ink flex h-[32px] items-center justify-center rounded-control border px-[10px] leading-none"
          >
            <MoreIcon size={ICON.field} />
          </button>
        </span>
      </div>
      {more ? (
        <div className="xms-card xms-enter-pop ml-auto flex w-[240px] flex-col p-1 text-body" role="menu">
          <Link
            href="/cases"
            role="menuitem"
            className="hover:bg-xms-row-hover text-xms-body rounded-control px-3 py-2 hover:no-underline"
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
            className="hover:bg-xms-row-hover text-xms-body rounded-control px-3 py-2 text-left"
          >
            Copy link to this ticket
          </button>
        </div>
      ) : null}

      <CaseForm ticket={ticket} readOnly={readOnly} />

      {/* Notes: what a person writes on the case. ServiceNow's form puts its
          Notes and Closure Information tabs under the fields, and its Notes
          tab opens on the watch list and the work notes list, which is what
          the participants card is here. */}
      <section className="xms-card flex min-w-0 flex-col" aria-label="Notes">
        {/* Each card names itself above its tabs, so the three parts of the
            record read as three parts and not as one long page of tabs. */}
        <p className="text-xms-ink px-4 pt-3 text-body font-semibold">Notes</p>
        <TabBar tabs={NOTES_TABS} active={notesTab} onChange={setNotesTab} />
        <div className="flex flex-col gap-4 p-[18px]">
          {notesTab === "notes" ? (
            <>
              <ParticipantsCard ticketKey={ticket.key} readOnly={readOnly} />
              <ConversationTab
                ticketKey={ticket.key}
                requesterLine={requesterLine}
                readOnly={readOnly}
                shows={shows}
                find={find}
              />
            </>
          ) : null}
          {notesTab === "closure" ? <ResolutionTab ticket={ticket} catalogs={catalogs} /> : null}
        </div>
      </section>
      {notesTab === "notes" ? (
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

      {/* Related lists: the lists that hang off the case, SLAs first as
          ServiceNow orders them. Each tab mounts its own surface, so a list
          that is never opened is never read. */}
      <section className="xms-card flex min-w-0 flex-col" aria-label="Related lists">
        <p className="text-xms-ink px-4 pt-3 text-body font-semibold">Related lists</p>
        <TabBar tabs={relatedTabs} active={relatedTab} onChange={setRelatedTab} />
        <div className="p-[18px]">
          {relatedTab === "slas" ? (
            <SlaTable
              sla={ticket.sla}
              fetchedAt={fetchedAt}
              pausedReason={ticket.state_label}
              metAt={{ response: ticket.first_response_at, resolution: ticket.resolved_at }}
            />
          ) : null}
          {relatedTab === "time" ? (
            <TimeTab
              ticketKey={ticket.key}
              catalogs={catalogs}
              readOnly={readOnly}
              accountId={ticket.account_id}
              contractId={ticket.contract_id}
            />
          ) : null}
          {relatedTab === "attachments" ? <AttachmentsCard ticketKey={ticket.key} readOnly={readOnly} /> : null}
          {relatedTab === "links" ? <LinksTab ticketKey={ticket.key} readOnly={readOnly} /> : null}
          {relatedTab === "email" ? <EmailPanel ticketKey={ticket.key} /> : null}
          {relatedTab === "activity" ? <ActivityTab ticketKey={ticket.key} /> : null}
          {relatedTab === "solutions" ? <SolutionsRail ticketKey={ticket.key} readOnly={readOnly} /> : null}
          {relatedTab === "contract" ? (
            <ContractCard accountId={ticket.account_id} contractId={ticket.contract_id} />
          ) : null}
          {relatedTab === "scope" ? <ScopeCard ticket={ticket} /> : null}
          {relatedTab === "sync" ? <SyncCard ticketId={ticket.id} flush /> : null}
        </div>
      </section>
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
