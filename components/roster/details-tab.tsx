"use client";

import { useMemo, useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { TimeZoneField } from "@/components/admin/time-zone-field";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { changedFields, draftFromPerson, type PersonDraft } from "@/lib/roster/person-draft";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { usePatchPersonMutation, type PatchPersonBody, type PersonDetail } from "@/redux/rosterApi";

export interface DetailsTabProps {
  person: PersonDetail;
  refetch: () => unknown;
  /** admin:users; without it the form is read only. */
  canEdit: boolean;
  /** Groups the reader may list; without them the ids are shown as chips only. */
  groups?: { id: string; name: string }[];
}

type SetDraftField = (key: keyof PersonDraft, value: string) => void;

/** The form's copy of the person, read again whenever the server's version moves. */
function usePersonDraft(person: PersonDetail) {
  const [draft, setDraft] = useState<PersonDraft>(() => draftFromPerson(person));
  const [seenVersion, setSeenVersion] = useState(person.version);
  if (seenVersion !== person.version) {
    setSeenVersion(person.version);
    setDraft(draftFromPerson(person));
  }
  const set: SetDraftField = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const toggleGroup = (groupId: string) =>
    setDraft((previous) => ({
      ...previous,
      assignment_group_ids: previous.assignment_group_ids.includes(groupId)
        ? previous.assignment_group_ids.filter((id) => id !== groupId)
        : [...previous.assignment_group_ids, groupId],
    }));
  const discard = () => setDraft(draftFromPerson(person));
  return { draft, set, toggleGroup, discard };
}

/** The one PATCH: the changed fields with the version they were read at. */
function usePersonSave(person: PersonDetail, changes: Omit<PatchPersonBody, "version">, refetch: () => unknown) {
  const [patch, { isLoading }] = usePatchPersonMutation();
  const onError = useMutationErrors(refetch);
  const { push } = useToast();
  const track = useTrack("roster.person.save");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (Object.keys(changes).length === 0) return;
    try {
      await patch({ id: person.id, body: { version: person.version, ...changes } }).unwrap();
      track({ person_id: person.id, fields: Object.keys(changes).length });
      push({ title: "Saved", tone: "success" });
    } catch (caught) {
      const parsed = onError(caught);
      if (parsed.code !== "stale_version") setError(null);
    }
  };

  return { save, saving: isLoading, error };
}

export interface ProfilePanelProps {
  person: PersonDetail;
  draft: PersonDraft;
  canEdit: boolean;
  disabled: boolean;
  onSet: SetDraftField;
}

function ProfilePanel({ person, draft, canEdit, disabled, onSet }: ProfilePanelProps) {
  return (
    <Panel title="Profile" caption={canEdit ? `version ${person.version}` : "Read only: needs admin:users to edit"}>
      <div className="flex flex-col gap-3">
        <FieldRow label="Name" htmlFor="detail-name">
          <input
            id="detail-name"
            className={INPUT}
            value={draft.display_name}
            disabled={disabled}
            maxLength={120}
            onChange={(e) => onSet("display_name", e.target.value)}
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
            onChange={(e) => onSet("role", e.target.value)}
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
            onChange={(e) => onSet("fte_percent", e.target.value)}
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
            onChange={(e) => onSet("hours_base_per_week", e.target.value)}
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
            onChange={(e) => onSet("admin_overhead_percent", e.target.value)}
          />
        </FieldRow>
      </div>
    </Panel>
  );
}

export interface GroupChoicesProps {
  groups?: { id: string; name: string }[];
  /** The draft's groups, ticked. */
  chosen: string[];
  /** The record's own groups, listed by id when the directory is not readable. */
  stored: string[];
  onToggle: (groupId: string) => void;
}

function GroupChoices({ groups, chosen, stored, onToggle }: GroupChoicesProps) {
  if (groups && groups.length > 0) {
    return groups.map((group) => (
      <label key={group.id} className="flex items-center gap-2 py-1 text-body">
        <input type="checkbox" checked={chosen.includes(group.id)} onChange={() => onToggle(group.id)} />
        <span className="text-xms-ink">{group.name}</span>
      </label>
    ));
  }
  if (stored.length > 0) return <p className="xms-mono text-xms-label text-body">{stored.join(", ")}</p>;
  return <p className="text-xms-label text-body">No groups.</p>;
}

