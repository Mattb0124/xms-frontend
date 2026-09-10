"use client";

import { PairsEditor } from "@/components/admin/connectors/pairs-editor";
import { INPUT } from "@/components/admin/primitives";
import { TICKET_TYPES } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import type { StateMapEntries, StateMapForType } from "@/redux/connectorsApi";

export interface StateMapEditorProps {
  entries: StateMapEntries;
  readOnly?: boolean;
  onChange: (entries: StateMapEntries) => void;
}

const EMPTY_TYPE: StateMapForType = { inbound: {}, outbound: {} };

function typeLabelOf(type: string): string {
  return TICKET_TYPES.find((entry) => entry.value === type)?.label ?? type.replace(/_/g, " ");
}

/**
 * One grid per ticket type (ServiceNow Sync functional 5.2 step 3): external
 * states to XMS states inbound, XMS states to external values outbound, the
 * XMS states an inbound change may move into, and the fallback per target.
 * Unmapped values are what Validate reports; the browser does not guess.
 */
export function StateMapEditor({ entries, readOnly, onChange }: StateMapEditorProps) {
  const types = [
    ...TICKET_TYPES.map((type) => type.value as string),
    ...Object.keys(entries).filter((type) => !TICKET_TYPES.some((t) => t.value === type)),
  ];
  const setType = (type: string, value: StateMapForType | null) => {
    const next = { ...entries };
    if (value) next[type] = value;
    else delete next[type];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3" data-editor="state-map">
      {types.map((type) => {
        const entry = entries[type];
        const mapped = Boolean(entry);
        const xmsStates = [...new Set([...Object.values(entry?.inbound ?? {}), ...Object.keys(entry?.outbound ?? {})])];
        return (
          <section
            key={type}
            className={cn("border-xms-line rounded-[4px] border p-3", !mapped && "opacity-80")}
            aria-label={typeLabelOf(type)}
            data-type={type}
          >
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                aria-label={`Map ${typeLabelOf(type)}`}
                checked={mapped}
                disabled={readOnly}
                onChange={(event) => setType(type, event.target.checked ? EMPTY_TYPE : null)}
              />
              <span className="text-xms-ink font-medium">{typeLabelOf(type)}</span>
              {mapped ? null : (
                <span className="text-xms-muted text-[14px]">not mapped; tickets of this type do not sync</span>
              )}
            </label>
            {entry ? (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <PairsEditor
                  label={`${typeLabelOf(type)} inbound`}
                  leftLabel="ServiceNow state"
                  rightLabel="XMS state"
                  pairs={entry.inbound}
                  readOnly={readOnly}
                  onChange={(inbound) => setType(type, { ...entry, inbound })}
                />
                <PairsEditor
                  label={`${typeLabelOf(type)} outbound`}
                  leftLabel="XMS state"
                  rightLabel="ServiceNow state"
                  pairs={entry.outbound}
                  readOnly={readOnly}
                  onChange={(outbound) => setType(type, { ...entry, outbound })}
                />
                <label className="flex flex-col gap-1 text-[14px]">
                  <span className="text-xms-label">
                    Accept inbound moves into (comma separated XMS states; empty means any mapped state)
                  </span>
                  <input
                    aria-label={`${typeLabelOf(type)} accept inbound`}
                    className={cn(INPUT, "h-[28px]")}
                    list={`${type}-xms-states`}
                    value={(entry.accept_inbound ?? []).join(", ")}
                    disabled={readOnly}
                    onChange={(event) => {
                      const accepted = event.target.value
                        .split(",")
                        .map((state) => state.trim())
                        .filter(Boolean);
                      const next: StateMapForType = { ...entry };
                      if (accepted.length > 0) next.accept_inbound = accepted;
                      else delete next.accept_inbound;
                      setType(type, next);
                    }}
                  />
                  <datalist id={`${type}-xms-states`}>
                    {xmsStates.map((state) => (
                      <option key={state} value={state} />
                    ))}
                  </datalist>
                </label>
                <PairsEditor
                  label={`${typeLabelOf(type)} fallback`}
                  leftLabel="Unreachable target"
                  rightLabel="Use instead"
                  pairs={entry.fallback ?? {}}
                  readOnly={readOnly}
                  rightOptions={xmsStates}
                  onChange={(fallback) => {
                    const next: StateMapForType = { ...entry };
                    if (Object.keys(fallback).length > 0) next.fallback = fallback;
                    else delete next.fallback;
                    setType(type, next);
                  }}
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
