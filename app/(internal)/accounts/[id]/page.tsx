"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AdminGate } from "@/components/admin/primitives";
import { AccountCoverageChips } from "@/components/capacity/coverage-chips";
import { AccountDashboard } from "@/components/reporting/account-dashboard";
import { AccountCsatView } from "@/components/reporting/csat-panel";
import { AccountBudgetView } from "@/components/time/budget-view";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "budget", label: "Budget" },
  { key: "satisfaction", label: "Satisfaction" },
];

/** The tab a link opens (`?tab=budget` from the threshold notifications); the dashboard otherwise. */
export function initialAccountTab(search: URLSearchParams | null): string {
  const requested = search?.get("tab");
  return requested && TABS.some((tab) => tab.key === requested) ? requested : "dashboard";
}

function AccountScreen({ accountId }: { accountId: string }) {
  const search = useSearchParams();
  const [tab, setTab] = useState(() => initialAccountTab(search));
  return (
    <>
      <AccountCoverageChips accountId={accountId} />
      <TabBar tabs={TABS} active={tab} onChange={setTab} className="mb-4" />
      {tab === "dashboard" ? <AccountDashboard accountId={accountId} /> : null}
      {tab === "budget" ? <AccountBudgetView accountId={accountId} /> : null}
      {tab === "satisfaction" ? <AccountCsatView accountId={accountId} /> : null}
    </>
  );
}

/**
 * Registered as `account` (P2.19.3, DR-03): one account's dashboard with
 * "View as client" and the Reports card, the Budget view as a tab
 * (`?tab=budget`, the target of the threshold notifications) for readers
 * with tickets:view and no admin:accounts, and the Satisfaction tab
 * (`?tab=satisfaction`, CSAT per account); the skills coverage chips sit
 * above the tabs under capacity:view.
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