export interface LocationPanelProps {
  person: PersonDetail;
  draft: PersonDraft;
  disabled: boolean;
  groups?: { id: string; name: string }[];
  onSet: SetDraftField;
  onToggleGroup: (groupId: string) => void;
}

function LocationPanel({ person, draft, disabled, groups, onSet, onToggleGroup }: LocationPanelProps) {
  return (
    <Panel title="Location and dates" caption="Time zone drives the working calendar; the country picks the holidays">
      <div className="flex flex-col gap-3">
        <FieldRow label="Currency" htmlFor="detail-currency">
          <input
            id="detail-currency"
            maxLength={3}
            className={INPUT}
            value={draft.currency}
            disabled={disabled}
            onChange={(e) => onSet("currency", e.target.value)}
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
            onChange={(e) => onSet("country", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Time zone" htmlFor="detail-tz">
          <TimeZoneField
            id="detail-tz"
            value={draft.time_zone}
            disabled={disabled}
            onChange={(value) => onSet("time_zone", value)}
          />
        </FieldRow>
        <FieldRow label="Start date" htmlFor="detail-start">
          <input
            id="detail-start"
            type="date"
            className={INPUT}
            value={draft.start_date}
            disabled={disabled}
            onChange={(e) => onSet("start_date", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="End date" htmlFor="detail-end">
          <input
            id="detail-end"
            type="date"
            className={INPUT}
            value={draft.end_date}
            disabled={disabled}
            onChange={(e) => onSet("end_date", e.target.value)}
          />
        </FieldRow>
        <fieldset className="border-xms-line rounded-control border p-3" disabled={disabled}>
          <legend className="xms-caption px-1">Groups</legend>
          <GroupChoices
            groups={groups}
            chosen={draft.assignment_group_ids}
            stored={person.assignment_group_ids}
            onToggle={onToggleGroup}
          />
        </fieldset>
      </div>
    </Panel>
  );
}

export interface SaveBarProps {
  /** How many fields the PATCH would carry. */
  changed: number;
  saving: boolean;
  error: string | null;
  onDiscard: () => void;
}

function SaveBar({ changed, saving, error, onDiscard }: SaveBarProps) {
  const dirty = changed > 0;
  return (
    <div className="flex items-center gap-2 lg:col-span-2">
      <button type="submit" className={PRIMARY_BUTTON} disabled={!dirty || saving}>
        Save changes
      </button>
      <button type="button" className={SECONDARY_BUTTON} disabled={!dirty || saving} onClick={onDiscard}>
        Discard
      </button>
      {dirty ? (
        <span className="text-xms-label text-body">
          {changed} field{changed === 1 ? "" : "s"} changed
        </span>
      ) : null}
      <InlineError message={error} />
    </div>
  );
}

/** Details (Capacity & Allocation functional 5.2): FTE, base hours, overhead, currency, country, zone, dates, groups. */
export function DetailsTab({ person, refetch, canEdit, groups }: DetailsTabProps) {
  const { draft, set, toggleGroup, discard } = usePersonDraft(person);
  const changes = useMemo(() => changedFields(person, draft), [person, draft]);
  const { save, saving, error } = usePersonSave(person, changes, refetch);
  const disabled = !canEdit || saving;

  return (
    <form
      className="grid gap-4 lg:grid-cols-2"
      aria-label="Person details"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <ProfilePanel person={person} draft={draft} canEdit={canEdit} disabled={disabled} onSet={set} />
      <LocationPanel
        person={person}
        draft={draft}
        disabled={disabled}
        groups={groups}
        onSet={set}
        onToggleGroup={toggleGroup}
      />
      {canEdit ? (
        <SaveBar changed={Object.keys(changes).length} saving={saving} error={error} onDiscard={discard} />
      ) : null}
    </form>
  );
}
