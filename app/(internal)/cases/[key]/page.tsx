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
import { LIVE_REFRESH_MS } from "@/lib/refresh";
import { clockDisplay, clockSnapshot, tighterClock, type ClockView } from "@/lib/tickets/sla";
import { useCatalogs, type DeskCatalogs } from "@/lib/tickets/use-catalogs";
import { useGetTicketQuery, type TicketView } from "@/redux/ticketsApi";

const TERMINAL = new Set(["closed", "cancelled", "rejected"]);

type Shows = "all" | "replies" | "notes";

const SHOWS_LABEL: Record<Shows, string> = {
  all: "Everything",
  replies: "Public replies",
  notes: "Work notes",
};

/**
 * The chip the lists carry. A breached clock takes the overdue trio and a
 * size above the body, so it reads before the actions rather than beside
 * them; a running clock keeps the neutral chip.
 */
function SlaChip({ clock }: { clock: ClockView }) {
  // The same signal the chip's own words use. `clock.breached` is the
  // server's latched flag and is not set on every clock that is past due.
  const breached = clockDisplay(clock).tone === "breach";
  return (
    <span
      className={
        breached
          ? "xms-breach-pill"
          : "border-xms-neutral-line bg-xms-neutral-bg text-xms-neutral-ink xms-mono inline-flex items-center gap-2 rounded-pill border px-[14px] py-[9px] text-body leading-none font-medium"
      }
      data-breached={breached ? "true" : undefined}
    >
      <SlaValue
        snapshot={clockSnapshot(clock)}
        dot={!breached}
        verbose
        kind={clock.kind === "response" ? "Response" : "Resolution"}
        className={breached ? "text-inherit" : "text-xms-neutral-ink text-body"}
      />
    </span>
  );
}

export interface RecordBarProps {
  ticket: TicketView;
  readOnly: boolean;
  moreOpen: boolean;
  onMoreToggle: () => void;
}

/**
 * The record bar: "Case" and the key on the left, the actions on the right,
 * as ServiceNow's form header reads. The title is a row of the form below
 * (Short description), where ServiceNow keeps it.
 */
function RecordBar({ ticket, readOnly, moreOpen, onMoreToggle }: RecordBarProps) {
  const tight = tighterClock(ticket.sla);
  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <span className="text-xms-label text-body">Case</span>
      <KeyText ticketKey={ticket.key} className="text-lead font-semibold" />
      {readOnly ? (
        <span className="aix-state-pill" data-state="complete">
          Read only: {ticket.state_label}
        </span>
      ) : null}
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {tight ? <SlaChip clock={tight} /> : null}
        <FollowButton ticketKey={ticket.key} watching={ticket.watching ?? true} />
        <TransitionMenu ticket={ticket} />
        <button
          type="button"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={onMoreToggle}
          className="border-xms-line-strong bg-xms-card text-xms-body hover:text-xms-ink flex h-[32px] items-center justify-center rounded-control border px-[10px] leading-none"
        >
          <MoreIcon size={ICON.field} />
        </button>
      </span>
    </div>
  );
}

export interface MoreMenuProps {
  onClose: () => void;
}

function MoreMenu({ onClose }: MoreMenuProps) {
  const { push } = useToast();
  return (
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
          onClose();
        }}
        className="hover:bg-xms-row-hover text-xms-body rounded-control px-3 py-2 text-left"
      >
        Copy link to this ticket
      </button>
    </div>
  );
}

export interface NotesCardProps {
  ticket: TicketView;
  readOnly: boolean;
  catalogs: DeskCatalogs;
  tab: string;
  onTabChange: (tab: string) => void;
  shows: Shows;
  find: string;
}

/**
 * Notes: what a person writes on the case. ServiceNow's form puts its Notes
 * and Closure Information tabs under the fields, and its Notes tab opens on
 * the watch list and the work notes list, which is what the participants card
 * is here.
 */
