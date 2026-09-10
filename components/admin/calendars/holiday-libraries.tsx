"use client";

import { useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { describeCalendarError, calendarError } from "@/lib/calendars/errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useCreateHolidayCalendarMutation,
  useListHolidayCalendarsQuery,
  type Holiday,
  type HolidayCalendar,
} from "@/redux/calendarsApi";

/** Parses pasted "YYYY-MM-DD<tab or comma>Label" lines into holidays; blank and malformed lines are skipped. */
export function parseHolidayLines(text: string): Holiday[] {
  const rows: Holiday[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(\d{4}-\d{2}-\d{2})\s*[,\t; ]\s*(.+?)\s*$/.exec(line);
    if (match) rows.push({ date: match[1], label: match[2] });
  }
  return rows;
}

export function HolidayLibraryList({ rows, loading }: { rows: HolidayCalendar[]; loading?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title="Holiday libraries" caption="Shared by account and person calendars">
      {loading ? <Skeleton lines={3} /> : null}
      {!loading && rows.length === 0 ? <p className="text-xms-label text-[14px]">No library yet.</p> : null}
      <ul className="divide-xms-line divide-y" aria-label="Holiday libraries">
        {rows.map((library) => (
          <li key={library.id} className="py-2 text-[14px]" data-library={library.id}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="xms-mono text-xms-accent font-medium">{library.country}</span>
              <span className="text-xms-ink font-medium">{library.name}</span>
              <span className="text-xms-label text-[14px]">{library.holidays.length} dates</span>
              <button
                type="button"
                className="text-xms-accent ml-auto text-[14px]"
                aria-expanded={open === library.id}
                onClick={() => setOpen((current) => (current === library.id ? null : library.id))}
              >
                {open === library.id ? "Hide dates" : "Show dates"}
              </button>
            </div>
            {open === library.id ? (
              <ul className="mt-2 grid gap-1 pl-2 sm:grid-cols-2" aria-label={`Dates of ${library.name}`}>
                {library.holidays.map((holiday) => (
                  <li key={holiday.date} className="flex gap-2">
                    <span className="xms-mono text-xms-label">{holiday.date}</span>
                    <span className="text-xms-body">{holiday.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function NewHolidayLibraryForm({ onCreated }: { onCreated?: (library: HolidayCalendar) => void }) {
  const [create, { isLoading }] = useCreateHolidayCalendarMutation();
  const track = useTrack("holiday_calendar.create");
  const [country, setCountry] = useState("");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Holiday[]>([{ date: "", label: "" }]);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valid = rows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.label.trim() !== "");

  return (
    <Panel title="New holiday library" caption="A country's public holidays for one or more years">
      <form
        className="flex flex-col gap-3"
        aria-label="New holiday library"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const created = await create({
              country: country.trim().toUpperCase(),
              name: name.trim(),
              holidays: valid.map((row) => ({ date: row.date, label: row.label.trim() })),
            }).unwrap();
            track({ holiday_calendar_id: created.id, country: created.country, holidays: created.holidays.length });
            setCountry("");
            setName("");
            setRows([{ date: "", label: "" }]);
            setPasted("");
            onCreated?.(created);
          } catch (caught) {
            setError(describeCalendarError(calendarError(caught)));
          }
        }}
      >
        <FieldRow label="Country" htmlFor="library-country">
          <input
            id="library-country"
            required
            minLength={2}
            maxLength={2}
            placeholder="GB"
            className={`${INPUT} xms-mono w-[80px]`}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
        </FieldRow>
        <FieldRow label="Name" htmlFor="library-name">
          <input
            id="library-name"
            required
            maxLength={120}
            placeholder="England and Wales 2027"
            className={INPUT}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FieldRow>
        <fieldset className="border-xms-line rounded-[4px] border p-3">
          <legend className="xms-caption px-1">Dates</legend>
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label={`Holiday ${index + 1} date`}
                  className={`${INPUT} xms-mono w-[170px]`}
                  value={row.date}
                  onChange={(event) =>
                    setRows(rows.map((r, i) => (i === index ? { ...r, date: event.target.value } : r)))
                  }
                />
                <input
                  aria-label={`Holiday ${index + 1} label`}
                  placeholder="Label"
                  maxLength={120}
                  className={INPUT}
                  value={row.label}
                  onChange={(event) =>
                    setRows(rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove holiday ${index + 1}`}
                  className="text-xms-muted hover:text-xms-ink text-[14px] leading-none"
                  onClick={() =>
                    setRows(rows.length === 1 ? [{ date: "", label: "" }] : rows.filter((_, i) => i !== index))
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={() => setRows([...rows, { date: "", label: "" }])}
              >
                Add date
              </button>
            </div>
          </div>
        </fieldset>
        <FieldRow label="Or paste lines" htmlFor="library-paste">
          <textarea
            id="library-paste"
            rows={3}
            placeholder={"2027-01-01, New Year's Day\n2027-04-02, Good Friday"}
            className={`${INPUT} xms-mono h-auto py-2`}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            onBlur={() => {
              const parsed = parseHolidayLines(pasted);
              if (parsed.length === 0) return;
              setRows((current) => [...current.filter((row) => row.date || row.label), ...parsed]);
              setPasted("");
            }}
          />
        </FieldRow>
        <InlineError message={error} />
        <div className="flex items-center gap-3">
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
            Create library
          </button>
          <span className="text-xms-label text-[14px]">
            {valid.length} valid date{valid.length === 1 ? "" : "s"}
          </span>
        </div>
      </form>
    </Panel>
  );
}

/** The admin page body: the list beside the create form. */
export function HolidayLibraries() {
  const { data, isLoading } = useListHolidayCalendarsQuery();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_440px]">
      <HolidayLibraryList rows={data ?? []} loading={isLoading} />
      <NewHolidayLibraryForm />
    </div>
  );
}
