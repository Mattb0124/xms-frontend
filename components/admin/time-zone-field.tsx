"use client";

import { useMemo } from "react";
import { INPUT } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

/** The browser's IANA zone list; empty where `Intl.supportedValuesOf` is missing, so the field degrades to free text. */
export function supportedTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    return intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  } catch {
    return [];
  }
}

export interface TimeZoneFieldProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * A searchable time zone input: a text field over a datalist of the
 * browser's IANA zones. Typing filters; where the list is unavailable the
 * field is a plain text input and the API's `invalid_time_zone` is the check.
 */
export function TimeZoneField({ id, value, onChange, disabled, required, className }: TimeZoneFieldProps) {
  const zones = useMemo(() => supportedTimeZones(), []);
  const listId = `${id}-zones`;
  return (
    <>
      <input
        id={id}
        list={zones.length > 0 ? listId : undefined}
        className={cn(INPUT, className)}
        value={value}
        required={required}
        disabled={disabled}
        placeholder="Europe/London"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      {zones.length > 0 ? (
        <datalist id={listId}>
          {zones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}
