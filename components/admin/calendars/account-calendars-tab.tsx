"use client";

import Link from "next/link";
import { PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { formatDuration, weeklyMinutes } from "@/lib/calendars/hours";
import { useListAccountCalendarsQuery } from "@/redux/calendarsApi";
import { useMe } from "@/redux/me";

/** The account record's Calendars tab (User Experience 3.9): every calendar with the default marked, and New calendar for admin:config. */
export function AccountCalendarsTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const canWrite = me.hasPermission("admin:config");
  const { data, isLoading } = useListAccountCalendarsQuery(accountId);
  const active = (data ?? []).filter((row) => row.status === "active");
  const retired = (data ?? []).filter((row) => row.status === "retired");
  return (
    <Panel
      title="Business calendars"
      caption="SLA clocks start on the account default; contracts may name a regional calendar"
      actions={
        canWrite ? (
          <Link href={`/admin/accounts/${accountId}/calendars/new`} className={`${PRIMARY_BUTTON} inline-flex items-center hover:no-underline`}>
            New calendar
          </Link>
        ) : null
      }
    >
      {isLoading ? <Skeleton lines={3} /> : null}
      {data && data.length === 0 ? (
        <p className="text-xms-label text-[13px]">
          No calendar yet; SLA clocks run on the wall clock (24x7) until one is made the default.
        </p>
      ) : null}
      {data && active.length === 0 && retired.length > 0 ? (
        <p className="text-xms-label text-[13px]">Every calendar is retired; clocks run on the wall clock.</p>
      ) : null}
      <ul className="divide-xms-line divide-y" aria-label="Calendars">
        {[...active, ...retired].map((calendar) => (
          <li key={calendar.id} className="flex flex-wrap items-center gap-3 py-2 text-[13px]" data-calendar={calendar.id}>
            <Link href={`/admin/calendars/${calendar.id}`} className="text-xms-accent font-medium">
              {calendar.name}
            </Link>
            <span className="xms-mono text-xms-label text-[12px]">{calendar.time_zone}</span>
            <span className="text-xms-label text-[12px]">{formatDuration(weeklyMinutes(calendar.hours))} per week</span>
            {calendar.holidays.length > 0 ? (
              <span className="text-xms-label text-[12px]">{calendar.holidays.length} holidays</span>
            ) : null}
            <span className="ml-auto flex items-center gap-2">
              {calendar.is_default ? <SignalPill tone="ready" label="Default" /> : null}
              {calendar.status === "retired" ? <SignalPill tone="blocked" label="Retired" /> : null}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
