"use client";

import Link from "next/link";
import { AddServiceNowForm } from "@/components/admin/connectors/add-servicenow-form";
import { HealthPill, ModePill } from "@/components/admin/connectors/pills";
import { formatDate } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useListConnectorsQuery } from "@/redux/connectorsApi";
import { useMe } from "@/redux/me";

/** The account record's Connectors tab (User Experience 3.9): instances with health and mode, and the add form. */
export function AccountConnectorsTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const permitted = me.hasPermission("admin:connectors");
  const { data, isLoading } = useListConnectorsQuery(accountId, { skip: !permitted });
  if (!permitted) {
    return (
      <Panel title="Connectors" caption="Needs the admin:connectors permission">
        <p className="text-xms-label text-[14px]">You can see this account but not its connectors.</p>
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <Panel title="Connector instances" caption="Each instance has its own credential, maps, mode and health">
        {isLoading ? <Skeleton lines={3} /> : null}
        {data && data.length === 0 ? (
          <p className="text-xms-label text-[14px]">No connector on this account yet.</p>
        ) : null}
        <ul className="divide-xms-line divide-y" aria-label="Connector instances">
          {(data ?? []).map((instance) => (
            <li
              key={instance.id}
              className="flex flex-wrap items-center gap-3 py-2 text-[14px]"
              data-instance={instance.id}
            >
              <Link href={`/admin/connectors/${instance.id}`} className="text-xms-accent font-medium">
                {instance.name}
              </Link>
              <span className="xms-mono text-xms-label text-[14px]">{instance.table_name}</span>
              <ModePill mode={instance.mode} />
              <HealthPill health={instance.health} reason={instance.trip_reason} />
              <span className="xms-mono text-xms-muted ml-auto text-[14px]">
                {instance.last_success_at ? `last success ${formatDate(instance.last_success_at)}` : "no run yet"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <AddServiceNowForm accountId={accountId} />
    </div>
  );
}
