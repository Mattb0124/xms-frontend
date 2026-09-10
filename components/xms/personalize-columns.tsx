"use client";

import { useMemo, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { ChevronDownIcon, CloseIcon, ICON } from "@/components/xms/icons";
import { move, type ColumnChoice, type DisplayOptions } from "@/lib/tables/arrangement";
import { cn } from "@/lib/utils";

export interface PersonalizeColumnsProps {
  /** Every column the screen has, in the order it authored them. */
  choices: ColumnChoice[];
  /** The keys drawn now, in the order they are drawn. */
  selection: string[];
  options: DisplayOptions;
  /** The screen's own column set, so "reset" has something to return to. */
  defaults: string[];
  busy?: boolean;
  onSave: (selection: string[], options: DisplayOptions) => void;
  onReset: () => void;
  onClose: () => void;
}

const LIST_BOX =
  "xms-field border-xms-control-line bg-xms-card text-xms-ink h-[260px] w-full rounded-[4px] border p-0 text-[13px] outline-none";

const MOVE_BUTTON =
  "xms-field border-xms-control-line text-xms-ink hover:text-xms-accent flex h-[30px] w-[30px] items-center justify-center rounded-[4px] border disabled:opacity-40";

const SWITCHES: { key: keyof DisplayOptions; label: string }[] = [
  { key: "wrap", label: "Wrap column text" },
  { key: "compact", label: "Compact rows" },
  { key: "activeRow", label: "Active row highlighting" },
  { key: "coloring", label: "Modern cell coloring" },
];

/**
 * Personalize list columns, after the ServiceNow dialogue our consultants
 * already know: what a list could draw on the left, what it draws on the
 * right, arrows to move a column across and up and down the order.
 *
 * The reader is choosing, not editing. Nothing here changes a case, so the
 * dialogue closes on Cancel with no trace and the list is only redrawn once
 * OK is pressed. Reset removes the arrangement rather than writing the
 * current default into it, so a reader who resets keeps following the screen
 * as the screen changes.
 *
 * The two lists are native multi-selects. They carry keyboard selection,
 * shift ranges and screen-reader semantics that a div of rows would have to
 * reimplement, and they are what the reference dialogue uses.
 */
export function PersonalizeColumns({
  choices,
  selection,
  options,
  defaults,
  busy,
  onSave,
  onReset,
  onClose,
}: PersonalizeColumnsProps) {
  const [chosen, setChosen] = useState<string[]>(selection);
  const [switches, setSwitches] = useState<DisplayOptions>(options);
  const [pickedAvailable, setPickedAvailable] = useState<string[]>([]);
  const [pickedChosen, setPickedChosen] = useState<string[]>([]);

  const titles = useMemo(() => new Map(choices.map((choice) => [choice.key, choice.title])), [choices]);
  const available = useMemo(() => choices.filter((choice) => !chosen.includes(choice.key)), [choices, chosen]);

  const add = () => {
    if (pickedAvailable.length === 0) return;
    setChosen((current) => [...current, ...pickedAvailable.filter((key) => !current.includes(key))]);
    setPickedAvailable([]);
  };
  const remove = () => {
    if (pickedChosen.length === 0) return;
    // A list with no columns is not a list, so the last one stays.
    const next = chosen.filter((key) => !pickedChosen.includes(key));
    if (next.length === 0) return;
    setChosen(next);
    setPickedChosen([]);
  };
  const shift = (delta: number) => {
    if (pickedChosen.length !== 1) return;
    setChosen((current) => move(current, pickedChosen[0], delta));
  };

  const isDefault = chosen.length === defaults.length && chosen.every((key, index) => key === defaults[index]);

  return (
    <div className="bg-xms-navy-overlay/55 fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Personalize list columns"
        className="xms-card flex w-full max-w-[720px] flex-col"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header className="border-xms-line flex items-center gap-3 border-b px-5 py-[14px]">
          <h2 className="text-xms-ink text-[17px] leading-[1.3] font-semibold">Personalize list columns</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-xms-icon hover:text-xms-accent ml-auto rounded-none"
          >
            <CloseIcon size={ICON.row} />
          </button>
        </header>

        <div className="flex items-start gap-3 px-5 py-4">
          <ListBox
            label="Available"
            rows={available}
            picked={pickedAvailable}
            onPick={setPickedAvailable}
            onCommit={add}
          />
          <div className="flex flex-col gap-2 self-center">
            <button
              type="button"
              aria-label="Add the chosen columns to the list"
              onClick={add}
              disabled={pickedAvailable.length === 0}
              className={MOVE_BUTTON}
            >
              <ChevronDownIcon size={ICON.control} className="-rotate-90" />
            </button>
            <button
              type="button"
              aria-label="Take the chosen columns off the list"
              onClick={remove}
              disabled={pickedChosen.length === 0}
              className={MOVE_BUTTON}
            >
              <ChevronDownIcon size={ICON.control} className="rotate-90" />
            </button>
          </div>
          <ListBox
            label="Selected"
            rows={chosen.map((key) => ({ key, title: titles.get(key) ?? key }))}
            picked={pickedChosen}
            onPick={setPickedChosen}
            onCommit={remove}
          />
          <div className="flex flex-col gap-2 self-center">
            <button
              type="button"
              aria-label="Move the chosen column up"
              onClick={() => shift(-1)}
              disabled={pickedChosen.length !== 1}
              className={MOVE_BUTTON}
            >
              <ChevronDownIcon size={ICON.control} className="rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Move the chosen column down"
              onClick={() => shift(1)}
              disabled={pickedChosen.length !== 1}
              className={MOVE_BUTTON}
            >
              <ChevronDownIcon size={ICON.control} />
            </button>
          </div>
        </div>

        {/* The switches the reference dialogue carries, less the two that ask
            a list to be edited in place: XMS edits a case on its record, where
            the change is audited and the clock knows about it. */}
        <div className="border-xms-line grid grid-cols-2 gap-x-6 gap-y-[10px] border-t px-5 py-4">
          {SWITCHES.map((option) => (
            <label key={option.key} className="text-xms-ink flex items-center gap-[10px] text-[13px]">
              <input
                type="checkbox"
                checked={switches[option.key]}
                onChange={(event) => setSwitches((current) => ({ ...current, [option.key]: event.target.checked }))}
              />
              {option.label}
            </label>
          ))}
        </div>

        <footer className="border-xms-line flex items-center gap-2 border-t px-5 py-[14px]">
          <button
            type="button"
            onClick={onReset}
            disabled={busy || isDefault}
            className={cn(SECONDARY_BUTTON, "mr-auto")}
          >
            Reset to column defaults
          </button>
          <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(chosen, switches)} disabled={busy} className={PRIMARY_BUTTON}>
            OK
          </button>
        </footer>
      </div>
    </div>
  );
}

function ListBox({
  label,
  rows,
  picked,
  onPick,
  onCommit,
}: {
  label: string;
  rows: ColumnChoice[];
  picked: string[];
  onPick: (keys: string[]) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-[6px]">
      <span className="text-xms-label text-[12px] leading-[1.3]">{label}</span>
      <select
        multiple
        aria-label={label}
        value={picked}
        onChange={(event) => onPick(Array.from(event.target.selectedOptions, (option) => option.value))}
        onDoubleClick={onCommit}
        className={LIST_BOX}
      >
        {rows.map((row) => (
          <option key={row.key} value={row.key} className="px-[10px] py-[3px]">
            {row.title}
          </option>
        ))}
      </select>
    </label>
  );
}
