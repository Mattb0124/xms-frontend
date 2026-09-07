"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { DeadLettersTab } from "@/components/admin/connectors/dead-letters-tab";
import { FieldMapTab } from "@/components/admin/connectors/field-map-tab";
import { InstanceHeader } from "@/components/admin/connectors/instance-header";
import { RunsTab } from "@/components/admin/connectors/runs-tab";
import { SettingsTab } from "@/components/admin/connectors/settings-tab";
import { StateMapTab } from "@/components/admin/connectors/state-map-tab";
import { AdminGate } from "@/components/admin/primitives";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { useConnectorInstance } from "@/redux/connectorsApi";

/** Registered as `admin.connector`: header with the switches, then Settings, Field map, State map, Runs, Dead letters. */
export default function AdminConnectorRecordPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { instance, isLoading, isError, refetch } = useConnectorInstance(id);
  const [tab, setTab] = useState("settings");
  const tabs = [
    { key: "settings", label: "Settings" },
    { key: "field-map", label: "Field map" },
    { key: "state-map", label: "State map" },
    { key: "runs", label: "Runs" },
    { key: "dead-letters", label: "Dead letters", count: instance?.open_dead_letters },
  ];
  return (
    <AdminGate permission="admin:connectors">
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
          <TabBar tabs={tabs} active={tab} onChange={setTab} className="mb-4" />
          {tab === "settings" ? <SettingsTab instance={instance} refetch={refetch} /> : null}
          {tab === "field-map" ? <FieldMapTab instance={instance} /> : null}
          {tab === "state-map" ? <StateMapTab instance={instance} /> : null}
          {tab === "runs" ? <RunsTab instanceId={instance.id} /> : null}
          {tab === "dead-letters" ? <DeadLettersTab instanceId={instance.id} /> : null}
        </>
      ) : null}
    </AdminGate>
  );
}
