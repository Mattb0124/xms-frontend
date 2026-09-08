"use client";

import { useMemo, useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { describeRosterError, rosterError } from "@/lib/roster/errors";
import { SKILL_KIND_LABEL, SKILL_LEVELS, levelLabel } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import {
  useCreateSkillMutation,
  useListSkillsQuery,
  useSetPersonSkillsMutation,
  type PersonSkill,
  type Skill,
  type SkillKind,
} from "@/redux/rosterApi";

export interface SkillsTabProps {
  personId: string;
  skills: PersonSkill[];
  /** capacity:manage; without it the tab is a read-only list. */
  canEdit: boolean;
}

interface DraftSkill {
  skill_id: string;
  code: string;
  name: string;
  kind: string;
  level: number;
}

/** The segmented 1..4 control; a radiogroup so the level reads as one choice. */
export function LevelControl({
  value,
  onChange,
  disabled,
  name,
}: {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={`Level for ${name}`} className="inline-flex overflow-hidden rounded-[4px]">
      {SKILL_LEVELS.map((entry) => (
        <button
          key={entry.level}
          type="button"
          role="radio"
          aria-checked={value === entry.level}
          disabled={disabled}
          title={entry.label}
          onClick={() => onChange(entry.level)}
          className={cn(
            "border-xms-line h-[28px] border px-2 text-[12px] first:rounded-l-[4px] last:rounded-r-[4px] disabled:opacity-60",
            value === entry.level ? "bg-xms-accent border-xms-accent text-white" : "bg-xms-card text-xms-body",
          )}
        >
          <span className="xms-mono font-semibold">{entry.level}</span>
          <span className="ml-1 hidden sm:inline">{entry.label}</span>
        </button>
      ))}
    </div>
  );
}

function AddSkillForm({ onCreated }: { onCreated: (skill: Skill) => void }) {
  const [create, { isLoading }] = useCreateSkillMutation();
  const [form, setForm] = useState({ kind: "technology" as SkillKind, code: "", name: "" });
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="border-xms-line flex flex-col gap-3 rounded-[4px] border p-3"
      aria-label="Add a new skill"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        try {
          const created = await create({
            kind: form.kind,
            code: form.code.trim().toLowerCase(),
            name: form.name.trim(),
          }).unwrap();
          setForm({ kind: "technology", code: "", name: "" });
          onCreated(created);
        } catch (caught) {
          setError(describeRosterError(rosterError(caught)));
        }
      }}
    >
      <p className="xms-caption">Add a new skill to the catalog</p>
      <FieldRow label="Kind" htmlFor="skill-kind">
        <select
          id="skill-kind"
          className={INPUT}
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value as SkillKind })}
        >
          <option value="technology">Technology</option>
          <option value="process">Process</option>
        </select>
      </FieldRow>
      <FieldRow label="Code" htmlFor="skill-code">
        <input
          id="skill-code"
          required
          pattern="[a-z0-9][a-z0-9_.\-]{0,59}"
          placeholder="onestream"
          className={`${INPUT} xms-mono`}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
        />
      </FieldRow>
      <FieldRow label="Name" htmlFor="skill-name">
        <input
          id="skill-name"
          required
          maxLength={120}
          className={INPUT}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </FieldRow>
      <InlineError message={error} />
      <div>
        <button type="submit" className={SECONDARY_BUTTON} disabled={isLoading}>
          Create skill
        </button>
      </div>
    </form>
  );
}

/**
 * Skills (Capacity & Allocation functional 5.2, 5.8): the person's skills
 * with a level each, added from the operator's catalog. Saving replaces the
 * whole set (PUT), so removing a row and saving drops it on the server.
 */
