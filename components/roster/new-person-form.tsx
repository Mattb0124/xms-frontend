"use client";

import { useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { TimeZoneField } from "@/components/admin/time-zone-field";
import { Panel } from "@/components/xms/panel";
import { describeRosterError, rosterError } from "@/lib/roster/errors";
import { ROLE_OPTIONS } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { useCreatePersonMutation, type CreatePersonBody, type Person } from "@/redux/rosterApi";

const EMPTY = {
  display_name: "",
  email: "",
  role: "consultant",
  fte_percent: "100",
  hours_base_per_week: "40",
  time_zone: "UTC",
  country: "",
  currency: "GBP",
  start_date: "",
};

function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const number = Number(trimmed);
  return Number.isNaN(number) ? undefined : number;
}

/**
 * "New person" (admin:users): a person not in the sign-in directory, such
 * as a contractor. The calendar defaults to Monday to Friday 09:00 to
 * 17:00 on the server and can be changed on the record.
 */
export function NewPersonForm({
  groups,
  onCreated,
  onCancel,
}: {
  groups?: { id: string; name: string }[];
  onCreated: (person: Person) => void;
  onCancel?: () => void;
}) {
  const [create, { isLoading }] = useCreatePersonMutation();
  const track = useTrack("roster.person.create");
  const [form, setForm] = useState(EMPTY);
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof EMPTY, value: string) => setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <Panel title="New person" caption="Someone outside the sign-in directory, such as a contractor">
      <form
        className="grid gap-4 md:grid-cols-2"
        aria-label="New person"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          const body: CreatePersonBody = {
            display_name: form.display_name.trim(),
            email: form.email.trim(),
            role: form.role,
            fte_percent: numberOrUndefined(form.fte_percent),
            hours_base_per_week: numberOrUndefined(form.hours_base_per_week),
            time_zone: form.time_zone.trim() || undefined,
            country: form.country.trim() ? form.country.trim().toUpperCase() : undefined,
            currency: form.currency.trim() ? form.currency.trim().toUpperCase() : undefined,
            start_date: form.start_date || undefined,
            assignment_group_ids: groupIds.size > 0 ? [...groupIds] : undefined,
          };
          try {
            const created = await create(body).unwrap();
            track({ person_id: created.id, role: created.role, groups: groupIds.size });
            setForm(EMPTY);
            setGroupIds(new Set());
            onCreated(created);
          } catch (caught) {
            setError(describeRosterError(rosterError(caught)));
          }
        }}
      >
        <div className="flex flex-col gap-3">
          <FieldRow label="Name" htmlFor="person-name">
            <input
              id="person-name"
              required
              maxLength={120}
              className={INPUT}
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Email" htmlFor="person-email">
            <input
              id="person-email"
              type="email"
              required
              className={INPUT}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Role" htmlFor="person-role">
            <select id="person-role" className={INPUT} value={form.role} onChange={(e) => set("role", e.target.value)}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="FTE %" htmlFor="person-fte">
            <input
              id="person-fte"
              type="number"
              min={0}
              max={100}
              step="0.5"
              className={INPUT}
              value={form.fte_percent}
              onChange={(e) => set("fte_percent", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Base hours / week" htmlFor="person-hours">
            <input
              id="person-hours"
              type="number"
              min={1}
              max={80}
              step="0.5"
              className={INPUT}
              value={form.hours_base_per_week}
              onChange={(e) => set("hours_base_per_week", e.target.value)}
            />
          </FieldRow>
        </div>
        <div className="flex flex-col gap-3">
          <FieldRow label="Time zone" htmlFor="person-tz">
            <TimeZoneField id="person-tz" value={form.time_zone} onChange={(value) => set("time_zone", value)} />
          </FieldRow>
          <FieldRow label="Country" htmlFor="person-country">
            <input
              id="person-country"
              maxLength={2}
              placeholder="GB"
              className={INPUT}
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Currency" htmlFor="person-currency">
            <input
              id="person-currency"
              maxLength={3}
              minLength={3}
              className={INPUT}
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Start date" htmlFor="person-start">
            <input
              id="person-start"
              type="date"
              className={INPUT}
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </FieldRow>
          {groups && groups.length > 0 ? (
            <fieldset className="border-xms-line rounded-[4px] border p-3">
              <legend className="xms-caption px-1">Groups</legend>
              {groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 py-1 text-[14px]">
                  <input
                    type="checkbox"
                    checked={groupIds.has(group.id)}
                    onChange={() =>
                      setGroupIds((previous) => {
                        const next = new Set(previous);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                  />
                  <span className="text-xms-ink">{group.name}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <InlineError message={error} />
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
              Create person
            </button>
            {onCancel ? (
              <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </Panel>
  );
}
