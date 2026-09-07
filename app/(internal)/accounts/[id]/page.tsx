"use client";

import { useParams } from "next/navigation";
import { AdminGate } from "@/components/admin/primitives";
import { AccountDashboard } from "@/components/reporting/account-dashboard";

/** Registered as `account` (P2.19.3, DR-03): one account's dashboard with "View as client" and the Reports card. */
export default function AccountPage() {
  const params = useParams<{ id: string }>();
  return (
    <AdminGate permission="tickets:view">
      <AccountDashboard accountId={params.id} />
    </AdminGate>
  );
}