export function SkillsTab({ personId, skills, canEdit }: SkillsTabProps) {
  const catalog = useListSkillsQuery();
  const [draft, setDraft] = useState<DraftSkill[]>(() => skills.map(toDraft));
  const [seen, setSeen] = useState(skills);
  if (seen !== skills) {
    setSeen(skills);
    setDraft(skills.map(toDraft));
  }
  const [picked, setPicked] = useState("");
  const [adding, setAdding] = useState(false);
  const [save, { isLoading }] = useSetPersonSkillsMutation();
  const { push } = useToast();
  const track = useTrack("roster.skills.save");
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(
    () => (catalog.data ?? []).filter((skill) => !draft.some((entry) => entry.skill_id === skill.id)),
    [catalog.data, draft],
  );
  const dirty = useMemo(() => {
    const before = skills
      .map((s) => `${s.skill_id}:${s.level}`)
      .sort()
      .join(",");
    const after = draft
      .map((s) => `${s.skill_id}:${s.level}`)
      .sort()
      .join(",");
    return before !== after;
  }, [skills, draft]);

  const addFromCatalog = (skill: Skill) => {
    setDraft((previous) => [
      ...previous,
      { skill_id: skill.id, code: skill.code, name: skill.name, kind: skill.kind, level: 2 },
    ]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title="Skills" caption={canEdit ? "Saved as one set" : "Read only: needs capacity:manage to change"}>
        {draft.length === 0 ? <p className="text-xms-label text-[13px]">No skills recorded.</p> : null}
        <ul className="divide-xms-line divide-y" aria-label="Skills">
          {draft.map((entry) => (
            <li
              key={entry.skill_id}
              className="flex flex-wrap items-center gap-3 py-2 text-[13px]"
              data-skill={entry.code}
            >
              <span className="text-xms-ink min-w-[160px] font-medium">{entry.name}</span>
              <span className="text-xms-label text-[12px]">{SKILL_KIND_LABEL[entry.kind] ?? entry.kind}</span>
              <span className="ml-auto flex items-center gap-2">
                {canEdit ? (
                  <LevelControl
                    name={entry.name}
                    value={entry.level}
                    onChange={(level) =>
                      setDraft((previous) =>
                        previous.map((row) => (row.skill_id === entry.skill_id ? { ...row, level } : row)),
                      )
                    }
                  />
                ) : (
                  <span className="text-xms-body">
                    <span className="xms-mono text-xms-accent font-semibold">{entry.level}</span>{" "}
                    {levelLabel(entry.level)}
                  </span>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Remove ${entry.name}`}
                    className="text-xms-muted hover:text-xms-ink text-[14px] leading-none"
                    onClick={() => setDraft((previous) => previous.filter((row) => row.skill_id !== entry.skill_id))}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {canEdit ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={!dirty || isLoading}
              onClick={async () => {
                setError(null);
                try {
                  const saved = await save({
                    id: personId,
                    skills: draft.map((entry) => ({ skill_id: entry.skill_id, level: entry.level })),
                  }).unwrap();
                  track({ person_id: personId, skills: saved.length });
                  push({ title: "Skills saved", tone: "success" });
                } catch (caught) {
                  setError(describeRosterError(rosterError(caught)));
                }
              }}
            >
              Save skills
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={!dirty || isLoading}
              onClick={() => setDraft(skills.map(toDraft))}
            >
              Discard
            </button>
            <InlineError message={error} />
          </div>
        ) : null}
      </Panel>
      {canEdit ? (
        <Panel title="Add from the catalog" caption="Operator-managed list; account familiarity skills are generated">
          {catalog.isLoading ? <Skeleton lines={3} /> : null}
          <div className="flex flex-col gap-3">
            <FieldRow label="Skill" htmlFor="skill-pick">
              <select id="skill-pick" className={INPUT} value={picked} onChange={(e) => setPicked(e.target.value)}>
                <option value="">Choose a skill</option>
                {available.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name} ({SKILL_KIND_LABEL[skill.kind] ?? skill.kind})
                  </option>
                ))}
              </select>
            </FieldRow>
            <div className="flex gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={!picked}
                onClick={() => {
                  const skill = available.find((row) => row.id === picked);
                  if (skill) addFromCatalog(skill);
                  setPicked("");
                }}
              >
                Add skill
              </button>
              <button type="button" className="text-xms-accent text-[13px]" onClick={() => setAdding((v) => !v)}>
                {adding ? "Hide new skill" : "Add a new skill"}
              </button>
            </div>
            {adding ? (
              <AddSkillForm
                onCreated={(skill) => {
                  addFromCatalog(skill);
                  setAdding(false);
                }}
              />
            ) : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function toDraft(skill: PersonSkill): DraftSkill {
  return { skill_id: skill.skill_id, code: skill.code, name: skill.name, kind: skill.kind, level: skill.level };
}
