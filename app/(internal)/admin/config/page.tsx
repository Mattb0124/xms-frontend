"use client";

import { useState } from "react";
import { AdminGate, formatDate } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { RailCard } from "@/components/xms/rail-card";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { TabBar } from "@/components/xms/tab-bar";
import { useGetConfigQuery, type ConfigDescription, type ConfigKind } from "@/redux/adminApi";

const KINDS: { key: ConfigKind; label: string }[] = [
  { key: "state_machine", label: "State machines" },
  { key: "priority_matrix", label: "Priority matrix" },
  { key: "sla_policy", label: "SLA policy" },
  { key: "activity_types", label: "Activity types" },
  { key: "billable_classes", label: "Billable classes" },
  { key: "resolution_codes", label: "Resolution codes" },
];

const TICKET_TYPES = [
  { key: "incident", label: "Incident" },
  { key: "service_request", label: "Service request" },
  { key: "change", label: "Change" },
  { key: "problem", label: "Problem" },
  { key: "project_task", label: "Project task" },
];

const LEVELS = ["high", "medium", "low"] as const;
const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;

const TABLE = "w-full border-collapse text-[14px]";
const TH = "text-xms-ink border-xms-line border-b px-3 py-2 text-left font-semibold";
const TD = "text-xms-ink border-xms-line border-b px-3 py-2 align-top";

interface MachineBody {
  initial: string;
  states: { key: string; label: string; kind: string; effects?: Record<string, boolean> }[];
  transitions: { from: string; to: string; label?: string; requires?: string[]; portal?: boolean; reopen?: boolean }[];
}

