"use client";

import { useState } from "react";
import { FieldRow, INPUT, InlineError, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { describeCalendarError, calendarError } from "@/lib/calendars/errors";
import { formatDuration, formatInZone, localToIso, viewerTimeZone } from "@/lib/calendars/hours";
import { useTrack } from "@/lib/telemetry/provider";
import { usePreviewCalendarMutation, type PreviewResult } from "@/redux/calendarsApi";

export interface PreviewPanelProps {
  calendarId: string;
  timeZone: string;
  /** Injected for the tests; defaults to the browser's zone. */
  viewerZone?: string;
}

function defaultStart(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** The preview result: due in both zones, the working and wall minutes, and whether the start was inside hours. */
export function PreviewResultView({
  result,
  timeZone,
  viewerZone,
}: {
  result: PreviewResult;
  timeZone: string;
  viewerZone: string;
}) {
  return (
    <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1 text-[13px]" data-testid="preview-result">
      <dt className="text-xms-label">Due ({timeZone})</dt>
      <dd className="xms-mono text-xms-ink font-medium">{formatInZone(result.due_at, timeZone)}</dd>
      {viewerZone !== timeZone ? (
        <>
          <dt className="text-xms-label">Due (your zone, {viewerZone})</dt>
          <dd className="xms-mono text-xms-ink">{formatInZone(result.due_at, viewerZone)}</dd>
        </>
      ) : null}
      <dt className="text-xms-label">Working minutes</dt>
      <dd className="xms-mono text-xms-ink">
        {result.working_minutes_between} ({formatDuration(result.working_minutes_between)})
      </dd>
      <dt className="text-xms-label">Wall minutes</dt>
      <dd className="xms-mono text-xms-ink">
        {result.wall_minutes_between} ({formatDuration(result.wall_minutes_between)})
      </dd>
      <dt className="text-xms-label">Start</dt>
      <dd className="text-xms-body">
        {result.starts_in_working_time
          ? "Inside working hours"
          : "Outside working hours; the clock starts at the next working minute"}
      </dd>
    </dl>
  );
}

/**
 * "When is this due" (Accounts & Administration functional 5.7): a start
 * and a target in business minutes; the server answers and the browser
 * shows the due time in the calendar's zone and the viewer's.
 */
export function PreviewPanel({ calendarId, timeZone, viewerZone }: PreviewPanelProps) {
  const [preview, { isLoading }] = usePreviewCalendarMutation();
  const track = useTrack("calendar.preview");
  const [start, setStart] = useState(defaultStart);
  const [minutes, setMinutes] = useState("240");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const zone = viewerZone ?? viewerTimeZone();

  return (
    <Panel title="Preview" caption="Check the calendar before it is used">
      <form
        className="flex flex-col gap-3"
        aria-label="Preview"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          const iso = localToIso(start);
          if (!iso) {
            setError("The preview start must be a valid date and time.");
            return;
          }
          try {
            const answer = await preview({ id: calendarId, body: { start: iso, minutes: Number(minutes) } }).unwrap();
            setResult(answer);
            track({
              calendar_id: calendarId,
              minutes: Number(minutes),
              starts_in_working_time: answer.starts_in_working_time,
            });
          } catch (caught) {
            setError(describeCalendarError(calendarError(caught)));
          }
        }}
      >
        <FieldRow label="Start (your zone)" htmlFor="preview-start">
          <input
            id="preview-start"
            type="datetime-local"
            required
            className={`${INPUT} xms-mono`}
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </FieldRow>
        <FieldRow label="Business minutes" htmlFor="preview-minutes">
          <input
            id="preview-minutes"
            type="number"
            min={0}
            max={1_000_000}
            required
            className={`${INPUT} xms-mono`}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </FieldRow>
        <InlineError message={error} />
        <div>
          <button type="submit" className={SECONDARY_BUTTON} disabled={isLoading}>
            Compute due time
          </button>
        </div>
      </form>
      {result ? (
        <div className="border-xms-line mt-4 border-t pt-3">
          <PreviewResultView result={result} timeZone={timeZone} viewerZone={zone} />
        </div>
      ) : null}
    </Panel>
  );
}
