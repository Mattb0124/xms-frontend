"use client";

import { useState } from "react";

let issued = 0;

function freshKeys(count: number): string[] {
  return Array.from({ length: count }, () => {
    issued += 1;
    return `row-${issued}`;
  });
}

export interface RowKeys {
  /** One key per row, in the rows' order. */
  keys: string[];
  /** Called beside removing the row at `index`, so the rows after it keep their own keys. */
  drop: (index: number) => void;
}

/**
 * React keys for the rows of an editable list whose rows carry no identity of
 * their own. They are held beside the rows rather than in them because the
 * rows are what the editor sends and compares: a key inside one would reach
 * the request body or the saved definition, or mark an untouched draft as
 * changed.
 *
 * A row appended at the end, or a list replaced from outside, is matched by
 * position; only a row removed from the middle needs `drop`.
 */
export function useRowKeys(count: number): RowKeys {
  const [keys, setKeys] = useState(() => freshKeys(count));
  const drop = (index: number) => setKeys((current) => current.filter((_, at) => at !== index));
  if (keys.length === count) return { keys, drop };
  const resized = keys.length < count ? [...keys, ...freshKeys(count - keys.length)] : keys.slice(0, count);
  setKeys(resized);
  return { keys: resized, drop };
}
