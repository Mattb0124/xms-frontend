"use client";

import { useMemo, useState } from "react";
import { HoursGrid } from "@/components/admin/calendars/hours-grid";
import { ConfirmButton, FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SwitchRow } from "@/components/admin/primitives";
import { TimeZoneField } from "@/components/admin/time-zone-field";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { describeCalendarError, calendarError } from "@/lib/calendars/errors";
import { formatDuration, gridToHours, hoursToGrid, standardGrid, weeklyMinutes, type WeekGrid } from "@/lib/calendars/hours";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useCreateCalendarMutation,
  useListHolidayCalendarsQuery,
  usePatchCalendarMutation,
  type BusinessCalendar,
  type CalendarHours,
  type PatchCalendarBody,
} from "@/redux/calendarsApi";

export interface CalendarEditorProps {
  accountId: string;
  /** Absent for a new calendar. */
  calendar?: BusinessCalendar;
  refetch?: () => unknown;
  onCreated?: (calendar: BusinessCalendar) => void;
}

function sameHours(a: CalendarHours[], b: CalendarHours[]): boolean {
  const key = (rows: CalendarHours[]) =>
    rows
      .map((row) => `${row.weekday}:${row.start_minute}-${row.end_minute}`)
      .sort()
      .join(",");
  return key(a) === key(b);
}

/** The PATCH body: only what changed against the loaded calendar, plus the version. */
export function calendarPatch(
  calendar: BusinessCalendar,
  draft: { name: string; time_zone: string; holiday_calendar_id: string; make_default: boolean },
  hours: CalendarHours[],
): PatchCalendarBody {
  const body: PatchCalendarBody = { version: calendar.version };
  if (draft.name.trim() !== calendar.name && draft.name.trim() !== "") body.name = draft.name.trim();
  if (draft.time_zone.trim() !== calendar.time_zone && draft.time_zone.trim() !== "") body.time_zone = draft.time_zone.trim();
  if ((draft.holiday_calendar_id || null) !== calendar.holiday_calendar_id)
    body.holiday_calendar_id = draft.holiday_calendar_id || null;
  if (!sameHours(hours, calendar.hours)) body.hours = hours;
  if (draft.make_default && !calendar.is_default) body.make_default = true;
  return body;
}

/**
 * The calendar editor (Accounts & Administration functional 5.7; TM-06):
 * name, IANA zone, holiday library with its dates read only, the week
 * grid, make default and, for an existing calendar, retire. Hour problems
 * are checked locally in the server's words and again by the server.
 */
