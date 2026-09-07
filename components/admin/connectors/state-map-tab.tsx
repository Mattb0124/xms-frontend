"use client";

import { useMapLifecycle } from "@/components/admin/connectors/map-lifecycle";
import { MapVersions, ValidationReportView } from "@/components/admin/connectors/map-versions";
import { MapStatePill } from "@/components/admin/connectors/pills";
import { StateMapEditor } from "@/components/admin/connectors/state-map-editor";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useListStateMapsQuery, type ConnectorInstance, type StateMapEntries } from "@/redux/connectorsApi";

const EMPTY: StateMapEntries = {};

/** State map versions with the per-type editor, Validate and Activate (functional 5.2 step 3). */
export function StateMapTab({ instance }: { instance: ConnectorInstance }) {
  const maps = useListStateMapsQuery(instance.id);
  const life = useMapLifecycle<StateMapEntries>(instance.id, "state", maps.data, EMPTY);
  if (maps.isLoading) return <Skeleton lines={5} />;
  const selected = life.selected;
  return (
    <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
      <div className="flex flex-col gap-4">
        <Panel
          title="Versions"
          caption={instance.active_state_map_id ? "One version is active" : "No active version yet"}
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
        <Panel title="Validation" caption="Unmapped states are listed here">
          <ValidationReportView report={life.report} />
        </Panel>
      </div>
      {selected ? (
        <Panel
          title={`State map v${selected.version}`}
          caption={life.editable ? "Draft: edit, save, validate, then activate" : "Read only"}
          actions={
            <>
              <MapStatePill state={selected.state} />
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
          <StateMapEditor entries={life.draft} readOnly={!life.editable} onChange={life.setDraft} />
        </Panel>
      ) : (
        <Panel title="State map" caption="Nothing mapped yet">
          <p className="text-xms-label text-[13px]">Create a draft and map the states of each ticket type both ways.</p>
        </Panel>
      )}
    </div>
  );
}
