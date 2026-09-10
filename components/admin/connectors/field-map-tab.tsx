"use client";

import { useState } from "react";
import { FieldMapEditor } from "@/components/admin/connectors/field-map-editor";
import { useMapLifecycle } from "@/components/admin/connectors/map-lifecycle";
import { MapVersions, ValidationReportView } from "@/components/admin/connectors/map-versions";
import { MapStatePill } from "@/components/admin/connectors/pills";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useConnectorErrors } from "@/lib/connectors/use-connector-errors";
import {
  useListFieldMapsQuery,
  useLoadSamplesMutation,
  type ConnectorInstance,
  type DictionaryField,
  type FieldMapEntry,
} from "@/redux/connectorsApi";

const EMPTY: FieldMapEntry[] = [];

function pickValue(record: Record<string, unknown>, field: string): string {
  const raw = record[field];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const reference = raw as { display_value?: unknown; value?: unknown };
    return String(reference.display_value ?? reference.value ?? "");
  }
  return raw === null || raw === undefined ? "" : String(raw);
}

/** Field map versions, the draft editor, Load samples, Validate and Activate (functional 5.2 steps 2 and 5). */
export function FieldMapTab({ instance }: { instance: ConnectorInstance }) {
  const maps = useListFieldMapsQuery(instance.id);
  const life = useMapLifecycle<FieldMapEntry[]>(instance.id, "field", maps.data, EMPTY);
  const [loadSamples, samplesState] = useLoadSamplesMutation();
  const onError = useConnectorErrors();
  const [dictionary, setDictionary] = useState<DictionaryField[] | undefined>();
  const [samples, setSamples] = useState<Record<string, unknown>[]>(() => life.selected?.samples ?? []);

  const load = async () => {
    try {
      const result = await loadSamples({
        id: instance.id,
        map_id: life.selected?.state === "draft" ? life.selected.id : undefined,
      }).unwrap();
      setDictionary(result.dictionary);
      setSamples(result.records);
    } catch (caught) {
      onError(caught);
    }
  };

  if (maps.isLoading) return <Skeleton lines={5} />;
  const selected = life.selected;
  const externals = [...new Set(life.draft.map((entry) => entry.external).filter(Boolean))];
  const sampleRows = samples.length > 0 ? samples : (selected?.samples ?? []);

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
      <div className="flex flex-col gap-4">
        <Panel
          title="Versions"
          caption={instance.active_field_map_id ? "One version is active" : "No active version yet"}
          actions={
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={life.busy}
              onClick={() => void life.newDraft()}
            >
              New draft
            </button>
          }
        >
          <MapVersions rows={maps.data ?? []} selectedId={selected?.id} onSelect={life.select} />
        </Panel>
        <Panel title="Validation" caption="Must pass before activation">
          <ValidationReportView report={life.report} />
        </Panel>
      </div>
      <div className="flex flex-col gap-4">
        {selected ? (
          <Panel
            title={`Field map v${selected.version}`}
            caption={life.editable ? "Draft: edit, save, validate, then activate" : "Read only"}
            actions={
              <>
                <MapStatePill state={selected.state} />
                <button
                  type="button"
                  className={SECONDARY_BUTTON}
                  disabled={samplesState.isLoading}
                  onClick={() => void load()}
                >
                  {samplesState.isLoading ? "Loading" : "Load samples"}
                </button>
                {life.editable ? (
                  <>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON}
                      disabled={!life.dirty || life.busy}
                      onClick={() => void life.save()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON}
                      disabled={life.dirty || life.busy}
                      title={life.dirty ? "Save before validating" : undefined}
                      onClick={() => void life.validate()}
                    >
                      Validate
                    </button>
                    <button
                      type="button"
                      className={PRIMARY_BUTTON}
                      disabled={!life.canActivate || life.busy}
                      title={life.canActivate ? undefined : "Validate this version first"}
                      onClick={() => void life.activate()}
                    >
                      Activate
                    </button>
                  </>
                ) : null}
              </>
            }
          >
            <FieldMapEditor
              entries={life.draft}
              dictionary={dictionary}
              readOnly={!life.editable}
              onChange={life.setDraft}
            />
          </Panel>
        ) : (
          <Panel title="Field map" caption="Nothing mapped yet">
            <p className="text-xms-label text-[14px]">
              Create a draft, load samples, map the required fields, validate, activate.
            </p>
          </Panel>
        )}
        {sampleRows.length > 0 && externals.length > 0 ? (
          <Panel title="Samples" caption={`${sampleRows.length} recent records, mapped fields only`} flush>
            <table className="w-full text-[14px]" aria-label="Samples">
              <thead>
                <tr className="border-xms-line text-xms-ink border-b text-left">
                  {externals.map((field) => (
                    <th key={field} className="xms-mono px-3 py-2 font-semibold">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((record, index) => (
                  <tr key={index} className="border-xms-line border-b">
                    {externals.map((field) => (
                      <td
                        key={field}
                        className="text-xms-body max-w-[240px] truncate px-3 py-1"
                        title={pickValue(record, field)}
                      >
                        {pickValue(record, field)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