function NotesCard({ ticket, readOnly, catalogs, tab, onTabChange, shows, find }: NotesCardProps) {
  const requesterLine = ticket.requester
    ? `Emails the requester (${ticket.requester.email}) and the watchers`
    : "No requester email on this ticket; watchers are notified in app";
  return (
    <section className="xms-card flex min-w-0 flex-col" aria-label="Notes">
      {/* Each card names itself above its tabs, so the three parts of the
          record read as three parts and not as one long page of tabs. */}
      <p className="text-xms-ink px-4 pt-3 text-body font-semibold">Notes</p>
      <TabBar tabs={NOTES_TABS} active={tab} onChange={onTabChange} />
      <div className="flex flex-col gap-4 p-[18px]">
        {tab === "notes" ? (
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
        {tab === "closure" ? <ResolutionTab ticket={ticket} catalogs={catalogs} /> : null}
      </div>
    </section>
  );
}

export interface ThreadStripProps {
  shows: Shows;
  onShowsChange: (shows: Shows) => void;
  find: string;
  onFindChange: (find: string) => void;
}

function ThreadStrip({ shows, onShowsChange, find, onFindChange }: ThreadStripProps) {
  return (
    <>
      <HeaderFilters>
        <StripSelect
          primary
          label="Show"
          value={shows}
          display={SHOWS_LABEL[shows]}
          onChange={(value) => onShowsChange(value as Shows)}
        >
          <option value="all">Show: Everything</option>
          <option value="replies">Show: Public replies</option>
          <option value="notes">Show: Work notes</option>
        </StripSelect>
      </HeaderFilters>
      <HeaderSearch>
        <HeaderSearchField value={find} onChange={onFindChange} label="Search this ticket" />
      </HeaderSearch>
    </>
  );
}

export interface RelatedListsProps {
  ticket: TicketView;
  readOnly: boolean;
  catalogs: DeskCatalogs;
  fetchedAt: Date | undefined;
  tab: string;
  onTabChange: (tab: string) => void;
}

/**
 * Related lists: the lists that hang off the case, SLAs first as ServiceNow
 * orders them. Each tab mounts its own surface, so a list that is never
 * opened is never read.
 */
function RelatedLists({ ticket, readOnly, catalogs, fetchedAt, tab, onTabChange }: RelatedListsProps) {
  const clocks = [ticket.sla.response, ticket.sla.resolution].filter((clock): clock is ClockView => Boolean(clock));
  // ServiceNow counts its related lists in the tab ("SLAs (4)"); the one
  // count this screen already holds without another read is the clocks.
  const tabs = RELATED_TABS.map((entry) => (entry.key === "slas" ? { ...entry, count: clocks.length } : entry));
  return (
    <section className="xms-card flex min-w-0 flex-col" aria-label="Related lists">
      <p className="text-xms-ink px-4 pt-3 text-body font-semibold">Related lists</p>
      <TabBar tabs={tabs} active={tab} onChange={onTabChange} />
      <div className="p-[18px]">
        {tab === "slas" ? (
          <SlaTable
            sla={ticket.sla}
            fetchedAt={fetchedAt}
            pausedReason={ticket.state_label}
            metAt={{ response: ticket.first_response_at, resolution: ticket.resolved_at }}
          />
        ) : null}
        {tab === "time" ? (
          <TimeTab
            ticketKey={ticket.key}
            catalogs={catalogs}
            readOnly={readOnly}
            accountId={ticket.account_id}
            contractId={ticket.contract_id}
          />
        ) : null}
        {tab === "attachments" ? <AttachmentsCard ticketKey={ticket.key} readOnly={readOnly} /> : null}
        {tab === "links" ? <LinksTab ticketKey={ticket.key} readOnly={readOnly} /> : null}
        {tab === "email" ? <EmailPanel ticketKey={ticket.key} /> : null}
        {tab === "activity" ? <ActivityTab ticketKey={ticket.key} /> : null}
        {tab === "solutions" ? <SolutionsRail ticketKey={ticket.key} readOnly={readOnly} /> : null}
        {tab === "contract" ? <ContractCard accountId={ticket.account_id} contractId={ticket.contract_id} /> : null}
        {tab === "scope" ? <ScopeCard ticket={ticket} /> : null}
        {tab === "sync" ? <SyncCard ticketId={ticket.id} flush /> : null}
      </div>
    </section>
  );
}

/**
 * The ticket record, laid out the ServiceNow way (Matt's direction
 * 2026-09-15 from the CSM case form the team works in today): the record bar
 * with the key and the actions, the two-column form, the Notes card with the
 * conversation and the closure information, and the Related lists card with
 * the SLAs first. It supersedes the v3 render's three-column page for this
 * screen; the tokens, the pills, the tab row and the parts themselves are
 * unchanged, only where they sit.
 *
 * The record's view state lives here rather than in the cards, so a poll that
 * fails for a moment and swaps the record for the banner does not reset the
 * tabs, the menu or the thread filter when it comes back.
 */
function TicketRecord({ ticketKey }: { ticketKey: string }) {
  const {
    data: ticket,
    isLoading,
    isError,
    fulfilledTimeStamp,
  } = useGetTicketQuery(ticketKey, { refetchOnFocus: true, pollingInterval: LIVE_REFRESH_MS });
  const [notesTab, setNotesTab] = useState("notes");
  const [relatedTab, setRelatedTab] = useState("slas");
  const [more, setMore] = useState(false);
  // The strip is shared chrome, and it states what the thread holds and what
  // to find in it, which is why the conversation card carries no toggle.
  const [shows, setShows] = useState<Shows>("all");
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

  return (
    <div className="flex flex-col gap-6" data-ticket={ticket.key}>
      <RecordBar ticket={ticket} readOnly={readOnly} moreOpen={more} onMoreToggle={() => setMore((open) => !open)} />
      {more ? <MoreMenu onClose={() => setMore(false)} /> : null}
      <CaseForm ticket={ticket} readOnly={readOnly} />
      <NotesCard
        ticket={ticket}
        readOnly={readOnly}
        catalogs={catalogs}
        tab={notesTab}
        onTabChange={setNotesTab}
        shows={shows}
        find={find}
      />
      {notesTab === "notes" ? (
        <ThreadStrip shows={shows} onShowsChange={setShows} find={find} onFindChange={setFind} />
      ) : null}
      <RelatedLists
        ticket={ticket}
        readOnly={readOnly}
        catalogs={catalogs}
        fetchedAt={fetchedAt}
        tab={relatedTab}
        onTabChange={setRelatedTab}
      />
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
