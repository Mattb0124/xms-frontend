"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DeadLettersTab } from "@/components/admin/connectors/dead-letters-tab";
import { FieldMapTab } from "@/components/admin/connectors/field-map-tab";
import { InstanceHeader } from "@/components/admin/connectors/instance-header";
import { OutboundTab } from "@/components/admin/connectors/outbound-tab";
import { RunsTab } from "@/components/admin/connectors/runs-tab";
import { SettingsTab } from "@/components/admin/connectors/settings-tab";
import { StateMapTab } from "@/components/admin/connectors/state-map-tab";
import { AdminGate } from "@/components/admin/primitives";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { useConnectorInstance } from "@/redux/connectorsApi";

const TABS = ["settings", "field-map", "state-map", "runs", "dead-letters", "outbound"];

function ConnectorRecord() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search.get("tab") ?? "";
  const tab = TABS.includes(requested) ? requested : "settings";
  const { instance, isLoading, isError, refetch } = useConnectorInstance(id);
  const tabs = [
    { key: "settings", label: "Settings" },
    { key: "field-map", label: "Field map" },
    { key: "state-map", label: "State map" },
    { key: "runs", label: "Runs" },
    { key: "dead-letters", label: "Dead letters", count: instance?.open_dead_letters },
    { key: "outbound", label: "Outbound", count: instance?.pending_outbound },
  ];
  // The tab and the queue's status filter both live in the URL, so a link to
  // this instance's failed outbound rows is a link a person can send
  // (User Experience 2.1). Leaving a tab drops the filter with it.
  const open = (next: string) => router.replace(next === "settings" ? pathname : `${pathname}?tab=${next}`);
  return (
    <>
      {isLoading ? <Skeleton lines={2} className="mb-4 max-w-sm" /> : null}
      {!isLoading && (isError || !instance) ? (
        <EmptyBanner
          title="This connector is not on your accounts"
          action={{ label: "Back to Connectors", href: "/admin/connectors" }}
        />
      ) : null}
      {instance ? (
        <>
          <InstanceHeader instance={instance} refetch={refetch} />
          <TabBar tabs={tabs} active={tab} onChange={open} className="mb-4" />
          {tab === "settings" ? <SettingsTab instance={instance} refetch={refetch} /> : null}
          {tab === "field-map" ? <FieldMapTab instance={instance} /> : null}
          {tab === "state-map" ? <StateMapTab instance={instance} /> : null}
          {tab === "runs" ? <RunsTab instanceId={instance.id} /> : null}
          {tab === "dead-letters" ? <DeadLettersTab instanceId={instance.id} /> : null}
          {tab === "outbound" ? <OutboundTab instanceId={instance.id} /> : null}
        </>
      ) : null}
    </>
  );
}

/**
 * Registered as `admin.connector`: header with the switches, then Settings,
 * Field map, State map, Runs, Dead letters and Outbound. The gate holds a
 * child, so nothing is asked of the API before admin:connectors is decided.
 */
export default function AdminConnectorRecordPage() {
  return (
    <AdminGate permission="admin:connectors">
      <Suspense fallback={<Skeleton lines={8} />}>
        <ConnectorRecord />
      </Suspense>
    </AdminGate>
  );
}
