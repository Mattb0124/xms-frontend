"use client";

import { useMemo } from "react";
import { ConnectorHealthList } from "@/components/admin/connectors/health-list";
import { AdminGate } from "@/components/admin/primitives";
import { useListAccountsQuery } from "@/redux/adminApi";
import { useConnectorHealthQuery } from "@/redux/connectorsApi";
import { useMe } from "@/redux/me";

/**
 * The screen itself, mounted only once the reader holds the permission,
 * so the queries below are never sent by someone the API would refuse
 * (review finding 25).
 */
function AdminConnectorsPageBody() {
  const me = useMe();
  const health = useConnectorHealthQuery(undefined, { pollingInterval: 30_000, refetchOnFocus: true });
  const accounts = useListAccountsQuery(undefined, { skip: !me.hasPermission("admin:accounts") });
  const names = useMemo(
    () => Object.fromEntries((accounts.data ?? []).map((account) => [account.id, account.name])),
    [accounts.data],
  );
  return (
    <>
      <ConnectorHealthList rows={health.data ?? []} accountNames={names} loading={health.isLoading} />
    </>
  );
}

/** Registered as `admin.connectors`: the sync health screen over every instance the reader can see. */
export default function AdminConnectorsPage() {
  return (
    <AdminGate permission="admin:connectors">
      <AdminConnectorsPageBody />
    </AdminGate>
  );
}