function StateMachineView({ body }: { body: MachineBody }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="States" caption={`Initial: ${body.initial}`} flush>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>State</th>
              <th className={TH}>Kind</th>
              <th className={TH}>Effects</th>
            </tr>
          </thead>
          <tbody>
            {body.states.map((state) => (
              <tr key={state.key}>
                <td className={TD}>
                  <StatePill state={state.key} label={state.label} />
                </td>
                <td className={TD}>{state.kind}</td>
                <td className={`${TD} xms-mono text-[14px]`}>
                  {Object.entries(state.effects ?? {})
                    .filter(([, on]) => on)
                    .map(([name]) => name)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Transitions" caption="Read only this sprint" flush>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>From</th>
              <th className={TH}>To</th>
              <th className={TH}>Requires</th>
              <th className={TH}>Portal</th>
            </tr>
          </thead>
          <tbody>
            {body.transitions.map((transition) => (
              <tr key={`${transition.from}>${transition.to}`}>
                <td className={`${TD} xms-mono`}>{transition.from}</td>
                <td className={`${TD} xms-mono`}>
                  {transition.to}
                  {transition.label ? <span className="text-xms-label ml-2 font-sans">{transition.label}</span> : null}
                  {transition.reopen ? <span className="text-xms-label ml-2 font-sans">reopen</span> : null}
                </td>
                <td className={`${TD} text-xms-label text-[14px]`}>{(transition.requires ?? []).join(", ")}</td>
                <td className={TD}>{transition.portal ? "Yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function MatrixView({ body }: { body: { cells: Record<string, Record<string, string>>; default: string } }) {
  return (
    <Panel title="Impact by urgency" caption={`Default when a value is missing: ${body.default.toUpperCase()}`} flush>
      <table className={TABLE} style={{ maxWidth: 480 }}>
        <thead>
          <tr>
            <th className={TH}>Impact \ Urgency</th>
            {LEVELS.map((urgency) => (
              <th key={urgency} className={TH}>
                {urgency}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((impact) => (
            <tr key={impact}>
              <td className={`${TD} font-medium`}>{impact}</td>
              {LEVELS.map((urgency) => (
                <td key={urgency} className={`${TD} xms-mono`} data-cell={`${impact}-${urgency}`}>
                  {(body.cells[impact]?.[urgency] ?? "").toUpperCase()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function SlaView({
  body,
}: {
  body: {
    calendar?: string;
    targets: Record<string, Record<string, { response_minutes: number | null; resolution_minutes: number | null }>>;
  };
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {TICKET_TYPES.map((type) => (
        <Panel key={type.key} title={type.label} caption={`Calendar: ${body.calendar ?? "24x7"}`} flush>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Priority</th>
                <th className={`${TH} text-right`}>Response (min)</th>
                <th className={`${TH} text-right`}>Resolution (min)</th>
              </tr>
            </thead>
            <tbody>
              {PRIORITIES.map((priority) => {
                const target = body.targets[type.key]?.[priority];
                return (
                  <tr key={priority}>
                    <td className={`${TD} xms-mono`}>{priority.toUpperCase()}</td>
                    <td className={`${TD} xms-mono text-right`}>{target?.response_minutes ?? "No SLA"}</td>
                    <td className={`${TD} xms-mono text-right`}>{target?.resolution_minutes ?? "No SLA"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      ))}
    </div>
  );
}

function ItemsView({ title, body }: { title: string; body: { items: Record<string, unknown>[] } }) {
  const columns = Array.from(new Set(body.items.flatMap((item) => Object.keys(item))));
  return (
    <Panel title={title} caption={`${body.items.length} items`} flush>
      <table className={TABLE}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className={TH}>
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.items.map((item) => (
            <tr key={String(item.key)}>
              {columns.map((column) => (
                <td key={column} className={`${TD} ${column === "key" ? "xms-mono" : ""}`}>
                  {typeof item[column] === "boolean" ? (item[column] ? "Yes" : "No") : String(item[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function VersionsRail({ data }: { data: ConfigDescription }) {
  return (
    <RailCard caption="Versions">
      <ul className="flex flex-col gap-2">
        {data.versions.map((version) => (
          <li key={version.id} className="flex items-center gap-2">
            <span className="xms-mono">v{version.version}</span>
            <StatePill
              state={version.status === "active" ? "resolved" : version.status === "draft" ? "new" : "closed"}
              label={version.status}
            />
            <span className="xms-mono text-xms-label ml-auto text-[14px]">{formatDate(version.activated_at)}</span>
          </li>
        ))}
        {data.versions.length === 0 ? <li className="text-xms-label">No versions yet. Run the seed.</li> : null}
      </ul>
    </RailCard>
  );
}

function ConfigBody({ kind, scope }: { kind: ConfigKind; scope?: string }) {
  const { data, isLoading } = useGetConfigQuery({ kind, scope });
  if (isLoading || !data) return <Skeleton lines={6} className="max-w-md" />;
  const body = data.active?.body;
  let view;
  if (!body) view = <Panel title="No active version">The seed has not been applied for this catalog.</Panel>;
  else if (kind === "state_machine") view = <StateMachineView body={body as MachineBody} />;
  else if (kind === "priority_matrix") view = <MatrixView body={body as never} />;
  else if (kind === "sla_policy") view = <SlaView body={body as never} />;
  else view = <ItemsView title={KINDS.find((k) => k.key === kind)?.label ?? kind} body={body as never} />;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
      <div>{view}</div>
      <VersionsRail data={data} />
    </div>
  );
}

/** Registered as `admin.config`: read-only catalog viewer with the version rail (editors land in P2.9.2). */
export default function AdminConfigPage() {
  const [kind, setKind] = useState<ConfigKind>("state_machine");
  const [type, setType] = useState("incident");
  return (
    <AdminGate permission="admin:accounts">
      <TabBar tabs={KINDS} active={kind} onChange={(key) => setKind(key as ConfigKind)} className="mb-4" />
      {kind === "state_machine" ? (
        <TabBar tabs={TICKET_TYPES} active={type} onChange={setType} className="mb-4" />
      ) : null}
      <ConfigBody kind={kind} scope={kind === "state_machine" ? type : undefined} />
    </AdminGate>
  );
}
