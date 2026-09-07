"use client";

import { PairsEditor } from "@/components/admin/connectors/pairs-editor";
import { INPUT, SECONDARY_BUTTON } from "@/components/admin/primitives";
import {
  DIRECTIONS,
  SYSTEMS_OF_RECORD,
  TRANSFORM_KINDS,
  XMS_FIELDS,
  defaultSor,
  type Direction,
  type SystemOfRecord,
  type TransformKind,
  type XmsField,
} from "@/lib/connectors/vocab";
import { cn } from "@/lib/utils";
import type { DictionaryField, FieldMapEntry, Transform } from "@/redux/connectorsApi";

export interface FieldMapEditorProps {
  entries: FieldMapEntry[];
  /** From the samples call; when present the external field is a picker. */
  dictionary?: DictionaryField[];
  readOnly?: boolean;
  onChange: (entries: FieldMapEntry[]) => void;
}

const SMALL = cn(INPUT, "h-[28px] text-[12px]");

/** Required XMS fields with no inbound entry, for the reminder above the table. */
export function unmappedRequired(entries: FieldMapEntry[]): XmsField[] {
  const inbound = new Set(entries.filter((entry) => entry.direction !== "out").map((entry) => entry.xms));
  return XMS_FIELDS.filter((field) => field.required && !inbound.has(field.value)).map((field) => field.value);
}

export function transformFor(kind: TransformKind, previous?: Transform): Transform | undefined {
  switch (kind) {
    case "lookup":
      return previous?.kind === "lookup" ? previous : { kind: "lookup", values: {} };
    case "template":
      return previous?.kind === "template" ? previous : { kind: "template", template: "" };
    case "truncate":
      return previous?.kind === "truncate" ? previous : { kind: "truncate", length: 300 };
    default:
      return undefined;
  }
}

