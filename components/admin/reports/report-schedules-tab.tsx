"use client";

import Link from "next/link";
import { formatMoment } from "@/lib/format/date";
import { useState } from "react";
import {
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  fullName,
} from "@/components/admin/primitives";
import { DeliveryList } from "@/components/reporting/delivery-list";
import { RunStatusPill } from "@/components/reporting/reports-card";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { deadlineLine, isHeld, reviewPill } from "@/lib/reporting/review";
import {
  CADENCES,
  cadenceLabel,
  defaultPeriodKind,
  deliverySummary,
  describeScheduleError,
  draftFromSchedule,
  emptyRecipient,
  emptyScheduleDraft,
  maxRunDay,
  nextRunLabel,
  patchBody,
  PERIOD_KINDS,
  periodKindLabel,
  RECIPIENT_KINDS,
  recipientLabel,
  requestedByLabel,
  reviewRequiredNote,
  runNowBody,
  scheduleBody,
  scheduleError,
  validateRunNow,
  validateSchedule,
  type RecipientDraft,
  type ScheduleDraft,
} from "@/lib/reporting/schedules";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useListPortalUsersQuery, useListUsersQuery, type UserRecord } from "@/redux/adminApi";
import { useMe } from "@/redux/me";
import {
  useCreateReportScheduleMutation,
  usePatchReportScheduleMutation,
  useReportSchedulesQuery,
  useRunScheduleNowMutation,
  useScheduleRunsQuery,
  type RecipientKind,
  type ReportSchedule,
  type RunNowResult,
} from "@/redux/reportingApi";

const HEAD = "text-xms-ink px-3 py-2 text-left text-[12px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 py-2 align-top text-[13px]";
const SMALL = "h-[26px] px-2 text-[12px]";

export { DeliveryList };

/**
 * The review state beside the run's own status (functional 5.8), on the
 * `--state-*` signal trios: a held run needs somebody, a run past its
 * deadline is overdue, and a run review never touched carries nothing.
 */
function ReviewPill({ status }: { status: string }) {
  const pill = reviewPill(status);
  if (!pill) return null;
  return <SignalPill tone={pill.tone} label={pill.label} />;
}

function userOptions(users: UserRecord[] | undefined) {
  return (users ?? []).filter((user) => user.status !== "deactivated");
}