export function CalendarEditor({ accountId, calendar, refetch, onCreated }: CalendarEditorProps) {
  const libraries = useListHolidayCalendarsQuery();
  const [create, { isLoading: creating }] = useCreateCalendarMutation();
  const [patch, { isLoading: patching }] = usePatchCalendarMutation();
  const onError = useMutationErrors(refetch);
  const { push } = useToast();
  const track = useTrack("calendar.save");
  const [name, setName] = useState(calendar?.name ?? "");
  const [timeZone, setTimeZone] = useState(calendar?.time_zone ?? "UTC");
  const [holidayId, setHolidayId] = useState(calendar?.holiday_calendar_id ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [makeDefault, setMakeDefault] = useState(calendar?.is_default ?? false);
  const [grid, setGrid] = useState<WeekGrid>(() => (calendar ? hoursToGrid(calendar.hours) : standardGrid()));
  const [seenVersion, setSeenVersion] = useState(calendar?.version);
  if (calendar && seenVersion !== calendar.version) {
    setSeenVersion(calendar.version);
    setName(calendar.name);
    setTimeZone(calendar.time_zone);
    setHolidayId(calendar.holiday_calendar_id ?? "");
    setMakeDefault(calendar.is_default);
    setGrid(hoursToGrid(calendar.hours));
  }
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const retired = calendar?.status === "retired";
  const busy = creating || patching;

  const conversion = useMemo(() => gridToHours(grid), [grid]);
  const library = useMemo(
    () => (libraries.data ?? []).find((row) => row.id === holidayId),
    [libraries.data, holidayId],
  );
  const holidays = library?.holidays ?? (calendar && calendar.holiday_calendar_id === holidayId ? calendar.holidays : []);

  const submit = async () => {
    setError(null);
    setProblems([]);
    if (conversion.problems.length > 0) {
      setProblems(conversion.problems);
      return;
    }
    try {
      if (calendar) {
        const body = calendarPatch(calendar, { name, time_zone: timeZone, holiday_calendar_id: holidayId, make_default: makeDefault }, conversion.hours);
        if (Object.keys(body).length === 1) {
          push({ title: "Nothing to save", tone: "info" });
          return;
        }
        await patch({ id: calendar.id, body }).unwrap();
        track({ calendar_id: calendar.id, account_id: accountId, fields: Object.keys(body).length - 1, created: false });
        push({ title: "Calendar saved", tone: "success" });
      } else {
        const created = await create({
          accountId,
          body: {
            name: name.trim(),
            time_zone: timeZone.trim(),
            holiday_calendar_id: holidayId || undefined,
            effective_from: effectiveFrom || undefined,
            hours: conversion.hours,
            make_default: makeDefault || undefined,
          },
        }).unwrap();
        track({ calendar_id: created.id, account_id: accountId, intervals: conversion.hours.length, created: true });
        push({ title: "Calendar created", detail: created.is_default ? "It is the account default." : undefined, tone: "success" });
        onCreated?.(created);
      }
    } catch (caught) {
      const parsed = calendarError(caught);
      if (parsed.code === "invalid_hours" && parsed.problems) setProblems(parsed.problems);
      if (parsed.code === "stale_version") onError(caught);
      else setError(describeCalendarError(parsed));
    }
  };

  return (
    <form
      className="grid gap-4 xl:grid-cols-[1fr_360px]"
      aria-label={calendar ? "Edit calendar" : "New calendar"}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-4">
        <Panel
          title="Calendar"
          caption={calendar ? `version ${calendar.version}, effective from ${calendar.effective_from}` : "Working hours in a named zone"}
          actions={
            calendar ? (
              <>
                {calendar.is_default ? <SignalPill tone="ready" label="Default" /> : null}
                {retired ? <SignalPill tone="blocked" label="Retired" /> : <SignalPill tone="complete" label="Active" />}
              </>
            ) : null
          }
        >
          <div className="flex flex-col gap-3">
            <FieldRow label="Name" htmlFor="calendar-name">
              <input
                id="calendar-name"
                required
                maxLength={80}
                className={INPUT}
                value={name}
                disabled={busy || retired}
                onChange={(event) => setName(event.target.value)}
              />
            </FieldRow>
            <FieldRow label="Time zone" htmlFor="calendar-tz">
              <TimeZoneField id="calendar-tz" value={timeZone} onChange={setTimeZone} required disabled={busy || retired} />
            </FieldRow>
            <FieldRow label="Holiday library" htmlFor="calendar-holidays">
              <select
                id="calendar-holidays"
                className={INPUT}
                value={holidayId}
                disabled={busy || retired}
                onChange={(event) => setHolidayId(event.target.value)}
              >
                <option value="">No holidays</option>
                {(libraries.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.country} {row.name}
                  </option>
                ))}
              </select>
            </FieldRow>
            {!calendar ? (
              <FieldRow label="Effective from" htmlFor="calendar-effective">
                <input
                  id="calendar-effective"
                  type="date"
                  className={INPUT}
                  value={effectiveFrom}
                  disabled={busy}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
              </FieldRow>
            ) : null}
            <SwitchRow
              id="calendar-default"
              label="Account default"
              detail={calendar?.is_default ? "Already the default" : "SLA clocks on this account start on the default"}
              checked={makeDefault}
              disabled={busy || retired || calendar?.is_default}
              onChange={setMakeDefault}
            />
          </div>
        </Panel>
        <Panel
          title="Working hours"
          caption={`${formatDuration(weeklyMinutes(conversion.hours))} per week across ${conversion.hours.length} interval${conversion.hours.length === 1 ? "" : "s"}`}
        >
          <HoursGrid value={grid} onChange={setGrid} disabled={busy || retired} />
          {problems.length > 0 ? (
            <ul role="alert" className="mt-3 list-disc pl-5 text-[12px] text-[color:var(--state-overdue-text)]" data-testid="hour-problems">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <div className="flex items-center gap-2">
          {!retired ? (
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
              {calendar ? "Save calendar" : "Create calendar"}
            </button>
          ) : null}
          {calendar && !retired ? (
            <ConfirmButton
              label="Retire"
              danger
              disabled={busy}
              onConfirm={async () => {
                try {
                  await patch({ id: calendar.id, body: { version: calendar.version, status: "retired" } }).unwrap();
                  track({ calendar_id: calendar.id, account_id: accountId, retired: true });
                  push({ title: "Calendar retired", detail: calendar.is_default ? "The account has no default until another is chosen." : undefined, tone: "info" });
                } catch (caught) {
                  onError(caught);
                }
              }}
            />
          ) : null}
          {retired ? <span className="text-xms-label text-[12px]">A retired calendar cannot be edited.</span> : null}
          <InlineError message={error} />
        </div>
      </div>
      <Panel title="Holidays" caption={library ? `${library.country} ${library.name}` : "From the chosen library, read only"}>
        {holidays.length === 0 ? <p className="text-xms-label text-[13px]">No holidays on this calendar.</p> : null}
        <ul className="divide-xms-line max-h-[420px] divide-y overflow-auto text-[13px]" aria-label="Holiday dates">
          {holidays.map((holiday) => (
            <li key={holiday.date} className="flex items-center gap-3 py-1.5">
              <span className="xms-mono text-xms-accent">{holiday.date}</span>
              <span className="text-xms-ink">{holiday.label}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </form>
  );
}
