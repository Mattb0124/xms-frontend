"use client";

import { useMemo } from "react";
import { ConnectorHealthList } from "@/components/admin/connectors/health-list";
import { AdminGate } from "@/components/admin/primitives";
import { useListAccountsQuery } from "@/redux/adminApi";
import { useConnectorHealthQuery } from "@/redux/connectorsApi";
import { useMe } from "@/redux/me";

/** Registered as `admin.connectors`: the sync health screen over every instance the reader can see. */
export default function AdminConnectorsPage() {
  const me = useMe();
  const health = useConnectorHealthQuery(undefined, { pollingInterval: 30_000, refetchOnFocus: true });
  const accounts = useListAccountsQuery(undefined, { skip: !me.hasPermission("admin:accounts") });
  const names = useMemo(
    () => Object.fromEntries((accounts.data ?? []).map((account) => [account.id, account.name])),
    [accounts.data],
  );
  return (
    <AdminGate permission="admin:connectors">
      <ConnectorHealthList rows={health.data ?? []} accountNames={names} loading={health.isLoading} />
    </AdminGate>
  );
}
