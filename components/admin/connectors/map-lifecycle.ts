"use client";

import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/xms/toast";
import { useConnectorErrors } from "@/lib/connectors/use-connector-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useActivateMapMutation,
  useCreateMapMutation,
  useUpdateMapMutation,
  useValidateMapMutation,
  type MapKind,
  type MapRow,
  type ValidationReport,
} from "@/redux/connectorsApi";

/** The newest editable version wins, then the active one, then the newest of all. */
export function pickDefaultMap<E>(rows: MapRow<E>[]): MapRow<E> | undefined {
  const byVersion = [...rows].sort((a, b) => b.version - a.version);
  return (
    byVersion.find((row) => row.state === "draft" || row.state === "validated") ??
    byVersion.find((row) => row.state === "active") ??
    byVersion[0]
  );
}

export function isEditable(state: MapRow<unknown>["state"] | undefined): boolean {
  return state === "draft" || state === "validated";
}

/**
 * One lifecycle for both map kinds (ServiceNow Sync functional 5.2 steps
 * 2, 3 and 5): pick a version, edit a draft copy, save, validate, activate.
 * Activation is offered only for a validated, unchanged version; the API
 * enforces the same rule with 409 map_not_validated.
 */
export function useMapLifecycle<E>(instanceId: string, kind: MapKind, rows: MapRow<E>[] | undefined, empty: E) {
  const [create, createState] = useCreateMapMutation();
  const [update, updateState] = useUpdateMapMutation();
  const [validate, validateState] = useValidateMapMutation();
  const [activate, activateState] = useActivateMapMutation();
  const onError = useConnectorErrors();
  const { push } = useToast();
  const trackActivate = useTrack("connector.map.activate");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (!rows) return undefined;
    return rows.find((row) => row.id === selectedId) ?? pickDefaultMap(rows);
  }, [rows, selectedId]);

  const [draft, setDraft] = useState<E>(empty);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<ValidationReport | null>(null);
  if (selected && draftFor !== selected.id) {
    setDraftFor(selected.id);
    setDraft(selected.entries);
    setLastReport(null);
  }
  const dirty = selected ? JSON.stringify(draft) !== JSON.stringify(selected.entries) : false;
  const editable = isEditable(selected?.state);
  const report = lastReport ?? selected?.validation_report ?? null;
  const busy = createState.isLoading || updateState.isLoading || validateState.isLoading || activateState.isLoading;

  const select = useCallback((id: string) => setSelectedId(id), []);

  const newDraft = useCallback(
    async (entries?: E) => {
      try {
        const row = await create({ id: instanceId, kind, entries: entries ?? selected?.entries ?? empty }).unwrap();
        setSelectedId(row.id);
      } catch (caught) {
        onError(caught);
      }
    },
    [create, instanceId, kind, selected, empty, onError],
  );

  const save = useCallback(async () => {
    if (!selected) return;
    try {
      await update({ id: instanceId, kind, mapId: selected.id, entries: draft }).unwrap();
      setLastReport(null);
    } catch (caught) {
      onError(caught);
    }
  }, [update, instanceId, kind, selected, draft, onError]);

  const runValidate = useCallback(async () => {
    if (!selected) return;
    try {
      const result = await validate({ id: instanceId, kind, mapId: selected.id }).unwrap();
      setLastReport(result);
    } catch (caught) {
      onError(caught);
    }
  }, [validate, instanceId, kind, selected, onError]);

  const runActivate = useCallback(async () => {
    if (!selected) return;
    try {
      await activate({ id: instanceId, kind, mapId: selected.id }).unwrap();
      trackActivate({ instance_id: instanceId, kind, map_id: selected.id, version: selected.version });
      push({
        title: "Activated",
        detail: `${kind === "field" ? "Field" : "State"} map version ${selected.version} is live.`,
        tone: "success",
      });
    } catch (caught) {
      onError(caught);
    }
  }, [activate, instanceId, kind, selected, trackActivate, push, onError]);

  return {
    selected,
    select,
    draft,
    setDraft,
    dirty,
    editable,
    report,
    busy,
    canActivate: Boolean(selected && selected.state === "validated" && !dirty),
    newDraft,
    save,
    validate: runValidate,
    activate: runActivate,
  };
}
