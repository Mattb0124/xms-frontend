"use client";

import { useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { describeRosterError, rosterError } from "@/lib/roster/errors";
import { ISO_WEEKDAYS, formatHours } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { useSetPersonCalendarMutation, type PersonCalendar } from "@/redux/rosterApi";

export interface CalendarTabProps {
  personId: string;
  calendar: PersonCalendar | null;
  /** capacity:manage; without it the controls are read only. */
  canEdit: boolean;
  timeZone: string;
}

const DEFAULT_CALENDAR: PersonCalendar = {
  working_days: [1, 2, 3, 4, 5],
  day_start: "09:00",
  day_end: "17:00",
  hours_per_day: "8.00",
};

/**
 * The working calendar (Capacity & Allocation functional 5.3): working
 * days as ISO numbers, the day's start and end in the person's time zone.
 * Hours per day is the API's derivation, shown and never computed here.
 */
export function CalendarTab({ personId, calendar, canEdit, timeZone }: CalendarTabProps) {
  const current = calendar ?? DEFAULT_CALENDAR;
  const [days, setDays] = useState<number[]>(current.working_days);
  const [dayStart, setDayStart] = useState(current.day_start);
  const [dayEnd, setDayEnd] = useState(current.day_end);
  const [seen, setSeen] = useState(calendar);
  if (seen !== calendar) {
    setSeen(calendar);
    setDays(current.working_days);
    setDayStart(current.day_start);
    setDayEnd(current.day_end);
  }
  const [save, { isLoading }] = useSetPersonCalendarMutation();
  const { push } = useToast();
  const track = useTrack("roster.calendar.save");
  const [error, setError] = useState<string | null>(null);
  const disabled = !canEdit || isLoading;

  return (
    <Panel
      title="Working calendar"
      caption={calendar ? `Hours in ${timeZone}` : "Calendar missing: capacity excludes this person until one is saved"}
    >
      <form
        className="flex flex-col gap-4"
        aria-label="Working calendar"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const saved = await save({
              id: personId,
              body: { working_days: [...days].sort((a, b) => a - b), day_start: dayStart, day_end: dayEnd },
            }).unwrap();
            track({ person_id: personId, working_days: saved.working_days.length });
            push({ title: "Calendar saved", detail: `${formatHours(saved.hours_per_day)} per day`, tone: "success" });
          } catch (caught) {
            setError(describeRosterError(rosterError(caught)));
          }
        }}
      >
        <fieldset className="border-xms-line rounded-[4px] border p-3" disabled={disabled}>
          <legend className="xms-caption px-1">Working days</legend>
          <div className="flex flex-wrap gap-3">
            {ISO_WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  value={day.value}
                  checked={days.includes(day.value)}
                  aria-label={day.label}
                  onChange={() =>
                    setDays((previous) =>
                      previous.includes(day.value) ? previous.filter((d) => d !== day.value) : [...previous, day.value],
                    )
                  }
                />
                <span className="text-xms-ink">{day.short}</span>
                <span className="xms-mono text-xms-muted text-[14px]">{day.value}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <FieldRow label="Day starts" htmlFor="cal-start">
          <input
            id="cal-start"
            type="time"
            step={300}
            required
            className={`${INPUT} xms-mono`}
            value={dayStart}
            disabled={disabled}
            onChange={(e) => setDayStart(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Day ends" htmlFor="cal-end">
          <input
            id="cal-end"
            type="time"
            step={300}
            required
            className={`${INPUT} xms-mono`}
            value={dayEnd}
            disabled={disabled}
            onChange={(e) => setDayEnd(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Hours per day">
          <span className="xms-mono text-xms-ink text-[14px]" data-testid="hours-per-day">
            {calendar ? formatHours(calendar.hours_per_day) : "not saved yet"}
          </span>
        </FieldRow>
        <InlineError message={error} />
        {canEdit ? (
          <div>
            <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading || days.length === 0}>
              Save calendar
            </button>
          </div>
        ) : (
          <p className="text-xms-label text-[14px]">Needs capacity:manage to change.</p>
        )}
      </form>
    </Panel>
  );
}
