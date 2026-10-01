"use client";

import { useMemo, useState } from "react";
import { HoursGrid } from "@/components/admin/calendars/hours-grid";
import { ConfirmButton, FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SwitchRow } from "@/components/admin/primitives";
import { TimeZoneField } from "@/components/admin/time-zone-field";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { calendarBody, calendarPatch, draftFromCalendar, type CalendarDraft } from "@/lib/calendars/draft";
import { describeCalendarError, calendarError } from "@/lib/calendars/errors";
import {
  draftGrid,
  formatDuration,
  gridToHours,
  hoursToGrid,
  standardGrid,
  weeklyMinutes,
  type DraftWeekGrid,
  type GridConversion,
} from "@/lib/calendars/hours";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useCreateCalendarMutation,
  useListHolidayCalendarsQuery,
  usePatchCalendarMutation,
  type BusinessCalendar,
  type CalendarHours,
  type HolidayCalendar,
} from "@/redux/calendarsApi";

export interface CalendarFieldsProps {
  calendar?: BusinessCalendar;
  draft: CalendarDraft;
  onChange: (patch: Partial<CalendarDraft>) => void;
  libraries: HolidayCalendar[];
  busy: boolean;
}

/** The Calendar panel: name, zone, holiday library, a new calendar's effective date, and the account default. */
function CalendarFields({ calendar, draft, onChange, libraries, busy }: CalendarFieldsProps) {
  const retired = calendar?.status === "retired";
  return (
    <Panel
      title="Calendar"
      caption={
        calendar
          ? `version ${calendar.version}, effective from ${calendar.effective_from}`
          : "Working hours in a named zone"
      }
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
            value={draft.name}
            disabled={busy || retired}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </FieldRow>
        <FieldRow label="Time zone" htmlFor="calendar-tz">
          <TimeZoneField
            id="calendar-tz"
            value={draft.time_zone}
            onChange={(value) => onChange({ time_zone: value })}
            required
            disabled={busy || retired}
          />
        </FieldRow>
        <FieldRow label="Holiday library" htmlFor="calendar-holidays">
          <select
            id="calendar-holidays"
            className={INPUT}
            value={draft.holiday_calendar_id}
            disabled={busy || retired}
            onChange={(event) => onChange({ holiday_calendar_id: event.target.value })}
          >
            <option value="">No holidays</option>
            {libraries.map((row) => (
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
              value={draft.effective_from}
              disabled={busy}
              onChange={(event) => onChange({ effective_from: event.target.value })}
            />
          </FieldRow>
        ) : null}
        <SwitchRow
          id="calendar-default"
          label="Account default"
          detail={calendar?.is_default ? "Already the default" : "SLA clocks on this account start on the default"}
          checked={draft.make_default}
          disabled={busy || retired || calendar?.is_default}
          onChange={(value) => onChange({ make_default: value })}
        />
      </div>
    </Panel>
  );
}

export interface WorkingHoursPanelProps {
  grid: DraftWeekGrid;
  onChange: (next: DraftWeekGrid) => void;
  /** The grid as minutes, which the caption totals. */
  hours: CalendarHours[];
  /** In the server's words, from the local check or from its refusal. */
  problems: string[];
  disabled: boolean;
}

function WorkingHoursPanel({ grid, onChange, hours, problems, disabled }: WorkingHoursPanelProps) {
  return (
    <Panel
      title="Working hours"
      caption={`${formatDuration(weeklyMinutes(hours))} per week across ${hours.length} interval${hours.length === 1 ? "" : "s"}`}
    >
      <HoursGrid value={grid} onChange={onChange} disabled={disabled} />
      {problems.length > 0 ? (
        <ul
          role="alert"
          className="mt-3 list-disc pl-5 text-body text-[color:var(--state-overdue-text)]"
          data-testid="hour-problems"
        >
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

export interface CalendarActionsProps {
  calendar?: BusinessCalendar;
  busy: boolean;
  error: string | null;
  onRetire: (calendar: BusinessCalendar) => Promise<void>;
}

function CalendarActions({ calendar, busy, error, onRetire }: CalendarActionsProps) {
  const retired = calendar?.status === "retired";
  return (
    <div className="flex items-center gap-2">
      {!retired ? (
        <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
          {calendar ? "Save calendar" : "Create calendar"}
        </button>
      ) : null}
      {calendar && !retired ? (
        <ConfirmButton label="Retire" danger disabled={busy} onConfirm={() => onRetire(calendar)} />
      ) : null}
      {retired ? <span className="text-xms-label text-body">A retired calendar cannot be edited.</span> : null}
      <InlineError message={error} />
    </div>
  );
}

export interface HolidaysPanelProps {
  calendar?: BusinessCalendar;
  libraries: HolidayCalendar[];
  /** The library chosen on the form, saved or not. */
  holidayId: string;
}

/** The chosen library's dates, falling back to the saved calendar's own while that library is not in the list. */
function HolidaysPanel({ calendar, libraries, holidayId }: HolidaysPanelProps) {
  const library = libraries.find((row) => row.id === holidayId);
  const holidays =
    library?.holidays ?? (calendar && calendar.holiday_calendar_id === holidayId ? calendar.holidays : []);
  return (
    <Panel
      title="Holidays"
      caption={library ? `${library.country} ${library.name}` : "From the chosen library, read only"}
    >
      {holidays.length === 0 ? <p className="text-xms-label text-body">No holidays on this calendar.</p> : null}
      <ul className="divide-xms-line max-h-[420px] divide-y overflow-auto text-body" aria-label="Holiday dates">
        {holidays.map((holiday) => (
          <li key={holiday.date} className="flex items-center gap-3 py-1.5">
            <span className="xms-mono text-xms-accent">{holiday.date}</span>
            <span className="text-xms-ink">{holiday.label}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The fields and the week grid, read again from the calendar whenever its version moves. */
function useCalendarDraft(calendar?: BusinessCalendar) {
  const [draft, setDraft] = useState(() => draftFromCalendar(calendar));
  const [grid, setGrid] = useState<DraftWeekGrid>(() =>
    draftGrid(calendar ? hoursToGrid(calendar.hours) : standardGrid()),
  );
  const [seenVersion, setSeenVersion] = useState(calendar?.version);
  if (calendar && seenVersion !== calendar.version) {
    setSeenVersion(calendar.version);
    setDraft(draftFromCalendar(calendar));
    setGrid(draftGrid(hoursToGrid(calendar.hours)));
  }
  const set = (patch: Partial<CalendarDraft>) => setDraft((previous) => ({ ...previous, ...patch }));
  return { draft, set, grid, setGrid };
}

/** Save, create and retire, with the hour problems and the refusal each can come back with. */
function useCalendarSave({ accountId, calendar, refetch, onCreated }: CalendarEditorProps) {
  const [create, { isLoading: creating }] = useCreateCalendarMutation();
  const [patch, { isLoading: patching }] = usePatchCalendarMutation();
  const onError = useMutationErrors(refetch);
  const { push } = useToast();
  const track = useTrack("calendar.save");
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const saveChanges = async (existing: BusinessCalendar, draft: CalendarDraft, hours: CalendarHours[]) => {
    const body = calendarPatch(existing, draft, hours);
    if (Object.keys(body).length === 1) {
      push({ title: "Nothing to save", tone: "info" });
      return;
    }
    await patch({ id: existing.id, body }).unwrap();
    track({
      calendar_id: existing.id,
      account_id: accountId,
      fields: Object.keys(body).length - 1,
      created: false,
    });
    push({ title: "Calendar saved", tone: "success" });
  };

  const createCalendar = async (draft: CalendarDraft, hours: CalendarHours[]) => {
    const created = await create({ accountId, body: calendarBody(draft, hours) }).unwrap();
    track({ calendar_id: created.id, account_id: accountId, intervals: hours.length, created: true });
    push({
      title: "Calendar created",
      detail: created.is_default ? "It is the account default." : undefined,
      tone: "success",
    });
    onCreated?.(created);
  };

  const submit = async (draft: CalendarDraft, conversion: GridConversion) => {
    setError(null);
    setProblems([]);
    if (conversion.problems.length > 0) {
      setProblems(conversion.problems);
      return;
    }
    try {
      if (calendar) await saveChanges(calendar, draft, conversion.hours);
      else await createCalendar(draft, conversion.hours);
    } catch (caught) {
      const parsed = calendarError(caught);
      if (parsed.code === "invalid_hours" && parsed.problems) setProblems(parsed.problems);
      if (parsed.code === "stale_version") onError(caught);
      else setError(describeCalendarError(parsed));
    }
  };

  const retire = async (existing: BusinessCalendar) => {
    try {
      await patch({ id: existing.id, body: { version: existing.version, status: "retired" } }).unwrap();
      track({ calendar_id: existing.id, account_id: accountId, retired: true });
      push({
        title: "Calendar retired",
        detail: existing.is_default ? "The account has no default until another is chosen." : undefined,
        tone: "info",
      });
    } catch (caught) {
      onError(caught);
    }
  };

  return { submit, retire, busy: creating || patching, problems, error };
}

export interface CalendarEditorProps {
  accountId: string;
  /** Absent for a new calendar. */
  calendar?: BusinessCalendar;
  refetch?: () => unknown;
  onCreated?: (calendar: BusinessCalendar) => void;
}

/**
 * The calendar editor (Accounts & Administration functional 5.7; TM-06):
 * name, IANA zone, holiday library with its dates read only, the week
 * grid, make default and, for an existing calendar, retire. Hour problems
 * are checked locally in the server's words and again by the server.
 */
export function CalendarEditor({ accountId, calendar, refetch, onCreated }: CalendarEditorProps) {
  const libraries = useListHolidayCalendarsQuery();
  const { draft, set, grid, setGrid } = useCalendarDraft(calendar);
  const save = useCalendarSave({ accountId, calendar, refetch, onCreated });
  const conversion = useMemo(() => gridToHours(grid), [grid]);
  const retired = calendar?.status === "retired";

  return (
    <form
      className="grid gap-4 xl:grid-cols-[1fr_360px]"
      aria-label={calendar ? "Edit calendar" : "New calendar"}
      onSubmit={(event) => {
        event.preventDefault();
        void save.submit(draft, conversion);
      }}
    >
      <div className="flex flex-col gap-4">
        <CalendarFields
          calendar={calendar}
          draft={draft}
          onChange={set}
          libraries={libraries.data ?? []}
          busy={save.busy}
        />
        <WorkingHoursPanel
          grid={grid}
          onChange={setGrid}
          hours={conversion.hours}
          problems={save.problems}
          disabled={save.busy || retired}
        />
        <CalendarActions calendar={calendar} busy={save.busy} error={save.error} onRetire={save.retire} />
      </div>
      <HolidaysPanel calendar={calendar} libraries={libraries.data ?? []} holidayId={draft.holiday_calendar_id} />
    </form>
  );
}