function TransformParams({
  entry,
  index,
  readOnly,
  onChange,
}: {
  entry: FieldMapEntry;
  index: number;
  readOnly?: boolean;
  onChange: (transform: Transform) => void;
}) {
  const transform = entry.transform;
  if (!transform || transform.kind === "none") return null;
  if (transform.kind === "template") {
    return (
      <input
        aria-label={`Template ${index + 1}`}
        className={SMALL}
        placeholder="{{number}}: {{short_description}}"
        value={transform.template}
        disabled={readOnly}
        onChange={(event) => onChange({ kind: "template", template: event.target.value })}
      />
    );
  }
  if (transform.kind === "truncate") {
    return (
      <input
        aria-label={`Truncate length ${index + 1}`}
        type="number"
        min={1}
        className={cn(SMALL, "w-[90px]")}
        value={transform.length}
        disabled={readOnly}
        onChange={(event) => onChange({ kind: "truncate", length: Number(event.target.value) })}
      />
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <PairsEditor
        label={`Lookup ${index + 1}`}
        leftLabel="External value"
        rightLabel="XMS value"
        pairs={transform.values}
        readOnly={readOnly}
        onChange={(values) => onChange({ ...transform, values })}
      />
      <input
        aria-label={`Lookup fallback ${index + 1}`}
        className={SMALL}
        placeholder="Fallback when no value matches"
        value={transform.fallback ?? ""}
        disabled={readOnly}
        onChange={(event) => {
          const fallback = event.target.value;
          const next: Transform = fallback ? { ...transform, fallback } : { kind: "lookup", values: transform.values };
          onChange(next);
        }}
      />
    </div>
  );
}

/**
 * The field map grid (ServiceNow Sync functional 5.2 step 2): ServiceNow
 * field, XMS field, direction, transform and system of record per row.
 * Required XMS fields are called out until they have an inbound entry.
 */
export function FieldMapEditor({ entries, dictionary, readOnly, onChange }: FieldMapEditorProps) {
  const missing = unmappedRequired(entries);
  const known = dictionary?.map((field) => field.name) ?? [];
  const update = (index: number, patch: Partial<FieldMapEntry>) =>
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const remove = (index: number) => onChange(entries.filter((_, i) => i !== index));
  const add = () => onChange([...entries, { external: "", xms: missing[0] ?? "short_description", direction: "in" }]);

  return (
    <div className="flex flex-col gap-3" data-editor="field-map">
      {missing.length > 0 ? (
        <p className="text-[12px] text-[color:var(--state-needs-input-text)]" data-missing={missing.join(",")}>
          Required XMS fields without an inbound entry: {missing.join(", ")}.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" aria-label="Field map entries">
          <thead>
            <tr className="border-xms-line text-xms-ink border-b text-left">
              <th className="px-2 py-2 font-semibold">ServiceNow field</th>
              <th className="px-2 py-2 font-semibold">XMS field</th>
              <th className="px-2 py-2 font-semibold">Direction</th>
              <th className="px-2 py-2 font-semibold">Transform</th>
              <th className="px-2 py-2 font-semibold">System of record</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index} className="border-xms-line border-b align-top" data-entry={index}>
                <td className="px-2 py-2">
                  {known.length > 0 ? (
                    <select
                      aria-label={`External field ${index + 1}`}
                      className={SMALL}
                      value={entry.external}
                      disabled={readOnly}
                      onChange={(event) => update(index, { external: event.target.value })}
                    >
                      <option value="">Pick a field</option>
                      {entry.external && !known.includes(entry.external) ? (
                        <option value={entry.external}>{entry.external} (not in dictionary)</option>
                      ) : null}
                      {dictionary!.map((field) => (
                        <option key={field.name} value={field.name}>
                          {field.name}
                          {field.mandatory ? " *" : ""}
                          {field.label && field.label !== field.name ? ` (${field.label})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={`External field ${index + 1}`}
                      className={cn(SMALL, "xms-mono")}
                      placeholder="Load samples for the dictionary"
                      value={entry.external}
                      disabled={readOnly}
                      onChange={(event) => update(index, { external: event.target.value })}
                    />
                  )}
                </td>
                <td className="px-2 py-2">
                  <select
                    aria-label={`XMS field ${index + 1}`}
                    className={SMALL}
                    value={entry.xms}
                    disabled={readOnly}
                    onChange={(event) => update(index, { xms: event.target.value as XmsField })}
                  >
                    {XMS_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                        {field.required ? " (required)" : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    aria-label={`Direction ${index + 1}`}
                    className={SMALL}
                    value={entry.direction}
                    disabled={readOnly}
                    onChange={(event) => update(index, { direction: event.target.value as Direction })}
                  >
                    {DIRECTIONS.map((direction) => (
                      <option key={direction.value} value={direction.value}>
                        {direction.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <div className="flex min-w-[220px] flex-col gap-1">
                    <select
                      aria-label={`Transform ${index + 1}`}
                      className={SMALL}
                      value={entry.transform?.kind ?? "none"}
                      disabled={readOnly}
                      onChange={(event) =>
                        update(index, { transform: transformFor(event.target.value as TransformKind, entry.transform) })
                      }
                    >
                      {TRANSFORM_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                    <TransformParams
                      entry={entry}
                      index={index}
                      readOnly={readOnly}
                      onChange={(transform) => update(index, { transform })}
                    />
                  </div>
                </td>
                <td className="px-2 py-2">
                  <select
                    aria-label={`System of record ${index + 1}`}
                    className={SMALL}
                    value={entry.sor ?? ""}
                    disabled={readOnly}
                    onChange={(event) => {
                      const sor = event.target.value as SystemOfRecord | "";
                      const next = { ...entry };
                      if (sor) next.sor = sor;
                      else delete next.sor;
                      onChange(entries.map((row, i) => (i === index ? next : row)));
                    }}
                  >
                    <option value="">
                      Default ({SYSTEMS_OF_RECORD.find((option) => option.value === defaultSor(entry.xms))?.label})
                    </option>
                    {SYSTEMS_OF_RECORD.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  {readOnly ? null : (
                    <button
                      type="button"
                      aria-label={`Remove entry ${index + 1}`}
                      className="text-xms-muted hover:text-xms-ink text-[14px] leading-none"
                      onClick={() => remove(index)}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-xms-label px-2 py-4 text-center">
                  No entries. Add the required fields first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {readOnly ? null : (
        <div>
          <button type="button" className={SECONDARY_BUTTON} onClick={add}>
            Add entry
          </button>
        </div>
      )}
    </div>
  );
}