function RecipientRow({
  index,
  recipient,
  internalUsers,
  portalUsers,
  onChange,
  onRemove,
}: {
  index: number;
  recipient: RecipientDraft;
  internalUsers: UserRecord[];
  portalUsers: UserRecord[];
  onChange: (next: RecipientDraft) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const users = recipient.kind === "internal" ? internalUsers : recipient.kind === "portal_user" ? portalUsers : [];
  return (
    <div className="flex flex-wrap items-center gap-2" data-recipient={index}>
      <select
        aria-label={`Recipient ${n} kind`}
        className={cn(INPUT, "w-[150px]")}
        value={recipient.kind}
        onChange={(event) => onChange(emptyRecipient(event.target.value as RecipientKind))}
      >
        {RECIPIENT_KINDS.map((kind) => (
          <option key={kind.value} value={kind.value}>
            {kind.label}
          </option>
        ))}
      </select>
      {recipient.kind === "contact" ? (
        <>
          <input
            type="email"
            aria-label={`Recipient ${n} email`}
            placeholder="Email"
            className={cn(INPUT, "w-[220px]")}
            value={recipient.email}
            onChange={(event) => onChange({ ...recipient, email: event.target.value })}
          />
          <input
            aria-label={`Recipient ${n} name`}
            placeholder="Name"
            className={cn(INPUT, "w-[180px]")}
            value={recipient.name}
            onChange={(event) => onChange({ ...recipient, name: event.target.value })}
          />
        </>
      ) : (
        <select
          aria-label={`Recipient ${n} user`}
          className={cn(INPUT, "w-[300px]")}
          value={recipient.id}
          onChange={(event) => {
            const user = users.find((row) => row.id === event.target.value);
            onChange({
              ...recipient,
              id: event.target.value,
              email: user?.email ?? "",
              name: user ? fullName(user) : "",
            });
          }}
        >
          <option value="">Choose</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {fullName(user)} ({user.email})
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        className={cn(SECONDARY_BUTTON, SMALL)}
        onClick={onRemove}
        aria-label={`Remove recipient ${n}`}
      >
        Remove
      </button>
    </div>
  );
}

/** The schedule form: name, cadence, run day under the cadence's rule, run time, period, recipients, enabled. */
function ScheduleForm({
  accountId,
  title,
  draft,
  graceHours,
  onChange,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  accountId: string;
  title: string;
  draft: ScheduleDraft;
  /** The schedule's own grace period, so the sentence states the deadline it really gives. */
  graceHours?: number;
  onChange: (next: ScheduleDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const internal = useListUsersQuery({ kind: "internal" });
  const portal = useListPortalUsersQuery(accountId);
  const max = maxRunDay(draft.cadence);
  return (
    <Panel title={title} caption="The worker runs it in the account's time zone">
      <form
        className="flex flex-col gap-3"
        aria-label="Schedule"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <FieldRow label="Name" htmlFor="sched-name">
          <input
            id="sched-name"
            className={INPUT}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </FieldRow>
        <FieldRow label="Cadence" htmlFor="sched-cadence">
          <select
            id="sched-cadence"
            className={INPUT}
            value={draft.cadence}
            onChange={(event) => {
              const cadence = event.target.value as ScheduleDraft["cadence"];
              onChange({ ...draft, cadence, period_kind: defaultPeriodKind(cadence) });
            }}
          >
            {CADENCES.map((cadence) => (
              <option key={cadence.value} value={cadence.value}>
                {cadence.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Run day" htmlFor="sched-run-day">
          <div className="flex items-center gap-3">
            <input
              id="sched-run-day"
              type="number"
              min={1}
              max={max}
              className={cn(INPUT, "xms-mono w-[90px]")}
              value={draft.run_day}
              onChange={(event) => onChange({ ...draft, run_day: event.target.value })}
            />
            <span className="text-xms-label text-[12px]">
              {draft.cadence === "weekly" ? "1 (Monday) to 7 (Sunday)" : "1 to 31, the day of the month"}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Run time" htmlFor="sched-run-time">
          <input
            id="sched-run-time"
            type="time"
            className={cn(INPUT, "xms-mono w-[120px]")}
            value={draft.run_time}
            onChange={(event) => onChange({ ...draft, run_time: event.target.value })}
          />
        </FieldRow>
        <FieldRow label="Period" htmlFor="sched-period">
          <select
            id="sched-period"
            className={INPUT}
            value={draft.period_kind}
            onChange={(event) =>
              onChange({ ...draft, period_kind: event.target.value as ScheduleDraft["period_kind"] })
            }
          >
            {PERIOD_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Enabled" htmlFor="sched-enabled">
          <input
            id="sched-enabled"
            type="checkbox"
            className="h-4 w-4"
            checked={draft.enabled}
            onChange={(event) => onChange({ ...draft, enabled: event.target.checked })}
          />
        </FieldRow>
        <FieldRow label="Review before sending" htmlFor="sched-review">
          <div className="flex items-start gap-3">
            <input
              id="sched-review"
              type="checkbox"
              className="mt-[3px] h-4 w-4"
              checked={draft.review_required}
              onChange={(event) => onChange({ ...draft, review_required: event.target.checked })}
            />
            <span className="text-xms-label max-w-[520px] text-[12px]">{reviewRequiredNote(graceHours)}</span>
          </div>
        </FieldRow>
        <div className="flex flex-col gap-2">
          <span className="text-xms-label text-[12px]">Distribution</span>
          {draft.distribution.length === 0 ? (
            <p className="text-xms-label text-[12px]">No recipients yet: the pack is built and kept, nobody is told.</p>
          ) : null}
          {draft.distribution.map((recipient, index) => (
            <RecipientRow
              key={index}
              index={index}
              recipient={recipient}
              internalUsers={userOptions(internal.data)}
              portalUsers={userOptions(portal.data)}
              onChange={(next) =>
                onChange({ ...draft, distribution: draft.distribution.map((row, i) => (i === index ? next : row)) })
              }
              onRemove={() => onChange({ ...draft, distribution: draft.distribution.filter((_, i) => i !== index) })}
            />
          ))}
          <div>
            <button
              type="button"
              className={cn(SECONDARY_BUTTON, SMALL)}
              onClick={() => onChange({ ...draft, distribution: [...draft.distribution, emptyRecipient()] })}
            >
              Add recipient
            </button>
          </div>
        </div>
        <InlineError message={error} />
        <div className="flex gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>
            {saving ? "Saving" : "Save"}
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** An off-cycle run: the schedule's own period, or the one given; the outcome per recipient afterwards. */
function RunNowPanel({
  schedule,
  accountId,
  onClose,
}: {
  schedule: ReportSchedule;
  accountId: string;
  onClose: () => void;
}) {
  const [runNow, { isLoading }] = useRunScheduleNowMutation();
  const { push } = useToast();
  const track = useTrack("report.schedule.run");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunNowResult | null>(null);

  const run = async () => {
    const problem = validateRunNow(start, end);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      const outcome = await runNow({ id: schedule.id, accountId, body: runNowBody(start, end) }).unwrap();
      setResult(outcome);
      track({ account_id: accountId, schedule_id: schedule.id, run_id: outcome.run_id, status: outcome.status });
      // A schedule with review required holds its run: nothing was sent, and
      // saying it was would be the one thing functional 5.8 forbids.
      push({
        title: isHeld(outcome.status)
          ? "Report pack held for review"
          : outcome.status === "sent"
            ? "Report pack sent"
            : "Report pack built, nobody reached",
        detail: `${outcome.period.start} to ${outcome.period.end}`,
        tone: outcome.status === "failed" ? "error" : "success",
      });
    } catch (caught) {
      setError(describeScheduleError(scheduleError(caught)));
    }
  };

  return (
    <Panel
      title={`Run now: ${schedule.name}`}
      caption="Leave the period empty for the schedule's own"
      actions={
        <button type="button" className={cn(SECONDARY_BUTTON, SMALL)} onClick={onClose}>
          Close
        </button>
      }
    >
      {result ? (
        <div className="flex flex-col gap-3" data-testid="run-now-result">
          <p className="text-xms-ink flex flex-wrap items-center gap-3 text-[13px]">
            <span className="xms-mono">
              {result.period.start} to {result.period.end}
            </span>
            <RunStatusPill status={result.status} />
            <ReviewPill status={result.status} />
            {isHeld(result.status) ? (
              <Link href={`/reports/runs/${result.run_id}`} className="text-xms-accent font-medium hover:underline">
                Review it
              </Link>
            ) : null}
            <Link href={`/reports/packs/${result.pack_id}`} className="xms-link">
              Open pack
            </Link>
          </p>
          {isHeld(result.status) ? (
            <p className="text-xms-label text-[12px]">
              {deadlineLine({ status: result.status, review_due_at: result.review_due_at }) ??
                "It is waiting on a reviewer; nothing has been sent."}
            </p>
          ) : (
            <DeliveryList delivery={result.delivery} />
          )}
        </div>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          aria-label="Run now"
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Period start</span>
            <input
              type="date"
              aria-label="Period start"
              className={cn(INPUT, "xms-mono h-[30px] w-[160px] text-[12px]")}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Period end</span>
            <input
              type="date"
              aria-label="Period end"
              className={cn(INPUT, "xms-mono h-[30px] w-[160px] text-[12px]")}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
          <button type="submit" className={cn(PRIMARY_BUTTON, "h-[30px]")} disabled={isLoading}>
            {isLoading ? "Running" : "Run"}
          </button>
          <InlineError message={error} />
        </form>
      )}
    </Panel>
  );
}

/** The runs for the account, newest first: period, schedule, who asked, status, delivery and the pack. */
function RunsHistory({ accountId, schedules }: { accountId: string; schedules: ReportSchedule[] }) {
  const { data, isLoading, isError } = useScheduleRunsQuery({ account: accountId });
  const [open, setOpen] = useState<string | null>(null);
  const nameOf = (scheduleId: string | null) =>
    scheduleId ? (schedules.find((row) => row.id === scheduleId)?.name ?? "Removed schedule") : "Generated by hand";
  return (
    <Panel title="Runs" caption="Newest first" flush>
      {isLoading && !data ? (
        <div className="p-4">
          <Skeleton lines={3} />
        </div>
      ) : null}
      {isError ? <p className="text-xms-muted p-4 text-[13px]">The runs could not be loaded.</p> : null}
      {data ? (
        <table className="w-full border-collapse" aria-label="Report runs">
          <thead className="bg-xms-card">
            <tr className="border-xms-line border-b">
              <th className={HEAD}>Period</th>
              <th className={HEAD}>Schedule</th>
              <th className={HEAD}>Requested</th>
              <th className={HEAD}>Status</th>
              <th className={HEAD}>Delivery</th>
              <th className={cn(HEAD, "text-right")}>Pack</th>
            </tr>
          </thead>
          <tbody>
            {data.map((run) => {
              const expanded = open === run.id;
              return (
                <tr key={run.id} className="border-xms-line border-b" data-run={run.id} data-status={run.status}>
                  <td className={cn(CELL, "xms-mono whitespace-nowrap")}>
                    {run.period_start} to {run.period_end}
                  </td>
                  <td className={CELL}>{nameOf(run.schedule_id)}</td>
                  <td className={CELL}>
                    <span className="flex flex-col">
                      <span>{requestedByLabel(run.requested_by)}</span>
                      <span className="xms-mono text-xms-label text-[11px]">{formatMoment(run.created_at)}</span>
                    </span>
                  </td>
                  <td className={CELL}>
                    <span className="flex flex-wrap items-center gap-2">
                      <RunStatusPill status={run.status} />
                      <ReviewPill status={run.status} />
                    </span>
                    {run.error ? <span className="text-xms-label block text-[11px]">{run.error}</span> : null}
                  </td>
                  <td className={CELL}>
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span data-delivery-summary>{deliverySummary(run.delivery)}</span>
                        {run.delivery && run.delivery.length > 0 ? (
                          <button
                            type="button"
                            className={cn(SECONDARY_BUTTON, SMALL)}
                            aria-expanded={expanded}
                            aria-controls={`delivery-${run.id}`}
                            onClick={() => setOpen(expanded ? null : run.id)}
                          >
                            {expanded ? "Hide" : "Details"}
                          </button>
                        ) : null}
                      </span>
                      {expanded && run.delivery ? (
                        <div id={`delivery-${run.id}`}>
                          <DeliveryList delivery={run.delivery} />
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <span className="flex flex-wrap items-center justify-end gap-3">
                      {isHeld(run.status) ? (
                        <Link href={`/reports/runs/${run.id}`} className="text-xms-accent font-medium hover:underline">
                          Review
                        </Link>
                      ) : null}
                      {run.pack_id ? (
                        <Link href={`/reports/packs/${run.pack_id}`} className="xms-link">
                          Open pack
                        </Link>
                      ) : (
                        <span className="text-xms-muted">No pack</span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-xms-label px-4 py-8 text-center text-[13px]">
                  No runs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </Panel>
  );
}

interface Editing {
  id: string | null;
  version: number | null;
  draft: ScheduleDraft;
  /** The row's own grace period, so the review sentence names the real deadline. */
  graceHours?: number;
}

/**
 * Report packs on the account record (Dashboards functional 5.7, DR-05;
 * reports:manage, fails closed): the schedules with their cadence, day
 * and time, next run and enabled flag; a form to add or edit one (the
 * weekly 1 to 7 rule, the distribution list, saved with the version so a
 * stale_version reloads); Run now with an optional period showing the
 * delivery outcome per recipient; and the runs history with the pack.
 */
export function ReportSchedulesTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("reports:manage");
  const schedules = useReportSchedulesQuery(accountId, { skip: !allowed });
  const [create, { isLoading: creating }] = useCreateReportScheduleMutation();
  const [patch, { isLoading: patching }] = usePatchReportScheduleMutation();
  const { push } = useToast();
  const track = useTrack("report.schedule.save");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [runNowFor, setRunNowFor] = useState<string | null>(null);

  if (!allowed) {
    return (
      <Panel title="Report packs" caption="Needs the reports:manage permission">
        <p className="text-xms-label text-[13px]">You can see this account but not its report schedules.</p>
      </Panel>
    );
  }

  const save = async () => {
    if (!editing) return;
    const problem = validateSchedule(editing.draft);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    try {
      const saved =
        editing.id && editing.version !== null
          ? await patch({ id: editing.id, accountId, body: patchBody(editing.draft, editing.version) }).unwrap()
          : await create(scheduleBody(editing.draft, accountId)).unwrap();
      track({ account_id: accountId, schedule_id: saved.id, cadence: saved.cadence, enabled: saved.enabled });
      push({ title: editing.id ? "Schedule saved" : "Schedule created", detail: saved.name, tone: "success" });
      setEditing(null);
    } catch (caught) {
      const error = scheduleError(caught);
      if (error.code === "stale_version") {
        push({ title: "Reloaded", detail: describeScheduleError(error), tone: "error" });
        setEditing(null);
      } else {
        setFormError(describeScheduleError(error));
      }
    }
  };

  const running = runNowFor ? schedules.data?.find((row) => row.id === runNowFor) : undefined;

  return (
    <div className="flex flex-col gap-4" data-testid="report-schedules">
      <Panel
        title="Schedules"
        caption="Report packs built and delivered on a cadence"
        flush
        actions={
          editing ? null : (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              onClick={() => {
                setFormError(null);
                setEditing({ id: null, version: null, draft: emptyScheduleDraft() });
              }}
            >
              New schedule
            </button>
          )
        }
      >
        {schedules.isLoading && !schedules.data ? (
          <div className="p-4">
            <Skeleton lines={3} />
          </div>
        ) : null}
        {schedules.isError ? (
          <p className="text-xms-muted p-4 text-[13px]">The schedules could not be loaded.</p>
        ) : null}
        {schedules.data ? (
          <table className="w-full border-collapse" aria-label="Report schedules">
            <thead className="bg-xms-card">
              <tr className="border-xms-line border-b">
                <th className={HEAD}>Name</th>
                <th className={HEAD}>Cadence</th>
                <th className={HEAD}>Period</th>
                <th className={HEAD}>Next run</th>
                <th className={HEAD}>Recipients</th>
                <th className={HEAD}>Review</th>
                <th className={HEAD}>Enabled</th>
                <th className={cn(HEAD, "text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.data.map((schedule) => (
                <tr key={schedule.id} className="border-xms-line border-b" data-schedule={schedule.id}>
                  <td className={cn(CELL, "font-medium")}>{schedule.name}</td>
                  <td className={CELL}>{cadenceLabel(schedule)}</td>
                  <td className={CELL}>{periodKindLabel(schedule.period_kind)}</td>
                  <td className={cn(CELL, "xms-mono whitespace-nowrap")}>{nextRunLabel(schedule)}</td>
                  <td className={CELL}>
                    {schedule.distribution.length === 0 ? (
                      <span className="text-xms-muted">Nobody</span>
                    ) : (
                      <span className="text-[12px]">{schedule.distribution.map(recipientLabel).join(", ")}</span>
                    )}
                  </td>
                  <td className={CELL} data-review={schedule.review_required ? "required" : "off"}>
                    {schedule.review_required ? (
                      <SignalPill
                        tone="needs-input"
                        label="Held for review"
                        title={reviewRequiredNote(schedule.review_grace_hours)}
                      />
                    ) : (
                      <span className="text-xms-muted">Sends on run</span>
                    )}
                  </td>
                  <td className={CELL}>
                    <SignalPill
                      tone={schedule.enabled ? "ready" : "blocked"}
                      label={schedule.enabled ? "Enabled" : "Disabled"}
                    />
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className={cn(SECONDARY_BUTTON, SMALL)}
                        aria-label={`Edit ${schedule.name}`}
                        onClick={() => {
                          setFormError(null);
                          setEditing({
                            id: schedule.id,
                            version: schedule.version,
                            draft: draftFromSchedule(schedule),
                            graceHours: schedule.review_grace_hours,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={cn(SECONDARY_BUTTON, SMALL)}
                        aria-label={`Run ${schedule.name} now`}
                        onClick={() => setRunNowFor(schedule.id)}
                      >
                        Run now
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {schedules.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-xms-label px-4 py-8 text-center text-[13px]">
                    No schedule yet. Add one to build and send report packs on a cadence.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </Panel>
      {editing ? (
        <ScheduleForm
          accountId={accountId}
          title={editing.id ? "Edit schedule" : "New schedule"}
          draft={editing.draft}
          graceHours={editing.graceHours}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onSubmit={() => void save()}
          onCancel={() => setEditing(null)}
          saving={creating || patching}
          error={formError}
        />
      ) : null}
      {running ? (
        <RunNowPanel key={running.id} schedule={running} accountId={accountId} onClose={() => setRunNowFor(null)} />
      ) : null}
      <RunsHistory accountId={accountId} schedules={schedules.data ?? []} />
    </div>
  );
}
