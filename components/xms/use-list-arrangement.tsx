"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useHeaderSettings } from "@/components/shell/content-header-bar";
import type { DenseColumn } from "@/components/xms/dense-table";
import { PersonalizeColumns } from "@/components/xms/personalize-columns";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import {
  arrange,
  choices as columnChoices,
  defaultSelection,
  readOptions,
  type DisplayOptions,
} from "@/lib/tables/arrangement";
import {
  useClearListPreferenceMutation,
  useGetListPreferencesQuery,
  useSaveListPreferenceMutation,
} from "@/redux/listPreferencesApi";

export interface ListArrangement<Row> {
  /** The screen's columns, reordered and hidden to match the reader. */
  columns: DenseColumn<Row>[];
  /** The display switches, for the table to read. */
  display: DisplayOptions;
  /** The dialogue, mounted only while it is open. Render it on the screen. */
  dialogue: ReactNode;
  /** Open it from somewhere other than the gear, a card mark say. */
  open: () => void;
}

/**
 * One list, arranged the way this reader wants it.
 *
 * The screen keeps authoring its own columns and passes them in whole; this
 * only reorders them and hides the ones the reader has put aside. A hidden
 * column is still carried, so a list can open on a clock that is not drawn.
 *
 * The gear on the tool strip opens the dialogue for as long as the screen is
 * mounted. Until the preferences arrive the screen's own set is drawn, so a
 * slow round trip costs nothing but a redraw.
 */
export function useListArrangement<Row>(screen: string, columns: DenseColumn<Row>[]): ListArrangement<Row> {
  const [open, setOpen] = useState(false);
  const { data: preferences } = useGetListPreferencesQuery();
  const [save, saveState] = useSaveListPreferenceMutation();
  const [clear, clearState] = useClearListPreferenceMutation();
  const toast = useToast();
  useHeaderSettings(() => setOpen(true));

  const saved = preferences?.find((preference) => preference.screen === screen);
  const defaults = useMemo(() => defaultSelection(columns), [columns]);
  const selection = useMemo(() => {
    const wanted = saved?.columns.filter((key) => columns.some((column) => column.key === key)) ?? [];
    return wanted.length > 0 ? wanted : defaults;
  }, [saved, columns, defaults]);
  const arranged = useMemo(() => arrange(columns, saved?.columns), [columns, saved]);
  const display = useMemo(() => readOptions(saved?.options), [saved]);

  const busy = saveState.isLoading || clearState.isLoading;

  const dialogue = open ? (
    <PersonalizeColumns
      choices={columnChoices(columns)}
      selection={selection}
      options={display}
      defaults={defaults}
      busy={busy}
      onClose={() => setOpen(false)}
      onSave={async (next, options) => {
        try {
          await save({ screen, columns: next, options: { ...options } }).unwrap();
          setOpen(false);
        } catch (error) {
          toast.push({ tone: "error", title: "The arrangement was not saved", detail: describeError(apiError(error)) });
        }
      }}
      onReset={async () => {
        try {
          await clear(screen).unwrap();
          setOpen(false);
        } catch (error) {
          toast.push({ tone: "error", title: "The arrangement was not reset", detail: describeError(apiError(error)) });
        }
      }}
    />
  ) : null;

  return { columns: arranged, display, dialogue, open: () => setOpen(true) };
}
