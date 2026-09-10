"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AccountStatusPill } from "@/components/admin/primitives";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { FilterSelect } from "@/components/xms/filter-select";
import { ICON, SearchIcon } from "@/components/xms/icons";
import { Skeleton } from "@/components/xms/skeleton";
import { useMe } from "@/redux/me";
import { useOperationsDashboardQuery, type AccountStrip } from "@/redux/reportingApi";
import { useListGrantedAccountsQuery, type GrantedAccount } from "@/redux/ticketsApi";
import { SignalPill } from "@/components/xms/signal-pill";
import { HEALTH_LABEL, HEALTH_TONE } from "@/lib/health/bands";

interface AccountListRow extends GrantedAccount {
  measures?: AccountStrip["measures"];
  health?: AccountStrip["health"];
}

/** The statuses an account can be in, in the order it moves through them. */
const STATUSES = ["onboarding", "active", "suspended", "offboarding", "offboarded"];

/**
 * The two dimensions this list narrows on, kept out of the component so the
 * rule can be read and tested on its own: the status the account is in, and
 * the words a reader typed, matched against the name and the key.
 */
export function filterAccounts<Row extends { name: string; key: string; status: string }>(
  rows: Row[],
  status: string,
  query: string,
): Row[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!needle) return true;
    return row.name.toLowerCase().includes(needle) || row.key.toLowerCase().includes(needle);
  });
}

/**
 * Granted accounts (User Experience 3.9, list cut): the accounts the viewer
 * may see with open and breached counts from the operations strip when the
 * viewer holds reports:view-portfolio; otherwise the identity columns only.
 *
 * No v3 render draws this screen, so it takes the list grammar every other
 * one stands on: the dimensions on the grey strip, the search in the card
 * header, the line that says what the card holds.
 */
export function AccountsList() {
  const router = useRouter();
  const me = useMe();
  const portfolio = me.hasPermission("reports:view-portfolio");
  const accounts = useListGrantedAccountsQuery();
  const operations = useOperationsDashboardQuery({ days: 7 }, { skip: !portfolio });
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const rows = useMemo<AccountListRow[]>(() => {
    const strip = new Map((operations.data?.per_account ?? []).map((row) => [row.account_id, row]));
    const all = (accounts.data ?? []).map((account) => ({
      ...account,
      measures: strip.get(account.id)?.measures,
      health: strip.get(account.id)?.health,
    }));
    return filterAccounts(all, status, query);
  }, [accounts.data, operations.data, status, query]);

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
        // The score, sorted on so a portfolio opens worst first when a reader
        // asks it to. An account the window cannot judge sorts last rather
        // than reading as a zero.
        key: "health",
        title: "Health",
        width: "176px",
        sortValue: (row) => row.health?.score ?? null,
        render: (row) =>
          row.health ? (
            <span className="flex items-center gap-[8px]">
              <SignalPill tone={HEALTH_TONE[row.health.band]} label={HEALTH_LABEL[row.health.band]} />
              {row.health.score === null ? null : (
                <span className="xms-mono text-xms-ink text-[13px] tabular-nums">{row.health.score}</span>
              )}
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
    <>
      <HeaderFilters>
        <FilterSelect
          label="Show"
          primary
          count={rows.length}
          value={status}
          options={STATUSES.map((entry) => ({ value: entry, label: entry }))}
          onChange={setStatus}
        />
      </HeaderFilters>
      <DenseTable<AccountListRow>
        title="Accounts"
        subtitle="the accounts granted to you, and how each one is standing"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/accounts/${row.id}`)}
        search={
          <form
            className="border-xms-line bg-xms-card mx-auto flex h-[38px] w-full max-w-[400px] items-center gap-2 rounded-[4px] border px-[14px]"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              type="search"
              aria-label="Search accounts by name or key"
              placeholder="Search accounts by name or key"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="text-xms-ink min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
            <SearchIcon size={ICON.action} className="text-xms-muted shrink-0" />
          </form>
        }
        emptyState={
          status || query.trim()
            ? "No account here. Set Show back to all, or clear the search."
            : "No granted accounts. Ask an administrator for account access."
        }
      />
    </>
  );
}
