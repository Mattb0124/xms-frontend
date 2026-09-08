"use client";

import { useEffect, useState } from "react";
import { AdminGate, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { formatMinutes, LogTimeForm } from "@/components/tickets/time-tab";
import { BucketLog } from "@/components/time/bucket-log";
import { shiftWeek, Timesheet, weekOf } from "@/components/time/timesheet";
import { StripSelect } from "@/components/xms/filter-select";
import { ICON, CloseIcon, PlusIcon } from "@/components/xms/icons";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { useTrack } from "@/lib/telemetry/provider";
import { useCatalogs } from "@/lib/tickets/use-catalogs";
import { useLazyListTicketsQuery } from "@/redux/ticketsApi";
import { useLogTicketTimeMutation, useMyWeekQuery } from "@/redux/timeApi";

/**
 * The weeks the picker offers: one forward and eight back from the week
 * containing today, newest first. A week has no finite list of its own, so
 * the strip's primary dimension is given one rather than the three text
 * buttons that stood where the render puts a control.
 */
export function weekOptions(today: Date): { from: string; to: string }[] {
  const current = weekOf(today).from;
  const weeks: { from: string; to: string }[] = [];
  for (let back = -1; back <= 8; back += 1) {
    const week = weekOf(shiftWeek(current, -back));
    weeks.push({ from: week.from, to: week.to });
  }
  return weeks;
}

/** Log time on a ticket picked by key (User Experience 3.8). */
function TicketLog() {
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
  );
}

/**
 * The Add entry sheet: the house sheet the Time tab opens (render 04), with
 * the one control that decides which of the two forms is asked for. Both
 * forms used to stand open above the week they were about, so the screen
 * opened on two sets of fields and the entries were below the fold.
 */
function LogTimeSheet({ onClose }: { onClose: () => void }) {
  const [against, setAgainst] = useState<"ticket" | "bucket">("ticket");
  return (
    <div className="bg-xms-overlay-scrim fixed inset-0 z-40 flex items-start justify-center overflow-auto p-6">
      <div role="dialog" aria-modal="true" aria-label="Log time" className="xms-card w-full max-w-[640px] p-4">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-xms-ink flex-1 text-[15px] font-semibold">Log time</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xms-label hover:text-xms-ink">
            <CloseIcon size={ICON.tool} />
          </button>
        </div>
        <div className="mb-3">
          <StripSelect
            label="Against"
            size="lg"
            value={against}
            onChange={(value) => setAgainst(value as "ticket" | "bucket")}
            display={against === "ticket" ? "a ticket" : "an account bucket"}
          >
            <option value="ticket">Against: a ticket</option>
            <option value="bucket">Against: an account bucket</option>
          </StripSelect>
        </div>
        {against === "ticket" ? <TicketLog /> : <BucketLog />}
      </div>
    </div>
  );
}

function MyTime() {
  const [anchor, setAnchor] = useState(() => new Date());
  const week = weekOf(anchor);
  const { data, isLoading } = useMyWeekQuery({ week: week.from });
  const catalogs = useCatalogs();
  const [adding, setAdding] = useState(false);
  const [weeks] = useState(() => weekOptions(new Date()));
  const thisWeek = weeks[1]?.from;

  // The Time tab's own shortcut (render 04), on the screen that is nothing
  // but time. It is ignored while the reader is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "t") {
        event.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* The week is this screen's primary dimension, on the strip where
          every other screen puts its own. */}
      <HeaderFilters>
        <StripSelect
          label="Week"
          primary
          value={week.from}
          onChange={(value) => setAnchor(new Date(`${value}T00:00:00Z`))}
          display={week.from === thisWeek ? "this week" : `${week.from} to ${week.to}`}
        >
          {weeks.some((option) => option.from === week.from) ? null : (
            <option value={week.from}>{`Week: ${week.from} to ${week.to}`}</option>
          )}
          {weeks.map((option) => (
            <option key={option.from} value={option.from}>
              {option.from === thisWeek ? "Week: this week" : `Week: ${option.from} to ${option.to}`}
            </option>
          ))}
        </StripSelect>
      </HeaderFilters>
      <HeaderAction>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`${PRIMARY_BUTTON} inline-flex items-center gap-1`}
        >
          <PlusIcon size={ICON.action} />
          Add entry
        </button>
      </HeaderAction>
      {isLoading && !data ? (
        <Skeleton lines={8} />
      ) : (
        <Timesheet
          week={data ?? { from: week.from, to: week.to, days: [], total_minutes: 0, unlogged_minutes: 0 }}
          catalogs={catalogs}
        />
      )}
      {adding ? <LogTimeSheet onClose={() => setAdding(false)} /> : null}
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
