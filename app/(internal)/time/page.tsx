"use client";

import { useState } from "react";
import { AdminGate, INPUT, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction } from "@/components/shell/content-header-bar";
import { formatMinutes, LogTimeForm } from "@/components/tickets/time-tab";
import { shiftWeek, Timesheet, weekOf } from "@/components/time/timesheet";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { useTrack } from "@/lib/telemetry/provider";
import { useCatalogs } from "@/lib/tickets/use-catalogs";
import { useLazyListTicketsQuery } from "@/redux/ticketsApi";
import { useLogTicketTimeMutation, useMyWeekQuery } from "@/redux/timeApi";

/** Quick "Log time" on a ticket picked by key (User Experience 3.8). */
function QuickLog() {
  const catalogs = useCatalogs();
  const [search] = useLazyListTicketsQuery();
  const [log, logging] = useLogTicketTimeMutation();
  const { push } = useToast();
  const track = useTrack("time.log");
  const [ticketKey, setTicketKey] = useState("");
  const [resolved, setResolved] = useState<{ key: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setError(null);
    const key = ticketKey.trim().toUpperCase();
    if (!/^CS\d{7}$/.test(key)) {
      setError("Enter a ticket key like CS0001204.");
      return;
    }
    const found = await search({ q: key, limit: 1 }).unwrap();
    const ticket = found.items.find((item) => item.key === key);
    if (!ticket) {
      setError(`${key} was not found on your accounts.`);
      return;
    }
    setResolved({ key: ticket.key, title: ticket.short_description });
  };

  return (
    <Panel title="Log time" caption="Pick a ticket by key, then the entry">
      <div className="flex flex-col gap-3">
        <form
          aria-label="Find ticket"
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void find();
          }}
        >
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Ticket key</span>
            <input
              aria-label="Ticket key"
              value={ticketKey}
              onChange={(event) => setTicketKey(event.target.value)}
              placeholder="CS0001204"
              className={`${INPUT} xms-mono w-[160px]`}
            />
          </label>
          <button type="submit" className={SECONDARY_BUTTON}>
            Find
          </button>
          {resolved ? (
            <span className="text-xms-ink text-[13px]">
              <span className="xms-mono text-xms-accent">{resolved.key}</span> {resolved.title}
            </span>
          ) : null}
          {error ? (
            <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
              {error}
            </p>
          ) : null}
        </form>
        {resolved ? (
          <LogTimeForm
            catalogs={catalogs}
            pending={logging.isLoading}
            onSubmit={async (body) => {
              const entry = await log({ ticketKey: resolved.key, body }).unwrap();
              track({ minutes: entry.minutes, activity: entry.activity_type, via: "timesheet" });
              push({ title: `${formatMinutes(entry.minutes)} logged on ${resolved.key}`, tone: "success" });
            }}
          />
        ) : null}
      </div>
    </Panel>
  );
}

function MyTime() {
  const [anchor, setAnchor] = useState(() => new Date());
  const week = weekOf(anchor);
  const { data, isLoading } = useMyWeekQuery({ week: week.from });
  const catalogs = useCatalogs();
  return (
    <div className="flex flex-col gap-4">
      <HeaderAction>
        <div className="flex items-center gap-2 text-[12px]" role="group" aria-label="Week">
          <button type="button" onClick={() => setAnchor(shiftWeek(week.from, -1))} className={SECONDARY_BUTTON}>
            Previous week
          </button>
          <span className="xms-mono text-xms-ink">
            {week.from} to {week.to}
          </span>
          <button type="button" onClick={() => setAnchor(shiftWeek(week.from, 1))} className={SECONDARY_BUTTON}>
            Next week
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className={SECONDARY_BUTTON}>
            This week
          </button>
        </div>
      </HeaderAction>
      <QuickLog />
      {isLoading && !data ? (
        <Skeleton lines={8} />
      ) : (
        <Timesheet
          week={data ?? { from: week.from, to: week.to, days: [], total_minutes: 0, unlogged_minutes: 0 }}
          catalogs={catalogs}
        />
      )}
    </div>
  );
}

/** Registered as `time`; the week and the unlogged numbers need time:log on the API. */
export default function TimePage() {
  return (
    <AdminGate permission="time:log">
      <MyTime />
    </AdminGate>
  );
}
