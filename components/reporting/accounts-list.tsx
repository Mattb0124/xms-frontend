"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { AccountStatusPill } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Skeleton } from "@/components/xms/skeleton";
import { useMe } from "@/redux/me";
import { useOperationsDashboardQuery, type AccountStrip } from "@/redux/reportingApi";
import { useListGrantedAccountsQuery, type GrantedAccount } from "@/redux/ticketsApi";

interface AccountListRow extends GrantedAccount {
  measures?: AccountStrip["measures"];
}

/**
 * Granted accounts (User Experience 3.9, list cut): the accounts the viewer
 * may see with open and breached counts from the operations strip when the
 * viewer holds reports:view-portfolio; otherwise the identity columns only.
 */
export function AccountsList() {
  const router = useRouter();
  const me = useMe();
  const portfolio = me.hasPermission("reports:view-portfolio");
  const accounts = useListGrantedAccountsQuery();
  const operations = useOperationsDashboardQuery({ days: 7 }, { skip: !portfolio });

  const rows = useMemo<AccountListRow[]>(() => {
    const strip = new Map((operations.data?.per_account ?? []).map((row) => [row.account_id, row.measures]));
    return (accounts.data ?? []).map((account) => ({ ...account, measures: strip.get(account.id) }));
  }, [accounts.data, operations.data]);

  const columns = useMemo<DenseColumn<AccountListRow>[]>(() => {
    const base: DenseColumn<AccountListRow>[] = [
      {
        key: "name",
        title: "Account",
        sortValue: (row) => row.name,
        render: (row) => <span className="text-xms-body">{row.name}</span>,
      },
      { key: "key", title: "Key", mono: true, sortValue: (row) => row.key },
      {
        key: "status",
        title: "Status",
        sortValue: (row) => row.status,
        render: (row) => <AccountStatusPill status={row.status} />,
      },
    ];
    if (!portfolio) return base;
    return [
      ...base,
      {
        key: "open",
        title: "Open",
        align: "right",
        mono: true,
        sortValue: (row) => row.measures?.open_tickets ?? null,
        render: (row) => (row.measures ? row.measures.open_tickets : ""),
      },
      {
        key: "breached",
        title: "Breached",
        align: "right",
        mono: true,
        sortValue: (row) => row.measures?.breached_now ?? null,
        render: (row) =>
          row.measures ? (
            <span
              className={row.measures.breached_now > 0 ? "text-[color:var(--state-overdue-text)] font-semibold" : ""}
            >
              {row.measures.breached_now}
            </span>
          ) : (
            ""
          ),
      },
      {
        key: "unassigned",
        title: "Unassigned",
        align: "right",
        mono: true,
        sortValue: (row) => row.measures?.unassigned_now ?? null,
        render: (row) => (row.measures ? row.measures.unassigned_now : ""),
      },
    ];
  }, [portfolio]);

  if (accounts.isLoading && !accounts.data) return <Skeleton lines={6} />;

  return (
    <DenseTable<AccountListRow>
      title="Accounts"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/accounts/${row.id}`)}
      emptyState="No granted accounts. Ask an administrator for account access."
    />
  );
}
