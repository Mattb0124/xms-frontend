"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AccountRenewalChips } from "@/components/admin/contracts/renewal-chip";
import { AdminGate } from "@/components/admin/primitives";
import { AccountCoverageChips } from "@/components/capacity/coverage-chips";
import { AccountDashboard } from "@/components/reporting/account-dashboard";
import { AccountCsatView } from "@/components/reporting/csat-panel";
import { AccountBudgetView } from "@/components/time/budget-view";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { useMe } from "@/redux/me";

/** The tabs of the account dashboard; a tab names the permission its own reads need. */
const TABS: { key: string; label: string; permission?: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "budget", label: "Budget", permission: "contracts:view" },
  { key: "satisfaction", label: "Satisfaction" },
];

/**
 * The tabs this viewer may open. The Budget tab reads
 * /v1/accounts/:id/budget, which the API guards with contracts:view, so a
 * reader without it is not offered the tab and never lands on it.
 */
export function accountTabs(permissions: ReadonlySet<string> | undefined): typeof TABS {
  return TABS.filter((tab) => !tab.permission || (permissions?.has(tab.permission) ?? false));
}

/** The tab a link opens (`?tab=budget` from the threshold notifications); the dashboard otherwise. */
export function initialAccountTab(search: URLSearchParams | null, tabs: { key: string }[] = TABS): string {
  const requested = search?.get("tab");
  return requested && tabs.some((tab) => tab.key === requested) ? requested : "dashboard";
}

function AccountScreen({ accountId }: { accountId: string }) {
  const search = useSearchParams();
  const me = useMe();
  const tabs = useMemo(() => accountTabs(me.permissions), [me.permissions]);
  const [tab, setTab] = useState(() => search?.get("tab") ?? "dashboard");
  // The permission set arrives after the first render, so the tab in hand is
  // resolved against the tabs allowed now rather than frozen at mount.
  const active = tabs.some((row) => row.key === tab) ? tab : "dashboard";
  return (
    <>
      <AccountRenewalChips accountId={accountId} />
      <AccountCoverageChips accountId={accountId} />
      <TabBar tabs={tabs} active={active} onChange={setTab} className="mb-4" />
      {active === "dashboard" ? <AccountDashboard accountId={accountId} /> : null}
      {active === "budget" ? <AccountBudgetView accountId={accountId} /> : null}
      {active === "satisfaction" ? <AccountCsatView accountId={accountId} /> : null}
    </>
  );
}

/**
 * Registered as `account` (P2.19.3, DR-03): one account's dashboard with
 * "View as client" and the Reports card, the Budget view as a tab
 * (`?tab=budget`, the target of the threshold notifications) for readers
 * with contracts:view and no admin:accounts, and the Satisfaction tab
 * (`?tab=satisfaction`, CSAT per account); the renewal chips for any
 * engagement the server marked expiring sit above the tabs under
 * contracts:view, and the skills coverage chips under capacity:view.
 */
export default function AccountPage() {
  const params = useParams<{ id: string }>();
  return (
    <AdminGate permission="tickets:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <AccountScreen accountId={params.id} />
      </Suspense>
    </AdminGate>
  );
}
