"use client";

import { useMemo, useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { TimeZoneField } from "@/components/admin/time-zone-field";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { usePatchPersonMutation, type PatchPersonBody, type PersonDetail } from "@/redux/rosterApi";

interface Draft {
  display_name: string;
  role: string;
  fte_percent: string;
  hours_base_per_week: string;
  admin_overhead_percent: string;
  currency: string;
  country: string;
  time_zone: string;
  start_date: string;
  end_date: string;
  assignment_group_ids: string[];
}

function toDraft(person: PersonDetail): Draft {
  return {
    display_name: person.display_name,
    role: person.role,
    fte_percent: person.fte_percent === null ? "" : String(Number(person.fte_percent)),
    hours_base_per_week: person.hours_base_per_week === null ? "" : String(Number(person.hours_base_per_week)),
    admin_overhead_percent:
      person.admin_overhead_percent === null || person.admin_overhead_percent === undefined
        ? ""
        : String(Number(person.admin_overhead_percent)),
    currency: person.currency ?? "",
    country: person.country ?? "",
    time_zone: person.time_zone,
    start_date: person.start_date ?? "",
    end_date: person.end_date ?? "",
    assignment_group_ids: [...person.assignment_group_ids].sort(),
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * The fields the PATCH carries: only what changed against the loaded record,
 * plus the version. Numbers go as numbers; blanks on nullable fields go as
 * null; a blank on a required field is not sent.
 */
export function changedFields(person: PersonDetail, draft: Draft): Omit<PatchPersonBody, "version"> {
  const base = toDraft(person);
  const body: Omit<PatchPersonBody, "version"> = {};
  if (draft.display_name.trim() !== base.display_name && draft.display_name.trim() !== "")
    body.display_name = draft.display_name.trim();
  if (draft.role !== base.role) body.role = draft.role;
  if (draft.fte_percent !== base.fte_percent && draft.fte_percent !== "") body.fte_percent = Number(draft.fte_percent);
  if (draft.hours_base_per_week !== base.hours_base_per_week && draft.hours_base_per_week !== "")
    body.hours_base_per_week = Number(draft.hours_base_per_week);
  if (draft.admin_overhead_percent !== base.admin_overhead_percent)
    body.admin_overhead_percent = draft.admin_overhead_percent === "" ? null : Number(draft.admin_overhead_percent);
  if (draft.currency.trim().toUpperCase() !== base.currency && draft.currency.trim() !== "")
    body.currency = draft.currency.trim().toUpperCase();
  if (draft.country.trim().toUpperCase() !== base.country)
    body.country = draft.country.trim() === "" ? null : draft.country.trim().toUpperCase();
  if (draft.time_zone.trim() !== base.time_zone && draft.time_zone.trim() !== "")
    body.time_zone = draft.time_zone.trim();
  if (draft.start_date !== base.start_date) body.start_date = draft.start_date === "" ? null : draft.start_date;
  if (draft.end_date !== base.end_date) body.end_date = draft.end_date === "" ? null : draft.end_date;
  const groups = [...draft.assignment_group_ids].sort();
  if (!sameList(groups, base.assignment_group_ids)) body.assignment_group_ids = groups;
  return body;
}

export interface DetailsTabProps {
  person: PersonDetail;
  refetch: () => unknown;
  /** admin:users; without it the form is read only. */
  canEdit: boolean;
  /** Groups the reader may list; without them the ids are shown as chips only. */
  groups?: { id: string; name: string }[];
}

/** Details (Capacity & Allocation functional 5.2): FTE, base hours, overhead, currency, country, zone, dates, groups. */
export function DetailsTab({ person, refetch, canEdit, groups }: DetailsTabProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(person));
  const [seenVersion, setSeenVersion] = useState(person.version);
  if (seenVersion !== person.version) {
    setSeenVersion(person.version);
    setDraft(toDraft(person));
  }
  const [patch, { isLoading }] = usePatchPersonMutation();
  const onError = useMutationErrors(refetch);
  const { push } = useToast();
  const track = useTrack("roster.person.save");
  const [error, setError] = useState<string | null>(null);
  const changes = useMemo(() => changedFields(person, draft), [person, draft]);
  const dirty = Object.keys(changes).length > 0;
  const set = (key: keyof Draft, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));
  const disabled = !canEdit || isLoading;

  return (
    <form
      className="grid gap-4 lg:grid-cols-2"
      aria-label="Person details"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        if (!dirty) return;
        try {
          await patch({ id: person.id, body: { version: person.version, ...changes } }).unwrap();
          track({ person_id: person.id, fields: Object.keys(changes).length });
          push({ title: "Saved", tone: "success" });
        } catch (caught) {
          const parsed = onError(caught);
          if (parsed.code !== "stale_version") setError(null);
        }
      }}
    >
      <Panel title="Profile" caption={canEdit ? `version ${person.version}` : "Read only: needs admin:users to edit"}>
        <div className="flex flex-col gap-3">
          <FieldRow label="Name" htmlFor="detail-name">
            <input
              id="detail-name"
              className={INPUT}
              value={draft.display_name}
              disabled={disabled}
              maxLength={120}
              onChange={(e) => set("display_name", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Email" htmlFor="detail-email">
            <input id="detail-email" className={`${INPUT} xms-mono`} value={person.email} disabled readOnly />
          </FieldRow>
          <FieldRow label="Role" htmlFor="detail-role">
            <select
              id="detail-role"
              className={INPUT}
              value={draft.role}
              disabled={disabled}
              onChange={(e) => set("role", e.target.value)}
            >
              {ROLE_OPTIONS.some((option) => option.value === draft.role) ? null : (
                <option value={draft.role}>{roleLabel(draft.role)}</option>
              )}
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="FTE %" htmlFor="detail-fte">
            <input
              id="detail-fte"
              type="number"
              min={0}
              max={100}
              step="0.5"
              className={INPUT}
              value={draft.fte_percent}
              disabled={disabled}
              onChange={(e) => set("fte_percent", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Base hours / week" htmlFor="detail-hours">
            <input
              id="detail-hours"
              type="number"
              min={1}
              max={80}
              step="0.5"
              className={INPUT}
              value={draft.hours_base_per_week}
              disabled={disabled}
              onChange={(e) => set("hours_base_per_week", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Admin overhead %" htmlFor="detail-overhead">
            <input
              id="detail-overhead"
              type="number"
              min={0}
              max={100}
              step="0.5"
              placeholder="Operator default"
              className={INPUT}
              value={draft.admin_overhead_percent}
              disabled={disabled}
              onChange={(e) => set("admin_overhead_percent", e.target.value)}
            />
          </FieldRow>
        </div>
      </Panel>
      <Panel title="Location and dates" caption="Time zone drives the working calendar; the country picks the holidays">
        <div className="flex flex-col gap-3">
          <FieldRow label="Currency" htmlFor="detail-currency">
            <input
              id="detail-currency"
              maxLength={3}
              className={INPUT}
              value={draft.currency}
              disabled={disabled}
              onChange={(e) => set("currency", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Country" htmlFor="detail-country">
            <input
              id="detail-country"
              maxLength={2}
              placeholder="GB"
              className={INPUT}
              value={draft.country}
              disabled={disabled}
              onChange={(e) => set("country", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Time zone" htmlFor="detail-tz">
            <TimeZoneField
              id="detail-tz"
              value={draft.time_zone}
              disabled={disabled}
              onChange={(value) => set("time_zone", value)}
            />
          </FieldRow>
          <FieldRow label="Start date" htmlFor="detail-start">
            <input
              id="detail-start"
              type="date"
              className={INPUT}
              value={draft.start_date}
              disabled={disabled}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="End date" htmlFor="detail-end">
            <input
              id="detail-end"
              type="date"
              className={INPUT}
              value={draft.end_date}
              disabled={disabled}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </FieldRow>
          <fieldset className="border-xms-line rounded-[4px] border p-3" disabled={disabled}>
            <legend className="xms-caption px-1">Groups</legend>
            {groups && groups.length > 0 ? (
              groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 py-1 text-[14px]">
                  <input
                    type="checkbox"
                    checked={draft.assignment_group_ids.includes(group.id)}
                    onChange={() =>
                      setDraft((previous) => ({
                        ...previous,
                        assignment_group_ids: previous.assignment_group_ids.includes(group.id)
                          ? previous.assignment_group_ids.filter((id) => id !== group.id)
                          : [...previous.assignment_group_ids, group.id],
                      }))
                    }
                  />
                  <span className="text-xms-ink">{group.name}</span>
                </label>
              ))
            ) : person.assignment_group_ids.length > 0 ? (
              <p className="xms-mono text-xms-label text-[14px]">{person.assignment_group_ids.join(", ")}</p>
            ) : (
              <p className="text-xms-label text-[14px]">No groups.</p>
            )}
          </fieldset>
        </div>
      </Panel>
      {canEdit ? (
        <div className="flex items-center gap-2 lg:col-span-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={!dirty || isLoading}>
            Save changes
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={!dirty || isLoading}
            onClick={() => setDraft(toDraft(person))}
          >
            Discard
          </button>
          {dirty ? (
            <span className="text-xms-label text-[14px]">
              {Object.keys(changes).length} field{Object.keys(changes).length === 1 ? "" : "s"} changed
            </span>
          ) : null}
          <InlineError message={error} />
        </div>
      ) : null}
    </form>
  );
}
