"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/components/admin/primitives";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { CalendarSubscribe } from "@/components/tickets/calendar-subscribe";
import { FilterSelect } from "@/components/xms/filter-select";
import { KeyLink } from "@/components/xms/key-link";
import { MonthSelect } from "@/components/xms/month-select";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { daysUntil, monthLabel, monthRange, nextWindow } from "@/lib/tickets/change-window";
import { ticketGroupStatusLabel } from "@/lib/tickets/groups";
import {
  useChangeCalendarQuery,
  useChangeWindowAtQuery,
  useListGrantedAccountsQuery,
  type ChangeCalendarWindow,
} from "@/redux/ticketsApi";

/**
 * "Right now" for one account (TM-18). The server answers it from the same
 * rules the transition gate uses, so this line and the refusal a worker
 * would earn cannot disagree. The route takes one account, so it is drawn
 * only once an account is chosen; with several granted and none chosen, the
 * screen says which question it cannot answer rather than answering it for
 * an account nobody named.
 */
function RightNow({ accountId }: { accountId: string }) {
  const { data, isLoading } = useChangeWindowAtQuery({ account_id: accountId });
  if (isLoading && !data) return <Skeleton lines={2} />;
  if (!data) return null;
  const tone = data.inside ? "ready" : data.frozen ? "blocked" : "needs-input";
  const label = data.inside ? "Inside a change window" : data.frozen ? "Frozen right now" : "Outside every window";
  return (
    <div className="flex flex-col gap-2" data-right-now={data.inside ? "inside" : data.frozen ? "frozen" : "outside"}>
      <div className="flex flex-wrap items-center gap-3">
        <SignalPill tone={tone} label={label} />
        <span className="xms-mono text-xms-label text-[14px]">{formatDate(data.at)}</span>
      </div>
      {data.windows.length === 0 ? (
        <p className="text-xms-label text-[14px]">
          No window holds this instant, so the state that touches production cannot be entered without an override.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-[14px]">
          {data.windows.map((window) => (
            <li key={window.id} className="text-xms-body">
              <span className="text-xms-ink font-medium">{window.name}</span>{" "}
              <span className="xms-mono text-xms-label text-[14px]">
                {formatDate(window.starts_at)} to {formatDate(window.ends_at)}
              </span>
              {window.freeze ? (
                <span className="text-[color:var(--state-overdue-text)]">
                  {" "}
                  frozen{window.freeze.reason ? `: ${window.freeze.reason}` : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One window on the month, with its freezes and the changes planned inside it. */
function WindowCard({ window, accountName }: { window: ChangeCalendarWindow; accountName: string }) {
  return (
    <li className="border-xms-line flex flex-col gap-2 border-b px-4 py-3 last:border-b-0" data-window={window.id}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xms-ink text-[14px] font-semibold">{window.name}</span>
        <SignalPill
          tone={window.status === "active" ? "ready" : "needs-input"}
          label={ticketGroupStatusLabel(window.status)}
        />
        <span className="text-xms-label text-[14px]">{accountName}</span>
        <span className="xms-mono text-xms-label ml-auto text-[14px]">
          {formatDate(window.starts_at)} to {formatDate(window.ends_at)}
        </span>
      </div>
      {window.freeze_windows.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[14px]" data-freezes>
          {window.freeze_windows.map((freeze) => (
            <li key={`${freeze.starts_at}-${freeze.ends_at}`} className="text-[color:var(--state-overdue-text)]">
              <span className="xms-mono">
                Freeze {formatDate(freeze.starts_at)} to {formatDate(freeze.ends_at)}
              </span>
              {freeze.reason ? `: ${freeze.reason}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xms-label text-[14px]">No freeze inside this window.</p>
      )}
      {window.tickets.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[14px]" data-tickets>
          {window.tickets.map((ticket) => (
            <li key={ticket.id} className="flex items-center gap-2">
              <KeyLink ticketKey={ticket.key} />
              <span className="text-xms-body truncate">{ticket.short_description}</span>
              <span className="text-xms-label text-[14px]">{ticket.state.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xms-label text-[14px]">Nothing is planned in this window yet.</p>
      )}
    </li>
  );
}

/**
 * The change calendar (`/cases/change-calendar`, TM-18; functional 5.13):
 * the change windows over a month with their freezes and the changes planned
 * inside them, the next window to open, and whether the desk is inside one
 * right now. Every judgement is the server's; the browser draws it.
 */
export function ChangeCalendarScreen() {
  const { data: accounts } = useListGrantedAccountsQuery();
  const [anchor, setAnchor] = useState(() => new Date());
  const [accountId, setAccountId] = useState("");
  const range = monthRange(anchor);
  const { data, isLoading } = useChangeCalendarQuery({ ...range, account_id: accountId || undefined });
  const now = new Date();
  const windows = data?.windows ?? [];
  const next = nextWindow(windows, now);
  const accountName = (id: string) => accounts?.find((account) => account.id === id)?.name ?? id;
  // The "at" route takes one account, so the line is drawn for the chosen
  // account, or for the only granted one where there is just one.
  const atAccount = accountId || (accounts?.length === 1 ? accounts[0].id : "");
  const month = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-4">
      {/* The two dimensions stand on the grey strip, which was empty while a
          native account select and three month buttons sat in a card header
          inside the page. */}
      <HeaderFilters>
        <MonthSelect primary month={month} onChange={(value) => setAnchor(new Date(`${value}-01T00:00:00Z`))} />
        <FilterSelect
          label="Account"
          value={accountId}
          options={(accounts ?? []).map((account) => ({ value: account.id, label: account.name }))}
          onChange={setAccountId}
        />
      </HeaderFilters>
      {/* The feed the screen can be read through, for anyone who would rather
          see the windows in their own calendar than open this one. */}
      <CalendarSubscribe />
      <Panel
        title="Right now"
        caption="CHANGE WINDOWS"
        subtitle="Whether work may go out at this moment, answered by the same rules the transition gate uses."
      >
        {atAccount ? (
          <RightNow accountId={atAccount} />
        ) : (
          <p className="text-xms-label text-[14px]">
            Choose an account to see whether it is inside a change window right now.
          </p>
        )}
      </Panel>

      <Panel
        title={monthLabel(anchor)}
        caption="CALENDAR"
        subtitle="Change windows overlapping this month, with their freezes and the changes planned inside them."
        flush
      >
        <div className="border-xms-line border-b px-4 py-2 text-[14px]" data-next-window>
          {next ? (
            <span className="text-xms-body">
              Next window: <span className="text-xms-ink font-medium">{next.name}</span>{" "}
              <span className="xms-mono text-xms-label text-[14px]">{formatDate(next.starts_at)}</span>
              {daysUntil(next.starts_at, now) >= 0 ? (
                <span className="text-xms-label">
                  , in {daysUntil(next.starts_at, now)} day{daysUntil(next.starts_at, now) === 1 ? "" : "s"}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-xms-label">No window opens later this month.</span>
          )}
        </div>
        {isLoading && !data ? (
          <div className="p-4">
            <Skeleton lines={5} />
          </div>
        ) : windows.length === 0 ? (
          <p className="text-xms-label p-4 text-[14px]">
            No change window falls in this month.{" "}
            <Link href="/cases/groups" className="xms-link">
              The groups catalog
            </Link>{" "}
            is where one is created.
          </p>
        ) : (
          <ul className="flex flex-col" aria-label="Change windows">
            {windows.map((window) => (
              <WindowCard key={window.id} window={window} accountName={accountName(window.account_id)} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
